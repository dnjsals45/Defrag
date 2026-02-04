import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GitHubOAuthService, GitHubFileContent } from '../../oauth/providers/github.service';
import { IntegrationsService } from '../../integrations/integrations.service';
import { ContextItem, SourceType } from '../../database/entities/context-item.entity';
import { Provider } from '../../database/entities/user-connection.entity';
import { GitHubTransformer } from '../transformers/github.transformer';

export interface GitHubSyncJobData {
  workspaceId: string;
  userId: string;
  syncType: 'full' | 'incremental';
  since?: string;
  targetItems?: string[];  // 특정 레포지토리만 동기화
}

export interface GitHubSyncResult {
  itemsSynced: number;
  errors: string[];
}

@Processor('github-sync')
export class GitHubSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(GitHubSyncProcessor.name);
  private syncedItemIds: string[] = [];

  constructor(
    private readonly githubService: GitHubOAuthService,
    private readonly integrationsService: IntegrationsService,
    @InjectRepository(ContextItem)
    private readonly itemsRepository: Repository<ContextItem>,
    @InjectQueue('embedding')
    private readonly embeddingQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<GitHubSyncJobData>): Promise<GitHubSyncResult> {
    const { workspaceId, syncType, since, targetItems } = job.data;
    this.logger.log(`Starting GitHub sync for workspace ${workspaceId} (${syncType})`);

    const result: GitHubSyncResult = { itemsSynced: 0, errors: [] };
    this.syncedItemIds = [];

    try {
      const accessToken = await this.integrationsService.getDecryptedAccessToken(
        workspaceId,
        Provider.GITHUB,
      );

      if (!accessToken) {
        result.errors.push('GitHub integration not found or token invalid');
        return result;
      }

      // Get repos to sync - either targetItems or all selected repos
      let reposToSync: string[];

      if (targetItems && targetItems.length > 0) {
        // 특정 레포지토리만 동기화
        reposToSync = targetItems;
        this.logger.log(`Syncing specific repos: ${reposToSync.join(', ')}`);
      } else {
        // 전체 선택된 레포지토리 동기화
        const selectedRepos = await this.integrationsService.getGitHubSelectedRepos(workspaceId);
        if (!selectedRepos || selectedRepos.length === 0) {
          result.errors.push('No repositories selected for sync');
          return result;
        }
        reposToSync = selectedRepos;
      }

      const repos = reposToSync.map((fullName) => ({ full_name: fullName }));
      await job.updateProgress({ phase: 'fetching_repos', count: repos.length });

      // For each repo, fetch issues and PRs
      for (const repo of repos) {
        try {
          await this.syncRepoIssues(accessToken, repo.full_name, workspaceId, since, job);
          await this.syncRepoPRs(accessToken, repo.full_name, workspaceId, since, job);
          await this.syncRepoCommits(accessToken, repo.full_name, workspaceId, since, job);
          await this.syncRepoDocs(accessToken, repo.full_name, workspaceId, job);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Error syncing repo ${repo.full_name}: ${errorMsg}`);
          result.errors.push(`${repo.full_name}: ${errorMsg}`);
        }
      }

      result.itemsSynced = await this.countSyncedItems(workspaceId);
      this.logger.log(`GitHub sync completed: ${result.itemsSynced} items`);

      // Trigger embedding generation for all synced items
      if (this.syncedItemIds.length > 0) {
        await this.embeddingQueue.add('generate', {
          itemIds: this.syncedItemIds,
          workspaceId,
        });
        this.logger.log(`Queued embedding generation for ${this.syncedItemIds.length} items`);
      }
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

  private async syncRepoDocs(
    accessToken: string,
    repoFullName: string,
    workspaceId: string,
    job?: Job,
  ): Promise<void> {
    const docsToSync: GitHubFileContent[] = [];

    // 1. Fetch README.md from root
    const readme = await this.githubService.getFileContent(accessToken, repoFullName, 'README.md');
    if (readme) {
      docsToSync.push(readme);
    }

    // Also try readme.md (lowercase)
    if (!readme) {
      const readmeLower = await this.githubService.getFileContent(accessToken, repoFullName, 'readme.md');
      if (readmeLower) {
        docsToSync.push(readmeLower);
      }
    }

    // 2. Fetch markdown files from docs/ folder
    try {
      const docsFiles = await this.githubService.getMarkdownFiles(accessToken, repoFullName, 'docs');
      for (const file of docsFiles) {
        const fileContent = await this.githubService.getFileContent(accessToken, repoFullName, file.path);
        if (fileContent) {
          docsToSync.push(fileContent);
        }
        await this.delay(100); // Small delay to avoid rate limiting
      }
    } catch {
      // docs/ folder might not exist, that's okay
    }

    // 3. Transform and save documents
    for (const doc of docsToSync) {
      const transformed = GitHubTransformer.transformDocument(doc, repoFullName);
      await this.upsertItem(workspaceId, transformed);
    }

    if (job && docsToSync.length > 0) {
      await job.updateProgress({
        phase: 'syncing_docs',
        repo: repoFullName,
        count: docsToSync.length,
      });
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
      createdAt?: Date;
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
      this.syncedItemIds.push(existing.id);
    } else {
      const savedItem = await this.itemsRepository.save(
        this.itemsRepository.create({
          workspaceId,
          ...item,
        }),
      );
      this.syncedItemIds.push(savedItem.id);
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
