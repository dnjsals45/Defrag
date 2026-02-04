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

export interface SlackChannel {
  id: string;
  name: string;
  is_member: boolean;
  is_private: boolean;
  topic?: { value: string };
  purpose?: { value: string };
}

export interface SlackMessage {
  type: string;
  ts: string;
  user?: string;
  text: string;
  thread_ts?: string;
  reply_count?: number;
  reply_users_count?: number;
  reactions?: { name: string; count: number }[];
  attachments?: { text?: string; fallback?: string }[];
  files?: { name: string; url_private?: string }[];
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
    const backendUrl = this.configService.get('BACKEND_URL') || 'http://localhost:3001';
    this.callbackUrl = this.configService.get('SLACK_CALLBACK_URL') || `${backendUrl}/api/connections/slack/callback`;
  }

  getAuthorizationUrl(state: string, useUserToken = false): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      state,
    });

    if (useUserToken) {
      // User token for workspace integration - uses user's own permissions
      // User can access any channel they're already a member of
      params.set('user_scope', 'identify,channels:history,channels:read,groups:history,groups:read');
    } else {
      // User scopes for personal connection (simpler)
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

  async getChannels(accessToken: string): Promise<SlackChannel[]> {
    const response = await firstValueFrom(
      this.httpService.get<{
        ok: boolean;
        channels: SlackChannel[];
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

  async getChannelsWithPagination(
    accessToken: string,
    options: { limit?: number; cursor?: string; types?: string } = {},
  ): Promise<{ data: SlackChannel[]; nextCursor?: string }> {
    const { limit = 200, cursor, types = 'public_channel,private_channel' } = options;
    const params: Record<string, any> = {
      types,
      exclude_archived: true,
      limit,
    };
    if (cursor) params.cursor = cursor;

    const response = await firstValueFrom(
      this.httpService.get<{
        ok: boolean;
        channels: SlackChannel[];
        response_metadata?: { next_cursor: string };
        error?: string;
      }>('https://slack.com/api/conversations.list', {
        params,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }),
    );

    if (!response.data.ok) {
      throw new Error(`Slack API error: ${response.data.error}`);
    }

    return {
      data: response.data.channels || [],
      nextCursor: response.data.response_metadata?.next_cursor,
    };
  }

  // Data fetching methods for sync

  async getChannelHistory(
    accessToken: string,
    channelId: string,
    options: { limit?: number; oldest?: string; latest?: string; cursor?: string } = {},
  ): Promise<{
    messages: SlackMessage[];
    hasMore: boolean;
    nextCursor?: string;
    retryAfter?: number;
  }> {
    const { limit = 100, oldest, latest, cursor } = options;
    const params: Record<string, any> = {
      channel: channelId,
      limit,
    };
    if (oldest) params.oldest = oldest;
    if (latest) params.latest = latest;
    if (cursor) params.cursor = cursor;

    const response = await firstValueFrom(
      this.httpService.get<{
        ok: boolean;
        messages: SlackMessage[];
        has_more: boolean;
        response_metadata?: { next_cursor: string };
        error?: string;
      }>('https://slack.com/api/conversations.history', {
        params,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }),
    );

    if (!response.data.ok) {
      if (response.data.error === 'ratelimited') {
        const retryAfter = parseInt(response.headers['retry-after'] || '60', 10);
        return { messages: [], hasMore: false, retryAfter };
      }
      throw new Error(`Slack API error: ${response.data.error}`);
    }

    return {
      messages: response.data.messages || [],
      hasMore: response.data.has_more || false,
      nextCursor: response.data.response_metadata?.next_cursor,
    };
  }

  async getThreadReplies(
    accessToken: string,
    channelId: string,
    threadTs: string,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{
    messages: SlackMessage[];
    hasMore: boolean;
    nextCursor?: string;
  }> {
    const { limit = 100, cursor } = options;
    const params: Record<string, any> = {
      channel: channelId,
      ts: threadTs,
      limit,
    };
    if (cursor) params.cursor = cursor;

    const response = await firstValueFrom(
      this.httpService.get<{
        ok: boolean;
        messages: SlackMessage[];
        has_more: boolean;
        response_metadata?: { next_cursor: string };
        error?: string;
      }>('https://slack.com/api/conversations.replies', {
        params,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }),
    );

    if (!response.data.ok) {
      throw new Error(`Slack API error: ${response.data.error}`);
    }

    return {
      messages: response.data.messages || [],
      hasMore: response.data.has_more || false,
      nextCursor: response.data.response_metadata?.next_cursor,
    };
  }
}
