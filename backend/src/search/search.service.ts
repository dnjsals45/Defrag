import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ContextItem, SourceType } from '../database/entities/context-item.entity';
import { VectorData } from '../database/entities/vector-data.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { SearchDto } from './dto/search.dto';
import { AskDto } from './dto/ask.dto';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(ContextItem)
    private readonly itemsRepository: Repository<ContextItem>,
    @InjectRepository(VectorData)
    private readonly vectorRepository: Repository<VectorData>,
    private readonly workspacesService: WorkspacesService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async search(workspaceId: string, userId: string, dto: SearchDto) {
    await this.checkAccess(workspaceId, userId);

    const { query, sources, limit = 10 } = dto;

    // TODO: Generate embedding for query using OpenAI
    // const embedding = await this.generateEmbedding(query);

    // For now, use simple text search
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

    // 1. Search for relevant context
    const searchResults = await this.search(workspaceId, userId, {
      query: question,
      limit: 5,
    });

    // 2. Build context from search results
    const context = searchResults.results
      .map((r) => `[${r.sourceType}] ${r.title}: ${r.snippet}`)
      .join('\n\n');

    // 3. TODO: Call LLM with context and question
    // For now, return placeholder
    const answer = `Based on ${searchResults.results.length} relevant documents found in your workspace, here's what I found about "${question}":\n\n${context ? 'Context available. LLM integration pending.' : 'No relevant context found.'}`;

    return {
      answer,
      sources: includeContext
        ? searchResults.results.map((r) => ({
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
    // Raw query for pgvector similarity search
    const results = await this.dataSource.query(
      `
      SELECT
        ci.*,
        vd.embedding <=> $1::vector AS distance
      FROM context_item ci
      JOIN vector_data vd ON vd.item_id = ci.id
      WHERE ci.workspace_id = $2
        AND ci.deleted_at IS NULL
      ORDER BY distance
      LIMIT $3
      `,
      [`[${embedding.join(',')}]`, workspaceId, limit],
    );

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
