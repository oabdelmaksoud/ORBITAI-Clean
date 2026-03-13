import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  content, 
  children, 
  position = 'top',
  delay = 200,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (isVisible && tooltipRef.current && triggerRef.current) {
      const tooltip = tooltipRef.current;
      const trigger = triggerRef.current;
      const rect = trigger.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      
      // Auto-adjust position if tooltip would go off-screen
      let newPosition = position;
      if (position === 'top' && rect.top < tooltipRect.height + 10) {
        newPosition = 'bottom';
      } else if (position === 'bottom' && window.innerHeight - rect.bottom < tooltipRect.height + 10) {
        newPosition = 'top';
      } else if (position === 'left' && rect.left < tooltipRect.width + 10) {
        newPosition = 'right';
      } else if (position === 'right' && window.innerWidth - rect.right < tooltipRect.width + 10) {
        newPosition = 'left';
      }
      setActualPosition(newPosition);
    }
  }, [isVisible, position]);

  const showTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-800 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-800 border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-800 border-t-transparent border-b-transparent border-l-transparent'
  };

  return (
    <div 
      ref={triggerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`absolute z-[9999] px-3 py-2 text-xs font-medium text-white bg-slate-800 rounded-lg shadow-lg whitespace-normal max-w-xs pointer-events-none animate-in fade-in zoom-in-95 duration-200 ${positionClasses[actualPosition]}`}
          role="tooltip"
        >
          {content}
          <div className={`absolute w-0 h-0 border-4 ${arrowClasses[actualPosition]}`} />
        </div>
      )}
    </div>
  );
};

interface HelpIconProps {
  content: string;
  className?: string;
}

export const HelpIcon: React.FC<HelpIconProps> = ({ content, className = '' }) => {
  return (
    <Tooltip content={content}>
      <HelpCircle size={14} className={`text-slate-400 hover:text-slate-600 cursor-help ${className}`} />
    </Tooltip>
  );
};

export default Tooltip;

