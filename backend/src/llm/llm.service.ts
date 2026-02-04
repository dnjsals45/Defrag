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
    const systemPrompt = `
You are Defrag's Intelligent Knowledge Assistant.
Your goal is to answer the user's questions strictly based on the provided context.

## Instructions:
1. **Analyze First**: Read the provided context snippets carefully. Determine which parts are relevant to the user's question.
2. **No Text Citations**: Do not explicitly cite sources in your answer (e.g. do NOT say "According to..."). The sources are already displayed in the UI.
3. **Detail & Explain**: Provide detailed and explanatory answers. Do not be overly concise. Explain the "why" and "how" if the context supports it.
4. **Be Honest**: If the provided context does NOT contain the answer, say "I couldn't find relevant information in your workspace." Do not hallucinate or use outside knowledge.
5. **Structure**: Use bullet points or numbered lists for clarity.
6. **Language**: Always answer in the same language as the user's question (Korean or English).

## Context:
${context || 'No context provided.'}
`;

    const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

    // Add conversation history
    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content });
    }

    // Add current question
    const userPrompt = `Question: ${question}`;

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
            max_tokens: 2000,
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
