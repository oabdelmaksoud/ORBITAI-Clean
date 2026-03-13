import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  showText?: boolean;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  animated = false, 
  showText = true,
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl'
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div 
        className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center ${
          animated ? 'animate-pulse' : ''
        }`}
      >
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          className="w-full h-full p-1.5"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle 
            cx="12" 
            cy="12" 
            r="8" 
            stroke="white" 
            strokeWidth="2" 
            fill="none"
          />
          <circle 
            cx="12" 
            cy="12" 
            r="3" 
            fill="white"
          />
          <path 
            d="M12 4 L12 8 M12 16 L12 20 M4 12 L8 12 M16 12 L20 12" 
            stroke="white" 
            strokeWidth="1.5" 
            strokeLinecap="round"
          />
        </svg>
      </div>
      {showText && (
        <span className={`font-bold text-slate-800 ${textSizeClasses[size]}`}>
          Orbit<span className="text-primary">AI</span>
        </span>
      )}
    </div>
  );
};

export default Logo;

