'use client';

import { useState, useCallback, useEffect } from 'react';

export function useSoundEffects() {
  const [muted, setMuted] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem('bluff_sound_muted');
    if (saved !== null) {
      setMuted(saved === 'true');
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      localStorage.setItem('bluff_sound_muted', String(next));
      return next;
    });
  }, []);

  const playTone = useCallback(
    (freq: number, type: OscillatorType = 'sine', duration: number = 0.1, gainVal: number = 0.15) => {
      if (muted || typeof window === 'undefined') return;
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(gainVal, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch {
        // Ignore audio play errors
      }
    },
    [muted]
  );

  const playCardClick = useCallback(() => {
    playTone(600, 'triangle', 0.05, 0.1);
  }, [playTone]);

  const playCardPlay = useCallback(() => {
    playTone(440, 'sine', 0.12, 0.2);
    setTimeout(() => playTone(880, 'sine', 0.08, 0.15), 50);
  }, [playTone]);

  const playPass = useCallback(() => {
    playTone(320, 'sine', 0.15, 0.1);
  }, [playTone]);

  const playChallengeStart = useCallback(() => {
    playTone(250, 'sawtooth', 0.3, 0.25);
    setTimeout(() => playTone(350, 'sawtooth', 0.3, 0.25), 100);
  }, [playTone]);

  const playBluffSuccess = useCallback(() => {
    // Triumphant sound
    playTone(523.25, 'triangle', 0.15, 0.25); // C5
    setTimeout(() => playTone(659.25, 'triangle', 0.15, 0.25), 120); // E5
    setTimeout(() => playTone(783.99, 'triangle', 0.3, 0.3), 240); // G5
  }, [playTone]);

  const playBluffFailed = useCallback(() => {
    // Wah wah sound
    playTone(350, 'sawtooth', 0.2, 0.2);
    setTimeout(() => playTone(280, 'sawtooth', 0.3, 0.25), 180);
  }, [playTone]);

  const playVictory = useCallback(() => {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 'triangle', 0.3, 0.3), i * 150);
    });
  }, [playTone]);

  return {
    muted,
    toggleMute,
    playCardClick,
    playCardPlay,
    playPass,
    playChallengeStart,
    playBluffSuccess,
    playBluffFailed,
    playVictory,
  };
}
