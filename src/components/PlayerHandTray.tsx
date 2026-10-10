'use client';

import React, { useState, useEffect } from 'react';
import { Card, Rank, ALL_RANKS, RANK_NAMES, RANK_SINGULAR_NAMES } from '../types/game';
import { CardView } from './CardView';
import {
  Play,
  Eye,
  SkipForward,
  X,
  Layers,
  Sparkles,
  CheckCheck,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { clsx } from 'clsx';

interface PlayerHandTrayProps {
  hand: Card[];
  isMyTurn: boolean;
  activeRank: Rank | null;
  canCallBluff: boolean;
  onPlayCards: (cardIds: string[], declaredRank?: Rank) => Promise<{ success: boolean; error?: string }>;
  onPassTurn: () => Promise<{ success: boolean; error?: string }>;
  onOpenBluffModal: () => void;
  currentTurnPlayerName?: string;
  isGameOver?: boolean;
}

export const PlayerHandTray: React.FC<PlayerHandTrayProps> = ({
  hand,
  isMyTurn,
  activeRank,
  canCallBluff,
  onPlayCards,
  onPassTurn,
  onOpenBluffModal,
  currentTurnPlayerName,
  isGameOver = false,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [declaredRank, setDeclaredRank] = useState<Rank | null>(null);
  const [showRankPicker, setShowRankPicker] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Clear selections if hand changes (e.g. after playing or receiving penalty block) or turn finishes
  useEffect(() => {
    // Filter out any selected IDs that are no longer in hand
    const handIdSet = new Set(hand.map(c => c.id));
    setSelectedIds(prev => prev.filter(id => handIdSet.has(id)));
  }, [hand]);

  const toggleCard = (id: string) => {
    setActionError(null);
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const selectAllCards = () => {
    setActionError(null);
    setSelectedIds(hand.map(c => c.id));
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setDeclaredRank(null);
    setShowRankPicker(false);
    setActionError(null);
  };

  const handlePlaySubmit = async () => {
    if (selectedIds.length === 0) {
      setActionError('Select at least one card to play');
      return;
    }

    if (activeRank === null && !declaredRank) {
      setShowRankPicker(true);
      return;
    }

    setSubmitting(true);
    setActionError(null);

    const res = await onPlayCards(selectedIds, activeRank ? undefined : declaredRank!);
    if (!res.success) {
      setActionError(res.error || 'Failed to play cards');
    } else {
      clearSelection();
    }
    setSubmitting(false);
  };

  const handlePassSubmit = async () => {
    setSubmitting(true);
    setActionError(null);
    const res = await onPassTurn();
    if (!res.success) {
      setActionError(res.error || 'Failed to pass');
    }
    setSubmitting(false);
  };

  const allSelected = hand.length > 0 && selectedIds.length === hand.length;
  const anySelected = selectedIds.length > 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 shadow-2xl p-2 sm:p-4 transition-all">
      <div className="max-w-6xl mx-auto flex flex-col gap-2">
        {/* Error notification */}
        {actionError && (
          <div className="bg-rose-950/90 border border-rose-700 text-rose-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-center mx-auto animate-bounce">
            {actionError}
          </div>
        )}

        {/* Action Controls Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 sm:px-2">
          {/* Hand stats, Selection Buttons & Your Turn Badge */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Hand Count Badge */}
            <span className="font-extrabold text-slate-200 flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 shadow-inner">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Your Hand ({hand.length})</span>
            </span>

            {/* Select All / Deselect All Controls (Enabled only during player's turn and when game is active) */}
            {isMyTurn && !isGameOver && hand.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={selectAllCards}
                  disabled={allSelected || submitting}
                  title="Select all cards in your hand"
                  className={clsx(
                    'px-2.5 py-1 rounded-md font-bold text-xs flex items-center gap-1 transition-all',
                    allSelected
                      ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/60 shadow-sm'
                  )}
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Select All</span>
                  <span className="sm:hidden">All</span>
                </button>

                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={!anySelected || submitting}
                  title="Clear all selected cards"
                  className={clsx(
                    'px-2.5 py-1 rounded-md font-bold text-xs flex items-center gap-1 transition-all',
                    !anySelected
                      ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/60 shadow-sm'
                  )}
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Deselect All</span>
                  <span className="sm:hidden">Clear</span>
                </button>
              </div>
            )}

            {/* Selected Count Indicator */}
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 px-2.5 py-1 rounded-lg font-bold shadow-sm">
                <span>{selectedIds.length} Selected</span>
                <button
                  onClick={clearSelection}
                  className="p-0.5 hover:bg-amber-500/30 rounded text-amber-200"
                  title="Clear Selection"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Right Action Buttons & Turn State */}
          <div className="flex items-center gap-2 ml-auto">
            {isMyTurn && !isGameOver ? (
              <>
                {/* Prominent "Your Turn" Indicator Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-glow-gold animate-pulse">
                  <Zap className="w-4 h-4 fill-current text-slate-950" />
                  <span className="tracking-wide uppercase">Your Turn</span>
                </div>

                {/* Play Cards Button */}
                <button
                  onClick={handlePlaySubmit}
                  disabled={selectedIds.length === 0 || submitting}
                  id="playCardsBtn"
                  className={clsx(
                    'px-4 py-2 sm:py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-md',
                    selectedIds.length > 0 && !submitting
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-glow-gold scale-105'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  )}
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>
                    Play {selectedIds.length > 0 ? `${selectedIds.length} Card${selectedIds.length > 1 ? 's' : ''}` : 'Cards'}
                    {activeRank ? ` as ${RANK_NAMES[activeRank]}` : declaredRank ? ` as ${RANK_NAMES[declaredRank]}` : ''}
                  </span>
                </button>

                {/* Call Bluff Button */}
                {canCallBluff && (
                  <button
                    onClick={onOpenBluffModal}
                    disabled={submitting}
                    id="callBluffBtn"
                    className="px-3.5 py-2 sm:py-2.5 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-glow-red flex items-center gap-1.5 transition-all"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Call Bluff!</span>
                  </button>
                )}

                {/* Pass Button (Only allowed if active round exists) */}
                {activeRank !== null && (
                  <button
                    onClick={handlePassSubmit}
                    disabled={submitting}
                    id="passTurnBtn"
                    className="px-3.5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <SkipForward className="w-4 h-4" />
                    <span>Pass</span>
                  </button>
                )}
              </>
            ) : (
              <div className="text-xs font-semibold text-slate-400 px-3 py-1.5 bg-slate-900 rounded-lg border border-slate-800">
                {isGameOver
                  ? 'Game Over'
                  : currentTurnPlayerName
                    ? `Waiting for ${currentTurnPlayerName}'s move...`
                    : 'Waiting for turn...'}
              </div>
            )}
          </div>
        </div>

        {/* Rank Picker Dropdown (when starting a fresh round) */}
        {showRankPicker && activeRank === null && (
          <div className="p-3 bg-slate-900/95 border border-amber-500/50 rounded-2xl shadow-2xl animate-fade-in my-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Declare Rank for this Round:
              </span>
              <button
                onClick={() => setShowRankPicker(false)}
                className="text-slate-400 hover:text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-13 gap-1.5">
              {ALL_RANKS.map(rank => (
                <button
                  key={rank}
                  type="button"
                  onClick={() => {
                    setDeclaredRank(rank);
                    setShowRankPicker(false);
                  }}
                  className={clsx(
                    'py-2 px-1 rounded-lg text-xs font-bold border transition-all text-center',
                    declaredRank === rank
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-glow-gold'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                  )}
                >
                  {RANK_SINGULAR_NAMES[rank]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cards Fan / Horizontal Scrollable Tray */}
        <div className="overflow-x-auto pb-2 pt-4 px-2 scroll-smooth">
          <div className="flex items-end justify-start sm:justify-center gap-1.5 sm:gap-2 min-w-max">
            {hand.map(card => {
              const selectionIndex = selectedIds.indexOf(card.id);
              const isSelected = selectionIndex !== -1;
              const selectionNumber = isSelected ? selectionIndex + 1 : undefined;

              return (
                <CardView
                  key={card.id}
                  card={card}
                  isSelectable={true}
                  isSelected={isSelected}
                  selectionNumber={selectionNumber}
                  onClick={() => toggleCard(card.id)}
                  size="md"
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
