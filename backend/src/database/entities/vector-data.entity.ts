import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { ContextItem } from "./context-item.entity";

@Entity("vector_data")
@Index(["itemId", "chunkIndex"], { unique: true })
export class VectorData {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: string;

  @Column({ name: "item_id", type: "bigint" })
  itemId: string;

  // Chunk index for multi-chunk items (0 = first chunk or full content)
  @Column({ name: "chunk_index", type: "int", default: 0 })
  chunkIndex: number;

  // Chunk content for search result display
  @Column({ name: "chunk_content", type: "text", nullable: true })
  chunkContent: string | null;

  // Note: vector type is handled via raw SQL in migrations
  // TypeORM doesn't have native vector support
  @Column({ type: "text" })
  embedding: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt: Date | null;

  @ManyToOne(() => ContextItem, (item) => item.vectors, { onDelete: "CASCADE" })
  @JoinColumn({ name: "item_id" })
  item: ContextItem;
}
