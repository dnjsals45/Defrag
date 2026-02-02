import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { EmbeddingService } from './embedding.service';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
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
        EmbeddingService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
    httpService = module.get<HttpService>(HttpService);
    jest.clearAllMocks();
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for single text', async () => {
      const mockEmbedding = Array(1536).fill(0.1);
      const mockResponse: AxiosResponse = {
        data: {
          object: 'list',
          data: [{ object: 'embedding', embedding: mockEmbedding, index: 0 }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 10, total_tokens: 10 },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.generateEmbedding('Test text');

      expect(result).toEqual(mockEmbedding);
      expect(result.length).toBe(1536);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          input: ['Test text'],
          model: 'text-embedding-3-small',
          dimensions: 1536,
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        }),
      );
    });

    it('should truncate long text', async () => {
      const longText = 'a'.repeat(50000);
      const mockEmbedding = Array(1536).fill(0.1);
      const mockResponse: AxiosResponse = {
        data: {
          data: [{ embedding: mockEmbedding, index: 0 }],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      await service.generateEmbedding(longText);

      const postCall = mockHttpService.post.mock.calls[0];
      const inputText = postCall[1].input[0];
      expect(inputText.length).toBeLessThanOrEqual(32000); // 8000 tokens * 4 chars
    });
  });

  describe('generateEmbeddings', () => {
    it('should generate embeddings for multiple texts', async () => {
      const mockEmbeddings = [
        Array(1536).fill(0.1),
        Array(1536).fill(0.2),
        Array(1536).fill(0.3),
      ];
      const mockResponse: AxiosResponse = {
        data: {
          data: [
            { embedding: mockEmbeddings[0], index: 0 },
            { embedding: mockEmbeddings[1], index: 1 },
            { embedding: mockEmbeddings[2], index: 2 },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.generateEmbeddings([
        'Text 1',
        'Text 2',
        'Text 3',
      ]);

      expect(result).toEqual(mockEmbeddings);
      expect(result.length).toBe(3);
    });

    it('should return sorted embeddings by index', async () => {
      const mockEmbeddings = [
        Array(1536).fill(0.1),
        Array(1536).fill(0.2),
      ];
      const mockResponse: AxiosResponse = {
        data: {
          data: [
            { embedding: mockEmbeddings[1], index: 1 },
            { embedding: mockEmbeddings[0], index: 0 },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.generateEmbeddings(['Text 1', 'Text 2']);

      expect(result[0]).toEqual(mockEmbeddings[0]);
      expect(result[1]).toEqual(mockEmbeddings[1]);
    });

    it('should return empty array for empty input', async () => {
      const result = await service.generateEmbeddings([]);
      expect(result).toEqual([]);
      expect(mockHttpService.post).not.toHaveBeenCalled();
    });

    it('should throw error for batch size over 100', async () => {
      const texts = Array(101).fill('Test');
      await expect(service.generateEmbeddings(texts)).rejects.toThrow(
        'Maximum batch size is 100 texts per request',
      );
    });
  });

  describe('retry logic', () => {
    it('should retry on rate limit error (429)', async () => {
      const rateLimitError = {
        response: { status: 429 },
        message: 'Rate limited',
      };
      const mockEmbedding = Array(1536).fill(0.1);
      const successResponse: AxiosResponse = {
        data: {
          data: [{ embedding: mockEmbedding, index: 0 }],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post
        .mockReturnValueOnce(throwError(() => rateLimitError))
        .mockReturnValueOnce(of(successResponse));

      const result = await service.generateEmbedding('Test');

      expect(result).toEqual(mockEmbedding);
      expect(mockHttpService.post).toHaveBeenCalledTimes(2);
    });

    it('should retry on server error (5xx)', async () => {
      const serverError = {
        response: { status: 503 },
        message: 'Service unavailable',
      };
      const mockEmbedding = Array(1536).fill(0.1);
      const successResponse: AxiosResponse = {
        data: {
          data: [{ embedding: mockEmbedding, index: 0 }],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post
        .mockReturnValueOnce(throwError(() => serverError))
        .mockReturnValueOnce(of(successResponse));

      const result = await service.generateEmbedding('Test');

      expect(result).toEqual(mockEmbedding);
    });

    it('should not retry on client error (4xx except 429)', async () => {
      const clientError = {
        response: { status: 400 },
        message: 'Bad request',
      };

      mockHttpService.post.mockReturnValue(throwError(() => clientError));

      await expect(service.generateEmbedding('Test')).rejects.toEqual(
        clientError,
      );
      expect(mockHttpService.post).toHaveBeenCalledTimes(1);
    });
  });
});
