import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ContextItem } from './context-item.entity';

@Entity('vector_data')
export class VectorData {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ name: 'item_id', type: 'bigint' })
  itemId: string;

  // Note: vector type is handled via raw SQL in migrations
  // TypeORM doesn't have native vector support
  @Column({ type: 'text' })
  embedding: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @OneToOne(() => ContextItem, (item) => item.vector, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item: ContextItem;
}
