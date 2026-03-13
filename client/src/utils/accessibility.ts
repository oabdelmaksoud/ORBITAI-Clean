/**
 * Accessibility Utilities
 * Helper functions for improving accessibility
 */

/**
 * Generate ARIA label for interactive elements
 */
export function getAriaLabel(element: string, action?: string): string {
  if (action) {
    return `${action} ${element}`;
  }
  return element;
}

/**
 * Check if element should be focusable
 */
export function shouldBeFocusable(isInteractive: boolean, isVisible: boolean): boolean {
  return isInteractive && isVisible;
}

/**
 * Generate keyboard shortcut hint
 */
export function getKeyboardHint(shortcut: string): string {
  return `Keyboard shortcut: ${shortcut}`;
}

/**
 * Skip to main content link (for screen readers)
 */
export function createSkipLink(): string {
  return 'Skip to main content';
}

/**
 * Announce changes to screen readers
 */
export function announceToScreenReader(message: string): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Focus management helper
 */
export function trapFocus(element: HTMLElement): () => void {
  const focusableElements = element.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleTab = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };

  element.addEventListener('keydown', handleTab);

  return () => {
    element.removeEventListener('keydown', handleTab);
  };
}


