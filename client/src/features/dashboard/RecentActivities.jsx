import React from 'react';
import Card from '../../components/ui/Card';

const RecentActivities = ({ activities = [] }) => {
  const getFormattedTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return date.toLocaleDateString();
  };

  // Show all recent activities (already limited to 20 by the server)
  const recentActivities = activities;

  return (
    <Card title="Activity Feed" subtitle="Recent system events and operations">
      <div className="flow-root mt-2">
        <ul className="-my-5 divide-y divide-slate-100 dark:divide-slate-800">
          {recentActivities.length === 0 ? (
            <li className="py-8 text-center text-xs text-slate-400">No activity logs recorded.</li>
          ) : (
            recentActivities.map((act) => (
              <li key={act._id} className="py-4.5">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-indigo-600 dark:text-indigo-400">
                      {act.user?.fullName?.charAt(0) || 'S'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {act.user?.fullName || 'System Event'} 
                      <span className="font-normal text-slate-500 dark:text-slate-400"> {act.action}</span>
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {act.details}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-[10px] text-slate-400 font-medium">
                    {getFormattedTime(act.createdAt)}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </Card>
  );
};

export default RecentActivities;
