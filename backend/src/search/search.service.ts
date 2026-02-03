import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ContextItem, SourceType } from '../database/entities/context-item.entity';
import { VectorData } from '../database/entities/vector-data.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { LLMService } from '../llm/llm.service';
import { SearchDto } from './dto/search.dto';
import { AskDto } from './dto/ask.dto';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  // 유사도 임계값: 0에 가까울수록 유사함 (코사인 거리)
  // 0.5 이하면 관련성 높음, 0.8 이상이면 관련 없음
  // 한국어 텍스트의 경우 거리가 더 클 수 있으므로 0.75로 설정
  private readonly SIMILARITY_THRESHOLD = 0.75;

  constructor(
    @InjectRepository(ContextItem)
    private readonly itemsRepository: Repository<ContextItem>,
    @InjectRepository(VectorData)
    private readonly vectorRepository: Repository<VectorData>,
    private readonly workspacesService: WorkspacesService,
    private readonly embeddingService: EmbeddingService,
    private readonly llmService: LLMService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async search(workspaceId: string, userId: string, dto: SearchDto) {
    await this.checkAccess(workspaceId, userId);

    const { query, sources, limit = 10 } = dto;

    // Try semantic search first using embeddings
    try {
      this.logger.debug(`Generating embedding for query: "${query}"`);
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

      this.logger.debug('Performing vector search');
      const vectorResults = await this.vectorSearch(workspaceId, queryEmbedding, limit);

      // Filter by sources if specified
      let filteredResults = vectorResults;
      if (sources && sources.length > 0) {
        filteredResults = vectorResults.filter((item: any) =>
          sources.includes(item.source_type)
        );
      }

      // If vector search returned results, use them
      if (filteredResults.length > 0) {
        const mappedResults = filteredResults.map((item: any) => ({
          id: item.id,
          title: item.title,
          // Use chunk content if available, otherwise extract snippet from full content
          snippet: item.chunk_content || this.extractSnippet(item.content, query),
          sourceType: item.source_type,
          sourceUrl: item.source_url,
          score: 1 - item.distance, // Convert distance to similarity score
          distance: item.distance, // 디버깅용
          chunkIndex: item.chunk_index, // 디버깅용
        }));

        this.logger.debug(
          `Vector search returned ${filteredResults.length} results: ${mappedResults.map((r: any) => `"${r.title}" chunk:${r.chunkIndex} (score: ${(r.score * 100).toFixed(1)}%)`).join(', ')}`,
        );

        return { results: mappedResults };
      }

      this.logger.debug('No results from vector search, falling back to text search');
    } catch (error) {
      this.logger.warn(`Embedding generation or vector search failed: ${error.message}. Falling back to text search.`);
    }

    // Fallback to text search if vector search returns no results or fails
    const queryBuilder = this.itemsRepository
      .createQueryBuilder('item')
      .where('item.workspace_id = :workspaceId', { workspaceId })
      .andWhere('item.deleted_at IS NULL')
      .andWhere(
        '(item.title ILIKE :query OR item.content ILIKE :query)',
        { query: `%${query}%` },
      );

    if (sources && sources.length > 0) {
      queryBuilder.andWhere('item.source_type IN (:...sources)', { sources });
    }

    const items = await queryBuilder
      .orderBy('item.importance_score', 'DESC')
      .addOrderBy('item.created_at', 'DESC')
      .take(limit)
      .getMany();

    this.logger.debug(`Text search returned ${items.length} results`);
    return {
      results: items.map((item, index) => ({
        id: item.id,
        title: item.title,
        snippet: this.extractSnippet(item.content, query),
        sourceType: item.sourceType,
        sourceUrl: item.sourceUrl,
        score: 1 - index * 0.1, // Placeholder score
      })),
    };
  }

  async ask(workspaceId: string, userId: string, dto: AskDto) {
    await this.checkAccess(workspaceId, userId);

    const { question, includeContext = true } = dto;

    // 1. Search for relevant context (더 많은 결과 가져오기)
    const searchResults = await this.search(workspaceId, userId, {
      query: question,
      limit: 10,
    });

    // 2. 유사도 높은 결과만 필터링 (score 0.25 이상)
    // 한국어 텍스트의 경우 거리가 더 클 수 있으므로 임계값 낮춤
    const relevantResults = searchResults.results.filter((r: any) => r.score >= 0.25);

    this.logger.debug(
      `Ask: ${searchResults.results.length} results found, ${relevantResults.length} above score threshold`,
    );

    // 3. Build context from relevant results
    const context = relevantResults
      .map((r: any) => `[${r.sourceType}] ${r.title} (관련도: ${(r.score * 100).toFixed(0)}%):\n${r.snippet}`)
      .join('\n\n---\n\n');

    // 3. Generate AI answer using LLM
    let answer: string;
    try {
      this.logger.debug(`Generating AI answer for question: "${question}"`);
      answer = await this.llmService.generateAnswer(question, context);
    } catch (error) {
      this.logger.error(`LLM generation failed: ${error.message}`);
      answer = `죄송합니다. 답변 생성 중 오류가 발생했습니다. 관련 문서 ${searchResults.results.length}개를 찾았습니다.`;
    }

    return {
      answer,
      sources: includeContext
        ? searchResults.results.map((r: any) => ({
            id: r.id,
            title: r.title,
            sourceType: r.sourceType,
            sourceUrl: r.sourceUrl,
            relevantSnippet: r.snippet,
          }))
        : undefined,
    };
  }

  async vectorSearch(workspaceId: string, embedding: number[], limit: number) {
    // Raw query for pgvector similarity search with threshold
    // Now includes chunk content for better context display
    const results = await this.dataSource.query(
      `
      SELECT
        ci.id,
        ci.title,
        ci.content,
        ci.source_type,
        ci.source_url,
        ci.metadata,
        ci.importance_score,
        ci.created_at,
        vd.chunk_index,
        vd.chunk_content,
        vd.embedding <=> $1::vector AS distance
      FROM context_item ci
      JOIN vector_data vd ON vd.item_id = ci.id
      WHERE ci.workspace_id = $2
        AND ci.deleted_at IS NULL
        AND vd.deleted_at IS NULL
        AND vd.embedding <=> $1::vector < $4
      ORDER BY distance
      LIMIT $3
      `,
      [`[${embedding.join(',')}]`, workspaceId, limit, this.SIMILARITY_THRESHOLD],
    );

    this.logger.debug(`Vector search found ${results.length} results within threshold ${this.SIMILARITY_THRESHOLD}`);
    return results;
  }

  private extractSnippet(content: string, query: string, length = 200): string {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerContent.indexOf(lowerQuery);

    if (index === -1) {
      return content.substring(0, length) + (content.length > length ? '...' : '');
    }

    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + query.length + 150);
    let snippet = content.substring(start, end);

    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    return snippet;
  }

  private async checkAccess(workspaceId: string, userId: string) {
    const member = await this.workspacesService.checkAccess(workspaceId, userId);
    if (!member) {
      throw new ForbiddenException('Access denied');
    }
    return member;
  }
}
