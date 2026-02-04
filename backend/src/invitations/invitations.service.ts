import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import {
  WorkspaceInvitation,
  InvitationStatus,
} from '../database/entities/workspace-invitation.entity';
import { WorkspaceMember, MemberRole } from '../database/entities/workspace-member.entity';

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(WorkspaceInvitation)
    private readonly invitationsRepository: Repository<WorkspaceInvitation>,
    @InjectRepository(WorkspaceMember)
    private readonly membersRepository: Repository<WorkspaceMember>,
  ) {}

  async findPendingByUser(userId: string) {
    // First, mark expired invitations
    await this.markExpiredInvitations();

    const invitations = await this.invitationsRepository.find({
      where: [
        { inviteeId: userId, status: InvitationStatus.PENDING },
      ],
      relations: ['workspace', 'inviter'],
      order: { createdAt: 'DESC' },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      workspaceId: inv.workspaceId,
      workspaceName: inv.workspace.name,
      inviterNickname: inv.inviter.nickname,
      role: inv.role,
      status: inv.status,
      createdAt: inv.createdAt,
      expiresAt: inv.expiresAt,
    }));
  }

  async countPendingByUser(userId: string): Promise<number> {
    await this.markExpiredInvitations();

    return this.invitationsRepository.count({
      where: { inviteeId: userId, status: InvitationStatus.PENDING },
    });
  }

  async accept(invitationId: string, userId: string) {
    const invitation = await this.invitationsRepository.findOne({
      where: { id: invitationId },
      relations: ['workspace'],
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.inviteeId !== userId) {
      throw new ForbiddenException('This invitation is not for you');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(`Invitation is already ${invitation.status}`);
    }

    if (new Date() > invitation.expiresAt) {
      invitation.status = InvitationStatus.EXPIRED;
      await this.invitationsRepository.save(invitation);
      throw new BadRequestException('Invitation has expired');
    }

    // Check if already a member
    const existingMember = await this.membersRepository.findOne({
      where: { workspaceId: invitation.workspaceId, userId },
    });

    if (existingMember) {
      throw new BadRequestException('You are already a member of this workspace');
    }

    // Create membership
    const member = this.membersRepository.create({
      workspaceId: invitation.workspaceId,
      userId,
      role: invitation.role,
    });
    await this.membersRepository.save(member);

    // Update invitation status
    invitation.status = InvitationStatus.ACCEPTED;
    invitation.respondedAt = new Date();
    await this.invitationsRepository.save(invitation);

    return {
      success: true,
      workspace: {
        id: invitation.workspace.id,
        name: invitation.workspace.name,
      },
    };
  }

  async reject(invitationId: string, userId: string) {
    const invitation = await this.invitationsRepository.findOne({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.inviteeId !== userId) {
      throw new ForbiddenException('This invitation is not for you');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(`Invitation is already ${invitation.status}`);
    }

    invitation.status = InvitationStatus.REJECTED;
    invitation.respondedAt = new Date();
    await this.invitationsRepository.save(invitation);

    return { success: true };
  }

  private async markExpiredInvitations() {
    await this.invitationsRepository.update(
      {
        status: InvitationStatus.PENDING,
        expiresAt: LessThan(new Date()),
      },
      {
        status: InvitationStatus.EXPIRED,
      },
    );
  }
}
