import React, { ReactNode } from 'react';

interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  'aria-label': string;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Accessible button component with built-in ARIA support
 * Ensures all buttons have proper labels and keyboard support
 */
export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  children,
  icon,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-primary text-white hover:bg-blue-700',
    secondary: 'bg-slate-200 text-slate-700 hover:bg-slate-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100'
  };
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs min-h-[32px]',
    md: 'px-4 py-2 text-sm min-h-[44px]',
    lg: 'px-6 py-3 text-base min-h-[48px]'
  };
  
  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
};






