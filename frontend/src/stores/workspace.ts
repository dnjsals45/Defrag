import { create } from 'zustand';
import { workspaceApi } from '@/lib/api';

interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'team';
  role: string;
  memberCount: number;
}

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isLoading: boolean;
  loadWorkspaces: () => Promise<void>;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  createWorkspace: (name: string, type: 'personal' | 'team') => Promise<Workspace>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  currentWorkspace: null,
  isLoading: true,

  loadWorkspaces: async () => {
    try {
      const { data } = await workspaceApi.list();
      const workspaces = data.workspaces;
      set({ workspaces, isLoading: false });

      // Restore from localStorage or auto-select first workspace
      const currentWs = get().currentWorkspace;
      const savedId = typeof window !== 'undefined' ? localStorage.getItem('currentWorkspaceId') : null;

      if (savedId) {
        // Find workspace with saved ID and use fresh data (including updated role)
        const savedWorkspace = workspaces.find((ws: Workspace) => ws.id === savedId);
        if (savedWorkspace) {
          set({ currentWorkspace: savedWorkspace });
        } else if (!currentWs && workspaces.length > 0) {
          // Saved workspace no longer exists, select first
          set({ currentWorkspace: workspaces[0] });
        }
      } else if (!currentWs && workspaces.length > 0) {
        // No saved ID, select first workspace
        set({ currentWorkspace: workspaces[0] });
      }
    } catch {
      set({ workspaces: [], isLoading: false });
    }
  },

  setCurrentWorkspace: (workspace) => {
    set({ currentWorkspace: workspace });
    if (workspace) {
      localStorage.setItem('currentWorkspaceId', workspace.id);
    }
  },

  createWorkspace: async (name, type) => {
    const { data } = await workspaceApi.create({ name, type });
    const newWorkspace = { ...data, role: 'ADMIN', memberCount: 1 };
    set((state) => ({
      workspaces: [...state.workspaces, newWorkspace],
      currentWorkspace: newWorkspace,
    }));
    return newWorkspace;
  },
}));
