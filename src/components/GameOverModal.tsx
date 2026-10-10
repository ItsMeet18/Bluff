'use client';

import React, { useEffect, useState } from 'react';
import { PublicPlayer, FinishingPosition } from '../types/game';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Sparkles,
  RefreshCw,
  Home,
  Crown,
  Medal,
  Award,
  Shield,
  Flame,
  Clock,
  Zap,
  Skull,
  AlertCircle,
} from 'lucide-react';
import { getFinishingTitle, getTitleVisualConfig } from '../utils/titles';

interface GameOverModalProps {
  winner: PublicPlayer;
  myPlayerId: string;
  finishingPositions?: FinishingPosition[];
  players?: PublicPlayer[];
  onPlayAgain: () => Promise<{ success: boolean; error?: string }>;
  onLeaveRoom: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  winner,
  myPlayerId,
  finishingPositions = [],
  players = [],
  onPlayAgain,
  onLeaveRoom,
}) => {
  const isMe = winner.id === myPlayerId;
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    // Burst celebratory confetti
    try {
      confetti({
        particleCount: 140,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#10b981', '#38bdf8', '#fbbf24', '#a855f7'],
      });
    } catch {
      // Ignore in non-browser or test environments
    }
  }, []);

  const handlePlayAgainClick = async () => {
    setIsResetting(true);
    setResetError(null);
    const res = await onPlayAgain();
    if (!res.success) {
      setResetError(res.error || 'Failed to restart rematch');
      setIsResetting(false);
    }
  };

  const renderTitleIcon = (iconName: string) => {
    const iconClass = 'w-3.5 h-3.5 shrink-0';
    switch (iconName) {
      case 'Sparkles':
        return <Sparkles className={iconClass} />;
      case 'Award':
        return <Award className={iconClass} />;
      case 'Medal':
        return <Medal className={iconClass} />;
      case 'Shield':
        return <Shield className={iconClass} />;
      case 'Flame':
        return <Flame className={iconClass} />;
      case 'Clock':
        return <Clock className={iconClass} />;
      case 'Zap':
        return <Zap className={iconClass} />;
      case 'Skull':
        return <Skull className={iconClass} />;
      default:
        return <Award className={iconClass} />;
    }
  };

  // Compute total completed game player count
  const totalPlayerCount = Math.max(
    finishingPositions.length,
    players.length,
    2
  );

  // Compile authoritative standings
  let standings: FinishingPosition[] = [...finishingPositions];

  // If winner is missing from finishingPositions list, include survivor
  if (winner && !standings.some(fp => fp.playerId === winner.id)) {
    standings.push({
      playerId: winner.id,
      playerName: winner.name,
      position: totalPlayerCount,
      isLastStanding: true,
      title: winner.finishTitle,
    });
  }

  // Sort strictly by finishing position
  standings.sort((a, b) => a.position - b.position);

  // Resolve my standing & custom title
  const myStanding = standings.find(fp => fp.playerId === myPlayerId);
  const myTitle = myStanding
    ? myStanding.title || getFinishingTitle(myStanding.position, totalPlayerCount)
    : null;
  const myVisual = myTitle ? getTitleVisualConfig(myTitle) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-hidden animate-fade-in">
      <div className="w-full max-w-xl bg-slate-900 border border-amber-500/50 rounded-3xl p-5 sm:p-7 text-center shadow-2xl relative overflow-y-auto max-h-[92vh]">
        {/* Glow backdrop */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-56 bg-amber-500/20 rounded-full blur-3xl -z-10" />

        {/* Trophy icon */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 rounded-3xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center shadow-glow-gold animate-float">
          <Trophy className="w-9 h-9 sm:w-10 sm:h-10" />
        </div>

        {/* Status Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black tracking-wider uppercase mb-2">
          <Crown className="w-3.5 h-3.5 text-amber-400" /> LAST PLAYER STANDING
        </div>

        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-1">
          {isMe ? 'VICTORY!' : `${winner.name} Wins!`}
        </h2>

        <p className="text-slate-300 text-xs sm:text-sm mb-4">
          {isMe
            ? 'You outlasted all opponents and survived as the Last Player Standing!'
            : `${winner.name} survived as the final active player standing.`}
        </p>

        {/* Highlight current user's earned custom title */}
        {myTitle && myVisual && (
          <div className="mb-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950/80 border border-slate-800 text-xs text-slate-300 shadow-inner">
            <span className="text-slate-400 font-medium">Your Title:</span>
            <span className={`inline-flex items-center gap-1.5 font-black ${myVisual.badgeText}`}>
              {renderTitleIcon(myVisual.iconName)}
              {myTitle}
            </span>
          </div>
        )}

        {/* Standings Leaderboard with Custom Finishing Titles */}
        <div className="mb-6 text-left bg-slate-950/80 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-inner">
          <div className="flex items-center justify-between mb-3 px-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Medal className="w-3.5 h-3.5 text-amber-400" /> Final Match Standings & Titles
            </h4>
            <span className="text-[11px] text-slate-400 font-medium">
              {totalPlayerCount} Players
            </span>
          </div>

          <div className="space-y-2">
            {standings.map(fp => {
              const isWinner = fp.playerId === winner.id || !!fp.isLastStanding;
              const isCurrentPlayer = fp.playerId === myPlayerId;
              const title = fp.title || getFinishingTitle(fp.position, totalPlayerCount);
              const visual = getTitleVisualConfig(title);

              return (
                <div
                  key={fp.playerId}
                  className={`p-3 rounded-2xl border transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${visual.cardBorder} ${
                    isWinner
                      ? 'ring-1 ring-amber-400/50 shadow-glow-gold'
                      : ''
                  } ${isCurrentPlayer ? 'bg-slate-900/90' : ''}`}
                >
                  {/* Left: Position Indicator & Player Name */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-xl font-black flex items-center justify-center text-xs shrink-0 shadow-sm ${
                        isWinner
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800/90 text-slate-300 border border-slate-700/60'
                      }`}
                    >
                      {isWinner ? '👑' : `#${fp.position}`}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`font-bold truncate text-sm ${
                            isWinner ? 'text-amber-200' : 'text-slate-100'
                          }`}
                        >
                          {fp.playerName}
                        </span>

                        {isCurrentPlayer && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            You
                          </span>
                        )}

                        {isWinner && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            Winner
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {visual.tagline}
                      </p>
                    </div>
                  </div>

                  {/* Right: Prominent Custom Title Badge */}
                  <div className="shrink-0 self-start sm:self-center">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black tracking-wide ${visual.badgeBg} ${visual.badgeBorder} ${visual.badgeText} ${
                        visual.glowClass ? visual.glowClass : ''
                      }`}
                    >
                      {renderTitleIcon(visual.iconName)}
                      <span>{title}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {resetError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{resetError}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2.5">
          <button
            onClick={handlePlayAgainClick}
            disabled={isResetting}
            id="playAgainBtn"
            className="w-full py-3.5 px-6 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 shadow-glow-gold transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
            <span>{isResetting ? 'Setting up Rematch...' : 'Play Again (Rematch)'}</span>
          </button>

          <button
            onClick={onLeaveRoom}
            className="w-full py-3 px-6 rounded-xl font-semibold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition-colors text-sm flex items-center justify-center gap-2 border border-slate-700/60 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Return to Main Lobby</span>
          </button>
        </div>
      </div>
    </div>
  );
};
