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
import { MembersService } from "./members.service";
import { InviteMemberDto } from "./dto/invite-member.dto";
import { UpdateMemberRoleDto } from "./dto/update-member-role.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";

@ApiTags("Members")
@ApiBearerAuth("access-token")
@Controller("workspaces/:workspaceId/members")
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @ApiOperation({ summary: "멤버 목록", description: "워크스페이스 멤버 목록 조회" })
  @ApiParam({ name: "workspaceId", description: "워크스페이스 ID" })
  @ApiResponse({ status: 200, description: "멤버 목록 반환" })
  async findAll(@Param("workspaceId") workspaceId: string) {
    const members = await this.membersService.findAllByWorkspace(workspaceId);
    return { members };
  }

  @Post("invite")
  @ApiOperation({ summary: "멤버 초대", description: "이메일로 워크스페이스에 멤버 초대" })
  @ApiParam({ name: "workspaceId", description: "워크스페이스 ID" })
  @ApiResponse({ status: 201, description: "초대 발송 성공" })
  @ApiResponse({ status: 403, description: "관리자 권한 필요" })
  @ApiResponse({ status: 404, description: "사용자 없음" })
  async invite(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.membersService.invite(workspaceId, req.user.id, dto);
  }

  @Patch(":userId")
  @ApiOperation({ summary: "멤버 역할 변경", description: "멤버의 역할 변경 (관리자만)" })
  @ApiParam({ name: "workspaceId", description: "워크스페이스 ID" })
  @ApiParam({ name: "userId", description: "대상 사용자 ID" })
  @ApiResponse({ status: 200, description: "역할 변경 성공" })
  @ApiResponse({ status: 403, description: "관리자 권한 필요" })
  async updateRole(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Param("userId") userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.membersService.updateRole(
      workspaceId,
      req.user.id,
      userId,
      dto,
    );
  }

  @Delete(":userId")
  @ApiOperation({ summary: "멤버 제거", description: "워크스페이스에서 멤버 제거" })
  @ApiParam({ name: "workspaceId", description: "워크스페이스 ID" })
  @ApiParam({ name: "userId", description: "대상 사용자 ID" })
  @ApiResponse({ status: 200, description: "멤버 제거 성공" })
  @ApiResponse({ status: 403, description: "권한 없음" })
  async remove(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Param("userId") userId: string,
  ) {
    return this.membersService.remove(workspaceId, req.user.id, userId);
  }
}
