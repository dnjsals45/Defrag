import { create } from 'zustand';
import { invitationApi } from '@/lib/api';
import type { WorkspaceInvitation } from '@/types';

interface InvitationState {
  invitations: WorkspaceInvitation[];
  count: number;
  isLoading: boolean;
  loadInvitations: () => Promise<void>;
  loadCount: () => Promise<void>;
  accept: (id: string) => Promise<{ workspaceId: string; workspaceName: string } | null>;
  reject: (id: string) => Promise<boolean>;
}

export const useInvitationStore = create<InvitationState>((set, get) => ({
  invitations: [],
  count: 0,
  isLoading: false,

  loadInvitations: async () => {
    set({ isLoading: true });
    try {
      const { data } = await invitationApi.list();
      set({ invitations: data.invitations, count: data.invitations.length });
    } catch (error) {
      console.error('Failed to load invitations:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  loadCount: async () => {
    try {
      const { data } = await invitationApi.count();
      set({ count: data.count });
    } catch (error) {
      console.error('Failed to load invitation count:', error);
    }
  },

  accept: async (id: string) => {
    try {
      const { data } = await invitationApi.accept(id);
      // Remove from local state
      const invitations = get().invitations.filter((inv) => inv.id !== id);
      set({ invitations, count: invitations.length });
      return {
        workspaceId: data.workspace.id,
        workspaceName: data.workspace.name,
      };
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      return null;
    }
  },

  reject: async (id: string) => {
    try {
      await invitationApi.reject(id);
      // Remove from local state
      const invitations = get().invitations.filter((inv) => inv.id !== id);
      set({ invitations, count: invitations.length });
      return true;
    } catch (error) {
      console.error('Failed to reject invitation:', error);
      return false;
    }
  },
}));
