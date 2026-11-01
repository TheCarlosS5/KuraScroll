import { useState, useRef, useEffect, useCallback } from 'react';
import gsap from 'gsap';

export type ZenState = 'INACTIVE' | 'ENTERING' | 'ACTIVE' | 'EXITING';

export interface UseZenModeGSAPOptions {
  /** Callback fired when Zen mode is fully activated */
  onEnter?: () => void;
  /** Callback fired when Zen mode is fully deactivated */
  onExit?: () => void;
  /** Initial zen state */
  initialActive?: boolean;
  /** Whether to trigger document fullscreen request */
  enableNativeFullscreen?: boolean;
  /** Force low resource mode (e.g. Intel GMA 4500MHD fallback) */
  lowResourceMode?: boolean;
}

export interface UseZenModeGSAPReturn {
  zenState: ZenState;
  isZen: boolean;
  toggleZen: () => void;
  enterZen: () => void;
  exitZen: () => void;
  uiElementsRef: React.MutableRefObject<HTMLElement[]>;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  ambilightRef: React.RefObject<HTMLDivElement | null>;
  registerUiElement: (el: HTMLElement | null) => void;
}

/**
 * Custom React 19 hook orchestrating Fullscreen & Zen Immersion Mode
 * with GSAP 3 timelines, keyboard listener ('F'), and low-resource GPU optimizations.
 */
export function useZenModeGSAP(options: UseZenModeGSAPOptions = {}): UseZenModeGSAPReturn {
  const {
    onEnter,
    onExit,
    initialActive = false,
    enableNativeFullscreen = false,
    lowResourceMode = false,
  } = options;

  const [zenState, setZenState] = useState<ZenState>(initialActive ? 'ACTIVE' : 'INACTIVE');
  const zenStateRef = useRef<ZenState>(initialActive ? 'ACTIVE' : 'INACTIVE');

  // Refs for animated DOM nodes
  const uiElementsRef = useRef<HTMLElement[]>([]);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const ambilightRef = useRef<HTMLDivElement | null>(null);

  // Keep zenStateRef in sync with state
  useEffect(() => {
    zenStateRef.current = zenState;
  }, [zenState]);

  // Register helper for UI elements (header, controls, floating buttons)
  const registerUiElement = useCallback((el: HTMLElement | null) => {
    if (el && !uiElementsRef.current.includes(el)) {
      uiElementsRef.current.push(el);
    }
  }, []);

  // Enter Zen mode transition
  const enterZen = useCallback(() => {
    const currentState = zenStateRef.current;
    if (currentState === 'ACTIVE' || currentState === 'ENTERING') {
      return; // Already active or transitioning
    }

    setZenState('ENTERING');

    // Optional native browser fullscreen
    if (enableNativeFullscreen && typeof document !== 'undefined') {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {
          // Ignore rejection if user gesture was missing
        });
      }
    }

    const duration = lowResourceMode ? 0.15 : 0.35;
    const tl = gsap.timeline({
      defaults: { ease: 'power3.inOut' },
      onComplete: () => {
        setZenState('ACTIVE');
        onEnter?.();
      },
    });

    // 1. Hide UI Chrome & HUD
    if (uiElementsRef.current.length > 0) {
      tl.to(
        uiElementsRef.current,
        {
          autoAlpha: 0,
          y: (i) => (i % 2 === 0 ? -20 : 20),
          scale: 0.98,
          duration,
          stagger: lowResourceMode ? 0 : 0.02,
          pointerEvents: 'none',
        },
        0
      );
    }

    // 2. Expand Canvas
    if (canvasRef.current) {
      tl.to(
        canvasRef.current,
        {
          scale: lowResourceMode ? 1.0 : 1.015,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
          duration: duration * 1.2,
        },
        0
      );
    }

    // 3. Aura expansion
    if (ambilightRef.current) {
      tl.to(
        ambilightRef.current,
        {
          opacity: 1.25,
          scale: lowResourceMode ? 1.05 : 1.15,
          duration: duration * 1.3,
        },
        0
      );
    }
  }, [enableNativeFullscreen, lowResourceMode, onEnter]);

  // Exit Zen mode transition
  const exitZen = useCallback(() => {
    const currentState = zenStateRef.current;
    if (currentState === 'INACTIVE' || currentState === 'EXITING') {
      return; // Already inactive or transitioning
    }

    setZenState('EXITING');

    // Exit native fullscreen if active
    if (enableNativeFullscreen && typeof document !== 'undefined') {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }

    const duration = lowResourceMode ? 0.15 : 0.35;
    const tl = gsap.timeline({
      defaults: { ease: 'power3.inOut' },
      onComplete: () => {
        setZenState('INACTIVE');
        onExit?.();
      },
    });

    // 1. Restore UI Chrome & HUD
    if (uiElementsRef.current.length > 0) {
      tl.to(
        uiElementsRef.current,
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration,
          stagger: lowResourceMode ? 0 : 0.02,
          pointerEvents: 'auto',
        },
        0
      );
    }

    // 2. Restore Canvas
    if (canvasRef.current) {
      tl.to(
        canvasRef.current,
        {
          scale: 1,
          boxShadow: '0 0px 0px 0px rgba(0, 0, 0, 0)',
          duration: duration * 1.2,
        },
        0
      );
    }

    // 3. Restore Aura
    if (ambilightRef.current) {
      tl.to(
        ambilightRef.current,
        {
          opacity: 1,
          scale: 1,
          duration: duration * 1.3,
        },
        0
      );
    }
  }, [enableNativeFullscreen, lowResourceMode, onExit]);

  // Toggle Zen mode
  const toggleZen = useCallback(() => {
    const current = zenStateRef.current;
    if (current === 'ACTIVE' || current === 'ENTERING') {
      exitZen();
    } else {
      enterZen();
    }
  }, [enterZen, exitZen]);

  // Global keybinding: 'F' key toggles Zen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard against typing in forms, text inputs, search boxes
      const target = e.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
          return;
        }
        if (target.isContentEditable) {
          return;
        }
      }

      if (e.key === 'f' || e.key === 'F') {
        // Only trigger if not holding modifier keys (Ctrl/Alt/Meta)
        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          toggleZen();
        }
      } else if (e.key === 'Escape') {
        // Escape can exit Zen mode if active
        if (zenStateRef.current === 'ACTIVE') {
          e.preventDefault();
          exitZen();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleZen, exitZen]);

  // React 19 Strict Mode safe cleanup of GSAP tweens
  useEffect(() => {
    return () => {
      if (uiElementsRef.current.length > 0) {
        gsap.killTweensOf(uiElementsRef.current);
      }
      if (canvasRef.current) {
        gsap.killTweensOf(canvasRef.current);
      }
      if (ambilightRef.current) {
        gsap.killTweensOf(ambilightRef.current);
      }
    };
  }, []);

  return {
    zenState,
    isZen: zenState === 'ACTIVE' || zenState === 'ENTERING',
    toggleZen,
    enterZen,
    exitZen,
    uiElementsRef,
    canvasRef,
    ambilightRef,
    registerUiElement,
  };
}
