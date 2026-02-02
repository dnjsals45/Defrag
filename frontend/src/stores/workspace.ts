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

      // Auto-select first workspace if none selected
      if (!get().currentWorkspace && workspaces.length > 0) {
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
