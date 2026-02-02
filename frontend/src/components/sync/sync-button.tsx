'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { itemApi } from '@/lib/api';

interface SyncButtonProps {
  workspaceId: string;
  onSyncComplete?: () => void;
}

export function SyncButton({ workspaceId, onSyncComplete }: SyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await itemApi.sync(workspaceId);
      onSyncComplete?.();
    } catch (error) {
      console.error('Failed to trigger sync:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Button
      onClick={handleSync}
      isLoading={isSyncing}
      disabled={isSyncing}
      size="md"
      variant="primary"
    >
      {!isSyncing && <RefreshCw className="w-4 h-4 mr-2" />}
      {isSyncing ? 'Syncing...' : 'Sync Now'}
    </Button>
  );
}
