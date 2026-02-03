'use client';

import { useEffect, useState } from 'react';
import { Link as LinkIcon, Github, MessageSquare, FileText, Check, X, Settings } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui';
import { SyncButton, SyncStatus } from '@/components/sync';
import { useWorkspaceStore } from '@/stores/workspace';
import { integrationApi } from '@/lib/api';
import type { Integration } from '@/types';

interface GitHubRepo {
  id: number;
  fullName: string;
  private: boolean;
}

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
}

const providers = [
  {
    id: 'github',
    name: 'GitHub',
    description: '연결 후 원하는 레포지토리를 선택하여 PR, 이슈, 커밋을 연동합니다',
    icon: Github,
    color: 'bg-gray-900',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: '채널 메시지와 대화를 연동합니다',
    icon: MessageSquare,
    color: 'bg-purple-600',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: '페이지와 데이터베이스를 연동합니다',
    icon: FileText,
    color: 'bg-gray-800',
  },
];

export default function ConnectionsPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [isSavingRepos, setIsSavingRepos] = useState(false);
  const [showChannelSelector, setShowChannelSelector] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [isSavingChannels, setIsSavingChannels] = useState(false);

  useEffect(() => {
    loadIntegrations();
  }, [currentWorkspace]);

  const loadIntegrations = async () => {
    if (!currentWorkspace) {
      setIntegrations([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await integrationApi.list(currentWorkspace.id);
      setIntegrations(res.data.integrations);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = (provider: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const token = localStorage.getItem('accessToken');
    if (!token) {
      alert('로그인이 필요합니다');
      return;
    }
    if (currentWorkspace) {
      window.location.href = `${baseUrl}/workspaces/${currentWorkspace.id}/integrations/${provider}/auth?token=${token}`;
    }
  };

  const handleDisconnect = async (provider: string) => {
    try {
      if (currentWorkspace) {
        await integrationApi.disconnect(currentWorkspace.id, provider);
      }
      await loadIntegrations();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const isConnected = (providerId: string) => {
    const integration = integrations.find((i) => i.provider === providerId);
    return integration?.connected || false;
  };

  const getGitHubIntegration = () => {
    return integrations.find((i) => i.provider === 'github');
  };

  const getSlackIntegration = () => {
    return integrations.find((i) => i.provider === 'slack');
  };

  const openRepoSelector = () => {
    const githubIntegration = getGitHubIntegration();
    if (githubIntegration?.config?.selectedRepos) {
      setSelectedRepos(githubIntegration.config.selectedRepos);
    } else {
      setSelectedRepos([]);
    }
    setShowRepoSelector(true);
  };

  const toggleRepo = (fullName: string) => {
    setSelectedRepos((prev) =>
      prev.includes(fullName)
        ? prev.filter((r) => r !== fullName)
        : [...prev, fullName]
    );
  };

  const saveSelectedRepos = async () => {
    if (!currentWorkspace) return;
    setIsSavingRepos(true);
    try {
      await integrationApi.updateConfig(currentWorkspace.id, 'github', {
        selectedRepos,
      });
      await loadIntegrations();
      setShowRepoSelector(false);
    } catch (error) {
      console.error('Failed to save repos:', error);
    } finally {
      setIsSavingRepos(false);
    }
  };

  const openChannelSelector = () => {
    const slackIntegration = getSlackIntegration();
    if (slackIntegration?.config?.selectedChannels) {
      setSelectedChannels(slackIntegration.config.selectedChannels);
    } else {
      setSelectedChannels([]);
    }
    setShowChannelSelector(true);
  };

  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    );
  };

  const saveSelectedChannels = async () => {
    if (!currentWorkspace) return;
    setIsSavingChannels(true);
    try {
      await integrationApi.updateConfig(currentWorkspace.id, 'slack', {
        selectedChannels,
      });
      await loadIntegrations();
      setShowChannelSelector(false);
    } catch (error) {
      console.error('Failed to save channels:', error);
    } finally {
      setIsSavingChannels(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <LinkIcon className="w-6 h-6" />
          <div>
            <h1 className="text-2xl font-bold">연결 관리</h1>
            <p className="text-gray-500">외부 서비스를 연결하여 컨텍스트를 수집하세요</p>
          </div>
        </div>

        {/* Sync Section */}
        {currentWorkspace && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>데이터 동기화</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    연결된 서비스에서 데이터를 가져옵니다
                  </p>
                </div>
                <SyncButton
                  workspaceId={currentWorkspace.id}
                  onSyncComplete={() => loadIntegrations()}
                />
              </div>
            </CardHeader>
            <CardContent>
              <SyncStatus workspaceId={currentWorkspace.id} />
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="space-y-4">
            {providers.map((provider) => {
              const connected = isConnected(provider.id);
              return (
                <Card key={provider.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${provider.color} text-white`}>
                        <provider.icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">
                            {provider.name}
                          </h3>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {provider.description}
                        </p>

                        {/* Connection Status */}
                        {currentWorkspace && (
                          <div className="mt-4">
                            <div className="flex items-center justify-between">
                              <div>
                                {provider.id === 'github' && connected && (
                                  <p className="text-xs text-gray-500">
                                    {getGitHubIntegration()?.config?.selectedRepos?.length || 0}개 레포지토리 선택됨
                                    {getGitHubIntegration()?.config?.selectedRepos?.length || 0}개 레포지토리 선택됨
                                  </p>
                                )}
                                {provider.id === 'slack' && connected && (
                                  <p className="text-xs text-gray-500">
                                    {getSlackIntegration()?.config?.selectedChannels?.length || 0}개 채널 선택됨
                                  </p>
                                )}
                              </div>
                              {connected ? (
                                <div className="flex items-center gap-2">
                                  {provider.id === 'github' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={openRepoSelector}
                                    >
                                      <Settings className="w-4 h-4 mr-1" />
                                      설정
                                    </Button>
                                  )}
                                  {provider.id === 'slack' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={openChannelSelector}
                                    >
                                      <Settings className="w-4 h-4 mr-1" />
                                      설정
                                    </Button>
                                  )}
                                  <Badge variant="success">
                                    <Check className="w-3 h-3 mr-1" />
                                    연결됨
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDisconnect(provider.id)}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleConnect(provider.id)}
                                >
                                  연결
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* GitHub Repository Selector Modal */}
        {showRepoSelector && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">동기화할 레포지토리 선택</h3>
                <p className="text-sm text-gray-500 mt-1">
                  선택한 레포지토리의 PR, 이슈, 커밋만 동기화됩니다
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {(() => {
                  const githubIntegration = getGitHubIntegration();
                  const availableRepos: GitHubRepo[] = githubIntegration?.config?.availableRepos || [];

                  if (availableRepos.length === 0) {
                    return (
                      <p className="text-gray-500 text-center py-8">
                        사용 가능한 레포지토리가 없습니다
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {availableRepos.map((repo) => (
                        <label
                          key={repo.id}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedRepos.includes(repo.fullName)}
                            onChange={() => toggleRepo(repo.fullName)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {repo.fullName}
                            </p>
                          </div>
                          {repo.private && (
                            <Badge variant="default">Private</Badge>
                          )}
                        </label>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div className="p-4 border-t flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  {selectedRepos.length}개 선택됨
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowRepoSelector(false)}
                  >
                    취소
                  </Button>
                  <Button
                    onClick={saveSelectedRepos}
                    disabled={isSavingRepos}
                  >
                    {isSavingRepos ? '저장 중...' : '저장'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Slack Channel Selector Modal */}
        {showChannelSelector && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">동기화할 채널 선택</h3>
                <p className="text-sm text-gray-500 mt-1">
                  선택한 채널의 메시지만 동기화됩니다
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {(() => {
                  const slackIntegration = getSlackIntegration();
                  const availableChannels: SlackChannel[] = slackIntegration?.config?.availableChannels || [];

                  if (availableChannels.length === 0) {
                    return (
                      <p className="text-gray-500 text-center py-8">
                        사용 가능한 채널이 없습니다
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {availableChannels.map((channel) => (
                        <label
                          key={channel.id}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedChannels.includes(channel.id)}
                            onChange={() => toggleChannel(channel.id)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              #{channel.name}
                            </p>
                          </div>
                          {channel.is_private && (
                            <Badge variant="default" className="bg-gray-500">Private</Badge>
                          )}
                        </label>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div className="p-4 border-t flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  {selectedChannels.length}개 선택됨
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowChannelSelector(false)}
                  >
                    취소
                  </Button>
                  <Button
                    onClick={saveSelectedChannels}
                    disabled={isSavingChannels}
                  >
                    {isSavingChannels ? '저장 중...' : '저장'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
