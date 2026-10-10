/**
 * BLUFF Game - Custom Finishing Titles
 *
 * Maps server-authoritative elimination positions (1 .. N) to fun, personality-driven titles.
 *
 * Priority Rules:
 * 1. Final position (position === N): 'Bro is Not Him' (compulsory)
 * 2. Second-to-last position (position === N - 1): 'Clutch God' (compulsory)
 * 3. Positions 1 through 5 (when not reserved for the final two):
 *    1 -> 'Main Character Energy'
 *    2 -> 'The Silver Surfer'
 *    3 -> 'Bronze-Tier Flex'
 *    4 -> 'Honorable Mention'
 *    5 -> 'I Was Top 5!'
 * 4. Any position between 5th and second-to-last: 'Not worth my time'
 */

export const TITLES = {
  MAIN_CHARACTER: 'Main Character Energy',
  SILVER_SURFER: 'The Silver Surfer',
  BRONZE_FLEX: 'Bronze-Tier Flex',
  HONORABLE_MENTION: 'Honorable Mention',
  TOP_FIVE: 'I Was Top 5!',
  NOT_WORTH_TIME: 'Not worth my time',
  CLUTCH_GOD: 'Clutch God',
  NOT_HIM: 'Bro is Not Him',
} as const;

export type FinishingTitle = typeof TITLES[keyof typeof TITLES];

/**
 * Assigns a custom title dynamically based on finishing position and total players.
 *
 * @param position 1-based finishing position (1 is first eliminated, N is last standing)
 * @param totalPlayers Total number of players N in the completed game
 */
export function getFinishingTitle(position: number, totalPlayers: number): string {
  if (totalPlayers < 2) {
    return TITLES.MAIN_CHARACTER;
  }

  // 1. Mandatory Priority 1: Last place (N)
  if (position === totalPlayers) {
    return TITLES.NOT_HIM;
  }

  // 2. Mandatory Priority 2: Second-to-last place (N - 1)
  if (position === totalPlayers - 1) {
    return TITLES.CLUTCH_GOD;
  }

  // 3. Top-5 positions (evaluated after the mandatory final two)
  switch (position) {
    case 1:
      return TITLES.MAIN_CHARACTER;
    case 2:
      return TITLES.SILVER_SURFER;
    case 3:
      return TITLES.BRONZE_FLEX;
    case 4:
      return TITLES.HONORABLE_MENTION;
    case 5:
      return TITLES.TOP_FIVE;
    default:
      // 4. Every position between 5th place and second-to-last
      return TITLES.NOT_WORTH_TIME;
  }
}

export interface TitleVisualConfig {
  title: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  glowClass?: string;
  cardBorder: string;
  tagline: string;
  iconName: 'Sparkles' | 'Award' | 'Medal' | 'Shield' | 'Flame' | 'Clock' | 'Zap' | 'Skull';
}

export function getTitleVisualConfig(title: string): TitleVisualConfig {
  switch (title) {
    case TITLES.MAIN_CHARACTER:
      return {
        title,
        badgeBg: 'bg-amber-500/20',
        badgeBorder: 'border-amber-400/60',
        badgeText: 'text-amber-300',
        glowClass: 'shadow-glow-gold',
        cardBorder: 'border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-950/20 to-slate-900/80',
        tagline: 'Protagonist status unlocked',
        iconName: 'Sparkles',
      };
    case TITLES.SILVER_SURFER:
      return {
        title,
        badgeBg: 'bg-slate-300/20',
        badgeBorder: 'border-slate-300/50',
        badgeText: 'text-slate-200',
        cardBorder: 'border-slate-400/40 bg-gradient-to-r from-slate-300/10 to-slate-900/80',
        tagline: 'Clean runner-up finish',
        iconName: 'Award',
      };
    case TITLES.BRONZE_FLEX:
      return {
        title,
        badgeBg: 'bg-amber-800/25',
        badgeBorder: 'border-amber-700/50',
        badgeText: 'text-amber-400',
        cardBorder: 'border-amber-700/40 bg-gradient-to-r from-amber-800/10 to-slate-900/80',
        tagline: 'Secured the podium',
        iconName: 'Medal',
      };
    case TITLES.HONORABLE_MENTION:
      return {
        title,
        badgeBg: 'bg-indigo-950/60',
        badgeBorder: 'border-indigo-600/50',
        badgeText: 'text-indigo-300',
        cardBorder: 'border-indigo-700/40 bg-slate-900/80',
        tagline: 'Respectable performance',
        iconName: 'Shield',
      };
    case TITLES.TOP_FIVE:
      return {
        title,
        badgeBg: 'bg-cyan-950/60',
        badgeBorder: 'border-cyan-500/50',
        badgeText: 'text-cyan-300',
        cardBorder: 'border-cyan-700/40 bg-slate-900/80',
        tagline: 'Made the leaderboard',
        iconName: 'Flame',
      };
    case TITLES.NOT_WORTH_TIME:
      return {
        title,
        badgeBg: 'bg-slate-800/60',
        badgeBorder: 'border-slate-700/50',
        badgeText: 'text-slate-400',
        cardBorder: 'border-slate-800 bg-slate-900/60',
        tagline: 'Barely broke a sweat',
        iconName: 'Clock',
      };
    case TITLES.CLUTCH_GOD:
      return {
        title,
        badgeBg: 'bg-gradient-to-r from-purple-500/25 to-fuchsia-500/20',
        badgeBorder: 'border-purple-400/60',
        badgeText: 'text-fuchsia-300',
        glowClass: 'shadow-purple-900/30',
        cardBorder: 'border-purple-500/50 bg-gradient-to-r from-purple-950/30 to-slate-900/80',
        tagline: 'Survived till the very final round',
        iconName: 'Zap',
      };
    case TITLES.NOT_HIM:
      return {
        title,
        badgeBg: 'bg-rose-950/70',
        badgeBorder: 'border-rose-600/60',
        badgeText: 'text-rose-400',
        cardBorder: 'border-rose-600/50 bg-gradient-to-r from-rose-950/30 to-slate-900/80',
        tagline: 'Last player standing defeat',
        iconName: 'Skull',
      };
    default:
      return {
        title,
        badgeBg: 'bg-slate-800/60',
        badgeBorder: 'border-slate-700/50',
        badgeText: 'text-slate-300',
        cardBorder: 'border-slate-800 bg-slate-900/80',
        tagline: 'Final result',
        iconName: 'Award',
      };
  }
}
