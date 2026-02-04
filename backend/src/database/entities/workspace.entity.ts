import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { WorkspaceMember } from "./workspace-member.entity";
import { WorkspaceIntegration } from "./workspace-integration.entity";
import { ContextItem } from "./context-item.entity";

export enum WorkspaceType {
  PERSONAL = "personal",
  TEAM = "team",
}

@Entity("workspace")
export class Workspace {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: string;

  @Column({ name: "owner_id", type: "bigint" })
  ownerId: string;

  @Column({ type: "varchar", length: 100 })
  name: string;

  @Column({
    type: "varchar",
    length: 20,
    default: WorkspaceType.PERSONAL,
  })
  type: WorkspaceType;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt: Date | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: "owner_id" })
  owner: User;

  @OneToMany(() => WorkspaceMember, (member) => member.workspace)
  members: WorkspaceMember[];

  @OneToMany(() => WorkspaceIntegration, (integration) => integration.workspace)
  integrations: WorkspaceIntegration[];

  @OneToMany(() => ContextItem, (item) => item.workspace)
  items: ContextItem[];
}
