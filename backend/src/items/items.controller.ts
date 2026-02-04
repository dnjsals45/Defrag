import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from "@nestjs/swagger";
import { ItemsService } from "./items.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CreateItemDto } from "./dto/create-item.dto";
import { TriggerSyncDto } from "./dto/trigger-sync.dto";
import { SourceType } from "../database/entities/context-item.entity";

@ApiTags("Items")
@ApiBearerAuth("access-token")
@Controller("workspaces/:workspaceId/items")
@UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  @ApiOperation({ summary: "아이템 목록", description: "워크스페이스 내 모든 아이템 조회" })
  @ApiParam({ name: "workspaceId", description: "워크스페이스 ID" })
  @ApiQuery({ name: "source", required: false, enum: SourceType, description: "소스 타입 필터" })
  @ApiQuery({ name: "q", required: false, description: "검색어" })
  @ApiQuery({ name: "page", required: false, description: "페이지 번호" })
  @ApiQuery({ name: "limit", required: false, description: "페이지당 개수" })
  @ApiResponse({ status: 200, description: "아이템 목록 반환" })
  async findAll(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Query("source") source?: SourceType,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.itemsService.findAll(workspaceId, req.user.id, {
      source,
      q,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get("sync/status")
  @ApiOperation({ summary: "동기화 상태", description: "동기화 작업 상태 조회" })
  @ApiParam({ name: "workspaceId", description: "워크스페이스 ID" })
  @ApiResponse({ status: 200, description: "동기화 상태 반환" })
  async getSyncStatus(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
  ) {
    return this.itemsService.getSyncStatus(workspaceId, req.user.id);
  }

  @Get(":itemId")
  @ApiOperation({ summary: "아이템 상세", description: "아이템 상세 정보 조회" })
  @ApiParam({ name: "workspaceId", description: "워크스페이스 ID" })
  @ApiParam({ name: "itemId", description: "아이템 ID" })
  @ApiResponse({ status: 200, description: "아이템 정보 반환" })
  @ApiResponse({ status: 404, description: "아이템 없음" })
  async findOne(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Param("itemId") itemId: string,
  ) {
    return this.itemsService.findById(workspaceId, req.user.id, itemId);
  }

  @Post()
  @ApiOperation({ summary: "웹 아티클 추가", description: "URL로 웹 아티클 추가" })
  @ApiParam({ name: "workspaceId", description: "워크스페이스 ID" })
  @ApiResponse({ status: 201, description: "아이템 추가 성공" })
  async create(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Body() dto: CreateItemDto,
  ) {
    return this.itemsService.create(workspaceId, req.user.id, dto);
  }

  @Delete(":itemId")
  @ApiOperation({ summary: "아이템 삭제", description: "아이템 삭제" })
  @ApiParam({ name: "workspaceId", description: "워크스페이스 ID" })
  @ApiParam({ name: "itemId", description: "아이템 ID" })
  @ApiResponse({ status: 200, description: "삭제 성공" })
  async remove(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Param("itemId") itemId: string,
  ) {
    await this.itemsService.delete(workspaceId, req.user.id, itemId);
    return { success: true };
  }

  @Post("sync")
  @ApiOperation({ summary: "동기화 시작", description: "외부 서비스 데이터 동기화 시작" })
  @ApiParam({ name: "workspaceId", description: "워크스페이스 ID" })
  @ApiResponse({ status: 200, description: "동기화 작업 시작됨" })
  async triggerSync(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Body() dto?: TriggerSyncDto,
  ) {
    const result = await this.itemsService.triggerSync(
      workspaceId,
      req.user.id,
      {
        providers: dto?.providers,
        syncType: dto?.syncType,
        since: dto?.since,
        targetItems: dto?.targetItems,
      },
    );
    return { success: true, message: "Sync triggered", ...result };
  }
}
