'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Filter, ExternalLink } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { useWorkspaceStore } from '@/stores/workspace';
import { searchApi } from '@/lib/api';
import { getSourceIcon, getSourceLabel } from '@/lib/utils';
import type { SearchResult } from '@/types';

const sourceFilters = [
  { value: '', label: '전체' },
  { value: 'github_pr', label: 'GitHub PR' },
  { value: 'github_issue', label: 'GitHub Issue' },
  { value: 'slack_message', label: 'Slack' },
  { value: 'notion_page', label: 'Notion' },
  { value: 'web_article', label: 'Web Article' },
];

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentWorkspace } = useWorkspaceStore();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [sourceFilter, setSourceFilter] = useState(searchParams.get('source') || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const q = searchParams.get('q');
    const source = searchParams.get('source') || '';
    if (q && currentWorkspace) {
      setQuery(q);
      setSourceFilter(source);
      handleSearchWithFilter(q, source);
    }
  }, [searchParams, currentWorkspace]);

  const handleSearchWithFilter = async (searchQuery: string, filter: string) => {
    if (!currentWorkspace || !searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const { data } = await searchApi.search(currentWorkspace.id, {
        query: searchQuery,
        sources: filter ? [filter] : undefined,
        limit: 20,
      });
      setResults(data.results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!currentWorkspace || !q.trim()) return;

    setIsSearching(true);
    try {
      const { data } = await searchApi.search(currentWorkspace.id, {
        query: q,
        sources: sourceFilter ? [sourceFilter] : undefined,
        limit: 20,
      });
      setResults(data.results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    // URL에 검색 쿼리 반영
    const params = new URLSearchParams();
    params.set('q', query.trim());
    if (sourceFilter) {
      params.set('source', sourceFilter);
    }
    router.push(`/search?${params.toString()}`, { scroll: false });

    handleSearch();
  };

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">
            워크스페이스를 선택하세요
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Search Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          무엇을 찾고 계신가요?
        </h1>
        <p className="text-gray-500 mt-2">
          {currentWorkspace.name}의 모든 컨텍스트를 검색하세요
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="키워드로 검색..."
            className="w-full px-5 py-4 pr-24 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Button
            type="submit"
            isLoading={isSearching}
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            검색
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <div className="flex gap-2 flex-wrap">
            {sourceFilters.map((filter) => (
              <button
                key={filter.value || 'all'}
                type="button"
                onClick={() => {
                  setSourceFilter(filter.value);
                  // 검색어가 있으면 필터 변경 시 URL 업데이트 및 재검색
                  if (query.trim()) {
                    const params = new URLSearchParams();
                    params.set('q', query.trim());
                    if (filter.value) {
                      params.set('source', filter.value);
                    }
                    router.push(`/search?${params.toString()}`, { scroll: false });
                    handleSearchWithFilter(query.trim(), filter.value);
                  }
                }}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  sourceFilter === filter.value
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </form>

      {/* Search Results */}
      {results.length > 0 && (() => {
        const uniqueResults = results.filter((result, index, self) =>
          self.findIndex(r => r.id === result.id) === index
        );
        return (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            {uniqueResults.length}개의 결과
          </p>
          {uniqueResults.map((result, index) => (
            <Card key={`${result.id}-${index}`} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <a
                  href={result.sourceUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">
                      {getSourceIcon(result.sourceType)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 truncate">
                          {result.title}
                        </h3>
                        <Badge variant="info">
                          {getSourceLabel(result.sourceType)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {result.snippet}
                      </p>
                      {result.sourceUrl && (
                        <p className="text-xs text-gray-400 mt-2 truncate">
                          {result.sourceUrl}
                        </p>
                      )}
                    </div>
                  </div>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
        );
      })()}

      {/* Empty State */}
      {!isSearching && results.length === 0 && query && (
        <div className="text-center py-12 text-gray-500">
          <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>검색 결과가 없습니다</p>
          <p className="text-sm mt-1">다른 키워드로 검색해보세요</p>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <AppLayout>
      <Suspense fallback={
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      }>
        <SearchContent />
      </Suspense>
    </AppLayout>
  );
}
