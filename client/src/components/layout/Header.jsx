import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Laptop, Search, Menu, User, LogOut } from 'lucide-react';
import useThemeStore from '../../store/themeStore';
import useAuthStore from '../../store/authStore';
import NotificationBell from '../notifications/NotificationBell';
import useActiveRole from '../../hooks/useActiveRole';

const Header = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const { theme, setTheme } = useThemeStore();
  const { user, clearAuth } = useAuthStore();
  const activeRole = useActiveRole();
  const [searchQuery, setSearchQuery] = useState('');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="h-16 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shrink-0">
      {/* Mobile Menu Trigger & Search */}
      <div className="flex items-center gap-4 flex-1">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Bar */}
        <form onSubmit={handleSearchSubmit} className="hidden sm:flex relative max-w-md w-full">
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
          <input
            type="search"
            placeholder="Search transactions, materials, barcodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-indigo-500 dark:text-white"
          />
        </form>
      </div>

      {/* Action items */}
      <div className="flex items-center gap-4.5 shrink-0">

        {/* Theme Selector */}
        <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => setTheme('light')}
            className={`p-1.5 rounded-md cursor-pointer transition-colors ${theme === 'light' ? 'bg-indigo-50 text-indigo-600 dark:bg-slate-800 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            title="Light Mode"
          >
            <Sun className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`p-1.5 rounded-md cursor-pointer transition-colors ${theme === 'dark' ? 'bg-indigo-50 text-indigo-600 dark:bg-slate-800 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            title="Dark Mode"
          >
            <Moon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTheme('system')}
            className={`p-1.5 rounded-md cursor-pointer transition-colors ${theme === 'system' ? 'bg-indigo-50 text-indigo-600 dark:bg-slate-800 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            title="System Preference"
          >
            <Laptop className="w-4 h-4" />
          </button>
        </div>

        {/* Real-time Notifications Bell */}
        <NotificationBell />

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2 cursor-pointer focus:outline-none"
          >
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 font-semibold text-xs overflow-hidden select-none">
              {user?.profilePhoto ? (
                <img src={user.profilePhoto} alt={user.fullName} className="w-full h-full object-cover" />
              ) : (
                user?.fullName?.charAt(0) || 'U'
              )}
            </div>
          </button>

          {profileDropdownOpen && (
            <>
              {/* Backdrop to close click-away */}
              <div className="fixed inset-0 z-10" onClick={() => setProfileDropdownOpen(false)} />
              
              <div className="absolute right-0 mt-2.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 z-20 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-500 font-medium">Signed in as</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{user?.fullName}</p>
                </div>
                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    navigate('/profile');
                  }}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 w-full text-left cursor-pointer"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <span>My Profile</span>
                </button>
                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    clearAuth();
                  }}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 w-full text-left cursor-pointer border-t border-slate-100 dark:border-slate-800"
                >
                  <LogOut className="w-4 h-4 text-red-400" />
                  <span>Logout</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
