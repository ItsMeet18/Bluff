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

const UNLOCK_SCRIPT =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

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
  sessionToken?: string;
}

export interface AtomicExecutionResult<T> {
  result: T;
  room?: GameRoom;
}

export class RedisRoomStore {
  // In-process short-lived caches to eliminate redundant reads on warm serverless instances
  private sessionCache = new Map<string, { session: UserSession; cachedAt: number }>();
  private activeRoomsCache: { rooms: ActiveRoomSummary[]; cachedAt: number } | null = null;
  private readonly SESSION_CACHE_TTL_MS = 45_000; // 45 seconds
  private readonly ACTIVE_ROOMS_CACHE_TTL_MS = 3_000; // 3 seconds

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
    const cleanRequestedName = requestedName?.trim().slice(0, 20);

    if (token) {
      const existing = await this.getSession(token);
      if (existing) {
        if (cleanRequestedName && existing.playerName !== cleanRequestedName) {
          existing.playerName = cleanRequestedName;
          await this.saveSession(existing);
        }
        return existing;
      }
    }

    const generatedToken = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
    const playerId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const playerName = cleanRequestedName || `Player_${playerId.slice(-4)}`;

    const session: UserSession = {
      token: generatedToken,
      sessionToken: generatedToken,
      playerId,
      playerName,
      lastActive: Date.now(),
    };

    await this.saveSession(session);
    return session;
  }

  public async getSession(token: string): Promise<UserSession | null> {
    if (!token) return null;

    // Check in-process cache first
    const cached = this.sessionCache.get(token);
    if (cached && Date.now() - cached.cachedAt < this.SESSION_CACHE_TTL_MS) {
      return cached.session;
    }

    const session = await redis.get<UserSession>(this.sessionKey(token));
    if (session) {
      if (!session.sessionToken && session.token) {
        session.sessionToken = session.token;
      }
      this.sessionCache.set(token, { session, cachedAt: Date.now() });
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

    this.sessionCache.set(session.token, { session, cachedAt: Date.now() });
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

  public async getRoom(roomCode: string, allowExpired: boolean = false): Promise<GameRoom | null> {
    const cleanCode = roomCode.trim().toUpperCase();
    const data = await redis.get(this.roomKey(cleanCode));
    if (!data) return null;
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      const room = GameRoom.fromJSON(parsed);
      if (!allowExpired && room.isWaitingRoomExpired()) {
        await this.deleteRoom(cleanCode);
        return null;
      }
      return room;
    } catch {
      return null;
    }
  }

  public async saveRoom(room: GameRoom, previousStatus?: string): Promise<void> {
    room.updatedAt = Date.now();
    const cleanCode = room.roomCode.toUpperCase();
    await redis.set(this.roomKey(cleanCode), room.toJSON(), { ex: ROOM_TTL_SECONDS });

    // Invalidate active rooms in-process cache
    this.activeRoomsCache = null;

    // Only update activeRooms sorted set if the room is waiting or its waiting status changed
    const isCurrentlyWaiting = room.status === 'waiting' && room.players.length < room.config.maxPlayers;
    const wasWaiting = !previousStatus || previousStatus === 'waiting';

    if (isCurrentlyWaiting) {
      await redis.zadd(this.activeRoomsKey(), { score: room.createdAt, member: cleanCode });
    } else if (wasWaiting) {
      // Room was waiting and is now no longer waiting (started or full) -> remove once
      await redis.zrem(this.activeRoomsKey(), cleanCode);
    }
    // If the room was already in_progress and remains in_progress, skip calling zrem!
  }

  public async deleteRoom(roomCode: string): Promise<void> {
    const cleanCode = roomCode.trim().toUpperCase();
    this.activeRoomsCache = null;
    await redis.del(this.roomKey(cleanCode));
    await redis.zrem(this.activeRoomsKey(), cleanCode);
  }

  // --- Atomic Execution with Distributed Lock ---

  public async runAtomic<T>(
    roomCode: string,
    mutator: (room: GameRoom) => Promise<{ result?: T; changed?: boolean } | T | void> | { result?: T; changed?: boolean } | T | void,
    options: { maxRetries?: number; retryDelayMs?: number } = {}
  ): Promise<AtomicExecutionResult<T>> {
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

    let loadedRoom: GameRoom | null = null;
    try {
      loadedRoom = await this.getRoom(cleanCode, true);
      if (!loadedRoom) {
        throw new Error(`Room ${cleanCode} does not exist`);
      }

      if (loadedRoom.isWaitingRoomExpired()) {
        await this.deleteRoom(cleanCode);
        throw new Error('Room has expired');
      }

      const previousStatus = loadedRoom.status;
      const mutatorOutput = await mutator(loadedRoom);
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
        loadedRoom.version = (loadedRoom.version || 0) + 1;
        await this.saveRoom(loadedRoom, previousStatus);
      }

      return { result, room: loadedRoom };
    } finally {
      // Release lock atomically in a single Redis command using Lua script
      try {
        await redis.eval(UNLOCK_SCRIPT, [lockKey], [lockValue]);
      } catch {
        // Fallback to delete if eval fails
        try {
          await redis.del(lockKey);
        } catch {
          // Ignore unlock errors
        }
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

    // Atomic join without redundant pre-lock getRoom read
    try {
      const atomicOutput = await this.runAtomic<{ success: boolean; room?: GameRoom; error?: string }>(
        cleanCode,
        room => {
          const effectiveName =
            (dto.playerName || session.playerName || explicitPlayerName || '').trim().slice(0, 20) ||
            `Player_${session.playerId.slice(-4)}`;
          session.playerName = effectiveName;

          if (room.isWaitingRoomExpired()) {
            return { result: { success: false, error: 'Room has expired' }, changed: false };
          }

          if (room.kickedPlayerIds?.includes(session.playerId)) {
            return {
              result: { success: false, error: 'You have been removed from this room by the host' },
              changed: false,
            };
          }

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
        }
      );

      const res = atomicOutput.result;
      if (res && res.success) {
        session.roomCode = cleanCode;
        await this.saveSession(session);
      }
      return res;
    } catch (err: any) {
      if (err.message && err.message.includes('expired')) {
        return { success: false, error: 'Room has expired' };
      }
      if (err.message && err.message.includes('does not exist')) {
        return { success: false, error: `Room ${cleanCode} not found` };
      }
      return { success: false, error: err.message || 'Failed to join room' };
    }
  }

  public async getActiveRooms(): Promise<ActiveRoomSummary[]> {
    // Return in-process cached active rooms if within 3-second window
    if (this.activeRoomsCache && Date.now() - this.activeRoomsCache.cachedAt < this.ACTIVE_ROOMS_CACHE_TTL_MS) {
      return this.activeRoomsCache.rooms;
    }

    const codes = await redis.zrange(this.activeRoomsKey(), 0, -1, { rev: true });
    if (!codes || codes.length === 0) {
      this.activeRoomsCache = { rooms: [], cachedAt: Date.now() };
      return [];
    }

    // Batch fetch all room keys in a SINGLE mget command instead of N get commands
    const roomKeys = codes.map(code => this.roomKey(code));
    const rawRooms = await redis.mget(...roomKeys);

    const list: ActiveRoomSummary[] = [];
    const staleCodes: string[] = [];

    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      const raw = rawRooms[i];
      let room: GameRoom | null = null;
      if (raw) {
        try {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          room = GameRoom.fromJSON(parsed);
        } catch {
          room = null;
        }
      }

      if (room && room.status === 'waiting' && !room.isWaitingRoomExpired() && room.players.length < room.config.maxPlayers) {
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
      } else {
        staleCodes.push(code);
        if (room && room.isWaitingRoomExpired()) {
          // Immediately delete expired room from Redis
          await redis.del(this.roomKey(code));
        }
      }
    }

    // Clean up stale entries if any were found
    if (staleCodes.length > 0) {
      await redis.zrem(this.activeRoomsKey(), ...staleCodes);
    }

    this.activeRoomsCache = { rooms: list, cachedAt: Date.now() };
    return list;
  }
}

export const roomStore = new RedisRoomStore();
