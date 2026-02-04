import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceMember, MemberRole } from '../database/entities/workspace-member.entity';
import {
  WorkspaceInvitation,
  InvitationStatus,
} from '../database/entities/workspace-invitation.entity';
import { UsersService } from '../users/users.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Injectable()
export class MembersService {
  constructor(
    @InjectRepository(WorkspaceMember)
    private readonly membersRepository: Repository<WorkspaceMember>,
    @InjectRepository(WorkspaceInvitation)
    private readonly invitationsRepository: Repository<WorkspaceInvitation>,
    private readonly usersService: UsersService,
  ) {}

  async findAllByWorkspace(workspaceId: string) {
    const members = await this.membersRepository.find({
      where: { workspaceId },
      relations: ['user'],
    });

    return members.map((member) => ({
      userId: member.userId,
      email: member.user.email,
      nickname: member.user.nickname,
      role: member.role,
      joinedAt: member.createdAt,
    }));
  }

  async invite(
    workspaceId: string,
    inviterId: string,
    dto: InviteMemberDto,
  ) {
    // Check if inviter is admin
    const inviterMember = await this.membersRepository.findOne({
      where: { workspaceId, userId: inviterId },
    });

    if (!inviterMember || inviterMember.role !== MemberRole.ADMIN) {
      throw new ForbiddenException('Only admins can invite members');
    }

    // Find user by email
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if already a member
    const existingMember = await this.membersRepository.findOne({
      where: { workspaceId, userId: user.id },
    });

    if (existingMember) {
      throw new ConflictException('User is already a member');
    }

    // Check if there's already a pending invitation
    const existingInvitation = await this.invitationsRepository.findOne({
      where: {
        workspaceId,
        inviteeId: user.id,
        status: InvitationStatus.PENDING,
      },
    });

    if (existingInvitation) {
      throw new ConflictException('User already has a pending invitation');
    }

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = this.invitationsRepository.create({
      workspaceId,
      inviterId,
      inviteeId: user.id,
      inviteeEmail: user.email,
      role: dto.role || MemberRole.MEMBER,
      status: InvitationStatus.PENDING,
      expiresAt,
    });

    await this.invitationsRepository.save(invitation);

    return {
      success: true,
      invitation: {
        id: invitation.id,
        email: user.email,
        status: 'pending',
      },
    };
  }

  async updateRole(
    workspaceId: string,
    requesterId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const requesterMember = await this.membersRepository.findOne({
      where: { workspaceId, userId: requesterId },
    });

    if (!requesterMember || requesterMember.role !== MemberRole.ADMIN) {
      throw new ForbiddenException('Only admins can change roles');
    }

    const targetMember = await this.membersRepository.findOne({
      where: { workspaceId, userId: targetUserId },
    });

    if (!targetMember) {
      throw new NotFoundException('Member not found');
    }

    targetMember.role = dto.role;
    await this.membersRepository.save(targetMember);

    return { success: true };
  }

  async remove(
    workspaceId: string,
    requesterId: string,
    targetUserId: string,
  ) {
    const requesterMember = await this.membersRepository.findOne({
      where: { workspaceId, userId: requesterId },
    });

    if (!requesterMember || requesterMember.role !== MemberRole.ADMIN) {
      throw new ForbiddenException('Only admins can remove members');
    }

    const targetMember = await this.membersRepository.findOne({
      where: { workspaceId, userId: targetUserId },
    });

    if (!targetMember) {
      throw new NotFoundException('Member not found');
    }

    await this.membersRepository.softDelete(targetMember.id);

    return { success: true };
  }
}
