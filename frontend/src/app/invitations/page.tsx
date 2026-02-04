'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Clock, Shield, User, Check, X } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { useInvitationStore } from '@/stores/invitation';
import { useWorkspaceStore } from '@/stores/workspace';
import { formatDate } from '@/lib/utils';

export default function InvitationsPage() {
  const router = useRouter();
  const { invitations, isLoading, loadInvitations, accept, reject } =
    useInvitationStore();
  const { loadWorkspaces, setCurrentWorkspace } = useWorkspaceStore();

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  const handleAccept = async (id: string) => {
    const result = await accept(id);
    if (result) {
      // Reload workspaces and switch to the new one
      await loadWorkspaces();
      router.push('/dashboard');
    }
  };

  const handleReject = async (id: string) => {
    await reject(id);
  };

  const formatExpiryDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return '만료됨';
    } else if (diffDays === 1) {
      return '1일 후 만료';
    } else {
      return `${diffDays}일 후 만료`;
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Mail className="w-6 h-6" />
          <div>
            <h1 className="text-2xl font-bold">받은 초대</h1>
            <p className="text-gray-500">
              {invitations.length > 0
                ? `${invitations.length}개의 대기 중인 초대가 있습니다`
                : '대기 중인 초대가 없습니다'}
            </p>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            </CardContent>
          </Card>
        ) : invitations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h2 className="text-lg font-semibold text-gray-900">
                받은 초대가 없습니다
              </h2>
              <p className="text-gray-500 mt-2">
                다른 워크스페이스에서 초대를 받으면 여기에 표시됩니다
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {invitations.map((invitation) => (
              <Card key={invitation.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {invitation.workspaceName}
                        </h3>
                        <Badge
                          variant={
                            invitation.role === 'ADMIN' ? 'info' : 'default'
                          }
                        >
                          {invitation.role === 'ADMIN' ? (
                            <>
                              <Shield className="w-3 h-3 mr-1" />
                              관리자
                            </>
                          ) : (
                            <>
                              <User className="w-3 h-3 mr-1" />
                              멤버
                            </>
                          )}
                        </Badge>
                      </div>

                      <p className="text-sm text-gray-600 mb-3">
                        <span className="font-medium">
                          {invitation.inviterNickname}
                        </span>
                        님이 초대했습니다
                      </p>

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatExpiryDate(invitation.expiresAt)}
                        </span>
                        <span>
                          받은 날짜: {formatDate(invitation.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReject(invitation.id)}
                      >
                        <X className="w-4 h-4 mr-1" />
                        거절
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAccept(invitation.id)}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        수락
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
