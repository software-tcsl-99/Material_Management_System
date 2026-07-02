import React from 'react';

const Badge = ({
  children,
  variant = 'default', // 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  className = '',
  ...props
}) => {
  const styles = {
    default: 'bg-primary-light text-primary border-primary/20 dark:bg-primary/20 dark:text-primary-100 dark:border-primary/30',
    success: 'bg-success-light text-success border-success/20 dark:bg-success/20 dark:text-emerald-400 dark:border-success/30',
    warning: 'bg-warning-light text-warning border-warning/20 dark:bg-warning/20 dark:text-amber-400 dark:border-warning/30',
    danger: 'bg-danger-light text-danger border-danger/20 dark:bg-danger/20 dark:text-rose-400 dark:border-danger/30',
    info: 'bg-info-light text-info border-info/20 dark:bg-info/20 dark:text-sky-400 dark:border-info/30',
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
