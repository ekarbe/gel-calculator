import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { encodeShareState, decodeShareState, diffInputs, SHARE_VERSION } from './shareCodec';
import { DEFAULT_INPUTS, normalizeInputs } from '../domain/plan';

const toBase64Url = (obj) =>
  btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = (str) => {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
};

const customInputs = normalizeInputs({
  event: { durationMin: 195, intensity: 'race', highCarb: true },
  athlete: { massKg: 62.5, sex: 'female' },
  environment: { tempC: -3.5, humidity: 85 },
  sweat: { source: 'estimate', rateIndex: 4, saltinessIndex: 1 },
  carbs: {
    mode: 'manual',
    manualGPerHour: 82.5,
    ratioMode: 'manual',
    manualRatio: { glucose: 1.05, fructose: 0.85 },
    glucoseSources: [{ id: 3, percentage: 62.5 }, { id: 1, percentage: 37.5 }],
    fructoseSources: [{ id: 18, percentage: 100 }],
  },
  sodium: { mode: 'manual', manualMgPerHour: 650 },
  extras: { potassium: true, magnesium: false, calcium: true },
  salts: { mode: 'manual', sodiumSalt: 'mix', manual: [{ id: 31, amountMg: 1234.5 }, { id: 39, amountMg: 300 }] },
  fluid: { mode: 'manual', manualMlPerHour: 650 },
  format: { gelsPerHour: 2.5, view: 'perGel' },
  caffeine: { enabled: true, mgPerKg: 4.5, asIngredient: true, tabletMg: 200 },
  bicarb: { enabled: true, gPerKg: 0.25 },
});

describe('shareCodec v3', () => {
  it('encodes the defaults to the minimal payload', () => {
    const encoded = encodeShareState(DEFAULT_INPUTS);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(fromBase64Url(encoded)).toEqual({ v: 3 });
    expect(decodeShareState(encoded)).toEqual(DEFAULT_INPUTS);
    expect(SHARE_VERSION).toBe(3);
  });

  it('stores only the fields that differ from the defaults', () => {
    const inputs = normalizeInputs({ event: { durationMin: 240 }, carbs: { manualRatio: { fructose: 0.5 } } });
    expect(diffInputs(inputs)).toEqual({ event: { durationMin: 240 }, carbs: { manualRatio: { fructose: 0.5 } } });
    expect(fromBase64Url(encodeShareState(inputs))).toEqual({
      v: 3,
      event: { durationMin: 240 },
      carbs: { manualRatio: { fructose: 0.5 } },
    });
  });

  it('stores a changed list whole', () => {
    const inputs = normalizeInputs({ carbs: { fructoseSources: [] } });
    expect(diffInputs(inputs)).toEqual({ carbs: { fructoseSources: [] } });
  });

  it('round-trips fully customised inputs, including decimals and lists', () => {
    const encoded = encodeShareState(customInputs);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeShareState(encoded)).toEqual(customInputs);
  });

  it('round-trips random inputs (property)', () => {
    const partialArb = fc.record(
      {
        event: fc.record({ durationMin: fc.double({ min: -10, max: 3000, noNaN: true }), highCarb: fc.boolean() }, { requiredKeys: [] }),
        athlete: fc.record({ massKg: fc.double({ min: 0, max: 300, noNaN: true }), sex: fc.constantFrom('female', 'male', 'x') }, { requiredKeys: [] }),
        environment: fc.record({ tempC: fc.double({ min: -30, max: 60, noNaN: true }) }, { requiredKeys: [] }),
        carbs: fc.record(
          {
            manualRatio: fc.record({ glucose: fc.double({ min: 0, max: 5, noNaN: true }) }, { requiredKeys: [] }),
            glucoseSources: fc.array(fc.record({ id: fc.integer({ min: 1, max: 8 }), percentage: fc.double({ min: 0, max: 1000, noNaN: true }) }), { maxLength: 3 }),
          },
          { requiredKeys: [] },
        ),
        salts: fc.record({ manual: fc.array(fc.record({ id: fc.integer({ min: 31, max: 40 }), amountMg: fc.integer({ min: 0, max: 100000 }) }), { maxLength: 3 }) }, { requiredKeys: [] }),
        format: fc.record({ gelsPerHour: fc.double({ min: 0, max: 12, noNaN: true }) }, { requiredKeys: [] }),
        caffeine: fc.record({ enabled: fc.boolean(), tabletMg: fc.constantFrom(100, 200) }, { requiredKeys: [] }),
      },
      { requiredKeys: [] },
    );
    fc.assert(
      fc.property(partialArb, (partial) => {
        const inputs = normalizeInputs(partial);
        expect(decodeShareState(encodeShareState(inputs))).toEqual(inputs);
      }),
      { numRuns: 300 },
    );
  });

  it('normalizes what it decodes', () => {
    const encoded = toBase64Url({
      v: 3,
      event: { durationMin: 99999, intensity: 'sprint' },
      carbs: { glucoseSources: [{ id: 11, percentage: 50 }, { id: 2, percentage: 50 }] },
      junk: { a: 1 },
    });
    const decoded = decodeShareState(encoded);
    expect(decoded.event).toEqual({ durationMin: 2880, intensity: 'moderate', highCarb: false });
    expect(decoded.carbs.glucoseSources).toEqual([{ id: 2, percentage: 50 }]);
    expect(decoded).not.toHaveProperty('junk');
    expect(decoded).not.toHaveProperty('v');
  });

  it('returns null for invalid input', () => {
    for (const bad of [undefined, null, 42, {}, '', '   ', '!!!not-base64!!!', 'abc', toBase64Url('just a string')]) {
      expect(decodeShareState(bad)).toBeNull();
    }
    // Valid base64url, but not JSON
    expect(decodeShareState(btoa('{not json').replace(/=+$/, ''))).toBeNull();
    // JSON, but not an object with v: 3
    expect(decodeShareState(toBase64Url([3]))).toBeNull();
    expect(decodeShareState(toBase64Url(null))).toBeNull();
    expect(decodeShareState(toBase64Url({ event: { durationMin: 90 } }))).toBeNull();
    expect(decodeShareState(toBase64Url({ v: '3' }))).toBeNull();
    // Invalid UTF-8 bytes
    expect(decodeShareState(btoa('\xff\xfe{}'))).toBeNull();
  });

  it('returns null for a v2 payload', () => {
    const v2 = toBase64Url({ v: 2, d: 195, t: 82.5, gs: [[3, 100]], st: { wt: 154, wu: 'lbs' } });
    expect(decodeShareState(v2)).toBeNull();
    expect(decodeShareState(toBase64Url({ v: 4 }))).toBeNull();
  });

  it('accepts surrounding whitespace and padded base64', () => {
    const encoded = encodeShareState({ event: { durationMin: 90 } });
    const padded = encoded + '='.repeat((4 - (encoded.length % 4)) % 4);
    expect(decodeShareState(` ${padded} `).event.durationMin).toBe(90);
  });
});
