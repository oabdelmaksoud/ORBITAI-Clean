/**
 * MaximizeView Component
 * A reusable fullscreen/maximize component using screenfull.js
 * 
 * Features:
 * - Cross-browser fullscreen support
 * - Keyboard shortcuts (ESC to exit)
 * - Smooth animations
 * - Proper z-index management
 * - Body scroll lock
 * - Portal rendering for proper layering
 */

import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, X } from 'lucide-react';
import screenfull from 'screenfull';
import type { Screenfull } from 'screenfull';

export interface MaximizeViewProps {
  children: ReactNode;
  /**
   * Whether to use native browser fullscreen API (true) or custom overlay (false)
   * @default false
   */
  useNativeFullscreen?: boolean;
  /**
   * Custom className for the maximize button
   */
  buttonClassName?: string;
  /**
   * Custom className for the fullscreen container
   */
  containerClassName?: string;
  /**
   * Show close button in fullscreen mode
   * @default true
   */
  showCloseButton?: boolean;
  /**
   * Callback when fullscreen state changes
   */
  onFullscreenChange?: (isFullscreen: boolean) => void;
  /**
   * Custom backdrop color/opacity
   * @default 'bg-black/50'
   */
  backdropClassName?: string;
  /**
   * Z-index for the fullscreen overlay
   * @default 99999
   */
  zIndex?: number;
  /**
   * Disable ESC key to exit
   * @default false
   */
  disableEscape?: boolean;
  /**
   * Custom render function for the maximize button
   */
  renderButton?: (isFullscreen: boolean, toggle: () => void) => ReactNode;
}

const MaximizeView: React.FC<MaximizeViewProps> = ({
  children,
  useNativeFullscreen = false,
  buttonClassName = '',
  containerClassName = '',
  showCloseButton = true,
  onFullscreenChange,
  backdropClassName = 'bg-black/50 backdrop-blur-sm',
  zIndex = 99999,
  disableEscape = false,
  renderButton,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wasFullscreenRef = useRef(false);

  // Handle native fullscreen API
  useEffect(() => {
    if (!useNativeFullscreen || !screenfull.isEnabled) return;

    const handleChange = () => {
      const isNowFullscreen = (screenfull as Screenfull).isFullscreen;
      setIsFullscreen(isNowFullscreen);
      onFullscreenChange?.(isNowFullscreen);
    };

    (screenfull as Screenfull).on('change', handleChange);

    return () => {
      (screenfull as Screenfull).off('change', handleChange);
    };
  }, [useNativeFullscreen, onFullscreenChange]);

  // Handle ESC key for custom fullscreen
  useEffect(() => {
    if (useNativeFullscreen || disableEscape || !isFullscreen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleToggle();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isFullscreen, useNativeFullscreen, disableEscape]);

  // Lock body scroll when in custom fullscreen
  useEffect(() => {
    if (useNativeFullscreen || !isFullscreen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalWidth = document.body.style.width;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = originalWidth;
    };
  }, [isFullscreen, useNativeFullscreen]);

  const handleToggle = async () => {
    if (useNativeFullscreen && screenfull.isEnabled) {
      if (containerRef.current) {
        const sf = screenfull as Screenfull;
        if (sf.isFullscreen) {
          await sf.exit();
        } else {
          await sf.request(containerRef.current);
        }
      }
    } else {
      const newState = !isFullscreen;
      setIsFullscreen(newState);
      onFullscreenChange?.(newState);
    }
  };

  const handleClose = () => {
    if (useNativeFullscreen && screenfull.isEnabled) {
      (screenfull as Screenfull).exit();
    } else {
      setIsFullscreen(false);
      onFullscreenChange?.(false);
    }
  };

  // Render maximize button
  const renderMaximizeButton = () => {
    if (renderButton) {
      return renderButton(isFullscreen, handleToggle);
    }

    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleToggle();
        }}
        className={`p-2.5 hover:bg-gradient-to-br hover:from-purple-50 hover:to-indigo-50 rounded-xl text-slate-500 hover:text-purple-600 transition-all relative group shadow-sm hover:shadow-md border border-transparent hover:border-purple-200 z-[100] pointer-events-auto ${buttonClassName}`}
        title={isFullscreen ? 'Exit Fullscreen (ESC)' : 'Enter Fullscreen'}
      >
        {isFullscreen ? (
          <Minimize2 size={16} className="relative z-[100] group-hover:scale-110 transition-transform" />
        ) : (
          <Maximize2 size={16} className="relative z-[100] group-hover:scale-110 transition-transform" />
        )}
      </button>
    );
  };

  // If using native fullscreen, wrap children
  if (useNativeFullscreen && screenfull.isEnabled) {
    return (
      <div ref={containerRef} className={containerClassName}>
        {renderMaximizeButton()}
        {children}
      </div>
    );
  }

  // Custom fullscreen overlay
  if (isFullscreen) {
    return (
      <>
        {renderMaximizeButton()}
        {createPortal(
          <div
            className={`fixed inset-0 ${backdropClassName} flex items-center justify-center animate-in fade-in zoom-in-95 duration-300`}
            style={{ zIndex }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleClose();
              }
            }}
          >
            <div
              className={`w-full h-full bg-white shadow-2xl overflow-hidden flex flex-col relative ${containerClassName}`}
              onClick={(e) => e.stopPropagation()}
            >
              {showCloseButton && (
                <div className="absolute top-4 right-4 z-[100] flex gap-2">
                  <button
                    onClick={handleClose}
                    className="p-2 bg-white/90 hover:bg-white rounded-lg shadow-lg border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                    title="Close (ESC)"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
              <div className="flex-1 overflow-auto">{children}</div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  // Normal view
  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-[100]">
        {renderMaximizeButton()}
      </div>
      <div className={containerClassName}>{children}</div>
    </div>
  );
};

export default MaximizeView;

