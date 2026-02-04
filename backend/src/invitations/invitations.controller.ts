import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
} from "@nestjs/common";
import { Request as ExpressRequest } from "express";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { InvitationsService } from "./invitations.service";

interface AuthenticatedRequest extends ExpressRequest {
  user: { id: string; email: string };
}

@ApiTags("Invitations")
@ApiBearerAuth("access-token")
@Controller("invitations")
@UseGuards(JwtAuthGuard)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get()
  @ApiOperation({ summary: "받은 초대 목록", description: "대기 중인 워크스페이스 초대 목록 조회" })
  @ApiResponse({ status: 200, description: "초대 목록 반환" })
  async list(@Request() req: AuthenticatedRequest) {
    const invitations = await this.invitationsService.findPendingByUser(
      req.user.id,
    );
    return { invitations };
  }

  @Get("count")
  @ApiOperation({ summary: "초대 개수", description: "대기 중인 초대 개수 조회" })
  @ApiResponse({ status: 200, description: "초대 개수 반환" })
  async count(@Request() req: AuthenticatedRequest) {
    const count = await this.invitationsService.countPendingByUser(req.user.id);
    return { count };
  }

  @Post(":id/accept")
  @ApiOperation({ summary: "초대 수락", description: "워크스페이스 초대 수락" })
  @ApiParam({ name: "id", description: "초대 ID" })
  @ApiResponse({ status: 200, description: "수락 성공" })
  @ApiResponse({ status: 404, description: "초대 없음" })
  async accept(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    return this.invitationsService.accept(id, req.user.id);
  }

  @Post(":id/reject")
  @ApiOperation({ summary: "초대 거절", description: "워크스페이스 초대 거절" })
  @ApiParam({ name: "id", description: "초대 ID" })
  @ApiResponse({ status: 200, description: "거절 성공" })
  @ApiResponse({ status: 404, description: "초대 없음" })
  async reject(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    return this.invitationsService.reject(id, req.user.id);
  }
}
