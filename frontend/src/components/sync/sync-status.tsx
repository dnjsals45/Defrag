'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { itemApi } from '@/lib/api';

interface SyncStatusProps {
  workspaceId: string;
  refreshInterval?: number;
}

interface SyncJob {
  provider: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  progress?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

interface SyncStatusData {
  workspaceId: string;
  isRunning: boolean;
  jobs: SyncJob[];
  lastSyncAt?: string;
}

const statusVariants = {
  pending: 'info',
  active: 'warning',
  completed: 'success',
  failed: 'error',
} as const;

const providerLabels: Record<string, string> = {
  github: 'GitHub',
  slack: 'Slack',
  notion: 'Notion',
};

export function SyncStatus({ workspaceId, refreshInterval = 5000 }: SyncStatusProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const { data } = await itemApi.syncStatus(workspaceId);
      setSyncStatus(data);
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    let intervalId: NodeJS.Timeout | null = null;

    if (syncStatus?.isRunning) {
      intervalId = setInterval(fetchStatus, refreshInterval);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [workspaceId, syncStatus?.isRunning, refreshInterval]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!syncStatus || syncStatus.jobs.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-4">
        No sync jobs found. Click &quot;Sync Now&quot; to start syncing your connected services.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {syncStatus.jobs.map((job) => (
        <div
          key={job.provider}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
        >
          <div className="flex items-center gap-3">
            {job.status === 'active' && (
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {providerLabels[job.provider] || job.provider}
                </span>
                <Badge variant={statusVariants[job.status]}>
                  {job.status}
                </Badge>
              </div>
              {job.progress && (
                <div className="text-xs text-gray-500 mt-1">
                  {Object.entries(job.progress).map(([key, value]) => (
                    <span key={key} className="mr-3">
                      {key}: {String(value)}
                    </span>
                  ))}
                </div>
              )}
              {job.error && (
                <div className="text-xs text-red-600 mt-1">
                  Error: {job.error}
                </div>
              )}
            </div>
          </div>
          <div className="text-xs text-gray-400">
            {job.completedAt && (
              <span>Completed: {new Date(job.completedAt).toLocaleString()}</span>
            )}
            {job.startedAt && !job.completedAt && (
              <span>Started: {new Date(job.startedAt).toLocaleString()}</span>
            )}
          </div>
        </div>
      ))}
      {syncStatus.lastSyncAt && (
        <div className="text-xs text-gray-500 text-right pt-2">
          Last sync: {new Date(syncStatus.lastSyncAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
