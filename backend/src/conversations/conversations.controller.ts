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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ConversationsService } from "./conversations.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { UpdateConversationDto } from "./dto/update-conversation.dto";

@ApiTags("Conversations")
@ApiBearerAuth("access-token")
@Controller("workspaces/:workspaceId/conversations")
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: "대화 목록", description: "워크스페이스 내 AI 대화 목록 조회" })
  @ApiParam({ name: "workspaceId", description: "워크스페이스 ID" })
  @ApiQuery({ name: "page", required: false, description: "페이지 번호" })
  @ApiQuery({ name: "limit", required: false, description: "페이지당 개수" })
  @ApiResponse({ status: 200, description: "대화 목록 반환" })
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
  @ApiOperation({ summary: "대화 상세", description: "대화 및 메시지 내역 조회" })
  @ApiParam({ name: "workspaceId", description: "워크스페이스 ID" })
  @ApiParam({ name: "id", description: "대화 ID" })
  @ApiResponse({ status: 200, description: "대화 정보 반환" })
  @ApiResponse({ status: 404, description: "대화 없음" })
  async findOne(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
  ) {
    return this.conversationsService.findOne(workspaceId, id, req.user.id);
  }

  @Post()
  @ApiOperation({ summary: "대화 생성", description: "새 AI 대화 시작" })
  @ApiParam({ name: "workspaceId", description: "워크스페이스 ID" })
  @ApiResponse({ status: 201, description: "대화 생성 성공" })
  async create(@Request() req: any, @Param("workspaceId") workspaceId: string) {
    return this.conversationsService.create(workspaceId, req.user.id);
  }

  @Post(":id/messages")
  @ApiOperation({ summary: "메시지 전송", description: "AI에게 메시지 전송 및 응답 받기" })
  @ApiParam({ name: "workspaceId", description: "워크스페이스 ID" })
  @ApiParam({ name: "id", description: "대화 ID" })
  @ApiResponse({ status: 200, description: "AI 응답 반환" })
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
  @ApiOperation({ summary: "대화 수정", description: "대화 제목 수정" })
  @ApiParam({ name: "workspaceId", description: "워크스페이스 ID" })
  @ApiParam({ name: "id", description: "대화 ID" })
  @ApiResponse({ status: 200, description: "수정 성공" })
  async update(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.conversationsService.update(workspaceId, id, req.user.id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "대화 삭제", description: "대화 및 메시지 삭제" })
  @ApiParam({ name: "workspaceId", description: "워크스페이스 ID" })
  @ApiParam({ name: "id", description: "대화 ID" })
  @ApiResponse({ status: 200, description: "삭제 성공" })
  async remove(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
  ) {
    await this.conversationsService.delete(workspaceId, id, req.user.id);
    return { success: true };
  }
}
