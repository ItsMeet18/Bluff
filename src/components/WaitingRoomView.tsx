'use client';

import React, { useState } from 'react';
import { PublicGameState } from '../types/game';
import { Copy, Check, Users, Crown, Layers, Play, AlertCircle, Share2, Shield, LogOut } from 'lucide-react';

interface WaitingRoomViewProps {
  gameState: PublicGameState;
  myPlayerId: string;
  onStartGame: () => Promise<{ success: boolean; error?: string }>;
  onLeaveRoom: () => void;
}

export const WaitingRoomView: React.FC<WaitingRoomViewProps> = ({
  gameState,
  myPlayerId,
  onStartGame,
  onLeaveRoom,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveMyId = myPlayerId || gameState.myPlayerId;
  const me = gameState.players.find(p => p.id === effectiveMyId);
  const isHost = me?.isHost || gameState.config.hostId === effectiveMyId;
  const canStart = gameState.players.length >= gameState.config.minPlayers;

  const copyCode = () => {
    navigator.clipboard.writeText(gameState.roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyShareLink = async () => {
    if (typeof window !== 'undefined') {
      const shareUrl = `${window.location.origin}?room=${gameState.roomCode}`;
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareUrl);
        } else {
          // Fallback for older browsers or insecure contexts
          const textarea = document.createElement('textarea');
          textarea.value = shareUrl;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      } catch (err) {
        console.error('Failed to copy share link:', err);
      }
    }
  };

  const handleStart = async () => {
    if (!isHost || !canStart) return;
    setStarting(true);
    setError(null);
    const res = await onStartGame();
    if (!res.success) {
      setError(res.error || 'Failed to start game');
    }
    setStarting(false);
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex flex-col items-center justify-center px-3 sm:px-4 py-6">
      <div className="w-full max-w-xl mx-auto space-y-4 sm:space-y-5">
        {/* Room Header Card */}
        <div className="glass-panel-glow rounded-2xl p-5 sm:p-6 text-center relative overflow-hidden border border-amber-500/30 shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -z-10" />

          <p className="text-xs uppercase font-bold tracking-widest text-slate-400 mb-1">
            Waiting for Players
          </p>
          <div className="flex items-center justify-center gap-3 my-2">
            <span className="font-mono text-3xl sm:text-5xl font-black tracking-widest text-amber-400">
              {gameState.roomCode}
            </span>
            <button
              onClick={copyCode}
              title="Copy Room Code"
              className="p-2 sm:p-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 transition-all shadow-sm"
            >
              {copiedCode ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mt-3 text-xs font-semibold text-slate-400">
            <div className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>{gameState.config.deckCount} Deck{gameState.config.deckCount > 1 ? 's' : ''} ({gameState.config.deckCount * 52} Cards)</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>{gameState.players.length} / {gameState.config.maxPlayers} Players</span>
            </div>
          </div>

          {/* Quick share button */}
          <div className="mt-3.5 pt-3.5 border-t border-slate-800/80 flex justify-center">
            <button
              onClick={copyShareLink}
              className={`inline-flex items-center gap-1.5 text-xs font-bold transition-all py-1.5 px-3.5 rounded-xl border ${
                copiedLink
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30'
              }`}
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedLink ? 'Invite Link Copied to Clipboard!' : 'Copy Direct Invite Link'}</span>
            </button>
          </div>
        </div>

        {/* Error Box */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs sm:text-sm flex items-center gap-2 shadow">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Players List Grid with Max-Height & Vertical Scroll */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-slate-800 flex flex-col shadow-xl">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" /> Connected Players ({gameState.players.length})
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">
              Min {gameState.config.minPlayers} required
            </span>
          </div>

          <div className="space-y-2 max-h-[35vh] sm:max-h-[38vh] overflow-y-auto pr-1">
            {gameState.players.map((p, index) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-slate-900/80 border border-slate-800/90 transition-all hover:border-slate-700"
              >
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600 flex items-center justify-center font-bold text-xs sm:text-sm text-amber-400 shrink-0">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs sm:text-sm text-slate-100 truncate max-w-[120px] sm:max-w-[180px]">
                        {p.name}
                      </span>
                      {p.id === effectiveMyId && (
                        <span className="text-[9px] sm:text-[10px] bg-slate-800 text-amber-400 px-1.5 py-0.5 rounded font-bold">
                          YOU
                        </span>
                      )}
                      {p.isHost && (
                        <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                          <Crown className="w-3 h-3 text-amber-400" /> Host
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      p.isConnected ? 'bg-emerald-400 shadow-glow-emerald' : 'bg-slate-600'
                    }`}
                  />
                  <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                    {p.isConnected ? 'Ready' : 'Connecting...'}
                  </span>
                </div>
              </div>
            ))}

            {/* Empty player slots placeholders */}
            {Array.from({ length: Math.max(0, gameState.config.minPlayers - gameState.players.length) }).map(
              (_, i) => (
                <div
                  key={`empty_${i}`}
                  className="flex items-center justify-center p-2.5 sm:p-3 rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs font-semibold gap-2"
                >
                  <Users className="w-3.5 h-3.5 opacity-40" />
                  <span>Waiting for another player to join...</span>
                </div>
              )
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={onLeaveRoom}
            className="py-3.5 px-5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Leave Room
          </button>

          {isHost ? (
            <button
              onClick={handleStart}
              disabled={!canStart || starting}
              id="startGameBtn"
              className={`flex-1 py-3.5 px-6 rounded-xl font-bold text-slate-950 flex items-center justify-center gap-2 text-base transition-all ${
                canStart && !starting
                  ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 shadow-glow-gold'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <Play className="w-5 h-5 fill-current" />
              <span>
                {starting
                  ? 'Dealing Cards...'
                  : canStart
                  ? 'Start Game'
                  : `Waiting for at least ${gameState.config.minPlayers} players`}
              </span>
            </button>
          ) : (
            <div className="flex-1 py-3.5 px-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs font-semibold text-slate-400 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Waiting for host to start the game...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
