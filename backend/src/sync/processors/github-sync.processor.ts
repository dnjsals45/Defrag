import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GitHubOAuthService } from '../../oauth/providers/github.service';
import { IntegrationsService } from '../../integrations/integrations.service';
import { ContextItem, SourceType } from '../../database/entities/context-item.entity';
import { Provider } from '../../database/entities/user-connection.entity';
import { GitHubTransformer } from '../transformers/github.transformer';

export interface GitHubSyncJobData {
  workspaceId: string;
  userId: string;
  syncType: 'full' | 'incremental';
  since?: string;
}

export interface GitHubSyncResult {
  itemsSynced: number;
  errors: string[];
}

@Processor('github-sync')
export class GitHubSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(GitHubSyncProcessor.name);

  constructor(
    private readonly githubService: GitHubOAuthService,
    private readonly integrationsService: IntegrationsService,
    @InjectRepository(ContextItem)
    private readonly itemsRepository: Repository<ContextItem>,
  ) {
    super();
  }

  async process(job: Job<GitHubSyncJobData>): Promise<GitHubSyncResult> {
    const { workspaceId, syncType, since } = job.data;
    this.logger.log(`Starting GitHub sync for workspace ${workspaceId} (${syncType})`);

    const result: GitHubSyncResult = { itemsSynced: 0, errors: [] };

    try {
      const accessToken = await this.integrationsService.getDecryptedAccessToken(
        workspaceId,
        Provider.GITHUB,
      );

      if (!accessToken) {
        result.errors.push('GitHub integration not found or token invalid');
        return result;
      }

      // Fetch repos with pagination
      const repos = await this.fetchAllRepos(accessToken, job);

      // For each repo, fetch issues and PRs
      for (const repo of repos) {
        try {
          await this.syncRepoIssues(accessToken, repo.full_name, workspaceId, since, job);
          await this.syncRepoPRs(accessToken, repo.full_name, workspaceId, since, job);
          await this.syncRepoCommits(accessToken, repo.full_name, workspaceId, since, job);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Error syncing repo ${repo.full_name}: ${errorMsg}`);
          result.errors.push(`${repo.full_name}: ${errorMsg}`);
        }
      }

      result.itemsSynced = await this.countSyncedItems(workspaceId);
      this.logger.log(`GitHub sync completed: ${result.itemsSynced} items`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`GitHub sync failed: ${errorMsg}`);
      result.errors.push(errorMsg);
    }

    return result;
  }

  private async fetchAllRepos(accessToken: string, job: Job): Promise<{ full_name: string }[]> {
    const repos: { full_name: string }[] = [];
    let page = 1;
    const perPage = 30;

    while (true) {
      const { data, headers } = await this.githubService.getRepos(accessToken, { page, perPage });

      repos.push(...data);
      await job.updateProgress({ phase: 'fetching_repos', count: repos.length });

      // Check rate limit
      const remaining = parseInt(headers['x-ratelimit-remaining'] || '1000', 10);
      if (remaining < 100) {
        this.logger.warn(`GitHub rate limit low: ${remaining} remaining`);
        await this.delay(1000);
      }

      // Check if there are more pages
      if (data.length < perPage) break;
      page++;
    }

    return repos;
  }

  private async syncRepoIssues(
    accessToken: string,
    repoFullName: string,
    workspaceId: string,
    since?: string,
    job?: Job,
  ): Promise<void> {
    let page = 1;
    const perPage = 30;

    while (true) {
      const { data: issues, headers } = await this.githubService.getIssues(
        accessToken,
        repoFullName,
        { page, perPage, state: 'all', since },
      );

      // Filter out pull requests (GitHub API returns PRs in issues endpoint)
      const actualIssues = issues.filter((issue) => !issue.pull_request);

      for (const issue of actualIssues) {
        const transformed = GitHubTransformer.transformIssue(issue, repoFullName);
        await this.upsertItem(workspaceId, transformed);
      }

      if (job) {
        await job.updateProgress({
          phase: 'syncing_issues',
          repo: repoFullName,
          count: page * perPage,
        });
      }

      // Rate limit handling
      const remaining = parseInt(headers['x-ratelimit-remaining'] || '1000', 10);
      if (remaining < 100) {
        await this.delay(2000);
      }

      if (issues.length < perPage) break;
      page++;
    }
  }

  private async syncRepoPRs(
    accessToken: string,
    repoFullName: string,
    workspaceId: string,
    since?: string,
    job?: Job,
  ): Promise<void> {
    let page = 1;
    const perPage = 30;

    while (true) {
      const { data: prs, headers } = await this.githubService.getPullRequests(
        accessToken,
        repoFullName,
        { page, perPage, state: 'all' },
      );

      // Filter by since date if provided
      const filteredPRs = since
        ? prs.filter((pr) => new Date(pr.updated_at) >= new Date(since))
        : prs;

      for (const pr of filteredPRs) {
        const transformed = GitHubTransformer.transformPullRequest(pr, repoFullName);
        await this.upsertItem(workspaceId, transformed);
      }

      if (job) {
        await job.updateProgress({
          phase: 'syncing_prs',
          repo: repoFullName,
          count: page * perPage,
        });
      }

      const remaining = parseInt(headers['x-ratelimit-remaining'] || '1000', 10);
      if (remaining < 100) {
        await this.delay(2000);
      }

      if (prs.length < perPage) break;
      page++;
    }
  }

  private async syncRepoCommits(
    accessToken: string,
    repoFullName: string,
    workspaceId: string,
    since?: string,
    job?: Job,
  ): Promise<void> {
    let page = 1;
    const perPage = 30;
    const maxPages = 3; // Limit commits to recent ones

    while (page <= maxPages) {
      const { data: commits, headers } = await this.githubService.getCommits(
        accessToken,
        repoFullName,
        { page, perPage, since },
      );

      for (const commit of commits) {
        const transformed = GitHubTransformer.transformCommit(commit, repoFullName);
        await this.upsertItem(workspaceId, transformed);
      }

      if (job) {
        await job.updateProgress({
          phase: 'syncing_commits',
          repo: repoFullName,
          count: page * perPage,
        });
      }

      const remaining = parseInt(headers['x-ratelimit-remaining'] || '1000', 10);
      if (remaining < 100) {
        await this.delay(2000);
      }

      if (commits.length < perPage) break;
      page++;
    }
  }

  private async upsertItem(
    workspaceId: string,
    item: {
      externalId: string;
      sourceType: SourceType;
      title: string;
      content: string;
      sourceUrl: string;
      metadata: Record<string, any>;
      importanceScore: number;
    },
  ): Promise<void> {
    const existing = await this.itemsRepository.findOne({
      where: {
        workspaceId,
        sourceType: item.sourceType,
        externalId: item.externalId,
      },
    });

    if (existing) {
      await this.itemsRepository.update(existing.id, {
        title: item.title,
        content: item.content,
        sourceUrl: item.sourceUrl,
        metadata: item.metadata,
        importanceScore: item.importanceScore,
      });
    } else {
      await this.itemsRepository.save(
        this.itemsRepository.create({
          workspaceId,
          ...item,
        }),
      );
    }
  }

  private async countSyncedItems(workspaceId: string): Promise<number> {
    return this.itemsRepository.count({
      where: {
        workspaceId,
        sourceType: SourceType.GITHUB_ISSUE,
      },
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
