'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
  removeEventListener: (type: 'release', listener: () => void) => void;
}

interface NavigatorWithWakeLock {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
}

export interface UseWakeLockResult {
  isSupported: boolean;
  isActive: boolean;
  error: string | null;
  requestWakeLock: () => Promise<void>;
  releaseWakeLock: () => Promise<void>;
}

/**
 * Manages the Screen Wake Lock API during Live training sessions
 * and automatically re-acquires the lock when returning to the tab (visibilitychange).
 */
export function useWakeLock(enabled: boolean): UseWakeLockResult {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const nav = navigator as unknown as NavigatorWithWakeLock;
      setIsSupported(Boolean(nav.wakeLock?.request));
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (typeof navigator === 'undefined') return;
    const nav = navigator as unknown as NavigatorWithWakeLock;
    if (!nav.wakeLock?.request) return;

    try {
      if (sentinelRef.current && !sentinelRef.current.released) {
        setIsActive(true);
        return;
      }

      const sentinel = await nav.wakeLock.request('screen');
      sentinelRef.current = sentinel;
      setIsActive(true);
      setError(null);

      const handleRelease = () => {
        setIsActive(false);
      };
      sentinel.addEventListener('release', handleRelease);
    } catch (err) {
      setIsActive(false);
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de maintenir l’écran allumé.'
      );
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    if (sentinel && !sentinel.released) {
      try {
        await sentinel.release();
      } catch {
        // Ignore release errors
      }
    }
    setIsActive(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      void requestWakeLock();
    } else {
      void releaseWakeLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabledRef.current) {
        void requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void releaseWakeLock();
    };
  }, [enabled, requestWakeLock, releaseWakeLock]);

  return {
    isSupported,
    isActive,
    error,
    requestWakeLock,
    releaseWakeLock,
  };
}
