/**
 * Custom Finishing Titles Mapping for BLUFF Multiplayer Game
 * 
 * | Finishing position | Title |
 * |---|---|
 * | 1st place | Main Character Energy |
 * | 2nd place | The Silver Surfer |
 * | 3rd place | Bronze-Tier Flex |
 * | 4th place | Honorable Mention |
 * | 5th place | I Was Top 5! |
 * | Any position between 6th and second-to-last | Not worth my time |
 * | Second-to-last place | Clutch God |
 * | Last place | Bro is Not Him |
 */

export function getFinishingTitle(position: number, totalPlayers: number): string {
  if (totalPlayers <= 1) {
    return 'Main Character Energy';
  }

  // 1st place
  if (position === 1) {
    return 'Main Character Energy';
  }

  // Last place (only when > 1 player)
  if (position === totalPlayers) {
    return 'Bro is Not Him';
  }

  // Second-to-last place (when totalPlayers >= 3)
  if (position === totalPlayers - 1 && totalPlayers >= 3) {
    return 'Clutch God';
  }

  // Explicit numbered ranks (if not already covered by last / second-to-last)
  if (position === 2) {
    return 'The Silver Surfer';
  }

  if (position === 3) {
    return 'Bronze-Tier Flex';
  }

  if (position === 4) {
    return 'Honorable Mention';
  }

  if (position === 5) {
    return 'I Was Top 5!';
  }

  // Any position between 6th and second-to-last
  return 'Not worth my time';
}

export interface TitleVisualConfig {
  iconName: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  cardBorder: string;
  glowColor: string;
  glowClass?: string;
  tagline: string;
}

export function getTitleVisualConfig(title: string): TitleVisualConfig {
  switch (title) {
    case 'Main Character Energy':
      return {
        iconName: 'Sparkles',
        badgeBg: 'bg-amber-500/20',
        badgeBorder: 'border-amber-500/40',
        badgeText: 'text-amber-300',
        cardBorder: 'border-amber-500/40 bg-amber-950/20',
        glowColor: 'shadow-amber-500/20',
        glowClass: 'shadow-[0_0_12px_rgba(245,158,11,0.3)]',
        tagline: 'Undisputed champion of the table.',
      };
    case 'The Silver Surfer':
      return {
        iconName: 'Shield',
        badgeBg: 'bg-slate-400/20',
        badgeBorder: 'border-slate-400/40',
        badgeText: 'text-slate-200',
        cardBorder: 'border-slate-400/40 bg-slate-900/40',
        glowColor: 'shadow-slate-400/20',
        glowClass: 'shadow-[0_0_12px_rgba(148,163,184,0.3)]',
        tagline: 'So close yet so far from the crown.',
      };
    case 'Bronze-Tier Flex':
      return {
        iconName: 'Medal',
        badgeBg: 'bg-amber-700/20',
        badgeBorder: 'border-amber-700/40',
        badgeText: 'text-amber-400',
        cardBorder: 'border-amber-700/40 bg-amber-950/10',
        glowColor: 'shadow-amber-700/20',
        glowClass: 'shadow-[0_0_10px_rgba(180,83,9,0.25)]',
        tagline: 'Made podium and made sure everyone knew.',
      };
    case 'Honorable Mention':
      return {
        iconName: 'Award',
        badgeBg: 'bg-blue-500/20',
        badgeBorder: 'border-blue-500/30',
        badgeText: 'text-blue-300',
        cardBorder: 'border-blue-500/30 bg-blue-950/20',
        glowColor: 'shadow-blue-500/20',
        glowClass: 'shadow-[0_0_10px_rgba(59,130,246,0.25)]',
        tagline: 'Solid performance, just outside the medals.',
      };
    case 'I Was Top 5!':
      return {
        iconName: 'Zap',
        badgeBg: 'bg-emerald-500/20',
        badgeBorder: 'border-emerald-500/30',
        badgeText: 'text-emerald-300',
        cardBorder: 'border-emerald-500/30 bg-emerald-950/20',
        glowColor: 'shadow-emerald-500/20',
        glowClass: 'shadow-[0_0_10px_rgba(16,185,129,0.25)]',
        tagline: 'A victory in their own record book.',
      };
    case 'Clutch God':
      return {
        iconName: 'Flame',
        badgeBg: 'bg-violet-500/20',
        badgeBorder: 'border-violet-500/30',
        badgeText: 'text-violet-300',
        cardBorder: 'border-violet-500/30 bg-violet-950/20',
        glowColor: 'shadow-violet-500/20',
        glowClass: 'shadow-[0_0_10px_rgba(139,92,246,0.25)]',
        tagline: 'Survived elimination by the skin of their teeth.',
      };
    case 'Bro is Not Him':
      return {
        iconName: 'Skull',
        badgeBg: 'bg-rose-500/20',
        badgeBorder: 'border-rose-500/30',
        badgeText: 'text-rose-400',
        cardBorder: 'border-rose-500/30 bg-rose-950/20',
        glowColor: 'shadow-rose-500/20',
        glowClass: 'shadow-[0_0_10px_rgba(244,63,94,0.25)]',
        tagline: 'Walked into every single bluff trap.',
      };
    case 'Not worth my time':
    default:
      return {
        iconName: 'Clock',
        badgeBg: 'bg-slate-700/20',
        badgeBorder: 'border-slate-700/30',
        badgeText: 'text-slate-400',
        cardBorder: 'border-slate-700/30 bg-slate-900/20',
        glowColor: 'shadow-slate-700/20',
        glowClass: undefined,
        tagline: 'Already thinking about the next round.',
      };
  }
}
