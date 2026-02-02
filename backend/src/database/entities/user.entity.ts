import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { WorkspaceMember } from './workspace-member.entity';
import { UserConnection } from './user-connection.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'varchar', length: 100 })
  nickname: string;

  @Column({ type: 'boolean', default: false, name: 'is_email_verified' })
  isEmailVerified: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'email_verification_token' })
  emailVerificationToken: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'email_verification_expiry' })
  emailVerificationExpiry: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'password_reset_token' })
  passwordResetToken: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'password_reset_expiry' })
  passwordResetExpiry: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @OneToMany(() => WorkspaceMember, (member) => member.user)
  workspaceMembers: WorkspaceMember[];

  @OneToMany(() => UserConnection, (connection) => connection.user)
  connections: UserConnection[];
}
