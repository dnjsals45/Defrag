import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope?: string;
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

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  updated_at: string;
  pushed_at: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  user: { login: string; id: number };
  labels: { name: string }[];
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  pull_request?: { url: string };
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  user: { login: string; id: number };
  labels: { name: string }[];
  comments: number;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  head: { ref: string };
  base: { ref: string };
}

export interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string };
  };
  author: { login: string; id: number } | null;
}

export interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: 'file' | 'dir';
  content?: string;  // base64 encoded
  encoding?: string;
}

export interface GitHubFileContent {
  path: string;
  name: string;
  content: string;
  sha: string;
  html_url: string;
  size: number;
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
    const backendUrl = this.configService.get('BACKEND_URL') || 'http://localhost:3001';
    this.callbackUrl = this.configService.get('GITHUB_CALLBACK_URL') || `${backendUrl}/api/connections/github/callback`;
  }

  // OAuth 인증 URL
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      state,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  // Code를 User Access Token으로 교환
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

  async getRepos(
    accessToken: string,
    options: { page?: number; perPage?: number } = {},
  ): Promise<{
    data: GitHubRepo[];
    headers: { 'x-ratelimit-remaining'?: string; link?: string };
  }> {
    const { page = 1, perPage = 30 } = options;
    const response = await firstValueFrom(
      this.httpService.get<GitHubRepo[]>('https://api.github.com/user/repos', {
        params: {
          page,
          per_page: perPage,
          sort: 'updated',
          direction: 'desc',
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }),
    );

    return {
      data: response.data,
      headers: {
        'x-ratelimit-remaining': response.headers['x-ratelimit-remaining'],
        link: response.headers['link'],
      },
    };
  }

  async getIssues(
    accessToken: string,
    repo: string,
    options: { page?: number; perPage?: number; state?: string; since?: string } = {},
  ): Promise<{
    data: GitHubIssue[];
    headers: { 'x-ratelimit-remaining'?: string; link?: string };
  }> {
    const { page = 1, perPage = 30, state = 'all', since } = options;
    const params: Record<string, any> = {
      page,
      per_page: perPage,
      state,
      sort: 'updated',
      direction: 'desc',
    };
    if (since) params.since = since;

    const response = await firstValueFrom(
      this.httpService.get<GitHubIssue[]>(
        `https://api.github.com/repos/${repo}/issues`,
        {
          params,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      ),
    );

    return {
      data: response.data,
      headers: {
        'x-ratelimit-remaining': response.headers['x-ratelimit-remaining'],
        link: response.headers['link'],
      },
    };
  }

  async getPullRequests(
    accessToken: string,
    repo: string,
    options: { page?: number; perPage?: number; state?: string } = {},
  ): Promise<{
    data: GitHubPullRequest[];
    headers: { 'x-ratelimit-remaining'?: string; link?: string };
  }> {
    const { page = 1, perPage = 30, state = 'all' } = options;
    const response = await firstValueFrom(
      this.httpService.get<GitHubPullRequest[]>(
        `https://api.github.com/repos/${repo}/pulls`,
        {
          params: {
            page,
            per_page: perPage,
            state,
            sort: 'updated',
            direction: 'desc',
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      ),
    );

    return {
      data: response.data,
      headers: {
        'x-ratelimit-remaining': response.headers['x-ratelimit-remaining'],
        link: response.headers['link'],
      },
    };
  }

  async getCommits(
    accessToken: string,
    repo: string,
    options: { page?: number; perPage?: number; since?: string } = {},
  ): Promise<{
    data: GitHubCommit[];
    headers: { 'x-ratelimit-remaining'?: string; link?: string };
  }> {
    const { page = 1, perPage = 30, since } = options;
    const params: Record<string, any> = {
      page,
      per_page: perPage,
    };
    if (since) params.since = since;

    const response = await firstValueFrom(
      this.httpService.get<GitHubCommit[]>(
        `https://api.github.com/repos/${repo}/commits`,
        {
          params,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      ),
    );

    return {
      data: response.data,
      headers: {
        'x-ratelimit-remaining': response.headers['x-ratelimit-remaining'],
        link: response.headers['link'],
      },
    };
  }

  async getContents(
    accessToken: string,
    repo: string,
    path: string = '',
  ): Promise<{
    data: GitHubContent | GitHubContent[];
    headers: { 'x-ratelimit-remaining'?: string };
  }> {
    const response = await firstValueFrom(
      this.httpService.get<GitHubContent | GitHubContent[]>(
        `https://api.github.com/repos/${repo}/contents/${path}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      ),
    );

    return {
      data: response.data,
      headers: {
        'x-ratelimit-remaining': response.headers['x-ratelimit-remaining'],
      },
    };
  }

  async getFileContent(
    accessToken: string,
    repo: string,
    path: string,
  ): Promise<GitHubFileContent | null> {
    try {
      const { data } = await this.getContents(accessToken, repo, path);

      if (Array.isArray(data)) {
        return null; // It's a directory, not a file
      }

      if (data.type !== 'file' || !data.content) {
        return null;
      }

      // Decode base64 content
      const content = Buffer.from(data.content, 'base64').toString('utf-8');

      return {
        path: data.path,
        name: data.name,
        content,
        sha: data.sha,
        html_url: data.html_url,
        size: data.size,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getMarkdownFiles(
    accessToken: string,
    repo: string,
    path: string = '',
  ): Promise<GitHubContent[]> {
    try {
      const { data } = await this.getContents(accessToken, repo, path);

      if (!Array.isArray(data)) {
        // Single file
        if (data.name.toLowerCase().endsWith('.md')) {
          return [data];
        }
        return [];
      }

      // Filter markdown files
      return data.filter(
        (item) => item.type === 'file' && item.name.toLowerCase().endsWith('.md'),
      );
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }
}
