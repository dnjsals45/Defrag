'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  FolderOpen,
  Database,
  Search,
  MessageSquare,
  Link as LinkIcon,
  Users,
  Settings,
  LogOut,
  ChevronDown,
  Plus,
  User,
  X,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { useUIStore } from '@/stores/ui';
import { createWorkspaceSchema, type CreateWorkspaceForm } from '@/lib/schemas';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';
import { Button, Input } from '@/components/ui';
import { AnimatePresence, motion } from 'framer-motion';

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
  const { isMobileSidebarOpen, closeMobileSidebar } = useUIStore();

  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkspaceForm>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: {
      name: '',
      type: 'personal',
    },
  });

  const workspaceType = watch('type');

  // Close sidebar on route change (mobile)
  useEffect(() => {
    closeMobileSidebar();
  }, [pathname, closeMobileSidebar]);

  // Handle click outside for workspace dropdown
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

  const onSubmit = async (data: CreateWorkspaceForm) => {
    const isDuplicate = workspaces.some(
      (ws) => ws.name.toLowerCase() === data.name.trim().toLowerCase()
    );
    if (isDuplicate) {
      toast.error('이미 같은 이름의 워크스페이스가 존재합니다');
      return;
    }

    try {
      await createWorkspace(data.name.trim(), data.type);
      toast.success('새 워크스페이스가 생성되었습니다');
      setShowCreateModal(false);
      reset();
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      const message = error?.response?.data?.message || '워크스페이스 생성에 실패했습니다';
      toast.error(message);
    }
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    reset();
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      {/* Logo */}
      <div className="px-6 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Defrag</h1>
          <p className="text-xs text-slate-400 mt-1">컨텍스트 통합 플랫폼</p>
        </div>
        {/* Mobile Close Button */}
        <button
          onClick={closeMobileSidebar}
          className="md:hidden p-1 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Workspace Selector */}
      <div className="px-4 mb-2">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-xl transition-all duration-200 group"
          >
            <span className="truncate text-sm font-medium text-slate-200 group-hover:text-white">
              {currentWorkspace?.name || '워크스페이스 선택'}
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showWorkspaceDropdown ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showWorkspaceDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 right-0 mt-2 bg-slate-800 rounded-xl shadow-xl border border-slate-700 z-50 py-1.5 max-h-64 overflow-y-auto custom-scrollbar"
              >
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => {
                      setCurrentWorkspace(ws);
                      setShowWorkspaceDropdown(false);
                      router.push('/dashboard');
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-left hover:bg-slate-700/50 transition-colors',
                      currentWorkspace?.id === ws.id && 'bg-slate-700/50 text-blue-400'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm truncate flex-1 font-medium">{ws.name}</span>
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded ml-2 font-medium',
                        ws.type === 'personal'
                          ? 'bg-slate-700 text-slate-300'
                          : 'bg-blue-900/40 text-blue-300'
                      )}>
                        {ws.type === 'personal' ? '개인' : '팀'}
                      </span>
                    </div>
                  </button>
                ))}
                <div className="h-px bg-slate-700/50 my-1 mx-2" />
                <button
                  onClick={() => {
                    setShowWorkspaceDropdown(false);
                    setShowCreateModal(true);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 transition-colors flex items-center gap-2 text-blue-400"
                >
                  <Plus className="w-4 h-4" />
                  새 워크스페이스
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems
          .filter((item) => {
            if (item.adminOnly && currentWorkspace?.role !== 'ADMIN') return false;
            if (item.teamOnly && currentWorkspace?.type !== 'team') return false;
            return true;
          })
          .map((item) => {
            const isActive = item.href === '/settings'
              ? pathname === item.href
              : (pathname === item.href || pathname.startsWith(item.href + '/'));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden',
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                )}
              >
                <item.icon className={cn("w-5 h-5 transition-colors", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-100")} />
                <span className="text-sm font-medium">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 bg-blue-600 z-[-1]"
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
      </nav>

      {/* User Section */}
      <div className="px-4 py-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-800 transition-colors cursor-default">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
            {user?.nickname?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-200 truncate">{user?.nickname}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
            title="로그아웃"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={handleCloseCreateModal}
        title="새 워크스페이스"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              워크스페이스 이름
            </label>
            <Input
              {...register('name')}
              placeholder="예: 내 프로젝트"
              autoFocus
            />
            {errors.name && (
              <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              워크스페이스 유형
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['personal', 'team'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setValue('type', type)}
                  className={cn(
                    "p-4 border rounded-xl text-left transition-all duration-200",
                    workspaceType === type
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  {type === 'personal' ? (
                    <User className={cn("w-5 h-5 mb-2", workspaceType === type ? "text-blue-600" : "text-gray-400")} />
                  ) : (
                    <Users className={cn("w-5 h-5 mb-2", workspaceType === type ? "text-blue-600" : "text-gray-400")} />
                  )}
                  <p className="font-medium text-gray-900">{type === 'personal' ? '개인' : '팀'}</p>
                  <p className="text-xs text-gray-500 mt-1">{type === 'personal' ? '나만 사용' : '팀원과 함께'}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" type="button" onClick={handleCloseCreateModal} className="flex-1">
              취소
            </Button>
            <Button type="submit" isLoading={isSubmitting} className="flex-1">
              만들기
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col h-screen fixed left-0 top-0 z-30 border-r border-slate-800 bg-slate-900">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar (Drawer) */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={closeMobileSidebar}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 shadow-2xl md:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
