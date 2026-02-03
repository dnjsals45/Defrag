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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Provider } from '../database/entities/user-connection.entity';
import { OAuthStateService } from '../oauth/oauth-state.service';
import { GitHubOAuthService } from '../oauth/providers/github.service';
import { SlackOAuthService } from '../oauth/providers/slack.service';
import { NotionOAuthService } from '../oauth/providers/notion.service';

@Controller('connections')
export class ConnectionsController {
  constructor(
    private readonly connectionsService: ConnectionsService,
    private readonly configService: ConfigService,
    private readonly oauthStateService: OAuthStateService,
    private readonly githubOAuth: GitHubOAuthService,
    private readonly slackOAuth: SlackOAuthService,
    private readonly notionOAuth: NotionOAuthService,
  ) {}

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

      return res.redirect(`${redirectBase}?success=true&provider=${provider}`);
    } catch (err: any) {
      console.error(`OAuth callback error (${provider}):`, err.message);
      return res.redirect(`${redirectBase}?error=${encodeURIComponent(err.message)}`);
    }
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
