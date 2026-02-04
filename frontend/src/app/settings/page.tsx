'use client';

import { useState } from 'react';
import { Settings, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui';
import { useWorkspaceStore } from '@/stores/workspace';
import { workspaceApi } from '@/lib/api';

export default function SettingsPage() {
  const { currentWorkspace, loadWorkspaces } = useWorkspaceStore();
  const [name, setName] = useState(currentWorkspace?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = async () => {
    if (!currentWorkspace || !name.trim()) return;
    setIsSaving(true);
    try {
      await workspaceApi.update(currentWorkspace.id, { name });
      await loadWorkspaces();
    } catch (error) {
      console.error('Failed to update workspace:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentWorkspace) return;
    setIsDeleting(true);
    try {
      await workspaceApi.delete(currentWorkspace.id);
      await loadWorkspaces();
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Failed to delete workspace:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!currentWorkspace) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">워크스페이스를 선택하세요</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6" />
          <h1 className="text-2xl font-bold">워크스페이스 설정</h1>
        </div>

        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>일반</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="워크스페이스 이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                유형
              </label>
              <p className="text-gray-900">
                {currentWorkspace.type === 'personal' ? '개인' : '팀'}
              </p>
            </div>
            <Button onClick={handleSave} isLoading={isSaving}>
              저장
            </Button>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">위험 구역</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">워크스페이스 삭제</p>
                <p className="text-sm text-gray-500">
                  모든 데이터가 영구적으로 삭제됩니다
                </p>
              </div>
              <Button
                variant="danger"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                삭제
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-lg font-semibold text-red-600 mb-2">
                정말 삭제하시겠습니까?
              </h2>
              <p className="text-gray-600 mb-4">
                &quot;{currentWorkspace.name}&quot; 워크스페이스와 모든 데이터가 영구적으로 삭제됩니다.
                이 작업은 되돌릴 수 없습니다.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1"
                >
                  취소
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  isLoading={isDeleting}
                  className="flex-1"
                >
                  삭제
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
