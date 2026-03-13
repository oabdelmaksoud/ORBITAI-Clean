/**
 * useMaximize Hook
 * A custom hook for managing maximize/fullscreen state
 * 
 * Features:
 * - Simple state management
 * - Keyboard shortcuts
 * - Body scroll lock
 * - Native fullscreen API support
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import screenfull from 'screenfull';
import type { Screenfull } from 'screenfull';

export interface UseMaximizeOptions {
  /**
   * Use native browser fullscreen API
   * @default false
   */
  useNative?: boolean;
  /**
   * Element to make fullscreen (for native API)
   */
  elementRef?: React.RefObject<HTMLElement>;
  /**
   * Disable ESC key to exit
   * @default false
   */
  disableEscape?: boolean;
  /**
   * Callback when fullscreen state changes
   */
  onStateChange?: (isFullscreen: boolean) => void;
}

export interface UseMaximizeReturn {
  isFullscreen: boolean;
  toggle: () => Promise<void>;
  enter: () => Promise<void>;
  exit: () => Promise<void>;
}

export const useMaximize = (options: UseMaximizeOptions = {}): UseMaximizeReturn => {
  const {
    useNative = false,
    elementRef,
    disableEscape = false,
    onStateChange,
  } = options;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const wasFullscreenRef = useRef(false);

  // Handle native fullscreen API
  useEffect(() => {
    if (!useNative || !screenfull.isEnabled) return;

    const handleChange = () => {
      const isNowFullscreen = (screenfull as Screenfull).isFullscreen;
      setIsFullscreen(isNowFullscreen);
      onStateChange?.(isNowFullscreen);
    };

    (screenfull as Screenfull).on('change', handleChange);

    return () => {
      (screenfull as Screenfull).off('change', handleChange);
    };
  }, [useNative, onStateChange]);

  // Handle ESC key
  useEffect(() => {
    if (useNative || disableEscape || !isFullscreen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exit();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isFullscreen, useNative, disableEscape]);

  // Lock body scroll
  useEffect(() => {
    if (useNative || !isFullscreen) return;

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
  }, [isFullscreen, useNative]);

  const enter = useCallback(async () => {
    if (useNative && screenfull.isEnabled && elementRef?.current) {
      await (screenfull as Screenfull).request(elementRef.current);
    } else {
      setIsFullscreen(true);
      onStateChange?.(true);
    }
  }, [useNative, elementRef, onStateChange]);

  const exit = useCallback(async () => {
    if (useNative && screenfull.isEnabled) {
      await (screenfull as Screenfull).exit();
    } else {
      setIsFullscreen(false);
      onStateChange?.(false);
    }
  }, [useNative, onStateChange]);

  const toggle = useCallback(async () => {
    if (isFullscreen) {
      await exit();
    } else {
      await enter();
    }
  }, [isFullscreen, enter, exit]);

  return {
    isFullscreen,
    toggle,
    enter,
    exit,
  };
};

