import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  private readonly apiKey: string;
  private readonly model = "gpt-4o-mini";
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiKey = this.configService.get("OPENAI_API_KEY") || "";
  }

  async generateAnswer(question: string, context: string): Promise<string> {
    return this.generateAnswerWithHistory(question, context, []);
  }

  async generateAnswerWithHistory(
    question: string,
    context: string,
    history: { role: "user" | "assistant"; content: string }[],
  ): Promise<string> {
    const systemPrompt = `You are a helpful AI assistant that answers questions based on the provided context from the user's workspace.
Your answers should be:
- Accurate and based only on the provided context
- Concise but comprehensive
- In the same language as the question (Korean or English)

If the context doesn't contain enough information to answer the question, say so honestly.`;

    const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

    // Add conversation history
    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content });
    }

    // Add current question with context
    const userPrompt = context
      ? `Context from workspace:\n${context}\n\nQuestion: ${question}`
      : `Question: ${question}\n\n(No relevant context found in workspace)`;

    messages.push({ role: "user", content: userPrompt });

    return this.chatCompletion(messages);
  }

  async chatCompletion(
    messages: ChatMessage[],
    retryCount = 0,
  ): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<ChatCompletionResponse>(
          "https://api.openai.com/v1/chat/completions",
          {
            model: this.model,
            messages,
            temperature: 0.7,
            max_tokens: 1000,
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              "Content-Type": "application/json",
            },
          },
        ),
      );

      return (
        response.data.choices[0]?.message?.content || "No response generated."
      );
    } catch (error) {
      if (this.isRetryableError(error) && retryCount < this.maxRetries) {
        const delay = this.baseDelay * Math.pow(2, retryCount);
        this.logger.warn(
          `Retrying chat completion (attempt ${retryCount + 1}/${this.maxRetries})`,
        );
        await this.sleep(delay);
        return this.chatCompletion(messages, retryCount + 1);
      }
      this.logger.error(`Chat completion failed: ${error.message}`);
      throw error;
    }
  }

  private isRetryableError(error: any): boolean {
    const status = error.response?.status;
    return status === 429 || (status >= 500 && status < 600);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
