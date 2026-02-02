import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SearchService } from './search.service';
import { ContextItem, SourceType } from '../database/entities/context-item.entity';
import { VectorData } from '../database/entities/vector-data.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { LLMService } from '../llm/llm.service';

describe('SearchService', () => {
  let service: SearchService;
  let itemsRepository: Repository<ContextItem>;
  let workspacesService: WorkspacesService;
  let embeddingService: EmbeddingService;
  let llmService: LLMService;
  let dataSource: DataSource;

  const mockItemsRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockVectorRepository = {};

  const mockWorkspacesService = {
    checkAccess: jest.fn(),
  };

  const mockEmbeddingService = {
    generateEmbedding: jest.fn(),
  };

  const mockLLMService = {
    generateAnswer: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockDataSource = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: getRepositoryToken(ContextItem), useValue: mockItemsRepository },
        { provide: getRepositoryToken(VectorData), useValue: mockVectorRepository },
        { provide: WorkspacesService, useValue: mockWorkspacesService },
        { provide: EmbeddingService, useValue: mockEmbeddingService },
        { provide: LLMService, useValue: mockLLMService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    itemsRepository = module.get<Repository<ContextItem>>(
      getRepositoryToken(ContextItem),
    );
    workspacesService = module.get<WorkspacesService>(WorkspacesService);
    embeddingService = module.get<EmbeddingService>(EmbeddingService);
    llmService = module.get<LLMService>(LLMService);
    dataSource = module.get<DataSource>(DataSource);

    jest.clearAllMocks();
  });

  describe('search', () => {
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    beforeEach(() => {
      mockWorkspacesService.checkAccess.mockResolvedValue({ id: 'member-1' });
      mockItemsRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    });

    it('should throw ForbiddenException when user has no access', async () => {
      mockWorkspacesService.checkAccess.mockResolvedValue(null);

      await expect(
        service.search('ws-1', 'user-1', { query: 'test' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should perform vector search when embedding succeeds', async () => {
      const mockEmbedding = Array(1536).fill(0.1);
      const mockVectorResults = [
        {
          id: '1',
          title: 'Test Item',
          content: 'Test content with query match',
          source_type: SourceType.GITHUB_ISSUE,
          source_url: 'https://github.com/test',
          distance: 0.2,
        },
      ];

      mockEmbeddingService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockDataSource.query.mockResolvedValue(mockVectorResults);

      const result = await service.search('ws-1', 'user-1', { query: 'test' });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].score).toBe(0.8); // 1 - 0.2 distance
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('test');
    });

    it('should filter by sources when specified', async () => {
      const mockEmbedding = Array(1536).fill(0.1);
      const mockVectorResults = [
        {
          id: '1',
          title: 'GitHub Item',
          content: 'Content',
          source_type: SourceType.GITHUB_ISSUE,
          source_url: 'https://github.com/test',
          distance: 0.2,
        },
        {
          id: '2',
          title: 'Slack Item',
          content: 'Content',
          source_type: SourceType.SLACK_MESSAGE,
          source_url: null,
          distance: 0.3,
        },
      ];

      mockEmbeddingService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockDataSource.query.mockResolvedValue(mockVectorResults);

      const result = await service.search('ws-1', 'user-1', {
        query: 'test',
        sources: [SourceType.GITHUB_ISSUE],
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].sourceType).toBe(SourceType.GITHUB_ISSUE);
    });

    it('should fallback to text search when embedding fails', async () => {
      const mockItems = [
        {
          id: '1',
          title: 'Test Item',
          content: 'Test content',
          sourceType: SourceType.NOTION_PAGE,
          sourceUrl: 'https://notion.so/test',
        },
      ];

      mockEmbeddingService.generateEmbedding.mockRejectedValue(
        new Error('API error'),
      );
      mockQueryBuilder.getMany.mockResolvedValue(mockItems);

      const result = await service.search('ws-1', 'user-1', { query: 'test' });

      expect(result.results).toHaveLength(1);
      expect(mockItemsRepository.createQueryBuilder).toHaveBeenCalled();
    });

    it('should fallback to text search when vector search returns empty', async () => {
      const mockItems = [
        {
          id: '1',
          title: 'Test Item',
          content: 'Test content',
          sourceType: SourceType.NOTION_PAGE,
          sourceUrl: 'https://notion.so/test',
        },
      ];

      mockEmbeddingService.generateEmbedding.mockResolvedValue(
        Array(1536).fill(0.1),
      );
      mockDataSource.query.mockResolvedValue([]);
      mockQueryBuilder.getMany.mockResolvedValue(mockItems);

      const result = await service.search('ws-1', 'user-1', { query: 'test' });

      expect(result.results).toHaveLength(1);
    });

    it('should respect limit parameter', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue(
        Array(1536).fill(0.1),
      );
      mockDataSource.query.mockResolvedValue([]);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.search('ws-1', 'user-1', { query: 'test', limit: 5 });

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);
    });
  });

  describe('ask', () => {
    beforeEach(() => {
      mockWorkspacesService.checkAccess.mockResolvedValue({ id: 'member-1' });
      mockEmbeddingService.generateEmbedding.mockResolvedValue(
        Array(1536).fill(0.1),
      );
    });

    it('should generate AI answer with context', async () => {
      const mockVectorResults = [
        {
          id: '1',
          title: 'Related Doc',
          content: 'Relevant information about the topic',
          source_type: SourceType.NOTION_PAGE,
          source_url: 'https://notion.so/test',
          distance: 0.2,
        },
      ];

      mockDataSource.query.mockResolvedValue(mockVectorResults);
      mockLLMService.generateAnswer.mockResolvedValue(
        'Here is the answer based on your docs.',
      );

      const result = await service.ask('ws-1', 'user-1', {
        question: 'What is this about?',
      });

      expect(result.answer).toBe('Here is the answer based on your docs.');
      expect(result.sources).toHaveLength(1);
      expect(mockLLMService.generateAnswer).toHaveBeenCalledWith(
        'What is this about?',
        expect.stringContaining('Related Doc'),
      );
    });

    it('should not include sources when includeContext is false', async () => {
      mockDataSource.query.mockResolvedValue([]);
      mockLLMService.generateAnswer.mockResolvedValue('Answer');

      const result = await service.ask('ws-1', 'user-1', {
        question: 'Test?',
        includeContext: false,
      });

      expect(result.sources).toBeUndefined();
    });

    it('should return error message when LLM fails', async () => {
      mockDataSource.query.mockResolvedValue([
        {
          id: '1',
          title: 'Doc',
          content: 'Content',
          source_type: SourceType.NOTION_PAGE,
          source_url: null,
          distance: 0.2,
        },
      ]);
      mockLLMService.generateAnswer.mockRejectedValue(new Error('LLM error'));

      const result = await service.ask('ws-1', 'user-1', {
        question: 'Test?',
      });

      expect(result.answer).toContain('오류가 발생했습니다');
    });
  });

  describe('vectorSearch', () => {
    it('should execute pgvector similarity search', async () => {
      const mockEmbedding = Array(1536).fill(0.1);
      const mockResults = [{ id: '1', distance: 0.2 }];

      mockDataSource.query.mockResolvedValue(mockResults);

      const result = await service.vectorSearch('ws-1', mockEmbedding, 10);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining([
          expect.stringContaining('['),
          'ws-1',
          10,
        ]),
      );
      expect(result).toEqual(mockResults);
    });
  });
});
