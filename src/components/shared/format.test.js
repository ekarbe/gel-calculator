import { describe, it, expect } from 'vitest';
import { fmt, formatRange, formatRatio, shareToRatio } from './format';

describe('fmt', () => {
  it('adds thousands separators and keeps at most `digits` decimals', () => {
    expect(fmt(1710)).toBe('1,710');
    expect(fmt(2.456, 1)).toBe('2.5');
    expect(fmt(3, 2)).toBe('3');
  });

  it('shows non-finite numbers as 0', () => {
    expect(fmt(NaN)).toBe('0');
    expect(fmt(Infinity, 1)).toBe('0');
    expect(fmt(undefined)).toBe('0');
  });
});

describe('formatRange', () => {
  it('joins the ends with an en dash and the unit', () => {
    expect(formatRange([60, 90], 'g/h')).toBe('60–90 g/h');
    expect(formatRange([300, 1000], 'mg/h')).toBe('300–1,000 mg/h');
  });

  it('shows a [0, 0] range as one value', () => {
    expect(formatRange([0, 0], 'g/h')).toBe('0 g/h');
    expect(formatRange([0, 30], 'g/h')).toBe('0–30 g/h');
  });

  it('returns null for anything that is not a range', () => {
    expect(formatRange(undefined, 'g/h')).toBeNull();
    expect(formatRange([5], 'g/h')).toBeNull();
  });
});

describe('formatRatio', () => {
  it('normalizes to glucose 1', () => {
    expect(formatRatio({ glucose: 1, fructose: 0.5 })).toBe('1:0.5');
    expect(formatRatio({ glucose: 2, fructose: 1 })).toBe('1:0.5');
    expect(formatRatio({ glucose: 1, fructose: 0.8 })).toBe('1:0.8');
    expect(formatRatio({ glucose: 3, fructose: 1 })).toBe('1:0.33');
    expect(formatRatio({ glucose: 1, fructose: 0 })).toBe('1:0');
    // The same manual ratio reads the same in every card.
    expect(formatRatio({ glucose: 0.95, fructose: 0.85 })).toBe('1:0.89');
    expect(formatRatio({ glucose: 2, fructose: 0.5 })).toBe('1:0.25');
  });

  it('handles missing glucose or both parts', () => {
    expect(formatRatio({ glucose: 0, fructose: 1 })).toBe('0:1');
    expect(formatRatio({ glucose: 0, fructose: 0 })).toBe('0:0');
    expect(formatRatio({ glucose: NaN, fructose: -1 })).toBe('0:0');
    expect(formatRatio(undefined)).toBe('0:0');
  });
});

describe('shareToRatio', () => {
  it('turns a fructose share into ratio text', () => {
    expect(shareToRatio(0)).toBe('1:0');
    expect(shareToRatio(1 / 3)).toBe('1:0.5');
    expect(shareToRatio(0.5)).toBe('1:1');
    expect(shareToRatio(0.8 / 1.8)).toBe('1:0.8');
    expect(shareToRatio(1)).toBe('0:1');
    expect(shareToRatio(NaN)).toBe('0:1');
  });
});
