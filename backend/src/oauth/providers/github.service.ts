import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as jwt from 'jsonwebtoken';

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
}

interface GitHubInstallationTokenResponse {
  token: string;
  expires_at: string;
  permissions: Record<string, string>;
  repository_selection: string;
}

interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

interface GitHubInstallation {
  id: number;
  account: {
    login: string;
    id: number;
    type: string;
  };
  repository_selection: string;
  app_id: number;
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

@Injectable()
export class GitHubOAuthService {
  private readonly appId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly privateKey: string;
  private readonly callbackUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.appId = this.configService.get('GITHUB_APP_ID') || '';
    this.clientId = this.configService.get('GITHUB_CLIENT_ID') || '';
    this.clientSecret = this.configService.get('GITHUB_CLIENT_SECRET') || '';
    this.callbackUrl = this.configService.get('GITHUB_CALLBACK_URL') || '';
    // Private key는 \n을 실제 줄바꿈으로 변환
    const rawKey = this.configService.get('GITHUB_PRIVATE_KEY') || '';
    this.privateKey = rawKey.replace(/\\n/g, '\n');
  }

  // GitHub App 설치 페이지 URL (사용자가 repo 선택)
  getInstallationUrl(state: string): string {
    const params = new URLSearchParams({ state });
    return `https://github.com/apps/${this.configService.get('GITHUB_APP_SLUG')}/installations/new?${params.toString()}`;
  }

  // OAuth 인증 URL (사용자 식별용)
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

  // App JWT 생성 (Installation Token 발급용)
  private generateAppJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60, // 60초 전부터 유효
      exp: now + 600, // 10분 후 만료
      iss: this.appId,
    };
    return jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
  }

  // 사용자의 Installation 목록 조회
  async getUserInstallations(userAccessToken: string): Promise<GitHubInstallation[]> {
    const response = await firstValueFrom(
      this.httpService.get<{ installations: GitHubInstallation[] }>(
        'https://api.github.com/user/installations',
        {
          headers: {
            Authorization: `Bearer ${userAccessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      ),
    );
    return response.data.installations;
  }

  // Installation Access Token 발급
  async getInstallationToken(installationId: number): Promise<GitHubInstallationTokenResponse> {
    const appJwt = this.generateAppJwt();
    const response = await firstValueFrom(
      this.httpService.post<GitHubInstallationTokenResponse>(
        `https://api.github.com/app/installations/${installationId}/access_tokens`,
        {},
        {
          headers: {
            Authorization: `Bearer ${appJwt}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      ),
    );
    return response.data;
  }

  // Installation에서 접근 가능한 리포지토리 목록
  async getInstallationRepos(
    installationToken: string,
    options: { page?: number; perPage?: number } = {},
  ): Promise<{
    data: GitHubRepo[];
    totalCount: number;
    headers: { 'x-ratelimit-remaining'?: string; link?: string };
  }> {
    const { page = 1, perPage = 30 } = options;
    const response = await firstValueFrom(
      this.httpService.get<{ total_count: number; repositories: GitHubRepo[] }>(
        'https://api.github.com/installation/repositories',
        {
          params: { page, per_page: perPage },
          headers: {
            Authorization: `Bearer ${installationToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      ),
    );

    return {
      data: response.data.repositories,
      totalCount: response.data.total_count,
      headers: {
        'x-ratelimit-remaining': response.headers['x-ratelimit-remaining'],
        link: response.headers['link'],
      },
    };
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

  // 기존 메서드들 (Installation Token으로 사용)
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
}
