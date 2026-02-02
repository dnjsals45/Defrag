import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncService } from './sync.service';
import { GitHubSyncProcessor } from './processors/github-sync.processor';
import { SlackSyncProcessor } from './processors/slack-sync.processor';
import { NotionSyncProcessor } from './processors/notion-sync.processor';
import { ContextItem } from '../database/entities/context-item.entity';
import { WorkspaceIntegration } from '../database/entities/workspace-integration.entity';
import { IntegrationsModule } from '../integrations/integrations.module';
import { EmbeddingModule } from '../embedding/embedding.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContextItem, WorkspaceIntegration]),
    BullModule.registerQueue(
      { name: 'github-sync' },
      { name: 'slack-sync' },
      { name: 'notion-sync' },
      { name: 'embedding' },
    ),
    IntegrationsModule,
    EmbeddingModule,
  ],
  providers: [
    SyncService,
    GitHubSyncProcessor,
    SlackSyncProcessor,
    NotionSyncProcessor,
  ],
  exports: [SyncService],
})
export class SyncModule {}
