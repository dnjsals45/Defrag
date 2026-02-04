'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Plus, Users, User, ArrowRight, FolderOpen, LinkIcon, Globe, Send, Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Modal, Skeleton } from '@/components/ui';
import { useWorkspaceStore } from '@/stores/workspace';
import { conversationApi, integrationApi, itemApi } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';

interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}


export default function DashboardPage() {
  const router = useRouter();
  const { currentWorkspace, workspaces, isLoading: isLoadingWorkspaces, createWorkspace } = useWorkspaceStore();
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  const [connectedCount, setConnectedCount] = useState(0);
  const [conversationCount, setConversationCount] = useState(0);
  const [itemCount, setItemCount] = useState(0);
  const [webArticleCount, setWebArticleCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceType, setNewWorkspaceType] = useState<'personal' | 'team'>('personal');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (currentWorkspace) {
      loadRecentConversations();
      loadIntegrations();
      loadItemCount();
    }
  }, [currentWorkspace]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const loadItemCount = async () => {
    if (!currentWorkspace) return;
    try {
      const { data } = await itemApi.list(currentWorkspace.id, { limit: 1 });
      setItemCount(data.total || data.items?.length || 0);

      // Load web article count
      const { data: webData } = await itemApi.list(currentWorkspace.id, { source: 'web_article', limit: 1 });
      setWebArticleCount(webData.total || webData.items?.length || 0);
    } catch (error) {
      console.error('Failed to load item count:', error);
    }
  };

  const loadRecentConversations = async () => {
    if (!currentWorkspace) return;
    try {
      const { data } = await conversationApi.list(currentWorkspace.id, { limit: 5 });
      setRecentConversations(data.conversations || []);
      setConversationCount(data.total || data.conversations?.length || 0);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = () => {
    router.push('/conversations');
  };

  const handleAskQuestion = async () => {
    if (!question.trim() || !currentWorkspace) return;
    // Navigate to conversations with the question as a query param
    router.push(`/conversations?q=${encodeURIComponent(question.trim())}`);
  };

  const handleQuestionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskQuestion();
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

  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCreating) {
      handleCreateWorkspace();
    }
  };

  const formatItemCount = (count: number) => {
    return count > 999 ? '999+' : count;
  };

  const stats = [
    {
      label: '전체 아이템',
      value: formatItemCount(itemCount),
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
      label: '웹 아티클',
      value: formatItemCount(webArticleCount),
      icon: Globe,
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
                onKeyDown={handleModalKeyDown}
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
                  className={`p-4 border rounded-lg text-left transition-all ${newWorkspaceType === 'personal'
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
                  className={`p-4 border rounded-lg text-left transition-all ${newWorkspaceType === 'team'
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
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-4 py-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            stats.map((stat) => (
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
            ))
          )}
        </div>

        {/* AI Conversations Card */}
        <Card>
          {/* Header with Ask AI */}
          <div className="p-6 border-b border-gray-100">
            <div className="text-center mb-4">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-gray-900">
                  {currentWorkspace.name}
                </h2>
              </div>
              <p className="text-sm text-gray-500">
                무엇이든 물어보세요. AI가 워크스페이스의 모든 지식을 검색해 답변합니다.
              </p>
            </div>
            <div className="flex gap-2 items-end">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleQuestionKeyDown}
                placeholder="예: 지난 주 회의에서 논의된 API 변경사항은?"
                className="flex-1 min-h-[42px] max-h-[120px] px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                rows={1}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                }}
              />
              <Button
                onClick={handleAskQuestion}
                disabled={!question.trim()}
                className="h-[42px]"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Recent Conversations */}
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-4 h-4" />
              최근 대화
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={handleNewConversation}>
              <Plus className="w-4 h-4 mr-1" />
              새 대화
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentConversations.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <p className="text-sm">아직 대화가 없습니다</p>
                <p className="text-xs mt-1">위에서 첫 질문을 시작해보세요</p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => router.push(`/conversations?id=${conv.id}`)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left group"
                  >
                    <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {conv.title || '새 대화'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatRelativeTime(conv.updatedAt)}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
                  </button>
                ))}
                {conversationCount > 5 && (
                  <Button
                    variant="ghost"
                    className="w-full text-sm text-gray-500 mt-2"
                    onClick={() => router.push('/conversations')}
                  >
                    모든 대화 보기 ({conversationCount}개)
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
