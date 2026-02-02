import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContextItem } from '../database/entities/context-item.entity';
import { VectorData } from '../database/entities/vector-data.entity';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContextItem, VectorData]),
    WorkspacesModule,
  ],
  controllers: [ItemsController],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule {}
