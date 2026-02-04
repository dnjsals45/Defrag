import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bullmq";
import { ContextItem } from "../database/entities/context-item.entity";
import { VectorData } from "../database/entities/vector-data.entity";
import { ItemsService } from "./items.service";
import { ItemsController } from "./items.controller";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { SyncModule } from "../sync/sync.module";
import { ArticleModule } from "../article/article.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([ContextItem, VectorData]),
    BullModule.registerQueue({ name: "embedding" }),
    WorkspacesModule,
    forwardRef(() => SyncModule),
    ArticleModule,
  ],
  controllers: [ItemsController],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule {}
