'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Mail,
  Clock,
  Shield,
  User,
  Check,
  X,
  CheckCheck,
  Database,
  RefreshCw,
  Info,
} from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { useNotificationStore } from '@/stores/notification';
import { useWorkspaceStore } from '@/stores/workspace';
import { formatDate } from '@/lib/utils';
import type { Notification, NotificationType } from '@/types';

const notificationIcons: Record<NotificationType, typeof Database> = {
  embedding_complete: Database,
  sync_complete: RefreshCw,
  system: Info,
};

const notificationLabels: Record<NotificationType, string> = {
  embedding_complete: '임베딩',
  sync_complete: '동기화',
  system: '시스템',
};

export default function NotificationsPage() {
  const router = useRouter();
  const {
    notifications,
    invitations,
    isLoading,
    loadAll,
    markAsRead,
    markAllAsRead,
    acceptInvitation,
    rejectInvitation,
  } = useNotificationStore();
  const { loadWorkspaces } = useWorkspaceStore();

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleAcceptInvitation = async (id: string) => {
    const result = await acceptInvitation(id);
    if (result) {
      await loadWorkspaces();
      router.push('/dashboard');
    }
  };

  const handleRejectInvitation = async (id: string) => {
    await rejectInvitation(id);
  };

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
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

  const unreadNotifications = notifications.filter((n) => !n.isRead);
  const hasUnread = unreadNotifications.length > 0;
  const totalCount = invitations.length + notifications.length;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6" />
            <div>
              <h1 className="text-2xl font-bold">알림</h1>
              <p className="text-gray-500">
                {totalCount > 0
                  ? `${invitations.length}개의 초대, ${notifications.length}개의 알림`
                  : '새로운 알림이 없습니다'}
              </p>
            </div>
          </div>

          {hasUnread && (
            <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
              <CheckCheck className="w-4 h-4 mr-1" />
              모두 읽음
            </Button>
          )}
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            </CardContent>
          </Card>
        ) : totalCount === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h2 className="text-lg font-semibold text-gray-900">
                알림이 없습니다
              </h2>
              <p className="text-gray-500 mt-2">
                새로운 알림이 오면 여기에 표시됩니다
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Invitations Section */}
            {invitations.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  워크스페이스 초대 ({invitations.length})
                </h2>
                <div className="space-y-3">
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
                              onClick={() => handleRejectInvitation(invitation.id)}
                            >
                              <X className="w-4 h-4 mr-1" />
                              거절
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleAcceptInvitation(invitation.id)}
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
              </div>
            )}

            {/* System Notifications Section */}
            {notifications.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  시스템 알림 ({notifications.length})
                </h2>
                <div className="space-y-3">
                  {notifications.map((notification) => {
                    const Icon = notificationIcons[notification.type] || Info;
                    const label = notificationLabels[notification.type] || '알림';

                    return (
                      <Card
                        key={notification.id}
                        className={notification.isRead ? 'opacity-60' : ''}
                      >
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between">
                            <div className="flex gap-3">
                              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <Icon className="w-5 h-5 text-blue-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-gray-900">
                                    {notification.title}
                                  </h3>
                                  <Badge variant="default">{label}</Badge>
                                  {!notification.isRead && (
                                    <span className="w-2 h-2 bg-blue-500 rounded-full" />
                                  )}
                                </div>

                                {notification.message && (
                                  <p className="text-sm text-gray-600 mb-2">
                                    {notification.message}
                                  </p>
                                )}

                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  {notification.workspace && (
                                    <span>{notification.workspace.name}</span>
                                  )}
                                  <span>{formatDate(notification.createdAt)}</span>
                                </div>
                              </div>
                            </div>

                            {!notification.isRead && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsRead(notification.id)}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
