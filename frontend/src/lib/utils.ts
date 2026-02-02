import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return formatDate(date);
}

export function getSourceIcon(sourceType: string): string {
  const icons: Record<string, string> = {
    github_pr: '🔀',
    github_issue: '🐛',
    github_commit: '📝',
    slack_message: '💬',
    notion_page: '📄',
    web_article: '🌐',
  };
  return icons[sourceType] || '📎';
}

export function getSourceLabel(sourceType: string): string {
  const labels: Record<string, string> = {
    github_pr: 'GitHub PR',
    github_issue: 'GitHub Issue',
    github_commit: 'GitHub Commit',
    slack_message: 'Slack',
    notion_page: 'Notion',
    web_article: 'Web Article',
  };
  return labels[sourceType] || sourceType;
}
