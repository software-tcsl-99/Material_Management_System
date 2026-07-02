import React, { useState, useEffect } from 'react';
import { Bell, Search, LogOut, User as UserIcon, Settings, Menu } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useUIStore from '../../store/uiStore';
import api from '../../lib/api';

export default function Header() {
  const { user, logout } = useAuthStore();
  const { toggleSidebar, toggleMobileMenu } = useUIStore();
  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll notifications
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = () => {
    api.get('/notifications?unreadOnly=true')
      .then(({ data }) => setNotifications(data.notifications || []))
      .catch(err => console.error(err));
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications([]);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-6 flex justify-between items-center z-30 sticky top-0">
      {/* Left branding / sidebar controls */}
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="hidden md:block p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
          <Menu className="w-5 h-5" />
        </button>
        <button onClick={toggleMobileMenu} className="md:hidden p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
          <Menu className="w-5 h-5" />
        </button>

        {/* Search */}
        <div className="hidden lg:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-80">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search transactions, barcodes..."
            className="bg-transparent border-none text-xs text-slate-700 outline-none w-full placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        {/* Notifications Icon */}
        <div className="relative">
          <button
            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
            className="p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-50 transition relative"
          >
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-danger text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {notifications.length}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifDropdown(false)} />
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700">Notifications</span>
                  {notifications.length > 0 && (
                    <button onClick={handleMarkAllRead} className="text-[10px] font-semibold text-primary hover:underline">
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      No unread notifications
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n._id} className="p-3 hover:bg-slate-50 text-xs transition">
                        <p className="font-semibold text-slate-800 mb-0.5">{n.title}</p>
                        <p className="text-slate-500">{n.message}</p>
                        <p className="text-[9px] text-slate-400 mt-1 font-medium">
                          {new Date(n.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            className="flex items-center gap-3 pl-3 py-1.5 hover:bg-slate-50 rounded-xl transition"
          >
            {/* Avatar character */}
            <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shadow-md shadow-primary/20">
              {user?.fullName?.charAt(0)}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-bold text-slate-800">{user?.fullName}</p>
              <p className="text-[10px] font-semibold text-slate-500 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </button>

          {showProfileDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowProfileDropdown(false)} />
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden py-1 animate-fade-in">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-700">{user?.fullName}</p>
                  <p className="text-[10px] text-slate-400 font-medium overflow-hidden text-ellipsis">{user?.email}</p>
                </div>
                <a
                  href="/profile"
                  className="px-4 py-2.5 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-2 transition"
                >
                  <UserIcon className="w-4 h-4 text-slate-400" /> My Profile
                </a>
                <button
                  onClick={logout}
                  className="w-full px-4 py-2.5 hover:bg-danger-light text-danger text-xs font-medium flex items-center gap-2 transition text-left"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
