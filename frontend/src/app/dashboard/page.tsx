'use client';

import { useEffect, useState } from 'react';
import { FolderOpen, Search, Link as LinkIcon, Clock, Trash2, Plus, Users, User } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Modal } from '@/components/ui';
import { useWorkspaceStore } from '@/stores/workspace';
import { itemApi, integrationApi } from '@/lib/api';
import { getSourceIcon, getSourceLabel, formatRelativeTime } from '@/lib/utils';
import type { ContextItem } from '@/types';

export default function DashboardPage() {
  const { currentWorkspace, workspaces, isLoading: isLoadingWorkspaces, createWorkspace } = useWorkspaceStore();
  const [recentItems, setRecentItems] = useState<ContextItem[]>([]);
  const [connectedCount, setConnectedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceType, setNewWorkspaceType] = useState<'personal' | 'team'>('personal');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (currentWorkspace) {
      loadRecentItems();
      loadIntegrations();
    }
  }, [currentWorkspace]);

  const loadIntegrations = async () => {
    if (!currentWorkspace) return;
    try {
      const { data } = await integrationApi.list(currentWorkspace.id);
      const connected = data.integrations.filter((i: any) => i.connected).length; // eslint-disable-line @typescript-eslint/no-explicit-any
      setConnectedCount(connected);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    }
  };

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

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      setCreateError('워크스페이스 이름을 입력하세요');
      return;
    }

    setIsCreating(true);
    setCreateError('');

    try {
      await createWorkspace(newWorkspaceName.trim(), newWorkspaceType);
      setShowCreateModal(false);
      setNewWorkspaceName('');
      setNewWorkspaceType('personal');
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setCreateError(error.response?.data?.message || '워크스페이스 생성에 실패했습니다');
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCreating) {
      handleCreateWorkspace();
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
      value: connectedCount,
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
    // 워크스페이스가 전혀 없는 신규 사용자
    const hasNoWorkspaces = !isLoadingWorkspaces && workspaces.length === 0;

    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-md">
            {isLoadingWorkspaces ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            ) : hasNoWorkspaces ? (
              <>
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FolderOpen className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  환영합니다! 🎉
                </h2>
                <p className="text-gray-500 mt-2 mb-6">
                  Defrag를 시작하려면 워크스페이스를 만들어주세요.<br />
                  워크스페이스는 지식을 관리하는 공간입니다.
                </p>
                <Button onClick={() => setShowCreateModal(true)} size="lg">
                  <Plus className="w-5 h-5 mr-2" />
                  첫 워크스페이스 만들기
                </Button>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-gray-900">
                  워크스페이스를 선택하세요
                </h2>
                <p className="text-gray-500 mt-2">
                  사이드바에서 워크스페이스를 선택하거나 새로 만드세요
                </p>
              </>
            )}
          </div>
        </div>

        {/* Create Workspace Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setNewWorkspaceName('');
            setCreateError('');
          }}
          title="워크스페이스 만들기"
        >
          <div className="space-y-4">
            {createError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {createError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                워크스페이스 이름
              </label>
              <Input
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="예: 내 프로젝트"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                워크스페이스 유형
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNewWorkspaceType('personal')}
                  className={`p-4 border rounded-lg text-left transition-all ${
                    newWorkspaceType === 'personal'
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <User className={`w-5 h-5 mb-2 ${newWorkspaceType === 'personal' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <p className="font-medium text-gray-900">개인</p>
                  <p className="text-xs text-gray-500 mt-1">나만 사용</p>
                </button>
                <button
                  type="button"
                  onClick={() => setNewWorkspaceType('team')}
                  className={`p-4 border rounded-lg text-left transition-all ${
                    newWorkspaceType === 'team'
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Users className={`w-5 h-5 mb-2 ${newWorkspaceType === 'team' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <p className="font-medium text-gray-900">팀</p>
                  <p className="text-xs text-gray-500 mt-1">팀원과 함께</p>
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewWorkspaceName('');
                  setCreateError('');
                }}
                className="flex-1"
              >
                취소
              </Button>
              <Button
                onClick={handleCreateWorkspace}
                isLoading={isCreating}
                className="flex-1"
              >
                만들기
              </Button>
            </div>
          </div>
        </Modal>
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

      </div>
    </AppLayout>
  );
}
