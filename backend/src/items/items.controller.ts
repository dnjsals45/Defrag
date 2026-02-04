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
import { ItemsService } from "./items.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CreateItemDto } from "./dto/create-item.dto";
import { TriggerSyncDto } from "./dto/trigger-sync.dto";
import { SourceType } from "../database/entities/context-item.entity";

@Controller("workspaces/:workspaceId/items")
@UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
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

  @Get(":itemId")
  async findOne(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Param("itemId") itemId: string,
  ) {
    return this.itemsService.findById(workspaceId, req.user.id, itemId);
  }

  @Post()
  async create(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Body() dto: CreateItemDto,
  ) {
    return this.itemsService.create(workspaceId, req.user.id, dto);
  }

  @Delete(":itemId")
  async remove(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Param("itemId") itemId: string,
  ) {
    await this.itemsService.delete(workspaceId, req.user.id, itemId);
    return { success: true };
  }

  @Post("sync")
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

  @Get("sync/status")
  async getSyncStatus(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
  ) {
    return this.itemsService.getSyncStatus(workspaceId, req.user.id);
  }
}
