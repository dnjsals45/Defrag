import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
}

interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

@Injectable()
export class GitHubOAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.clientId = this.configService.get('GITHUB_CLIENT_ID') || '';
    this.clientSecret = this.configService.get('GITHUB_CLIENT_SECRET') || '';
    this.callbackUrl = this.configService.get('GITHUB_CALLBACK_URL') || '';
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      scope: 'read:user user:email repo',
      state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<GitHubTokenResponse> {
    const response = await firstValueFrom(
      this.httpService.post<GitHubTokenResponse>(
        'https://github.com/login/oauth/access_token',
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: this.callbackUrl,
        },
        {
          headers: {
            Accept: 'application/json',
          },
        },
      ),
    );

    return response.data;
  }

  async getUser(accessToken: string): Promise<GitHubUser> {
    const response = await firstValueFrom(
      this.httpService.get<GitHubUser>('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }),
    );

    return response.data;
  }

  async getUserEmails(accessToken: string): Promise<{ email: string; primary: boolean }[]> {
    const response = await firstValueFrom(
      this.httpService.get<{ email: string; primary: boolean; verified: boolean }[]>(
        'https://api.github.com/user/emails',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      ),
    );

    return response.data;
  }
}
