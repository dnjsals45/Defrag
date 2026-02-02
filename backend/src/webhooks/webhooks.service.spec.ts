import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import { WebhooksService } from './webhooks.service';
import { WebhookWorkspaceService } from './webhook-workspace.service';
import { ContextItem, SourceType } from '../database/entities/context-item.entity';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let configService: jest.Mocked<ConfigService>;
  let contextItemRepository: jest.Mocked<Repository<ContextItem>>;
  let embeddingQueue: jest.Mocked<Queue>;
  let webhookWorkspaceService: jest.Mocked<WebhookWorkspaceService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: getRepositoryToken(ContextItem),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getQueueToken('embedding'),
          useValue: { add: jest.fn() },
        },
        {
          provide: WebhookWorkspaceService,
          useValue: {
            findWorkspaceByGitHubRepo: jest.fn(),
            findWorkspaceBySlackTeam: jest.fn(),
            findWorkspaceByNotionWorkspace: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    configService = module.get(ConfigService);
    contextItemRepository = module.get(getRepositoryToken(ContextItem));
    embeddingQueue = module.get(getQueueToken('embedding'));
    webhookWorkspaceService = module.get(WebhookWorkspaceService);
  });

  describe('handleGitHubWebhook', () => {
    const mockPRPayload = {
      action: 'opened',
      repository: { full_name: 'owner/repo' },
      pull_request: {
        id: 1,
        number: 123,
        title: 'Test PR',
        body: 'PR description',
        state: 'open',
        html_url: 'https://github.com/owner/repo/pull/123',
        user: { login: 'testuser', id: 1 },
        labels: [],
        head: { ref: 'feature' },
        base: { ref: 'main' },
        additions: 10,
        deletions: 5,
        changed_files: 2,
        commits: 1,
        comments: 0,
        merged_at: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        closed_at: null,
      },
    };

    it('should process pull_request event without signature verification', async () => {
      configService.get.mockReturnValue(null); // No webhook secret
      webhookWorkspaceService.findWorkspaceByGitHubRepo.mockResolvedValue('ws-1');
      contextItemRepository.findOne.mockResolvedValue(null);
      contextItemRepository.create.mockReturnValue({ id: 'item-1' } as any);
      contextItemRepository.save.mockResolvedValue({ id: 'item-1' } as any);

      await service.handleGitHubWebhook('pull_request', mockPRPayload, '');

      expect(webhookWorkspaceService.findWorkspaceByGitHubRepo).toHaveBeenCalledWith(
        'owner/repo',
      );
      expect(contextItemRepository.save).toHaveBeenCalled();
      expect(embeddingQueue.add).toHaveBeenCalledWith(
        'generate',
        expect.objectContaining({
          itemIds: ['item-1'],
          workspaceId: 'ws-1',
        }),
      );
    });

    it('should verify valid signature when secret is configured', async () => {
      const secret = 'test-secret';
      const payload = mockPRPayload;
      const payloadString = JSON.stringify(payload);
      const hmac = crypto.createHmac('sha256', secret);
      const signature = 'sha256=' + hmac.update(payloadString).digest('hex');

      configService.get.mockReturnValue(secret);
      webhookWorkspaceService.findWorkspaceByGitHubRepo.mockResolvedValue('ws-1');
      contextItemRepository.findOne.mockResolvedValue(null);
      contextItemRepository.create.mockReturnValue({ id: 'item-1' } as any);
      contextItemRepository.save.mockResolvedValue({ id: 'item-1' } as any);

      // Should not throw with valid signature
      await expect(
        service.handleGitHubWebhook('pull_request', payload, signature),
      ).resolves.not.toThrow();
    });

    it('should throw error for invalid signature', async () => {
      configService.get.mockReturnValue('test-secret');

      // Use a properly formatted but incorrect signature
      const invalidSignature = 'sha256=' + 'a'.repeat(64);

      await expect(
        service.handleGitHubWebhook('pull_request', mockPRPayload, invalidSignature),
      ).rejects.toThrow('Invalid signature');
    });

    it('should skip when no workspace found', async () => {
      configService.get.mockReturnValue(null);
      webhookWorkspaceService.findWorkspaceByGitHubRepo.mockResolvedValue(null);

      await service.handleGitHubWebhook('pull_request', mockPRPayload, '');

      expect(contextItemRepository.save).not.toHaveBeenCalled();
    });

    it('should update existing item on upsert', async () => {
      configService.get.mockReturnValue(null);
      webhookWorkspaceService.findWorkspaceByGitHubRepo.mockResolvedValue('ws-1');

      const existingItem = {
        id: 'existing-item',
        title: 'Old Title',
        content: 'Old content',
      };
      contextItemRepository.findOne.mockResolvedValue(existingItem as any);
      contextItemRepository.save.mockResolvedValue(existingItem as any);

      await service.handleGitHubWebhook('pull_request', mockPRPayload, '');

      expect(contextItemRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'existing-item',
          title: expect.stringContaining('Test PR'),
        }),
      );
    });

    it('should handle issues event', async () => {
      configService.get.mockReturnValue(null);
      webhookWorkspaceService.findWorkspaceByGitHubRepo.mockResolvedValue('ws-1');
      contextItemRepository.findOne.mockResolvedValue(null);
      contextItemRepository.create.mockReturnValue({ id: 'item-1' } as any);
      contextItemRepository.save.mockResolvedValue({ id: 'item-1' } as any);

      const issuePayload = {
        action: 'opened',
        repository: { full_name: 'owner/repo' },
        issue: {
          id: 1,
          number: 42,
          title: 'Test Issue',
          body: 'Issue description',
          state: 'open',
          html_url: 'https://github.com/owner/repo/issues/42',
          user: { login: 'testuser', id: 1 },
          labels: [],
          comments: 0,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          closed_at: null,
        },
      };

      await service.handleGitHubWebhook('issues', issuePayload, '');

      expect(contextItemRepository.save).toHaveBeenCalled();
    });

    it('should handle push event', async () => {
      configService.get.mockReturnValue(null);
      webhookWorkspaceService.findWorkspaceByGitHubRepo.mockResolvedValue('ws-1');
      contextItemRepository.findOne.mockResolvedValue(null);
      contextItemRepository.create.mockReturnValue({ id: 'item-1' } as any);
      contextItemRepository.save.mockResolvedValue({ id: 'item-1' } as any);

      const pushPayload = {
        ref: 'refs/heads/main',
        repository: { full_name: 'owner/repo' },
        commits: [
          {
            sha: 'abc123def456789012345678901234567890abcd',
            html_url: 'https://github.com/owner/repo/commit/abc123',
            commit: {
              message: 'feat: add new feature',
              author: {
                name: 'Test User',
                email: 'test@example.com',
                date: '2024-01-01',
              },
            },
            author: { login: 'testuser', id: 1 },
          },
        ],
      };

      await service.handleGitHubWebhook('push', pushPayload, '');

      expect(contextItemRepository.save).toHaveBeenCalled();
    });
  });

  describe('handleSlackEvent', () => {
    it('should respond to url_verification challenge', async () => {
      const payload = {
        type: 'url_verification',
        challenge: 'test-challenge',
      };

      const result = await service.handleSlackEvent(payload);

      expect(result).toEqual({ challenge: 'test-challenge' });
    });

    it('should process message event', async () => {
      const payload = {
        type: 'event_callback',
        team_id: 'T12345',
        event: {
          type: 'message',
          channel: 'C12345',
          ts: '1234567890.000001',
          text: 'Hello world',
          user: 'U12345',
        },
      };

      webhookWorkspaceService.findWorkspaceBySlackTeam.mockResolvedValue('ws-1');
      contextItemRepository.findOne.mockResolvedValue(null);
      contextItemRepository.create.mockReturnValue({ id: 'item-1' } as any);
      contextItemRepository.save.mockResolvedValue({ id: 'item-1' } as any);

      const result = await service.handleSlackEvent(payload);

      expect(result).toEqual({ ok: true });
      expect(webhookWorkspaceService.findWorkspaceBySlackTeam).toHaveBeenCalledWith(
        'T12345',
      );
    });

    it('should skip when no workspace found for Slack team', async () => {
      const payload = {
        type: 'event_callback',
        team_id: 'T12345',
        event: { type: 'message', channel: 'C12345', ts: '123', text: 'Hi', user: 'U1' },
      };

      webhookWorkspaceService.findWorkspaceBySlackTeam.mockResolvedValue(null);

      await service.handleSlackEvent(payload);

      expect(contextItemRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('handleSlackCommand', () => {
    it('should respond to /defrag command', async () => {
      const payload = {
        command: '/defrag',
        text: 'search query',
        user_id: 'U12345',
        channel_id: 'C12345',
        team_id: 'T12345',
      };

      const result = await service.handleSlackCommand(payload);

      expect(result.response_type).toBe('ephemeral');
      expect(result.text).toContain('search query');
    });

    it('should return unknown command for other commands', async () => {
      const payload = {
        command: '/other',
        text: '',
        user_id: 'U12345',
        channel_id: 'C12345',
        team_id: 'T12345',
      };

      const result = await service.handleSlackCommand(payload);

      expect(result.text).toBe('Unknown command');
    });
  });

  describe('handleNotionWebhook', () => {
    it('should process page.updated event', async () => {
      const payload = {
        type: 'page.updated',
        workspace_id: 'notion-ws-123',
        data: {
          id: 'page-123',
          url: 'https://notion.so/page-123',
          properties: {
            title: {
              title: [{ plain_text: 'Updated Page' }],
            },
          },
          last_edited_time: '2024-01-15',
        },
      };

      webhookWorkspaceService.findWorkspaceByNotionWorkspace.mockResolvedValue('ws-1');
      contextItemRepository.findOne.mockResolvedValue(null);
      contextItemRepository.create.mockReturnValue({ id: 'item-1' } as any);
      contextItemRepository.save.mockResolvedValue({ id: 'item-1' } as any);

      await service.handleNotionWebhook(payload);

      expect(webhookWorkspaceService.findWorkspaceByNotionWorkspace).toHaveBeenCalledWith(
        'notion-ws-123',
      );
      expect(contextItemRepository.save).toHaveBeenCalled();
      expect(embeddingQueue.add).toHaveBeenCalled();
    });

    it('should skip when no workspace found for Notion', async () => {
      const payload = {
        type: 'page.updated',
        workspace_id: 'notion-ws-123',
        data: { id: 'page-123' },
      };

      webhookWorkspaceService.findWorkspaceByNotionWorkspace.mockResolvedValue(null);

      await service.handleNotionWebhook(payload);

      expect(contextItemRepository.save).not.toHaveBeenCalled();
    });

    it('should skip when no page ID in payload', async () => {
      const payload = {
        type: 'page.updated',
        workspace_id: 'notion-ws-123',
        data: {},
      };

      await service.handleNotionWebhook(payload);

      expect(webhookWorkspaceService.findWorkspaceByNotionWorkspace).not.toHaveBeenCalled();
    });

    it('should skip non page.updated events', async () => {
      const payload = {
        type: 'database.updated',
        workspace_id: 'notion-ws-123',
        data: { id: 'db-123' },
      };

      await service.handleNotionWebhook(payload);

      expect(contextItemRepository.save).not.toHaveBeenCalled();
    });
  });
});
