import {
  Card,
  Rank,
  Player,
  PublicPlayer,
  Contribution,
  ServerContribution,
  RevealedChallengeCard,
  GameStatus,
  GameEventLog,
  RoomConfig,
  PublicGameState,
  FinishingPosition,
  RANK_NAMES,
  RANK_SINGULAR_NAMES,
} from '../types/game';
import { createDecks, shuffleCards, distributeCards, sortHand } from './deck';
import { getFinishingTitle } from '../utils/titles';

export class GameRoom {
  public roomCode: string;
  public config: RoomConfig;
  public status: GameStatus = 'waiting';
  public players: Player[] = [];
  public playerOrder: string[] = []; // Array of player IDs in circular turn order
  public currentTurnIndex: number = 0;
  public activeRank: Rank | null = null;
  public lastPlay: ServerContribution | null = null;
  public contributions: ServerContribution[] = [];
  public blockCards: Card[] = [];
  public lastPlayerToPlayId: string | null = null;
  public consecutivePasses: number = 0;
  public winnerId: string | null = null;
  public finishingPositions: FinishingPosition[] = [];
  public lastRevealedChallenge: RevealedChallengeCard | null = null;
  public eventLogs: GameEventLog[] = [];
  public isResolvingChallenge: boolean = false;
  public createdAt: number;
  public updatedAt: number;

  constructor(config: RoomConfig) {
    this.roomCode = config.roomCode;
    this.config = {
      roomCode: config.roomCode,
      hostId: config.hostId,
      deckCount: Math.max(1, Math.min(5, config.deckCount || 1)),
      maxPlayers: Math.max(2, Math.min(10, config.maxPlayers || 6)),
      minPlayers: Math.max(2, config.minPlayers || 2),
      isPrivate: config.isPrivate ?? true,
    };
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
  }

  // --- Player Management ---

  public addPlayer(id: string, name: string, socketId?: string): { success: boolean; error?: string } {
    if (this.status !== 'waiting') {
      return { success: false, error: 'Game has already started' };
    }

    const cleanName = name.trim().slice(0, 20) || `Player ${this.players.length + 1}`;

    const existingPlayer = this.players.find(p => p.id === id);
    if (existingPlayer) {
      existingPlayer.socketId = socketId;
      existingPlayer.isConnected = true;
      existingPlayer.name = cleanName;
      this.touch();
      return { success: true };
    }

    if (this.players.length >= this.config.maxPlayers) {
      return { success: false, error: 'Room is full' };
    }

    const isHost = this.players.length === 0 || this.config.hostId === id;
    if (isHost) {
      this.config.hostId = id;
    }

    const newPlayer: Player = {
      id,
      socketId,
      name: cleanName,
      isHost,
      isConnected: true,
      cards: [],
      joinedAt: Date.now(),
      isSpectator: false,
    };

    this.players.push(newPlayer);
    this.addLog('join', `${newPlayer.name} joined the room.`, id);
    this.touch();
    return { success: true };
  }

  public removePlayer(id: string): { success: boolean; roomEmpty: boolean } {
    const playerIndex = this.players.findIndex(p => p.id === id);
    if (playerIndex === -1) {
      return { success: false, roomEmpty: this.players.length === 0 };
    }

    const player = this.players[playerIndex];

    if (this.status === 'waiting') {
      this.players.splice(playerIndex, 1);
      this.addLog('leave', `${player.name} left the room.`, id);

      if (this.players.length === 0) {
        return { success: true, roomEmpty: true };
      }

      if (player.isHost && this.players.length > 0) {
        this.players[0].isHost = true;
        this.config.hostId = this.players[0].id;
        this.addLog('join', `${this.players[0].name} is now the host.`, this.players[0].id);
      }
    } else {
      // In-game disconnection/abandonment
      player.isConnected = false;
      this.addLog('leave', `${player.name} disconnected.`, id);
    }

    this.touch();
    return { success: true, roomEmpty: this.players.length === 0 };
  }

  public reconnectPlayer(id: string, socketId: string): { success: boolean; error?: string } {
    const player = this.players.find(p => p.id === id);
    if (!player) {
      return { success: false, error: 'Player not found in this room' };
    }

    player.socketId = socketId;
    player.isConnected = true;
    this.addLog('join', `${player.name} reconnected.`, id);
    this.touch();
    return { success: true };
  }

  public markDisconnected(socketId: string): void {
    const player = this.players.find(p => p.socketId === socketId);
    if (player) {
      player.isConnected = false;
      this.addLog('leave', `${player.name} disconnected.`, player.id);
      this.touch();
    }
  }

  // --- Game Lifecycle ---

  public startGame(requesterId: string): { success: boolean; error?: string } {
    if (this.status !== 'waiting') {
      return { success: false, error: 'Game has already started' };
    }

    if (this.config.hostId !== requesterId) {
      return { success: false, error: 'Only the host can start the game' };
    }

    if (this.players.length < this.config.minPlayers) {
      return { success: false, error: `At least ${this.config.minPlayers} players are required to start` };
    }

    // Initialize decks & deal
    const deck = createDecks(this.config.deckCount);
    const shuffled = shuffleCards(deck);
    const hands = distributeCards(shuffled, this.players.length);

    this.playerOrder = this.players.map(p => p.id);
    this.finishingPositions = [];
    this.players.forEach((p, index) => {
      p.cards = hands[index];
      p.isSpectator = false;
      delete p.finishPosition;
      delete p.finishTitle;
    });

    this.status = 'in_progress';
    this.currentTurnIndex = Math.floor(Math.random() * this.players.length);
    this.activeRank = null;
    this.lastPlay = null;
    this.contributions = [];
    this.blockCards = [];
    this.lastPlayerToPlayId = null;
    this.consecutivePasses = 0;
    this.winnerId = null;
    this.lastRevealedChallenge = null;
    this.isResolvingChallenge = false;

    const startingPlayer = this.getCurrentPlayer();
    this.addLog('start', `Game started with ${this.config.deckCount} deck(s). ${startingPlayer?.name} goes first!`);
    this.touch();
    return { success: true };
  }

  // --- Turn Operations ---

  public getActivePlayers(): Player[] {
    return this.players.filter(p => !p.isSpectator);
  }

  public getNextActivePlayerId(fromPlayerId?: string | null): string | null {
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length === 0) return null;

    let startIndex = 0;
    if (fromPlayerId) {
      const idx = this.playerOrder.indexOf(fromPlayerId);
      if (idx !== -1) startIndex = idx;
    }

    for (let step = 1; step <= this.playerOrder.length; step++) {
      const nextIdx = (startIndex + step) % this.playerOrder.length;
      const candidateId = this.playerOrder[nextIdx];
      const player = this.players.find(p => p.id === candidateId);
      if (player && !player.isSpectator) {
        return candidateId;
      }
    }

    return activePlayers[0].id;
  }

  public getCurrentPlayer(): Player | null {
    if (this.playerOrder.length === 0) return null;
    const currentId = this.playerOrder[this.currentTurnIndex];
    const player = this.players.find(p => p.id === currentId);
    if (player && !player.isSpectator) return player;

    const nextActiveId = this.getNextActivePlayerId(currentId);
    if (nextActiveId) {
      this.currentTurnIndex = this.playerOrder.indexOf(nextActiveId);
      return this.players.find(p => p.id === nextActiveId) || null;
    }
    return null;
  }

  public playCards(
    playerId: string,
    cardIds: string[],
    declaredRank?: Rank
  ): { success: boolean; error?: string } {
    if (this.status !== 'in_progress') {
      return { success: false, error: 'Game is not in progress' };
    }

    if (this.isResolvingChallenge) {
      return { success: false, error: 'Cannot play cards during bluff resolution' };
    }

    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer || currentPlayer.id !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (currentPlayer.isSpectator) {
      return { success: false, error: 'Spectators cannot play cards' };
    }

    if (!cardIds || cardIds.length === 0) {
      return { success: false, error: 'Must select at least one card to play' };
    }

    // Determine and validate declared rank
    let finalRank: Rank;
    if (this.activeRank === null) {
      if (!declaredRank) {
        return { success: false, error: 'Must declare a rank when starting a new round' };
      }
      finalRank = declaredRank;
    } else {
      if (declaredRank && declaredRank !== this.activeRank) {
        return { success: false, error: `Must play as declared rank: ${RANK_NAMES[this.activeRank]}` };
      }
      finalRank = this.activeRank;
    }

    // Validate player owns all selected cards
    const playerCardMap = new Map<string, Card>();
    currentPlayer.cards.forEach(c => playerCardMap.set(c.id, c));

    const selectedCards: Card[] = [];
    for (const id of cardIds) {
      const card = playerCardMap.get(id);
      if (!card) {
        return { success: false, error: 'You do not hold one or more of the selected cards' };
      }
      selectedCards.push(card);
    }

    // 1. Check Special Two-Player Endgame Rule BEFORE removing current player's cards:
    // If exactly 2 active players remain, and the player who made the last play currently has 0 cards,
    // and the other active player adds cards into the block instead of challenging,
    // the player with 0 cards immediately wins under the intended two-player endgame rule!
    const activePlayersBeforePlay = this.getActivePlayers();
    if (activePlayersBeforePlay.length === 2 && this.lastPlay) {
      const lastPlayPlayerId = this.lastPlay.playerId;
      if (lastPlayPlayerId !== currentPlayer.id) {
        const lastPlayPlayer = activePlayersBeforePlay.find(p => p.id === lastPlayPlayerId);
        if (lastPlayPlayer && lastPlayPlayer.cards.length === 0) {
          // Remove played cards from currentPlayer
          const selectedSet = new Set(cardIds);
          currentPlayer.cards = currentPlayer.cards.filter(c => !selectedSet.has(c.id));
          this.blockCards.push(...selectedCards);

          // Player with 0 cards wins immediately!
          const nextPos = this.finishingPositions.length + 1;
          lastPlayPlayer.isSpectator = true;
          lastPlayPlayer.finishPosition = nextPos;
          this.finishingPositions.push({
            playerId: lastPlayPlayer.id,
            playerName: lastPlayPlayer.name,
            position: nextPos,
          });

          const lastPos = this.finishingPositions.length + 1;
          currentPlayer.finishPosition = lastPos;
          this.finishingPositions.push({
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            position: lastPos,
            isLastStanding: true,
          });

          this.winnerId = this.finishingPositions[0].playerId;
          this.status = 'game_over';
          this.finalizeTitles();

          this.addLog(
            'win',
            `🏆 ${lastPlayPlayer.name} has no cards left and wins the game under the two-player final-card victory rule!`,
            lastPlayPlayer.id
          );
          this.touch();
          return { success: true };
        }
      }
    }

    // Remove cards from player's hand
    const selectedSet = new Set(cardIds);
    currentPlayer.cards = currentPlayer.cards.filter(c => !selectedSet.has(c.id));

    // Create contribution
    const contribution: ServerContribution = {
      id: `contrib_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      cardCount: selectedCards.length,
      declaredRank: finalRank,
      timestamp: Date.now(),
      cardIds: selectedCards.map(c => c.id),
      cards: selectedCards,
    };

    this.activeRank = finalRank;
    this.lastPlay = contribution;
    this.contributions.push(contribution);
    this.blockCards.push(...selectedCards);
    this.lastPlayerToPlayId = currentPlayer.id;
    this.consecutivePasses = 0;
    this.lastRevealedChallenge = null;

    const rankName = selectedCards.length === 1 ? RANK_SINGULAR_NAMES[finalRank] : RANK_NAMES[finalRank];
    this.addLog(
      'play',
      `${currentPlayer.name} played ${selectedCards.length} card${selectedCards.length > 1 ? 's' : ''} and declared ${rankName}.${currentPlayer.cards.length === 0 ? ' (Played final card!)' : ''}`,
      currentPlayer.id
    );

    // Note: Do NOT mark currentPlayer as spectator yet.
    // They remain active until the round resolves (e.g. challenged or all pass).

    // Advance turn to next active player
    this.advanceTurn();
    this.touch();
    return { success: true };
  }

  public passTurn(playerId: string): { success: boolean; error?: string } {
    if (this.status !== 'in_progress') {
      return { success: false, error: 'Game is not in progress' };
    }

    if (this.isResolvingChallenge) {
      return { success: false, error: 'Cannot pass during bluff resolution' };
    }

    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer || currentPlayer.id !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (currentPlayer.isSpectator) {
      return { success: false, error: 'Spectators cannot pass turn' };
    }

    if (this.activeRank === null || !this.lastPlay) {
      return { success: false, error: 'Cannot pass on an empty table; you must start the round by playing cards' };
    }

    this.consecutivePasses += 1;
    this.addLog('pass', `${currentPlayer.name} passed.`, currentPlayer.id);

    // If every active player passes consecutively without anyone adding cards or calling bluff:
    const activePlayers = this.getActivePlayers();
    if (this.consecutivePasses >= activePlayers.length) {
      // Clear block without awarding to anyone
      const discardedCount = this.blockCards.length;
      this.blockCards = [];
      this.contributions = [];
      this.lastPlay = null;
      this.activeRank = null;
      this.consecutivePasses = 0;

      this.addLog(
        'round_reset',
        `All players passed. The central block of ${discardedCount} card(s) was cleared.`
      );

      // Stage B & C: Determine spectator eligibility after round resolution
      const isGameOver = this.checkAndResolveSpectators();

      // If game is over, stop turn transitions
      if (isGameOver) {
        this.touch();
        return { success: true };
      }

      // The player who made the most recent card play into the block retains turn if still active
      if (this.lastPlayerToPlayId) {
        const lastPlayer = this.players.find(p => p.id === this.lastPlayerToPlayId);
        if (lastPlayer && !lastPlayer.isSpectator) {
          this.currentTurnIndex = this.playerOrder.indexOf(this.lastPlayerToPlayId);
        } else {
          const nextActiveId = this.getNextActivePlayerId(this.lastPlayerToPlayId);
          if (nextActiveId) {
            this.currentTurnIndex = this.playerOrder.indexOf(nextActiveId);
          }
        }
      }

      this.touch();
      return { success: true };
    }

    // Advance turn to next active player
    this.advanceTurn();
    this.touch();
    return { success: true };
  }

  public challengeBluff(
    challengerId: string,
    selectedCardId: string
  ): { success: boolean; error?: string; result?: RevealedChallengeCard } {
    if (this.status !== 'in_progress') {
      return { success: false, error: 'Game is not in progress' };
    }

    if (this.isResolvingChallenge) {
      return { success: false, error: 'A challenge is already in progress' };
    }

    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer || currentPlayer.id !== challengerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (currentPlayer.isSpectator) {
      return { success: false, error: 'Spectators cannot challenge' };
    }

    if (!this.lastPlay || this.activeRank === null) {
      return { success: false, error: 'No play available to challenge' };
    }

    if (this.lastPlay.playerId === challengerId) {
      return { success: false, error: 'You cannot challenge your own play' };
    }

    // Find the selected card in the last play
    const targetCard = this.lastPlay.cards.find(c => c.id === selectedCardId);
    if (!targetCard) {
      return { success: false, error: 'Selected card does not belong to the most recent play' };
    }

    this.isResolvingChallenge = true;

    const challengedPlayer = this.players.find(p => p.id === this.lastPlay!.playerId);
    const declaredRank = this.activeRank;
    const wasBluff = targetCard.rank !== declaredRank;

    let penaltyPlayer: Player;
    let nextTurnPlayerId: string;

    if (wasBluff) {
      // Challenge succeeds! Challenged player gets all cards
      penaltyPlayer = challengedPlayer!;
      nextTurnPlayerId = challengerId; // Successful challenger starts next round
    } else {
      // Challenge fails! Challenger gets all cards
      penaltyPlayer = currentPlayer;
      nextTurnPlayerId = challengedPlayer!.id; // Challenged player starts next round
    }

    const awardedCount = this.blockCards.length;
    // Award all block cards to penalty player
    penaltyPlayer.cards.push(...this.blockCards);
    penaltyPlayer.cards = sortHand(penaltyPlayer.cards);

    const result: RevealedChallengeCard = {
      card: targetCard,
      declaredRank,
      wasBluff,
      challengerId,
      challengerName: currentPlayer.name,
      challengedPlayerId: challengedPlayer!.id,
      challengedPlayerName: challengedPlayer!.name,
      penaltyTargetId: penaltyPlayer.id,
      penaltyTargetName: penaltyPlayer.name,
      cardsAwardedCount: awardedCount,
    };

    this.lastRevealedChallenge = result;

    if (wasBluff) {
      this.addLog(
        'challenge',
        `BLUFF! ${currentPlayer.name} challenged ${challengedPlayer!.name}. Revealed card was ${targetCard.rank} of ${targetCard.suit} (declared ${RANK_NAMES[declaredRank]}). ${challengedPlayer!.name} collected ${awardedCount} cards!`,
        challengerId
      );
    } else {
      this.addLog(
        'challenge',
        `TRUTH! ${currentPlayer.name} challenged ${challengedPlayer!.name}. Revealed card was ${targetCard.rank} of ${targetCard.suit} (matched ${RANK_NAMES[declaredRank]}). ${currentPlayer.name} collected ${awardedCount} cards!`,
        challengerId
      );
    }

    // Reset block and active rank for new round
    this.blockCards = [];
    this.contributions = [];
    this.lastPlay = null;
    this.activeRank = null;
    this.consecutivePasses = 0;
    this.lastPlayerToPlayId = null;
    this.isResolvingChallenge = false;

    // Stage B & C: Determine spectator eligibility after round resolution
    const isGameOver = this.checkAndResolveSpectators();

    if (!isGameOver) {
      // Set next turn player (must be active)
      const nextPlayer = this.players.find(p => p.id === nextTurnPlayerId);
      if (nextPlayer && !nextPlayer.isSpectator) {
        this.currentTurnIndex = this.playerOrder.indexOf(nextTurnPlayerId);
      } else {
        const nextActiveId = this.getNextActivePlayerId(nextTurnPlayerId);
        if (nextActiveId) {
          this.currentTurnIndex = this.playerOrder.indexOf(nextActiveId);
        }
      }
    }

    this.touch();
    return { success: true, result };
  }

  // --- Spectator & Elimination Lifecycle ---

  private formatOrdinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  private checkAndResolveSpectators(): boolean {
    // Only resolve spectators when the round is completed (block is 0 cards)
    if (this.blockCards.length > 0) return false;

    const activePlayers = this.getActivePlayers();
    for (const player of activePlayers) {
      if (player.cards.length === 0 && !player.isSpectator) {
        player.isSpectator = true;
        const pos = this.finishingPositions.length + 1;
        player.finishPosition = pos;
        this.finishingPositions.push({
          playerId: player.id,
          playerName: player.name,
          position: pos,
        });
        this.addLog(
          'win',
          `🎉 ${player.name} finished all cards! (${this.formatOrdinal(pos)} Place) and is now spectating.`,
          player.id
        );
      }
    }

    return this.checkGameOver();
  }

  public checkGameOver(): boolean {
    if (this.status !== 'in_progress') return false;

    const activePlayers = this.getActivePlayers();

    // If exactly 1 player remains active, they are the Last Player Standing (last position)
    if (activePlayers.length <= 1) {
      if (activePlayers.length === 1) {
        const survivor = activePlayers[0];
        this.status = 'game_over';
        const finalPos = this.players.length;
        survivor.finishPosition = finalPos;
        this.finishingPositions.push({
          playerId: survivor.id,
          playerName: survivor.name,
          position: finalPos,
          isLastStanding: true,
        });
        this.addLog(
          'win',
          `👑 ${survivor.name} is the last player standing. Match complete!`,
          survivor.id
        );
      } else {
        this.status = 'game_over';
      }

      // The overall winner is the 1st place finisher (first player to empty their cards)
      if (this.finishingPositions.length > 0) {
        this.winnerId = this.finishingPositions[0].playerId;
      }

      this.finalizeTitles();
      return true;
    }

    return false;
  }

  private finalizeTitles(): void {
    const totalPlayers = this.players.length;
    this.finishingPositions.forEach(fp => {
      fp.title = getFinishingTitle(fp.position, totalPlayers);
      const p = this.players.find(pl => pl.id === fp.playerId);
      if (p) {
        p.finishTitle = fp.title;
      }
    });
  }

  public checkAndApplyWinner(): boolean {
    return this.checkGameOver();
  }

  public resetForRematch(): { success: boolean; error?: string } {
    if (this.status !== 'game_over') {
      return { success: false, error: 'Game is not over' };
    }

    this.status = 'waiting';
    this.activeRank = null;
    this.lastPlay = null;
    this.contributions = [];
    this.blockCards = [];
    this.lastPlayerToPlayId = null;
    this.consecutivePasses = 0;
    this.winnerId = null;
    this.lastRevealedChallenge = null;
    this.isResolvingChallenge = false;
    this.finishingPositions = [];
    this.players.forEach(p => {
      p.cards = [];
      p.isSpectator = false;
      delete p.finishPosition;
      delete p.finishTitle;
    });

    // Ensure host identity is valid
    const hostPlayer = this.players.find(p => p.id === this.config.hostId) || this.players.find(p => p.isHost);
    if (hostPlayer) {
      this.config.hostId = hostPlayer.id;
      this.players.forEach(p => { p.isHost = (p.id === hostPlayer.id); });
    } else if (this.players.length > 0) {
      this.config.hostId = this.players[0].id;
      this.players[0].isHost = true;
    }

    this.addLog('start', 'Room reset for a new game. All players restored to active status.');
    this.touch();
    return { success: true };
  }

  // --- Helpers ---

  private advanceTurn(): void {
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length === 0) return;

    let nextIndex = (this.currentTurnIndex + 1) % this.playerOrder.length;
    let attempts = 0;
    while (attempts < this.playerOrder.length) {
      const candidateId = this.playerOrder[nextIndex];
      const player = this.players.find(p => p.id === candidateId);
      if (player && !player.isSpectator) {
        this.currentTurnIndex = nextIndex;
        return;
      }
      nextIndex = (nextIndex + 1) % this.playerOrder.length;
      attempts++;
    }
  }

  private addLog(type: GameEventLog['type'], message: string, playerId?: string): void {
    this.eventLogs.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      message,
      timestamp: Date.now(),
      playerId,
    });
    // Keep max 50 logs
    if (this.eventLogs.length > 50) {
      this.eventLogs.shift();
    }
  }

  private touch(): void {
    this.updatedAt = Date.now();
  }

  // --- State Filter for Clients (Security & Card Privacy) ---

  public getPublicState(requestingPlayerId?: string): PublicGameState {
    const publicPlayers: PublicPlayer[] = this.players.map(p => ({
      id: p.id,
      name: p.name,
      isHost: p.id === this.config.hostId || p.isHost,
      isConnected: p.isConnected,
      cardCount: p.cards.length,
      isSpectator: !!p.isSpectator,
      finishPosition: p.finishPosition,
      finishTitle: p.finishTitle,
    }));

    const currentTurnPlayer = this.getCurrentPlayer();
    const requestingPlayer = this.players.find(p => p.id === requestingPlayerId);
    const winnerPlayer = this.players.find(p => p.id === this.winnerId);

    // Sanitize contributions (hide actual cards, expose cardIds and declared ranks)
    const publicContributions: Contribution[] = this.contributions.map(c => ({
      id: c.id,
      playerId: c.playerId,
      playerName: c.playerName,
      cardCount: c.cardCount,
      declaredRank: c.declaredRank,
      timestamp: c.timestamp,
      cardIds: c.cardIds,
    }));

    const publicLastPlay: Contribution | null = this.lastPlay
      ? {
          id: this.lastPlay.id,
          playerId: this.lastPlay.playerId,
          playerName: this.lastPlay.playerName,
          cardCount: this.lastPlay.cardCount,
          declaredRank: this.lastPlay.declaredRank,
          timestamp: this.lastPlay.timestamp,
          cardIds: this.lastPlay.cardIds,
        }
      : null;

    return {
      roomCode: this.roomCode,
      config: { ...this.config },
      status: this.status,
      players: publicPlayers,
      playerOrder: [...this.playerOrder],
      currentTurnPlayerId: currentTurnPlayer ? currentTurnPlayer.id : null,
      activeRank: this.activeRank,
      lastPlay: publicLastPlay,
      contributions: publicContributions,
      totalBlockCards: this.blockCards.length,
      lastPlayerToPlayId: this.lastPlayerToPlayId,
      consecutivePasses: this.consecutivePasses,
      winner: winnerPlayer
        ? {
            id: winnerPlayer.id,
            name: winnerPlayer.name,
            isHost: winnerPlayer.id === this.config.hostId || winnerPlayer.isHost,
            isConnected: winnerPlayer.isConnected,
            cardCount: winnerPlayer.cards.length,
            isSpectator: !!winnerPlayer.isSpectator,
            finishPosition: winnerPlayer.finishPosition,
            finishTitle: winnerPlayer.finishTitle,
          }
        : null,
      finishingPositions: [...this.finishingPositions],
      lastRevealedChallenge: this.lastRevealedChallenge,
      eventLogs: [...this.eventLogs],
      myHand: requestingPlayer && !requestingPlayer.isSpectator ? [...requestingPlayer.cards] : [],
      isMyTurn: currentTurnPlayer?.id === requestingPlayerId && this.status === 'in_progress' && !requestingPlayer?.isSpectator,
      myPlayerId: requestingPlayerId || '',
      isSpectator: !!requestingPlayer?.isSpectator,
      activePlayersCount: this.getActivePlayers().length,
    };
  }
}
