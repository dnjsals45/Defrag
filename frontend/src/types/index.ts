export interface User {
  id: string;
  email: string;
  nickname: string;
  createdAt?: string;
}

export interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'team';
  ownerId: string;
  role?: string;
  memberCount?: number;
  createdAt: string;
}

export interface WorkspaceMember {
  userId: string;
  email: string;
  nickname: string;
  role: 'ADMIN' | 'MEMBER';
  joinedAt: string;
}

export interface Connection {
  provider: 'github' | 'slack' | 'notion';
  connected: boolean;
  providerUserId?: string;
}

export interface Integration {
  provider: 'github' | 'slack' | 'notion';
  connected: boolean;
  config?: Record<string, unknown>;
  connectedAt?: string;
}

export interface ContextItem {
  id: string;
  title: string;
  sourceType: 'github_pr' | 'github_issue' | 'slack_message' | 'notion_page' | 'web_article';
  sourceUrl?: string;
  content?: string;
  snippet?: string;
  createdAt: string;
}

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  sourceType: string;
  sourceUrl?: string;
  score: number;
}

export interface AskResponse {
  answer: string;
  sources?: {
    id: string;
    title: string;
    sourceType: string;
    sourceUrl?: string;
    relevantSnippet: string;
  }[];
}

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  workspaceName: string;
  inviterNickname: string;
  role: 'ADMIN' | 'MEMBER';
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: string;
  expiresAt: string;
}
