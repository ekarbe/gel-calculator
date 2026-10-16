import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { encodeShareState, decodeShareState, diffInputs, SHARE_VERSION } from './shareCodec';
import { DEFAULT_INPUTS, normalizeInputs, computePlan } from '../domain/plan';

const toBase64Url = (obj) =>
  btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = (str) => {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
};

const customInputs = normalizeInputs({
  event: { durationMin: 195, intensity: 'race', highCarb: true, sport: 'running', speedKmh: 13.5, setting: 'indoorFan' },
  athlete: { massKg: 62.5, heightCm: 168, acclimatised: true },
  environment: { tempC: -3.5, humidity: 85, sun: 'partly' },
  sweat: {
    source: 'test',
    rateIndex: 4,
    saltinessIndex: 1,
    calibrate: false,
    selectedTestId: 'june',
    tests: [
      { id: 'june', date: '2026-06-12', label: 'Long run, hot', preKg: 63.1, postKg: 61.9, fluidL: 0.6, urineL: 0.1, durationMin: 75 },
      { id: 'july', label: 'Ünïcode ✓ label', preKg: 62.8, postKg: 62.1, fluidL: 0.25, urineL: 0, durationMin: 60 },
    ],
  },
  carbs: {
    mode: 'manual',
    manualGPerHour: 82.5,
    ratioMode: 'manual',
    manualRatio: { glucose: 1.05, fructose: 0.85 },
    custom: [{ key: 'c1', name: 'Oat syrup', carbsPer100g: 72, fructoseSharePct: 5, waterPct: 24 }],
    ingredients: [
      { ref: 3, weight: 62.5 },
      { ref: 1, weight: 37.5 },
      { ref: 18, weight: 100 },
      { ref: 'c1', weight: 10 },
    ],
  },
  sodium: { mode: 'manual', manualMgPerHour: 650 },
  extras: { potassium: true, magnesium: false, calcium: true },
  salts: {
    mode: 'manual',
    sodiumSalt: 'mix',
    custom: [{ key: 's1', name: 'Tabs', sodiumPct: 20, potassiumPct: 5, magnesiumPct: 1, calciumPct: 0, chloridePct: 30 }],
    manual: [
      { ref: 31, amountMg: 1234.5 },
      { ref: 's1', amountMg: 300 },
    ],
  },
  fluid: { mode: 'manual', manualMlPerHour: 650 },
  format: { type: 'both', gelsPerHour: 2.5, view: 'perServing', gelConsistency: 'liquid', bottleMl: 950, drinkCarbSharePct: 35 },
  caffeine: { enabled: true, mgPerKg: 4.5, asIngredient: true, tabletMg: 200 },
  bicarb: { enabled: true, gPerKg: 0.25 },
});

describe('shareCodec v4', () => {
  it('encodes the defaults to the minimal payload', () => {
    const encoded = encodeShareState(DEFAULT_INPUTS);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(fromBase64Url(encoded)).toEqual({ v: 4 });
    expect(decodeShareState(encoded)).toEqual(DEFAULT_INPUTS);
    expect(SHARE_VERSION).toBe(4);
  });

  it('stores only the fields that differ from the defaults', () => {
    const inputs = normalizeInputs({ event: { durationMin: 240 }, carbs: { manualRatio: { fructose: 0.5 } }, format: { type: 'drink' } });
    expect(diffInputs(inputs)).toEqual({
      event: { durationMin: 240 },
      carbs: { manualRatio: { fructose: 0.5 } },
      format: { type: 'drink' },
    });
    expect(fromBase64Url(encodeShareState(inputs))).toEqual({
      v: 4,
      event: { durationMin: 240 },
      carbs: { manualRatio: { fructose: 0.5 } },
      format: { type: 'drink' },
    });
  });

  it('stores a changed list whole', () => {
    expect(diffInputs(normalizeInputs({ carbs: { ingredients: [] } }))).toEqual({ carbs: { ingredients: [] } });
    const withTest = normalizeInputs({ sweat: { tests: [{ id: 'a', preKg: 70, postKg: 69, durationMin: 60 }] } });
    expect(diffInputs(withTest).sweat.tests).toEqual(withTest.sweat.tests);
  });

  it('round-trips fully customised inputs, including decimals, unicode and lists', () => {
    const encoded = encodeShareState(customInputs);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeShareState(encoded)).toEqual(customInputs);
  });

  it('round-trips random inputs (property)', () => {
    const partialArb = fc.record(
      {
        event: fc.record(
          {
            durationMin: fc.double({ min: -10, max: 3000, noNaN: true }),
            highCarb: fc.boolean(),
            sport: fc.constantFrom('running', 'cycling', 'other', 'x'),
            speedKmh: fc.double({ min: 0, max: 100, noNaN: true }),
          },
          { requiredKeys: [] },
        ),
        athlete: fc.record({ massKg: fc.double({ min: 0, max: 300, noNaN: true }), heightCm: fc.integer({ min: 100, max: 250 }) }, { requiredKeys: [] }),
        environment: fc.record({ tempC: fc.double({ min: -30, max: 60, noNaN: true }), sun: fc.constantFrom('none', 'full') }, { requiredKeys: [] }),
        sweat: fc.record(
          {
            source: fc.constantFrom('test', 'estimate', 'preset'),
            tests: fc.array(
              fc.record({
                id: fc.constantFrom('a', 'b', 'c'),
                label: fc.string({ maxLength: 70 }),
                preKg: fc.double({ min: 0, max: 120, noNaN: true }),
                postKg: fc.double({ min: 0, max: 120, noNaN: true }),
                durationMin: fc.double({ min: 0, max: 200, noNaN: true }),
              }),
              { maxLength: 3 },
            ),
            selectedTestId: fc.constantFrom(null, 'a', 'b'),
          },
          { requiredKeys: [] },
        ),
        carbs: fc.record(
          {
            manualRatio: fc.record({ glucose: fc.double({ min: 0, max: 5, noNaN: true }) }, { requiredKeys: [] }),
            ingredients: fc.array(
              fc.record({ ref: fc.constantFrom(1, 3, 11, 14, 18, 'c1'), weight: fc.double({ min: 0, max: 100, noNaN: true }) }),
              { maxLength: 4 },
            ),
            custom: fc.array(
              fc.record({
                key: fc.constantFrom('c1', 'c2'),
                name: fc.string({ maxLength: 50 }),
                carbsPer100g: fc.double({ min: 0, max: 100, noNaN: true }),
                fructoseSharePct: fc.double({ min: 0, max: 100, noNaN: true }),
              }),
              { maxLength: 2 },
            ),
          },
          { requiredKeys: [] },
        ),
        salts: fc.record(
          {
            manual: fc.array(fc.record({ ref: fc.integer({ min: 31, max: 40 }), amountMg: fc.integer({ min: 0, max: 100000 }) }), { maxLength: 3 }),
          },
          { requiredKeys: [] },
        ),
        format: fc.record(
          {
            type: fc.constantFrom('gel', 'drink', 'both'),
            gelsPerHour: fc.double({ min: 0, max: 12, noNaN: true }),
            bottleMl: fc.integer({ min: 0, max: 2000 }),
          },
          { requiredKeys: [] },
        ),
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
      v: 4,
      event: { durationMin: 99999, intensity: 'sprint' },
      carbs: { ingredients: [{ ref: 31, weight: 50 }, { ref: 2, weight: 500 }] },
      junk: { a: 1 },
    });
    const decoded = decodeShareState(encoded);
    expect(decoded.event).toEqual({ ...DEFAULT_INPUTS.event, durationMin: 2880 });
    expect(decoded.carbs.ingredients).toEqual([{ ref: 2, weight: 100 }]);
    expect(decoded).not.toHaveProperty('junk');
    expect(decoded).not.toHaveProperty('v');
  });

  it('returns null for invalid input', () => {
    for (const bad of [undefined, null, 42, {}, '', '   ', '!!!not-base64!!!', 'abc', toBase64Url('just a string')]) {
      expect(decodeShareState(bad)).toBeNull();
    }
    // Valid base64url, but not JSON
    expect(decodeShareState(btoa('{not json').replace(/=+$/, ''))).toBeNull();
    // JSON, but not an object with a known version
    expect(decodeShareState(toBase64Url([4]))).toBeNull();
    expect(decodeShareState(toBase64Url(null))).toBeNull();
    expect(decodeShareState(toBase64Url({ event: { durationMin: 90 } }))).toBeNull();
    expect(decodeShareState(toBase64Url({ v: '4' }))).toBeNull();
    expect(decodeShareState(toBase64Url({ v: 5 }))).toBeNull();
    // Invalid UTF-8 bytes
    expect(decodeShareState(btoa('\xff\xfe{}'))).toBeNull();
  });

  it('returns null for a v2 payload', () => {
    const v2 = toBase64Url({ v: 2, d: 195, t: 82.5, gs: [[3, 100]], st: { wt: 154, wu: 'lbs' } });
    expect(decodeShareState(v2)).toBeNull();
  });

  it('accepts surrounding whitespace and padded base64', () => {
    const encoded = encodeShareState({ event: { durationMin: 90 } });
    const padded = encoded + '='.repeat((4 - (encoded.length % 4)) % 4);
    expect(decodeShareState(` ${padded} `).event.durationMin).toBe(90);
  });

  it('ignores an own __proto__ key in a payload', () => {
    const encoded = toBase64Url(JSON.parse('{"v":3,"__proto__":{"polluted":1},"event":{"durationMin":90}}'));
    const decoded = decodeShareState(encoded);
    expect(decoded.event.durationMin).toBe(90);
    expect({}.polluted).toBeUndefined();
  });
});

describe('shareCodec: v3 links', () => {
  it('decodes the v3 default payload to the Phase 1 plan (preset sweat, 2:1 maltodextrin and fructose)', () => {
    const decoded = decodeShareState(toBase64Url({ v: 3 }));
    // Fields a v3 link left out take the v3 defaults, not the v4 ones.
    expect(decoded.sweat.source).toBe('preset');
    expect(decoded.carbs.ingredients).toEqual([
      { ref: 3, weight: 66.67 },
      { ref: 11, weight: 33.33 },
    ]);
    expect(decoded.athlete).toEqual(DEFAULT_INPUTS.athlete);
    const plan = computePlan(decoded);
    // The Phase 1 golden numbers: 75 g/h, 570 mg/h sodium, 800 ml/h fluid, 9 gels.
    expect(plan.carbs.gPerHour).toBe(75);
    expect(plan.sodium.mgPerHour).toBe(570);
    expect(plan.fluid.mlPerHour).toBe(800);
    expect(plan.gels.count).toBe(9);
    expect(plan.carbs.ingredients.items.map((i) => [i.ref, Math.round(i.grams)])).toEqual([
      [3, 158],
      [11, 75],
    ]);
  });

  it('restores a v3 240 min event', () => {
    const decoded = decodeShareState(toBase64Url({ v: 3, event: { durationMin: 240 } }));
    expect(decoded.event.durationMin).toBe(240);
    expect(decoded.sweat.source).toBe('preset');
  });

  it('migrates customised v3 fields', () => {
    const decoded = decodeShareState(
      toBase64Url({
        v: 3,
        athlete: { massKg: 62.5, sex: 'female' },
        sweat: { source: 'estimate', rateIndex: 4 },
        carbs: {
          ratioMode: 'manual',
          manualRatio: { glucose: 1, fructose: 0.8 },
          glucoseSources: [{ id: 3, percentage: 62.5 }, { id: 1, percentage: 37.5 }],
          fructoseSources: [{ id: 18, percentage: 100 }],
        },
        salts: { mode: 'manual', manual: [{ id: 31, amountMg: 1234.5 }, { id: 39, amountMg: 300 }] },
        format: { gelsPerHour: 2.5, view: 'perGel' },
      }),
    );
    expect(decoded.athlete).toEqual({ massKg: 62.5, heightCm: 175, acclimatised: false });
    expect(decoded.sweat).toMatchObject({ source: 'estimate', rateIndex: 4 });
    expect(decoded.carbs.ratioMode).toBe('manual');
    expect(decoded.carbs.ingredients).toEqual([
      { ref: 3, weight: 34.72 },
      { ref: 1, weight: 20.83 },
      { ref: 18, weight: 44.44 },
    ]);
    expect(decoded.salts.manual).toEqual([
      { ref: 31, amountMg: 1234.5 },
      { ref: 39, amountMg: 300 },
    ]);
    expect(decoded.format).toMatchObject({ type: 'gel', gelsPerHour: 2.5, view: 'perServing' });
    // Re-encoding writes a v4 link that decodes to the same inputs.
    const reencoded = encodeShareState(decoded);
    expect(fromBase64Url(reencoded).v).toBe(4);
    expect(decodeShareState(reencoded)).toEqual(decoded);
  });

  it('keeps empty v3 source lists empty', () => {
    const decoded = decodeShareState(toBase64Url({ v: 3, carbs: { fructoseSources: [] } }));
    expect(decoded.carbs.ingredients).toEqual([{ ref: 3, weight: 66.67 }]);
  });
});
