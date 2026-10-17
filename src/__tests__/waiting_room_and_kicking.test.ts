import { describe, it, expect, beforeEach } from 'vitest';
import { GameRoom } from '../engine/GameRoom';
import { RedisRoomStore, UserSession } from '../server/RedisRoomStore';
import { redis, resetRedisStats } from '../server/redis';
import { Card, Rank } from '../types/game';

describe('Waiting Room Expiration and Host-Only Player Kicking', () => {
  let store: RedisRoomStore;

  const hostUser: UserSession = {
    token: 'token_host',
    sessionToken: 'token_host',
    playerId: 'p_host',
    playerName: 'HostPlayer',
    lastActive: Date.now(),
  };

  const guest1: UserSession = {
    token: 'token_guest1',
    sessionToken: 'token_guest1',
    playerId: 'p_guest1',
    playerName: 'GuestOne',
    lastActive: Date.now(),
  };

  const guest2: UserSession = {
    token: 'token_guest2',
    sessionToken: 'token_guest2',
    playerId: 'p_guest2',
    playerName: 'GuestTwo',
    lastActive: Date.now(),
  };

  const guest3: UserSession = {
    token: 'token_guest3',
    sessionToken: 'token_guest3',
    playerId: 'p_guest3',
    playerName: 'GuestThree',
    lastActive: Date.now(),
  };

  beforeEach(async () => {
    resetRedisStats();
    store = new RedisRoomStore();
    await store.saveSession({ ...hostUser });
    await store.saveSession({ ...guest1 });
    await store.saveSession({ ...guest2 });
    await store.saveSession({ ...guest3 });
  });

  describe('Feature 1: Waiting Room Expiration (5-minute deadline)', () => {
    it('initializes waiting-room expiration exactly 5 minutes in the future upon creation', async () => {
      const before = Date.now();
      const createRes = await store.createRoom({ maxPlayers: 4, minPlayers: 2 }, hostUser);
      const after = Date.now();

      expect(createRes.success).toBe(true);
      const room = createRes.room!;
      expect(room.status).toBe('waiting');
      expect(room.waitingRoomExpiresAt).toBeDefined();
      expect(typeof room.waitingRoomExpiresAt).toBe('number');

      // Must be roughly 5 minutes (300,000ms) in the future
      const diff = room.waitingRoomExpiresAt! - before;
      expect(diff).toBeGreaterThanOrEqual(299_000);
      expect(diff).toBeLessThanOrEqual(305_000);

      // Verify public state also exposes waitingRoomExpiresAt
      const pubState = room.getPublicState(hostUser.playerId);
      expect(pubState.waitingRoomExpiresAt).toBe(room.waitingRoomExpiresAt);
    });

    it('joining the room does NOT reset the waiting room deadline', async () => {
      const createRes = await store.createRoom({ maxPlayers: 4, minPlayers: 2 }, hostUser);
      const roomCode = createRes.room!.roomCode;
      const originalDeadline = createRes.room!.waitingRoomExpiresAt;

      // Simulate a small delay
      await new Promise(r => setTimeout(r, 10));

      const joinRes = await store.joinRoom({ roomCode }, guest1);
      expect(joinRes.success).toBe(true);

      const roomAfterJoin = await store.getRoom(roomCode);
      expect(roomAfterJoin?.waitingRoomExpiresAt).toBe(originalDeadline);

      // Verify late joiner receives the exact same original deadline
      const guestPubState = roomAfterJoin?.getPublicState(guest1.playerId);
      expect(guestPubState?.waitingRoomExpiresAt).toBe(originalDeadline);
    });

    it('updating settings or waiting-room activity does not reset the deadline', async () => {
      const createRes = await store.createRoom({ maxPlayers: 4, minPlayers: 2 }, hostUser);
      const roomCode = createRes.room!.roomCode;
      const originalDeadline = createRes.room!.waitingRoomExpiresAt;

      // Update room config or touch
      await store.runAtomic(roomCode, r => {
        r.config.maxPlayers = 6;
      });

      const updatedRoom = await store.getRoom(roomCode);
      expect(updatedRoom?.waitingRoomExpiresAt).toBe(originalDeadline);
    });

    it('a room that passes the deadline cannot be joined or started and is removed', async () => {
      const createRes = await store.createRoom({ maxPlayers: 4, minPlayers: 2 }, hostUser);
      const roomCode = createRes.room!.roomCode;

      // Force expiration past the 5-minute deadline
      await store.runAtomic(roomCode, r => {
        r.waitingRoomExpiresAt = Date.now() - 1000;
      });

      // Attempt to join expired room
      const joinRes = await store.joinRoom({ roomCode }, guest1);
      expect(joinRes.success).toBe(false);
      expect(joinRes.error).toMatch(/expired|not found/i);

      // Attempt to start expired room
      try {
        const startRes = await store.runAtomic(roomCode, r => r.startGame(hostUser.playerId));
        expect((startRes.result as any)?.success).toBe(false);
      } catch (err: any) {
        expect(err.message).toMatch(/expired|does not exist/i);
      }

      // Check that it is removed from active rooms discovery
      const activeRooms = await store.getActiveRooms();
      expect(activeRooms.some(r => r.roomCode === roomCode)).toBe(false);
    });

    it('starting the game before the deadline cancels waiting-room expiration permanently', async () => {
      const createRes = await store.createRoom({ maxPlayers: 4, minPlayers: 2 }, hostUser);
      const roomCode = createRes.room!.roomCode;
      await store.joinRoom({ roomCode }, guest1);

      // Start the game
      const startRes = await store.runAtomic(roomCode, r => r.startGame(hostUser.playerId));
      expect((startRes.result as any).success).toBe(true);

      const activeRoom = await store.getRoom(roomCode);
      expect(activeRoom?.status).toBe('in_progress');
      // The waitingRoomExpiresAt must be permanently cleared (null)
      expect(activeRoom?.waitingRoomExpiresAt).toBeNull();
      expect(activeRoom?.isWaitingRoomExpired()).toBe(false);

      // Active games must never expire under waiting-room rule even if time passes
      const pub = activeRoom?.getPublicState(hostUser.playerId);
      expect(pub?.waitingRoomExpiresAt).toBeNull();
    });
  });

  describe('Feature 2: Host-Only Player Kicking', () => {
    it('only the host can kick players, and cannot kick themselves', async () => {
      const createRes = await store.createRoom({ maxPlayers: 4, minPlayers: 2 }, hostUser);
      const roomCode = createRes.room!.roomCode;
      await store.joinRoom({ roomCode }, guest1);

      // 1. Non-host player attempts to kick someone -> rejected
      const nonHostRes = await store.runAtomic(roomCode, r =>
        r.kickPlayer(guest1.playerId, hostUser.playerId)
      );
      expect((nonHostRes.result as any).success).toBe(false);
      expect((nonHostRes.result as any).error).toMatch(/only the host/i);

      // 2. Host attempts to kick themselves -> rejected
      const selfKickRes = await store.runAtomic(roomCode, r =>
        r.kickPlayer(hostUser.playerId, hostUser.playerId)
      );
      expect((selfKickRes.result as any).success).toBe(false);
      expect((selfKickRes.result as any).error).toMatch(/cannot kick themselves/i);

      // 3. Non-existent player target -> rejected
      const invalidTargetRes = await store.runAtomic(roomCode, r =>
        r.kickPlayer(hostUser.playerId, 'non_existent_player')
      );
      expect((invalidTargetRes.result as any).success).toBe(false);
      expect((invalidTargetRes.result as any).error).toMatch(/not found/i);
    });

    it('kicking a player in the waiting room removes them while keeping other players and config intact', async () => {
      const createRes = await store.createRoom({ maxPlayers: 4, minPlayers: 2 }, hostUser);
      const roomCode = createRes.room!.roomCode;
      await store.joinRoom({ roomCode }, guest1);
      await store.joinRoom({ roomCode }, guest2);

      let room = (await store.getRoom(roomCode))!;
      expect(room.players.length).toBe(3);

      // Host kicks guest1
      const kickOutput = await store.runAtomic(roomCode, r =>
        r.kickPlayer(hostUser.playerId, guest1.playerId)
      );
      expect((kickOutput.result as any).success).toBe(true);

      room = (await store.getRoom(roomCode))!;
      expect(room.players.length).toBe(2);
      expect(room.players.some(p => p.id === guest1.playerId)).toBe(false);
      expect(room.players.some(p => p.id === hostUser.playerId)).toBe(true);
      expect(room.players.some(p => p.id === guest2.playerId)).toBe(true);
      expect(room.config.hostId).toBe(hostUser.playerId);

      // Room is still waiting and remaining players can start normally
      expect(room.status).toBe('waiting');
      const startRes = await store.runAtomic(roomCode, r => r.startGame(hostUser.playerId));
      expect((startRes.result as any).success).toBe(true);
    });

    it('kicked player is tracked in kickedPlayerIds and cannot act or sync with stale session', async () => {
      const createRes = await store.createRoom({ maxPlayers: 4, minPlayers: 2 }, hostUser);
      const roomCode = createRes.room!.roomCode;
      await store.joinRoom({ roomCode }, guest1);

      await store.runAtomic(roomCode, r => r.kickPlayer(hostUser.playerId, guest1.playerId));

      const room = (await store.getRoom(roomCode))!;
      expect(room.kickedPlayerIds).toContain(guest1.playerId);

      // Attempting to rejoin with stale session is blocked
      const joinAgain = await store.joinRoom({ roomCode }, guest1);
      expect(joinAgain.success).toBe(false);
      expect(joinAgain.error).toMatch(/removed/i);
    });

    it('in-game kicking discards the target hand without awarding it to anyone and preserves other hands', async () => {
      const createRes = await store.createRoom({ maxPlayers: 4, minPlayers: 2 }, hostUser);
      const roomCode = createRes.room!.roomCode;
      await store.joinRoom({ roomCode }, guest1);
      await store.joinRoom({ roomCode }, guest2);
      await store.runAtomic(roomCode, r => r.startGame(hostUser.playerId));

      let room = (await store.getRoom(roomCode))!;
      const hostCardsBefore = room.players.find(p => p.id === hostUser.playerId)!.cards.length;
      const guest2CardsBefore = room.players.find(p => p.id === guest2.playerId)!.cards.length;
      const guest1CardsBefore = room.players.find(p => p.id === guest1.playerId)!.cards.length;

      expect(guest1CardsBefore).toBeGreaterThan(0);
      expect(room.blockCards.length).toBe(0);

      // Host kicks guest1
      await store.runAtomic(roomCode, r => r.kickPlayer(hostUser.playerId, guest1.playerId));

      room = (await store.getRoom(roomCode))!;
      // Target is removed
      expect(room.players.find(p => p.id === guest1.playerId)).toBeUndefined();

      // Remaining players' cards are completely untouched
      const hostCardsAfter = room.players.find(p => p.id === hostUser.playerId)!.cards.length;
      const guest2CardsAfter = room.players.find(p => p.id === guest2.playerId)!.cards.length;
      expect(hostCardsAfter).toBe(hostCardsBefore);
      expect(guest2CardsAfter).toBe(guest2CardsBefore);

      // Kicked player's cards were NOT added to the block
      expect(room.blockCards.length).toBe(0);
    });

    it('in-game kicking preserves relative circular turn order and advances correctly if current turn was kicked', async () => {
      const createRes = await store.createRoom({ maxPlayers: 4, minPlayers: 2 }, hostUser);
      const roomCode = createRes.room!.roomCode;
      await store.joinRoom({ roomCode }, guest1);
      await store.joinRoom({ roomCode }, guest2);
      await store.joinRoom({ roomCode }, guest3);
      await store.runAtomic(roomCode, r => r.startGame(hostUser.playerId));

      let room = (await store.getRoom(roomCode))!;
      // Set fixed order: [host, guest1, guest2, guest3]
      room.playerOrder = [hostUser.playerId, guest1.playerId, guest2.playerId, guest3.playerId];

      // Set turn to guest1
      room.currentTurnIndex = 1;
      expect(room.getCurrentPlayer()?.id).toBe(guest1.playerId);
      await store.saveRoom(room);

      // Host kicks current player (guest1)
      await store.runAtomic(roomCode, r => r.kickPlayer(hostUser.playerId, guest1.playerId));

      room = (await store.getRoom(roomCode))!;
      // Relative order of remaining players must be preserved: [host, guest2, guest3]
      expect(room.playerOrder).toEqual([hostUser.playerId, guest2.playerId, guest3.playerId]);

      // Turn must advance to guest2
      expect(room.getCurrentPlayer()?.id).toBe(guest2.playerId);
    });

    it('in-game kicking cleans up the block if kicked player made the last play and prevents selection/reveal', async () => {
      const createRes = await store.createRoom({ maxPlayers: 4, minPlayers: 2 }, hostUser);
      const roomCode = createRes.room!.roomCode;
      await store.joinRoom({ roomCode }, guest1);
      await store.joinRoom({ roomCode }, guest2);
      await store.runAtomic(roomCode, r => r.startGame(hostUser.playerId));

      let playedCardId: string;
      await store.runAtomic(roomCode, r => {
        r.playerOrder = [guest1.playerId, guest2.playerId, hostUser.playerId];
        r.currentTurnIndex = 0;
        const g1 = r.players.find(p => p.id === guest1.playerId)!;
        playedCardId = g1.cards[0].id;
        const playRes = r.playCards(guest1.playerId, [playedCardId], 'A');
        expect(playRes.success).toBe(true);
      });

      let room = (await store.getRoom(roomCode))!;
      expect(room.lastPlay?.playerId).toBe(guest1.playerId);
      expect(room.blockCards.length).toBe(1);

      // Host kicks guest1 while their cards are in the block
      await store.runAtomic(roomCode, r => r.kickPlayer(hostUser.playerId, guest1.playerId));

      room = (await store.getRoom(roomCode))!;
      // Kicked player's cards removed from block and cannot be challenged/selected
      expect(room.blockCards.some(c => c.id === playedCardId)).toBe(false);
      expect(room.lastPlay).toBeNull();
      expect(room.lastPlayerToPlayId).toBeNull();
    });

    it('kicked player is excluded from the final leaderboard, finishing titles, and last standing detection', async () => {
      const createRes = await store.createRoom({ maxPlayers: 4, minPlayers: 2 }, hostUser);
      const roomCode = createRes.room!.roomCode;
      await store.joinRoom({ roomCode }, guest1);
      await store.joinRoom({ roomCode }, guest2);
      await store.runAtomic(roomCode, r => r.startGame(hostUser.playerId));

      // Guest1 finishes their hand first (1st place)
      await store.runAtomic(roomCode, r => {
        const g1 = r.players.find(p => p.id === guest1.playerId)!;
        g1.cards = [{ id: 'card-1', suit: 'hearts', rank: 'K', deckIndex: 0 }];
        r.currentTurnIndex = r.playerOrder.indexOf(guest1.playerId);
        r.playCards(guest1.playerId, ['card-1'], 'K');
        // Round resolves with truth
        r.blockCards = [];
        r.checkAndApplyWinner();
      });

      // Now host kicks guest2 (leaving only host and finished guest1)
      await store.runAtomic(roomCode, r => r.kickPlayer(hostUser.playerId, guest2.playerId));

      const room = (await store.getRoom(roomCode))!;
      // Guest2 must NOT be in finishingPositions
      expect(room.finishingPositions.some(fp => fp.playerId === guest2.playerId)).toBe(false);
      expect(room.players.some(p => p.id === guest2.playerId)).toBe(false);

      // Remaining players get valid titles based strictly on remaining player count
      room.finishingPositions.forEach(fp => {
        expect(fp.playerId).not.toBe(guest2.playerId);
        expect(fp.title).toBeDefined();
      });
    });

    it('kicking the penultimate player triggers game over with the survivor winning', async () => {
      const createRes = await store.createRoom({ maxPlayers: 2, minPlayers: 2 }, hostUser);
      const roomCode = createRes.room!.roomCode;
      await store.joinRoom({ roomCode }, guest1);
      await store.runAtomic(roomCode, r => r.startGame(hostUser.playerId));

      let room = (await store.getRoom(roomCode))!;
      expect(room.status).toBe('in_progress');

      // 2 players active. Host kicks guest1
      await store.runAtomic(roomCode, r => r.kickPlayer(hostUser.playerId, guest1.playerId));

      room = (await store.getRoom(roomCode))!;
      // Game finishes immediately with host as winner
      expect(room.status).toBe('game_over');
      expect(room.winnerId).toBe(hostUser.playerId);
      expect(room.finishingPositions.some(fp => fp.playerId === guest1.playerId)).toBe(false);
    });
  });
});
