import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { BullModule } from "@nestjs/bullmq";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EmbeddingService } from "./embedding.service";
import { EmbeddingProcessor } from "./embedding.processor";
import { ContextItem } from "../database/entities/context-item.entity";
import { VectorData } from "../database/entities/vector-data.entity";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([ContextItem, VectorData]),
    BullModule.registerQueue({ name: "embedding" }),
    NotificationsModule,
  ],
  providers: [EmbeddingService, EmbeddingProcessor],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
