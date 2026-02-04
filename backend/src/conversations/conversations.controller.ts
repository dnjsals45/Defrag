import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ConversationsService } from "./conversations.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { UpdateConversationDto } from "./dto/update-conversation.dto";

@Controller("workspaces/:workspaceId/conversations")
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  async findAll(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.conversationsService.findAll(workspaceId, req.user.id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(":id")
  async findOne(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
  ) {
    return this.conversationsService.findOne(workspaceId, id, req.user.id);
  }

  @Post()
  async create(@Request() req: any, @Param("workspaceId") workspaceId: string) {
    return this.conversationsService.create(workspaceId, req.user.id);
  }

  @Post(":id/messages")
  async sendMessage(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.conversationsService.sendMessage(
      workspaceId,
      id,
      req.user.id,
      dto,
    );
  }

  @Patch(":id")
  async update(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.conversationsService.update(workspaceId, id, req.user.id, dto);
  }

  @Delete(":id")
  async remove(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
  ) {
    await this.conversationsService.delete(workspaceId, id, req.user.id);
    return { success: true };
  }
}
