'use client';

import React, { useState } from 'react';
import { Sparkles, ArrowRight, ShieldAlert, Award, Layers } from 'lucide-react';
import { CardView } from './CardView';

interface LandingViewProps {
  initialName: string;
  onContinue: (name: string) => void;
  invitedRoomCode?: string | null;
  inviteError?: string | null;
}

export const LandingView: React.FC<LandingViewProps> = ({
  initialName,
  onContinue,
  invitedRoomCode,
  inviteError,
}) => {
  const [name, setName] = useState(initialName || '');
  const [error, setError] = useState(inviteError || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name to enter the arena');
      return;
    }
    if (trimmed.length > 20) {
      setError('Name cannot exceed 20 characters');
      return;
    }
    setError('');
    onContinue(trimmed);
  };

  return (
    <div className="relative min-h-[calc(100vh-65px)] flex flex-col items-center justify-center px-4 py-8 overflow-hidden">
      {/* Background Decorative Cards Fan */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-96 pointer-events-none opacity-20 -z-10 flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div className="absolute -rotate-12 -translate-x-24">
            <CardView faceDown size="lg" />
          </div>
          <div className="absolute rotate-0 scale-105 shadow-glow-gold">
            <CardView card={{ id: 'hero_k', rank: 'K', suit: 'spades', deckIndex: 0 }} size="lg" />
          </div>
          <div className="absolute rotate-12 translate-x-24">
            <CardView card={{ id: 'hero_a', rank: 'A', suit: 'hearts', deckIndex: 0 }} size="lg" />
          </div>
        </div>
      </div>

      <div className="w-full max-w-md mx-auto text-center z-10">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-6 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" /> Real-time Multiplayer Card Game
        </div>

        {/* Title */}
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight mb-3">
          <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent drop-shadow-sm">
            BLUFF
          </span>
        </h1>

        {/* Tagline */}
        <p className="text-lg sm:text-xl font-medium text-slate-300 mb-8 italic tracking-wide">
          &ldquo;Play your cards. Trust nobody.&rdquo;
        </p>

        {/* Invite Notice Banner if joined via link */}
        {invitedRoomCode && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-950/80 border-2 border-amber-500/60 text-amber-200 text-sm text-left shadow-glow-gold animate-bounce">
            <div className="flex items-center gap-2 font-bold text-white text-base">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>Room Invitation</span>
            </div>
            <p className="text-xs text-amber-300/90 mt-1">
              You were invited to join Room <b className="font-mono text-white text-sm bg-black/40 px-1.5 py-0.5 rounded">{invitedRoomCode}</b>. Enter your name below to jump straight in!
            </p>
          </div>
        )}

        {/* Error notification from failed invite */}
        {(error || inviteError) && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs font-semibold text-left">
            {error || inviteError}
          </div>
        )}

        {/* Form Card */}
        <div className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-700/60 text-left">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="playerNameInput" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Your Player Name
              </label>
              <div className="relative">
                <input
                  id="playerNameInput"
                  type="text"
                  value={name}
                  onChange={e => {
                    setName(e.target.value);
                    if (error) setError('');
                  }}
                  maxLength={20}
                  placeholder="e.g. AceOfSpades, Maverick"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all font-medium text-base"
                />
                <span className="absolute right-3 top-3.5 text-xs text-slate-400">
                  {name.length}/20
                </span>
              </div>
            </div>

            <button
              type="submit"
              id="continueButton"
              className="w-full py-3.5 px-6 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 shadow-glow-gold hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 group text-base"
            >
              <span>{invitedRoomCode ? `Join Room ${invitedRoomCode}` : 'Continue'}</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
        </div>

        {/* Features Preview */}
        <div className="mt-8 grid grid-cols-3 gap-3 text-center text-xs text-slate-400">
          <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
            <ShieldAlert className="w-5 h-5 mx-auto mb-1 text-amber-400" />
            <span>Server Authoritative</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
            <Layers className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
            <span>1-5 Decks</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
            <Award className="w-5 h-5 mx-auto mb-1 text-sky-400" />
            <span>Private Rooms</span>
          </div>
        </div>
      </div>
    </div>
  );
};
