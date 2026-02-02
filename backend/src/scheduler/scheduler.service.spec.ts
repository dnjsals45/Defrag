import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchedulerService } from './scheduler.service';
import { SyncService } from '../sync/sync.service';
import { WorkspaceIntegration } from '../database/entities/workspace-integration.entity';

describe('SchedulerService', () => {
  let service: SchedulerService;
  let syncService: SyncService;
  let workspaceIntegrationRepository: Repository<WorkspaceIntegration>;

  const mockSyncService = {
    triggerSync: jest.fn().mockResolvedValue({ jobIds: {} }),
  };

  const mockWorkspaceIntegrationRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: SyncService, useValue: mockSyncService },
        {
          provide: getRepositoryToken(WorkspaceIntegration),
          useValue: mockWorkspaceIntegrationRepository,
        },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
    syncService = module.get<SyncService>(SyncService);
    workspaceIntegrationRepository = module.get<Repository<WorkspaceIntegration>>(
      getRepositoryToken(WorkspaceIntegration),
    );

    jest.clearAllMocks();
  });

  describe('handleHourlySync', () => {
    it('should trigger incremental sync for all workspaces with integrations', async () => {
      const mockIntegrations = [
        { workspaceId: 'ws-1', connectedBy: 'user-1' },
        { workspaceId: 'ws-2', connectedBy: 'user-2' },
        { workspaceId: 'ws-1', connectedBy: 'user-1' }, // Duplicate workspace
      ];

      mockWorkspaceIntegrationRepository.find.mockResolvedValue(mockIntegrations);

      await service.handleHourlySync();

      // Should only call once per workspace (ws-1 and ws-2)
      expect(mockSyncService.triggerSync).toHaveBeenCalledTimes(2);
      expect(mockSyncService.triggerSync).toHaveBeenCalledWith(
        'ws-1',
        'user-1',
        { syncType: 'incremental' },
      );
      expect(mockSyncService.triggerSync).toHaveBeenCalledWith(
        'ws-2',
        'user-2',
        { syncType: 'incremental' },
      );
    });

    it('should skip workspaces without connectedBy user', async () => {
      const mockIntegrations = [
        { workspaceId: 'ws-1', connectedBy: 'user-1' },
        { workspaceId: 'ws-2', connectedBy: null },
      ];

      mockWorkspaceIntegrationRepository.find.mockResolvedValue(mockIntegrations);

      await service.handleHourlySync();

      expect(mockSyncService.triggerSync).toHaveBeenCalledTimes(1);
      expect(mockSyncService.triggerSync).toHaveBeenCalledWith(
        'ws-1',
        'user-1',
        { syncType: 'incremental' },
      );
    });

    it('should continue syncing other workspaces when one fails', async () => {
      const mockIntegrations = [
        { workspaceId: 'ws-1', connectedBy: 'user-1' },
        { workspaceId: 'ws-2', connectedBy: 'user-2' },
      ];

      mockWorkspaceIntegrationRepository.find.mockResolvedValue(mockIntegrations);
      mockSyncService.triggerSync
        .mockRejectedValueOnce(new Error('Sync failed'))
        .mockResolvedValueOnce({ jobIds: {} });

      await service.handleHourlySync();

      expect(mockSyncService.triggerSync).toHaveBeenCalledTimes(2);
    });

    it('should handle empty integrations list', async () => {
      mockWorkspaceIntegrationRepository.find.mockResolvedValue([]);

      await service.handleHourlySync();

      expect(mockSyncService.triggerSync).not.toHaveBeenCalled();
    });
  });

  describe('handleDailyFullSync', () => {
    it('should trigger full sync for all workspaces', async () => {
      const mockIntegrations = [
        { workspaceId: 'ws-1', connectedBy: 'user-1' },
      ];

      mockWorkspaceIntegrationRepository.find.mockResolvedValue(mockIntegrations);

      await service.handleDailyFullSync();

      expect(mockSyncService.triggerSync).toHaveBeenCalledWith(
        'ws-1',
        'user-1',
        { syncType: 'full' },
      );
    });

    it('should continue syncing other workspaces when one fails', async () => {
      const mockIntegrations = [
        { workspaceId: 'ws-1', connectedBy: 'user-1' },
        { workspaceId: 'ws-2', connectedBy: 'user-2' },
      ];

      mockWorkspaceIntegrationRepository.find.mockResolvedValue(mockIntegrations);
      mockSyncService.triggerSync
        .mockRejectedValueOnce(new Error('Sync failed'))
        .mockResolvedValueOnce({ jobIds: {} });

      await service.handleDailyFullSync();

      expect(mockSyncService.triggerSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('triggerManualSync', () => {
    it('should trigger incremental sync by default', async () => {
      await service.triggerManualSync('ws-1', 'user-1');

      expect(mockSyncService.triggerSync).toHaveBeenCalledWith(
        'ws-1',
        'user-1',
        { syncType: 'incremental' },
      );
    });

    it('should trigger full sync when specified', async () => {
      await service.triggerManualSync('ws-1', 'user-1', true);

      expect(mockSyncService.triggerSync).toHaveBeenCalledWith(
        'ws-1',
        'user-1',
        { syncType: 'full' },
      );
    });
  });
});
