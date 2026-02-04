import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Conversation, ConversationMessage } from "../database/entities";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { SearchModule } from "../search/search.module";
import { LLMModule } from "../llm/llm.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, ConversationMessage]),
    WorkspacesModule,
    SearchModule,
    LLMModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
