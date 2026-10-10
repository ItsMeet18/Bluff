import { describe, it, expect, beforeEach } from 'vitest';
import { RedisRoomStore } from '../server/RedisRoomStore';
import { GameRoom } from '../engine/GameRoom';
import { Rank } from '../types/game';

describe('Vercel + Upstash Redis Architecture Tests', () => {
  let store: RedisRoomStore;

  beforeEach(() => {
    store = new RedisRoomStore();
  });

  describe('Session Management', () => {
    it('creates and saves sessions correctly', async () => {
      const session = await store.getOrCreateSession(undefined, 'Player One');
      expect(session.sessionToken).toBeDefined();
      expect(session.playerId).toBeDefined();
      expect(session.playerName).toBe('Player One');

      // Fetching again with token should return existing session
      const existing = await store.getOrCreateSession(session.sessionToken, 'Player One Updated');
      expect(existing.playerId).toBe(session.playerId);
      expect(existing.playerName).toBe('Player One Updated');
    });
  });

  describe('Room Creation & Redis Persistence', () => {
    it('creates a room, persists it to store, and retrieves public state', async () => {
      const hostSession = await store.getOrCreateSession(undefined, 'HostAlice');
      const createRes = await store.createRoom(
        { deckCount: 1, maxPlayers: 4, minPlayers: 2 },
        hostSession
      );
      expect(createRes.success).toBe(true);
      const room = createRes.room!;

      expect(room.roomCode).toHaveLength(6);
      expect(room.config.hostId).toBe(hostSession.playerId);
      expect(room.players).toHaveLength(1);

      // Verify room can be reloaded from store
      const loadedRoom = await store.getRoom(room.roomCode);
      expect(loadedRoom).not.toBeNull();
      expect(loadedRoom?.config.hostId).toBe(hostSession.playerId);
      expect(loadedRoom?.players[0].name).toBe('HostAlice');

      // Check public state
      const publicState = loadedRoom?.getPublicState(hostSession.playerId);
      expect(publicState?.roomCode).toBe(room.roomCode);
      expect(publicState?.config.hostId).toBe(hostSession.playerId);
      expect(publicState?.players[0].name).toBe('HostAlice');
      expect(publicState?.players[0].isHost).toBe(true);
    });

    it('tracks active rooms in index and cleans up on deletion', async () => {
      const host = await store.getOrCreateSession(undefined, 'HostBob');
      const createRes = await store.createRoom({ deckCount: 1, maxPlayers: 6, minPlayers: 2 }, host);
      expect(createRes.success).toBe(true);
      const room = createRes.room!;

      const activeList = await store.getActiveRooms();
      expect(activeList.some(r => r.roomCode === room.roomCode)).toBe(true);

      await store.deleteRoom(room.roomCode);
      const updatedList = await store.getActiveRooms();
      expect(updatedList.some(r => r.roomCode === room.roomCode)).toBe(false);
    });
  });

  describe('Atomic Operations and Concurrency Locking', () => {
    it('prevents race conditions with runAtomic locking', async () => {
      const host = await store.getOrCreateSession(undefined, 'HostCharlie');
      const createRes = await store.createRoom({ deckCount: 1, maxPlayers: 10, minPlayers: 2 }, host);
      expect(createRes.success).toBe(true);
      const room = createRes.room!;

      // Concurrently run 5 atomic operations modifying room players
      const results = await Promise.all(
        [1, 2, 3, 4, 5].map(async (i) => {
          return store.runAtomic(room.roomCode, async (lockedRoom) => {
            if (!lockedRoom) throw new Error('Room missing');
            lockedRoom.addPlayer(`p-${i}`, `Player-${i}`);
            return i;
          });
        })
      );

      expect(results).toHaveLength(5);
      const finalRoom = await store.getRoom(room.roomCode);
      expect(finalRoom?.players.length).toBe(6); // 1 host + 5 players
    });
  });

  describe('Full Gameplay Lifecycle on Redis Store', () => {
    it('executes start game, card plays, bluff calls, passes, and rematches', async () => {
      // 1. Setup Host and Joiner
      const host = await store.getOrCreateSession(undefined, 'Alice');
      const player2 = await store.getOrCreateSession(undefined, 'Bob');

      const createRes = await store.createRoom({ deckCount: 1, maxPlayers: 4, minPlayers: 2 }, host);
      expect(createRes.success).toBe(true);
      const room = createRes.room!;
      
      // 2. Bob Joins
      const joinRes = await store.joinRoom({ roomCode: room.roomCode }, player2);
      expect(joinRes.success).toBe(true);

      // 3. Alice Starts Game
      await store.runAtomic(room.roomCode, async (r) => {
        const startRes = r.startGame(host.playerId);
        expect(startRes.success).toBe(true);
      });

      let loaded = await store.getRoom(room.roomCode);
      expect(loaded?.status).toBe('in_progress');
      expect(loaded?.players[0].cards.length).toBeGreaterThan(0);
      expect(loaded?.players[1].cards.length).toBeGreaterThan(0);

      // 4. Current player plays cards
      const currentTurnPlayer = loaded!.getCurrentPlayer()!;
      expect(currentTurnPlayer).not.toBeNull();
      const cardToPlay = currentTurnPlayer.cards[0];

      await store.runAtomic(room.roomCode, async (r) => {
        const playRes = r.playCards(currentTurnPlayer.id, [cardToPlay.id], 'A');
        expect(playRes.success).toBe(true);
      });

      loaded = await store.getRoom(room.roomCode);
      expect(loaded?.blockCards.length).toBe(1);
      expect(loaded?.activeRank).toBe('A');

      // 5. Next player calls bluff
      const challenger = loaded!.getCurrentPlayer()!;
      let bluffResult: any = null;
      await store.runAtomic(room.roomCode, async (r) => {
        const challengeRes = r.callBluff(challenger.id, cardToPlay.id);
        expect(challengeRes.success).toBe(true);
        bluffResult = challengeRes.result;
      });

      expect(bluffResult).not.toBeNull();
      expect(bluffResult.card.id).toBe(cardToPlay.id);

      // 6. Test Rematch
      await store.runAtomic(room.roomCode, async (r) => {
        r.status = 'game_over';
        const rematchRes = r.resetForRematch(host.playerId);
        expect(rematchRes.success).toBe(true);
      });

      loaded = await store.getRoom(room.roomCode);
      expect(loaded?.status).toBe('waiting');
      expect(loaded?.players.every(p => p.isConnected)).toBe(true);
    });
  });
});
