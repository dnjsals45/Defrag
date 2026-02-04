import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ContextItem } from "../database/entities/context-item.entity";
import { VectorData } from "../database/entities/vector-data.entity";
import { EmbeddingService } from "./embedding.service";

export interface EmbeddingJobData {
  itemIds: string[];
  workspaceId: string;
}

export interface EmbeddingResult {
  processedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: string[];
}

@Processor("embedding")
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);
  private readonly BATCH_SIZE = 20;
  private readonly CHUNK_SIZE = 500; // 500자 단위로 청킹
  private readonly CHUNK_OVERLAP = 50; // 청크 간 50자 오버랩

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
      skippedCount: 0,
      failedCount: 0,
      errors: [],
    };

    try {
      // Process items in batches
      for (let i = 0; i < itemIds.length; i += this.BATCH_SIZE) {
        const batch = itemIds.slice(i, i + this.BATCH_SIZE);
        this.logger.debug(
          `Processing batch ${i / this.BATCH_SIZE + 1} of ${Math.ceil(itemIds.length / this.BATCH_SIZE)}`,
        );

        // Process each item in the batch
        for (const itemId of batch) {
          try {
            const wasProcessed = await this.processItem(itemId, workspaceId);
            if (wasProcessed) {
              result.processedCount++;
            } else {
              result.skippedCount++;
            }
          } catch (error) {
            result.failedCount++;
            const errorMsg =
              error instanceof Error ? error.message : "Unknown error";
            this.logger.error(`Failed to process item ${itemId}: ${errorMsg}`);
            result.errors.push(`Item ${itemId}: ${errorMsg}`);
          }

          // Update job progress
          const progress = Math.floor(
            ((i + batch.indexOf(itemId) + 1) / itemIds.length) * 100,
          );
          await job.updateProgress({
            processed: result.processedCount,
            skipped: result.skippedCount,
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
        `Embedding generation completed: ${result.processedCount} processed, ${result.skippedCount} skipped, ${result.failedCount} failed`,
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Embedding job failed: ${errorMsg}`);
      result.errors.push(`Job failure: ${errorMsg}`);
    }

    return result;
  }

  private async processItem(
    itemId: string,
    workspaceId: string,
  ): Promise<boolean> {
    // Check if embedding already exists
    const existingVectors = await this.vectorRepository.find({
      where: { itemId },
    });

    if (existingVectors.length > 0) {
      this.logger.debug(
        `Item ${itemId} already has ${existingVectors.length} embedding(s), skipping`,
      );
      return false; // Skipped
    }

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
    const fullText = [item.title, item.content].filter(Boolean).join("\n\n");

    if (!fullText.trim()) {
      this.logger.warn(`Item ${itemId} has no content to embed, skipping`);
      return false; // Skipped
    }

    // Chunk the content
    const chunks = this.chunkText(fullText);
    this.logger.debug(`Item ${itemId}: Split into ${chunks.length} chunk(s)`);

    // Generate embeddings for each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await this.embeddingService.generateEmbedding(chunk);

      // Save to vector_data table with chunk info
      await this.vectorRepository.save(
        this.vectorRepository.create({
          itemId,
          chunkIndex: i,
          chunkContent: chunk,
          embedding: `[${embedding.join(",")}]`,
        }),
      );

      // Small delay between chunks to avoid rate limits
      if (i < chunks.length - 1) {
        await this.delay(50);
      }
    }

    this.logger.debug(
      `Successfully generated and stored ${chunks.length} embedding(s) for item ${itemId}`,
    );
    return true; // Processed
  }

  /**
   * Split text into chunks with overlap
   * 500자 단위로 나누되, 문장이 끊기지 않도록 마침표/줄바꿈 기준으로 조정
   */
  private chunkText(text: string): string[] {
    // If text is short enough, return as single chunk
    if (text.length <= this.CHUNK_SIZE) {
      return [text];
    }

    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      let endIndex = startIndex + this.CHUNK_SIZE;

      // If this is not the last chunk, try to find a good break point
      if (endIndex < text.length) {
        // Look for sentence boundaries (. ! ? or newline) near the end
        const searchStart = Math.max(
          startIndex + this.CHUNK_SIZE - 100,
          startIndex,
        );
        const searchEnd = Math.min(
          startIndex + this.CHUNK_SIZE + 50,
          text.length,
        );
        const searchText = text.slice(searchStart, searchEnd);

        // Find the last sentence boundary in the search range
        const boundaryMatch = searchText.match(/[.!?。\n][^.!?。\n]*$/);
        if (boundaryMatch && boundaryMatch.index !== undefined) {
          endIndex = searchStart + boundaryMatch.index + 1;
        }
      } else {
        endIndex = text.length;
      }

      const chunk = text.slice(startIndex, endIndex).trim();
      if (chunk) {
        chunks.push(chunk);
      }

      // Move to next chunk with overlap
      startIndex = endIndex - this.CHUNK_OVERLAP;
      if (startIndex >= text.length - this.CHUNK_OVERLAP) {
        break;
      }
    }

    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
