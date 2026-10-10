import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { setupSocketHandlers } from '../server/socketHandler';
import { RoomManager } from '../server/RoomManager';
import { PublicGameState } from '../types/game';

describe('BLUFF End-to-End Real-Time Socket.IO Multiplayer', () => {
  let server: http.Server;
  let ioServer: Server;
  let roomManager: RoomManager;
  let port: number;

  beforeAll(async () => {
    roomManager = new RoomManager();
    server = http.createServer();
    ioServer = new Server(server, {
      cors: { origin: '*' },
    });
    setupSocketHandlers(ioServer, roomManager);

    await new Promise<void>(resolve => {
      server.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          port = addr.port;
        }
        resolve();
      });
    });
  });

  afterAll(() => {
    ioServer.close();
    server.close();
  });

  it('handles full multiplayer lifecycle: auth -> create -> join -> start -> play -> challenge -> victory', async () => {
    // 1. Connect Client A (Alice)
    const clientA: ClientSocket = Client(`http://localhost:${port}`);
    const clientB: ClientSocket = Client(`http://localhost:${port}`);

    await new Promise<void>(resolve => {
      let connectedCount = 0;
      const onConn = () => {
        connectedCount++;
        if (connectedCount === 2) resolve();
      };
      clientA.on('connect', onConn);
      clientB.on('connect', onConn);
    });

    // 2. Authenticate both clients
    const authA: any = await new Promise(resolve => {
      clientA.emit('auth_session', { playerName: 'Alice' }, resolve);
    });
    expect(authA.success).toBe(true);
    expect(authA.playerName).toBe('Alice');

    const authB: any = await new Promise(resolve => {
      clientB.emit('auth_session', { playerName: 'Bob' }, resolve);
    });
    expect(authB.success).toBe(true);
    expect(authB.playerName).toBe('Bob');

    // 3. Alice creates a 1-deck room
    const createRes: any = await new Promise(resolve => {
      clientA.emit('create_room', { deckCount: 1, maxPlayers: 4 }, resolve);
    });
    expect(createRes.success).toBe(true);
    const roomCode = createRes.roomCode;
    expect(roomCode.length).toBe(6);

    // 4. Bob joins the room using roomCode
    let stateReceivedByA: PublicGameState | null = null;
    let stateReceivedByB: PublicGameState | null = null;

    clientA.on('game_state_updated', (state: PublicGameState) => {
      stateReceivedByA = state;
    });

    clientB.on('game_state_updated', (state: PublicGameState) => {
      stateReceivedByB = state;
    });

    const joinRes: any = await new Promise(resolve => {
      clientB.emit('join_room', { roomCode }, resolve);
    });
    expect(joinRes.success).toBe(true);

    // Wait for room update broadcast
    await new Promise(r => setTimeout(r, 100));

    expect(stateReceivedByA?.players.length).toBe(2);
    expect(stateReceivedByB?.players.length).toBe(2);
    expect(stateReceivedByA?.status).toBe('waiting');

    // 5. Alice (Host) starts the game
    const startRes: any = await new Promise(resolve => {
      clientA.emit('start_game', { roomCode }, resolve);
    });
    expect(startRes.success).toBe(true);

    await new Promise(r => setTimeout(r, 100));

    // Verify In-Progress and Card Distribution
    expect(stateReceivedByA?.status).toBe('in_progress');
    expect(stateReceivedByB?.status).toBe('in_progress');
    expect(stateReceivedByA?.myHand.length).toBe(26); // 52 / 2 = 26 cards each
    expect(stateReceivedByB?.myHand.length).toBe(26);

    // Verify Card Privacy: A sees own cards, B sees own cards, opponent cards are never leaked
    expect(stateReceivedByA?.myHand[0].rank).toBeDefined();
    expect(stateReceivedByB?.myHand[0].rank).toBeDefined();
    expect((stateReceivedByA?.players[1] as any).cards).toBeUndefined();
    expect((stateReceivedByB?.players[0] as any).cards).toBeUndefined();

    // 6. Test Active Turn & Play Cards
    const currentTurnPlayerId = stateReceivedByA?.currentTurnPlayerId;
    const activeClient = currentTurnPlayerId === authA.playerId ? clientA : clientB;
    const activeState = currentTurnPlayerId === authA.playerId ? stateReceivedByA! : stateReceivedByB!;
    const inactiveClient = currentTurnPlayerId === authA.playerId ? clientB : clientA;

    // Active player plays 2 cards and declares Kings
    const cardsToPlay = [activeState.myHand[0].id, activeState.myHand[1].id];
    const playRes: any = await new Promise(resolve => {
      activeClient.emit('play_cards', { roomCode, cardIds: cardsToPlay, declaredRank: 'K' }, resolve);
    });
    expect(playRes.success).toBe(true);

    await new Promise(r => setTimeout(r, 100));

    expect(stateReceivedByA?.totalBlockCards).toBe(2);
    expect(stateReceivedByA?.activeRank).toBe('K');
    expect(stateReceivedByA?.lastPlay?.declaredRank).toBe('K');
    expect(stateReceivedByA?.lastPlay?.cardCount).toBe(2);

    // 7. Inactive player now has turn, and calls Bluff on one of the played cards
    const cardToChallenge = stateReceivedByA?.lastPlay?.cardIds[0]!;
    const challengeRes: any = await new Promise(resolve => {
      inactiveClient.emit('call_bluff', { roomCode, selectedCardId: cardToChallenge }, resolve);
    });
    expect(challengeRes.success).toBe(true);
    expect(challengeRes.result).toBeDefined();
    expect(challengeRes.result?.card.id).toBe(cardToChallenge);

    await new Promise(r => setTimeout(r, 100));

    // After challenge resolution: Central block cleared, active rank reset
    expect(stateReceivedByA?.totalBlockCards).toBe(0);
    expect(stateReceivedByA?.activeRank).toBeNull();
    expect(stateReceivedByA?.lastRevealedChallenge).toBeDefined();

    clientA.disconnect();
    clientB.disconnect();
  });

  it('correctly associates updated player names across consecutive room creations (M in Room 1, A in Room 2, B in Room 3)', async () => {
    const client: ClientSocket = Client(`http://localhost:${port}`);

    await new Promise<void>(resolve => {
      client.on('connect', () => resolve());
    });

    // 1. Enter M -> Create Room 1
    const auth1: any = await new Promise(resolve => {
      client.emit('auth_session', { playerName: 'M' }, resolve);
    });
    expect(auth1.playerName).toBe('M');

    const room1Res: any = await new Promise(resolve => {
      client.emit('create_room', { deckCount: 1, playerName: 'M' }, resolve);
    });
    expect(room1Res.success).toBe(true);
    expect(room1Res.state.players[0].name).toBe('M');

    // Leave Room 1
    await new Promise(resolve => {
      client.emit('leave_room', { roomCode: room1Res.roomCode }, resolve);
    });

    // 2. Enter A -> Create Room 2
    const auth2: any = await new Promise(resolve => {
      client.emit('auth_session', { sessionToken: auth1.sessionToken, playerName: 'A' }, resolve);
    });
    expect(auth2.playerName).toBe('A');

    const room2Res: any = await new Promise(resolve => {
      client.emit('create_room', { deckCount: 1, playerName: 'A' }, resolve);
    });
    expect(room2Res.success).toBe(true);
    expect(room2Res.state.players[0].name).toBe('A');

    // Leave Room 2
    await new Promise(resolve => {
      client.emit('leave_room', { roomCode: room2Res.roomCode }, resolve);
    });

    // 3. Enter B -> Create Room 3
    const auth3: any = await new Promise(resolve => {
      client.emit('auth_session', { sessionToken: auth1.sessionToken, playerName: 'B' }, resolve);
    });
    expect(auth3.playerName).toBe('B');

    const room3Res: any = await new Promise(resolve => {
      client.emit('create_room', { deckCount: 1, playerName: 'B' }, resolve);
    });
    expect(room3Res.success).toBe(true);
    expect(room3Res.state.players[0].name).toBe('B');

    // Guest connects and joins Room 3 with name "Partner"
    const guestClient: ClientSocket = Client(`http://localhost:${port}`);
    await new Promise<void>(resolve => guestClient.on('connect', () => resolve()));

    const guestJoinRes: any = await new Promise(resolve => {
      guestClient.emit('join_room', { roomCode: room3Res.roomCode, playerName: 'Partner' }, resolve);
    });
    expect(guestJoinRes.success).toBe(true);
    expect(guestJoinRes.state.players.find((p: any) => p.name === 'B')).toBeDefined();
    expect(guestJoinRes.state.players.find((p: any) => p.name === 'Partner')).toBeDefined();

    client.disconnect();
    guestClient.disconnect();
  });

  it('supports direct invite link flow where guest enters name and gets automatically seated in the room', async () => {
    // 1. Host creates a room
    const host: ClientSocket = Client(`http://localhost:${port}`);
    await new Promise<void>(resolve => host.on('connect', () => resolve()));
    await new Promise(resolve => host.emit('auth_session', { playerName: 'HostPlayer' }, resolve));

    const createRes: any = await new Promise(resolve => {
      host.emit('create_room', { deckCount: 2, maxPlayers: 6, playerName: 'HostPlayer' }, resolve);
    });
    expect(createRes.success).toBe(true);
    const inviteRoomCode = createRes.roomCode;

    // 2. Guest opens invite link: connects socket, provides name, and joins via roomCode directly
    const guest: ClientSocket = Client(`http://localhost:${port}`);
    await new Promise<void>(resolve => guest.on('connect', () => resolve()));
    const authGuest: any = await new Promise(resolve => {
      guest.emit('auth_session', { playerName: 'InvitedGuest' }, resolve);
    });
    expect(authGuest.playerName).toBe('InvitedGuest');

    let hostUpdatedState: PublicGameState | null = null;
    host.on('game_state_updated', (state: PublicGameState) => {
      hostUpdatedState = state;
    });

    const joinRes: any = await new Promise(resolve => {
      guest.emit('join_room', { roomCode: inviteRoomCode, playerName: 'InvitedGuest' }, resolve);
    });

    expect(joinRes.success).toBe(true);
    expect(joinRes.state.roomCode).toBe(inviteRoomCode);
    expect(joinRes.state.players.length).toBe(2);
    expect(joinRes.state.players.find((p: any) => p.name === 'InvitedGuest')).toBeDefined();

    // Verify host sees the invited guest immediately
    await new Promise(r => setTimeout(r, 100));
    expect(hostUpdatedState?.players.length).toBe(2);
    expect(hostUpdatedState?.players[1].name).toBe('InvitedGuest');

    host.disconnect();
    guest.disconnect();
  });

  it('handles large multi-card plays and allows challenger to select any card from a large selection', async () => {
    const p1: ClientSocket = Client(`http://localhost:${port}`);
    const p2: ClientSocket = Client(`http://localhost:${port}`);

    await new Promise<void>(resolve => {
      let count = 0;
      const done = () => { count++; if (count === 2) resolve(); };
      p1.on('connect', done);
      p2.on('connect', done);
    });

    await new Promise(r => p1.emit('auth_session', { playerName: 'P1' }, r));
    await new Promise(r => p2.emit('auth_session', { playerName: 'P2' }, r));

    const roomRes: any = await new Promise(r => p1.emit('create_room', { deckCount: 3, maxPlayers: 4, playerName: 'P1' }, r));
    const code = roomRes.roomCode;
    await new Promise(r => p2.emit('join_room', { roomCode: code, playerName: 'P2' }, r));

    let p1State: PublicGameState | null = null;
    let p2State: PublicGameState | null = null;
    p1.on('game_state_updated', (s: PublicGameState) => { p1State = s; });
    p2.on('game_state_updated', (s: PublicGameState) => { p2State = s; });

    // Start game
    await new Promise(r => p1.emit('start_game', { roomCode: code }, r));
    await new Promise(r => setTimeout(r, 100));

    // Find active turn player
    const activeSocket = p1State?.isMyTurn ? p1 : p2;
    const inactiveSocket = p1State?.isMyTurn ? p2 : p1;
    const activeHand = p1State?.isMyTurn ? p1State.myHand : p2State!.myHand;

    // Active player plays 8 cards at once!
    const eightCards = activeHand.slice(0, 8).map(c => c.id);
    const playRes: any = await new Promise(r => {
      activeSocket.emit('play_cards', { roomCode: code, cardIds: eightCards, declaredRank: 'A' }, r);
    });
    expect(playRes.success).toBe(true);

    await new Promise(r => setTimeout(r, 100));

    // Verify inactive player can challenge the 8th card (the last card in the selection)
    const cardToPick = eightCards[7];
    const challengeRes: any = await new Promise(r => {
      inactiveSocket.emit('call_bluff', { roomCode: code, selectedCardId: cardToPick }, r);
    });

    expect(challengeRes.success).toBe(true);
    expect(challengeRes.result?.card.id).toBe(cardToPick);

    p1.disconnect();
    p2.disconnect();
  });
});
