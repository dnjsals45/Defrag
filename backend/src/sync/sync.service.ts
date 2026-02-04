import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { WorkspaceIntegration } from '../database/entities/workspace-integration.entity';
import { Provider } from '../database/entities/user-connection.entity';

export interface SyncOptions {
  providers?: Provider[];
  syncType?: 'full' | 'incremental';
  since?: string;
  targetItems?: string[];  // 특정 항목만 동기화
}

export interface SyncStatus {
  provider: Provider;
  status: 'pending' | 'active' | 'completed' | 'failed';
  progress?: Record<string, any>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface WorkspaceSyncStatus {
  workspaceId: string;
  isRunning: boolean;
  jobs: SyncStatus[];
  lastSyncAt?: Date;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectQueue('github-sync') private readonly githubQueue: Queue,
    @InjectQueue('slack-sync') private readonly slackQueue: Queue,
    @InjectQueue('notion-sync') private readonly notionQueue: Queue,
    @InjectRepository(WorkspaceIntegration)
    private readonly integrationsRepository: Repository<WorkspaceIntegration>,
  ) {}

  async triggerSync(
    workspaceId: string,
    userId: string,
    options: SyncOptions = {},
  ): Promise<{ jobIds: Record<Provider, string> }> {
    const { providers, syncType = 'incremental', since, targetItems } = options;

    // Get connected integrations for this workspace
    const integrations = await this.integrationsRepository.find({
      where: { workspaceId, deletedAt: undefined },
    });

    const connectedProviders = integrations.map((i) => i.provider);

    // Filter to requested providers or use all connected
    const providersToSync = providers
      ? connectedProviders.filter((p) => providers.includes(p))
      : connectedProviders;

    const jobIds: Record<string, string> = {};

    for (const provider of providersToSync) {
      const jobId = await this.queueSyncJob(provider, workspaceId, userId, syncType, since, targetItems);
      if (jobId) {
        jobIds[provider] = jobId;
      }
    }

    this.logger.log(
      `Triggered sync for workspace ${workspaceId}: ${Object.keys(jobIds).join(', ')}`,
    );

    return { jobIds: jobIds as Record<Provider, string> };
  }

  private async queueSyncJob(
    provider: Provider,
    workspaceId: string,
    userId: string,
    syncType: 'full' | 'incremental',
    since?: string,
    targetItems?: string[],
  ): Promise<string | null> {
    const jobData = { workspaceId, userId, syncType, since, targetItems };
    const jobOptions = {
      jobId: `${provider}-${workspaceId}-${Date.now()}`,
      attempts: 3,
      backoff: {
        type: 'exponential' as const,
        delay: 5000,
      },
      removeOnComplete: { age: 3600, count: 100 },
      removeOnFail: { age: 86400, count: 500 },
    };

    let job: Job | undefined;

    switch (provider) {
      case Provider.GITHUB:
        job = await this.githubQueue.add('sync', jobData, jobOptions);
        break;
      case Provider.SLACK:
        job = await this.slackQueue.add('sync', jobData, jobOptions);
        break;
      case Provider.NOTION:
        job = await this.notionQueue.add('sync', jobData, jobOptions);
        break;
      default:
        this.logger.warn(`Unknown provider: ${provider}`);
        return null;
    }

    return job?.id || null;
  }

  async getSyncStatus(workspaceId: string): Promise<WorkspaceSyncStatus> {
    // Get currently connected integrations
    const connectedIntegrations = await this.integrationsRepository.find({
      where: { workspaceId },
    });
    const connectedProviders = new Set(connectedIntegrations.map((i) => i.provider));

    const statuses: SyncStatus[] = [];

    // Only check queues for connected integrations
    if (connectedProviders.has(Provider.GITHUB)) {
      const githubStatus = await this.getQueueStatus(this.githubQueue, workspaceId, Provider.GITHUB);
      if (githubStatus) statuses.push(githubStatus);
    }

    if (connectedProviders.has(Provider.SLACK)) {
      const slackStatus = await this.getQueueStatus(this.slackQueue, workspaceId, Provider.SLACK);
      if (slackStatus) statuses.push(slackStatus);
    }

    if (connectedProviders.has(Provider.NOTION)) {
      const notionStatus = await this.getQueueStatus(this.notionQueue, workspaceId, Provider.NOTION);
      if (notionStatus) statuses.push(notionStatus);
    }

    const isRunning = statuses.some((s) => s.status === 'active' || s.status === 'pending');

    return {
      workspaceId,
      isRunning,
      jobs: statuses,
    };
  }

  private async getQueueStatus(
    queue: Queue,
    workspaceId: string,
    provider: Provider,
  ): Promise<SyncStatus | null> {
    // Get active jobs
    const activeJobs = await queue.getActive();
    const activeJob = activeJobs.find((j) => j.data.workspaceId === workspaceId);

    if (activeJob) {
      const progress = activeJob.progress as Record<string, any> | undefined;
      return {
        provider,
        status: 'active',
        progress: progress || undefined,
        startedAt: new Date(activeJob.processedOn || activeJob.timestamp),
      };
    }

    // Check waiting jobs
    const waitingJobs = await queue.getWaiting();
    const waitingJob = waitingJobs.find((j) => j.data.workspaceId === workspaceId);

    if (waitingJob) {
      return {
        provider,
        status: 'pending',
        startedAt: new Date(waitingJob.timestamp),
      };
    }

    // Check recently completed jobs
    const completedJobs = await queue.getCompleted(0, 10);
    const completedJob = completedJobs.find((j) => j.data.workspaceId === workspaceId);

    if (completedJob) {
      return {
        provider,
        status: 'completed',
        startedAt: new Date(completedJob.processedOn || completedJob.timestamp),
        completedAt: new Date(completedJob.finishedOn || Date.now()),
      };
    }

    // Check failed jobs
    const failedJobs = await queue.getFailed(0, 10);
    const failedJob = failedJobs.find((j) => j.data.workspaceId === workspaceId);

    if (failedJob) {
      return {
        provider,
        status: 'failed',
        error: failedJob.failedReason,
        startedAt: new Date(failedJob.processedOn || failedJob.timestamp),
        completedAt: new Date(failedJob.finishedOn || Date.now()),
      };
    }

    return null;
  }

  async cancelSync(workspaceId: string, provider?: Provider): Promise<void> {
    const queues = provider
      ? [this.getQueue(provider)]
      : [this.githubQueue, this.slackQueue, this.notionQueue];

    for (const queue of queues) {
      if (!queue) continue;

      // Remove waiting jobs
      const waitingJobs = await queue.getWaiting();
      for (const job of waitingJobs) {
        if (job.data.workspaceId === workspaceId) {
          await job.remove();
        }
      }

      // Note: Active jobs cannot be easily canceled, they will complete or timeout
    }

    this.logger.log(`Cancelled pending sync jobs for workspace ${workspaceId}`);
  }

  private getQueue(provider: Provider): Queue | null {
    switch (provider) {
      case Provider.GITHUB:
        return this.githubQueue;
      case Provider.SLACK:
        return this.slackQueue;
      case Provider.NOTION:
        return this.notionQueue;
      default:
        return null;
    }
  }
}
