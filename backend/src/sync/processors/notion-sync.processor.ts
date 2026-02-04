import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotionOAuthService, NotionBlock } from '../../oauth/providers/notion.service';
import { IntegrationsService } from '../../integrations/integrations.service';
import { ContextItem, SourceType } from '../../database/entities/context-item.entity';
import { Provider } from '../../database/entities/user-connection.entity';
import { NotionTransformer } from '../transformers/notion.transformer';

export interface NotionSyncJobData {
  workspaceId: string;
  userId: string;
  syncType: 'full' | 'incremental';
  pageIds?: string[];
  targetItems?: string[];  // 특정 페이지만 동기화
}

export interface NotionSyncResult {
  itemsSynced: number;
  errors: string[];
}

@Processor('notion-sync')
export class NotionSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(NotionSyncProcessor.name);
  private readonly RATE_LIMIT_DELAY = 350; // Notion: 3 req/sec ≈ 333ms
  private syncedItemIds: string[] = [];

  constructor(
    private readonly notionService: NotionOAuthService,
    private readonly integrationsService: IntegrationsService,
    @InjectRepository(ContextItem)
    private readonly itemsRepository: Repository<ContextItem>,
    @InjectQueue('embedding')
    private readonly embeddingQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<NotionSyncJobData>): Promise<NotionSyncResult> {
    const { workspaceId, syncType, pageIds, targetItems } = job.data;
    this.logger.log(`Starting Notion sync for workspace ${workspaceId} (${syncType})`);

    const result: NotionSyncResult = { itemsSynced: 0, errors: [] };
    this.syncedItemIds = [];

    try {
      const accessToken = await this.integrationsService.getDecryptedAccessToken(
        workspaceId,
        Provider.NOTION,
      );

      if (!accessToken) {
        result.errors.push('Notion integration not found or token invalid');
        return result;
      }

      // Get pages to sync - either targetItems, pageIds, or all selected pages
      let selectedPageIds: string[];

      if (targetItems && targetItems.length > 0) {
        selectedPageIds = targetItems;
        this.logger.log(`Syncing specific pages: ${selectedPageIds.join(', ')}`);
      } else {
        selectedPageIds = pageIds || await this.integrationsService.getNotionSelectedPages(workspaceId);
      }

      if (!selectedPageIds || selectedPageIds.length === 0) {
        result.errors.push('No pages selected for sync');
        return result;
      }

      // Sync selected pages
      await job.updateProgress({ phase: 'fetching_pages', count: selectedPageIds.length });

      for (const pageId of selectedPageIds) {
        try {
          await this.syncPage(accessToken, pageId, workspaceId, job);
          await this.delay(this.RATE_LIMIT_DELAY);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Error syncing page ${pageId}: ${errorMsg}`);
          result.errors.push(`Page ${pageId}: ${errorMsg}`);
        }
      }

      result.itemsSynced = await this.countSyncedItems(workspaceId);
      this.logger.log(`Notion sync completed: ${result.itemsSynced} items`);

      // Trigger embedding generation for all synced items
      if (this.syncedItemIds.length > 0) {
        await this.embeddingQueue.add('generate', {
          itemIds: this.syncedItemIds,
          workspaceId,
        });
        this.logger.log(`Queued embedding generation for ${this.syncedItemIds.length} items`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Notion sync failed: ${errorMsg}`);
      result.errors.push(errorMsg);
    }

    return result;
  }

  private async syncAllPages(
    accessToken: string,
    workspaceId: string,
    job: Job,
    result: NotionSyncResult,
  ): Promise<void> {
    let cursor: string | undefined;
    let pagesProcessed = 0;

    while (true) {
      const { pages, hasMore, nextCursor } = await this.notionService.getPages(
        accessToken,
        cursor,
      );

      await job.updateProgress({
        phase: 'fetching_pages',
        count: pagesProcessed + pages.length,
      });

      for (const page of pages) {
        try {
          await this.syncPage(accessToken, page.id, workspaceId, job, page);
          pagesProcessed++;
          await this.delay(this.RATE_LIMIT_DELAY);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          const title = NotionTransformer.extractPageTitle(page);
          this.logger.error(`Error syncing page "${title}": ${errorMsg}`);
          result.errors.push(`"${title}": ${errorMsg}`);
        }
      }

      if (!hasMore || !nextCursor) break;
      cursor = nextCursor;
    }
  }

  private async syncPage(
    accessToken: string,
    pageId: string,
    workspaceId: string,
    job?: Job,
    existingPage?: any,
  ): Promise<void> {
    // Fetch page content if not provided
    const page = existingPage || (await this.notionService.getPageContent(accessToken, pageId));

    if (!page) {
      throw new Error('Page not found or inaccessible');
    }

    // Fetch all blocks from the page
    const blocks = await this.fetchAllBlocks(accessToken, pageId);

    if (job) {
      const title = NotionTransformer.extractPageTitle(page);
      await job.updateProgress({
        phase: 'syncing_page',
        pageTitle: title,
        blockCount: blocks.length,
      });
    }

    // Transform and save
    const transformed = NotionTransformer.transformPage(page, blocks);
    await this.upsertItem(workspaceId, transformed);
  }

  private async fetchAllBlocks(accessToken: string, pageId: string): Promise<NotionBlock[]> {
    const allBlocks: NotionBlock[] = [];
    let cursor: string | undefined;

    while (true) {
      const { blocks, hasMore, nextCursor } = await this.notionService.getPageBlocks(
        accessToken,
        pageId,
        cursor,
      );

      allBlocks.push(...blocks);

      // Recursively fetch children for blocks that have them
      for (const block of blocks) {
        if (block.has_children) {
          try {
            const childBlocks = await this.fetchAllBlocks(accessToken, block.id);
            allBlocks.push(...childBlocks);
            await this.delay(this.RATE_LIMIT_DELAY);
          } catch (error) {
            // Log but don't fail the entire sync
            this.logger.warn(`Could not fetch children for block ${block.id}`);
          }
        }
      }

      if (!hasMore || !nextCursor) break;
      cursor = nextCursor;
      await this.delay(this.RATE_LIMIT_DELAY);
    }

    return allBlocks;
  }

  private async upsertItem(
    workspaceId: string,
    item: {
      externalId: string;
      sourceType: SourceType;
      title: string;
      content: string;
      sourceUrl: string;
      metadata: Record<string, any>;
      importanceScore: number;
    },
  ): Promise<void> {
    const existing = await this.itemsRepository.findOne({
      where: {
        workspaceId,
        sourceType: item.sourceType,
        externalId: item.externalId,
      },
    });

    if (existing) {
      await this.itemsRepository.update(existing.id, {
        title: item.title,
        content: item.content,
        sourceUrl: item.sourceUrl,
        metadata: item.metadata,
        importanceScore: item.importanceScore,
      });
      this.syncedItemIds.push(existing.id);
    } else {
      const savedItem = await this.itemsRepository.save(
        this.itemsRepository.create({
          workspaceId,
          ...item,
        }),
      );
      this.syncedItemIds.push(savedItem.id);
    }
  }

  private async countSyncedItems(workspaceId: string): Promise<number> {
    return this.itemsRepository.count({
      where: {
        workspaceId,
        sourceType: SourceType.NOTION_PAGE,
      },
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
