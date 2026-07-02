import { create } from 'zustand';

const useUIStore = create((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: false,
  chatDrawerOpen: false,
  chatTransactionId: null,
  mobileMenuOpen: false,
  
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  collapseSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openChatDrawer: (transactionId) => set({ chatDrawerOpen: true, chatTransactionId: transactionId }),
  closeChatDrawer: () => set({ chatDrawerOpen: false, chatTransactionId: null }),
  toggleMobileMenu: () => set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),
  closeMobileMenu: () => set({ mobileMenuOpen: false }),
}));

export default useUIStore;
