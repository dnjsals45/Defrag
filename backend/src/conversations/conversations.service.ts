import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Conversation,
  ConversationMessage,
  MessageRole,
} from '../database/entities';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { SearchService } from '../search/search.service';
import { LLMService } from '../llm/llm.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(ConversationMessage)
    private readonly messageRepository: Repository<ConversationMessage>,
    private readonly workspacesService: WorkspacesService,
    private readonly searchService: SearchService,
    private readonly llmService: LLMService,
    private readonly dataSource: DataSource,
  ) {}

  async create(workspaceId: string, userId: string): Promise<Conversation> {
    await this.checkAccess(workspaceId, userId);

    const conversation = this.conversationRepository.create({
      workspaceId,
      userId,
      title: null,
    });

    return this.conversationRepository.save(conversation);
  }

  async findAll(
    workspaceId: string,
    userId: string,
    options: { page?: number; limit?: number } = {},
  ) {
    await this.checkAccess(workspaceId, userId);

    const { page = 1, limit = 20 } = options;

    const [conversations, total] = await this.conversationRepository
      .createQueryBuilder('conversation')
      .where('conversation.workspace_id = :workspaceId', { workspaceId })
      .andWhere('conversation.user_id = :userId', { userId })
      .andWhere('conversation.deleted_at IS NULL')
      .orderBy('conversation.updated_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(
    workspaceId: string,
    conversationId: string,
    userId: string,
  ): Promise<Conversation> {
    await this.checkAccess(workspaceId, userId);

    const conversation = await this.conversationRepository.findOne({
      where: {
        id: conversationId,
        workspaceId,
        userId,
      },
      relations: ['messages'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Sort messages by createdAt
    if (conversation.messages) {
      conversation.messages.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }

    return conversation;
  }

  async sendMessage(
    workspaceId: string,
    conversationId: string,
    userId: string,
    dto: SendMessageDto,
  ) {
    await this.checkAccess(workspaceId, userId);

    const conversation = await this.findOne(workspaceId, conversationId, userId);

    // 1. Save user message
    const userMessage = this.messageRepository.create({
      conversationId,
      role: MessageRole.USER,
      content: dto.question,
    });
    await this.messageRepository.save(userMessage);

    // 2. Search for relevant context
    const searchResults = await this.searchService.search(workspaceId, userId, {
      query: dto.question,
      limit: 10,
    });

    // Filter by score threshold
    const relevantResults = searchResults.results.filter((r: any) => r.score >= 0.4);

    this.logger.debug(
      `Conversation ${conversationId}: ${searchResults.results.length} results found, ${relevantResults.length} above score threshold`,
    );

    // 3. Build context from relevant results
    const context = relevantResults
      .map(
        (r: any) =>
          `[${r.sourceType}] ${r.title} (관련도: ${(r.score * 100).toFixed(0)}%):\n${r.snippet}`,
      )
      .join('\n\n---\n\n');

    // 4. Prepare conversation history (exclude the just-added user message since we pass it separately)
    const history = (conversation.messages || []).map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // 5. Generate AI answer with history
    let answer: string;
    try {
      this.logger.debug(
        `Generating AI answer with ${history.length} history messages`,
      );
      answer = await this.llmService.generateAnswerWithHistory(
        dto.question,
        context,
        history,
      );
    } catch (error) {
      this.logger.error(`LLM generation failed: ${error.message}`);
      answer = `죄송합니다. 답변 생성 중 오류가 발생했습니다. 관련 문서 ${searchResults.results.length}개를 찾았습니다.`;
    }

    // 6. Save assistant message with sources
    const sources = relevantResults.map((r: any) => ({
      id: r.id,
      title: r.title,
      sourceType: r.sourceType,
      sourceUrl: r.sourceUrl,
      snippet: r.snippet,
    }));

    const assistantMessage = this.messageRepository.create({
      conversationId,
      role: MessageRole.ASSISTANT,
      content: answer,
      sources,
    });
    await this.messageRepository.save(assistantMessage);

    // 7. Update conversation title if it's the first message
    if (!conversation.title) {
      const title = this.generateTitle(dto.question);
      await this.conversationRepository.update(conversationId, { title });
    }

    // 8. Update conversation's updatedAt
    await this.conversationRepository.update(conversationId, {
      updatedAt: new Date(),
    });

    return {
      userMessage,
      assistantMessage,
      sources,
    };
  }

  async update(
    workspaceId: string,
    conversationId: string,
    userId: string,
    dto: UpdateConversationDto,
  ): Promise<Conversation> {
    const conversation = await this.findOne(workspaceId, conversationId, userId);

    if (dto.title !== undefined) {
      conversation.title = dto.title;
    }

    return this.conversationRepository.save(conversation);
  }

  async delete(
    workspaceId: string,
    conversationId: string,
    userId: string,
  ): Promise<void> {
    await this.findOne(workspaceId, conversationId, userId);
    await this.conversationRepository.softDelete(conversationId);
  }

  private generateTitle(question: string): string {
    // Generate title from the first question (max 50 chars)
    const trimmed = question.trim();
    if (trimmed.length <= 50) {
      return trimmed;
    }
    return trimmed.substring(0, 47) + '...';
  }

  private async checkAccess(workspaceId: string, userId: string) {
    const member = await this.workspacesService.checkAccess(workspaceId, userId);
    if (!member) {
      throw new ForbiddenException('Access denied');
    }
    return member;
  }
}
