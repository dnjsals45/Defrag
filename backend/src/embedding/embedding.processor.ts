import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContextItem } from '../database/entities/context-item.entity';
import { VectorData } from '../database/entities/vector-data.entity';
import { EmbeddingService } from './embedding.service';

export interface EmbeddingJobData {
  itemIds: string[];
  workspaceId: string;
}

export interface EmbeddingResult {
  processedCount: number;
  failedCount: number;
  errors: string[];
}

@Processor('embedding')
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);
  private readonly BATCH_SIZE = 20;

  constructor(
    private readonly embeddingService: EmbeddingService,
    @InjectRepository(ContextItem)
    private readonly itemsRepository: Repository<ContextItem>,
    @InjectRepository(VectorData)
    private readonly vectorRepository: Repository<VectorData>,
  ) {
    super();
  }

  async process(job: Job<EmbeddingJobData>): Promise<EmbeddingResult> {
    const { itemIds, workspaceId } = job.data;
    this.logger.log(
      `Starting embedding generation for ${itemIds.length} items in workspace ${workspaceId}`,
    );

    const result: EmbeddingResult = {
      processedCount: 0,
      failedCount: 0,
      errors: [],
    };

    try {
      // Process items in batches
      for (let i = 0; i < itemIds.length; i += this.BATCH_SIZE) {
        const batch = itemIds.slice(i, i + this.BATCH_SIZE);
        this.logger.debug(`Processing batch ${i / this.BATCH_SIZE + 1} of ${Math.ceil(itemIds.length / this.BATCH_SIZE)}`);

        // Process each item in the batch
        for (const itemId of batch) {
          try {
            await this.processItem(itemId, workspaceId);
            result.processedCount++;
          } catch (error) {
            result.failedCount++;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to process item ${itemId}: ${errorMsg}`);
            result.errors.push(`Item ${itemId}: ${errorMsg}`);
          }

          // Update job progress
          const progress = Math.floor(((i + batch.indexOf(itemId) + 1) / itemIds.length) * 100);
          await job.updateProgress({
            processed: result.processedCount,
            failed: result.failedCount,
            total: itemIds.length,
            percentage: progress,
          });
        }

        // Small delay between batches to avoid rate limits
        if (i + this.BATCH_SIZE < itemIds.length) {
          await this.delay(100);
        }
      }

      this.logger.log(
        `Embedding generation completed: ${result.processedCount} processed, ${result.failedCount} failed`,
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Embedding job failed: ${errorMsg}`);
      result.errors.push(`Job failure: ${errorMsg}`);
    }

    return result;
  }

  private async processItem(itemId: string, workspaceId: string): Promise<void> {
    // Fetch the context item
    const item = await this.itemsRepository.findOne({
      where: {
        id: itemId,
        workspaceId,
      },
    });

    if (!item) {
      throw new Error(`Item ${itemId} not found in workspace ${workspaceId}`);
    }

    // Generate text for embedding (combine title and content)
    const textToEmbed = [item.title, item.content].filter(Boolean).join('\n\n');

    if (!textToEmbed.trim()) {
      this.logger.warn(`Item ${itemId} has no content to embed, skipping`);
      return;
    }

    // Generate embedding using the service
    const embedding = await this.embeddingService.generateEmbedding(textToEmbed);

    // Upsert to vector_data table
    await this.upsertVectorData(itemId, embedding);

    this.logger.debug(`Successfully generated and stored embedding for item ${itemId}`);
  }

  private async upsertVectorData(itemId: string, embedding: number[]): Promise<void> {
    // Check if vector data already exists
    const existing = await this.vectorRepository.findOne({
      where: { itemId },
    });

    // Convert embedding array to string format for storage
    const embeddingStr = `[${embedding.join(',')}]`;

    if (existing) {
      // Update existing vector data
      await this.vectorRepository.update(existing.id, {
        embedding: embeddingStr,
      });
    } else {
      // Create new vector data
      await this.vectorRepository.save(
        this.vectorRepository.create({
          itemId,
          embedding: embeddingStr,
        }),
      );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
