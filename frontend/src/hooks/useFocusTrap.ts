import { useEffect, useRef } from 'react';

export const FOCUSABLE_ELEMENTS_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface UseFocusTrapOptions {
  isOpen: boolean;
  onClose: () => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Accessible Focus Trap Hook complying with WAI-ARIA Modal Dialog Pattern.
 * - Traps Tab / Shift+Tab within modal bounds
 * - Closes modal on Escape key
 * - Focuses first interactive element upon open
 * - Restores focus to the triggering element upon close
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
  initialFocusRef,
  returnFocusRef,
}: UseFocusTrapOptions) {
  const containerRef = useRef<T | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Capture currently focused element before opening modal
    previouslyFocusedRef.current = (returnFocusRef?.current || document.activeElement) as HTMLElement | null;

    const container = containerRef.current;
    if (!container) return;

    // Set initial focus
    const focusTimer = setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else {
        const focusables = Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS_SELECTOR)
        );
        if (focusables.length > 0) {
          focusables[0].focus();
        } else {
          container.focus();
        }
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Close on Escape
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      // 2. Trap Tab navigation
      if (e.key === 'Tab') {
        const focusables = Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS_SELECTOR)
        ).filter(
          (el) =>
            el.offsetParent !== null ||
            el.offsetWidth > 0 ||
            el.offsetHeight > 0 ||
            el.getAttribute('tabindex') !== '-1'
        );

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];
        const activeEl = document.activeElement;

        if (e.shiftKey) {
          // Backward tab: if on first element or outside, cycle to last element
          if (activeEl === firstElement || !container.contains(activeEl)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Forward tab: if on last element or outside, cycle to first element
          if (activeEl === lastElement || !container.contains(activeEl)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown, true);

      // Return focus to previous element upon closing
      if (previouslyFocusedRef.current && typeof previouslyFocusedRef.current.focus === 'function') {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [isOpen, onClose, initialFocusRef, returnFocusRef]);

  return containerRef;
}

export default useFocusTrap;
