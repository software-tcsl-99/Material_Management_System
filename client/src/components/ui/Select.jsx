import React from 'react';

const Select = React.forwardRef(({
  label,
  options = [],
  error,
  icon: Icon,
  className = '',
  id,
  required,
  placeholder = 'Select an option',
  ...props
}, ref) => {
  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative rounded-lg shadow-sm">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <select
          ref={ref}
          id={id}
          className={`
            block w-full rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 appearance-none
            ${Icon ? 'pl-10' : 'pl-3.5'} pr-10 py-2.5
            bg-white text-slate-900 border-slate-300 focus:ring-primary focus:border-primary
            dark:bg-slate-900 dark:text-white dark:border-slate-700 dark:focus:ring-primary
            ${error 
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500 dark:border-red-500' 
              : 'border-slate-300 focus:ring-primary dark:border-slate-700'
            }
            disabled:bg-slate-50 disabled:text-slate-400 dark:disabled:bg-slate-950 dark:disabled:text-slate-600
            cursor-pointer
          `}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-500 font-medium">
          {error.message || error}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
