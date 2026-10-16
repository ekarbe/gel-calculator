import { describe, it, expect } from 'vitest';
import { aboutKcal, fmt, formatDuration, formatRange, signed } from './format';

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

describe('signed', () => {
  it('signs with a real minus and rounds before it picks the sign', () => {
    expect(signed(0.34, 1)).toBe('+0.3');
    expect(signed(-1.84, 1)).toBe('\u22121.8');
    expect(signed(-0.04, 1)).toBe('0');
    expect(signed(0.04, 1)).toBe('0');
    expect(signed(-1234)).toBe('\u22121,234');
  });

  it('shows non-finite values as 0', () => {
    expect(signed(NaN, 1)).toBe('0');
    expect(signed(Infinity, 1)).toBe('0');
    expect(signed(undefined, 1)).toBe('0');
  });
});

describe('formatDuration', () => {
  it('writes minutes and hours', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(180)).toBe('3 h');
    expect(formatDuration(150.4)).toBe('2 h 30 min');
    expect(formatDuration(-5)).toBe('0 min');
    expect(formatDuration(NaN)).toBe('0 min');
  });
});

describe('aboutKcal', () => {
  it('rounds an estimated burn to 10 kcal', () => {
    expect(aboutKcal(2035.3)).toBe('2,040');
    expect(aboutKcal(4)).toBe('0');
    expect(aboutKcal(NaN)).toBe('0');
  });
});
