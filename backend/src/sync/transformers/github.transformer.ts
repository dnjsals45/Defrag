import { SourceType } from '../../database/entities/context-item.entity';
import {
  GitHubIssue,
  GitHubPullRequest,
  GitHubCommit,
  GitHubFileContent,
} from '../../oauth/providers/github.service';

export interface TransformedItem {
  externalId: string;
  sourceType: SourceType;
  title: string;
  content: string;
  sourceUrl: string;
  metadata: Record<string, any>;
  importanceScore: number;
  createdAt?: Date;
}

export class GitHubTransformer {
  static transformIssue(issue: GitHubIssue, repoFullName: string): TransformedItem {
    const content = [
      issue.body || '',
      `State: ${issue.state}`,
      `Labels: ${issue.labels.map((l) => l.name).join(', ') || 'none'}`,
      `Comments: ${issue.comments}`,
    ].join('\n\n');

    return {
      externalId: `github:issue:${repoFullName}:${issue.number}`,
      sourceType: SourceType.GITHUB_ISSUE,
      title: `[${repoFullName}] #${issue.number}: ${issue.title}`,
      content,
      sourceUrl: issue.html_url,
      metadata: {
        repo: repoFullName,
        number: issue.number,
        state: issue.state,
        labels: issue.labels.map((l) => l.name),
        author: issue.user.login,
        comments: issue.comments,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        closedAt: issue.closed_at,
      },
      importanceScore: GitHubTransformer.calculateIssueImportance(issue),
      createdAt: new Date(issue.created_at),
    };
  }

  static transformPullRequest(pr: GitHubPullRequest, repoFullName: string): TransformedItem {
    const content = [
      pr.body || '',
      `State: ${pr.state}${pr.merged_at ? ' (merged)' : ''}`,
      `Branch: ${pr.head.ref} → ${pr.base.ref}`,
      `Changes: +${pr.additions} -${pr.deletions} in ${pr.changed_files} files`,
      `Labels: ${pr.labels.map((l) => l.name).join(', ') || 'none'}`,
    ].join('\n\n');

    return {
      externalId: `github:pr:${repoFullName}:${pr.number}`,
      sourceType: SourceType.GITHUB_PR,
      title: `[${repoFullName}] PR #${pr.number}: ${pr.title}`,
      content,
      sourceUrl: pr.html_url,
      metadata: {
        repo: repoFullName,
        number: pr.number,
        state: pr.state,
        merged: !!pr.merged_at,
        labels: pr.labels.map((l) => l.name),
        author: pr.user.login,
        headBranch: pr.head.ref,
        baseBranch: pr.base.ref,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changed_files,
        commits: pr.commits,
        comments: pr.comments,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        closedAt: pr.closed_at,
        mergedAt: pr.merged_at,
      },
      importanceScore: GitHubTransformer.calculatePRImportance(pr),
      createdAt: new Date(pr.created_at),
    };
  }

  static transformCommit(commit: GitHubCommit, repoFullName: string): TransformedItem {
    const messageLines = commit.commit.message.split('\n');
    const title = messageLines[0];
    const body = messageLines.slice(1).join('\n').trim();

    return {
      externalId: `github:commit:${repoFullName}:${commit.sha}`,
      sourceType: SourceType.GITHUB_COMMIT,
      title: `[${repoFullName}] ${title}`,
      content: body || title,
      sourceUrl: commit.html_url,
      metadata: {
        repo: repoFullName,
        sha: commit.sha,
        shortSha: commit.sha.substring(0, 7),
        author: commit.author?.login || commit.commit.author.name,
        authorEmail: commit.commit.author.email,
        date: commit.commit.author.date,
      },
      importanceScore: GitHubTransformer.calculateCommitImportance(commit),
      createdAt: new Date(commit.commit.author.date),
    };
  }

  static transformDocument(
    file: GitHubFileContent,
    repoFullName: string,
  ): TransformedItem {
    // Extract title from first H1 heading or use filename
    const h1Match = file.content.match(/^#\s+(.+)$/m);
    const title = h1Match ? h1Match[1] : file.name.replace(/\.md$/i, '');

    return {
      externalId: `github:doc:${repoFullName}:${file.path}`,
      sourceType: SourceType.GITHUB_DOC,
      title: `[${repoFullName}] ${title}`,
      content: file.content,
      sourceUrl: file.html_url,
      metadata: {
        repo: repoFullName,
        path: file.path,
        filename: file.name,
        sha: file.sha,
        size: file.size,
      },
      importanceScore: GitHubTransformer.calculateDocImportance(file),
      // For docs, we don't have a creation date from the API, so we skip it
      // TypeORM will use current time
    };
  }

  private static calculateDocImportance(file: GitHubFileContent): number {
    let score = 0.6;
    const name = file.name.toLowerCase();
    const path = file.path.toLowerCase();

    // README files are very important
    if (name === 'readme.md') score += 0.3;

    // Documentation in docs folder is important
    if (path.startsWith('docs/')) score += 0.1;

    // API documentation
    if (name.includes('api') || path.includes('api')) score += 0.1;

    // Contributing, changelog, etc.
    if (name === 'contributing.md' || name === 'changelog.md') score += 0.15;

    // Longer documents have more content
    if (file.size > 10000) score += 0.1;
    else if (file.size > 5000) score += 0.05;

    return Math.min(score, 1.0);
  }

  private static calculateIssueImportance(issue: GitHubIssue): number {
    let score = 0.5;

    // More comments = more important
    if (issue.comments > 10) score += 0.2;
    else if (issue.comments > 5) score += 0.1;

    // Labels affect importance
    const importantLabels = ['bug', 'critical', 'urgent', 'security', 'breaking'];
    const hasImportantLabel = issue.labels.some((l) =>
      importantLabels.some((il) => l.name.toLowerCase().includes(il)),
    );
    if (hasImportantLabel) score += 0.2;

    // Open issues are slightly more important
    if (issue.state === 'open') score += 0.1;

    return Math.min(score, 1.0);
  }

  private static calculatePRImportance(pr: GitHubPullRequest): number {
    let score = 0.6;

    // Merged PRs are important
    if (pr.merged_at) score += 0.15;

    // Large PRs are important
    if (pr.changed_files > 20) score += 0.15;
    else if (pr.changed_files > 10) score += 0.1;

    // Many comments = discussed
    if (pr.comments > 5) score += 0.1;

    return Math.min(score, 1.0);
  }

  private static calculateCommitImportance(commit: GitHubCommit): number {
    let score = 0.4;

    const message = commit.commit.message.toLowerCase();

    // Important commit types
    if (message.startsWith('fix:') || message.includes('bugfix')) score += 0.2;
    if (message.startsWith('feat:') || message.includes('feature')) score += 0.15;
    if (message.includes('breaking') || message.includes('major')) score += 0.2;
    if (message.includes('security')) score += 0.25;

    // Merge commits are less important
    if (message.startsWith('merge')) score -= 0.2;

    return Math.max(0.1, Math.min(score, 1.0));
  }
}
