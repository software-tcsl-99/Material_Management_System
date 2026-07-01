import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Plus,
  FileSpreadsheet,
  Database,
  Users,
  Bell,
  User,
  LogOut,
  ChevronDown,
  ChevronRight,
  Clock
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useActiveRole from '../../hooks/useActiveRole';
import api from '../../lib/axios';

const Sidebar = ({ className = '', onNavigate }) => {
  const { user, clearAuth } = useAuthStore();
  const activeRole = useActiveRole();
  const location = useLocation();
  const [txnOpen, setTxnOpen] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const isAdmin = activeRole.role === 'super_admin';

  // Fetch pending notifications count
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const res = await api.get('/notifications', { params: { read: false, limit: 50 } });
        const unread = res.data?.data?.filter(n => !n.read).length || 0;
        setPendingCount(unread);
      } catch (err) {
        // ignore
      }
    };
    if (user?._id) {
      fetchPendingCount();
      const interval = setInterval(fetchPendingCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user?._id, location.pathname]);

  const toggleTxn = () => setTxnOpen(!txnOpen);

  return (
    <aside className={`w-64 border-r border-slate-200/80 dark:border-slate-800 bg-slate-900 text-slate-300 flex flex-col h-full shrink-0 ${className}`}>
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-2.5 px-6 border-b border-slate-800 shrink-0 bg-slate-950">
        <div className="p-1.5 bg-blue-600 rounded-lg text-white">
          <ArrowLeftRight className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-extrabold text-sm tracking-wide text-white uppercase">
            MMS Enterprise
          </span>
          <span className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">
            Lifecycle Platform
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
        {/* Dashboard */}
        <NavLink
          to="/"
          onClick={onNavigate}
          className={({ isActive }) => `
            flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
            ${isActive 
              ? 'bg-blue-600/15 text-blue-400 border-l-4 border-blue-500 font-black' 
              : 'hover:bg-slate-800 hover:text-white'
            }
          `}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span>Dashboard</span>
        </NavLink>

        {/* Transactions Group */}
        <div className="flex flex-col">
          <button
            onClick={toggleTxn}
            className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all hover:bg-slate-800 hover:text-white w-full text-left"
          >
            <div className="flex items-center gap-3">
              <ArrowLeftRight className="w-4 h-4 shrink-0" />
              <span>Transactions</span>
            </div>
            {txnOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {txnOpen && (
            <div className="pl-6 pr-1 flex flex-col gap-1 mt-1 border-l border-slate-800 ml-5">
              <NavLink
                to="/transactions"
                end
                onClick={onNavigate}
                className={({ isActive }) => `
                  flex items-center gap-2.5 py-2 px-3 rounded-md text-xs font-semibold transition-all
                  ${isActive && !location.pathname.includes('/create')
                    ? 'text-blue-400 bg-slate-800' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }
                `}
              >
                <span>My Transactions</span>
              </NavLink>
              
              <NavLink
                to="/transactions?all=true"
                onClick={onNavigate}
                className={() => `
                  flex items-center gap-2.5 py-2 px-3 rounded-md text-xs font-semibold transition-all
                  ${location.search.includes('all=true')
                    ? 'text-blue-400 bg-slate-800' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }
                `}
              >
                <span>All Transactions</span>
              </NavLink>

              <NavLink
                to="/transactions/create"
                onClick={onNavigate}
                className={({ isActive }) => `
                  flex items-center gap-2.5 py-2 px-3 rounded-md text-xs font-semibold transition-all
                  ${isActive 
                    ? 'text-blue-400 bg-slate-800' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }
                `}
              >
                <Plus className="w-3 h-3 text-blue-500" />
                <span>Create Request</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* Approvals Center */}
        {['super_admin', 'team_lead', 'department_admin'].includes(activeRole.role) && (
          <NavLink
            to="/pending"
            onClick={onNavigate}
            className={({ isActive }) => `
              flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
              ${isActive && location.pathname === '/pending'
                ? 'bg-blue-600/15 text-blue-400 border-l-4 border-blue-500 font-black' 
                : 'hover:bg-slate-800 hover:text-white'
              }
            `}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span>Approvals Center</span>
          </NavLink>
        )}

        {/* Reports */}
        <NavLink
          to="/reports"
          onClick={onNavigate}
          className={({ isActive }) => `
            flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
            ${isActive && location.pathname.includes('/reports')
              ? 'bg-blue-600/15 text-blue-400 border-l-4 border-blue-500 font-black' 
              : 'hover:bg-slate-800 hover:text-white'
            }
          `}
        >
          <FileSpreadsheet className="w-4 h-4 shrink-0" />
          <span>Reports</span>
        </NavLink>

        {/* Master Data */}
        {isAdmin && (
          <NavLink
            to="/masters"
            onClick={onNavigate}
            className={({ isActive }) => `
              flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
              ${isActive && location.pathname.includes('/masters')
                ? 'bg-blue-600/15 text-blue-400 border-l-4 border-blue-500 font-black' 
                : 'hover:bg-slate-800 hover:text-white'
              }
            `}
          >
            <Database className="w-4 h-4 shrink-0" />
            <span>Masters</span>
          </NavLink>
        )}

        {/* Users & Roles */}
        {isAdmin && (
          <NavLink
            to="/employees"
            onClick={onNavigate}
            className={({ isActive }) => `
              flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
              ${isActive && location.pathname.includes('/employees')
                ? 'bg-blue-600/15 text-blue-400 border-l-4 border-blue-500 font-black' 
                : 'hover:bg-slate-800 hover:text-white'
              }
            `}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>Users & Roles</span>
          </NavLink>
        )}

        {/* Profile */}
        <NavLink
          to="/profile"
          onClick={onNavigate}
          className={({ isActive }) => `
            flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
            ${isActive && location.pathname.includes('/profile')
              ? 'bg-blue-600/15 text-blue-400 border-l-4 border-blue-500 font-black' 
              : 'hover:bg-slate-800 hover:text-white'
            }
          `}
        >
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 shrink-0" />
            <span>Profile</span>
          </div>
          {pendingCount > 0 && (
            <span className="bg-red-500 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded-full shrink-0">
              {pendingCount}
            </span>
          )}
        </NavLink>
      </nav>

      {/* Footer / Profile Info */}
      <div className="p-4 border-t border-slate-800 shrink-0 bg-slate-950/60 flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-blue-400 font-bold text-xs uppercase border border-slate-700 select-none">
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-white truncate">
              {user?.fullName || 'User'}
            </span>
            <span className="text-[9px] text-blue-400 font-bold uppercase tracking-wide">
              {activeRole.label}
            </span>
          </div>
        </div>

        <button
          onClick={clearAuth}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/10 transition-all cursor-pointer text-left w-full"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
