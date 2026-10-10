import { redis } from './redis';
import { GameRoom } from '../engine/GameRoom';
import { RoomConfig, ActiveRoomSummary } from '../types/game';

const ROOM_PREFIX = 'bluff:room:';
const SESSION_PREFIX = 'bluff:session:';
const ACTIVE_ROOMS_KEY = 'bluff:active_rooms';
const LOCK_PREFIX = 'bluff:lock:';

const ROOM_TTL_SECONDS = 60 * 60 * 6; // 6 hours
const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours
const LOCK_TTL_SECONDS = 5; // 5 seconds distributed lock

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface UserSession {
  token: string;
  sessionToken: string;
  playerId: string;
  playerName: string;
  roomCode?: string;
  lastActive: number;
}

export interface CreateRoomDto {
  deckCount?: number;
  maxPlayers?: number;
  minPlayers?: number;
  playerName?: string;
}

export interface JoinRoomDto {
  roomCode: string;
  playerName?: string;
}

export class RedisRoomStore {
  private roomKey(code: string): string {
    return `${ROOM_PREFIX}${code.toUpperCase()}`;
  }

  private sessionKey(token: string): string {
    return `${SESSION_PREFIX}${token}`;
  }

  private lockKey(code: string): string {
    return `${LOCK_PREFIX}${code.toUpperCase()}`;
  }

  private activeRoomsKey(): string {
    return ACTIVE_ROOMS_KEY;
  }

  // --- Session Management ---

  public async getOrCreateSession(token?: string, requestedName?: string): Promise<UserSession> {
    if (token) {
      const existing = await this.getSession(token);
      if (existing) {
        if (requestedName && requestedName.trim()) {
          existing.playerName = requestedName.trim().slice(0, 20);
          await this.saveSession(existing);
        }
        return existing;
      }
    }

    const generatedToken = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
    const playerId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const playerName = requestedName?.trim().slice(0, 20) || `Player_${playerId.slice(-4)}`;

    const session: UserSession = {
      token: generatedToken,
      sessionToken: generatedToken,
      playerId,
      playerName,
      lastActive: Date.now(),
    };

    await redis.set(this.sessionKey(generatedToken), session, { ex: SESSION_TTL_SECONDS });
    return session;
  }

  public async getSession(token: string): Promise<UserSession | null> {
    if (!token) return null;
    const session = await redis.get<UserSession>(this.sessionKey(token));
    if (session && !session.sessionToken && session.token) {
      session.sessionToken = session.token;
    }
    return session;
  }

  public async saveSession(session: UserSession): Promise<void> {
    session.lastActive = Date.now();
    if (!session.sessionToken && session.token) {
      session.sessionToken = session.token;
    }
    if (!session.token && session.sessionToken) {
      session.token = session.sessionToken;
    }
    await redis.set(this.sessionKey(session.token), session, { ex: SESSION_TTL_SECONDS });
  }

  // --- Room Code Generation ---

  public async generateRoomCode(): Promise<string> {
    let code = '';
    let attempts = 0;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        const randomIndex = Math.floor(Math.random() * CODE_CHARS.length);
        code += CODE_CHARS[randomIndex];
      }
      const exists = await redis.get(this.roomKey(code));
      if (!exists) return code;
      attempts++;
    } while (attempts < 100);

    return code;
  }

  // --- Room Fetch & Save ---

  public async getRoom(roomCode: string): Promise<GameRoom | null> {
    const cleanCode = roomCode.trim().toUpperCase();
    const data = await redis.get(this.roomKey(cleanCode));
    if (!data) return null;
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      return GameRoom.fromJSON(parsed);
    } catch {
      return null;
    }
  }

  public async saveRoom(room: GameRoom): Promise<void> {
    room.updatedAt = Date.now();
    const cleanCode = room.roomCode.toUpperCase();
    await redis.set(this.roomKey(cleanCode), room.toJSON(), { ex: ROOM_TTL_SECONDS });

    // Update active rooms index
    if (room.status === 'waiting' && room.players.length < room.config.maxPlayers) {
      await redis.zadd(this.activeRoomsKey(), { score: room.createdAt, member: cleanCode });
    } else {
      await redis.zrem(this.activeRoomsKey(), cleanCode);
    }
  }

  public async deleteRoom(roomCode: string): Promise<void> {
    const cleanCode = roomCode.trim().toUpperCase();
    await redis.del(this.roomKey(cleanCode));
    await redis.zrem(this.activeRoomsKey(), cleanCode);
  }

  // --- Atomic Execution with Distributed Lock ---

  public async runAtomic<T>(
    roomCode: string,
    mutator: (room: GameRoom) => Promise<{ result?: T; changed?: boolean } | T | void> | { result?: T; changed?: boolean } | T | void,
    options: { maxRetries?: number; retryDelayMs?: number } = {}
  ): Promise<T> {
    const cleanCode = roomCode.trim().toUpperCase();
    const lockKey = this.lockKey(cleanCode);
    const lockValue = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const maxRetries = options.maxRetries ?? 8;
    const retryDelay = options.retryDelayMs ?? 40;

    let acquired = false;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const res = await redis.set(lockKey, lockValue, { nx: true, ex: LOCK_TTL_SECONDS });
      if (res === 'OK') {
        acquired = true;
        break;
      }
      // Wait before retrying
      await new Promise(r => setTimeout(r, retryDelay + Math.floor(Math.random() * 20)));
    }

    if (!acquired) {
      throw new Error(`Unable to acquire lock for room ${cleanCode}. Please try again.`);
    }

    try {
      const room = await this.getRoom(cleanCode);
      if (!room) {
        throw new Error(`Room ${cleanCode} does not exist`);
      }

      const mutatorOutput = await mutator(room);
      let result: T;
      let changed = true;

      if (
        mutatorOutput &&
        typeof mutatorOutput === 'object' &&
        ('result' in mutatorOutput || 'changed' in mutatorOutput)
      ) {
        const wrapped = mutatorOutput as { result?: T; changed?: boolean };
        result = (wrapped.result !== undefined ? wrapped.result : (wrapped as unknown as T));
        changed = wrapped.changed !== undefined ? wrapped.changed : true;
      } else {
        result = mutatorOutput as T;
      }

      if (changed) {
        room.version = (room.version || 0) + 1;
        await this.saveRoom(room);
      }

      return result;
    } finally {
      // Release lock only if we still hold it
      try {
        const currentLock = await redis.get(lockKey);
        if (currentLock === lockValue) {
          await redis.del(lockKey);
        }
      } catch {
        // Ignore lock release errors
      }
    }
  }

  // --- High-Level Operations ---

  public async createRoom(
    dtoOrConfig: CreateRoomDto,
    sessionOrPlayerId: UserSession | string,
    explicitPlayerName?: string
  ): Promise<{ success: boolean; room?: GameRoom; error?: string }> {
    let session: UserSession;
    if (typeof sessionOrPlayerId === 'string') {
      session = {
        token: `sess_${sessionOrPlayerId}`,
        sessionToken: `sess_${sessionOrPlayerId}`,
        playerId: sessionOrPlayerId,
        playerName: explicitPlayerName || `Player_${sessionOrPlayerId.slice(-4)}`,
        lastActive: Date.now(),
      };
    } else {
      session = sessionOrPlayerId;
    }

    const roomCode = await this.generateRoomCode();
    const config: RoomConfig = {
      roomCode,
      hostId: session.playerId,
      deckCount: dtoOrConfig.deckCount || 1,
      maxPlayers: dtoOrConfig.maxPlayers || 6,
      minPlayers: dtoOrConfig.minPlayers || 2,
      isPrivate: true,
    };

    const effectiveName =
      (dtoOrConfig.playerName || session.playerName || explicitPlayerName || '').trim().slice(0, 20) ||
      `Player_${session.playerId.slice(-4)}`;
    session.playerName = effectiveName;

    const room = new GameRoom(config);
    const joinResult = room.addPlayer(session.playerId, effectiveName);
    if (!joinResult.success) {
      return { success: false, error: joinResult.error };
    }

    session.roomCode = roomCode;
    await this.saveSession(session);
    await this.saveRoom(room);

    return { success: true, room };
  }

  public async joinRoom(
    dto: JoinRoomDto,
    sessionOrPlayerId: UserSession | string,
    explicitPlayerName?: string
  ): Promise<{ success: boolean; room?: GameRoom; error?: string }> {
    let session: UserSession;
    if (typeof sessionOrPlayerId === 'string') {
      session = {
        token: `sess_${sessionOrPlayerId}`,
        sessionToken: `sess_${sessionOrPlayerId}`,
        playerId: sessionOrPlayerId,
        playerName: explicitPlayerName || `Player_${sessionOrPlayerId.slice(-4)}`,
        lastActive: Date.now(),
      };
    } else {
      session = sessionOrPlayerId;
    }

    const cleanCode = (dto.roomCode || '').trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, error: 'Please enter a valid room code' };
    }

    return await this.runAtomic<{ success: boolean; room?: GameRoom; error?: string }>(cleanCode, room => {
      const effectiveName =
        (dto.playerName || session.playerName || explicitPlayerName || '').trim().slice(0, 20) ||
        `Player_${session.playerId.slice(-4)}`;
      session.playerName = effectiveName;

      if (room.status !== 'waiting') {
        const existingPlayer = room.players.find(p => p.id === session.playerId);
        if (existingPlayer) {
          if (dto.playerName && dto.playerName.trim()) {
            existingPlayer.name = effectiveName;
          }
          existingPlayer.isConnected = true;
          session.roomCode = cleanCode;
          return { result: { success: true, room }, changed: true };
        }
        return { result: { success: false, error: 'Game has already started in this room' }, changed: false };
      }

      const joinResult = room.addPlayer(session.playerId, effectiveName);
      if (!joinResult.success) {
        return { result: { success: false, error: joinResult.error }, changed: false };
      }

      session.roomCode = cleanCode;
      return { result: { success: true, room }, changed: true };
    }).then(async res => {
      if (res && res.success) {
        await this.saveSession(session);
      }
      return res;
    });
  }

  public async getActiveRooms(): Promise<ActiveRoomSummary[]> {
    const codes = await redis.zrange(this.activeRoomsKey(), 0, -1, { rev: true });
    if (!codes || codes.length === 0) return [];

    const list: ActiveRoomSummary[] = [];
    for (const code of codes) {
      const room = await this.getRoom(code);
      if (room && room.status === 'waiting' && room.players.length < room.config.maxPlayers) {
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
      } else if (!room || room.status !== 'waiting' || room.players.length >= room.config.maxPlayers) {
        // Clean up stale entry
        await redis.zrem(this.activeRoomsKey(), code);
      }
    }

    return list;
  }
}

export const roomStore = new RedisRoomStore();
