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

export interface NotionPage {
  id: string;
  object: 'page';
  created_time: string;
  last_edited_time: string;
  url: string;
  parent: { type: string; database_id?: string; page_id?: string; workspace?: boolean };
  properties: Record<string, NotionProperty>;
  icon?: { type: string; emoji?: string; external?: { url: string } };
}

export interface NotionProperty {
  id: string;
  type: string;
  title?: { plain_text: string }[];
  rich_text?: { plain_text: string }[];
  number?: number;
  select?: { name: string };
  multi_select?: { name: string }[];
  date?: { start: string; end?: string };
  checkbox?: boolean;
  url?: string;
  email?: string;
}

export interface NotionBlock {
  id: string;
  object: 'block';
  type: string;
  created_time: string;
  last_edited_time: string;
  has_children: boolean;
  paragraph?: { rich_text: { plain_text: string }[] };
  heading_1?: { rich_text: { plain_text: string }[] };
  heading_2?: { rich_text: { plain_text: string }[] };
  heading_3?: { rich_text: { plain_text: string }[] };
  bulleted_list_item?: { rich_text: { plain_text: string }[] };
  numbered_list_item?: { rich_text: { plain_text: string }[] };
  to_do?: { rich_text: { plain_text: string }[]; checked: boolean };
  code?: { rich_text: { plain_text: string }[]; language: string };
  quote?: { rich_text: { plain_text: string }[] };
  callout?: { rich_text: { plain_text: string }[]; icon?: { emoji?: string } };
}

export interface NotionDatabase {
  id: string;
  object: 'database';
  title: { plain_text: string }[];
  url: string;
  created_time: string;
  last_edited_time: string;
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
    const backendUrl = this.configService.get('BACKEND_URL') || 'http://localhost:3001';
    this.callbackUrl = this.configService.get('NOTION_CALLBACK_URL') || `${backendUrl}/api/connections/notion/callback`;
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

  async getPages(
    accessToken: string,
    cursor?: string,
  ): Promise<{ pages: NotionPage[]; hasMore: boolean; nextCursor?: string }> {
    const body: Record<string, any> = {
      filter: { property: 'object', value: 'page' },
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;

    const response = await firstValueFrom(
      this.httpService.post<{
        results: NotionPage[];
        has_more: boolean;
        next_cursor: string | null;
      }>(
        'https://api.notion.com/v1/search',
        body,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    return {
      pages: response.data.results,
      hasMore: response.data.has_more,
      nextCursor: response.data.next_cursor || undefined,
    };
  }

  // Data fetching methods for sync

  async getPageContent(
    accessToken: string,
    pageId: string,
  ): Promise<NotionPage | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<NotionPage>(
          `https://api.notion.com/v1/pages/${pageId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Notion-Version': '2022-06-28',
            },
          },
        ),
      );
      return response.data;
    } catch {
      return null;
    }
  }

  async getPageBlocks(
    accessToken: string,
    pageId: string,
    cursor?: string,
  ): Promise<{ blocks: NotionBlock[]; hasMore: boolean; nextCursor?: string }> {
    const params: Record<string, any> = { page_size: 100 };
    if (cursor) params.start_cursor = cursor;

    const response = await firstValueFrom(
      this.httpService.get<{
        results: NotionBlock[];
        has_more: boolean;
        next_cursor: string | null;
      }>(
        `https://api.notion.com/v1/blocks/${pageId}/children`,
        {
          params,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Notion-Version': '2022-06-28',
          },
        },
      ),
    );

    return {
      blocks: response.data.results,
      hasMore: response.data.has_more,
      nextCursor: response.data.next_cursor || undefined,
    };
  }

  async getDatabases(
    accessToken: string,
    cursor?: string,
  ): Promise<{ databases: NotionDatabase[]; hasMore: boolean; nextCursor?: string }> {
    const body: Record<string, any> = {
      filter: { property: 'object', value: 'database' },
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;

    const response = await firstValueFrom(
      this.httpService.post<{
        results: NotionDatabase[];
        has_more: boolean;
        next_cursor: string | null;
      }>(
        'https://api.notion.com/v1/search',
        body,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    return {
      databases: response.data.results,
      hasMore: response.data.has_more,
      nextCursor: response.data.next_cursor || undefined,
    };
  }
}
