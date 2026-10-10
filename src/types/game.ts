export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export const ALL_SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const ALL_RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const RANK_NAMES: Record<Rank, string> = {
  'A': 'Aces',
  '2': 'Twos',
  '3': 'Threes',
  '4': 'Fours',
  '5': 'Fives',
  '6': 'Sixes',
  '7': 'Sevens',
  '8': 'Eights',
  '9': 'Nines',
  '10': 'Tens',
  'J': 'Jacks',
  'Q': 'Queens',
  'K': 'Kings'
};

export const RANK_SINGULAR_NAMES: Record<Rank, string> = {
  'A': 'Ace',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  'J': 'Jack',
  'Q': 'Queen',
  'K': 'King'
};

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
  deckIndex: number;
}

export interface Player {
  id: string; // Session ID or Player ID
  socketId?: string;
  name: string;
  isHost: boolean;
  isConnected: boolean;
  cards: Card[];
  joinedAt: number;
  isSpectator?: boolean;
  finishPosition?: number;
  finishTitle?: string;
}

export interface PublicPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isConnected: boolean;
  cardCount: number;
  isSpectator: boolean;
  finishPosition?: number;
  finishTitle?: string;
}

export interface FinishingPosition {
  playerId: string;
  playerName: string;
  position: number;
  title?: string;
  isLastStanding?: boolean;
}

export interface Contribution {
  id: string;
  playerId: string;
  playerName: string;
  cardCount: number;
  declaredRank: Rank;
  timestamp: number;
  // Card IDs are public, but actual Card rank/suit are hidden on server until revealed
  cardIds: string[];
}

export interface ServerContribution extends Contribution {
  cards: Card[];
}

export interface RevealedChallengeCard {
  card: Card;
  declaredRank: Rank;
  wasBluff: boolean;
  challengerId: string;
  challengerName: string;
  challengedPlayerId: string;
  challengedPlayerName: string;
  penaltyTargetId: string;
  penaltyTargetName: string;
  cardsAwardedCount: number;
}

export type GameStatus = 'waiting' | 'in_progress' | 'game_over';

export interface GameEventLog {
  id: string;
  type: 'join' | 'leave' | 'start' | 'play' | 'pass' | 'challenge' | 'round_reset' | 'win';
  message: string;
  timestamp: number;
  playerId?: string;
}

export interface RoomConfig {
  roomCode: string;
  hostId: string;
  deckCount: number;
  maxPlayers: number;
  minPlayers: number;
  isPrivate: boolean;
}

export interface FullGameState {
  roomCode: string;
  config: RoomConfig;
  status: GameStatus;
  players: Player[];
  playerOrder: string[]; // player IDs
  currentTurnIndex: number;
  activeRank: Rank | null;
  lastPlay: ServerContribution | null;
  contributions: ServerContribution[];
  blockCards: Card[];
  lastPlayerToPlayId: string | null;
  consecutivePasses: number;
  winnerId: string | null;
  finishingPositions: FinishingPosition[];
  lastRevealedChallenge: RevealedChallengeCard | null;
  eventLogs: GameEventLog[];
  createdAt: number;
  updatedAt: number;
}

export interface PublicGameState {
  roomCode: string;
  config: RoomConfig;
  status: GameStatus;
  players: PublicPlayer[];
  playerOrder: string[];
  currentTurnPlayerId: string | null;
  activeRank: Rank | null;
  lastPlay: Contribution | null;
  contributions: Contribution[];
  totalBlockCards: number;
  lastPlayerToPlayId: string | null;
  consecutivePasses: number;
  winner: PublicPlayer | null;
  finishingPositions: FinishingPosition[];
  lastRevealedChallenge: RevealedChallengeCard | null;
  eventLogs: GameEventLog[];
  myHand: Card[];
  isMyTurn: boolean;
  myPlayerId: string;
  isSpectator: boolean;
  activePlayersCount: number;
  version?: number;
}

export interface CreateRoomDto {
  playerName: string;
  deckCount: number;
  maxPlayers?: number;
  minPlayers?: number;
}

export interface JoinRoomDto {
  roomCode: string;
  playerName: string;
  sessionToken?: string;
}

export interface PlayCardsDto {
  cardIds: string[];
  declaredRank?: Rank; // Required if activeRank is null
}

export interface ChallengeBluffDto {
  selectedCardId: string;
}

export interface ActiveRoomSummary {
  roomCode: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  deckCount: number;
  status: 'waiting';
  createdAt: number;
}
