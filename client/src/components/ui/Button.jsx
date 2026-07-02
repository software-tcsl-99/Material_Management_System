import React from 'react';

const Button = React.forwardRef(({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  onClick,
  icon: Icon,
  ...props
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] cursor-pointer';
  
  const variants = {
    primary: 'bg-primary hover:bg-primary-dark text-white focus:ring-primary shadow-md hover:shadow-primary/20',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-900 focus:ring-slate-400 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100',
    outline: 'border border-slate-300 bg-transparent hover:bg-slate-50 text-slate-700 focus:ring-primary dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-300',
    danger: 'bg-danger hover:bg-danger-dark text-white focus:ring-danger shadow-md',
    success: 'bg-success hover:bg-success-dark text-white focus:ring-success shadow-md',
    ghost: 'hover:bg-slate-100 text-slate-700 hover:text-slate-950 focus:ring-slate-400 dark:hover:bg-slate-800 dark:text-slate-300 dark:hover:text-slate-100',
  };

  const sizes = {
    xs: 'text-[10px] px-2 py-1 gap-1',
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {!loading && Icon && <Icon className="w-4 h-4 shrink-0" />}
      {children}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
