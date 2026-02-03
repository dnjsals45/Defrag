import { Injectable, ForbiddenException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ContextItem, SourceType } from '../database/entities/context-item.entity';
import { VectorData } from '../database/entities/vector-data.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { CreateItemDto } from './dto/create-item.dto';
import { SyncService, SyncOptions, WorkspaceSyncStatus } from '../sync/sync.service';
import { Provider } from '../database/entities/user-connection.entity';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(ContextItem)
    private readonly itemsRepository: Repository<ContextItem>,
    @InjectRepository(VectorData)
    private readonly vectorRepository: Repository<VectorData>,
    private readonly workspacesService: WorkspacesService,
    @Inject(forwardRef(() => SyncService))
    private readonly syncService: SyncService,
  ) {}

  async findAll(
    workspaceId: string,
    userId: string,
    options: {
      source?: SourceType;
      q?: string;
      page?: number;
      limit?: number;
    },
  ) {
    await this.checkAccess(workspaceId, userId);

    const { source, q, page = 1, limit = 20 } = options;

    const queryBuilder = this.itemsRepository
      .createQueryBuilder('item')
      .where('item.workspace_id = :workspaceId', { workspaceId })
      .andWhere('item.deleted_at IS NULL');

    if (source) {
      queryBuilder.andWhere('item.source_type = :source', { source });
    }

    if (q) {
      queryBuilder.andWhere(
        '(item.title ILIKE :q OR item.content ILIKE :q)',
        { q: `%${q}%` },
      );
    }

    const [items, total] = await queryBuilder
      .orderBy('item.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Get item IDs that have embeddings
    const itemIds = items.map((item) => item.id);
    let embeddedItemIds: string[] = [];

    if (itemIds.length > 0) {
      const vectorData = await this.vectorRepository.find({
        where: { itemId: In(itemIds) },
        select: ['itemId'],
      });
      embeddedItemIds = vectorData.map((v) => v.itemId);
    }

    return {
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        sourceType: item.sourceType,
        sourceUrl: item.sourceUrl,
        createdAt: item.createdAt,
        snippet: item.content?.substring(0, 200) || '',
        hasEmbedding: embeddedItemIds.includes(item.id),
      })),
      total,
      page,
    };
  }

  async findById(workspaceId: string, userId: string, itemId: string) {
    await this.checkAccess(workspaceId, userId);

    const item = await this.itemsRepository.findOne({
      where: { id: itemId, workspaceId },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    return item;
  }

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateItemDto,
  ): Promise<ContextItem> {
    await this.checkAccess(workspaceId, userId);

    // TODO: Fetch URL content and generate embedding
    const item = this.itemsRepository.create({
      workspaceId,
      authorId: userId,
      sourceType: SourceType.WEB_ARTICLE,
      title: dto.title || dto.url,
      content: dto.content || 'Content will be fetched...', // Placeholder
      sourceUrl: dto.url,
      metadata: { originalUrl: dto.url },
    });

    return this.itemsRepository.save(item);
  }

  async delete(
    workspaceId: string,
    userId: string,
    itemId: string,
  ): Promise<void> {
    await this.checkAccess(workspaceId, userId);

    const item = await this.itemsRepository.findOne({
      where: { id: itemId, workspaceId },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    await this.itemsRepository.softDelete(itemId);
  }

  async triggerSync(
    workspaceId: string,
    userId: string,
    options?: SyncOptions,
  ): Promise<{ jobIds: Record<Provider, string> }> {
    await this.checkAccess(workspaceId, userId);
    return this.syncService.triggerSync(workspaceId, userId, options);
  }

  async getSyncStatus(workspaceId: string, userId: string): Promise<WorkspaceSyncStatus> {
    await this.checkAccess(workspaceId, userId);
    return this.syncService.getSyncStatus(workspaceId);
  }

  private async checkAccess(workspaceId: string, userId: string) {
    const member = await this.workspacesService.checkAccess(workspaceId, userId);
    if (!member) {
      throw new ForbiddenException('Access denied');
    }
    return member;
  }
}
