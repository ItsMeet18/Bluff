'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { PublicGameState, Rank, RevealedChallengeCard, ActiveRoomSummary } from '../types/game';

const SESSION_TOKEN_KEY = 'bluff_session_token';
const PLAYER_NAME_KEY = 'bluff_player_name';

export function useGameSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [gameState, setGameState] = useState<PublicGameState | null>(null);
  const [playerName, setPlayerNameState] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');
  const [sessionToken, setSessionToken] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [invitedRoomCode, setInvitedRoomCode] = useState<string | null>(null);
  const [activeRooms, setActiveRooms] = useState<ActiveRoomSummary[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState<boolean>(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  const playerNameRef = useRef<string>('');
  const sessionTokenRef = useRef<string>('');
  const socketRef = useRef<Socket | null>(null);

  // Load stored name, token, and check URL invite on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedName = localStorage.getItem(PLAYER_NAME_KEY) || '';
    const storedToken = localStorage.getItem(SESSION_TOKEN_KEY) || '';
    setPlayerNameState(storedName);
    playerNameRef.current = storedName;
    setSessionToken(storedToken);
    sessionTokenRef.current = storedToken;

    // Check for direct invite parameter in URL (?room=ABC123)
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      const code = roomParam.trim().toUpperCase();
      if (code.length >= 3) {
        setInvitedRoomCode(code);
      }
    }
  }, []);

  const fetchActiveRooms = useCallback(async () => {
    setIsLoadingRooms(true);
    setRoomsError(null);
    try {
      const activeSock = socketRef.current;
      if (activeSock && activeSock.connected) {
        activeSock.emit(
          'get_active_rooms',
          (res: { success: boolean; rooms?: ActiveRoomSummary[]; error?: string }) => {
            if (res?.success && res.rooms) {
              setActiveRooms(res.rooms);
            }
            setIsLoadingRooms(false);
          }
        );
      } else {
        const res = await fetch('/api/rooms');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.rooms) {
            setActiveRooms(data.rooms);
          }
        }
        setIsLoadingRooms(false);
      }
    } catch {
      setRoomsError('Failed to load active rooms');
      setIsLoadingRooms(false);
    }
  }, []);

  const setPlayerName = useCallback((name: string) => {
    const clean = name.trim().slice(0, 20);
    setPlayerNameState(clean);
    playerNameRef.current = clean;
    if (typeof window !== 'undefined') {
      localStorage.setItem(PLAYER_NAME_KEY, clean);
    }

    // Immediately synchronize session on the server
    const currentSock = socketRef.current;
    if (currentSock && currentSock.connected) {
      const currentToken =
        sessionTokenRef.current ||
        (typeof window !== 'undefined' ? localStorage.getItem(SESSION_TOKEN_KEY) : '') ||
        undefined;
      currentSock.emit(
        'auth_session',
        { sessionToken: currentToken, playerName: clean },
        (res: { success: boolean; sessionToken: string; playerId: string; playerName: string }) => {
          if (res?.success) {
            setSessionToken(res.sessionToken);
            sessionTokenRef.current = res.sessionToken;
            setPlayerId(res.playerId);
            if (typeof window !== 'undefined') {
              localStorage.setItem(SESSION_TOKEN_KEY, res.sessionToken);
            }
          }
        }
      );
    }
  }, []);

  // Initialize Socket connection
  useEffect(() => {
    const newSocket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      setIsConnected(true);
      setErrorMsg(null);

      // Authenticate with server using token and current name
      const token =
        sessionTokenRef.current ||
        (typeof window !== 'undefined' ? localStorage.getItem(SESSION_TOKEN_KEY) : '') ||
        undefined;
      const name =
        playerNameRef.current ||
        (typeof window !== 'undefined' ? localStorage.getItem(PLAYER_NAME_KEY) : '') ||
        undefined;

      newSocket.emit(
        'auth_session',
        { sessionToken: token, playerName: name },
        (res: { success: boolean; sessionToken: string; playerId: string; playerName: string }) => {
          if (res?.success) {
            setSessionToken(res.sessionToken);
            sessionTokenRef.current = res.sessionToken;
            setPlayerId(res.playerId);
            if (typeof window !== 'undefined') {
              localStorage.setItem(SESSION_TOKEN_KEY, res.sessionToken);
            }
          }
        }
      );

      // Fetch active rooms on connection
      newSocket.emit('get_active_rooms', (res: { success: boolean; rooms?: ActiveRoomSummary[] }) => {
        if (res?.success && res.rooms) {
          setActiveRooms(res.rooms);
        }
      });
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('game_state_updated', (updatedState: PublicGameState) => {
      setGameState(updatedState);
      if (updatedState.myPlayerId) {
        setPlayerId(updatedState.myPlayerId);
      }
    });

    newSocket.on('active_rooms_updated', (rooms: ActiveRoomSummary[]) => {
      setActiveRooms(rooms);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Actions
  const createRoom = useCallback(
    (
      deckCount: number = 1,
      maxPlayers: number = 6,
      minPlayers: number = 2,
      explicitName?: string
    ): Promise<{ success: boolean; error?: string; roomCode?: string }> => {
      return new Promise(resolve => {
        const activeSocket = socketRef.current || socket;
        if (!activeSocket) return resolve({ success: false, error: 'Connecting to server...' });

        const nameToSend = (
          explicitName ||
          playerNameRef.current ||
          playerName ||
          (typeof window !== 'undefined' ? localStorage.getItem(PLAYER_NAME_KEY) : '') ||
          ''
        )
          .trim()
          .slice(0, 20);

        activeSocket.emit(
          'create_room',
          { deckCount, maxPlayers, minPlayers, playerName: nameToSend },
          (res: { success: boolean; roomCode?: string; state?: PublicGameState; error?: string }) => {
            if (res.success && res.state) {
              setGameState(res.state);
              if (res.state.myPlayerId) {
                setPlayerId(res.state.myPlayerId);
              }
              resolve({ success: true, roomCode: res.roomCode });
            } else {
              resolve({ success: false, error: res.error || 'Failed to create room' });
            }
          }
        );
      });
    },
    [socket, playerName]
  );

  const joinRoom = useCallback(
    (roomCode: string, explicitName?: string): Promise<{ success: boolean; error?: string }> => {
      return new Promise(resolve => {
        const activeSocket = socketRef.current || socket;
        if (!activeSocket) return resolve({ success: false, error: 'Connecting to server...' });

        const nameToSend = (
          explicitName ||
          playerNameRef.current ||
          playerName ||
          (typeof window !== 'undefined' ? localStorage.getItem(PLAYER_NAME_KEY) : '') ||
          ''
        )
          .trim()
          .slice(0, 20);

        activeSocket.emit(
          'join_room',
          { roomCode: roomCode.trim().toUpperCase(), playerName: nameToSend },
          (res: { success: boolean; roomCode?: string; state?: PublicGameState; error?: string }) => {
            if (res.success && res.state) {
              setGameState(res.state);
              if (res.state.myPlayerId) {
                setPlayerId(res.state.myPlayerId);
              }
              resolve({ success: true });
            } else {
              resolve({ success: false, error: res.error || 'Failed to join room' });
            }
          }
        );
      });
    },
    [socket, playerName]
  );

  const startGame = useCallback((): Promise<{ success: boolean; error?: string }> => {
    return new Promise(resolve => {
      if (!socket || !gameState) return resolve({ success: false, error: 'Room not loaded' });
      socket.emit('start_game', { roomCode: gameState.roomCode }, (res: { success: boolean; error?: string }) => {
        if (res.success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: res.error || 'Failed to start game' });
        }
      });
    });
  }, [socket, gameState]);

  const playCards = useCallback(
    (cardIds: string[], declaredRank?: Rank): Promise<{ success: boolean; error?: string }> => {
      return new Promise(resolve => {
        if (!socket || !gameState) return resolve({ success: false, error: 'Room not loaded' });
        socket.emit(
          'play_cards',
          { roomCode: gameState.roomCode, cardIds, declaredRank },
          (res: { success: boolean; error?: string }) => {
            if (res.success) {
              resolve({ success: true });
            } else {
              resolve({ success: false, error: res.error || 'Failed to play cards' });
            }
          }
        );
      });
    },
    [socket, gameState]
  );

  const passTurn = useCallback((): Promise<{ success: boolean; error?: string }> => {
    return new Promise(resolve => {
      if (!socket || !gameState) return resolve({ success: false, error: 'Room not loaded' });
      socket.emit('pass_turn', { roomCode: gameState.roomCode }, (res: { success: boolean; error?: string }) => {
        if (res.success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: res.error || 'Failed to pass turn' });
        }
      });
    });
  }, [socket, gameState]);

  const callBluff = useCallback(
    (selectedCardId: string): Promise<{ success: boolean; error?: string; result?: RevealedChallengeCard }> => {
      return new Promise(resolve => {
        if (!socket || !gameState) return resolve({ success: false, error: 'Room not loaded' });
        socket.emit(
          'call_bluff',
          { roomCode: gameState.roomCode, selectedCardId },
          (res: { success: boolean; error?: string; result?: RevealedChallengeCard }) => {
            if (res.success) {
              resolve({ success: true, result: res.result });
            } else {
              resolve({ success: false, error: res.error || 'Failed to challenge bluff' });
            }
          }
        );
      });
    },
    [socket, gameState]
  );

  const playAgain = useCallback((): Promise<{ success: boolean; error?: string }> => {
    return new Promise(resolve => {
      if (!socket || !gameState) return resolve({ success: false, error: 'Room not loaded' });
      socket.emit('play_again', { roomCode: gameState.roomCode }, (res: { success: boolean; error?: string }) => {
        if (res.success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: res.error || 'Failed to reset room' });
        }
      });
    });
  }, [socket, gameState]);

  const leaveRoom = useCallback(() => {
    if (socket && gameState) {
      socket.emit('leave_room', { roomCode: gameState.roomCode });
      setGameState(null);
    }
  }, [socket, gameState]);

  return {
    socket,
    isConnected,
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
    playCards,
    passTurn,
    callBluff,
    playAgain,
    leaveRoom,
  };
}
