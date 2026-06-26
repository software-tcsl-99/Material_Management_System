import { Eye, EyeOff } from 'lucide-react';
import React, { useState } from 'react';

const Input = React.forwardRef(({
  label,
  type = 'text',
  error,
  icon: Icon,
  className = '',
  id,
  required,
  ...props
}, ref) => {
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';

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
        <input
          ref={ref}
          id={id}
          type={isPassword ? (visible ? 'text' : 'password') : type}
          className={`
            block w-full rounded-lg border text-sm transition-all focus:outline-none focus:ring-2
            ${Icon ? 'pl-10' : 'pl-3.5'} pr-10 py-2.5
            bg-white text-slate-900 border-slate-300 focus:ring-indigo-500 focus:border-indigo-500
            dark:bg-slate-900 dark:text-white dark:border-slate-700 dark:focus:ring-indigo-500
            ${error
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500 dark:border-red-500'
              : 'border-slate-300 focus:ring-indigo-500 dark:border-slate-700'
            }
            disabled:bg-slate-50 disabled:text-slate-400 dark:disabled:bg-slate-950 dark:disabled:text-slate-600
          `}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500"
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-500 font-medium">
          {error.message || error}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
