'use client';

import { useEffect, useState } from 'react';
import { Database, Search, Check, X, Trash2, RefreshCw } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@/components/ui';
import { useWorkspaceStore } from '@/stores/workspace';
import { itemApi } from '@/lib/api';
import { getSourceIcon, getSourceLabel, formatRelativeTime } from '@/lib/utils';

interface Item {
  id: string;
  title: string;
  sourceType: string;
  sourceUrl: string;
  createdAt: string;
  snippet: string;
  hasEmbedding: boolean;
}

const SOURCE_FILTERS = [
  { value: '', label: '전체' },
  { value: 'github_pr', label: 'GitHub PR' },
  { value: 'github_issue', label: 'GitHub Issue' },
  { value: 'github_commit', label: 'GitHub Commit' },
  { value: 'slack_message', label: 'Slack' },
  { value: 'notion_page', label: 'Notion' },
  { value: 'web_article', label: '웹 아티클' },
];

export default function ItemsPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const limit = 20;

  useEffect(() => {
    if (currentWorkspace) {
      loadItems();
    }
  }, [currentWorkspace, page, sourceFilter]);

  const loadItems = async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    try {
      const { data } = await itemApi.list(currentWorkspace.id, {
        page,
        limit,
        source: sourceFilter || undefined,
        q: searchQuery || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadItems();
  };

  const handleSync = async () => {
    if (!currentWorkspace) return;
    setIsSyncing(true);
    try {
      await itemApi.sync(currentWorkspace.id, { syncType: 'full' });
      // Reload after a delay to allow sync to start
      setTimeout(() => {
        loadItems();
        setIsSyncing(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to trigger sync:', error);
      setIsSyncing(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!currentWorkspace) return;
    if (!confirm('이 아이템을 삭제하시겠습니까?')) return;

    try {
      await itemApi.delete(currentWorkspace.id, itemId);
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      setTotal((prev) => prev - 1);
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const embeddedCount = items.filter((item) => item.hasEmbedding).length;

  if (!currentWorkspace) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900">
              워크스페이스를 선택하세요
            </h2>
            <p className="text-gray-500 mt-2">
              사이드바에서 워크스페이스를 선택하거나 새로 만드세요
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6" />
            <div>
              <h1 className="text-2xl font-bold">전체 아이템</h1>
              <p className="text-gray-500">
                총 {total}개 아이템 · 현재 페이지 {embeddedCount}/{items.length}개 임베딩 완료
              </p>
            </div>
          </div>
          <Button onClick={handleSync} disabled={isSyncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? '동기화 중...' : '전체 동기화'}
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                <Input
                  placeholder="제목 또는 내용 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" variant="outline">
                  <Search className="w-4 h-4" />
                </Button>
              </form>
              <select
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SOURCE_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Items List */}
        <Card>
          <CardHeader>
            <CardTitle>아이템 목록</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Database className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>아이템이 없습니다</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium text-gray-500">제목</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-500 w-32">소스</th>
                      <th className="text-center py-3 px-2 font-medium text-gray-500 w-24">임베딩</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-500 w-32">생성일</th>
                      <th className="text-center py-3 px-2 font-medium text-gray-500 w-16">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-2">
                          <a
                            href={item.sourceUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 hover:text-blue-600"
                          >
                            <span className="text-lg">{getSourceIcon(item.sourceType)}</span>
                            <span className="truncate max-w-md">{item.title || '제목 없음'}</span>
                          </a>
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant="default" className="text-xs">
                            {getSourceLabel(item.sourceType)}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-center">
                          {item.hasEmbedding ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-600 rounded-full">
                              <Check className="w-4 h-4" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 text-gray-400 rounded-full">
                              <X className="w-4 h-4" />
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-500">
                          {formatRelativeTime(item.createdAt)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">
                  {total}개 중 {(page - 1) * limit + 1}-{Math.min(page * limit, total)}개 표시
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    이전
                  </Button>
                  <span className="px-3 py-1.5 text-sm">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    다음
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
