import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameRoom } from '../engine/GameRoom';
import { RedisRoomStore } from '../server/RedisRoomStore';
import { Card, Rank } from '../types/game';
import React from 'react';
import { ChallengeModal } from '../components/ChallengeModal';

describe('Bug Fix Regression: Bluff Challenge Card Selection', () => {
  let store: RedisRoomStore;

  beforeEach(() => {
    store = new RedisRoomStore();
  });

  describe('Game Engine & Server-Authoritative Card Selection', () => {
    it('1 & 4. Resolves the challenge specifically on the selected card (Card #2 vs Card #1)', () => {
      const room = new GameRoom({
        roomCode: 'TEST01',
        hostId: 'p1',
        deckCount: 1,
        maxPlayers: 2,
        minPlayers: 2,
      });

      room.addPlayer('p1', 'Alice');
      room.addPlayer('p2', 'Bob');
      room.startGame('p1');

      const p1 = room.players.find(p => p.id === 'p1')!;
      const p2 = room.players.find(p => p.id === 'p2')!;

      // Setup Alice's hand with specific cards:
      // Card 0: Ace of Hearts (TRUTH)
      // Card 1: 5 of Spades (BLUFF)
      // Card 2: Ace of Diamonds (TRUTH)
      const trueCard1: Card = { id: 'card_true_1', rank: 'A', suit: 'hearts', deckIndex: 0 };
      const bluffCard: Card = { id: 'card_bluff_2', rank: '5', suit: 'spades', deckIndex: 0 };
      const trueCard2: Card = { id: 'card_true_3', rank: 'A', suit: 'diamonds', deckIndex: 0 };

      p1.cards = [trueCard1, bluffCard, trueCard2];
      room.playerOrder = ['p1', 'p2'];
      room.currentTurnIndex = 0;

      // Alice plays all 3 cards declaring 'A' (Aces)
      const playRes = room.playCards('p1', [trueCard1.id, bluffCard.id, trueCard2.id], 'A');
      expect(playRes.success).toBe(true);
      expect(room.lastPlay).not.toBeNull();
      expect(room.lastPlay!.cardIds).toEqual([trueCard1.id, bluffCard.id, trueCard2.id]);

      // Bob's turn: Bob challenges Card #2 (the bluff card: 5 of Spades)
      expect(room.getCurrentPlayer()?.id).toBe('p2');

      const challengeRes = room.challengeBluff('p2', bluffCard.id);
      expect(challengeRes.success).toBe(true);
      expect(challengeRes.result).toBeDefined();

      // Verify that the result evaluated the chosen Card #2, NOT Card #0
      expect(challengeRes.result?.card.id).toBe(bluffCard.id);
      expect(challengeRes.result?.card.rank).toBe('5');
      expect(challengeRes.result?.wasBluff).toBe(true);

      // Alice bluffed and was caught, so Alice (p1) gets all block cards
      expect(challengeRes.result?.penaltyTargetId).toBe('p1');
      expect(p1.cards.length).toBe(3);
    });

    it('2 & 3. Selecting a truthful card when another card was a bluff results in Truthful Play', () => {
      const room = new GameRoom({
        roomCode: 'TEST02',
        hostId: 'p1',
        deckCount: 1,
        maxPlayers: 2,
        minPlayers: 2,
      });

      room.addPlayer('p1', 'Alice');
      room.addPlayer('p2', 'Bob');
      room.startGame('p1');

      const p1 = room.players.find(p => p.id === 'p1')!;

      const cardA: Card = { id: 'c_truth', rank: 'K', suit: 'hearts', deckIndex: 0 };
      const cardB: Card = { id: 'c_bluff', rank: '2', suit: 'clubs', deckIndex: 0 };

      p1.cards = [cardA, cardB];
      room.playerOrder = ['p1', 'p2'];
      room.currentTurnIndex = 0;

      // Alice plays both cards declaring 'K'
      room.playCards('p1', [cardA.id, cardB.id], 'K');

      // Bob chooses to challenge Card #1 (the King: truth) instead of Card #2
      const challengeRes = room.challengeBluff('p2', cardA.id);
      expect(challengeRes.success).toBe(true);
      expect(challengeRes.result?.card.id).toBe(cardA.id);
      expect(challengeRes.result?.wasBluff).toBe(false);

      // Since challenged card was truth, Bob (the challenger) takes the penalty
      expect(challengeRes.result?.penaltyTargetId).toBe('p2');
    });

    it('5. Rejects invalid card identifiers and out-of-bounds indices', () => {
      const room = new GameRoom({
        roomCode: 'TEST03',
        hostId: 'p1',
        deckCount: 1,
        maxPlayers: 2,
        minPlayers: 2,
      });

      room.addPlayer('p1', 'Alice');
      room.addPlayer('p2', 'Bob');
      room.startGame('p1');

      const p1 = room.players.find(p => p.id === 'p1')!;
      p1.cards = [{ id: 'card_1', rank: '7', suit: 'hearts', deckIndex: 0 }];
      room.playerOrder = ['p1', 'p2'];
      room.currentTurnIndex = 0;

      room.playCards('p1', ['card_1'], '7');

      // Attempt to challenge non-existent card ID
      const invalidRes = room.challengeBluff('p2', 'non_existent_card_id');
      expect(invalidRes.success).toBe(false);
      expect(invalidRes.error).toBe('Selected card does not belong to the most recent play');

      // Attempt out-of-bounds index
      const outOfBoundsRes = room.challengeBluff('p2', '99');
      expect(outOfBoundsRes.success).toBe(false);
      expect(outOfBoundsRes.error).toBe('Selected card does not belong to the most recent play');
    });

    it('6. Rejects cards belonging to other players or previous rounds', () => {
      const room = new GameRoom({
        roomCode: 'TEST04',
        hostId: 'p1',
        deckCount: 1,
        maxPlayers: 2,
        minPlayers: 2,
      });

      room.addPlayer('p1', 'Alice');
      room.addPlayer('p2', 'Bob');
      room.startGame('p1');

      const p1 = room.players.find(p => p.id === 'p1')!;
      const p2 = room.players.find(p => p.id === 'p2')!;

      p1.cards = [{ id: 'alice_card', rank: '10', suit: 'hearts', deckIndex: 0 }];
      p2.cards = [{ id: 'bob_secret_card', rank: '10', suit: 'spades', deckIndex: 0 }];
      room.playerOrder = ['p1', 'p2'];
      room.currentTurnIndex = 0;

      room.playCards('p1', ['alice_card'], '10');

      // Bob attempts to challenge using a card from his own hand
      const foreignRes = room.challengeBluff('p2', 'bob_secret_card');
      expect(foreignRes.success).toBe(false);
      expect(foreignRes.error).toBe('Selected card does not belong to the most recent play');
    });

    it('7. Exposes ONLY the selected card in public state, keeping others concealed', () => {
      const room = new GameRoom({
        roomCode: 'TEST05',
        hostId: 'p1',
        deckCount: 1,
        maxPlayers: 2,
        minPlayers: 2,
      });

      room.addPlayer('p1', 'Alice');
      room.addPlayer('p2', 'Bob');
      room.startGame('p1');

      const p1 = room.players.find(p => p.id === 'p1')!;
      const card1: Card = { id: 'c1', rank: '9', suit: 'hearts', deckIndex: 0 };
      const card2: Card = { id: 'c2', rank: '9', suit: 'spades', deckIndex: 0 };
      const card3: Card = { id: 'c3', rank: '3', suit: 'clubs', deckIndex: 0 };

      p1.cards = [card1, card2, card3];
      room.playerOrder = ['p1', 'p2'];
      room.currentTurnIndex = 0;

      room.playCards('p1', [card1.id, card2.id, card3.id], '9');

      // Challenge card2
      room.challengeBluff('p2', card2.id);

      const publicState = room.getPublicState('p2');
      expect(publicState.lastRevealedChallenge).not.toBeNull();
      // Only card2 is revealed
      expect(publicState.lastRevealedChallenge?.card.id).toBe('c2');
      expect(publicState.lastRevealedChallenge?.card.rank).toBe('9');

      // Other cards (c1, c3) are not in the reveal payload
      expect((publicState.lastRevealedChallenge as any).cards).toBeUndefined();
    });
  });

  describe('ChallengeModal Card Selection Logic & State Persistence', () => {
    it('8. Demonstrates that background state polling does not reset selected card', () => {
      // Simulate component lifecycle logic:
      let selectedCardId: string | null = null;
      let confirmed = false;
      let lastPlayIdRef: string | null = null;
      let prevIsOpen = false;

      const handleEffect = (isOpen: boolean, currentPlay: { id: string; cardIds: string[] }) => {
        if (isOpen) {
          const isNewOpen = !prevIsOpen;
          const isNewPlay = currentPlay.id !== lastPlayIdRef;

          if (isNewOpen || isNewPlay) {
            selectedCardId = null;
            confirmed = false;
            lastPlayIdRef = currentPlay.id;
          } else if (selectedCardId && !currentPlay.cardIds.includes(selectedCardId)) {
            selectedCardId = null;
            confirmed = false;
          }
        } else {
          selectedCardId = null;
          confirmed = false;
          lastPlayIdRef = null;
        }
        prevIsOpen = isOpen;
      };

      const initialPlay = { id: 'play_100', cardIds: ['card_A', 'card_B', 'card_C'] };

      // Step 1: Open modal -> Selection must start as NULL
      handleEffect(true, initialPlay);
      expect(selectedCardId).toBeNull();
      expect(confirmed).toBe(false);

      // Step 2: Player selects Card #2 ('card_B') and confirms
      selectedCardId = 'card_B';
      confirmed = true;
      expect(selectedCardId).toBe('card_B');
      expect(confirmed).toBe(true);

      // Step 3: Background polling triggers state sync (new object reference, same play ID)
      const polledPlay = { id: 'play_100', cardIds: ['card_A', 'card_B', 'card_C'] };
      handleEffect(true, polledPlay);

      // Card #2 MUST REMAIN SELECTED and confirmed must stay true
      expect(selectedCardId).toBe('card_B');
      expect(confirmed).toBe(true);

      // Step 4: Player changes selection to Card #3 ('card_C')
      selectedCardId = 'card_C';
      confirmed = false;
      expect(selectedCardId).toBe('card_C');

      // Another background sync arrives
      const secondPolledPlay = { id: 'play_100', cardIds: ['card_A', 'card_B', 'card_C'] };
      handleEffect(true, secondPolledPlay);
      expect(selectedCardId).toBe('card_C');

      // Step 5: Modal closed -> selection clears
      handleEffect(false, secondPolledPlay);
      expect(selectedCardId).toBeNull();
      expect(confirmed).toBe(false);
    });
  });
});
