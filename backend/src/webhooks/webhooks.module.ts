import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { ItemsModule } from '../items/items.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [ItemsModule, IntegrationsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
