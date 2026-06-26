import {
  ArrowLeftRight,
  Clock,
  Database,
  Download,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  User,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import api from '../../lib/axios';
import useAuthStore from '../../store/authStore';

const Sidebar = ({ className = '', onNavigate }) => {
  const { user, clearAuth } = useAuthStore();
  const isAdmin = ['super_admin', 'admin'].includes(user?.role);
  const location = useLocation();

  const menuItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Transactions', path: '/transactions', icon: ArrowLeftRight },
    ...(!isAdmin ? [{ label: 'Pending Requests', path: '/pending', icon: Clock }] : []),
    ...(!isAdmin ? [{ label: 'Receiving', path: '/receiving', icon: Download }] : []),
    ...(isAdmin
      ? [
        { label: 'Employees', path: '/employees', icon: Users },
        { label: 'Master Data', path: '/masters', icon: Database },
      ]
      : []),
    { label: 'Reports', path: '/reports', icon: FileText },
    { label: 'Profile', path: '/profile', icon: User },
  ];

  const [pendingCount, setPendingCount] = useState(0);

  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await api.get('/transactions', { params: { status: 'pending', receiver: user?._id, limit: 1 } });
      const total = res.data?.pagination?.total ?? 0;
      setPendingCount(total);
    } catch (err) {
      // ignore
    }
  }, [user?._id]);

  // Re-fetch pending count on mount and on every route change
  useEffect(() => {
    if (!isAdmin && user?._id) {
      fetchPendingCount();
    }
  }, [isAdmin, user?._id, fetchPendingCount, location.pathname]);

  return (
    <aside className={`w-64 border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full ${className}`}>
      {/* Brand Logo */}
      <div className="h-16 flex items-center gap-2.5 px-6 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
        <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
          <Package className="w-5 h-5" />
        </div>
        <span className="font-bold text-sm tracking-wide text-indigo-600 dark:text-indigo-400 uppercase">
          MMS Portal
        </span>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 py-6 px-4 flex flex-col gap-1 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => onNavigate?.()}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer
              ${isActive
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
              }
            `}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span className="flex items-center gap-2">
              <span>{item.label}</span>
              {item.path === '/pending' && pendingCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">
                  {pendingCount}
                </span>
              )}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-200/80 dark:border-slate-800 shrink-0 flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-950/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-slate-800 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-xs select-none">
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
              {user?.fullName || 'User'}
            </span>
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
              {['super_admin', 'admin'].includes(user?.role) ? 'Admin' : 'Employee'}
            </span>
          </div>
        </div>

        <button
          onClick={clearAuth}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer text-left w-full mt-2"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
