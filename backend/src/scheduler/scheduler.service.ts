import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { WorkspaceIntegration } from '../database/entities/workspace-integration.entity';
import { SyncService } from '../sync/sync.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(WorkspaceIntegration)
    private readonly workspaceIntegrationRepository: Repository<WorkspaceIntegration>,
    private readonly syncService: SyncService,
  ) {}

  /**
   * Hourly incremental sync for all workspaces with active integrations
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlySync(): Promise<void> {
    this.logger.log('Starting scheduled hourly sync...');

    try {
      // Get all unique workspace IDs with active integrations
      const integrations = await this.workspaceIntegrationRepository.find({
        where: { deletedAt: IsNull() },
        select: ['workspaceId', 'connectedBy'],
      });

      // Group by workspaceId to avoid duplicate syncs
      const workspaceMap = new Map<string, string>();
      for (const integration of integrations) {
        if (!workspaceMap.has(integration.workspaceId) && integration.connectedBy) {
          workspaceMap.set(integration.workspaceId, integration.connectedBy);
        }
      }

      this.logger.log(`Found ${workspaceMap.size} workspaces to sync`);

      // Trigger sync for each workspace
      for (const [workspaceId, userId] of workspaceMap) {
        try {
          await this.syncService.triggerSync(workspaceId, userId, {
            syncType: 'incremental',
          });
          this.logger.log(`Triggered incremental sync for workspace: ${workspaceId}`);
        } catch (error: any) {
          this.logger.error(
            `Failed to trigger sync for workspace ${workspaceId}: ${error.message}`,
          );
        }
      }

      this.logger.log('Scheduled hourly sync completed');
    } catch (error: any) {
      this.logger.error(`Scheduled sync failed: ${error.message}`);
    }
  }

  /**
   * Daily full sync at 3 AM for all workspaces
   */
  @Cron('0 3 * * *')
  async handleDailyFullSync(): Promise<void> {
    this.logger.log('Starting scheduled daily full sync...');

    try {
      const integrations = await this.workspaceIntegrationRepository.find({
        where: { deletedAt: IsNull() },
        select: ['workspaceId', 'connectedBy'],
      });

      const workspaceMap = new Map<string, string>();
      for (const integration of integrations) {
        if (!workspaceMap.has(integration.workspaceId) && integration.connectedBy) {
          workspaceMap.set(integration.workspaceId, integration.connectedBy);
        }
      }

      this.logger.log(`Found ${workspaceMap.size} workspaces for full sync`);

      for (const [workspaceId, userId] of workspaceMap) {
        try {
          await this.syncService.triggerSync(workspaceId, userId, {
            syncType: 'full',
          });
          this.logger.log(`Triggered full sync for workspace: ${workspaceId}`);
        } catch (error: any) {
          this.logger.error(
            `Failed to trigger full sync for workspace ${workspaceId}: ${error.message}`,
          );
        }
      }

      this.logger.log('Scheduled daily full sync completed');
    } catch (error: any) {
      this.logger.error(`Scheduled full sync failed: ${error.message}`);
    }
  }

  /**
   * Manual trigger for testing or admin purposes
   */
  async triggerManualSync(workspaceId: string, userId: string, full = false): Promise<void> {
    this.logger.log(`Manual sync triggered for workspace: ${workspaceId}`);
    await this.syncService.triggerSync(workspaceId, userId, {
      syncType: full ? 'full' : 'incremental',
    });
  }
}
