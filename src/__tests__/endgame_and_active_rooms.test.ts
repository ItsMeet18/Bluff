import { describe, it, expect, beforeEach } from 'vitest';
import { GameRoom } from '../engine/GameRoom';
import { RoomManager } from '../server/RoomManager';
import { TITLES, getFinishingTitle } from '../utils/titles';
import { Card } from '../types/game';

describe('BLUFF — Special 2-Player Endgame Rule & Spectator Lifecycle', () => {
  let room: GameRoom;

  beforeEach(() => {
    room = new GameRoom({
      roomCode: 'ENDGAME1',
      hostId: 'p1',
      deckCount: 1,
      maxPlayers: 4,
      minPlayers: 2,
      isPrivate: true,
    });
  });

  it('Scenario A: exactly 2 active players, Player A plays final cards, Player B adds cards -> A immediately wins', () => {
    room.addPlayer('p1', 'Alice');
    room.addPlayer('p2', 'Bob');
    room.status = 'in_progress';
    room.playerOrder = ['p1', 'p2'];
    room.currentTurnIndex = 0;

    const cardA: Card = { id: 'card_a', rank: 'K', suit: 'spades', deckIndex: 0 };
    const cardB1: Card = { id: 'card_b1', rank: 'K', suit: 'hearts', deckIndex: 0 };
    const cardB2: Card = { id: 'card_b2', rank: 'K', suit: 'clubs', deckIndex: 0 };

    room.players[0].cards = [cardA];
    room.players[1].cards = [cardB1, cardB2];

    // Step 1: Alice plays her final card into the block declaring Kings
    const play1 = room.playCards('p1', ['card_a'], 'K');
    expect(play1.success).toBe(true);
    expect(room.players[0].cards.length).toBe(0);
    // Crucial rule: Alice is NOT yet marked spectator while the round is unresolved
    expect(room.players[0].isSpectator).toBe(false);
    expect(room.status).toBe('in_progress');

    // Turn advances to Bob
    expect(room.getCurrentPlayer()?.id).toBe('p2');

    // Step 2: Bob adds cards to the same block (instead of challenging Alice)
    const play2 = room.playCards('p2', ['card_b1'], 'K');
    expect(play2.success).toBe(true);

    // Step 3: Special 2-player rule triggers immediately!
    // Alice is declared the winner (1st place finisher)
    expect(room.status).toBe('game_over');
    expect(room.winnerId).toBe('p1');
    expect(room.finishingPositions.length).toBe(2);

    // Alice is 1st (Clutch God in 2-player game)
    expect(room.finishingPositions[0].playerId).toBe('p1');
    expect(room.finishingPositions[0].position).toBe(1);
    expect(room.finishingPositions[0].title).toBe(TITLES.CLUTCH_GOD);

    // Bob is 2nd (Bro is Not Him in 2-player game)
    expect(room.finishingPositions[1].playerId).toBe('p2');
    expect(room.finishingPositions[1].position).toBe(2);
    expect(room.finishingPositions[1].title).toBe(TITLES.NOT_HIM);
    expect(room.finishingPositions[1].isLastStanding).toBe(true);

    // Step 4: Reject further gameplay actions after game over
    const postPlay = room.playCards('p2', ['card_b2'], 'K');
    expect(postPlay.success).toBe(false);
    expect(postPlay.error).toBe('Game is not in progress');

    const postPass = room.passTurn('p2');
    expect(postPass.success).toBe(false);
    expect(postPass.error).toBe('Game is not in progress');

    const postChallenge = room.challengeBluff('p2', 'card_a');
    expect(postChallenge.success).toBe(false);
    expect(postChallenge.error).toBe('Game is not in progress');
  });

  it('Scenario B: >2 active players, Player A plays final cards -> special 2-player rule does NOT trigger prematurely', () => {
    room.addPlayer('p1', 'Alice');
    room.addPlayer('p2', 'Bob');
    room.addPlayer('p3', 'Charlie');
    room.status = 'in_progress';
    room.playerOrder = ['p1', 'p2', 'p3'];
    room.currentTurnIndex = 0;

    const cardA: Card = { id: 'card_a', rank: 'Q', suit: 'spades', deckIndex: 0 };
    const cardB: Card = { id: 'card_b', rank: 'Q', suit: 'hearts', deckIndex: 0 };
    const cardC: Card = { id: 'card_c', rank: 'Q', suit: 'diamonds', deckIndex: 0 };

    room.players[0].cards = [cardA];
    room.players[1].cards = [cardB];
    room.players[2].cards = [cardC];

    // Alice plays her final card
    expect(room.playCards('p1', ['card_a'], 'Q').success).toBe(true);
    expect(room.players[0].cards.length).toBe(0);
    expect(room.players[0].isSpectator).toBe(false);
    expect(room.status).toBe('in_progress');

    // Bob takes turn and adds card to block (3 active players total)
    expect(room.playCards('p2', ['card_b'], 'Q').success).toBe(true);
    // Game must NOT end prematurely because there are 3 active players!
    expect(room.status).toBe('in_progress');
    expect(room.winnerId).toBeNull();

    // Turn moves to Charlie
    expect(room.getCurrentPlayer()?.id).toBe('p3');
  });

  it('Scenario C1: Normal bluff challenge on final card — bluff is caught, player collects cards and remains active', () => {
    room.addPlayer('p1', 'Alice');
    room.addPlayer('p2', 'Bob');
    room.status = 'in_progress';
    room.playerOrder = ['p1', 'p2'];
    room.currentTurnIndex = 0;

    // Alice has a 7 of spades, but declares Aces to try to empty hand
    const bluffCard: Card = { id: 'c_bluff', rank: '7', suit: 'spades', deckIndex: 0 };
    const cardB: Card = { id: 'c_bob', rank: 'A', suit: 'hearts', deckIndex: 0 };

    room.players[0].cards = [bluffCard];
    room.players[1].cards = [cardB];

    // Alice plays bluff card declaring Aces
    expect(room.playCards('p1', ['c_bluff'], 'A').success).toBe(true);
    expect(room.players[0].cards.length).toBe(0);

    // Bob challenges Alice
    const challengeRes = room.challengeBluff('p2', 'c_bluff');
    expect(challengeRes.success).toBe(true);
    expect(challengeRes.result?.wasBluff).toBe(true);

    // Alice collects the block and is NOT eliminated
    expect(room.players[0].cards.length).toBe(1);
    expect(room.players[0].cards[0].id).toBe('c_bluff');
    expect(room.players[0].isSpectator).toBe(false);
    expect(room.status).toBe('in_progress');
  });

  it('Scenario C2: Normal bluff challenge on final card — truthful card, challenger collects and player wins', () => {
    room.addPlayer('p1', 'Alice');
    room.addPlayer('p2', 'Bob');
    room.status = 'in_progress';
    room.playerOrder = ['p1', 'p2'];
    room.currentTurnIndex = 0;

    // Alice truthfully plays Ace
    const truthCard: Card = { id: 'c_truth', rank: 'A', suit: 'spades', deckIndex: 0 };
    const cardB: Card = { id: 'c_bob', rank: '4', suit: 'hearts', deckIndex: 0 };

    room.players[0].cards = [truthCard];
    room.players[1].cards = [cardB];

    // Alice plays truthful card
    expect(room.playCards('p1', ['c_truth'], 'A').success).toBe(true);

    // Bob challenges Alice
    const challengeRes = room.challengeBluff('p2', 'c_truth');
    expect(challengeRes.success).toBe(true);
    expect(challengeRes.result?.wasBluff).toBe(false);

    // Bob collects block, Alice has 0 cards, round is resolved -> Alice wins!
    expect(room.players[1].cards.length).toBe(2);
    expect(room.status).toBe('game_over');
    expect(room.winnerId).toBe('p1');
    expect(room.finishingPositions[0].playerId).toBe('p1');
    expect(room.finishingPositions[0].title).toBe(TITLES.CLUTCH_GOD);
  });

  it('Scenario E: Spectator elimination lifecycle in a 4-player game with Last-Player-Standing titles', () => {
    room.addPlayer('p1', 'Alice');
    room.addPlayer('p2', 'Bob');
    room.addPlayer('p3', 'Charlie');
    room.addPlayer('p4', 'Dave');
    room.status = 'in_progress';
    room.playerOrder = ['p1', 'p2', 'p3', 'p4'];
    room.currentTurnIndex = 0;

    // Give 1 card to Alice, 2 cards to Bob, 2 to Charlie, 2 to Dave
    room.players[0].cards = [{ id: 'a1', rank: '10', suit: 'hearts', deckIndex: 0 }];
    room.players[1].cards = [
      { id: 'b1', rank: '10', suit: 'spades', deckIndex: 0 },
      { id: 'b2', rank: 'K', suit: 'clubs', deckIndex: 0 },
    ];
    room.players[2].cards = [
      { id: 'c1', rank: '10', suit: 'diamonds', deckIndex: 0 },
      { id: 'c2', rank: 'Q', suit: 'hearts', deckIndex: 0 },
    ];
    room.players[3].cards = [
      { id: 'd1', rank: '10', suit: 'clubs', deckIndex: 0 },
      { id: 'd2', rank: 'J', suit: 'spades', deckIndex: 0 },
    ];

    // Alice plays her only card
    expect(room.playCards('p1', ['a1'], '10').success).toBe(true);
    expect(room.players[0].cards.length).toBe(0);
    // Not yet spectator!
    expect(room.players[0].isSpectator).toBe(false);

    // Bob plays b1
    expect(room.playCards('p2', ['b1'], '10').success).toBe(true);
    // Charlie passes, Dave passes, Alice passes, Bob passes -> all pass!
    expect(room.passTurn('p3').success).toBe(true);
    expect(room.passTurn('p4').success).toBe(true);
    expect(room.passTurn('p1').success).toBe(true);
    expect(room.passTurn('p2').success).toBe(true);

    // Block cleared, round resolved! Alice now legitimately transitions to spectator (Position 1)
    expect(room.players[0].isSpectator).toBe(true);
    expect(room.players[0].finishPosition).toBe(1);
    expect(room.finishingPositions[0].playerId).toBe('p1');

    // Remaining active players: Bob, Charlie, Dave (3 players)
    expect(room.getActivePlayers().length).toBe(3);
    expect(room.status).toBe('in_progress');

    // Spectator Alice cannot perform gameplay actions
    expect(room.playCards('p1', ['fake']).success).toBe(false);
    expect(room.passTurn('p1').success).toBe(false);
    expect(room.challengeBluff('p1', 'b1').success).toBe(false);
  });

  it('Scenario F: Rematch cleanly resets spectator status, cards, and titles', () => {
    room.addPlayer('p1', 'Alice');
    room.addPlayer('p2', 'Bob');
    room.status = 'in_progress';
    room.playerOrder = ['p1', 'p2'];
    room.currentTurnIndex = 0;

    room.players[0].cards = [{ id: 'a1', rank: 'A', suit: 'spades', deckIndex: 0 }];
    room.players[1].cards = [{ id: 'b1', rank: '4', suit: 'hearts', deckIndex: 0 }];

    // Alice plays truthful Ace
    room.playCards('p1', ['a1'], 'A');
    // Bob challenges -> fails
    room.challengeBluff('p2', 'a1');

    expect(room.status).toBe('game_over');
    expect(room.finishingPositions.length).toBe(2);
    expect(room.players[0].finishTitle).toBe(TITLES.CLUTCH_GOD);
    expect(room.players[1].finishTitle).toBe(TITLES.NOT_HIM);

    // Initiate Rematch
    const reset = room.resetForRematch();
    expect(reset.success).toBe(true);
    expect(room.status).toBe('waiting');
    expect(room.finishingPositions.length).toBe(0);

    // Verify all players restored
    room.players.forEach(p => {
      expect(p.isSpectator).toBe(false);
      expect(p.cards.length).toBe(0);
      expect(p.finishPosition).toBeUndefined();
      expect(p.finishTitle).toBeUndefined();
    });
  });
});

describe('BLUFF — Active Rooms Discovery & Server Management', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  it('lists newly created waiting rooms in Active Rooms', () => {
    const session = roomManager.getOrCreateSession(undefined, 'HostAlice');
    const createRes = roomManager.createRoom({ deckCount: 1, maxPlayers: 4 }, session, 'sock1');
    expect(createRes.success).toBe(true);

    const activeRooms = roomManager.getActiveRooms();
    expect(activeRooms.length).toBe(1);
    expect(activeRooms[0].roomCode).toBe(createRes.room?.roomCode);
    expect(activeRooms[0].hostName).toBe('HostAlice');
    expect(activeRooms[0].playerCount).toBe(1);
    expect(activeRooms[0].maxPlayers).toBe(4);
    expect(activeRooms[0].deckCount).toBe(1);
    expect(activeRooms[0].status).toBe('waiting');
  });

  it('excludes rooms that are full from Active Rooms', () => {
    const hostSession = roomManager.getOrCreateSession(undefined, 'Host');
    const createRes = roomManager.createRoom({ deckCount: 1, maxPlayers: 2 }, hostSession, 'sock1');
    expect(createRes.success).toBe(true);
    const roomCode = createRes.room!.roomCode;

    // Initially 1/2 players -> active
    expect(roomManager.getActiveRooms().length).toBe(1);

    // Player 2 joins -> 2/2 players (Full)
    const p2Session = roomManager.getOrCreateSession(undefined, 'Player2');
    const joinRes = roomManager.joinRoom({ roomCode, playerName: 'Player2' }, p2Session, 'sock2');
    expect(joinRes.success).toBe(true);

    // Full room must be excluded from joinable active rooms list
    expect(roomManager.getActiveRooms().length).toBe(0);
  });

  it('excludes rooms that have started (in_progress) or ended from Active Rooms', () => {
    const hostSession = roomManager.getOrCreateSession(undefined, 'Host');
    const createRes = roomManager.createRoom({ deckCount: 1, maxPlayers: 4, minPlayers: 2 }, hostSession, 'sock1');
    const room = createRes.room!;

    const p2Session = roomManager.getOrCreateSession(undefined, 'Player2');
    roomManager.joinRoom({ roomCode: room.roomCode, playerName: 'Player2' }, p2Session, 'sock2');

    expect(roomManager.getActiveRooms().length).toBe(1);

    // Host starts game
    room.startGame(hostSession.playerId);
    expect(room.status).toBe('in_progress');

    // Started room must not appear in Active Rooms
    expect(roomManager.getActiveRooms().length).toBe(0);
  });

  it('removes empty/closed rooms from Active Rooms', () => {
    const hostSession = roomManager.getOrCreateSession(undefined, 'Host');
    const createRes = roomManager.createRoom({ deckCount: 1, maxPlayers: 4 }, hostSession, 'sock1');
    const roomCode = createRes.room!.roomCode;

    expect(roomManager.getActiveRooms().length).toBe(1);

    roomManager.removeRoom(roomCode);
    expect(roomManager.getActiveRooms().length).toBe(0);
  });
});
