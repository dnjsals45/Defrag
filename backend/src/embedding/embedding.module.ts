import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmbeddingService } from './embedding.service';
import { EmbeddingProcessor } from './embedding.processor';
import { ContextItem } from '../database/entities/context-item.entity';
import { VectorData } from '../database/entities/vector-data.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([ContextItem, VectorData]),
    BullModule.registerQueue({ name: 'embedding' }),
  ],
  providers: [EmbeddingService, EmbeddingProcessor],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
