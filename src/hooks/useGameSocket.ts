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
  const gameStateRef = useRef<PublicGameState | null>(null);
  const versionRef = useRef<number | undefined>(undefined);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef<boolean>(false);
  const isVisibleRef = useRef<boolean>(true);

  // Keep refs updated
  useEffect(() => {
    roomCodeRef.current = gameState?.roomCode || null;
    gameStateRef.current = gameState;
    versionRef.current = gameState?.version;
  }, [gameState]);

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
      .then(async res => {
        if (!res.ok) return null;
        return res.json();
      })
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
      } else {
        setRoomsError('Unable to load active rooms');
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
      .then(async res => {
        if (!res.ok) return null;
        return res.json();
      })
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

  // Sync game state from server with version check and in-flight deduplication
  const syncGameState = useCallback(async (roomCode: string, token: string) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      const currentVersion = versionRef.current;
      const vQuery = currentVersion !== undefined ? `&v=${currentVersion}` : '';
      const res = await fetch(`/api/game/sync?roomCode=${roomCode}&sessionToken=${token}${vQuery}`);

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.notModified) {
            // State is already identical on server; skip state update and re-render
          } else if (data.state) {
            setGameState(data.state);
            versionRef.current = data.state.version;
            if (data.state.myPlayerId) {
              setPlayerId(data.state.myPlayerId);
            }
          }
        } else if (data.kicked) {
          setGameState(null);
          setErrorMsg(data.error || 'You were removed from the room by the host.');
        } else if (data.error === 'Room not found' || data.error === 'Room has expired') {
          setGameState(null);
          if (data.error === 'Room has expired') {
            setErrorMsg('This room has expired after 5 minutes in the waiting room.');
          }
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 403 || errData?.kicked) {
          setGameState(null);
          setErrorMsg(errData?.error || 'You were removed from the room by the host.');
        } else if (res.status === 410 || errData?.error === 'Room has expired') {
          setGameState(null);
          setErrorMsg('This room has expired after 5 minutes in the waiting room.');
        } else if (res.status === 404) {
          setGameState(null);
        }
      }
    } catch {
      // Network error, will retry on next schedule
    } finally {
      isSyncingRef.current = false;
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

        socket.onmessage = event => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'GAME_STATE_UPDATE' && msg.state) {
              setGameState(msg.state);
              versionRef.current = msg.state.version;
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
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 4000);
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

  // Visibility-Aware & Adaptive Polling to drastically reduce Redis command usage
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    let isDestroyed = false;

    const onVisibilityChange = () => {
      const visible = !document.hidden;
      isVisibleRef.current = visible;
      if (visible) {
        // Immediate sync when tab becomes visible again
        const currentRoom = roomCodeRef.current;
        const currentToken = sessionTokenRef.current;
        if (currentRoom && currentToken) {
          syncGameState(currentRoom, currentToken);
        } else {
          fetchActiveRooms();
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    const getNextInterval = () => {
      if (!isVisibleRef.current) {
        return 30_000; // 30s heartbeat when tab is hidden/minimized
      }
      if (!roomCodeRef.current) {
        return 6_000; // 6s in lobby
      }
      const state = gameStateRef.current;
      if (state?.status === 'waiting') {
        return 3_000; // 3s in waiting room
      }
      if (state?.status === 'game_over') {
        return 4_000; // 4s on match complete
      }
      if (state?.isMyTurn) {
        return 4_000; // 4s when current player is thinking
      }
      return 2_500; // 2.5s active gameplay when waiting for opponent move
    };

    const runPollLoop = async () => {
      if (isDestroyed) return;

      const currentRoom = roomCodeRef.current;
      const currentToken = sessionTokenRef.current;

      if (currentRoom && currentToken) {
        await syncGameState(currentRoom, currentToken);
      } else {
        await fetchActiveRooms();
      }

      if (!isDestroyed) {
        pollTimerRef.current = setTimeout(runPollLoop, getNextInterval());
      }
    };

    pollTimerRef.current = setTimeout(runPollLoop, getNextInterval());

    return () => {
      isDestroyed = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
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

        const data = await res.json().catch(() => ({ success: false, error: `Server error (${res.status})` }));
        if (res.ok && data.success && data.state) {
          if (data.sessionToken) {
            setSessionToken(data.sessionToken);
            sessionTokenRef.current = data.sessionToken;
            localStorage.setItem(SESSION_TOKEN_KEY, data.sessionToken);
          }
          if (data.playerId) {
            setPlayerId(data.playerId);
          }
          setGameState(data.state);
          versionRef.current = data.state.version;
          return { success: true, roomCode: data.roomCode };
        } else {
          return { success: false, error: data.error || `Failed to create room (${res.status})` };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Network error creating room' };
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

        const data = await res.json().catch(() => ({ success: false, error: `Server error (${res.status})` }));
        if (res.ok && data.success && data.state) {
          if (data.sessionToken) {
            setSessionToken(data.sessionToken);
            sessionTokenRef.current = data.sessionToken;
            localStorage.setItem(SESSION_TOKEN_KEY, data.sessionToken);
          }
          if (data.playerId) {
            setPlayerId(data.playerId);
          }
          setGameState(data.state);
          versionRef.current = data.state.version;
          return { success: true };
        } else {
          return { success: false, error: data.error || `Failed to join room (${res.status})` };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Network error joining room' };
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

        const data = await res.json().catch(() => ({ success: false, error: `Server error (${res.status})` }));
        if (res.ok && data.success) {
          if (data.state) {
            setGameState(data.state);
            versionRef.current = data.state.version;
          }
          return { success: true, result: data.result };
        } else {
          if (res.status === 403 || data.kicked) {
            setGameState(null);
            setErrorMsg(data.error || 'You were removed from the room by the host.');
          } else if (res.status === 410 || data.error === 'Room has expired') {
            setGameState(null);
            setErrorMsg('This room has expired after 5 minutes in the waiting room.');
          }
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

  const kickPlayer = useCallback(
    (targetPlayerId: string): Promise<{ success: boolean; error?: string }> => {
      return performGameAction({ type: 'KICK_PLAYER', targetPlayerId });
    },
    [performGameAction]
  );

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
      versionRef.current = undefined;
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
    kickPlayer,
    playCards,
    passTurn,
    callBluff,
    playAgain,
    leaveRoom,
  };
}
