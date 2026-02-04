import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Workspace } from "./workspace.entity";

export enum NotificationType {
  EMBEDDING_COMPLETE = "embedding_complete",
  SYNC_COMPLETE = "sync_complete",
  SYSTEM = "system",
}

@Entity("notification")
export class Notification {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: string;

  @Column({ name: "user_id", type: "bigint" })
  userId: string;

  @Column({ name: "workspace_id", type: "bigint", nullable: true })
  workspaceId: string | null;

  @Column({
    type: "varchar",
    length: 50,
  })
  type: NotificationType;

  @Column({ type: "varchar", length: 255 })
  title: string;

  @Column({ type: "text", nullable: true })
  message: string | null;

  @Column({ name: "is_read", type: "boolean", default: false })
  isRead: boolean;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt: Date | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user: User;

  @ManyToOne(() => Workspace)
  @JoinColumn({ name: "workspace_id" })
  workspace: Workspace | null;
}
