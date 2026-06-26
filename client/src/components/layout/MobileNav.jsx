import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, Download, User, Clock } from 'lucide-react';

const MobileNav = () => {
  const items = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Movement', path: '/transactions', icon: ArrowLeftRight },
    { label: 'Pending', path: '/pending', icon: Clock },
    { label: 'Receiving', path: '/receiving', icon: Download },
    { label: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around z-30 px-2 pb-safe">
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) => `
            flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-lg transition-colors cursor-pointer
            ${isActive 
              ? 'text-indigo-600 dark:text-indigo-400 font-semibold' 
              : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-200'
            }
          `}
        >
          <item.icon className="w-5 h-5 shrink-0" />
          <span className="text-[10px] tracking-wide uppercase font-semibold">
            {item.label}
          </span>
        </NavLink>
      ))}
    </nav>
  );
};

export default MobileNav;
