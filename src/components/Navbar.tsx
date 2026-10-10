'use client';

import React, { useState } from 'react';
import { Volume2, VolumeX, Copy, Check, LogOut, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import { PublicGameState } from '../types/game';

interface NavbarProps {
  gameState: PublicGameState | null;
  isConnected: boolean;
  playerName: string;
  muted: boolean;
  onToggleMute: () => void;
  onLeaveRoom: () => void;
  onChangeName?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  gameState,
  isConnected,
  playerName,
  muted,
  onToggleMute,
  onLeaveRoom,
  onChangeName,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (gameState?.roomCode) {
      navigator.clipboard.writeText(gameState.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="w-full bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-serif font-black text-slate-950 text-xl shadow-glow-gold">
          B
        </div>
        <div>
          <h1 className="font-extrabold tracking-wider text-base sm:text-lg bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">
            BLUFF
          </h1>
          <p className="text-[10px] text-slate-400 hidden sm:block">Play your cards. Trust nobody.</p>
        </div>
      </div>

      {/* Center Room Code Pill (if in room) */}
      {gameState && (
        <div className="flex items-center gap-2 bg-slate-950/80 border border-amber-500/30 px-3 py-1.5 rounded-full shadow-inner">
          <span className="text-[11px] uppercase tracking-wider text-slate-400">Room:</span>
          <span className="font-mono font-bold text-amber-400 tracking-widest text-sm sm:text-base">
            {gameState.roomCode}
          </span>
          <button
            onClick={handleCopyCode}
            title="Copy Room Code"
            className="p-1 hover:bg-amber-500/20 text-amber-400 rounded-md transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Connection status */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            isConnected
              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
              : 'bg-rose-950/60 text-rose-400 border-rose-800/50 animate-pulse'
          }`}
        >
          {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span className="hidden md:inline">{isConnected ? 'Live' : 'Connecting...'}</span>
        </div>

        {/* Player Name Pill */}
        {playerName && (
          <button
            onClick={onChangeName}
            title="Click to edit name"
            className="bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 px-3 py-1 rounded-full text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span className="max-w-[100px] sm:max-w-[140px] truncate">{playerName}</span>
          </button>
        )}

        {/* Sound Toggle */}
        <button
          onClick={onToggleMute}
          title={muted ? 'Unmute audio' : 'Mute audio'}
          className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/60"
        >
          {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
        </button>

        {/* Leave Room Button */}
        {gameState && (
          <button
            onClick={onLeaveRoom}
            title="Leave current room"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-xs font-semibold transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        )}
      </div>
    </header>
  );
};
