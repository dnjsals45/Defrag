'use client';

import { useEffect, useState } from 'react';
import { Users, UserPlus, Shield, User, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Modal, Select } from '@/components/ui';
import { useWorkspaceStore } from '@/stores/workspace';
import { useAuthStore } from '@/stores/auth';
import { memberApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { WorkspaceMember } from '@/types';

export default function MembersPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const { user } = useAuthStore();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    if (currentWorkspace) {
      loadMembers();
    }
  }, [currentWorkspace]);

  const loadMembers = async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    try {
      const { data } = await memberApi.list(currentWorkspace.id);
      setMembers(data.members);
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!currentWorkspace || !inviteEmail.trim()) return;
    setIsInviting(true);
    setInviteError('');
    try {
      await memberApi.invite(currentWorkspace.id, {
        email: inviteEmail,
        role: inviteRole,
      });
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('MEMBER');
      alert('초대가 발송되었습니다');
    } catch (error: any) {
      setInviteError(error.response?.data?.message || '초대에 실패했습니다');
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    if (!currentWorkspace) return;
    try {
      await memberApi.updateRole(currentWorkspace.id, userId, { role });
      await loadMembers();
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!currentWorkspace) return;
    if (!confirm('정말 이 멤버를 제거하시겠습니까?')) return;
    try {
      await memberApi.remove(currentWorkspace.id, userId);
      await loadMembers();
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const isAdmin = members.find((m) => m.userId === user?.id)?.role === 'ADMIN';

  if (!currentWorkspace) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">워크스페이스를 선택하세요</p>
        </div>
      </AppLayout>
    );
  }

  if (currentWorkspace.type === 'personal') {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h2 className="text-lg font-semibold text-gray-900">개인 워크스페이스</h2>
              <p className="text-gray-500 mt-2">
                멤버 관리는 팀 워크스페이스에서만 사용할 수 있습니다
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6" />
            <div>
              <h1 className="text-2xl font-bold">멤버 관리</h1>
              <p className="text-gray-500">{members.length}명의 멤버</p>
            </div>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowInviteModal(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              멤버 초대
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="py-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : (
              <div className="divide-y">
                {members.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between py-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        {member.nickname.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">
                            {member.nickname}
                          </p>
                          {member.role === 'ADMIN' && (
                            <Badge variant="info">
                              <Shield className="w-3 h-3 mr-1" />
                              관리자
                            </Badge>
                          )}
                          {member.userId === user?.id && (
                            <Badge variant="default">나</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{member.email}</p>
                      </div>
                    </div>

                    {isAdmin && member.userId !== user?.id && (
                      <div className="flex items-center gap-2">
                        <Select
                          value={member.role}
                          onChange={(e) =>
                            handleUpdateRole(member.userId, e.target.value)
                          }
                          options={[
                            { value: 'MEMBER', label: '멤버' },
                            { value: 'ADMIN', label: '관리자' },
                          ]}
                          className="w-28"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(member.userId)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invite Modal */}
        <Modal
          isOpen={showInviteModal}
          onClose={() => {
            setShowInviteModal(false);
            setInviteError('');
          }}
          title="멤버 초대"
        >
          <div className="space-y-4">
            {inviteError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {inviteError}
              </div>
            )}
            <Input
              label="이메일"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="member@example.com"
            />
            <Select
              label="역할"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              options={[
                { value: 'MEMBER', label: '멤버' },
                { value: 'ADMIN', label: '관리자' },
              ]}
            />
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowInviteModal(false)}
                className="flex-1"
              >
                취소
              </Button>
              <Button
                onClick={handleInvite}
                isLoading={isInviting}
                className="flex-1"
              >
                초대
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}
