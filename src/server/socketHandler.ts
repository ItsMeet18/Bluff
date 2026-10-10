import { Server, Socket } from 'socket.io';
import { GameRoom } from '../engine/GameRoom';
import { RoomManager, UserSession } from './RoomManager';
import { Rank } from '../types/game';

export function broadcastRoomState(io: Server, room: GameRoom): void {
  // Authoritative check against live Socket.IO connection status
  for (const player of room.players) {
    if (player.socketId) {
      const liveSocket = io.sockets.sockets.get(player.socketId);
      if (liveSocket && liveSocket.connected) {
        player.isConnected = true;
      } else if (!liveSocket) {
        player.isConnected = false;
      }
    }
  }

  for (const player of room.players) {
    if (player.socketId) {
      const personalState = room.getPublicState(player.id);
      io.to(player.socketId).emit('game_state_updated', personalState);
    }
  }
}

export function broadcastActiveRooms(io: Server, roomManager: RoomManager): void {
  const activeRooms = roomManager.getActiveRooms();
  io.emit('active_rooms_updated', activeRooms);
}

export function setupSocketHandlers(io: Server, roomManager: RoomManager): void {
  io.on('connection', (socket: Socket) => {
    let currentSession: UserSession | null = null;

    // --- Authentication & Session Setup ---
    socket.on('auth_session', (data: { sessionToken?: string; playerName?: string }, callback?: Function) => {
      currentSession = roomManager.getOrCreateSession(data.sessionToken, data.playerName);
      if (data.playerName && data.playerName.trim()) {
        currentSession.playerName = data.playerName.trim().slice(0, 20);
      }

      // If user was previously in a room, re-attach socket and mark connected
      if (currentSession.roomCode) {
        const room = roomManager.getRoom(currentSession.roomCode);
        if (room) {
          const player = room.players.find(p => p.id === currentSession!.playerId);
          if (player) {
            player.socketId = socket.id;
            player.isConnected = true;
            socket.join(room.roomCode);
            broadcastRoomState(io, room);
          }
        }
      }

      if (callback) {
        callback({
          success: true,
          sessionToken: currentSession.token,
          playerId: currentSession.playerId,
          playerName: currentSession.playerName,
        });
      }
    });

    // Helper to ensure session exists
    const ensureSession = (playerName?: string): UserSession => {
      if (!currentSession) {
        currentSession = roomManager.getOrCreateSession(undefined, playerName);
      } else if (playerName && playerName.trim()) {
        currentSession.playerName = playerName.trim().slice(0, 20);
      }
      return currentSession;
    };

    // --- Get Active Rooms ---
    socket.on('get_active_rooms', (callback?: Function) => {
      const rooms = roomManager.getActiveRooms();
      if (callback) {
        callback({ success: true, rooms });
      }
    });

    // --- Create Room ---
    socket.on(
      'create_room',
      (
        data: { deckCount: number; maxPlayers?: number; minPlayers?: number; playerName?: string },
        callback?: Function
      ) => {
        const session = ensureSession(data.playerName);
        const effectiveName = (data.playerName || session.playerName || '').trim().slice(0, 20);
        if (effectiveName) {
          session.playerName = effectiveName;
        }

        const result = roomManager.createRoom(
          {
            playerName: session.playerName,
            deckCount: data.deckCount,
            maxPlayers: data.maxPlayers,
            minPlayers: data.minPlayers,
          },
          session,
          socket.id
        );

        if (!result.success || !result.room) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        socket.join(result.room.roomCode);
        if (callback) {
          callback({
            success: true,
            roomCode: result.room.roomCode,
            state: result.room.getPublicState(session.playerId),
          });
        }

        broadcastRoomState(io, result.room);
        broadcastActiveRooms(io, roomManager);
      }
    );

    // --- Join Room ---
    socket.on(
      'join_room',
      (data: { roomCode: string; playerName?: string }, callback?: Function) => {
        const session = ensureSession(data.playerName);
        const effectiveName = (data.playerName || session.playerName || '').trim().slice(0, 20);
        if (effectiveName) {
          session.playerName = effectiveName;
        }

        const result = roomManager.joinRoom(
          {
            roomCode: data.roomCode,
            playerName: session.playerName,
            sessionToken: session.token,
          },
          session,
          socket.id
        );

        if (!result.success || !result.room) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        socket.join(result.room.roomCode);
        if (callback) {
          callback({
            success: true,
            roomCode: result.room.roomCode,
            state: result.room.getPublicState(session.playerId),
          });
        }

        broadcastRoomState(io, result.room);
        broadcastActiveRooms(io, roomManager);
      }
    );

    // --- Sync Room State ---
    socket.on('sync_room', (data: { roomCode: string }, callback?: Function) => {
      const room = roomManager.getRoom(data.roomCode);
      if (!room) {
        if (callback) callback({ success: false, error: 'Room not found' });
        return;
      }

      if (currentSession) {
        // Re-attach socketId if needed
        const player = room.players.find(p => p.id === currentSession!.playerId);
        if (player) {
          player.socketId = socket.id;
          player.isConnected = true;
        }
        socket.join(room.roomCode);
        if (callback) {
          callback({ success: true, state: room.getPublicState(currentSession.playerId) });
        }
      } else {
        if (callback) {
          callback({ success: true, state: room.getPublicState() });
        }
      }
    });

    // --- Start Game ---
    socket.on('start_game', (data: { roomCode: string }, callback?: Function) => {
      if (!currentSession) {
        if (callback) callback({ success: false, error: 'Unauthenticated' });
        return;
      }

      const room = roomManager.getRoom(data.roomCode);
      if (!room) {
        if (callback) callback({ success: false, error: 'Room not found' });
        return;
      }

      const startResult = room.startGame(currentSession.playerId);
      if (!startResult.success) {
        if (callback) callback({ success: false, error: startResult.error });
        return;
      }

      if (callback) callback({ success: true });
      broadcastRoomState(io, room);
      broadcastActiveRooms(io, roomManager);
    });

    // --- Play Cards ---
    socket.on(
      'play_cards',
      (data: { roomCode: string; cardIds: string[]; declaredRank?: Rank }, callback?: Function) => {
        if (!currentSession) {
          if (callback) callback({ success: false, error: 'Unauthenticated' });
          return;
        }

        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          if (callback) callback({ success: false, error: 'Room not found' });
          return;
        }

        const player = room.players.find(p => p.id === currentSession!.playerId);
        if (player?.isSpectator) {
          if (callback) callback({ success: false, error: 'Spectators cannot perform gameplay actions' });
          return;
        }

        const playResult = room.playCards(currentSession.playerId, data.cardIds, data.declaredRank);
        if (!playResult.success) {
          if (callback) callback({ success: false, error: playResult.error });
          return;
        }

        if (callback) callback({ success: true });
        broadcastRoomState(io, room);
      }
    );

    // --- Pass Turn ---
    socket.on('pass_turn', (data: { roomCode: string }, callback?: Function) => {
      if (!currentSession) {
        if (callback) callback({ success: false, error: 'Unauthenticated' });
        return;
      }

      const room = roomManager.getRoom(data.roomCode);
      if (!room) {
        if (callback) callback({ success: false, error: 'Room not found' });
        return;
      }

      const player = room.players.find(p => p.id === currentSession!.playerId);
      if (player?.isSpectator) {
        if (callback) callback({ success: false, error: 'Spectators cannot perform gameplay actions' });
        return;
      }

      const passResult = room.passTurn(currentSession.playerId);
      if (!passResult.success) {
        if (callback) callback({ success: false, error: passResult.error });
        return;
      }

      if (callback) callback({ success: true });
      broadcastRoomState(io, room);
    });

    // --- Call Bluff ---
    socket.on(
      'call_bluff',
      (data: { roomCode: string; selectedCardId: string }, callback?: Function) => {
        if (!currentSession) {
          if (callback) callback({ success: false, error: 'Unauthenticated' });
          return;
        }

        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          if (callback) callback({ success: false, error: 'Room not found' });
          return;
        }

        const player = room.players.find(p => p.id === currentSession!.playerId);
        if (player?.isSpectator) {
          if (callback) callback({ success: false, error: 'Spectators cannot perform gameplay actions' });
          return;
        }

        const challengeResult = room.challengeBluff(currentSession.playerId, data.selectedCardId);
        if (!challengeResult.success) {
          if (callback) callback({ success: false, error: challengeResult.error });
          return;
        }

        if (callback) callback({ success: true, result: challengeResult.result });
        broadcastRoomState(io, room);
      }
    );

    // --- Play Again ---
    socket.on('play_again', (data: { roomCode: string }, callback?: Function) => {
      if (!currentSession) {
        if (callback) callback({ success: false, error: 'Unauthenticated' });
        return;
      }

      const room = roomManager.getRoom(data.roomCode);
      if (!room) {
        if (callback) callback({ success: false, error: 'Room not found' });
        return;
      }

      // If room is already in waiting state, rematch was already initiated
      if (room.status === 'waiting') {
        if (callback) callback({ success: true });
        return;
      }

      // Re-attach caller socket and set connected
      const callingPlayer = room.players.find(p => p.id === currentSession!.playerId);
      if (callingPlayer) {
        callingPlayer.socketId = socket.id;
        callingPlayer.isConnected = true;
      }

      // Synchronize live connection states for all players in room
      for (const p of room.players) {
        if (p.socketId) {
          const liveSock = io.sockets.sockets.get(p.socketId);
          p.isConnected = !!(liveSock && liveSock.connected);
        } else {
          p.isConnected = false;
        }
      }

      const resetResult = room.resetForRematch();
      if (!resetResult.success) {
        if (callback) callback({ success: false, error: resetResult.error });
        return;
      }

      if (callback) callback({ success: true });
      broadcastRoomState(io, room);
      broadcastActiveRooms(io, roomManager);
    });

    // --- Leave Room ---
    socket.on('leave_room', (data: { roomCode: string }, callback?: Function) => {
      if (!currentSession) return;
      const room = roomManager.getRoom(data.roomCode);
      if (room) {
        const { roomEmpty } = room.removePlayer(currentSession.playerId);
        if (roomEmpty) {
          roomManager.removeRoom(room.roomCode);
        } else {
          broadcastRoomState(io, room);
        }
        socket.leave(room.roomCode);
        broadcastActiveRooms(io, roomManager);
      }
      if (callback) callback({ success: true });
    });

    // --- Disconnect ---
    socket.on('disconnect', () => {
      if (currentSession?.roomCode) {
        const room = roomManager.getRoom(currentSession.roomCode);
        if (room) {
          room.markDisconnected(socket.id);
          broadcastRoomState(io, room);
          broadcastActiveRooms(io, roomManager);
        }
      }
    });
  });
}
