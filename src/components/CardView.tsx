'use client';

import React from 'react';
import { Card, Suit, Rank } from '../types/game';
import { clsx } from 'clsx';

interface CardViewProps {
  card?: Card;
  faceDown?: boolean;
  isSelected?: boolean;
  selectionNumber?: number;
  isSelectable?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const SUIT_COLORS: Record<Suit, string> = {
  hearts: 'text-rose-600',
  diamonds: 'text-rose-600',
  clubs: 'text-slate-900',
  spades: 'text-slate-900',
};

export const CardView: React.FC<CardViewProps> = ({
  card,
  faceDown = false,
  isSelected = false,
  selectionNumber,
  isSelectable = false,
  onClick,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-12 h-16 text-xs rounded-md',
    md: 'w-16 h-24 sm:w-20 sm:h-28 text-sm sm:text-base rounded-lg',
    lg: 'w-24 h-36 sm:w-28 sm:h-40 text-lg rounded-xl',
  }[size];

  const selected = isSelected || selectionNumber !== undefined;

  if (faceDown || !card) {
    return (
      <div
        onClick={isSelectable ? onClick : undefined}
        className={clsx(
          'relative select-none transition-all duration-200 shadow-card flex items-center justify-center overflow-hidden border-2',
          sizeClasses,
          isSelectable && 'cursor-pointer hover:scale-105 hover:-translate-y-2 hover:shadow-glow-gold hover:border-amber-400',
          selected ? 'border-amber-400 -translate-y-3 shadow-glow-gold ring-2 ring-amber-400' : 'border-amber-600/60',
          'bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950',
          className
        )}
      >
        {/* Luxury Card Back Art */}
        <div className="absolute inset-1 border border-amber-500/30 rounded flex items-center justify-center bg-slate-900/90">
          <div className="w-full h-full p-1 opacity-75 flex flex-col items-center justify-center">
            <div className="w-full h-full border border-dashed border-amber-400/40 rounded flex items-center justify-center">
              <span className="text-amber-400/80 font-serif font-black tracking-widest text-[10px] sm:text-xs">
                BLUFF
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitSymbol = SUIT_SYMBOLS[card.suit];
  const suitColor = SUIT_COLORS[card.suit];

  return (
    <div
      onClick={isSelectable ? onClick : undefined}
      className={clsx(
        'relative select-none bg-gradient-to-b from-white via-slate-50 to-slate-100 text-slate-900 shadow-card transition-all duration-200 border flex flex-col justify-between p-1 sm:p-2 cursor-default font-sans',
        sizeClasses,
        isSelectable && 'cursor-pointer hover:-translate-y-2 hover:shadow-xl hover:border-amber-500',
        selected && 'border-amber-500 -translate-y-4 shadow-glow-gold ring-2 ring-amber-400 bg-amber-50/90 scale-105 z-10',
        !selected && 'border-slate-300',
        className
      )}
    >
      {/* Top Left Corner */}
      <div className={clsx('flex flex-col items-center leading-none font-bold', suitColor)}>
        <span className="text-xs sm:text-sm font-extrabold">{card.rank}</span>
        <span className="text-xs sm:text-base leading-none">{suitSymbol}</span>
      </div>

      {/* Center Artwork */}
      <div className={clsx('flex items-center justify-center text-xl sm:text-3xl opacity-90 my-auto select-none', suitColor)}>
        {suitSymbol}
      </div>

      {/* Bottom Right Corner (Inverted) */}
      <div className={clsx('flex flex-col items-center leading-none font-bold rotate-180', suitColor)}>
        <span className="text-xs sm:text-sm font-extrabold">{card.rank}</span>
        <span className="text-xs sm:text-base leading-none">{suitSymbol}</span>
      </div>

      {/* Numbered Selection Indicator Badge */}
      {selected && (
        <div className="absolute -top-2.5 -right-2.5 bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-lg border-2 border-slate-950 ring-1 ring-amber-300 z-20 animate-scale-in">
          {selectionNumber !== undefined ? selectionNumber : '•'}
        </div>
      )}
    </div>
  );
};
