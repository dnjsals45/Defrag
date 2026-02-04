import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';
import { MemberRole } from './workspace-member.entity';

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

@Entity('workspace_invitation')
export class WorkspaceInvitation {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ name: 'workspace_id', type: 'bigint' })
  workspaceId: string;

  @Column({ name: 'inviter_id', type: 'bigint' })
  inviterId: string;

  @Column({ name: 'invitee_id', type: 'bigint', nullable: true })
  inviteeId: string | null;

  @Column({ name: 'invitee_email', type: 'varchar', length: 255 })
  inviteeEmail: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: MemberRole.MEMBER,
  })
  role: MemberRole;

  @Column({
    type: 'varchar',
    length: 20,
    default: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'responded_at', type: 'timestamp', nullable: true })
  respondedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @ManyToOne(() => Workspace)
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'inviter_id' })
  inviter: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'invitee_id' })
  invitee: User | null;
}
