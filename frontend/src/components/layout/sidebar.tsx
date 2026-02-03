'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Search,
  FolderOpen,
  Database,
  Settings,
  Users,
  Link as LinkIcon,
  LogOut,
  Plus,
  ChevronDown,
  MessageSquare,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { Modal } from '@/components/ui/modal';
import { Button, Input, Select } from '@/components/ui';

const navItems = [
  { href: '/dashboard', label: '대시보드', icon: FolderOpen },
  { href: '/items', label: '전체 아이템', icon: Database },
  { href: '/search', label: '검색', icon: Search },
  { href: '/conversations', label: 'AI 대화', icon: MessageSquare },
  { href: '/settings/connections', label: '연결 관리', icon: LinkIcon },
  { href: '/settings/members', label: '멤버 관리', icon: Users },
  { href: '/settings', label: '설정', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { workspaces, currentWorkspace, setCurrentWorkspace, createWorkspace } = useWorkspaceStore();
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceType, setNewWorkspaceType] = useState<'personal' | 'team'>('personal');
  const [isCreating, setIsCreating] = useState(false);
  const [nameError, setNameError] = useState('');

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      setNameError('워크스페이스 이름은 필수입니다');
      return;
    }
    setNameError('');
    setIsCreating(true);
    try {
      await createWorkspace(newWorkspaceName, newWorkspaceType);
      setShowCreateModal(false);
      setNewWorkspaceName('');
    } catch (error) {
      console.error('Failed to create workspace:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setNewWorkspaceName('');
    setNameError('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCreating) {
      handleCreateWorkspace();
    }
  };

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col h-screen">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-800">
        <h1 className="text-xl font-bold">Defrag</h1>
        <p className="text-xs text-gray-400 mt-1">컨텍스트 통합 플랫폼</p>
      </div>

      {/* Workspace Selector */}
      <div className="px-3 py-3 border-b border-gray-800">
        <div className="relative">
          <button
            onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <span className="truncate text-sm">
              {currentWorkspace?.name || '워크스페이스 선택'}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>

          {showWorkspaceDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-lg z-10 py-1">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    setCurrentWorkspace(ws);
                    setShowWorkspaceDropdown(false);
                  }}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors',
                    currentWorkspace?.id === ws.id && 'bg-gray-700'
                  )}
                >
                  <span className="truncate">{ws.name}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    {ws.type === 'personal' ? '개인' : '팀'}
                  </span>
                </button>
              ))}
              <button
                onClick={() => {
                  setShowWorkspaceDropdown(false);
                  setShowCreateModal(true);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors flex items-center gap-2 text-blue-400 border-t border-gray-700 mt-1 pt-2"
              >
                <Plus className="w-4 h-4" />
                새 워크스페이스
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          // /settings는 정확히 일치할 때만, 나머지는 하위 경로도 포함
          const isActive = item.href === '/settings'
            ? pathname === item.href
            : (pathname === item.href || pathname.startsWith(item.href + '/'));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="px-3 py-4 border-t border-gray-800">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
            {user?.nickname?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.nickname}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            title="로그아웃"
          >
            <LogOut className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Create Workspace Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={handleCloseCreateModal}
        title="새 워크스페이스"
      >
        <div className="space-y-4">
          <Input
            label="워크스페이스 이름"
            value={newWorkspaceName}
            onChange={(e) => {
              setNewWorkspaceName(e.target.value);
              if (nameError) setNameError('');
            }}
            onKeyDown={handleKeyDown}
            placeholder="내 프로젝트"
            error={nameError}
            autoFocus
          />
          <Select
            label="유형"
            value={newWorkspaceType}
            onChange={(e) => setNewWorkspaceType(e.target.value as 'personal' | 'team')}
            options={[
              { value: 'personal', label: '개인' },
              { value: 'team', label: '팀' },
            ]}
          />
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleCloseCreateModal}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              onClick={handleCreateWorkspace}
              isLoading={isCreating}
              className="flex-1"
            >
              생성
            </Button>
          </div>
        </div>
      </Modal>
    </aside>
  );
}
