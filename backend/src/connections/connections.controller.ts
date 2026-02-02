import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ConnectionsService } from './connections.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Provider } from '../database/entities/user-connection.entity';

@Controller('connections')
@UseGuards(JwtAuthGuard)
export class ConnectionsController {
  constructor(
    private readonly connectionsService: ConnectionsService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  async findAll(@Request() req: any) {
    const connections = await this.connectionsService.findAllByUser(req.user.id);
    return { connections };
  }

  @Get(':provider/auth')
  async startAuth(
    @Param('provider') provider: Provider,
    @Res() res: Response,
  ) {
    // TODO: Implement OAuth redirect for each provider
    const redirectUrls: Record<Provider, string> = {
      [Provider.GITHUB]: this.buildGitHubAuthUrl(),
      [Provider.SLACK]: this.buildSlackAuthUrl(),
      [Provider.NOTION]: this.buildNotionAuthUrl(),
    };

    const url = redirectUrls[provider];
    if (!url) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    return res.redirect(url);
  }

  @Get(':provider/callback')
  async handleCallback(
    @Param('provider') provider: Provider,
    @Request() req: any,
    @Res() res: Response,
  ) {
    // TODO: Handle OAuth callback, exchange code for tokens
    // This is a placeholder - actual implementation depends on provider
    const frontendUrl = this.configService.get('FRONTEND_URL');
    return res.redirect(`${frontendUrl}/settings/connections?success=true`);
  }

  @Delete(':provider')
  async disconnect(
    @Request() req: any,
    @Param('provider') provider: Provider,
  ) {
    await this.connectionsService.delete(req.user.id, provider);
    return { success: true };
  }

  private buildGitHubAuthUrl(): string {
    const clientId = this.configService.get('GITHUB_CLIENT_ID');
    const callbackUrl = this.configService.get('GITHUB_CALLBACK_URL');
    const scope = 'read:user user:email repo';
    return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${callbackUrl}&scope=${scope}`;
  }

  private buildSlackAuthUrl(): string {
    const clientId = this.configService.get('SLACK_CLIENT_ID');
    const callbackUrl = this.configService.get('SLACK_CALLBACK_URL');
    const scope = 'channels:history,channels:read,users:read';
    return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&redirect_uri=${callbackUrl}&scope=${scope}`;
  }

  private buildNotionAuthUrl(): string {
    const clientId = this.configService.get('NOTION_CLIENT_ID');
    const callbackUrl = this.configService.get('NOTION_CALLBACK_URL');
    return `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&redirect_uri=${callbackUrl}&response_type=code&owner=user`;
  }
}
