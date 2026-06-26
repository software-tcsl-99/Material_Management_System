import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import useSocket from '../../hooks/useSocket';
import useNotificationStore from '../../store/notificationStore';
import useThemeStore from '../../store/themeStore';
import Header from './Header';
import MobileNav from './MobileNav';
import Sidebar from './Sidebar';

const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const applyTheme = useThemeStore((state) => state.applyTheme);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);

  // Initialize Theme class on document Element
  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  // Connect sockets when authenticated
  useSocket();

  // Load notifications initially
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-50">
      {/* Sidebar - Hidden on mobile, shown on md+ screens */}
      <Sidebar className="hidden md:flex shrink-0" />

      {/* Mobile Sidebar Overlay/Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer Panel */}
          <div className="relative flex-1 max-w-[260px] animate-in slide-in-from-left duration-250 z-50">
            <Sidebar className="w-full" onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileNav />
      </div>
    </div>
  );
};

export default AppLayout;
