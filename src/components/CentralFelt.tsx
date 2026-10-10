'use client';

import React from 'react';
import { PublicGameState, RANK_NAMES } from '../types/game';
import { CardView } from './CardView';
import { Sparkles, Crown, Layers, Eye, RefreshCcw } from 'lucide-react';

interface CentralFeltProps {
  gameState: PublicGameState;
  onOpenChallengeModal?: () => void;
  canChallenge: boolean;
}

export const CentralFelt: React.FC<CentralFeltProps> = ({
  gameState,
  onOpenChallengeModal,
  canChallenge,
}) => {
  const {
    activeRank,
    totalBlockCards,
    lastPlay,
    consecutivePasses,
    players,
  } = gameState;

  return (
    <div className="relative w-full max-w-2xl mx-auto rounded-[40px] felt-table p-6 sm:p-8 flex flex-col items-center justify-between min-h-[220px] sm:min-h-[260px] text-center border-4 border-amber-900/40 select-none">
      {/* Top Banner: Active Rank */}
      <div className="z-10">
        {activeRank ? (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-950/90 border border-amber-400 text-amber-300 shadow-glow-gold animate-pulse-glow">
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="text-xs sm:text-sm uppercase tracking-widest font-black">
              Active Rank: {RANK_NAMES[activeRank]}
            </span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-950/80 border border-emerald-500/40 text-emerald-300">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-xs sm:text-sm uppercase tracking-wider font-bold">
              Round Reset • Start New Play
            </span>
          </div>
        )}
      </div>

      {/* Center: Central Block 3D Card Stack */}
      <div className="relative my-4 flex items-center justify-center min-h-[100px]">
        {totalBlockCards > 0 ? (
          <div className="relative flex items-center justify-center">
            {/* Visual stacked card effect */}
            {Array.from({ length: Math.min(6, totalBlockCards) }).map((_, index) => {
              const rotation = (index - 2.5) * 6;
              const translateY = (index - 2.5) * 3;
              const translateX = (index - 2.5) * 4;
              return (
                <div
                  key={`pile_card_${index}`}
                  style={{
                    transform: `rotate(${rotation}deg) translateY(${translateY}px) translateX(${translateX}px)`,
                  }}
                  className="absolute transition-transform duration-300 pointer-events-none"
                >
                  <CardView faceDown size="md" />
                </div>
              );
            })}

            {/* Pile Count Pill */}
            <div className="z-20 mt-12 bg-slate-950/90 border border-amber-500/60 px-3 py-1.5 rounded-xl text-amber-300 font-extrabold text-xs sm:text-sm shadow-xl flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>{totalBlockCards} in Central Block</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400/70 p-4 border border-dashed border-emerald-600/30 rounded-2xl bg-emerald-950/20">
            <Layers className="w-8 h-8 opacity-40 mb-1" />
            <span className="text-xs font-semibold">Central Block is Empty</span>
          </div>
        )}
      </div>

      {/* Bottom Info: Last Play & Consecutive Passes */}
      <div className="z-10 flex flex-wrap items-center justify-center gap-3 text-xs">
        {lastPlay && (
          <div className="bg-slate-950/85 border border-slate-800 px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-slate-200 shadow">
            <span className="text-amber-400 font-bold">{lastPlay.playerName}</span>
            <span className="text-slate-400">declared</span>
            <span className="font-extrabold text-amber-300">
              {lastPlay.cardCount} × {RANK_NAMES[lastPlay.declaredRank]}
            </span>

            {canChallenge && onOpenChallengeModal && (
              <button
                onClick={onOpenChallengeModal}
                className="ml-1 px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] shadow transition-colors flex items-center gap-1"
              >
                <Eye className="w-3 h-3" /> Inspect / Bluff?
              </button>
            )}
          </div>
        )}

        {consecutivePasses > 0 && (
          <div className="bg-slate-950/85 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-slate-300 shadow">
            <RefreshCcw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            <span className="font-semibold text-slate-400">Passes:</span>
            <span className="font-bold text-amber-400">
              {consecutivePasses} / {players.length}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
