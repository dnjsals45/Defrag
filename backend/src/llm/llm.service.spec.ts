import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { LLMService } from './llm.service';

describe('LLMService', () => {
  let service: LLMService;
  let httpService: HttpService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'OPENAI_API_KEY') return 'test-api-key';
      return null;
    }),
  };

  const mockHttpService = {
    post: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LLMService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get<LLMService>(LLMService);
    httpService = module.get<HttpService>(HttpService);
    jest.clearAllMocks();
  });

  describe('generateAnswer', () => {
    it('should generate answer with context', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4o-mini',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'This is the generated answer.',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.generateAnswer(
        'What is TypeScript?',
        'TypeScript is a typed superset of JavaScript.',
      );

      expect(result).toBe('This is the generated answer.');
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          model: 'gpt-4o-mini',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' }),
          ]),
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        }),
      );
    });

    it('should generate answer without context', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          choices: [
            {
              message: {
                content: 'No context answer.',
              },
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.generateAnswer('Hello?', '');

      expect(result).toBe('No context answer.');
    });
  });

  describe('chatCompletion', () => {
    it('should return response content on success', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          choices: [
            {
              message: {
                content: 'Test response',
              },
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.chatCompletion([
        { role: 'user', content: 'Hello' },
      ]);

      expect(result).toBe('Test response');
    });

    it('should return default message when no content', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          choices: [{ message: {} }],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.chatCompletion([
        { role: 'user', content: 'Hello' },
      ]);

      expect(result).toBe('No response generated.');
    });

    it('should retry on rate limit error (429)', async () => {
      const rateLimitError = {
        response: { status: 429 },
        message: 'Rate limited',
      };
      const successResponse: AxiosResponse = {
        data: {
          choices: [{ message: { content: 'Success after retry' } }],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post
        .mockReturnValueOnce(throwError(() => rateLimitError))
        .mockReturnValueOnce(of(successResponse));

      const result = await service.chatCompletion([
        { role: 'user', content: 'Test' },
      ]);

      expect(result).toBe('Success after retry');
      expect(mockHttpService.post).toHaveBeenCalledTimes(2);
    });

    it('should retry on server error (5xx)', async () => {
      const serverError = {
        response: { status: 500 },
        message: 'Server error',
      };
      const successResponse: AxiosResponse = {
        data: {
          choices: [{ message: { content: 'Success' } }],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post
        .mockReturnValueOnce(throwError(() => serverError))
        .mockReturnValueOnce(of(successResponse));

      const result = await service.chatCompletion([
        { role: 'user', content: 'Test' },
      ]);

      expect(result).toBe('Success');
    });

    it('should eventually throw error on non-retryable errors', async () => {
      // Test that non-retryable errors are thrown immediately
      const clientError = {
        response: { status: 401 },
        message: 'Unauthorized',
      };

      mockHttpService.post.mockReturnValue(throwError(() => clientError));

      await expect(
        service.chatCompletion([{ role: 'user', content: 'Test' }]),
      ).rejects.toEqual(clientError);

      // Should only call once (no retries for 401)
      expect(mockHttpService.post).toHaveBeenCalledTimes(1);
    });

    it('should not retry on client error (4xx except 429)', async () => {
      const clientError = {
        response: { status: 400 },
        message: 'Bad request',
      };

      mockHttpService.post.mockReturnValue(throwError(() => clientError));

      await expect(
        service.chatCompletion([{ role: 'user', content: 'Test' }]),
      ).rejects.toEqual(clientError);

      expect(mockHttpService.post).toHaveBeenCalledTimes(1);
    });
  });
});
