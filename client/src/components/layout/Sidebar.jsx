import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowRightLeft,
  ChevronDown,
  Layers,
  Archive,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  TrendingUp,
  Settings,
  MessageSquare,
  History,
  ShieldCheck,
  Bell,
  Inbox
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useUIStore from '../../store/uiStore';
import api from '../../lib/axios';

export default function Sidebar() {
  const { user } = useAuthStore();
  const { sidebarOpen, closeMobileMenu } = useUIStore();
  const [txnDropdown, setTxnDropdown] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchSidebarData = async () => {
      try {
        const isStore = user.role === 'super_admin' || (user.role === 'department_admin' && user.departmentAdminType === 'store');
        const isCloseReqEligible = ['super_admin', 'team_lead', 'department_admin'].includes(user.role);
        
        const [txnRes, transferRes, splitRes, returnRes, closeRes, notifRes] = await Promise.all([
          api.get('/transactions'),
          api.get('/barcodes/pending/transfers'),
          isStore ? api.get('/barcodes/split-requests/pending') : Promise.resolve({ data: { data: [] } }),
          api.get('/barcodes/returns/pending'),
          isCloseReqEligible ? api.get('/barcodes/close-requests/pending') : Promise.resolve({ data: { data: [] } }),
          api.get('/notifications?unreadOnly=true')
        ]);
        
        const txns = txnRes.data.data || [];
        const transfers = transferRes.data.transfers || [];
        const splits = splitRes.data.data || [];
        const returns = returnRes.data.returns || returnRes.data.data || [];
        const closes = closeRes.data.data || [];
        const unreadCount = notifRes.data.notifications?.length || 0;

        setUnreadNotifCount(unreadCount);

        let filteredTxnsCount = 0;
        txns.forEach(t => {
          if (user.role === 'department_admin' && user.departmentAdminType === 'management') {
            const isMyMgtApprover = (t.managementApprover?._id || t.managementApprover)?.toString() === user._id?.toString();
            if (!isMyMgtApprover) return;
          }

          const isHandlerDeliveryPending = t.handler && ['store_accepted', 'handler_assigned', 'dispatched'].includes(t.status);
          let isPending = false;

          if (isHandlerDeliveryPending) {
            if (t.status === 'handler_assigned') {
              const isMyHandler = t.handler && (t.handler?._id === user._id || t.handler === user._id);
              const isPendingTarget = t.pendingHandlerTransfer?.status === 'pending' && (t.pendingHandlerTransfer?.toHandler?._id === user._id || t.pendingHandlerTransfer?.toHandler === user._id);
              if (isMyHandler || isPendingTarget) isPending = true;
            } else if (t.status === 'store_accepted') {
              if (isStore) isPending = true;
            } else if (t.status === 'dispatched') {
              if (t.rejectedDeliveryStatus === 'rejected_by_requester') {
                const isMyHandler = t.handler && (t.handler?._id === user._id || t.handler === user._id);
                const isPendingTarget = t.pendingHandlerTransfer?.status === 'pending' && (t.pendingHandlerTransfer?.toHandler?._id === user._id || t.pendingHandlerTransfer?.toHandler === user._id);
                if (isMyHandler || isPendingTarget) isPending = true;
              } else if (t.rejectedDeliveryStatus === 'sent_to_store') {
                if (isStore) isPending = true;
              } else {
                const isMyRequester = t.requester && (t.requester?._id === user._id || t.requester === user._id);
                if (isMyRequester) isPending = true;
              }
            }
          } else {
            if (user.role === 'employee') {
              const isRequesterPending = (t.requester?._id === user._id || t.requester === user._id) && t.status === 'dispatched';
              if (isRequesterPending) isPending = true;
            } else if (user.role === 'team_lead') {
              if (t.status === 'submitted') isPending = true;
            } else if (user.role === 'department_admin') {
              if (user.departmentAdminType === 'management') {
                if (t.status === 'tl_approved') isPending = true;
              } else if (user.departmentAdminType === 'store') {
                const isSentToStore = t.status === 'dispatched' && t.rejectedDeliveryStatus === 'sent_to_store';
                if (isSentToStore || ['mgt_approved', 'ready_for_dispatch', 'store_accepted'].includes(t.status)) isPending = true;
              }
            } else if (user.role === 'super_admin') {
              if (!['completed', 'received', 'closed', 'rejected', 'active', 'partially_returned'].includes(t.status)) isPending = true;
            }
          }

          if (isPending) filteredTxnsCount++;
        });

        const groupedReturnsMap = {};
        returns.forEach(r => {
          const handlerKey = r.returnHandler?._id || r.returnHandler || 'none';
          const key = `${r.transactionId}_${r.status}_${handlerKey}`;
          if (!groupedReturnsMap[key]) {
            groupedReturnsMap[key] = true;
          }
        });
        const returnsCount = Object.keys(groupedReturnsMap).length;

        const total = filteredTxnsCount + transfers.length + splits.length + returnsCount + closes.length;
        setPendingCount(total);
      } catch (err) {
        console.error('Error fetching sidebar count data:', err);
      }
    };

    fetchSidebarData();
    const interval = setInterval(fetchSidebarData, 15000);
    return () => clearInterval(interval);
  }, [user]);

  if (!sidebarOpen) return null;

  return (
    <aside className="w-64 bg-slate-900 text-slate-400 flex flex-col h-screen sidebar-transition shrink-0 z-30">
      {/* Brand Logo header */}
      <div className="h-16 flex items-center gap-3 px-6 bg-slate-950 border-b border-slate-800">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center font-bold text-white text-base">
          M
        </div>
        <div>
          <h2 className="text-white font-bold text-sm leading-none tracking-wide">MMS</h2>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5 block">
            Material Platform
          </span>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-none">
        {/* Dashboard */}
        <NavLink
          to="/"
          onClick={closeMobileMenu}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
              isActive
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          <LayoutDashboard className="w-4 h-4" /> Dashboard
        </NavLink>

        {/* Pending Requests */}
        <NavLink
          to="/pending"
          onClick={closeMobileMenu}
          className={({ isActive }) =>
            `flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
              isActive
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          <div className="flex items-center gap-3">
            <Inbox className="w-4 h-4" /> 
            <span>Pending Requests</span>
          </div>
          {pendingCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0 animate-pulse">
              {pendingCount}
            </span>
          )}
        </NavLink>

        {/* Transactions Dropdown group */}
        <div>
          <button
            onClick={() => setTxnDropdown(!txnDropdown)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-slate-800 hover:text-white transition"
          >
            <div className="flex items-center gap-3">
              <ArrowRightLeft className="w-4 h-4" /> Transactions
            </div>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${txnDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {txnDropdown && (
            <div className="pl-6 mt-1 space-y-1">
              <NavLink
                to="/transactions"
                end
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-4 py-2 rounded-xl text-[11px] font-medium transition ${
                    isActive ? 'text-white bg-slate-800' : 'hover:text-white'
                  }`
                }
              >
                All Transactions
              </NavLink>
              <NavLink
                to="/transactions/create"
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-4 py-2 rounded-xl text-[11px] font-medium transition ${
                    isActive ? 'text-white bg-slate-800' : 'hover:text-white'
                  }`
                }
              >
                Create Request
              </NavLink>
            </div>
          )}
        </div>

        {/* Materials */}
        <NavLink
          to="/materials"
          onClick={closeMobileMenu}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
              isActive ? 'bg-primary text-white shadow-md shadow-primary/20' : 'hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          <Layers className="w-4 h-4" /> Materials Tree
        </NavLink>

        {/* Store inventory */}
        {(user?.role === 'super_admin' || (user?.role === 'department_admin' && user?.departmentAdminType === 'store')) && (
          <NavLink
            to="/store"
            onClick={closeMobileMenu}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
                isActive ? 'bg-primary text-white shadow-md shadow-primary/20' : 'hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Archive className="w-4 h-4" /> Store Dashboard
          </NavLink>
        )}

        {/* Transfers */}
        <NavLink
          to="/transfers"
          onClick={closeMobileMenu}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
              isActive ? 'bg-primary text-white shadow-md shadow-primary/20' : 'hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          <ArrowUpRight className="w-4 h-4" /> Transfers
        </NavLink>

        {/* Returns */}
        <NavLink
          to="/returns"
          onClick={closeMobileMenu}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
              isActive ? 'bg-primary text-white shadow-md shadow-primary/20' : 'hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          <ArrowDownLeft className="w-4 h-4" /> Returns
        </NavLink>

        {/* Audit Logs */}
        {(user?.role === 'super_admin' || 
          (user?.role === 'department_admin' && (user?.departmentAdminType === 'management' || user?.departmentAdminType === 'store'))
        ) && (
          <NavLink
            to="/audit-logs"
            onClick={closeMobileMenu}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
                isActive ? 'bg-primary text-white shadow-md shadow-primary/20' : 'hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <History className="w-4 h-4" /> Audit Logs
          </NavLink>
        )}

        {/* Reports */}
        <NavLink
          to="/reports"
          onClick={closeMobileMenu}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
              isActive ? 'bg-primary text-white shadow-md shadow-primary/20' : 'hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          <TrendingUp className="w-4 h-4" /> Reports
        </NavLink>



        {/* Notifications Page Link */}
        <NavLink
          to="/notifications"
          onClick={closeMobileMenu}
          className={({ isActive }) =>
            `flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
              isActive ? 'bg-primary text-white shadow-md shadow-primary/20' : 'hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4" />
            <span>Notifications</span>
          </div>
          {unreadNotifCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black animate-pulse">
              {unreadNotifCount}
            </span>
          )}
        </NavLink>

        {/* User Roles Admin */}
        {user?.role === 'super_admin' && (
          <>
            <NavLink
              to="/users"
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive ? 'bg-primary text-white shadow-md shadow-primary/20' : 'hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <ShieldCheck className="w-4 h-4" /> Users & Roles
            </NavLink>
            <NavLink
              to="/masters"
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive ? 'bg-primary text-white shadow-md shadow-primary/20' : 'hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Settings className="w-4 h-4" /> Masters Config
            </NavLink>
          </>
        )}
      </nav>

      {/* User profile footer display */}
      <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-md shadow-primary/30">
          {user?.fullName?.charAt(0)}
        </div>
        <div className="overflow-hidden">
          <p className="text-xs font-bold text-white truncate">{user?.fullName}</p>
          <p className="text-[9px] font-semibold text-slate-500 capitalize truncate mt-0.5">
            {user?.role?.replace('_', ' ')}
          </p>
        </div>
      </div>
    </aside>
  );
}
