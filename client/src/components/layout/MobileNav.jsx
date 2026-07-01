import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, Bell, MessageSquare, User } from 'lucide-react';

const MobileNav = () => {
  const items = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Movement', path: '/transactions', icon: ArrowLeftRight },
    { label: 'Approvals', path: '/pending', icon: Bell },
    { label: 'Chat', path: '#', icon: MessageSquare, isChatTrigger: true },
    { label: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-slate-800 flex items-center justify-around z-30 px-2 pb-safe text-slate-400">
      {items.map((item) => {
        if (item.isChatTrigger) {
          return (
            <button
              key={item.label}
              onClick={() => {
                // Dispatch custom event to trigger floating chat drawer
                const event = new CustomEvent('open-global-chat');
                window.dispatchEvent(event);
              }}
              className="flex flex-col items-center justify-center gap-1 py-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="text-[9px] tracking-wide uppercase font-bold">
                {item.label}
              </span>
            </button>
          );
        }

        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex flex-col items-center justify-center gap-1 py-1 rounded-lg transition-colors cursor-pointer
              ${isActive 
                ? 'text-blue-400 font-extrabold' 
                : 'text-slate-400 hover:text-white'
              }
            `}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span className="text-[9px] tracking-wide uppercase font-bold">
              {item.label}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
};

export default MobileNav;
