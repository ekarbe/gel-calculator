import { describe, it, expect } from 'vitest';
import { isPlainObject } from './objects';

describe('isPlainObject', () => {
  it('accepts plain objects, including ones without a prototype', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
    expect(isPlainObject(Object.create(null))).toBe(true);
    expect(isPlainObject(JSON.parse('{"__proto__":{"x":1}}'))).toBe(true);
  });

  it('rejects everything else', () => {
    for (const value of [null, undefined, [], [1], 'a', 1, true, new Date(0), new Map(), () => {}, new (class X {})()]) {
      expect(isPlainObject(value)).toBe(false);
    }
  });
});
