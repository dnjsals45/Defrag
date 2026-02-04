import { create } from 'zustand';

interface UIState {
    isMobileSidebarOpen: boolean;
    toggleMobileSidebar: () => void;
    closeMobileSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    isMobileSidebarOpen: false,
    toggleMobileSidebar: () => set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen })),
    closeMobileSidebar: () => set({ isMobileSidebarOpen: false }),
}));
