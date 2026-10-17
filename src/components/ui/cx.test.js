import { describe, it, expect } from 'vitest';
import { cx, TONES, toneClasses } from './cx';

describe('cx', () => {
  it('joins truthy class names', () => {
    expect(cx('a', false, null, undefined, 0, '', 'b')).toBe('a b');
    expect(cx()).toBe('');
  });
});

describe('tones', () => {
  it('has complete classes for every substance, status, accent and neutral', () => {
    expect(Object.keys(TONES)).toEqual(['neutral', 'accent', 'glucose', 'fructose', 'sodium', 'fluid', 'caffeine', 'ok', 'warn', 'danger']);
    for (const [name, look] of Object.entries(TONES)) {
      expect(Object.keys(look), name).toEqual(['text', 'soft', 'fill', 'border']);
      // Only design tokens: no hex values and no default Tailwind palette.
      for (const value of Object.values(look)) expect(value).not.toMatch(/#|slate|gray|blue-|apple/);
    }
    expect(toneClasses('sodium')).toBe(TONES.sodium);
    expect(toneClasses('nope')).toBe(TONES.neutral);
    expect(toneClasses('toString')).toBe(TONES.neutral);
  });
});
