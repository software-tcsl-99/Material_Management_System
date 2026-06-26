import React from 'react';

const Badge = ({
  children,
  variant = 'default', // 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  className = '',
  ...props
}) => {
  const styles = {
    default: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800/40',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40',
    danger: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/40',
    info: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800/40',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  };

  const getStatusVariant = (status) => {
    if (!status) return 'neutral';
    const lower = status.toLowerCase();
    
    if (['accepted', 'completed', 'active', 'success'].includes(lower)) return 'success';
    if (['pending', 'warning', 'resubmitted'].includes(lower)) return 'warning';
    if (['rejected', 'disabled', 'danger'].includes(lower)) return 'danger';
    if (['draft', 'inactive'].includes(lower)) return 'neutral';
    if (['info', 'assigned'].includes(lower)) return 'info';
    return 'default';
  };

  const activeVariant = styles[variant] || styles[getStatusVariant(children)];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${activeVariant} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
