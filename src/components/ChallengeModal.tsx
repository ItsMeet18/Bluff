'use client';

import React, { useState, useEffect } from 'react';
import { Contribution, RANK_NAMES, RANK_SINGULAR_NAMES } from '../types/game';
import { CardView } from './CardView';
import { ShieldAlert, AlertTriangle, X, Eye } from 'lucide-react';

interface ChallengeModalProps {
  lastPlay: Contribution;
  totalBlockCards: number;
  isOpen: boolean;
  onClose: () => void;
  onConfirmChallenge: (selectedCardId: string) => void;
  isLoading?: boolean;
}

export const ChallengeModal: React.FC<ChallengeModalProps> = ({
  lastPlay,
  totalBlockCards,
  isOpen,
  onClose,
  onConfirmChallenge,
  isLoading = false,
}) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(
    lastPlay.cardIds[0] || null
  );
  const [confirmed, setConfirmed] = useState<boolean>(false);

  // Update default selected card if lastPlay changes
  useEffect(() => {
    if (lastPlay.cardIds.length > 0) {
      setSelectedCardId(lastPlay.cardIds[0]);
      setConfirmed(false);
    }
  }, [lastPlay]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedCardIndex = lastPlay.cardIds.indexOf(selectedCardId || '');

  const handleExecute = () => {
    if (!selectedCardId || !confirmed || isLoading) return;
    onConfirmChallenge(selectedCardId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-hidden animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl relative text-left flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden">
        
        {/* --- Non-scrolling Header --- */}
        <div className="p-4 sm:p-6 pb-3 border-b border-slate-800 shrink-0 relative bg-slate-900/95">
          {/* Close Button */}
          <button
            onClick={onClose}
            disabled={isLoading}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
            title="Cancel and close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 pr-8">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white tracking-wide">Call Bluff!</h3>
              <p className="text-xs sm:text-sm text-slate-400 truncate">
                Challenging <span className="text-slate-200 font-bold">{lastPlay.playerName}</span>&apos;s declaration of{' '}
                <span className="text-amber-400 font-bold">{RANK_NAMES[lastPlay.declaredRank]}</span>
              </p>
            </div>
          </div>

          <div className="mt-3 p-2.5 sm:p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 leading-relaxed flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Select <b>ONE card</b> below from {lastPlay.playerName}&apos;s play of {lastPlay.cardCount} card{lastPlay.cardCount > 1 ? 's' : ''} to reveal and inspect:
            </span>
          </div>
        </div>

        {/* --- Independently Scrollable Main Content --- */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {/* Responsive Card Grid */}
          <div className="p-3 sm:p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 sm:gap-3.5 items-center justify-items-center">
              {lastPlay.cardIds.map((cardId, index) => {
                const isPicked = selectedCardId === cardId;
                return (
                  <button
                    type="button"
                    key={cardId}
                    onClick={() => {
                      setSelectedCardId(cardId);
                      setConfirmed(false);
                    }}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all w-full focus:outline-none ${
                      isPicked
                        ? 'bg-amber-500/15 ring-2 ring-amber-400 rounded-xl scale-105'
                        : 'hover:bg-slate-800/60 opacity-85 hover:opacity-100'
                    }`}
                  >
                    <CardView
                      faceDown
                      isSelectable
                      isSelected={isPicked}
                      size="sm"
                    />
                    <span
                      className={`text-[11px] font-bold ${
                        isPicked ? 'text-amber-300 font-black' : 'text-slate-400'
                      }`}
                    >
                      Card #{index + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stakes & Rules Summary */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/50 text-xs space-y-1.5 text-slate-300">
            <div className="flex items-center gap-2 font-bold text-amber-300 text-xs sm:text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Resolution Stakes ({totalBlockCards} Cards in Central Block)</span>
            </div>
            <p className="leading-snug">
              • If Card #{selectedCardIndex + 1} is <span className="text-rose-400 font-bold">NOT a {RANK_SINGULAR_NAMES[lastPlay.declaredRank]}</span>: Bluff caught! <span className="font-bold text-emerald-400">{lastPlay.playerName}</span> collects all {totalBlockCards} cards.
            </p>
            <p className="leading-snug">
              • If Card #{selectedCardIndex + 1} <span className="text-emerald-400 font-bold">IS a {RANK_SINGULAR_NAMES[lastPlay.declaredRank]}</span>: Truthful play! <span className="font-bold text-rose-400">YOU</span> collect all {totalBlockCards} cards.
            </p>
          </div>
        </div>

        {/* --- Non-scrolling / Sticky Footer --- */}
        <div className="p-4 sm:p-5 bg-slate-950/95 border-t border-slate-800/90 shrink-0 space-y-3">
          {/* Confirmation Checkbox */}
          <div className="flex items-center gap-2.5 bg-slate-900/90 p-2.5 sm:p-3 rounded-xl border border-slate-800">
            <input
              type="checkbox"
              id="confirmBluffCheck"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
            />
            <label htmlFor="confirmBluffCheck" className="text-xs font-semibold text-slate-200 cursor-pointer select-none">
              I confirm calling bluff on <span className="text-amber-400 font-bold">Card #{selectedCardIndex + 1}</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-2.5 sm:py-3 px-4 rounded-xl font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors text-xs sm:text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleExecute}
              disabled={!selectedCardId || !confirmed || isLoading}
              className="flex-1 py-2.5 sm:py-3 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-glow-red transition-all text-xs sm:text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? 'Revealing...' : 'Reveal & Challenge!'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
