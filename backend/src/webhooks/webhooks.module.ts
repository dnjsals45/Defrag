import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookWorkspaceService } from './webhook-workspace.service';
import { ItemsModule } from '../items/items.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ContextItem } from '../database/entities/context-item.entity';
import { VectorData } from '../database/entities/vector-data.entity';
import { WorkspaceIntegration } from '../database/entities/workspace-integration.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContextItem, VectorData, WorkspaceIntegration]),
    BullModule.registerQueue({ name: 'embedding' }),
    ItemsModule,
    IntegrationsModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookWorkspaceService],
})
export class WebhooksModule {}
