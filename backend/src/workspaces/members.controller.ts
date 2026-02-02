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
} from '@nestjs/common';
import { MembersService } from './members.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('workspaces/:workspaceId/members')
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  async findAll(@Param('workspaceId') workspaceId: string) {
    const members = await this.membersService.findAllByWorkspace(workspaceId);
    return { members };
  }

  @Post('invite')
  async invite(
    @Request() req: any,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.membersService.invite(workspaceId, req.user.id, dto);
  }

  @Patch(':userId')
  async updateRole(
    @Request() req: any,
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.membersService.updateRole(
      workspaceId,
      req.user.id,
      userId,
      dto,
    );
  }

  @Delete(':userId')
  async remove(
    @Request() req: any,
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
  ) {
    return this.membersService.remove(workspaceId, req.user.id, userId);
  }
}
