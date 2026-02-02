import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface NotionTokenResponse {
  access_token: string;
  token_type: string;
  bot_id: string;
  workspace_id: string;
  workspace_name: string;
  workspace_icon: string | null;
  owner: {
    type: string;
    user?: {
      id: string;
      name: string;
      avatar_url: string;
      type: string;
      person: {
        email: string;
      };
    };
  };
  duplicated_template_id: string | null;
}

interface NotionUser {
  id: string;
  name: string;
  avatar_url: string | null;
  type: string;
  person?: {
    email: string;
  };
}

@Injectable()
export class NotionOAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.clientId = this.configService.get('NOTION_CLIENT_ID') || '';
    this.clientSecret = this.configService.get('NOTION_CLIENT_SECRET') || '';
    this.callbackUrl = this.configService.get('NOTION_CALLBACK_URL') || '';
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      response_type: 'code',
      owner: 'user',
      state,
    });

    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<NotionTokenResponse> {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await firstValueFrom(
      this.httpService.post<NotionTokenResponse>(
        'https://api.notion.com/v1/oauth/token',
        {
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.callbackUrl,
        },
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28',
          },
        },
      ),
    );

    return response.data;
  }

  async getUser(accessToken: string): Promise<NotionUser | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<NotionUser>('https://api.notion.com/v1/users/me', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Notion-Version': '2022-06-28',
          },
        }),
      );
      return response.data;
    } catch {
      return null;
    }
  }

  async getPages(accessToken: string): Promise<{ id: string; title: string }[]> {
    const response = await firstValueFrom(
      this.httpService.post<{
        results: {
          id: string;
          properties?: {
            title?: {
              title?: { plain_text: string }[];
            };
            Name?: {
              title?: { plain_text: string }[];
            };
          };
        }[];
      }>(
        'https://api.notion.com/v1/search',
        {
          filter: { property: 'object', value: 'page' },
          page_size: 100,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    return response.data.results.map((page) => {
      const titleProp = page.properties?.title || page.properties?.Name;
      const title = titleProp?.title?.[0]?.plain_text || 'Untitled';
      return { id: page.id, title };
    });
  }
}
