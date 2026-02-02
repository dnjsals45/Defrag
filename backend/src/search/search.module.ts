import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContextItem } from '../database/entities/context-item.entity';
import { VectorData } from '../database/entities/vector-data.entity';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContextItem, VectorData]),
    WorkspacesModule,
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
