import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Provider } from '../database/entities/user-connection.entity';
import { UpdateIntegrationConfigDto } from './dto/update-integration-config.dto';
import { OAuthStateService } from '../oauth/oauth-state.service';
import { GitHubOAuthService } from '../oauth/providers/github.service';
import { SlackOAuthService, SlackChannel } from '../oauth/providers/slack.service';
import { NotionOAuthService } from '../oauth/providers/notion.service';

@Controller('workspaces/:workspaceId/integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly configService: ConfigService,
    private readonly oauthStateService: OAuthStateService,
    private readonly githubOAuth: GitHubOAuthService,
    private readonly slackOAuth: SlackOAuthService,
    private readonly notionOAuth: NotionOAuthService,
  ) { }

  @Get()
  async findAll(
    @Request() req: any,
    @Param('workspaceId') workspaceId: string,
  ) {
    const integrations = await this.integrationsService.findAllByWorkspace(
      workspaceId,
      req.user.id,
    );
    return { integrations };
  }

  @Get(':provider/auth')
  async startAuth(
    @Request() req: any,
    @Param('workspaceId') workspaceId: string,
    @Param('provider') provider: Provider,
    @Res() res: Response,
  ) {
    // Verify user has access to workspace
    await this.integrationsService.findAllByWorkspace(workspaceId, req.user.id);

    const state = await this.oauthStateService.generateState({
      userId: req.user.id,
      provider,
      workspaceId,
    });

    let authUrl: string;
    switch (provider) {
      case Provider.GITHUB:
        authUrl = this.githubOAuth.getAuthorizationUrl(state);
        break;
      case Provider.SLACK:
        // For workspace integration, use bot scopes
        authUrl = this.slackOAuth.getAuthorizationUrl(state, true);
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
    @Param('workspaceId') workspaceId: string,
    @Param('provider') provider: Provider,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('installation_id') installationId: string,
    @Query('setup_action') setupAction: string,
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

    // Validate state (required for all flows)
    const stateData = await this.oauthStateService.validateState(state);
    if (!stateData) {
      return res.redirect(`${redirectBase}?error=invalid_state`);
    }

    if (stateData.provider !== provider || stateData.workspaceId !== workspaceId) {
      return res.redirect(`${redirectBase}?error=state_mismatch`);
    }

    if (!stateData.userId) {
      return res.redirect(`${redirectBase}?error=missing_user`);
    }

    try {
      switch (provider) {
        case Provider.GITHUB:
          await this.handleGitHubCallback(workspaceId, stateData.userId, code);
          break;
        case Provider.SLACK:
          await this.handleSlackCallback(workspaceId, stateData.userId, code);
          break;
        case Provider.NOTION:
          await this.handleNotionCallback(workspaceId, stateData.userId, code);
          break;
        default:
          throw new BadRequestException('Invalid provider');
      }

      return res.redirect(`${redirectBase}?success=true&provider=${provider}&openSettings=${provider}`);
    } catch (err: any) {
      console.error(`OAuth callback error (${provider}):`, err.message);
      return res.redirect(`${redirectBase}?error=${encodeURIComponent(err.message)}`);
    }
  }

  private async handleGitHubCallback(
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
        selectedRepos: [], // User will select which repos to sync
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
      const { data, nextCursor } = await this.slackOAuth.getChannelsWithPagination(accessToken, {
        limit: 200,
        cursor,
      });

      channels.push(...data);

      if (!nextCursor) break;
      cursor = nextCursor;
    }

    return channels;
  }

  private async fetchAllNotionPages(
    accessToken: string,
  ): Promise<{ id: string; title: string; icon?: { type: string; emoji?: string } }[]> {
    const pages: { id: string; title: string; icon?: { type: string; emoji?: string } }[] = [];
    let cursor: string | undefined;

    while (true) {
      const result = await this.notionOAuth.getPages(accessToken, cursor);

      pages.push(
        ...result.pages.map((page) => {
          const titleProp = Object.values(page.properties).find((p: any) => p.title);
          const title = titleProp?.title?.[0]?.plain_text || 'Untitled';
          return {
            id: page.id,
            title,
            icon: page.icon,
          };
        }),
      );

      if (!result.hasMore || !result.nextCursor) break;
      cursor = result.nextCursor;
    }

    return pages;
  }

  private async handleSlackCallback(
    workspaceId: string,
    userId: string,
    code: string,
  ) {
    console.log('=== Slack OAuth Callback Start ===');
    const tokenData = await this.slackOAuth.exchangeCodeForToken(code);

    console.log('Slack OAuth response:', JSON.stringify({
      hasAccessToken: !!tokenData.access_token,
      accessTokenPrefix: tokenData.access_token?.substring(0, 20),
      hasAuthedUser: !!tokenData.authed_user,
      authedUserHasToken: !!tokenData.authed_user?.access_token,
      authedUserTokenPrefix: tokenData.authed_user?.access_token?.substring(0, 20),
      team: tokenData.team,
      scope: tokenData.scope,
      authedUserScope: tokenData.authed_user?.scope,
    }, null, 2));

    // Use user's access token if available, otherwise fall back to bot token
    const userAccessToken = tokenData.authed_user?.access_token || tokenData.access_token;

    console.log('Using token prefix:', userAccessToken?.substring(0, 20));

    if (!userAccessToken) {
      throw new Error('No access token received from Slack');
    }

    // Get available channels using user token
    console.log('Fetching channels...');
    const channels = await this.fetchAllSlackChannels(userAccessToken);
    console.log(`Fetched ${channels.length} channels`);

    await this.integrationsService.upsert(workspaceId, userId, Provider.SLACK, {
      accessToken: userAccessToken,
      config: {
        teamId: tokenData.team.id,
        teamName: tokenData.team.name,
        authedUserId: tokenData.authed_user?.id,
        availableChannels: channels,
        selectedChannels: [], // User will select which channels to sync
      },
    });
    console.log('=== Slack OAuth Callback Complete ===');
  }

  private async handleNotionCallback(
    workspaceId: string,
    userId: string,
    code: string,
  ) {
    const tokenData = await this.notionOAuth.exchangeCodeForToken(code);

    // Get available pages with pagination
    const pages = await this.fetchAllNotionPages(tokenData.access_token);

    await this.integrationsService.upsert(workspaceId, userId, Provider.NOTION, {
      accessToken: tokenData.access_token,
      config: {
        notionWorkspaceId: tokenData.workspace_id,
        notionWorkspaceName: tokenData.workspace_name,
        availablePages: pages,
        selectedPages: [], // User will select which pages to sync
      },
    });
  }

  @Patch(':provider')
  async updateConfig(
    @Request() req: any,
    @Param('workspaceId') workspaceId: string,
    @Param('provider') provider: Provider,
    @Body() dto: UpdateIntegrationConfigDto,
  ) {
    await this.integrationsService.updateConfig(
      workspaceId,
      req.user.id,
      provider,
      dto.config,
    );
    return { success: true };
  }

  @Delete(':provider')
  async disconnect(
    @Request() req: any,
    @Param('workspaceId') workspaceId: string,
    @Param('provider') provider: Provider,
  ) {
    await this.integrationsService.delete(workspaceId, req.user.id, provider);
    return { success: true };
  }
}
