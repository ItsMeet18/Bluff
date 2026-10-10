'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PublicGameState, Rank, RevealedChallengeCard, ActiveRoomSummary } from '../types/game';

const SESSION_TOKEN_KEY = 'bluff_session_token';
const PLAYER_NAME_KEY = 'bluff_player_name';

export function useGameSocket() {
  const [isConnected, setIsConnected] = useState<boolean>(true);
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
  const roomCodeRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep refs updated
  useEffect(() => {
    roomCodeRef.current = gameState?.roomCode || null;
  }, [gameState?.roomCode]);

  // Load stored name, token, and check URL invite on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedName = localStorage.getItem(PLAYER_NAME_KEY) || '';
    const storedToken = localStorage.getItem(SESSION_TOKEN_KEY) || '';
    setPlayerNameState(storedName);
    playerNameRef.current = storedName;
    setSessionToken(storedToken);
    sessionTokenRef.current = storedToken;

    // Initialize session with backend
    fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken: storedToken, playerName: storedName }),
    })
      .then(res => res.json())
      .then(data => {
        if (data?.success) {
          setSessionToken(data.sessionToken);
          sessionTokenRef.current = data.sessionToken;
          setPlayerId(data.playerId);
          localStorage.setItem(SESSION_TOKEN_KEY, data.sessionToken);
        }
      })
      .catch(() => {});

    // Check for direct invite parameter in URL (?room=ABC123)
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      const code = roomParam.trim().toUpperCase();
      if (code.length >= 3) {
        setInvitedRoomCode(code);
      }
    }

    fetchActiveRooms();
  }, []);

  const fetchActiveRooms = useCallback(async () => {
    setIsLoadingRooms(true);
    setRoomsError(null);
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.rooms) {
          setActiveRooms(data.rooms);
        }
      }
    } catch {
      setRoomsError('Failed to load active rooms');
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  // Update player name and sync session
  const setPlayerName = useCallback((name: string) => {
    const clean = name.trim().slice(0, 20);
    setPlayerNameState(clean);
    playerNameRef.current = clean;
    if (typeof window !== 'undefined') {
      localStorage.setItem(PLAYER_NAME_KEY, clean);
    }

    const currentToken =
      sessionTokenRef.current ||
      (typeof window !== 'undefined' ? localStorage.getItem(SESSION_TOKEN_KEY) : '') ||
      undefined;

    fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken: currentToken, playerName: clean }),
    })
      .then(res => res.json())
      .then(data => {
        if (data?.success) {
          setSessionToken(data.sessionToken);
          sessionTokenRef.current = data.sessionToken;
          setPlayerId(data.playerId);
          if (typeof window !== 'undefined') {
            localStorage.setItem(SESSION_TOKEN_KEY, data.sessionToken);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Sync game state from server
  const syncGameState = useCallback(async (roomCode: string, token: string) => {
    try {
      const res = await fetch('/api/game/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode, sessionToken: token }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.state) {
          setGameState(data.state);
          if (data.state.myPlayerId) {
            setPlayerId(data.state.myPlayerId);
          }
        } else if (data.error === 'Room not found' || data.error === 'Room has expired') {
          setGameState(null);
        }
      }
    } catch {
      // Network error, will retry on next interval
    }
  }, []);

  // Setup WebSocket connection
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let socket: WebSocket | null = null;
    let isCleanedUp = false;

    const connectWebSocket = () => {
      if (isCleanedUp) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const roomParam = roomCodeRef.current ? `&roomCode=${roomCodeRef.current}` : '';
      const tokenParam = sessionTokenRef.current ? `&sessionToken=${sessionTokenRef.current}` : '';
      const wsUrl = `${protocol}//${host}/api/ws?${roomParam}${tokenParam}`;

      try {
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          if (isCleanedUp) return;
          setIsConnected(true);
          setErrorMsg(null);
        };

        socket.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'GAME_STATE_UPDATE' && msg.state) {
              setGameState(msg.state);
              if (msg.state.myPlayerId) {
                setPlayerId(msg.state.myPlayerId);
              }
            } else if (msg.type === 'ACTIVE_ROOMS_UPDATE' && msg.rooms) {
              setActiveRooms(msg.rooms);
            }
          } catch {
            // Ignore non-JSON messages
          }
        };

        socket.onclose = () => {
          if (isCleanedUp) return;
          // Attempt reconnection after a brief delay
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
        };

        socket.onerror = () => {
          // Socket error, fallback polling handles synchronization
        };
      } catch {
        // Fallback polling handles state
      }
    };

    connectWebSocket();

    return () => {
      isCleanedUp = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socket) {
        socket.close();
      }
      wsRef.current = null;
    };
  }, [gameState?.roomCode]);

  // Periodic heartbeat and sync polling to ensure 100% resilient state in serverless environment
  useEffect(() => {
    const interval = setInterval(() => {
      const currentRoom = roomCodeRef.current;
      const currentToken = sessionTokenRef.current;
      if (currentRoom && currentToken) {
        syncGameState(currentRoom, currentToken);
      } else {
        fetchActiveRooms();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [syncGameState, fetchActiveRooms]);

  // Actions
  const createRoom = useCallback(
    async (
      deckCount: number = 1,
      maxPlayers: number = 6,
      minPlayers: number = 2,
      explicitName?: string
    ): Promise<{ success: boolean; error?: string; roomCode?: string }> => {
      try {
        const nameToSend = (
          explicitName ||
          playerNameRef.current ||
          playerName ||
          (typeof window !== 'undefined' ? localStorage.getItem(PLAYER_NAME_KEY) : '') ||
          ''
        )
          .trim()
          .slice(0, 20);

        const tokenToSend =
          sessionTokenRef.current ||
          (typeof window !== 'undefined' ? localStorage.getItem(SESSION_TOKEN_KEY) : '') ||
          undefined;

        const res = await fetch('/api/game/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deckCount,
            maxPlayers,
            minPlayers,
            playerName: nameToSend,
            sessionToken: tokenToSend,
          }),
        });

        const data = await res.json();
        if (data.success && data.state) {
          if (data.sessionToken) {
            setSessionToken(data.sessionToken);
            sessionTokenRef.current = data.sessionToken;
            localStorage.setItem(SESSION_TOKEN_KEY, data.sessionToken);
          }
          if (data.playerId) {
            setPlayerId(data.playerId);
          }
          setGameState(data.state);
          return { success: true, roomCode: data.roomCode };
        } else {
          return { success: false, error: data.error || 'Failed to create room' };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Network error' };
      }
    },
    [playerName]
  );

  const joinRoom = useCallback(
    async (roomCode: string, explicitName?: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const nameToSend = (
          explicitName ||
          playerNameRef.current ||
          playerName ||
          (typeof window !== 'undefined' ? localStorage.getItem(PLAYER_NAME_KEY) : '') ||
          ''
        )
          .trim()
          .slice(0, 20);

        const tokenToSend =
          sessionTokenRef.current ||
          (typeof window !== 'undefined' ? localStorage.getItem(SESSION_TOKEN_KEY) : '') ||
          undefined;

        const res = await fetch('/api/game/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode: roomCode.trim().toUpperCase(),
            playerName: nameToSend,
            sessionToken: tokenToSend,
          }),
        });

        const data = await res.json();
        if (data.success && data.state) {
          if (data.sessionToken) {
            setSessionToken(data.sessionToken);
            sessionTokenRef.current = data.sessionToken;
            localStorage.setItem(SESSION_TOKEN_KEY, data.sessionToken);
          }
          if (data.playerId) {
            setPlayerId(data.playerId);
          }
          setGameState(data.state);
          return { success: true };
        } else {
          return { success: false, error: data.error || 'Failed to join room' };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Network error' };
      }
    },
    [playerName]
  );

  const performGameAction = useCallback(
    async (action: any): Promise<{ success: boolean; error?: string; result?: any }> => {
      if (!gameState || !sessionTokenRef.current) {
        return { success: false, error: 'Room not loaded or session missing' };
      }

      try {
        const res = await fetch('/api/game/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode: gameState.roomCode,
            sessionToken: sessionTokenRef.current,
            action,
          }),
        });

        const data = await res.json();
        if (data.success) {
          if (data.state) {
            setGameState(data.state);
          }
          return { success: true, result: data.result };
        } else {
          return { success: false, error: data.error || 'Action failed' };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Network error' };
      }
    },
    [gameState]
  );

  const startGame = useCallback((): Promise<{ success: boolean; error?: string }> => {
    return performGameAction({ type: 'START_GAME' });
  }, [performGameAction]);

  const playCards = useCallback(
    (cardIds: string[], declaredRank?: Rank): Promise<{ success: boolean; error?: string }> => {
      return performGameAction({ type: 'PLAY_CARDS', cardIds, declaredRank });
    },
    [performGameAction]
  );

  const passTurn = useCallback((): Promise<{ success: boolean; error?: string }> => {
    return performGameAction({ type: 'PASS_TURN' });
  }, [performGameAction]);

  const callBluff = useCallback(
    (selectedCardId: string): Promise<{ success: boolean; error?: string; result?: RevealedChallengeCard }> => {
      return performGameAction({ type: 'CALL_BLUFF', selectedCardId });
    },
    [performGameAction]
  );

  const playAgain = useCallback((): Promise<{ success: boolean; error?: string }> => {
    return performGameAction({ type: 'PLAY_AGAIN' });
  }, [performGameAction]);

  const leaveRoom = useCallback(async () => {
    if (gameState && sessionTokenRef.current) {
      await performGameAction({ type: 'LEAVE_ROOM' });
      setGameState(null);
    }
  }, [gameState, performGameAction]);

  return {
    socket: null,
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
