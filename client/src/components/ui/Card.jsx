import React from 'react';

const Card = ({
  children,
  className = '',
  title,
  subtitle,
  headerAction,
  ...props
}) => {
  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden ${className}`}
      {...props}
    >
      {(title || subtitle || headerAction) && (
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            {title && (
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};

export const StatsCard = ({
  title,
  value,
  icon: Icon,
  trend,
  trendDirection = 'up', // 'up' | 'down' | 'neutral'
  className = '',
  iconColor = 'text-primary dark:text-primary-100 bg-indigo-50 dark:bg-indigo-950/40',
  ...props
}) => {
  const trendColors = {
    up: 'text-emerald-600 dark:text-emerald-400',
    down: 'text-red-600 dark:text-red-400',
    neutral: 'text-slate-500 dark:text-slate-400',
  };

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 sm:p-5 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow min-w-0 ${className}`}
      {...props}
    >
      <div className="flex flex-col gap-1 min-w-0">
        <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
          {title}
        </span>
        <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {value}
        </span>
        {trend && (
          <span className={`text-xs font-medium flex items-center gap-1 ${trendColors[trendDirection]}`}>
            {trend}
          </span>
        )}
      </div>
      {Icon && (
        <div className={`p-2 sm:p-3.5 rounded-xl ${iconColor} shrink-0`}>
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
        </div>
      )}
    </div>
  );
};

export default Card;
