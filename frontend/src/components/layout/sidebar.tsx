'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
import { useState, useRef, useEffect } from 'react';
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
  { href: '/settings/connections', label: '연결 관리', icon: LinkIcon, adminOnly: true },
  { href: '/settings/members', label: '멤버 관리', icon: Users, teamOnly: true },
  { href: '/settings', label: '설정', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { workspaces, currentWorkspace, setCurrentWorkspace, createWorkspace } = useWorkspaceStore();
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceType, setNewWorkspaceType] = useState<'personal' | 'team'>('personal');
  const [isCreating, setIsCreating] = useState(false);
  const [nameError, setNameError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowWorkspaceDropdown(false);
      }
    };

    if (showWorkspaceDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showWorkspaceDropdown]);

  const handleCreateWorkspace = async () => {
    const trimmedName = newWorkspaceName.trim();
    if (!trimmedName) {
      setNameError('워크스페이스 이름은 필수입니다');
      return;
    }

    // 프론트엔드 중복 검증
    const isDuplicate = workspaces.some(
      (ws) => ws.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      setNameError('이미 같은 이름의 워크스페이스가 존재합니다');
      return;
    }

    setNameError('');
    setIsCreating(true);
    try {
      await createWorkspace(trimmedName, newWorkspaceType);
      setShowCreateModal(false);
      setNewWorkspaceName('');
    } catch (error: any) {
      // 백엔드 에러 메시지 처리
      const message = error?.response?.data?.message || '워크스페이스 생성에 실패했습니다';
      setNameError(message);
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
        <div className="relative" ref={dropdownRef}>
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
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-lg z-10 py-1 max-h-64 overflow-y-auto">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    setCurrentWorkspace(ws);
                    setShowWorkspaceDropdown(false);
                    // 워크스페이스 변경 시 대시보드로 이동 (권한 문제 방지)
                    router.push('/dashboard');
                  }}
                  className={cn(
                    'w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors',
                    currentWorkspace?.id === ws.id && 'bg-gray-700'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm truncate flex-1">{ws.name}</span>
                    <span className={cn(
                      'text-xs px-1.5 py-0.5 rounded ml-2',
                      ws.type === 'personal'
                        ? 'bg-gray-600 text-gray-300'
                        : 'bg-blue-600 text-blue-100'
                    )}>
                      {ws.type === 'personal' ? '개인' : '팀'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {ws.type === 'team' && `${ws.memberCount}명 · `}
                    {ws.role === 'ADMIN' ? '관리자' : '멤버'}
                  </div>
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
        {navItems
          .filter((item) => {
            // adminOnly: ADMIN 역할만 볼 수 있음
            if (item.adminOnly && currentWorkspace?.role !== 'ADMIN') {
              return false;
            }
            // teamOnly: 팀 워크스페이스에서만 볼 수 있음
            if (item.teamOnly && currentWorkspace?.type !== 'team') {
              return false;
            }
            return true;
          })
          .map((item) => {
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
