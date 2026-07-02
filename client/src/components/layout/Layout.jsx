import {
  ArrowRightLeft,
  Bell,
  LayoutDashboard,
  User as UserIcon
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import useUIStore from '../../store/uiStore';
import ChatDrawer from '../ChatDrawer';
import Header from './Header';
import Sidebar from './Sidebar';

export default function Layout() {
  const { user } = useAuthStore();
  const { mobileMenuOpen, closeMobileMenu, toggleMobileMenu } = useUIStore();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop Left Sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-40 md:hidden" onClick={closeMobileMenu} />
      )}

      {/* Mobile Sidebar Drawer */}
      <div
        className={`fixed inset-y-0 left-0 w-64 bg-slate-900 text-slate-400 z-50 transform md:hidden transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <Sidebar />
      </div>

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden pb-16 md:pb-0">
        {/* Top Header */}
        <Header />

        {/* Page Workspace Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50/50">
          <div className="w-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Global Right Chat Drawer */}
      <ChatDrawer />

      {/* Mobile Bottom Navigation Bar (as per layout specs) */}
      <div className="md:hidden bottom-nav flex justify-around items-center h-16 shadow-inner">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[10px] font-semibold transition ${isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-700'
            }`
          }
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/transactions"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[10px] font-semibold transition ${isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-700'
            }`
          }
        >
          <ArrowRightLeft className="w-5 h-5" />
          <span>Transactions</span>
        </NavLink>

        <NavLink
          to="/notifications"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[10px] font-semibold transition ${isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-700'
            }`
          }
        >
          <Bell className="w-5 h-5" />
          <span>Notifications</span>
        </NavLink>



        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[10px] font-semibold transition ${isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-700'
            }`
          }
        >
          <UserIcon className="w-5 h-5" />
          <span>Profile</span>
        </NavLink>
      </div>
    </div>
  );
}
