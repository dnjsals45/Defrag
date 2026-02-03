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
  Unique,
} from 'typeorm';
import { Workspace } from './workspace.entity';
import { User } from './user.entity';
import { VectorData } from './vector-data.entity';

export enum SourceType {
  GITHUB_PR = 'github_pr',
  GITHUB_ISSUE = 'github_issue',
  GITHUB_COMMIT = 'github_commit',
  SLACK_MESSAGE = 'slack_message',
  NOTION_PAGE = 'notion_page',
  WEB_ARTICLE = 'web_article',
}

@Entity('context_item')
@Unique(['workspaceId', 'sourceType', 'externalId'])
export class ContextItem {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ name: 'workspace_id', type: 'bigint' })
  workspaceId: string;

  @Column({ name: 'author_id', type: 'bigint', nullable: true })
  authorId: string | null;

  @Column({ name: 'source_type', type: 'varchar', length: 50 })
  sourceType: SourceType;

  @Column({ name: 'external_id', type: 'varchar', length: 255, nullable: true })
  externalId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  title: string | null;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ name: 'source_url', type: 'text', nullable: true })
  sourceUrl: string | null;

  @Column({
    name: 'importance_score',
    type: 'decimal',
    precision: 4,
    scale: 2,
    default: 0.0,
  })
  importanceScore: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @ManyToOne(() => Workspace, (workspace) => workspace.items)
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'author_id' })
  author: User;

  @OneToMany(() => VectorData, (vector) => vector.item)
  vectors: VectorData[];
}
