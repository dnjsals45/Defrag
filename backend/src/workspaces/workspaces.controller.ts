import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from "@nestjs/swagger";
import { WorkspacesService } from "./workspaces.service";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { UpdateWorkspaceDto } from "./dto/update-workspace.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";

@ApiTags("Workspaces")
@ApiBearerAuth("access-token")
@Controller("workspaces")
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: "워크스페이스 생성", description: "새 워크스페이스 생성" })
  @ApiResponse({ status: 201, description: "워크스페이스 생성 성공" })
  @ApiResponse({ status: 409, description: "동일한 이름의 워크스페이스 존재" })
  async create(@Request() req: any, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "워크스페이스 목록", description: "사용자가 속한 모든 워크스페이스 조회" })
  @ApiResponse({ status: 200, description: "워크스페이스 목록 반환" })
  async findAll(@Request() req: any) {
    const workspaces = await this.workspacesService.findAllByUser(req.user.id);
    return { workspaces };
  }

  @Get(":id")
  @ApiOperation({ summary: "워크스페이스 상세", description: "워크스페이스 상세 정보 조회" })
  @ApiParam({ name: "id", description: "워크스페이스 ID" })
  @ApiResponse({ status: 200, description: "워크스페이스 정보 반환" })
  @ApiResponse({ status: 403, description: "접근 권한 없음" })
  @ApiResponse({ status: 404, description: "워크스페이스 없음" })
  async findOne(@Request() req: any, @Param("id") id: string) {
    return this.workspacesService.findById(id, req.user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "워크스페이스 수정", description: "워크스페이스 정보 수정 (관리자만)" })
  @ApiParam({ name: "id", description: "워크스페이스 ID" })
  @ApiResponse({ status: 200, description: "수정 성공" })
  @ApiResponse({ status: 403, description: "관리자 권한 필요" })
  async update(
    @Request() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(id, req.user.id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "워크스페이스 삭제", description: "워크스페이스 삭제 (소유자만)" })
  @ApiParam({ name: "id", description: "워크스페이스 ID" })
  @ApiResponse({ status: 200, description: "삭제 성공" })
  @ApiResponse({ status: 403, description: "소유자 권한 필요" })
  async remove(@Request() req: any, @Param("id") id: string) {
    await this.workspacesService.delete(id, req.user.id);
    return { success: true };
  }
}
