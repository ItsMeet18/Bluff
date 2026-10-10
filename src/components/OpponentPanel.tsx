'use client';

import React from 'react';
import { PublicPlayer } from '../types/game';
import { Crown, WifiOff, Layers, Eye } from 'lucide-react';
import { clsx } from 'clsx';

interface OpponentPanelProps {
  player: PublicPlayer;
  isCurrentTurn: boolean;
  isLastPlaySource: boolean;
}

export const OpponentPanel: React.FC<OpponentPanelProps> = ({
  player,
  isCurrentTurn,
  isLastPlaySource,
}) => {
  return (
    <div
      className={clsx(
        'relative transition-all duration-300 rounded-2xl p-2.5 sm:p-3 flex flex-col items-center gap-1 sm:gap-1.5 backdrop-blur-md shadow-lg border min-w-[100px] sm:min-w-[130px]',
        isCurrentTurn && !player.isSpectator
          ? 'bg-slate-900/95 border-amber-400 ring-2 ring-amber-400/80 shadow-glow-gold scale-105 z-10'
          : player.isSpectator
          ? 'bg-slate-950/50 border-slate-800/60 text-slate-400 opacity-75'
          : 'bg-slate-950/70 border-slate-800 text-slate-300',
        !player.isConnected && 'opacity-60'
      )}
    >
      {/* Current Turn Badge */}
      {isCurrentTurn && !player.isSpectator && (
        <span className="absolute -top-3 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-md animate-bounce">
          Turn
        </span>
      )}

      {/* Avatar */}
      <div className="relative">
        <div
          className={clsx(
            'w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-base border-2 shadow-inner',
            isCurrentTurn && !player.isSpectator
              ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 border-amber-300'
              : player.isSpectator
              ? 'bg-gradient-to-br from-slate-800 to-slate-950 text-emerald-400 border-emerald-500/40'
              : 'bg-gradient-to-br from-slate-800 to-slate-900 text-slate-200 border-slate-700'
          )}
        >
          {player.name.charAt(0).toUpperCase()}
        </div>

        {/* Host Crown */}
        {player.isHost && (
          <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-slate-950 rounded-full p-1 shadow">
            <Crown className="w-3 h-3 fill-current" />
          </div>
        )}

        {/* Disconnect indicator */}
        {!player.isConnected && (
          <div className="absolute -bottom-1 -right-1 bg-rose-600 text-white rounded-full p-1 shadow">
            <WifiOff className="w-2.5 h-2.5" />
          </div>
        )}
      </div>

      {/* Name */}
      <div className="text-center w-full px-1">
        <p className="font-bold text-xs sm:text-sm truncate text-slate-100 max-w-[110px]">
          {player.name}
        </p>
      </div>

      {/* Card Count Pill or Spectator Pill */}
      {player.isSpectator ? (
        <div className="flex items-center gap-1 bg-emerald-950/60 border border-emerald-700/50 px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-bold text-emerald-300 shadow-sm">
          <Eye className="w-3 h-3 text-emerald-400" />
          <span>{player.finishPosition ? `Finished #${player.finishPosition}` : 'Spectating'}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 px-2 py-1 rounded-lg text-xs font-bold text-amber-300 shadow-inner">
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span>{player.cardCount} card{player.cardCount !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Last Played Badge */}
      {isLastPlaySource && (
        <span className="text-[9px] font-semibold text-amber-400/90 tracking-wider uppercase">
          Last Played
        </span>
      )}
    </div>
  );
};
