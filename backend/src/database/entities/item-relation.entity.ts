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
import { ContextItem } from './context-item.entity';

export enum RelationType {
  MENTIONS = 'mentions',
  REFERENCES = 'references',
  RELATES_TO = 'relates_to',
  DERIVED_FROM = 'derived_from',
}

@Entity('item_relation')
export class ItemRelation {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ name: 'source_id', type: 'bigint' })
  sourceId: string;

  @Column({ name: 'target_id', type: 'bigint' })
  targetId: string;

  @Column({ name: 'relation_type', type: 'varchar', length: 50 })
  relationType: RelationType;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  score: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @ManyToOne(() => ContextItem)
  @JoinColumn({ name: 'source_id' })
  source: ContextItem;

  @ManyToOne(() => ContextItem)
  @JoinColumn({ name: 'target_id' })
  target: ContextItem;
}
