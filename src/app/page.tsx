'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useGameSocket } from '../hooks/useGameSocket';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { Navbar } from '../components/Navbar';
import { LandingView } from '../components/LandingView';
import { LobbyView } from '../components/LobbyView';
import { WaitingRoomView } from '../components/WaitingRoomView';
import { GameTable } from '../components/GameTable';

export default function BluffApp() {
  const {
    isConnected,
    gameState,
    playerId,
    playerName,
    setPlayerName,
    invitedRoomCode,
    setInvitedRoomCode,
    activeRooms,
    isLoadingRooms,
    roomsError,
    fetchActiveRooms,
    createRoom,
    joinRoom,
    startGame,
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

  // If user ALREADY had a name stored and lands on invite link (?room=XYZ), auto-join once socket is connected
  useEffect(() => {
    if (isConnected && playerName && invitedRoomCode && !gameState && !autoJoinAttempted.current) {
      autoJoinAttempted.current = true;
      joinRoom(invitedRoomCode, playerName).then(res => {
        if (!res.success) {
          setInviteError(res.error || `Unable to join room ${invitedRoomCode}`);
          setInvitedRoomCode(null);
        }
      });
    }
  }, [isConnected, playerName, invitedRoomCode, gameState, joinRoom, setInvitedRoomCode]);

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
        ) : !gameState ? (
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
        ) : gameState.status === 'waiting' ? (
          <WaitingRoomView
            gameState={gameState}
            myPlayerId={playerId}
            onStartGame={handleStartGame}
            onLeaveRoom={handleLeaveRoom}
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
          />
        )}
      </main>
    </div>
  );
}
