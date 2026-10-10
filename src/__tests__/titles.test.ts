import { describe, it, expect } from 'vitest';
import { getFinishingTitle, TITLES } from '../utils/titles';
import { GameRoom } from '../engine/GameRoom';

describe('BLUFF Custom Finishing Titles Assignment Algorithm', () => {
  it('assigns titles correctly for 2 players (N = 2)', () => {
    // 1st (N - 1): Clutch God
    expect(getFinishingTitle(1, 2)).toBe(TITLES.CLUTCH_GOD);
    // 2nd (N): Bro is Not Him
    expect(getFinishingTitle(2, 2)).toBe(TITLES.NOT_HIM);
  });

  it('assigns titles correctly for 3 players (N = 3)', () => {
    // 1st: Main Character Energy
    expect(getFinishingTitle(1, 3)).toBe(TITLES.MAIN_CHARACTER);
    // 2nd (N - 1): Clutch God
    expect(getFinishingTitle(2, 3)).toBe(TITLES.CLUTCH_GOD);
    // 3rd (N): Bro is Not Him
    expect(getFinishingTitle(3, 3)).toBe(TITLES.NOT_HIM);
  });

  it('assigns titles correctly for 4 players (N = 4)', () => {
    // 1st: Main Character Energy
    expect(getFinishingTitle(1, 4)).toBe(TITLES.MAIN_CHARACTER);
    // 2nd: The Silver Surfer
    expect(getFinishingTitle(2, 4)).toBe(TITLES.SILVER_SURFER);
    // 3rd (N - 1): Clutch God
    expect(getFinishingTitle(3, 4)).toBe(TITLES.CLUTCH_GOD);
    // 4th (N): Bro is Not Him
    expect(getFinishingTitle(4, 4)).toBe(TITLES.NOT_HIM);
  });

  it('assigns titles correctly for 5 players (N = 5)', () => {
    expect(getFinishingTitle(1, 5)).toBe(TITLES.MAIN_CHARACTER);
    expect(getFinishingTitle(2, 5)).toBe(TITLES.SILVER_SURFER);
    expect(getFinishingTitle(3, 5)).toBe(TITLES.BRONZE_FLEX);
    // 4th (N - 1): Clutch God
    expect(getFinishingTitle(4, 5)).toBe(TITLES.CLUTCH_GOD);
    // 5th (N): Bro is Not Him
    expect(getFinishingTitle(5, 5)).toBe(TITLES.NOT_HIM);
  });

  it('assigns titles correctly for 6 players (N = 6)', () => {
    expect(getFinishingTitle(1, 6)).toBe(TITLES.MAIN_CHARACTER);
    expect(getFinishingTitle(2, 6)).toBe(TITLES.SILVER_SURFER);
    expect(getFinishingTitle(3, 6)).toBe(TITLES.BRONZE_FLEX);
    expect(getFinishingTitle(4, 6)).toBe(TITLES.HONORABLE_MENTION);
    // 5th (N - 1): Clutch God
    expect(getFinishingTitle(5, 6)).toBe(TITLES.CLUTCH_GOD);
    // 6th (N): Bro is Not Him
    expect(getFinishingTitle(6, 6)).toBe(TITLES.NOT_HIM);
  });

  it('assigns titles correctly for 7 players (N = 7)', () => {
    expect(getFinishingTitle(1, 7)).toBe(TITLES.MAIN_CHARACTER);
    expect(getFinishingTitle(2, 7)).toBe(TITLES.SILVER_SURFER);
    expect(getFinishingTitle(3, 7)).toBe(TITLES.BRONZE_FLEX);
    expect(getFinishingTitle(4, 7)).toBe(TITLES.HONORABLE_MENTION);
    expect(getFinishingTitle(5, 7)).toBe(TITLES.TOP_FIVE);
    // 6th (N - 1): Clutch God
    expect(getFinishingTitle(6, 7)).toBe(TITLES.CLUTCH_GOD);
    // 7th (N): Bro is Not Him
    expect(getFinishingTitle(7, 7)).toBe(TITLES.NOT_HIM);
  });

  it('assigns titles correctly for 8 players (N = 8)', () => {
    expect(getFinishingTitle(1, 8)).toBe(TITLES.MAIN_CHARACTER);
    expect(getFinishingTitle(2, 8)).toBe(TITLES.SILVER_SURFER);
    expect(getFinishingTitle(3, 8)).toBe(TITLES.BRONZE_FLEX);
    expect(getFinishingTitle(4, 8)).toBe(TITLES.HONORABLE_MENTION);
    expect(getFinishingTitle(5, 8)).toBe(TITLES.TOP_FIVE);
    // 6th (between 5 and N - 1): Not worth my time
    expect(getFinishingTitle(6, 8)).toBe(TITLES.NOT_WORTH_TIME);
    // 7th (N - 1): Clutch God
    expect(getFinishingTitle(7, 8)).toBe(TITLES.CLUTCH_GOD);
    // 8th (N): Bro is Not Him
    expect(getFinishingTitle(8, 8)).toBe(TITLES.NOT_HIM);
  });

  it('assigns titles correctly for 10 players (larger game)', () => {
    expect(getFinishingTitle(1, 10)).toBe(TITLES.MAIN_CHARACTER);
    expect(getFinishingTitle(2, 10)).toBe(TITLES.SILVER_SURFER);
    expect(getFinishingTitle(3, 10)).toBe(TITLES.BRONZE_FLEX);
    expect(getFinishingTitle(4, 10)).toBe(TITLES.HONORABLE_MENTION);
    expect(getFinishingTitle(5, 10)).toBe(TITLES.TOP_FIVE);
    // 6, 7, 8: Not worth my time
    expect(getFinishingTitle(6, 10)).toBe(TITLES.NOT_WORTH_TIME);
    expect(getFinishingTitle(7, 10)).toBe(TITLES.NOT_WORTH_TIME);
    expect(getFinishingTitle(8, 10)).toBe(TITLES.NOT_WORTH_TIME);
    // 9 (N - 1): Clutch God
    expect(getFinishingTitle(9, 10)).toBe(TITLES.CLUTCH_GOD);
    // 10 (N): Bro is Not Him
    expect(getFinishingTitle(10, 10)).toBe(TITLES.NOT_HIM);
  });

  it('handles edge case of 1 player gracefully', () => {
    expect(getFinishingTitle(1, 1)).toBe(TITLES.MAIN_CHARACTER);
  });
});
