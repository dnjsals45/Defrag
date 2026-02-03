import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { WorkspaceMember } from './workspace-member.entity';
import { UserConnection } from './user-connection.entity';

export type AuthProvider = 'local' | 'google' | 'kakao';

@Entity('users')
@Index('idx_users_provider', ['authProvider', 'providerId'])
export class User {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string | null;

  @Column({ type: 'varchar', length: 100 })
  nickname: string;

  @Column({ type: 'varchar', length: 50, default: 'local', name: 'auth_provider' })
  authProvider: AuthProvider;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'provider_id' })
  providerId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'profile_image' })
  profileImage: string | null;

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
