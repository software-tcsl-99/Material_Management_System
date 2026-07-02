import { Bell, Check, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useNotificationStore from '../../store/notificationStore';

const NotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotificationStore();

  const handleNotificationClick = async (notification) => {
    setOpen(false);
    if (!notification.isRead) {
      await markAsRead(notification._id);
    }
    if (notification.relatedTransaction) {
      const txId = notification.relatedTransaction?._id || notification.relatedTransaction;
      if (txId) navigate(`/transactions/${txId}`);
    }
  };

  const getRelativeTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg relative cursor-pointer focus:outline-none"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-bold ring-2 ring-white dark:ring-slate-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {open && (
        <>
          {/* Close click-away handler */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          <div className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 flex flex-col overflow-hidden max-h-[480px] animate-fade-in">
            {/* Header */}
            <div className="px-4.5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
              <span className="font-semibold text-sm text-slate-900 dark:text-white">
                Notifications
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs font-bold text-primary dark:text-primary-100 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {loading && notifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-400 font-medium">
                  No notifications yet.
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification._id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors ${!notification.isRead ? 'bg-indigo-50/20 dark:bg-indigo-950/10' : ''}`}
                  >
                    {/* Unread dot */}
                    <div className="pt-1.5 shrink-0">
                      <span className={`block w-2 h-2 rounded-full ${!notification.isRead ? 'bg-indigo-600' : 'bg-transparent'}`} />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white mb-0.5">
                        {notification.title}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {notification.message}
                      </p>
                      <span className="text-[10px] text-slate-400 font-medium mt-1.5 block">
                        {getRelativeTime(notification.createdAt)}
                      </span>
                    </div>
                    {notification.relatedTransaction && (
                      <div className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 self-center shrink-0">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
