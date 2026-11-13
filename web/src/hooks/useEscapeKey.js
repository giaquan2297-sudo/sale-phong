import { useEffect, useRef } from 'react';

const escapeStack = [];
let listenerAttached = false;

function handleGlobalKeyDown(e) {
  if (e.key !== 'Escape' || escapeStack.length === 0) return;
  const top = escapeStack[escapeStack.length - 1];
  if (top?.current) {
    e.preventDefault();
    top.current();
  }
}

/**
 * Register an Escape key handler on a stack so only the topmost open modal/drawer closes.
 */
export function useEscapeKey(onEscape, enabled = true) {
  const callbackRef = useRef(onEscape);
  callbackRef.current = onEscape;

  useEffect(() => {
    if (!enabled) return undefined;

    if (!listenerAttached) {
      document.addEventListener('keydown', handleGlobalKeyDown);
      listenerAttached = true;
    }

    escapeStack.push(callbackRef);
    return () => {
      const idx = escapeStack.lastIndexOf(callbackRef);
      if (idx !== -1) {
        escapeStack.splice(idx, 1);
      }
      if (escapeStack.length === 0 && listenerAttached) {
        document.removeEventListener('keydown', handleGlobalKeyDown);
        listenerAttached = false;
      }
    };
  }, [enabled]);
}
