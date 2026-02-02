import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface SlackTokenResponse {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id?: string;
  app_id: string;
  team: {
    id: string;
    name: string;
  };
  authed_user: {
    id: string;
    scope: string;
    access_token: string;
    token_type: string;
  };
  error?: string;
}

interface SlackUser {
  ok: boolean;
  user: {
    id: string;
    name: string;
    real_name: string;
    email?: string;
  };
}

@Injectable()
export class SlackOAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.clientId = this.configService.get('SLACK_CLIENT_ID') || '';
    this.clientSecret = this.configService.get('SLACK_CLIENT_SECRET') || '';
    this.callbackUrl = this.configService.get('SLACK_CALLBACK_URL') || '';
  }

  getAuthorizationUrl(state: string, isBot = false): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      state,
    });

    if (isBot) {
      // Bot scopes for workspace integration
      params.set('scope', 'channels:history,channels:read,chat:write,users:read');
      params.set('user_scope', 'identify');
    } else {
      // User scopes for personal connection
      params.set('user_scope', 'identify,channels:history,channels:read');
    }

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<SlackTokenResponse> {
    const response = await firstValueFrom(
      this.httpService.post<SlackTokenResponse>(
        'https://slack.com/api/oauth.v2.access',
        null,
        {
          params: {
            client_id: this.clientId,
            client_secret: this.clientSecret,
            code,
            redirect_uri: this.callbackUrl,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      ),
    );

    if (!response.data.ok) {
      throw new Error(`Slack OAuth error: ${response.data.error}`);
    }

    return response.data;
  }

  async getUser(accessToken: string, userId: string): Promise<SlackUser> {
    const response = await firstValueFrom(
      this.httpService.get<SlackUser>('https://slack.com/api/users.info', {
        params: { user: userId },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }),
    );

    return response.data;
  }

  async getChannels(accessToken: string): Promise<{ id: string; name: string }[]> {
    const response = await firstValueFrom(
      this.httpService.get<{
        ok: boolean;
        channels: { id: string; name: string; is_member: boolean }[];
      }>('https://slack.com/api/conversations.list', {
        params: {
          types: 'public_channel,private_channel',
          exclude_archived: true,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }),
    );

    return response.data.channels || [];
  }
}
