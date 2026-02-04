import { create } from 'zustand';
import { invitationApi, notificationApi, getNotificationStreamUrl } from '@/lib/api';
import type { WorkspaceInvitation, Notification } from '@/types';

interface NotificationState {
  // Data
  notifications: Notification[];
  invitations: WorkspaceInvitation[];
  unreadCount: number;
  isLoading: boolean;

  // SSE connection
  eventSource: EventSource | null;

  // Actions - Notifications
  loadNotifications: () => Promise<void>;
  loadUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;

  // Actions - Invitations
  loadInvitations: () => Promise<void>;
  acceptInvitation: (id: string) => Promise<{ workspaceId: string; workspaceName: string } | null>;
  rejectInvitation: (id: string) => Promise<boolean>;

  // Actions - SSE
  connectSSE: () => void;
  disconnectSSE: () => void;

  // Combined
  loadAll: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  invitations: [],
  unreadCount: 0,
  isLoading: false,
  eventSource: null,

  loadNotifications: async () => {
    try {
      const { data } = await notificationApi.list({ limit: 50 });
      set({ notifications: data.notifications });
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  },

  loadUnreadCount: async () => {
    try {
      const [notifRes, inviteRes] = await Promise.all([
        notificationApi.unreadCount(),
        invitationApi.count(),
      ]);
      set({ unreadCount: notifRes.data.count + inviteRes.data.count });
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  },

  markAsRead: async (id: string) => {
    try {
      await notificationApi.markAsRead(id);
      const notifications = get().notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      );
      const unreadNotifCount = notifications.filter((n) => !n.isRead).length;
      const invitationCount = get().invitations.length;
      set({ notifications, unreadCount: unreadNotifCount + invitationCount });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  },

  markAllAsRead: async () => {
    try {
      await notificationApi.markAllAsRead();
      const notifications = get().notifications.map((n) => ({ ...n, isRead: true }));
      const invitationCount = get().invitations.length;
      set({ notifications, unreadCount: invitationCount });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  },

  loadInvitations: async () => {
    try {
      const { data } = await invitationApi.list();
      set({ invitations: data.invitations });
    } catch (error) {
      console.error('Failed to load invitations:', error);
    }
  },

  acceptInvitation: async (id: string) => {
    try {
      const { data } = await invitationApi.accept(id);
      const invitations = get().invitations.filter((inv) => inv.id !== id);
      const unreadNotifCount = get().notifications.filter((n) => !n.isRead).length;
      set({ invitations, unreadCount: unreadNotifCount + invitations.length });
      return {
        workspaceId: data.workspace.id,
        workspaceName: data.workspace.name,
      };
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      return null;
    }
  },

  rejectInvitation: async (id: string) => {
    try {
      await invitationApi.reject(id);
      const invitations = get().invitations.filter((inv) => inv.id !== id);
      const unreadNotifCount = get().notifications.filter((n) => !n.isRead).length;
      set({ invitations, unreadCount: unreadNotifCount + invitations.length });
      return true;
    } catch (error) {
      console.error('Failed to reject invitation:', error);
      return false;
    }
  },

  connectSSE: () => {
    const url = getNotificationStreamUrl();
    if (!url) return;

    // Close existing connection if any
    const existing = get().eventSource;
    if (existing) {
      existing.close();
    }

    const es = new EventSource(url);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'notification') {
          set((state) => ({
            notifications: [data.notification, ...state.notifications],
            unreadCount: state.unreadCount + 1,
          }));
        }
        // Heartbeat messages are ignored (type === 'heartbeat')
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    es.onerror = () => {
      es.close();
      set({ eventSource: null });
      // Reconnect after 5 seconds
      setTimeout(() => {
        if (typeof window !== 'undefined' && localStorage.getItem('accessToken')) {
          get().connectSSE();
        }
      }, 5000);
    };

    set({ eventSource: es });
  },

  disconnectSSE: () => {
    const es = get().eventSource;
    if (es) {
      es.close();
      set({ eventSource: null });
    }
  },

  loadAll: async () => {
    set({ isLoading: true });
    try {
      await Promise.all([
        get().loadNotifications(),
        get().loadInvitations(),
        get().loadUnreadCount(),
      ]);
    } finally {
      set({ isLoading: false });
    }
  },
}));
