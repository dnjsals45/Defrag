'use client';

import { useEffect, useState } from 'react';
import { FolderOpen, Search, Link as LinkIcon, Clock, Plus, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui';
import { useWorkspaceStore } from '@/stores/workspace';
import { itemApi } from '@/lib/api';
import { getSourceIcon, getSourceLabel, formatRelativeTime } from '@/lib/utils';
import type { ContextItem } from '@/types';

export default function DashboardPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const [recentItems, setRecentItems] = useState<ContextItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddUrl, setShowAddUrl] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [isAddingUrl, setIsAddingUrl] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      loadRecentItems();
    }
  }, [currentWorkspace]);

  const loadRecentItems = async () => {
    if (!currentWorkspace) return;
    try {
      const { data } = await itemApi.list(currentWorkspace.id, { limit: 10 });
      setRecentItems(data.items);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUrl = async () => {
    if (!currentWorkspace || !newUrl.trim()) return;
    setIsAddingUrl(true);
    try {
      await itemApi.create(currentWorkspace.id, { url: newUrl });
      setNewUrl('');
      setShowAddUrl(false);
      loadRecentItems();
    } catch (error) {
      console.error('Failed to add URL:', error);
    } finally {
      setIsAddingUrl(false);
    }
  };

  const handleDeleteItem = async (e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentWorkspace) return;
    if (!confirm('이 아티클을 삭제하시겠습니까?')) return;

    try {
      await itemApi.delete(currentWorkspace.id, itemId);
      setRecentItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const stats = [
    {
      label: '전체 아이템',
      value: recentItems.length,
      icon: FolderOpen,
      color: 'text-blue-600 bg-blue-100',
    },
    {
      label: '연결된 서비스',
      value: 0,
      icon: LinkIcon,
      color: 'text-green-600 bg-green-100',
    },
    {
      label: '이번 주 검색',
      value: 0,
      icon: Search,
      color: 'text-purple-600 bg-purple-100',
    },
  ];

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
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {currentWorkspace.name}
            </h1>
            <p className="text-gray-500 mt-1">
              {currentWorkspace.type === 'personal' ? '개인' : '팀'} 워크스페이스
            </p>
          </div>
          <Button onClick={() => setShowAddUrl(true)}>
            <Plus className="w-4 h-4 mr-2" />
            아티클 추가
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              최근 아이템
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : recentItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>아직 저장된 아이템이 없습니다</p>
                <p className="text-sm mt-1">
                  외부 서비스를 연결하거나 웹 아티클을 추가해보세요
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <a
                      href={item.sourceUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 flex-1 min-w-0"
                    >
                      <span className="text-xl">{getSourceIcon(item.sourceType)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {item.title || '제목 없음'}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {item.snippet}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {getSourceLabel(item.sourceType)} · {formatRelativeTime(item.createdAt)}
                        </p>
                      </div>
                    </a>
                    <button
                      onClick={(e) => handleDeleteItem(e, item.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add URL Modal */}
        {showAddUrl && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-lg font-semibold mb-4">웹 아티클 추가</h2>
              <Input
                label="URL"
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/article"
              />
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAddUrl(false)}
                  className="flex-1"
                >
                  취소
                </Button>
                <Button
                  onClick={handleAddUrl}
                  isLoading={isAddingUrl}
                  className="flex-1"
                >
                  추가
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
