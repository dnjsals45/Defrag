import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";

interface OpenAIEmbeddingResponse {
  object: string;
  data: {
    object: string;
    embedding: number[];
    index: number;
  }[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly apiKey: string;
  private readonly model = "text-embedding-3-small";
  private readonly dimensions = 1536;
  private readonly maxTokens = 8000;
  private readonly maxRetries = 5;
  private readonly baseDelay = 1000; // 1 second

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiKey = this.configService.get("OPENAI_API_KEY") || "";
    if (!this.apiKey) {
      this.logger.warn("OPENAI_API_KEY is not set in environment variables");
    }
  }

  /**
   * Generate embedding for a single text
   * @param text - The text to generate embedding for
   * @returns Promise<number[]> - The embedding vector (1536 dimensions)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const truncatedText = this.truncateText(text);

    try {
      const response = await this.makeEmbeddingRequest([truncatedText]);
      return response.data[0].embedding;
    } catch (error) {
      this.logger.error(
        `Failed to generate embedding: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * @param texts - Array of texts to generate embeddings for (max 100)
   * @returns Promise<number[][]> - Array of embedding vectors
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    if (texts.length > 100) {
      throw new Error("Maximum batch size is 100 texts per request");
    }

    const truncatedTexts = texts.map((text) => this.truncateText(text));

    try {
      const response = await this.makeEmbeddingRequest(truncatedTexts);
      // Sort by index to ensure correct order
      return response.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);
    } catch (error) {
      this.logger.error(
        `Failed to generate embeddings: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Make embedding request to OpenAI API with exponential backoff retry
   * @param texts - Array of texts to embed
   * @returns Promise<OpenAIEmbeddingResponse>
   */
  private async makeEmbeddingRequest(
    texts: string[],
    retryCount = 0,
  ): Promise<OpenAIEmbeddingResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<OpenAIEmbeddingResponse>(
          "https://api.openai.com/v1/embeddings",
          {
            input: texts,
            model: this.model,
            dimensions: this.dimensions,
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              "Content-Type": "application/json",
            },
          },
        ),
      );

      return response.data;
    } catch (error) {
      // Check if error is rate limit (429) or server error (5xx)
      const isRetryable = this.isRetryableError(error);

      if (isRetryable && retryCount < this.maxRetries) {
        const delay = this.calculateBackoffDelay(retryCount);
        this.logger.warn(
          `Retrying embedding request (attempt ${retryCount + 1}/${this.maxRetries}) after ${delay}ms. Error: ${error.message}`,
        );

        await this.sleep(delay);
        return this.makeEmbeddingRequest(texts, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Truncate text to maximum token limit
   * Simple approximation: ~4 characters per token
   * @param text - The text to truncate
   * @returns Truncated text
   */
  private truncateText(text: string): string {
    const approximateMaxChars = this.maxTokens * 4;

    if (text.length <= approximateMaxChars) {
      return text;
    }

    this.logger.debug(
      `Truncating text from ${text.length} to ${approximateMaxChars} characters`,
    );

    return text.substring(0, approximateMaxChars);
  }

  /**
   * Check if error is retryable (rate limit or server error)
   * @param error - The error object
   * @returns boolean
   */
  private isRetryableError(error: any): boolean {
    if (!error.response) {
      return false;
    }

    const status = error.response.status;
    // Retry on rate limit (429) or server errors (5xx)
    return status === 429 || (status >= 500 && status < 600);
  }

  /**
   * Calculate exponential backoff delay
   * @param retryCount - Current retry attempt (0-indexed)
   * @returns Delay in milliseconds
   */
  private calculateBackoffDelay(retryCount: number): number {
    // Exponential backoff: baseDelay * 2^retryCount + random jitter
    const exponentialDelay = this.baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 1000; // Random jitter up to 1 second
    return exponentialDelay + jitter;
  }

  /**
   * Sleep for specified milliseconds
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
