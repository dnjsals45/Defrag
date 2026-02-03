import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface KakaoTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in: number;
  refresh_token_expires_in?: number;
  scope?: string;
}

interface KakaoAccount {
  email?: string;
  email_needs_agreement?: boolean;
  is_email_valid?: boolean;
  is_email_verified?: boolean;
  profile?: {
    nickname?: string;
    thumbnail_image_url?: string;
    profile_image_url?: string;
  };
  profile_nickname_needs_agreement?: boolean;
  profile_image_needs_agreement?: boolean;
}

export interface KakaoUser {
  id: number;
  connected_at?: string;
  kakao_account?: KakaoAccount;
}

@Injectable()
export class KakaoOAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.clientId = this.configService.get('KAKAO_CLIENT_ID') || '';
    this.clientSecret = this.configService.get('KAKAO_CLIENT_SECRET') || '';
    this.callbackUrl = this.configService.get('KAKAO_CALLBACK_URL') || '';
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      response_type: 'code',
      state,
      scope: 'profile_nickname profile_image account_email',
    });

    return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<KakaoTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.callbackUrl,
      code,
    });

    const response = await firstValueFrom(
      this.httpService.post<KakaoTokenResponse>(
        'https://kauth.kakao.com/oauth/token',
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
          },
        },
      ),
    );

    return response.data;
  }

  async getUser(accessToken: string): Promise<KakaoUser> {
    const response = await firstValueFrom(
      this.httpService.get<KakaoUser>(
        'https://kapi.kakao.com/v2/user/me',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
          },
        },
      ),
    );

    return response.data;
  }
}
