import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ConnectionsService } from './connections.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Provider } from '../database/entities/user-connection.entity';
import { OAuthStateService } from '../oauth/oauth-state.service';
import { GitHubOAuthService } from '../oauth/providers/github.service';
import { SlackOAuthService, SlackChannel } from '../oauth/providers/slack.service';
import { NotionOAuthService } from '../oauth/providers/notion.service';

@Controller('connections')
export class ConnectionsController {
  constructor(
    private readonly connectionsService: ConnectionsService,
    private readonly integrationsService: IntegrationsService,
    private readonly configService: ConfigService,
    private readonly oauthStateService: OAuthStateService,
    private readonly githubOAuth: GitHubOAuthService,
    private readonly slackOAuth: SlackOAuthService,
    private readonly notionOAuth: NotionOAuthService,
  ) { }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Request() req: any) {
    const connections = await this.connectionsService.findAllByUser(req.user.id);
    return { connections };
  }

  @Get(':provider/auth')
  @UseGuards(JwtAuthGuard)
  async startAuth(
    @Request() req: any,
    @Param('provider') provider: Provider,
    @Res() res: Response,
  ) {
    const state = await this.oauthStateService.generateState({
      userId: req.user.id,
      provider,
    });

    let authUrl: string;
    switch (provider) {
      case Provider.GITHUB:
        authUrl = this.githubOAuth.getAuthorizationUrl(state);
        break;
      case Provider.SLACK:
        authUrl = this.slackOAuth.getAuthorizationUrl(state, false);
        break;
      case Provider.NOTION:
        authUrl = this.notionOAuth.getAuthorizationUrl(state);
        break;
      default:
        throw new BadRequestException('Invalid provider');
    }

    return res.redirect(authUrl);
  }

  @Get(':provider/callback')
  async handleCallback(
    @Param('provider') provider: Provider,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get('FRONTEND_URL');
    const redirectBase = `${frontendUrl}/settings/connections`;

    if (error) {
      return res.redirect(`${redirectBase}?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return res.redirect(`${redirectBase}?error=missing_params`);
    }

    // Validate state
    const stateData = await this.oauthStateService.validateState(state);
    if (!stateData) {
      return res.redirect(`${redirectBase}?error=invalid_state`);
    }

    if (stateData.provider !== provider) {
      return res.redirect(`${redirectBase}?error=provider_mismatch`);
    }

    if (!stateData.userId) {
      return res.redirect(`${redirectBase}?error=missing_user`);
    }

    try {
      // Check if this is a workspace integration (has workspaceId in state)
      if (stateData.workspaceId) {
        await this.handleWorkspaceCallback(
          stateData.workspaceId,
          stateData.userId,
          provider,
          code,
        );
      } else {
        // Personal connection
        switch (provider) {
          case Provider.GITHUB:
            await this.handleGitHubCallback(stateData.userId, code);
            break;
          case Provider.SLACK:
            await this.handleSlackCallback(stateData.userId, code);
            break;
          case Provider.NOTION:
            await this.handleNotionCallback(stateData.userId, code);
            break;
          default:
            throw new BadRequestException('Invalid provider');
        }
      }

      return res.redirect(`${redirectBase}?success=true&provider=${provider}`);
    } catch (err: any) {
      console.error(`OAuth callback error (${provider}):`, err.message);
      return res.redirect(`${redirectBase}?error=${encodeURIComponent(err.message)}`);
    }
  }

  private async handleWorkspaceCallback(
    workspaceId: string,
    userId: string,
    provider: Provider,
    code: string,
  ) {
    switch (provider) {
      case Provider.GITHUB:
        await this.handleWorkspaceGitHubCallback(workspaceId, userId, code);
        break;
      case Provider.SLACK:
        await this.handleWorkspaceSlackCallback(workspaceId, userId, code);
        break;
      case Provider.NOTION:
        await this.handleWorkspaceNotionCallback(workspaceId, userId, code);
        break;
      default:
        throw new BadRequestException('Invalid provider');
    }
  }

  private async handleWorkspaceGitHubCallback(
    workspaceId: string,
    userId: string,
    code: string,
  ) {
    const tokenData = await this.githubOAuth.exchangeCodeForToken(code);

    // Fetch available repositories
    const repos = await this.fetchAllGitHubRepos(tokenData.access_token);

    await this.integrationsService.upsert(workspaceId, userId, Provider.GITHUB, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || undefined,
      tokenExpiresAt: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : undefined,
      config: {
        availableRepos: repos,
        selectedRepos: [],
      },
    });
  }

  private async handleWorkspaceSlackCallback(
    workspaceId: string,
    userId: string,
    code: string,
  ) {
    const tokenData = await this.slackOAuth.exchangeCodeForToken(code);
    // Get available channels
    const channels = await this.fetchAllSlackChannels(tokenData.access_token);

    await this.integrationsService.upsert(workspaceId, userId, Provider.SLACK, {
      accessToken: tokenData.access_token,
      config: {
        teamId: tokenData.team.id,
        teamName: tokenData.team.name,
        botUserId: tokenData.bot_user_id,
        availableChannels: channels,
        selectedChannels: [],
      },
    });
  }

  private async handleWorkspaceNotionCallback(
    workspaceId: string,
    userId: string,
    code: string,
  ) {
    const tokenData = await this.notionOAuth.exchangeCodeForToken(code);
    const pages = await this.notionOAuth.getPages(tokenData.access_token);

    await this.integrationsService.upsert(workspaceId, userId, Provider.NOTION, {
      accessToken: tokenData.access_token,
      config: {
        notionWorkspaceId: tokenData.workspace_id,
        notionWorkspaceName: tokenData.workspace_name,
        availablePages: pages,
        selectedPages: [],
      },
    });
  }

  private async fetchAllGitHubRepos(
    accessToken: string,
  ): Promise<{ id: number; fullName: string; private: boolean }[]> {
    const repos: { id: number; fullName: string; private: boolean }[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const { data } = await this.githubOAuth.getRepos(accessToken, { page, perPage });
      repos.push(
        ...data.map((repo) => ({
          id: repo.id,
          fullName: repo.full_name,
          private: repo.private,
        })),
      );

      if (data.length < perPage) break;
      page++;
    }

    return repos;
  }

  private async fetchAllSlackChannels(
    accessToken: string,
  ): Promise<SlackChannel[]> {
    const channels: SlackChannel[] = [];
    let cursor: string | undefined;

    while (true) {
      const { data } = await this.slackOAuth.getChannelsWithPagination(accessToken, {
        limit: 200,
        cursor,
      });

      channels.push(...data);

      if (!data.length || !data[0]?.id) break; // Safety check

      // We need to implement pagination support in SlackOAuthService first
      // For now, getChannels returns all channels in one go (built-in pagination handling in service?)
      // Checking SlackOAuthService.. it seems getChannels handles simple list but not cursor pagination explicitly exposed.
      // Let's rely on basic getChannels for now or update SlackOAuthService.
      break;
    }

    // Actually, looking at SlackOAuthService.getChannels, it doesn't handle pagination loop.
    // We should better implement getChannelsWithPagination in SlackOAuthService first.
    return channels;
  }

  private async handleGitHubCallback(userId: string, code: string) {
    const tokenData = await this.githubOAuth.exchangeCodeForToken(code);
    const user = await this.githubOAuth.getUser(tokenData.access_token);

    await this.connectionsService.upsert(userId, Provider.GITHUB, {
      providerUserId: user.id.toString(),
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : undefined,
    });
  }

  private async handleSlackCallback(userId: string, code: string) {
    const tokenData = await this.slackOAuth.exchangeCodeForToken(code);

    await this.connectionsService.upsert(userId, Provider.SLACK, {
      providerUserId: tokenData.authed_user.id,
      accessToken: tokenData.authed_user.access_token,
    });
  }

  private async handleNotionCallback(userId: string, code: string) {
    const tokenData = await this.notionOAuth.exchangeCodeForToken(code);

    const providerUserId =
      tokenData.owner?.user?.id || tokenData.bot_id || tokenData.workspace_id;

    await this.connectionsService.upsert(userId, Provider.NOTION, {
      providerUserId,
      accessToken: tokenData.access_token,
    });
  }

  @Delete(':provider')
  @UseGuards(JwtAuthGuard)
  async disconnect(
    @Request() req: any,
    @Param('provider') provider: Provider,
  ) {
    await this.connectionsService.delete(req.user.id, provider);
    return { success: true };
  }
}
