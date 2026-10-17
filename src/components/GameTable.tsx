'use client';

import React, { useState } from 'react';
import { PublicGameState, Rank } from '../types/game';
import { OpponentPanel } from './OpponentPanel';
import { CentralFelt } from './CentralFelt';
import { PlayerHandTray } from './PlayerHandTray';
import { ChallengeModal } from './ChallengeModal';
import { ChallengeRevealBanner } from './ChallengeRevealBanner';
import { EventLogDrawer } from './EventLogDrawer';
import { GameOverModal } from './GameOverModal';
import { KickConfirmationModal } from './KickConfirmationModal';

import { Zap } from 'lucide-react';

interface GameTableProps {
  gameState: PublicGameState;
  myPlayerId: string;
  onPlayCards: (cardIds: string[], declaredRank?: Rank) => Promise<{ success: boolean; error?: string }>;
  onPassTurn: () => Promise<{ success: boolean; error?: string }>;
  onCallBluff: (selectedCardId: string) => Promise<{ success: boolean; error?: string }>;
  onPlayAgain: () => Promise<{ success: boolean; error?: string }>;
  onLeaveRoom: () => void;
  onKickPlayer?: (targetPlayerId: string) => Promise<{ success: boolean; error?: string }>;
}

export const GameTable: React.FC<GameTableProps> = ({
  gameState,
  myPlayerId,
  onPlayCards,
  onPassTurn,
  onCallBluff,
  onPlayAgain,
  onLeaveRoom,
  onKickPlayer,
}) => {
  const [isBluffModalOpen, setIsBluffModalOpen] = useState(false);
  const [isChallenging, setIsChallenging] = useState(false);
  const [kickTargetPlayer, setKickTargetPlayer] = useState<{ id: string; name: string } | null>(null);

  const {
    players,
    currentTurnPlayerId,
    lastPlay,
    lastRevealedChallenge,
    winner,
    status,
    eventLogs,
    myHand,
    isMyTurn,
    activeRank,
    totalBlockCards,
  } = gameState;

  // Filter opponents
  const opponents = players.filter(p => p.id !== myPlayerId);
  const currentTurnPlayer = players.find(p => p.id === currentTurnPlayerId);
  const me = players.find(p => p.id === myPlayerId);
  const isHost = me?.isHost || gameState.config.hostId === myPlayerId;

  // Can the current user challenge?
  // Only if: it is their turn, there is a last play, and the last play was NOT made by themselves
  const canChallenge =
    isMyTurn &&
    status === 'in_progress' &&
    !!lastPlay &&
    lastPlay.playerId !== myPlayerId;

  const handleExecuteChallenge = async (selectedCardId: string) => {
    setIsChallenging(true);
    const res = await onCallBluff(selectedCardId);
    setIsChallenging(false);
    if (res.success) {
      setIsBluffModalOpen(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-65px)] pb-44 pt-4 px-2 sm:px-4 flex flex-col justify-between overflow-x-hidden">
      {/* Live Event Log Drawer */}
      <EventLogDrawer logs={eventLogs} />

      {/* Opponents Curved Bar */}
      <div className="w-full max-w-5xl mx-auto mb-4">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6">
          {opponents.map(opp => (
            <OpponentPanel
              key={opp.id}
              player={opp}
              isCurrentTurn={opp.id === currentTurnPlayerId}
              isLastPlaySource={lastPlay?.playerId === opp.id}
              isHost={isHost}
              onRequestKick={(p) => setKickTargetPlayer({ id: p.id, name: p.name })}
            />
          ))}
        </div>
      </div>

      {/* Challenge Reveal Banner (when bluff/truth is resolved) */}
      {lastRevealedChallenge && (
        <ChallengeRevealBanner reveal={lastRevealedChallenge} />
      )}

      {/* Prominent Floating "Your Turn" Banner */}
      {isMyTurn && status === 'in_progress' && (
        <div className="w-full max-w-sm mx-auto my-2 z-20 animate-pulse">
          <div className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 px-4 py-2 rounded-2xl font-black text-xs sm:text-sm shadow-glow-gold flex items-center justify-center gap-2 border-2 border-amber-100">
            <Zap className="w-4 h-4 fill-current text-slate-950" />
            <span className="tracking-widest uppercase">✨ YOUR TURN TO PLAY ✨</span>
          </div>
        </div>
      )}

      {/* Central Felt Table Area */}
      <div className="my-auto py-2">
        <CentralFelt
          gameState={gameState}
          canChallenge={canChallenge}
          onOpenChallengeModal={() => setIsBluffModalOpen(true)}
        />
      </div>

      {/* Player Hand Tray and Action Controls */}
      <PlayerHandTray
        hand={myHand}
        isMyTurn={isMyTurn}
        activeRank={activeRank}
        canCallBluff={canChallenge}
        onPlayCards={onPlayCards}
        onPassTurn={onPassTurn}
        onOpenBluffModal={() => setIsBluffModalOpen(true)}
        currentTurnPlayerName={currentTurnPlayer?.name}
        isGameOver={status === 'game_over'}
      />

      {/* Interactive Bluff Challenge Selection Modal */}
      {lastPlay && (
        <ChallengeModal
          lastPlay={lastPlay}
          totalBlockCards={totalBlockCards}
          isOpen={isBluffModalOpen}
          onClose={() => setIsBluffModalOpen(false)}
          onConfirmChallenge={handleExecuteChallenge}
          isLoading={isChallenging}
        />
      )}

      {/* Game Over Celebration Modal */}
      {status === 'game_over' && winner && (
        <GameOverModal
          winner={winner}
          myPlayerId={myPlayerId}
          finishingPositions={gameState.finishingPositions}
          players={gameState.players}
          onPlayAgain={onPlayAgain}
          onLeaveRoom={onLeaveRoom}
        />
      )}

      {/* Kick Confirmation Modal */}
      <KickConfirmationModal
        isOpen={kickTargetPlayer !== null}
        targetPlayer={kickTargetPlayer}
        onConfirm={async (targetId) => {
          if (!onKickPlayer) return;
          const res = await onKickPlayer(targetId);
          if (!res.success) throw new Error(res.error || 'Failed to kick player');
        }}
        onClose={() => setKickTargetPlayer(null)}
        isWaitingRoom={false}
      />
    </div>
  );
};
