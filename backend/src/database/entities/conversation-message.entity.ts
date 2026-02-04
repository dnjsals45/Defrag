import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Conversation } from "./conversation.entity";

export enum MessageRole {
  USER = "user",
  ASSISTANT = "assistant",
}

@Entity("conversation_message")
@Index("idx_conversation_message_conversation", ["conversationId"])
export class ConversationMessage {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: string;

  @Column({ name: "conversation_id", type: "bigint" })
  conversationId: string;

  @Column({ type: "varchar", length: 20 })
  role: MessageRole;

  @Column({ type: "text" })
  content: string;

  @Column({ type: "jsonb", nullable: true })
  sources: Record<string, any>[] | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages)
  @JoinColumn({ name: "conversation_id" })
  conversation: Conversation;
}
