import { describe, it, expect, beforeEach } from 'vitest';
import { GameRoom } from '../engine/GameRoom';
import { RoomManager } from '../server/RoomManager';
import { createDecks, shuffleCards, distributeCards } from '../engine/deck';
import { Card, Rank } from '../types/game';

describe('BLUFF Game Engine — 20 Required Test Scenarios', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  // 1. Creating a room with a selected number of decks
  it('Scenario 1: creates a room with configured number of decks', () => {
    const session = roomManager.getOrCreateSession(undefined, 'HostPlayer');
    const result = roomManager.createRoom({ playerName: 'HostPlayer', deckCount: 3 }, session);

    expect(result.success).toBe(true);
    expect(result.room).toBeDefined();
    expect(result.room?.config.deckCount).toBe(3);
    expect(result.room?.config.roomCode.length).toBe(6);
    expect(result.room?.players.length).toBe(1);
    expect(result.room?.players[0].isHost).toBe(true);
  });

  // 2. Joining a valid room using its code
  it('Scenario 2: joins a valid room using its code', () => {
    const hostSession = roomManager.getOrCreateSession(undefined, 'Host');
    const roomRes = roomManager.createRoom({ playerName: 'Host', deckCount: 1 }, hostSession);
    const code = roomRes.room!.roomCode;

    const guestSession = roomManager.getOrCreateSession(undefined, 'Guest');
    const joinRes = roomManager.joinRoom({ roomCode: code, playerName: 'Guest' }, guestSession);

    expect(joinRes.success).toBe(true);
    expect(joinRes.room?.players.length).toBe(2);
    expect(joinRes.room?.players[1].name).toBe('Guest');
  });

  // 3. Rejecting invalid, full, and already-started rooms
  it('Scenario 3: rejects invalid, full, and already-started rooms', () => {
    const session = roomManager.getOrCreateSession(undefined, 'Player');

    // Invalid code
    const invalidRes = roomManager.joinRoom({ roomCode: 'NONEXIST', playerName: 'Player' }, session);
    expect(invalidRes.success).toBe(false);
    expect(invalidRes.error).toContain('does not exist');

    // Full room
    const hostSession = roomManager.getOrCreateSession(undefined, 'Host');
    const createRes = roomManager.createRoom({ playerName: 'Host', deckCount: 1, maxPlayers: 2 }, hostSession);
    const code = createRes.room!.roomCode;

    const player2Session = roomManager.getOrCreateSession(undefined, 'P2');
    roomManager.joinRoom({ roomCode: code, playerName: 'P2' }, player2Session);

    const player3Session = roomManager.getOrCreateSession(undefined, 'P3');
    const fullRes = roomManager.joinRoom({ roomCode: code, playerName: 'P3' }, player3Session);
    expect(fullRes.success).toBe(false);
    expect(fullRes.error).toContain('full');

    // Already started room
    createRes.room!.startGame(hostSession.playerId);
    const lateSession = roomManager.getOrCreateSession(undefined, 'Late');
    const startedRes = roomManager.joinRoom({ roomCode: code, playerName: 'Late' }, lateSession);
    expect(startedRes.success).toBe(false);
    expect(startedRes.error).toContain('already started');
  });

  // 4. Correctly shuffling and distributing all cards
  it('Scenario 4: correctly shuffles and distributes all cards evenly', () => {
    const room = new GameRoom({
      roomCode: 'TEST01',
      hostId: 'p1',
      deckCount: 1,
      maxPlayers: 4,
      minPlayers: 2,
      isPrivate: true,
    });

    room.addPlayer('p1', 'Player 1');
    room.addPlayer('p2', 'Player 2');
    room.addPlayer('p3', 'Player 3');

    const startRes = room.startGame('p1');
    expect(startRes.success).toBe(true);

    const totalDealt = room.players.reduce((sum, p) => sum + p.cards.length, 0);
    expect(totalDealt).toBe(52); // 1 standard deck = 52 cards
    // 52 divided by 3: two get 17, one gets 18
    expect([17, 18]).toContain(room.players[0].cards.length);
    expect([17, 18]).toContain(room.players[1].cards.length);
    expect([17, 18]).toContain(room.players[2].cards.length);
  });

  // 5. Preventing a player from playing cards they do not own
  it('Scenario 5: prevents a player from playing cards they do not own', () => {
    const room = new GameRoom({
      roomCode: 'TEST02',
      hostId: 'p1',
      deckCount: 1,
      maxPlayers: 2,
      minPlayers: 2,
      isPrivate: true,
    });
    room.addPlayer('p1', 'Player 1');
    room.addPlayer('p2', 'Player 2');
    room.startGame('p1');

    const currentTurnPlayer = room.getCurrentPlayer()!;
    const fakeCardId = 'card_999_fake';

    const playRes = room.playCards(currentTurnPlayer.id, [fakeCardId], 'K');
    expect(playRes.success).toBe(false);
    expect(playRes.error).toContain('do not hold');
  });

  // 6. Rejecting moves made out of turn
  it('Scenario 6: rejects moves made out of turn', () => {
    const room = new GameRoom({
      roomCode: 'TEST03',
      hostId: 'p1',
      deckCount: 1,
      maxPlayers: 2,
      minPlayers: 2,
      isPrivate: true,
    });
    room.addPlayer('p1', 'Player 1');
    room.addPlayer('p2', 'Player 2');
    room.startGame('p1');

    const waitingPlayer = room.players.find(p => p.id !== room.getCurrentPlayer()!.id)!;
    const cardToPlay = waitingPlayer.cards[0].id;

    const playRes = room.playCards(waitingPlayer.id, [cardToPlay], 'A');
    expect(playRes.success).toBe(false);
    expect(playRes.error).toContain('Not your turn');
  });

  // 7. Adding cards while preserving the active rank
  it('Scenario 7: adding cards preserves active rank', () => {
    const room = new GameRoom({
      roomCode: 'TEST04',
      hostId: 'p1',
      deckCount: 1,
      maxPlayers: 2,
      minPlayers: 2,
      isPrivate: true,
    });
    room.addPlayer('p1', 'P1');
    room.addPlayer('p2', 'P2');
    room.startGame('p1');

    const p1 = room.getCurrentPlayer()!;
    const p1Cards = [p1.cards[0].id];
    room.playCards(p1.id, p1Cards, 'K');

    expect(room.activeRank).toBe('K');
    expect(room.blockCards.length).toBe(1);

    const p2 = room.getCurrentPlayer()!;
    const p2Cards = [p2.cards[0].id];
    // Attempt to declare a different rank during existing round
    const wrongRankRes = room.playCards(p2.id, p2Cards, 'Q');
    expect(wrongRankRes.success).toBe(false);

    // Play following active rank
    const correctRes = room.playCards(p2.id, p2Cards, 'K');
    expect(correctRes.success).toBe(true);
    expect(room.activeRank).toBe('K');
    expect(room.blockCards.length).toBe(2);
  });

  // 8. Successfully calling a bluff and awarding the block to the challenged player
  it('Scenario 8: successfully calls bluff, awards block to challenged player', () => {
    const room = new GameRoom({
      roomCode: 'TEST05',
      hostId: 'p1',
      deckCount: 1,
      maxPlayers: 2,
      minPlayers: 2,
      isPrivate: true,
    });
    room.addPlayer('p1', 'P1');
    room.addPlayer('p2', 'P2');
    room.status = 'in_progress';
    room.playerOrder = ['p1', 'p2'];
    room.currentTurnIndex = 0;

    // Give P1 a specific card (Ace) and P2 another card
    const aceCard: Card = { id: 'c_ace', rank: 'A', suit: 'spades', deckIndex: 0 };
    room.players[0].cards = [aceCard];
    room.players[1].cards = [{ id: 'c_2', rank: '2', suit: 'hearts', deckIndex: 0 }];

    // P1 plays Ace but declares Kings (A BLUFF!)
    const playRes = room.playCards('p1', ['c_ace'], 'K');
    expect(playRes.success).toBe(true);
    expect(room.blockCards.length).toBe(1);

    // Turn is now P2. P2 calls bluff on the card played
    const challengeRes = room.challengeBluff('p2', 'c_ace');
    expect(challengeRes.success).toBe(true);
    expect(challengeRes.result?.wasBluff).toBe(true);
    expect(challengeRes.result?.penaltyTargetId).toBe('p1'); // P1 caught bluffing

    // P1 collects the block (which was 1 card)
    expect(room.players[0].cards.length).toBe(1);
    expect(room.blockCards.length).toBe(0);
    expect(room.activeRank).toBeNull();
    // Successful challenger (P2) starts next round
    expect(room.getCurrentPlayer()?.id).toBe('p2');
  });

  // 9. Failing to call a bluff and awarding the block to the challenger
  it('Scenario 9: failing to call bluff awards block to challenger', () => {
    const room = new GameRoom({
      roomCode: 'TEST06',
      hostId: 'p1',
      deckCount: 1,
      maxPlayers: 2,
      minPlayers: 2,
      isPrivate: true,
    });
    room.addPlayer('p1', 'P1');
    room.addPlayer('p2', 'P2');
    room.status = 'in_progress';
    room.playerOrder = ['p1', 'p2'];
    room.currentTurnIndex = 0;

    // P1 holds a King and plays it truthfully
    const kingCard: Card = { id: 'c_king', rank: 'K', suit: 'hearts', deckIndex: 0 };
    room.players[0].cards = [kingCard];
    room.players[1].cards = [{ id: 'c_3', rank: '3', suit: 'clubs', deckIndex: 0 }];

    room.playCards('p1', ['c_king'], 'K');

    // P2 challenges P1's King (TRUTH!)
    const challengeRes = room.challengeBluff('p2', 'c_king');
    expect(challengeRes.success).toBe(true);
    expect(challengeRes.result?.wasBluff).toBe(false);
    expect(challengeRes.result?.penaltyTargetId).toBe('p2'); // P2 failed challenge

    // P2 collects block (now holds 1 original + 1 block = 2 cards)
    expect(room.players[1].cards.length).toBe(2);
    expect(room.blockCards.length).toBe(0);
    // Challenged player (P1) starts next round (if game not over)
  });

  // 10. Revealing only the selected challenge card
  it('Scenario 10: reveals only the selected challenge card from a multi-card play', () => {
    const room = new GameRoom({
      roomCode: 'TEST07',
      hostId: 'p1',
      deckCount: 1,
      maxPlayers: 2,
      minPlayers: 2,
      isPrivate: true,
    });
    room.addPlayer('p1', 'P1');
    room.addPlayer('p2', 'P2');
    room.status = 'in_progress';
    room.playerOrder = ['p1', 'p2'];
    room.currentTurnIndex = 0;

    const c1: Card = { id: 'c1', rank: 'K', suit: 'spades', deckIndex: 0 };
    const c2: Card = { id: 'c2', rank: '7', suit: 'diamonds', deckIndex: 0 };
    const c3: Card = { id: 'c3', rank: 'K', suit: 'clubs', deckIndex: 0 };
    room.players[0].cards = [c1, c2, c3];

    // P1 plays 3 cards and declares Kings
    room.playCards('p1', ['c1', 'c2', 'c3'], 'K');

    // P2 chooses specifically card c2 to challenge
    const res = room.challengeBluff('p2', 'c2');
    expect(res.success).toBe(true);
    expect(res.result?.card.id).toBe('c2');
    expect(res.result?.card.rank).toBe('7');
    expect(res.result?.wasBluff).toBe(true);
  });

  // 11. Resetting the consecutive-pass count when a player adds cards
  it('Scenario 11: resets consecutive pass count when a player adds cards', () => {
    const room = new GameRoom({
      roomCode: 'TEST08',
      hostId: 'p1',
      deckCount: 1,
      maxPlayers: 3,
      minPlayers: 3,
      isPrivate: true,
    });
    room.addPlayer('p1', 'P1');
    room.addPlayer('p2', 'P2');
    room.addPlayer('p3', 'P3');
    room.status = 'in_progress';
    room.playerOrder = ['p1', 'p2', 'p3'];
    room.currentTurnIndex = 0;

    room.players[0].cards = [{ id: 'p1_1', rank: 'J', suit: 'hearts', deckIndex: 0 }];
    room.players[1].cards = [{ id: 'p2_1', rank: 'J', suit: 'diamonds', deckIndex: 0 }];
    room.players[2].cards = [{ id: 'p3_1', rank: 'J', suit: 'spades', deckIndex: 0 }];

    room.playCards('p1', ['p1_1'], 'J');
    expect(room.consecutivePasses).toBe(0);

    room.passTurn('p2');
    expect(room.consecutivePasses).toBe(1);

    // P3 adds cards -> consecutive passes resets to 0
    room.playCards('p3', ['p3_1'], 'J');
    expect(room.consecutivePasses).toBe(0);
  });

  // 12. Clearing the block without awarding it when all players pass
  it('Scenario 12: clears the block without awarding it when all players pass', () => {
    const room = new GameRoom({
      roomCode: 'TEST09',
      hostId: 'p1',
      deckCount: 1,
      maxPlayers: 3,
      minPlayers: 3,
      isPrivate: true,
    });
    room.addPlayer('p1', 'P1');
    room.addPlayer('p2', 'P2');
    room.addPlayer('p3', 'P3');
    room.status = 'in_progress';
    room.playerOrder = ['p1', 'p2', 'p3'];
    room.currentTurnIndex = 0;

    room.players[0].cards = [
      { id: 'c1', rank: '10', suit: 'hearts', deckIndex: 0 },
      { id: 'c2', rank: '5', suit: 'clubs', deckIndex: 0 },
    ];
    room.players[1].cards = [{ id: 'c3', rank: '9', suit: 'diamonds', deckIndex: 0 }];
    room.players[2].cards = [{ id: 'c4', rank: '8', suit: 'spades', deckIndex: 0 }];

    // P1 plays cards
    room.playCards('p1', ['c1'], '10');
    expect(room.blockCards.length).toBe(1);

    // P2 passes
    room.passTurn('p2');
    // P3 passes
    room.passTurn('p3');
    // P1 passes -> 3 consecutive passes (all players passed!)
    room.passTurn('p1');

    // Block is cleared, no one receives the cards
    expect(room.blockCards.length).toBe(0);
    expect(room.activeRank).toBeNull();
    expect(room.players[0].cards.length).toBe(1);
    expect(room.players[1].cards.length).toBe(1);
    expect(room.players[2].cards.length).toBe(1);
  });

  // 13. Returning the next turn to the player who made the most recent card play into the block after all players pass
  it('Scenario 13: returns turn to the last player who played cards after all pass', () => {
    const room = new GameRoom({
      roomCode: 'TEST10',
      hostId: 'p1',
      deckCount: 1,
      maxPlayers: 3,
      minPlayers: 3,
      isPrivate: true,
    });
    room.addPlayer('p1', 'P1');
    room.addPlayer('p2', 'P2');
    room.addPlayer('p3', 'P3');
    room.status = 'in_progress';
    room.playerOrder = ['p1', 'p2', 'p3'];
    room.currentTurnIndex = 0;

    room.players[0].cards = [{ id: 'c1', rank: 'A', suit: 'hearts', deckIndex: 0 }];
    room.players[1].cards = [
      { id: 'c2', rank: 'A', suit: 'clubs', deckIndex: 0 },
      { id: 'c2_2', rank: 'K', suit: 'spades', deckIndex: 0 }
    ];
    room.players[2].cards = [{ id: 'c3', rank: 'A', suit: 'diamonds', deckIndex: 0 }];

    // P1 plays
    room.playCards('p1', ['c1'], 'A');
    // P2 plays (becomes last player to play)
    room.playCards('p2', ['c2'], 'A');
    // P3 passes
    room.passTurn('p3');
    // P1 passes
    room.passTurn('p1');
    // P2 passes -> 3 consecutive passes
    room.passTurn('p2');

    // Turn must return to P2 (the last player who contributed cards)
    expect(room.getCurrentPlayer()?.id).toBe('p2');
    expect(room.activeRank).toBeNull(); // Fresh round!
  });

  // 14. Correctly checking the winner after a block collection
  it('Scenario 14: correctly checks winner after block collection', () => {
    const room = new GameRoom({
      roomCode: 'TEST11',
      hostId: 'p1',
      deckCount: 1,
      maxPlayers: 2,
      minPlayers: 2,
      isPrivate: true,
    });
    room.addPlayer('p1', 'P1');
    room.addPlayer('p2', 'P2');
    room.status = 'in_progress';
    room.playerOrder = ['p1', 'p2'];
    room.currentTurnIndex = 0;

    // P1 has 1 card (King), P2 has 1 card
    room.players[0].cards = [{ id: 'c_win', rank: 'K', suit: 'spades', deckIndex: 0 }];
    room.players[1].cards = [{ id: 'c_other', rank: '4', suit: 'hearts', deckIndex: 0 }];

    // P1 plays their last card truthfully
    room.playCards('p1', ['c_win'], 'K');
    expect(room.players[0].cards.length).toBe(0);

    // P2 challenges P1
    const res = room.challengeBluff('p2', 'c_win');
    expect(res.result?.wasBluff).toBe(false);

    // P2 collects block. P1 still has 0 cards -> P1 WINS!
    expect(room.status).toBe('game_over');
    expect(room.winnerId).toBe('p1');
  });

  // 15. Allowing a player with zero cards to be challenged before confirming the win
  it('Scenario 15: catches a bluff on final card, preventing false victory', () => {
    const room = new GameRoom({
      roomCode: 'TEST12',
      hostId: 'p1',
      deckCount: 1,
      maxPlayers: 2,
      minPlayers: 2,
      isPrivate: true,
    });
    room.addPlayer('p1', 'P1');
    room.addPlayer('p2', 'P2');
    room.status = 'in_progress';
    room.playerOrder = ['p1', 'p2'];
    room.currentTurnIndex = 0;

    // P1 has 1 card (Ace) but declares Kings to try to empty hand
    room.players[0].cards = [{ id: 'c_bluff_win', rank: 'A', suit: 'spades', deckIndex: 0 }];
    room.players[1].cards = [{ id: 'c_p2', rank: '4', suit: 'hearts', deckIndex: 0 }];

    room.playCards('p1', ['c_bluff_win'], 'K');
    expect(room.players[0].cards.length).toBe(0);
    expect(room.status).toBe('in_progress'); // NOT game over yet!

    // P2 challenges
    const res = room.challengeBluff('p2', 'c_bluff_win');
    expect(res.result?.wasBluff).toBe(true);

    // P1 caught bluffing on final card! P1 collects block
    expect(room.players[0].cards.length).toBe(1);
    expect(room.status).toBe('in_progress'); // Game continues!
    expect(room.winnerId).toBeNull();
  });

  // 16. Preventing double resolution of a challenge
  it('Scenario 16: prevents double resolution of a challenge', () => {
    const room = new GameRoom({
      roomCode: 'TEST13',
      hostId: 'p1',
      deckCount: 1,
      maxPlayers: 2,
      minPlayers: 2,
      isPrivate: true,
    });
    room.addPlayer('p1', 'P1');
    room.addPlayer('p2', 'P2');
    room.status = 'in_progress';
    room.playerOrder = ['p1', 'p2'];
    room.currentTurnIndex = 0;

    room.players[0].cards = [
      { id: 'c1', rank: '5', suit: 'spades', deckIndex: 0 },
      { id: 'c1_extra', rank: '9', suit: 'hearts', deckIndex: 0 }
    ];
    room.players[1].cards = [{ id: 'c2', rank: '5', suit: 'hearts', deckIndex: 0 }];

    room.playCards('p1', ['c1'], '5');
    const firstChallenge = room.challengeBluff('p2', 'c1');
    expect(firstChallenge.success).toBe(true);

    // Try challenging again from p2 (not their turn anymore)
    const secondChallengeP2 = room.challengeBluff('p2', 'c1');
    expect(secondChallengeP2.success).toBe(false);

    // Try challenging again from current turn player p1 (no play to challenge)
    const secondChallengeP1 = room.challengeBluff('p1', 'c1');
    expect(secondChallengeP1.success).toBe(false);
    expect(secondChallengeP1.error).toContain('No play available to challenge');
  });

  // 17. Preserving state after temporary disconnection and reconnection
  it('Scenario 17: preserves state across disconnect and reconnect', () => {
    const room = new GameRoom({
      roomCode: 'TEST14',
      hostId: 'p1',
      deckCount: 1,
      maxPlayers: 2,
      minPlayers: 2,
      isPrivate: true,
    });
    room.addPlayer('p1', 'P1', 'socket_1');
    room.addPlayer('p2', 'P2', 'socket_2');
    room.startGame('p1');

    const p1CardCountBefore = room.players[0].cards.length;

    // Disconnect
    room.markDisconnected('socket_1');
    expect(room.players[0].isConnected).toBe(false);

    // Reconnect with new socket ID
    const reconnectRes = room.reconnectPlayer('p1', 'socket_1_new');
    expect(reconnectRes.success).toBe(true);
    expect(room.players[0].isConnected).toBe(true);
    expect(room.players[0].cards.length).toBe(p1CardCountBefore);
    expect(room.players[0].socketId).toBe('socket_1_new');
  });

  // 18. Preventing one player from seeing another player's cards
  it('Scenario 18: prevents one player from seeing other players cards in public state', () => {
    const room = new GameRoom({
      roomCode: 'TEST15',
      hostId: 'p1',
      deckCount: 1,
      maxPlayers: 2,
      minPlayers: 2,
      isPrivate: true,
    });
    room.addPlayer('p1', 'P1');
    room.addPlayer('p2', 'P2');
    room.startGame('p1');

    // P1 requests their view
    const p1State = room.getPublicState('p1');
    expect(p1State.myHand.length).toBeGreaterThan(0);
    expect(p1State.myHand[0].rank).toBeDefined();

    // In the public players list, card details are completely absent, only cardCount is present
    const p2Public = p1State.players.find(p => p.id === 'p2')!;
    expect(p2Public.cardCount).toBeGreaterThan(0);
    expect((p2Public as any).cards).toBeUndefined();

    // P2 requests their view
    const p2State = room.getPublicState('p2');
    expect(p2State.myHand.length).toBeGreaterThan(0);
    const p1Public = p2State.players.find(p => p.id === 'p1')!;
    expect(p1Public.cardCount).toBeGreaterThan(0);
    expect((p1Public as any).cards).toBeUndefined();
  });

  // 19. Handling multiple decks with duplicate rank-and-suit combinations
  it('Scenario 19: handles multiple decks with unique card IDs despite duplicate rank/suit', () => {
    const decks = createDecks(3); // 3 decks = 156 cards
    expect(decks.length).toBe(156);

    const ids = new Set(decks.map(c => c.id));
    expect(ids.size).toBe(156); // All 156 IDs are strictly unique

    const aceSpades = decks.filter(c => c.rank === 'A' && c.suit === 'spades');
    expect(aceSpades.length).toBe(3);
    expect(aceSpades[0].deckIndex).toBe(0);
    expect(aceSpades[1].deckIndex).toBe(1);
    expect(aceSpades[2].deckIndex).toBe(2);
  });

  // 20. Supporting a complete multiplayer game from room creation to the winner announcement
  it('Scenario 20: completes a full multiplayer game cycle', () => {
    const room = new GameRoom({
      roomCode: 'FULLGM',
      hostId: 'p1',
      deckCount: 1,
      maxPlayers: 2,
      minPlayers: 2,
      isPrivate: true,
    });
    room.addPlayer('p1', 'Alice');
    room.addPlayer('p2', 'Bob');

    expect(room.status).toBe('waiting');
    room.startGame('p1');
    expect(room.status).toBe('in_progress');

    // Give Alice 1 card, Bob 1 card for a controlled full game scenario
    room.players[0].cards = [{ id: 'alice_c1', rank: 'Q', suit: 'hearts', deckIndex: 0 }];
    room.players[1].cards = [{ id: 'bob_c1', rank: '7', suit: 'clubs', deckIndex: 0 }];
    room.playerOrder = ['p1', 'p2'];
    room.currentTurnIndex = 0;

    // Alice plays Queens
    room.playCards('p1', ['alice_c1'], 'Q');
    expect(room.players[0].cards.length).toBe(0);

    // Bob calls bluff on Alice's play
    const challengeRes = room.challengeBluff('p2', 'alice_c1');
    expect(challengeRes.success).toBe(true);
    expect(challengeRes.result?.wasBluff).toBe(false);

    // Bob collects block, Alice wins!
    expect(room.status).toBe('game_over');
    expect(room.winnerId).toBe('p1');
    const finalState = room.getPublicState('p1');
    expect(finalState.winner?.name).toBe('Alice');

    // Rematch test
    room.resetForRematch();
    expect(room.status).toBe('waiting');
    expect(room.winnerId).toBeNull();
  });
});
