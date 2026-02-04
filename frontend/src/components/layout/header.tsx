'use client';

import { Bell, Check, X, Shield, User, Database, RefreshCw, Info, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useNotificationStore } from '@/stores/notification';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { formatRelativeTime } from '@/lib/utils';
import type { NotificationType } from '@/types';

const notificationIcons: Record<NotificationType, typeof Database> = {
  embedding_complete: Database,
  sync_complete: RefreshCw,
  system: Info,
};

export function Header() {
  const router = useRouter();
  const {
    notifications,
    invitations,
    unreadCount,
    loadUnreadCount,
    loadAll,
    markAsRead,
    markAllAsRead,
    acceptInvitation,
    rejectInvitation,
    connectSSE,
    disconnectSSE,
  } = useNotificationStore();
  const { loadWorkspaces } = useWorkspaceStore();
  const { user } = useAuthStore();
  const [currentTime, setCurrentTime] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadUnreadCount();
    connectSSE();

    return () => {
      disconnectSSE();
    };
  }, [loadUnreadCount, connectSSE, disconnectSSE]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) {
      loadAll();
    }
    setIsOpen(!isOpen);
  };

  const handleAcceptInvitation = async (id: string) => {
    const result = await acceptInvitation(id);
    if (result) {
      await loadWorkspaces();
      setIsOpen(false);
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

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}:${seconds}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[today.getDay()];
    return `${year}년 ${month}월 ${day}일 (${weekday})`;
  };

  return (
    <header className="h-16 bg-gray-200 border-b border-gray-300 flex items-center justify-center px-6 relative">
      <div className="flex items-center gap-6">
        {/* 인사 + 날짜 */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <span className="text-base">👋</span>
            <p className="text-sm font-medium text-gray-800">
              안녕하세요, {user?.nickname || '사용자'}님!
            </p>
          </div>
          <p className="text-xs text-gray-500">{formatDate()}</p>
        </div>

        {/* 구분선 */}
        <div className="h-8 w-px bg-gray-300" />

        {/* 시간 */}
        <span className="text-xl font-semibold text-gray-700 tabular-nums">{currentTime}</span>
      </div>

      {/* Notification Bell & Dropdown */}
      <div className="absolute right-6" ref={dropdownRef}>
        <button
          onClick={handleToggle}
          className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-300 rounded-lg transition-colors"
          aria-label="알림"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-medium text-white bg-red-500 rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown Panel */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-900">알림</h3>
              {notifications.filter((n) => !n.isRead).length > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  모두 읽음
                </button>
              )}
            </div>

            {/* Content */}
            <div className="max-h-[400px] overflow-y-auto">
              {invitations.length === 0 && notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm text-gray-500">새로운 알림이 없습니다</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {/* Invitations */}
                  {invitations.map((invitation) => (
                    <div key={`inv-${invitation.id}`} className="px-4 py-3 hover:bg-gray-50">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
                          {invitation.role === 'ADMIN' ? (
                            <Shield className="w-4 h-4 text-blue-600" />
                          ) : (
                            <User className="w-4 h-4 text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {invitation.workspaceName}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {invitation.inviterNickname}님이 초대했습니다
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => handleAcceptInvitation(invitation.id)}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              수락
                            </button>
                            <button
                              onClick={() => handleRejectInvitation(invitation.id)}
                              className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-1"
                            >
                              <X className="w-3 h-3" />
                              거절
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* System Notifications */}
                  {notifications.map((notification) => {
                    const Icon = notificationIcons[notification.type] || Info;
                    return (
                      <div
                        key={`notif-${notification.id}`}
                        className={`px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                          notification.isRead ? 'opacity-60' : ''
                        }`}
                        onClick={() => !notification.isRead && handleMarkAsRead(notification.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
                            <Icon className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {notification.title}
                              </p>
                              {!notification.isRead && (
                                <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                              )}
                            </div>
                            {notification.message && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                {notification.message}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">
                              {formatRelativeTime(notification.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push('/notifications');
                }}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                전체 알림 보기
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
