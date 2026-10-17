'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useGameSocket } from '../hooks/useGameSocket';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { Navbar } from '../components/Navbar';
import { LandingView } from '../components/LandingView';
import { LobbyView } from '../components/LobbyView';
import { WaitingRoomView } from '../components/WaitingRoomView';
import { GameTable } from '../components/GameTable';
import { AlertCircle } from 'lucide-react';

export default function BluffApp() {
  const {
    isConnected,
    isRestoringSession,
    gameState,
    playerId,
    playerName,
    setPlayerName,
    invitedRoomCode,
    setInvitedRoomCode,
    errorMsg,
    setErrorMsg,
    activeRooms,
    isLoadingRooms,
    roomsError,
    fetchActiveRooms,
    createRoom,
    joinRoom,
    startGame,
    kickPlayer,
    playCards,
    passTurn,
    callBluff,
    playAgain,
    leaveRoom,
  } = useGameSocket();

  const {
    muted,
    toggleMute,
    playCardClick,
    playCardPlay,
    playPass,
    playChallengeStart,
    playBluffSuccess,
    playBluffFailed,
    playVictory,
  } = useSoundEffects();

  const [hasEnteredName, setHasEnteredName] = useState<boolean>(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const autoJoinAttempted = useRef<boolean>(false);

  // Sync state if player name already existed
  useEffect(() => {
    if (playerName) {
      setHasEnteredName(true);
    }
  }, [playerName]);

  // If user ALREADY had a name stored and lands on invite link (?room=XYZ), auto-join once socket is connected and session restored
  useEffect(() => {
    if (!isRestoringSession && isConnected && playerName && invitedRoomCode && !gameState && !autoJoinAttempted.current) {
      autoJoinAttempted.current = true;
      joinRoom(invitedRoomCode, playerName).then(res => {
        if (!res.success) {
          setInviteError(res.error || `Unable to join room ${invitedRoomCode}`);
          setInvitedRoomCode(null);
        }
      });
    }
  }, [isRestoringSession, isConnected, playerName, invitedRoomCode, gameState, joinRoom, setInvitedRoomCode]);

  // Audio trigger effects when game state changes
  useEffect(() => {
    if (gameState?.lastRevealedChallenge) {
      if (gameState.lastRevealedChallenge.wasBluff) {
        playBluffSuccess();
      } else {
        playBluffFailed();
      }
    }
  }, [gameState?.lastRevealedChallenge, playBluffSuccess, playBluffFailed]);

  useEffect(() => {
    if (gameState?.status === 'game_over') {
      playVictory();
    }
  }, [gameState?.status, playVictory]);

  const handleContinueName = async (name: string) => {
    setPlayerName(name);
    setHasEnteredName(true);
    playCardClick();

    // If an invited room code is pending, immediately join it!
    if (invitedRoomCode) {
      const res = await joinRoom(invitedRoomCode, name);
      if (!res.success) {
        setInviteError(res.error || `Unable to join room ${invitedRoomCode}`);
        setInvitedRoomCode(null);
      }
    }
  };

  const handleChangeName = () => {
    setHasEnteredName(false);
    playCardClick();
  };

  const handleCreateRoom = async (deckCount: number, maxPlayers: number) => {
    playCardClick();
    return await createRoom(deckCount, maxPlayers, 2, playerName);
  };

  const handleJoinRoom = async (roomCode: string) => {
    playCardClick();
    return await joinRoom(roomCode, playerName);
  };

  const handleStartGame = async () => {
    playCardPlay();
    return await startGame();
  };

  const handlePlayCards = async (cardIds: string[], declaredRank?: any) => {
    playCardPlay();
    return await playCards(cardIds, declaredRank);
  };

  const handlePassTurn = async () => {
    playPass();
    return await passTurn();
  };

  const handleCallBluff = async (selectedCardId: string) => {
    playChallengeStart();
    const res = await callBluff(selectedCardId);
    return res;
  };

  const handlePlayAgain = async () => {
    playCardClick();
    return await playAgain();
  };

  const handleKickPlayer = async (targetPlayerId: string) => {
    playCardClick();
    return await kickPlayer(targetPlayerId);
  };

  const handleLeaveRoom = () => {
    playCardClick();
    setInvitedRoomCode(null);
    setInviteError(null);
    autoJoinAttempted.current = false;
    leaveRoom();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Navigation */}
      <Navbar
        gameState={gameState}
        isConnected={isConnected}
        playerName={playerName}
        muted={muted}
        onToggleMute={toggleMute}
        onLeaveRoom={handleLeaveRoom}
        onChangeName={gameState ? undefined : handleChangeName}
      />

      {/* Main Content View Switcher */}
      <main className="flex-1 flex flex-col">
        {!hasEnteredName ? (
          <LandingView
            initialName={playerName}
            onContinue={handleContinueName}
            invitedRoomCode={invitedRoomCode}
            inviteError={inviteError}
          />
        ) : isRestoringSession ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <div className="relative mb-6">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shadow-lg shadow-indigo-500/10 backdrop-blur-sm">
                <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white mb-2 tracking-wide">
              Reconnecting to game...
            </h2>
            <p className="text-sm text-slate-400 max-w-sm">
              Restoring your room session and cards. Hang tight!
            </p>
          </div>
        ) : !gameState ? (
          <div className="flex-1 flex flex-col">
            {errorMsg && (
              <div className="max-w-md mx-auto mt-4 px-4 py-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            <LobbyView
              playerName={playerName}
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
              onBack={handleChangeName}
              activeRooms={activeRooms}
              isLoadingRooms={isLoadingRooms}
              roomsError={roomsError}
              onRefreshRooms={fetchActiveRooms}
            />
          </div>
        ) : gameState.status === 'waiting' ? (
          <WaitingRoomView
            gameState={gameState}
            myPlayerId={playerId}
            onStartGame={handleStartGame}
            onLeaveRoom={handleLeaveRoom}
            onKickPlayer={handleKickPlayer}
          />
        ) : (
          <GameTable
            gameState={gameState}
            myPlayerId={playerId}
            onPlayCards={handlePlayCards}
            onPassTurn={handlePassTurn}
            onCallBluff={handleCallBluff}
            onPlayAgain={handlePlayAgain}
            onLeaveRoom={handleLeaveRoom}
            onKickPlayer={handleKickPlayer}
          />
        )}
      </main>
    </div>
  );
}
