import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
} from "@nestjs/common";
import { Request as ExpressRequest } from "express";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { InvitationsService } from "./invitations.service";

interface AuthenticatedRequest extends ExpressRequest {
  user: { id: string; email: string };
}

@Controller("invitations")
@UseGuards(JwtAuthGuard)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get()
  async list(@Request() req: AuthenticatedRequest) {
    const invitations = await this.invitationsService.findPendingByUser(
      req.user.id,
    );
    return { invitations };
  }

  @Get("count")
  async count(@Request() req: AuthenticatedRequest) {
    const count = await this.invitationsService.countPendingByUser(req.user.id);
    return { count };
  }

  @Post(":id/accept")
  async accept(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    return this.invitationsService.accept(id, req.user.id);
  }

  @Post(":id/reject")
  async reject(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    return this.invitationsService.reject(id, req.user.id);
  }
}
