'use client';

import { useEffect, useState } from 'react';
import { Link as LinkIcon, Github, MessageSquare, FileText, Check, X } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui';
import { SyncButton, SyncStatus } from '@/components/sync';
import { useWorkspaceStore } from '@/stores/workspace';
import { connectionApi, integrationApi } from '@/lib/api';
import type { Connection, Integration } from '@/types';

const providers = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'PR, 이슈, 커밋 등의 활동을 연동합니다',
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
  const [connections, setConnections] = useState<Connection[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConnections();
  }, [currentWorkspace]);

  const loadConnections = async () => {
    setIsLoading(true);
    try {
      const [connRes, intRes] = await Promise.all([
        connectionApi.list(),
        currentWorkspace
          ? integrationApi.list(currentWorkspace.id)
          : Promise.resolve({ data: { integrations: [] } }),
      ]);
      setConnections(connRes.data.connections);
      setIntegrations(intRes.data.integrations);
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = (provider: string, type: 'personal' | 'workspace') => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    if (type === 'personal') {
      window.location.href = `${baseUrl}/connections/${provider}/auth`;
    } else if (currentWorkspace) {
      window.location.href = `${baseUrl}/workspaces/${currentWorkspace.id}/integrations/${provider}/auth`;
    }
  };

  const handleDisconnect = async (provider: string, type: 'personal' | 'workspace') => {
    try {
      if (type === 'personal') {
        await connectionApi.disconnect(provider);
      } else if (currentWorkspace) {
        await integrationApi.disconnect(currentWorkspace.id, provider);
      }
      await loadConnections();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const getConnectionStatus = (providerId: string) => {
    const connection = connections.find((c) => c.provider === providerId);
    const integration = integrations.find((i) => i.provider === providerId);
    return {
      personal: connection?.connected || false,
      workspace: integration?.connected || false,
    };
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
                  onSyncComplete={() => loadConnections()}
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
              const status = getConnectionStatus(provider.id);
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
                        <div className="mt-4 space-y-3">
                          {/* Personal Connection */}
                          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium">개인 연결</p>
                              <p className="text-xs text-gray-500">
                                내 개인 활동 수집
                              </p>
                            </div>
                            {status.personal ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="success">
                                  <Check className="w-3 h-3 mr-1" />
                                  연결됨
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDisconnect(provider.id, 'personal')}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleConnect(provider.id, 'personal')}
                              >
                                연결
                              </Button>
                            )}
                          </div>

                          {/* Workspace Integration */}
                          {currentWorkspace && currentWorkspace.type === 'team' && (
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div>
                                <p className="text-sm font-medium">팀 연동</p>
                                <p className="text-xs text-gray-500">
                                  팀 전체 활동 수집
                                </p>
                              </div>
                              {status.workspace ? (
                                <div className="flex items-center gap-2">
                                  <Badge variant="success">
                                    <Check className="w-3 h-3 mr-1" />
                                    연결됨
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDisconnect(provider.id, 'workspace')}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleConnect(provider.id, 'workspace')}
                                >
                                  연결
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
