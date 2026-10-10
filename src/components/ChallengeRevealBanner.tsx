'use client';

import React from 'react';
import { RevealedChallengeCard, RANK_NAMES, RANK_SINGULAR_NAMES } from '../types/game';
import { CardView } from './CardView';
import { ShieldAlert, CheckCircle2, Flame, ArrowRight } from 'lucide-react';

interface ChallengeRevealBannerProps {
  reveal: RevealedChallengeCard;
}

export const ChallengeRevealBanner: React.FC<ChallengeRevealBannerProps> = ({ reveal }) => {
  const {
    card,
    declaredRank,
    wasBluff,
    challengerName,
    challengedPlayerName,
    penaltyTargetName,
    cardsAwardedCount,
  } = reveal;

  return (
    <div className="w-full max-w-2xl mx-auto my-3 animate-fade-in">
      <div
        className={`rounded-2xl p-4 sm:p-5 border-2 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4 ${
          wasBluff
            ? 'bg-rose-950/90 border-rose-500 shadow-glow-red text-rose-100'
            : 'bg-emerald-950/90 border-emerald-500 shadow-glow-emerald text-emerald-100'
        }`}
      >
        {/* Left: Revealed Card Face */}
        <div className="flex items-center gap-4">
          <div className="scale-90 sm:scale-100 drop-shadow-xl animate-bounce">
            <CardView card={card} size="md" />
          </div>

          <div className="text-left">
            <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm uppercase tracking-wider mb-1">
              {wasBluff ? (
                <>
                  <Flame className="w-4 h-4 text-rose-400" />
                  <span className="text-rose-300">BLUFF CAUGHT!</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">TRUTHFUL PLAY!</span>
                </>
              )}
            </div>

            <p className="text-sm sm:text-base font-bold text-white">
              {challengerName} challenged {challengedPlayerName}
            </p>

            <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-2">
              <span>Declared: <b className="text-amber-400">{RANK_NAMES[declaredRank]}</b></span>
              <span>•</span>
              <span>Actual: <b className="text-white">{RANK_SINGULAR_NAMES[card.rank]} of {card.suit}</b></span>
            </div>
          </div>
        </div>

        {/* Right: Penalty Box */}
        <div className="w-full sm:w-auto text-center sm:text-right bg-black/40 rounded-xl p-3 border border-white/10 shrink-0">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Penalty Collection
          </p>
          <p className="text-sm sm:text-base font-black text-amber-300 mt-0.5">
            {penaltyTargetName}
          </p>
          <p className="text-xs text-slate-300">
            collected <b className="text-white">{cardsAwardedCount} cards</b>
          </p>
        </div>
      </div>
    </div>
  );
};
