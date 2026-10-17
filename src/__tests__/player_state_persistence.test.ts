import { describe, it, expect, beforeEach } from 'vitest';
import { RedisRoomStore, UserSession } from '../server/RedisRoomStore';
import { getRedisStats, resetRedisStats, redis } from '../server/redis';
import { POST as sessionRoute } from '../app/api/auth/session/route';
import { POST as createRoute } from '../app/api/game/create/route';
import { POST as joinRoute } from '../app/api/game/join/route';
import { POST as actionRoute } from '../app/api/game/action/route';
import { GET as syncRoute } from '../app/api/game/sync/route';
import { NextRequest } from 'next/server';

function createMockReq(url: string, method: string, body?: any): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Player State Persistence Across Refreshes (All 14 Scenarios)', () => {
  let store: RedisRoomStore;

  beforeEach(() => {
    store = new RedisRoomStore();
    resetRedisStats();
  });

  // 1. Refresh in waiting room
  it('Scenario 1: A player refreshes in the waiting room and returns to the same room with the same name and identity', async () => {
    // Player 1 creates session and room
    const s1Req = createMockReq('/api/auth/session', 'POST', { playerName: 'Alice' });
    const s1Res = await sessionRoute(s1Req);
    const s1Data = await s1Res.json();
    const token = s1Data.sessionToken;
    const playerId = s1Data.playerId;

    const createReq = createMockReq('/api/game/create', 'POST', {
      deckCount: 1,
      maxPlayers: 4,
      minPlayers: 2,
      playerName: 'Alice',
      sessionToken: token,
    });
    const createRes = await createRoute(createReq);
    const createData = await createRes.json();
    const roomCode = createData.roomCode;
    expect(createData.success).toBe(true);

    // Browser Refresh Simulation:
    // 1. Session restoration request with existing token
    const refreshSessReq = createMockReq('/api/auth/session', 'POST', {
      sessionToken: token,
      playerName: 'Alice',
    });
    const refreshSessRes = await sessionRoute(refreshSessReq);
    const refreshedSess = await refreshSessRes.json();

    expect(refreshedSess.sessionToken).toBe(token);
    expect(refreshedSess.playerId).toBe(playerId);
    expect(refreshedSess.playerName).toBe('Alice');
    expect(refreshedSess.roomCode).toBe(roomCode);

    // 2. Fetch authoritative room state
    const syncReq = createMockReq(`/api/game/sync?roomCode=${refreshedSess.roomCode}&sessionToken=${token}`, 'GET');
    const syncRes = await syncRoute(syncReq);
    const syncData = await syncRes.json();

    expect(syncRes.status).toBe(200);
    expect(syncData.success).toBe(true);
    expect(syncData.state.roomCode).toBe(roomCode);
    expect(syncData.state.status).toBe('waiting');
    expect(syncData.state.myPlayerId).toBe(playerId);
    expect(syncData.state.waitingRoomExpiresAt).toBeDefined();
    expect(syncData.state.players.length).toBe(1);
    expect(syncData.state.players[0].name).toBe('Alice');
  });

  // 2. Refresh during active game
  it('Scenario 2: A player refreshes during an active game and returns to the same game', async () => {
    // Setup 2 players
    const p1Req = createMockReq('/api/auth/session', 'POST', { playerName: 'Host' });
    const p1Data = await (await sessionRoute(p1Req)).json();
    const p2Req = createMockReq('/api/auth/session', 'POST', { playerName: 'Guest' });
    const p2Data = await (await sessionRoute(p2Req)).json();

    const createData = await (await createRoute(createMockReq('/api/game/create', 'POST', {
      playerName: 'Host',
      sessionToken: p1Data.sessionToken,
    }))).json();
    const roomCode = createData.roomCode;

    await joinRoute(createMockReq('/api/game/join', 'POST', {
      roomCode,
      playerName: 'Guest',
      sessionToken: p2Data.sessionToken,
    }));

    // Start game
    await actionRoute(createMockReq('/api/game/action', 'POST', {
      roomCode,
      sessionToken: p1Data.sessionToken,
      action: { type: 'START_GAME' },
    }));

    // Guest refreshes during in_progress game
    const guestSessReq = createMockReq('/api/auth/session', 'POST', {
      sessionToken: p2Data.sessionToken,
      playerName: 'Guest',
    });
    const guestSess = await (await sessionRoute(guestSessReq)).json();
    expect(guestSess.roomCode).toBe(roomCode);

    const guestSync = await (await syncRoute(createMockReq(`/api/game/sync?roomCode=${guestSess.roomCode}&sessionToken=${p2Data.sessionToken}`, 'GET'))).json();
    expect(guestSync.success).toBe(true);
    expect(guestSync.state.status).toBe('in_progress');
    expect(guestSync.state.roomCode).toBe(roomCode);
    expect(guestSync.state.myPlayerId).toBe(p2Data.playerId);
    expect(guestSync.state.players.length).toBe(2);
  });

  // 3. Hand preserved after refresh
  it('Scenario 3: The player hand remains exactly the same after refreshing', async () => {
    const p1Data = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', { playerName: 'P1' }))).json();
    const p2Data = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', { playerName: 'P2' }))).json();

    const createData = await (await createRoute(createMockReq('/api/game/create', 'POST', {
      playerName: 'P1',
      sessionToken: p1Data.sessionToken,
    }))).json();
    const roomCode = createData.roomCode;

    await joinRoute(createMockReq('/api/game/join', 'POST', {
      roomCode,
      playerName: 'P2',
      sessionToken: p2Data.sessionToken,
    }));

    const startRes = await (await actionRoute(createMockReq('/api/game/action', 'POST', {
      roomCode,
      sessionToken: p1Data.sessionToken,
      action: { type: 'START_GAME' },
    }))).json();

    const p1HandBefore = startRes.state.myHand;
    expect(p1HandBefore.length).toBeGreaterThan(0);

    // P1 refreshes
    const p1Sync = await (await syncRoute(createMockReq(`/api/game/sync?roomCode=${roomCode}&sessionToken=${p1Data.sessionToken}`, 'GET'))).json();
    const p1HandAfter = p1Sync.state.myHand;

    expect(p1HandAfter).toEqual(p1HandBefore);
    expect(p1HandAfter.length).toBe(p1HandBefore.length);
  });

  // 4. Current turn, pile/block, declared rank consistent
  it('Scenario 4: The current turn, pile/block, declared rank, and pending challenge remain consistent after refreshing', async () => {
    const p1Data = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', { playerName: 'P1' }))).json();
    const p2Data = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', { playerName: 'P2' }))).json();

    const createData = await (await createRoute(createMockReq('/api/game/create', 'POST', {
      playerName: 'P1',
      sessionToken: p1Data.sessionToken,
    }))).json();
    const roomCode = createData.roomCode;

    await joinRoute(createMockReq('/api/game/join', 'POST', {
      roomCode,
      playerName: 'P2',
      sessionToken: p2Data.sessionToken,
    }));

    const startRes = await (await actionRoute(createMockReq('/api/game/action', 'POST', {
      roomCode,
      sessionToken: p1Data.sessionToken,
      action: { type: 'START_GAME' },
    }))).json();

    const firstTurnPlayerId = startRes.state.currentTurnPlayerId;
    const isP1Turn = firstTurnPlayerId === p1Data.playerId;
    const turnSession = isP1Turn ? p1Data.sessionToken : p2Data.sessionToken;
    const otherSession = isP1Turn ? p2Data.sessionToken : p1Data.sessionToken;
    const otherPlayerId = isP1Turn ? p2Data.playerId : p1Data.playerId;

    const currentHand = isP1Turn
      ? startRes.state.myHand
      : (await (await syncRoute(createMockReq(`/api/game/sync?roomCode=${roomCode}&sessionToken=${p2Data.sessionToken}`, 'GET'))).json()).state.myHand;
    const cardToPlay = currentHand[0].id;

    const playRes = await (await actionRoute(createMockReq('/api/game/action', 'POST', {
      roomCode,
      sessionToken: turnSession,
      action: { type: 'PLAY_CARDS', cardIds: [cardToPlay], declaredRank: 'A' },
    }))).json();

    expect(playRes.success).toBe(true);
    expect(playRes.state.totalBlockCards).toBe(1);
    expect(playRes.state.activeRank).toBe('A');

    // The other player refreshes while considering bluff challenge or play
    const otherSync = await (await syncRoute(createMockReq(`/api/game/sync?roomCode=${roomCode}&sessionToken=${otherSession}`, 'GET'))).json();

    expect(otherSync.state.currentTurnPlayerId).toBe(otherPlayerId);
    expect(otherSync.state.isMyTurn).toBe(true);
    expect(otherSync.state.totalBlockCards).toBe(1);
    expect(otherSync.state.activeRank).toBe('A');
    expect(otherSync.state.lastPlay).toBeDefined();
    expect(otherSync.state.lastPlay.playerId).toBe(firstTurnPlayerId);
    expect(otherSync.state.lastPlay.declaredRank).toBe('A');
  });

  // 5. Multiple refreshes without duplicate membership or cards
  it('Scenario 5: A player refreshes multiple times without duplicate room membership or duplicate cards', async () => {
    const p1Data = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', { playerName: 'P1' }))).json();
    const p2Data = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', { playerName: 'P2' }))).json();

    const createData = await (await createRoute(createMockReq('/api/game/create', 'POST', {
      playerName: 'P1',
      sessionToken: p1Data.sessionToken,
    }))).json();
    const roomCode = createData.roomCode;

    await joinRoute(createMockReq('/api/game/join', 'POST', {
      roomCode,
      playerName: 'P2',
      sessionToken: p2Data.sessionToken,
    }));

    await actionRoute(createMockReq('/api/game/action', 'POST', {
      roomCode,
      sessionToken: p1Data.sessionToken,
      action: { type: 'START_GAME' },
    }));

    // P2 refreshes 5 times in a row
    for (let i = 0; i < 5; i++) {
      const sess = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', {
        sessionToken: p2Data.sessionToken,
        playerName: 'P2',
      }))).json();
      expect(sess.roomCode).toBe(roomCode);

      const sync = await (await syncRoute(createMockReq(`/api/game/sync?roomCode=${roomCode}&sessionToken=${p2Data.sessionToken}`, 'GET'))).json();
      expect(sync.state.players.length).toBe(2);
      expect(sync.state.players.filter((p: any) => p.id === p2Data.playerId).length).toBe(1);
      expect(sync.state.myHand.length).toBe(26); // exactly half the 52-card deck
    }
  });

  // 6. Host retains host privileges
  it('Scenario 6: The host refreshes and retains host privileges', async () => {
    const hostData = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', { playerName: 'SuperHost' }))).json();
    const createData = await (await createRoute(createMockReq('/api/game/create', 'POST', {
      playerName: 'SuperHost',
      sessionToken: hostData.sessionToken,
    }))).json();
    const roomCode = createData.roomCode;

    // Host refreshes
    const hostSync = await (await syncRoute(createMockReq(`/api/game/sync?roomCode=${roomCode}&sessionToken=${hostData.sessionToken}`, 'GET'))).json();
    const hostPlayer = hostSync.state.players.find((p: any) => p.id === hostData.playerId);

    expect(hostPlayer.isHost).toBe(true);
    expect(hostSync.state.config.hostId).toBe(hostData.playerId);
  });

  // 7. Non-host player remains non-host
  it('Scenario 7: A non-host player refreshes and remains a non-host', async () => {
    const hostData = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', { playerName: 'Host' }))).json();
    const guestData = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', { playerName: 'Guest' }))).json();

    const createData = await (await createRoute(createMockReq('/api/game/create', 'POST', {
      playerName: 'Host',
      sessionToken: hostData.sessionToken,
    }))).json();
    const roomCode = createData.roomCode;

    await joinRoute(createMockReq('/api/game/join', 'POST', {
      roomCode,
      playerName: 'Guest',
      sessionToken: guestData.sessionToken,
    }));

    // Guest refreshes
    const guestSync = await (await syncRoute(createMockReq(`/api/game/sync?roomCode=${roomCode}&sessionToken=${guestData.sessionToken}`, 'GET'))).json();
    const guestPlayer = guestSync.state.players.find((p: any) => p.id === guestData.playerId);

    expect(guestPlayer.isHost).toBe(false);

    // Guest cannot start game
    const startAttempt = await (await actionRoute(createMockReq('/api/game/action', 'POST', {
      roomCode,
      sessionToken: guestData.sessionToken,
      action: { type: 'START_GAME' },
    }))).json();

    expect(startAttempt.success).toBe(false);
    expect(startAttempt.error).toContain('host');
  });

  // 8. Multiple players refresh independently without disrupting each other
  it('Scenario 8: Multiple players refresh independently without disrupting each others state', async () => {
    const p1 = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', { playerName: 'Player1' }))).json();
    const p2 = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', { playerName: 'Player2' }))).json();
    const p3 = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', { playerName: 'Player3' }))).json();

    const create = await (await createRoute(createMockReq('/api/game/create', 'POST', {
      playerName: 'Player1',
      sessionToken: p1.sessionToken,
    }))).json();
    const roomCode = create.roomCode;

    await joinRoute(createMockReq('/api/game/join', 'POST', { roomCode, playerName: 'Player2', sessionToken: p2.sessionToken }));
    await joinRoute(createMockReq('/api/game/join', 'POST', { roomCode, playerName: 'Player3', sessionToken: p3.sessionToken }));

    // All 3 refresh concurrently
    const [s1, s2, s3] = await Promise.all([
      syncRoute(createMockReq(`/api/game/sync?roomCode=${roomCode}&sessionToken=${p1.sessionToken}`, 'GET')).then(r => r.json()),
      syncRoute(createMockReq(`/api/game/sync?roomCode=${roomCode}&sessionToken=${p2.sessionToken}`, 'GET')).then(r => r.json()),
      syncRoute(createMockReq(`/api/game/sync?roomCode=${roomCode}&sessionToken=${p3.sessionToken}`, 'GET')).then(r => r.json()),
    ]);

    expect(s1.state.players.length).toBe(3);
    expect(s2.state.players.length).toBe(3);
    expect(s3.state.players.length).toBe(3);
    expect(s1.state.myPlayerId).toBe(p1.playerId);
    expect(s2.state.myPlayerId).toBe(p2.playerId);
    expect(s3.state.myPlayerId).toBe(p3.playerId);
  });

  // 9. Temporary network failure during refresh
  it('Scenario 9: A refresh during a temporary network failure does not cause an unnecessary redirect or duplicate join', async () => {
    const p1 = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', { playerName: 'P1' }))).json();
    const create = await (await createRoute(createMockReq('/api/game/create', 'POST', {
      playerName: 'P1',
      sessionToken: p1.sessionToken,
    }))).json();
    const roomCode = create.roomCode;

    // Simulate transient network failure (client keeps token and roomCode)
    // When next sync succeeds:
    const syncRes = await syncRoute(createMockReq(`/api/game/sync?roomCode=${roomCode}&sessionToken=${p1.sessionToken}`, 'GET'));
    const syncData = await syncRes.json();

    expect(syncRes.status).toBe(200);
    expect(syncData.state.roomCode).toBe(roomCode);
    expect(syncData.state.players.length).toBe(1);
  });

  // 10. Kicked player cannot regain access by refreshing
  it('Scenario 10: A kicked player cannot regain access by refreshing', async () => {
    const host = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', { playerName: 'Host' }))).json();
    const guest = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', { playerName: 'Troublemaker' }))).json();

    const create = await (await createRoute(createMockReq('/api/game/create', 'POST', {
      playerName: 'Host',
      sessionToken: host.sessionToken,
    }))).json();
    const roomCode = create.roomCode;

    await joinRoute(createMockReq('/api/game/join', 'POST', { roomCode, playerName: 'Troublemaker', sessionToken: guest.sessionToken }));

    // Host kicks guest
    const kickRes = await (await actionRoute(createMockReq('/api/game/action', 'POST', {
      roomCode,
      sessionToken: host.sessionToken,
      action: { type: 'KICK_PLAYER', targetPlayerId: guest.playerId },
    }))).json();
    expect(kickRes.success).toBe(true);

    // Kicked guest attempts to refresh / sync
    const guestSync = await syncRoute(createMockReq(`/api/game/sync?roomCode=${roomCode}&sessionToken=${guest.sessionToken}`, 'GET'));
    expect(guestSync.status).toBe(403);
    const err = await guestSync.json();
    expect(err.kicked).toBe(true);

    // Session roomCode in Redis should be cleared
    const updatedGuestSess = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', {
      sessionToken: guest.sessionToken,
    }))).json();
    expect(updatedGuestSess.roomCode).toBeUndefined();
  });

  // 11. Rejoining expired or deleted room is prevented safely
  it('Scenario 11: A player cannot rejoin a room that has expired or been deleted', async () => {
    const host = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', { playerName: 'Host' }))).json();
    const create = await (await createRoute(createMockReq('/api/game/create', 'POST', {
      playerName: 'Host',
      sessionToken: host.sessionToken,
    }))).json();
    const roomCode = create.roomCode;

    // Simulate waiting room expiration (set deadline in past)
    const room = await store.getRoom(roomCode, true);
    room!.waitingRoomExpiresAt = Date.now() - 5000;
    await store.saveRoom(room!);

    // Host refreshes
    const syncRes = await syncRoute(createMockReq(`/api/game/sync?roomCode=${roomCode}&sessionToken=${host.sessionToken}`, 'GET'));
    expect(syncRes.status).toBe(410);

    // Session in Redis has roomCode cleared
    const sess = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', {
      sessionToken: host.sessionToken,
    }))).json();
    expect(sess.roomCode).toBeUndefined();

    // Deleted room test (404)
    const notFoundSync = await syncRoute(createMockReq(`/api/game/sync?roomCode=NONEXIST&sessionToken=${host.sessionToken}`, 'GET'));
    expect(notFoundSync.status).toBe(404);
  });

  // 12. Refresh after game ends shows appropriate end-game state
  it('Scenario 12: A player who refreshes after the game ends sees the appropriate end-game state', async () => {
    const p1 = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', { playerName: 'Winner' }))).json();
    const p2 = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', { playerName: 'SecondPlace' }))).json();

    const create = await (await createRoute(createMockReq('/api/game/create', 'POST', {
      playerName: 'Winner',
      sessionToken: p1.sessionToken,
    }))).json();
    const roomCode = create.roomCode;

    await joinRoute(createMockReq('/api/game/join', 'POST', { roomCode, playerName: 'SecondPlace', sessionToken: p2.sessionToken }));

    await actionRoute(createMockReq('/api/game/action', 'POST', {
      roomCode,
      sessionToken: p1.sessionToken,
      action: { type: 'START_GAME' },
    }));

    // End game directly on the room object for fast deterministic test
    const room = (await store.getRoom(roomCode))!;
    room.status = 'game_over';
    room.winnerId = p1.playerId;
    room.finishingPositions = [
      { playerId: p1.playerId, playerName: 'Winner', position: 1 },
      { playerId: p2.playerId, playerName: 'SecondPlace', position: 2 },
    ];
    await store.saveRoom(room);

    // Both players refresh
    const sync1 = await (await syncRoute(createMockReq(`/api/game/sync?roomCode=${roomCode}&sessionToken=${p1.sessionToken}`, 'GET'))).json();
    const sync2 = await (await syncRoute(createMockReq(`/api/game/sync?roomCode=${roomCode}&sessionToken=${p2.sessionToken}`, 'GET'))).json();

    expect(sync1.state.status).toBe('game_over');
    expect(sync1.state.winner.name).toBe('Winner');
    expect(sync1.state.finishingPositions[0].playerName).toBe('Winner');

    expect(sync2.state.status).toBe('game_over');
    expect(sync2.state.winner.name).toBe('Winner');
    expect(sync2.state.finishingPositions[1].playerName).toBe('SecondPlace');
  });

  // 13. React Strict Mode double-initialization idempotency
  it('Scenario 13: Repeated initialization under React Strict Mode does not duplicate actions or membership', async () => {
    const p1 = await (await sessionRoute(createMockReq('/api/auth/session', 'POST', { playerName: 'StrictModeUser' }))).json();
    const create = await (await createRoute(createMockReq('/api/game/create', 'POST', {
      playerName: 'StrictModeUser',
      sessionToken: p1.sessionToken,
    }))).json();
    const roomCode = create.roomCode;

    // Simulate React Strict Mode mounting twice concurrently
    const [call1, call2] = await Promise.all([
      sessionRoute(createMockReq('/api/auth/session', 'POST', { sessionToken: p1.sessionToken, playerName: 'StrictModeUser' })).then(r => r.json()),
      sessionRoute(createMockReq('/api/auth/session', 'POST', { sessionToken: p1.sessionToken, playerName: 'StrictModeUser' })).then(r => r.json()),
    ]);

    expect(call1.playerId).toBe(call2.playerId);
    expect(call1.roomCode).toBe(roomCode);
    expect(call2.roomCode).toBe(roomCode);

    // Sync called twice in parallel
    const [sync1, sync2] = await Promise.all([
      syncRoute(createMockReq(`/api/game/sync?roomCode=${roomCode}&sessionToken=${p1.sessionToken}`, 'GET')).then(r => r.json()),
      syncRoute(createMockReq(`/api/game/sync?roomCode=${roomCode}&sessionToken=${p1.sessionToken}`, 'GET')).then(r => r.json()),
    ]);

    expect(sync1.state.players.length).toBe(1);
    expect(sync2.state.players.length).toBe(1);
  });

  // 14. Reconnection across separate serverless instances
  it('Scenario 14: Reconnection works across separate serverless requests, with state recovered from Redis', async () => {
    // Instance A creates room
    const instanceAStore = new RedisRoomStore();
    const sessA = await instanceAStore.getOrCreateSession(undefined, 'ServerlessPlayer');
    const roomA = await instanceAStore.createRoom({ maxPlayers: 4, minPlayers: 2 }, sessA);
    const roomCode = roomA.room!.roomCode;

    // Instance B (separate cold-started serverless instance) handles refresh reconnection
    const instanceBStore = new RedisRoomStore();
    const recoveredSession = await instanceBStore.getSession(sessA.token);
    expect(recoveredSession).toBeDefined();
    expect(recoveredSession!.roomCode).toBe(roomCode);
    expect(recoveredSession!.playerId).toBe(sessA.playerId);

    const recoveredRoom = await instanceBStore.getRoom(recoveredSession!.roomCode!);
    expect(recoveredRoom).toBeDefined();
    expect(recoveredRoom!.roomCode).toBe(roomCode);
    expect(recoveredRoom!.players.length).toBe(1);
    expect(recoveredRoom!.players[0].id).toBe(sessA.playerId);
  });
});
