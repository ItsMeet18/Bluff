import { Card, Rank, Suit, ALL_RANKS, ALL_SUITS } from '../types/game';

export function createDecks(deckCount: number = 1): Card[] {
  const cards: Card[] = [];
  const safeDeckCount = Math.max(1, Math.min(5, deckCount));

  for (let d = 0; d < safeDeckCount; d++) {
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        cards.push({
          id: `card_${d}_${rank}_${suit}`,
          rank,
          suit,
          deckIndex: d,
        });
      }
    }
  }

  return cards;
}

export function shuffleCards(cards: Card[]): Card[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function distributeCards(cards: Card[], playerCount: number): Card[][] {
  if (playerCount <= 0) return [];
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);

  for (let i = 0; i < cards.length; i++) {
    const playerIndex = i % playerCount;
    hands[playerIndex].push(cards[i]);
  }

  // Sort each player's hand for clean UX
  return hands.map(hand => sortHand(hand));
}

const RANK_VALUES: Record<Rank, number> = {
  'A': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'J': 11,
  'Q': 12,
  'K': 13,
};

const SUIT_VALUES: Record<Suit, number> = {
  'spades': 1,
  'hearts': 2,
  'clubs': 3,
  'diamonds': 4,
};

export function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => {
    const rankDiff = RANK_VALUES[a.rank] - RANK_VALUES[b.rank];
    if (rankDiff !== 0) return rankDiff;
    return SUIT_VALUES[a.suit] - SUIT_VALUES[b.suit];
  });
}
