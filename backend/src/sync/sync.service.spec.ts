import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { SyncService } from './sync.service';
import { WorkspaceIntegration } from '../database/entities/workspace-integration.entity';
import { Provider } from '../database/entities/user-connection.entity';

describe('SyncService', () => {
  let service: SyncService;
  let githubQueue: jest.Mocked<Queue>;
  let slackQueue: jest.Mocked<Queue>;
  let notionQueue: jest.Mocked<Queue>;
  let integrationsRepository: jest.Mocked<Repository<WorkspaceIntegration>>;

  const createMockQueue = () => ({
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    getActive: jest.fn().mockResolvedValue([]),
    getWaiting: jest.fn().mockResolvedValue([]),
    getCompleted: jest.fn().mockResolvedValue([]),
    getFailed: jest.fn().mockResolvedValue([]),
  });

  beforeEach(async () => {
    const mockGithubQueue = createMockQueue();
    const mockSlackQueue = createMockQueue();
    const mockNotionQueue = createMockQueue();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        {
          provide: getQueueToken('github-sync'),
          useValue: mockGithubQueue,
        },
        {
          provide: getQueueToken('slack-sync'),
          useValue: mockSlackQueue,
        },
        {
          provide: getQueueToken('notion-sync'),
          useValue: mockNotionQueue,
        },
        {
          provide: getRepositoryToken(WorkspaceIntegration),
          useValue: {
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
    githubQueue = module.get(getQueueToken('github-sync'));
    slackQueue = module.get(getQueueToken('slack-sync'));
    notionQueue = module.get(getQueueToken('notion-sync'));
    integrationsRepository = module.get(getRepositoryToken(WorkspaceIntegration));
  });

  describe('triggerSync', () => {
    it('should trigger sync for all connected providers', async () => {
      const mockIntegrations = [
        { provider: Provider.GITHUB, workspaceId: 'ws-1' },
        { provider: Provider.SLACK, workspaceId: 'ws-1' },
        { provider: Provider.NOTION, workspaceId: 'ws-1' },
      ];

      integrationsRepository.find.mockResolvedValue(mockIntegrations as any);

      const result = await service.triggerSync('ws-1', 'user-1');

      expect(result.jobIds).toHaveProperty(Provider.GITHUB);
      expect(result.jobIds).toHaveProperty(Provider.SLACK);
      expect(result.jobIds).toHaveProperty(Provider.NOTION);
      expect(githubQueue.add).toHaveBeenCalled();
      expect(slackQueue.add).toHaveBeenCalled();
      expect(notionQueue.add).toHaveBeenCalled();
    });

    it('should only trigger sync for specified providers that are connected', async () => {
      const mockIntegrations = [
        { provider: Provider.GITHUB, workspaceId: 'ws-1' },
        { provider: Provider.SLACK, workspaceId: 'ws-1' },
      ];

      integrationsRepository.find.mockResolvedValue(mockIntegrations as any);

      const result = await service.triggerSync('ws-1', 'user-1', {
        providers: [Provider.GITHUB],
      });

      expect(result.jobIds).toHaveProperty(Provider.GITHUB);
      expect(result.jobIds).not.toHaveProperty(Provider.SLACK);
      expect(githubQueue.add).toHaveBeenCalled();
      // Slack should not be called because we only requested GitHub
      expect(slackQueue.add).not.toHaveBeenCalled();
    });

    it('should return empty jobIds when no integrations', async () => {
      integrationsRepository.find.mockResolvedValue([]);

      const result = await service.triggerSync('ws-1', 'user-1');

      expect(result.jobIds).toEqual({});
    });

    it('should pass sync type and since options', async () => {
      const mockIntegrations = [
        { provider: Provider.GITHUB, workspaceId: 'ws-1' },
      ];

      integrationsRepository.find.mockResolvedValue(mockIntegrations as any);

      await service.triggerSync('ws-1', 'user-1', {
        syncType: 'full',
        since: '2024-01-01',
      });

      expect(githubQueue.add).toHaveBeenCalledWith(
        'sync',
        expect.objectContaining({
          workspaceId: 'ws-1',
          userId: 'user-1',
          syncType: 'full',
          since: '2024-01-01',
        }),
        expect.any(Object),
      );
    });
  });

  describe('getSyncStatus', () => {
    it('should return active status when job is running', async () => {
      const mockActiveJob = {
        data: { workspaceId: 'ws-1' },
        progress: { processed: 10, total: 100 },
        processedOn: Date.now(),
        timestamp: Date.now(),
      };

      githubQueue.getActive.mockResolvedValue([mockActiveJob] as any);

      const result = await service.getSyncStatus('ws-1');

      expect(result.workspaceId).toBe('ws-1');
      expect(result.isRunning).toBe(true);
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].status).toBe('active');
      expect(result.jobs[0].provider).toBe(Provider.GITHUB);
    });

    it('should return completed status', async () => {
      const mockCompletedJob = {
        data: { workspaceId: 'ws-1' },
        processedOn: Date.now() - 60000,
        finishedOn: Date.now(),
        timestamp: Date.now() - 60000,
      };

      githubQueue.getCompleted.mockResolvedValue([mockCompletedJob] as any);

      const result = await service.getSyncStatus('ws-1');

      expect(result.isRunning).toBe(false);
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].status).toBe('completed');
    });

    it('should return failed status with error', async () => {
      const mockFailedJob = {
        data: { workspaceId: 'ws-1' },
        failedReason: 'API rate limit exceeded',
        processedOn: Date.now(),
        finishedOn: Date.now(),
        timestamp: Date.now(),
      };

      githubQueue.getFailed.mockResolvedValue([mockFailedJob] as any);

      const result = await service.getSyncStatus('ws-1');

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].status).toBe('failed');
      expect(result.jobs[0].error).toBe('API rate limit exceeded');
    });

    it('should return empty jobs when no matching workspace', async () => {
      const result = await service.getSyncStatus('ws-nonexistent');

      expect(result.isRunning).toBe(false);
      expect(result.jobs).toHaveLength(0);
    });
  });

  describe('cancelSync', () => {
    it('should cancel waiting jobs for workspace', async () => {
      const mockRemove = jest.fn();
      const mockWaitingJob = {
        data: { workspaceId: 'ws-1' },
        remove: mockRemove,
      };

      githubQueue.getWaiting.mockResolvedValue([mockWaitingJob] as any);
      slackQueue.getWaiting.mockResolvedValue([]);
      notionQueue.getWaiting.mockResolvedValue([]);

      await service.cancelSync('ws-1');

      expect(mockRemove).toHaveBeenCalled();
    });

    it('should only cancel jobs for specified provider', async () => {
      const mockRemove = jest.fn();
      const mockWaitingJob = {
        data: { workspaceId: 'ws-1' },
        remove: mockRemove,
      };

      githubQueue.getWaiting.mockResolvedValue([mockWaitingJob] as any);

      await service.cancelSync('ws-1', Provider.GITHUB);

      expect(mockRemove).toHaveBeenCalled();
      expect(slackQueue.getWaiting).not.toHaveBeenCalled();
      expect(notionQueue.getWaiting).not.toHaveBeenCalled();
    });

    it('should not cancel jobs from other workspaces', async () => {
      const mockRemove = jest.fn();
      const mockWaitingJob = {
        data: { workspaceId: 'ws-2' },
        remove: mockRemove,
      };

      githubQueue.getWaiting.mockResolvedValue([mockWaitingJob] as any);
      slackQueue.getWaiting.mockResolvedValue([]);
      notionQueue.getWaiting.mockResolvedValue([]);

      await service.cancelSync('ws-1');

      expect(mockRemove).not.toHaveBeenCalled();
    });
  });
});
