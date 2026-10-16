import { describe, it, expect } from 'vitest';
import { getGelTimes, getGelCount, formatElapsed } from './schedule';

describe('schedule', () => {
  it('takes the first gel at the start and one per interval after', () => {
    expect(getGelTimes(60, 2)).toEqual([0, 30]);
    expect(getGelTimes(90, 2)).toEqual([0, 30, 60]);
  });

  it('counts a gel for a partial final interval so per-gel amounts match the schedule', () => {
    expect(getGelCount(75, 2)).toBe(3);
  });

  it('does not add a gel at the finish line due to float drift', () => {
    expect(getGelCount(60, 7)).toBe(7);
    expect(getGelCount(180, 3)).toBe(9);
  });

  it('returns no gels when gels per hour is zero or invalid', () => {
    expect(getGelTimes(60, 0)).toEqual([]);
    expect(getGelTimes(60, -1)).toEqual([]);
    expect(getGelCount(60, NaN)).toBe(0);
  });

  it('formats elapsed time without producing 60 minutes', () => {
    expect(formatElapsed(30)).toBe('T+30m');
    expect(formatElapsed(60)).toBe('T+1h');
    expect(formatElapsed(85.7)).toBe('T+1h 26m');
    expect(formatElapsed(119.6)).toBe('T+2h');
  });
});
