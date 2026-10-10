import { GameRoom } from '../engine/GameRoom';
import { CreateRoomDto, JoinRoomDto, RoomConfig, ActiveRoomSummary } from '../types/game';

// Unambiguous characters for readable 6-character codes
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface UserSession {
  token: string;
  playerId: string;
  playerName: string;
  roomCode?: string;
  lastActive: number;
}

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private sessions: Map<string, UserSession> = new Map(); // sessionToken -> UserSession
  private playerSessions: Map<string, string> = new Map(); // playerId -> sessionToken

  constructor() {
    // Periodically clean up abandoned rooms older than 4 hours
    setInterval(() => this.cleanupOldRooms(), 1000 * 60 * 30);
  }

  public generateRoomCode(): string {
    let code = '';
    let attempts = 0;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        const randomIndex = Math.floor(Math.random() * CODE_CHARS.length);
        code += CODE_CHARS[randomIndex];
      }
      attempts++;
    } while (this.rooms.has(code) && attempts < 100);

    return code;
  }

  public getOrCreateSession(existingToken?: string, requestedName?: string): UserSession {
    if (existingToken && this.sessions.has(existingToken)) {
      const session = this.sessions.get(existingToken)!;
      session.lastActive = Date.now();
      if (requestedName && requestedName.trim()) {
        session.playerName = requestedName.trim().slice(0, 20);
      }
      return session;
    }

    const token = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
    const playerId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const playerName = requestedName?.trim().slice(0, 20) || `Player_${playerId.slice(-4)}`;

    const session: UserSession = {
      token,
      playerId,
      playerName,
      lastActive: Date.now(),
    };

    this.sessions.set(token, session);
    this.playerSessions.set(playerId, token);
    return session;
  }

  public getSessionByToken(token: string): UserSession | undefined {
    return this.sessions.get(token);
  }

  public createRoom(dto: CreateRoomDto, session: UserSession, socketId?: string): { success: boolean; room?: GameRoom; error?: string } {
    const roomCode = this.generateRoomCode();
    const config: RoomConfig = {
      roomCode,
      hostId: session.playerId,
      deckCount: dto.deckCount || 1,
      maxPlayers: dto.maxPlayers || 6,
      minPlayers: dto.minPlayers || 2,
      isPrivate: true,
    };

    const effectiveName = (dto.playerName || session.playerName || '').trim().slice(0, 20) || `Player_${session.playerId.slice(-4)}`;
    session.playerName = effectiveName;

    const room = new GameRoom(config);
    const joinResult = room.addPlayer(session.playerId, effectiveName, socketId);
    if (!joinResult.success) {
      return { success: false, error: joinResult.error };
    }

    session.roomCode = roomCode;
    this.rooms.set(roomCode, room);

    return { success: true, room };
  }

  public joinRoom(dto: JoinRoomDto, session: UserSession, socketId?: string): { success: boolean; room?: GameRoom; error?: string } {
    const cleanCode = (dto.roomCode || '').trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, error: 'Please enter a valid room code' };
    }

    const room = this.rooms.get(cleanCode);
    if (!room) {
      return { success: false, error: `Room ${cleanCode} does not exist` };
    }

    const effectiveName = (dto.playerName || session.playerName || '').trim().slice(0, 20) || `Player_${session.playerId.slice(-4)}`;
    session.playerName = effectiveName;

    if (room.status !== 'waiting') {
      // Check if this is a reconnecting player
      const existingPlayer = room.players.find(p => p.id === session.playerId);
      if (existingPlayer) {
        if (dto.playerName && dto.playerName.trim()) {
          existingPlayer.name = effectiveName;
        }
        room.reconnectPlayer(session.playerId, socketId || '');
        session.roomCode = cleanCode;
        return { success: true, room };
      }
      return { success: false, error: 'Game has already started in this room' };
    }

    const joinResult = room.addPlayer(session.playerId, effectiveName, socketId);
    if (!joinResult.success) {
      return { success: false, error: joinResult.error };
    }

    session.roomCode = cleanCode;
    return { success: true, room };
  }

  public getActiveRooms(): ActiveRoomSummary[] {
    const list: ActiveRoomSummary[] = [];
    this.rooms.forEach(room => {
      if (room.status === 'waiting' && room.players.length < room.config.maxPlayers) {
        const host = room.players.find(p => p.id === room.config.hostId) || room.players[0];
        list.push({
          roomCode: room.roomCode,
          hostName: host ? host.name : 'Host',
          playerCount: room.players.length,
          maxPlayers: room.config.maxPlayers,
          deckCount: room.config.deckCount,
          status: 'waiting',
          createdAt: room.createdAt,
        });
      }
    });
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }

  public getRoom(roomCode: string): GameRoom | undefined {
    return this.rooms.get(roomCode.trim().toUpperCase());
  }

  public removeRoom(roomCode: string): void {
    this.rooms.delete(roomCode.trim().toUpperCase());
  }

  private cleanupOldRooms(): void {
    const now = Date.now();
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    this.rooms.forEach((room, code) => {
      if (now - room.updatedAt > FOUR_HOURS) {
        this.rooms.delete(code);
      }
    });
  }
}

// Global singleton for server runtime
export const globalRoomManager = new RoomManager();
