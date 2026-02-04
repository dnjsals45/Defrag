import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Inject,
  forwardRef,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Repository, In } from "typeorm";
import {
  ContextItem,
  SourceType,
} from "../database/entities/context-item.entity";
import { VectorData } from "../database/entities/vector-data.entity";
import { Workspace } from "../database/entities/workspace.entity";
import {
  WorkspaceMember,
  MemberRole,
} from "../database/entities/workspace-member.entity";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { CreateItemDto } from "./dto/create-item.dto";
import {
  SyncService,
  SyncOptions,
  WorkspaceSyncStatus,
} from "../sync/sync.service";
import { Provider } from "../database/entities/user-connection.entity";
import { ArticleService } from "../article/article.service";

@Injectable()
export class ItemsService {
  private readonly logger = new Logger(ItemsService.name);

  constructor(
    @InjectRepository(ContextItem)
    private readonly itemsRepository: Repository<ContextItem>,
    @InjectRepository(VectorData)
    private readonly vectorRepository: Repository<VectorData>,
    @InjectQueue("embedding")
    private readonly embeddingQueue: Queue,
    private readonly workspacesService: WorkspacesService,
    @Inject(forwardRef(() => SyncService))
    private readonly syncService: SyncService,
    private readonly articleService: ArticleService,
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
      .createQueryBuilder("item")
      .where("item.workspace_id = :workspaceId", { workspaceId })
      .andWhere("item.deleted_at IS NULL");

    if (source) {
      queryBuilder.andWhere("item.source_type = :source", { source });
    }

    if (q) {
      queryBuilder.andWhere("(item.title ILIKE :q OR item.content ILIKE :q)", {
        q: `%${q}%`,
      });
    }

    const [items, total] = await queryBuilder
      .orderBy("item.created_at", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Get item IDs that have embeddings
    const itemIds = items.map((item) => item.id);
    let embeddedItemIds: string[] = [];

    if (itemIds.length > 0) {
      const vectorData = await this.vectorRepository.find({
        where: { itemId: In(itemIds) },
        select: ["itemId"],
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
        snippet: item.content?.substring(0, 200) || "",
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
      throw new NotFoundException("Item not found");
    }

    return item;
  }

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateItemDto,
  ): Promise<{
    items: ContextItem[];
    failed: { url: string; error: string }[];
  }> {
    const member = await this.checkAccessWithRole(workspaceId, userId);

    const savedItems: ContextItem[] = [];
    const failed: { url: string; error: string }[] = [];

    for (const url of dto.urls) {
      try {
        let title = dto.title;
        let content = dto.content;
        let metadata: Record<string, any> = { originalUrl: url };

        // If content is not provided, extract it from the URL
        if (!content) {
          try {
            this.logger.log(`Extracting article content from: ${url}`);
            const article = await this.articleService.extractFromUrl(url);

            title = title || article.title;
            content = this.articleService.cleanTextContent(article.textContent);
            metadata = {
              ...metadata,
              siteName: article.siteName,
              byline: article.byline,
              excerpt: article.excerpt,
              lang: article.lang,
              contentLength: article.length,
            };

            this.logger.log(`Successfully extracted article: ${title}`);
          } catch (error: any) {
            this.logger.warn(
              `Failed to extract article content: ${error.message}`,
            );
            // Fall back to placeholder if extraction fails
            content = `Failed to extract content from ${url}. Error: ${error.message}`;
          }
        }

        const item = this.itemsRepository.create({
          workspaceId,
          authorId: userId,
          sourceType: SourceType.WEB_ARTICLE,
          externalId: `web:${url}`,
          title: title || url,
          content,
          sourceUrl: url,
          metadata,
          importanceScore: 0.5,
        });

        const savedItem = await this.itemsRepository.save(item);
        savedItems.push(savedItem);

        this.logger.log(`Created web article item: ${savedItem.id}`);
      } catch (error: any) {
        this.logger.warn(`Failed to create item for ${url}: ${error.message}`);
        failed.push({ url, error: error.message });
      }
    }

    // Queue embedding generation for all saved items
    if (savedItems.length > 0) {
      await this.embeddingQueue.add("generate", {
        itemIds: savedItems.map((item) => item.id),
        workspaceId,
      });
    }

    return { items: savedItems, failed };
  }

  private async checkAccessWithRole(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember> {
    const member = await this.workspacesService.checkAccess(
      workspaceId,
      userId,
    );
    if (!member) {
      throw new ForbiddenException("Access denied");
    }

    // Get workspace to check type
    const workspace = await this.workspacesService.findById(
      workspaceId,
      userId,
    );

    // For team workspaces, only ADMIN can add items
    if (workspace.type === "team" && member.role !== MemberRole.ADMIN) {
      throw new ForbiddenException(
        "Only admins can add items to team workspaces",
      );
    }

    return member;
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
      throw new NotFoundException("Item not found");
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

  async getSyncStatus(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceSyncStatus> {
    await this.checkAccess(workspaceId, userId);
    return this.syncService.getSyncStatus(workspaceId);
  }

  private async checkAccess(workspaceId: string, userId: string) {
    const member = await this.workspacesService.checkAccess(
      workspaceId,
      userId,
    );
    if (!member) {
      throw new ForbiddenException("Access denied");
    }
    return member;
  }
}
