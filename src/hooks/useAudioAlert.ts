'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type WebkitWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export interface UseAudioAlertResult {
  isUnlocked: boolean;
  isFlashing: boolean;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  /** Must be called synchronously inside the user click handler (e.g. "Démarrer") to unlock iOS Chrome audio */
  unlock: () => void;
  /** Synthesizes a clear double-beep without external MP3 + triggers full-screen visual flash */
  triggerTimerEndAlert: () => void;
  /** Plays a short confirmation beep for testing */
  playTestBeep: () => void;
}

/**
 * Pure Web Audio API double-beep synthesizer + full-screen visual flash fallback
 * designed for iPhone Chrome (where navigator.vibrate is inactive).
 */
export function useAudioAlert(): UseAudioAlertResult {
  const ctxRef = useRef<AudioContext | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [muted, setMuted] = useState(false);

  const ensureContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!ctxRef.current) {
      const AudioCtor =
        window.AudioContext || (window as WebkitWindow).webkitAudioContext;
      if (!AudioCtor) return null;
      ctxRef.current = new AudioCtor();
    }
    return ctxRef.current;
  }, []);

  const unlock = useCallback(() => {
    const ctx = ensureContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    // Play a silent 1-sample buffer synchronously to reliably unlock iOS Safari / Chrome audio
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      setIsUnlocked(true);
    } catch {
      // Ignore unlock errors
    }
  }, [ensureContext]);

  const scheduleTone = useCallback(
    (
      ctx: AudioContext,
      startTime: number,
      frequencyHz: number,
      durationSec: number,
      peakGain = 0.45
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequencyHz, startTime);

      // Clean attack/release envelope to eliminate audio clicks
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.015);
      gain.gain.setValueAtTime(peakGain, startTime + Math.max(0.02, durationSec - 0.04));
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + durationSec + 0.01);
    },
    []
  );

  const playDoubleBeep = useCallback(() => {
    if (muted) return;
    const ctx = ensureContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const now = ctx.currentTime + 0.02;
    // Beep 1 (880 Hz A5)
    scheduleTone(ctx, now, 880, 0.22, 0.5);
    // Pause 120ms -> Beep 2 (1174.66 Hz D6, brighter & louder so it carries across a gym)
    scheduleTone(ctx, now + 0.34, 1174.66, 0.32, 0.55);
  }, [ensureContext, muted, scheduleTone]);

  const triggerVisualFlash = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (flashTimeoutRef.current !== null) {
      window.clearTimeout(flashTimeoutRef.current);
    }
    setIsFlashing(false);
    // Restart animation cleanly on next animation frame
    window.requestAnimationFrame(() => {
      setIsFlashing(true);
      flashTimeoutRef.current = window.setTimeout(() => {
        setIsFlashing(false);
        flashTimeoutRef.current = null;
      }, 1900);
    });
  }, []);

  const triggerTimerEndAlert = useCallback(() => {
    playDoubleBeep();
    triggerVisualFlash();
  }, [playDoubleBeep, triggerVisualFlash]);

  const playTestBeep = useCallback(() => {
    unlock();
    playDoubleBeep();
    triggerVisualFlash();
  }, [playDoubleBeep, triggerVisualFlash, unlock]);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current !== null) {
        window.clearTimeout(flashTimeoutRef.current);
      }
      if (ctxRef.current) {
        void ctxRef.current.close().catch(() => undefined);
      }
    };
  }, []);

  return {
    isUnlocked,
    isFlashing,
    muted,
    setMuted,
    unlock,
    triggerTimerEndAlert,
    playTestBeep,
  };
}
