import { describe, it, expect, vi, afterEach } from 'vitest';
import fc from 'fast-check';
import { t, hasMessage, MESSAGES, CATALOGS } from './index';
import { computePlan, DEFAULT_INPUTS, INPUT_OPTIONS } from '../domain/plan';

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Collects every message descriptor in `value`: an object with a string `key`
 * and no other own keys than `key` and `params`. (Recipe items also have a
 * `key`, but many other fields, so they are not descriptors.)
 */
function collectMessages(value, out = []) {
  if (Array.isArray(value)) {
    value.forEach((v) => collectMessages(v, out));
  } else if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (typeof value.key === 'string' && keys.every((k) => k === 'key' || k === 'params')) {
      out.push(value);
      return out;
    }
    for (const v of Object.values(value)) collectMessages(v, out);
  }
  return out;
}

/** Random partial inputs that reach as many branches of the domain as possible. */
const sweatTestArb = fc.record({
  id: fc.constantFrom('a', 'b'),
  preKg: fc.double({ min: 50, max: 90, noNaN: true }),
  postKg: fc.double({ min: 50, max: 90, noNaN: true }),
  fluidL: fc.double({ min: 0, max: 2, noNaN: true }),
  urineL: fc.double({ min: 0, max: 0.5, noNaN: true }),
  durationMin: fc.constantFrom(0, 30, 60, 90),
  conditions: fc.record(
    { sport: fc.constantFrom(...INPUT_OPTIONS.sport), tempC: fc.integer({ min: -10, max: 45 }), sun: fc.constantFrom(...INPUT_OPTIONS.sun) },
    { requiredKeys: [] },
  ),
});
const inputsArb = fc.record(
  {
    event: fc.record(
      {
        durationMin: fc.oneof(fc.integer({ min: 0, max: 600 }), fc.constantFrom(0, 30, 44, 45, 60, 74, 75, 90, 119, 120, 150, 151, 180, 181, 240, 241, 2880)),
        intensity: fc.constantFrom(...INPUT_OPTIONS.intensity),
        highCarb: fc.boolean(),
        sport: fc.constantFrom(...INPUT_OPTIONS.sport),
        speedKmh: fc.integer({ min: 3, max: 70 }),
        powerW: fc.constantFrom(0, 150, 300, 2000),
        mets: fc.integer({ min: 1, max: 20 }),
        setting: fc.constantFrom(...INPUT_OPTIONS.setting),
      },
      { requiredKeys: [] },
    ),
    athlete: fc.record(
      { massKg: fc.integer({ min: 30, max: 200 }), heightCm: fc.integer({ min: 120, max: 220 }), acclimatised: fc.boolean() },
      { requiredKeys: [] },
    ),
    environment: fc.record(
      { tempC: fc.integer({ min: -20, max: 50 }), humidity: fc.integer({ min: 0, max: 100 }), sun: fc.constantFrom(...INPUT_OPTIONS.sun) },
      { requiredKeys: [] },
    ),
    sweat: fc.record(
      {
        source: fc.constantFrom(...INPUT_OPTIONS.sweatSource),
        rateIndex: fc.integer({ min: 0, max: 5 }),
        saltinessIndex: fc.integer({ min: 0, max: 5 }),
        tests: fc.array(sweatTestArb, { maxLength: 2 }),
        selectedTestId: fc.constantFrom(null, 'a', 'b'),
        calibrate: fc.boolean(),
      },
      { requiredKeys: [] },
    ),
    carbs: fc.record(
      {
        mode: fc.constantFrom(...INPUT_OPTIONS.mode),
        manualGPerHour: fc.integer({ min: 0, max: 200 }),
        ratioMode: fc.constantFrom(...INPUT_OPTIONS.mode),
        manualRatio: fc.record({ glucose: fc.double({ min: 0, max: 2, noNaN: true }), fructose: fc.double({ min: 0, max: 2, noNaN: true }) }),
        ingredients: fc.constantFrom(
          [],
          [{ ref: 3, weight: 100 }],
          [{ ref: 1, weight: 100 }],
          [{ ref: 1, weight: 70 }, { ref: 11, weight: 30 }],
          [{ ref: 14, weight: 100 }],
          [{ ref: 3, weight: 50 }, { ref: 18, weight: 50 }],
          [{ ref: 'c1', weight: 100 }, { ref: 11, weight: 20 }],
        ),
        custom: fc.constantFrom([], [{ key: 'c1', name: 'Oat syrup', carbsPer100g: 70, fructoseSharePct: 10 }]),
      },
      { requiredKeys: [] },
    ),
    sodium: fc.record({ mode: fc.constantFrom(...INPUT_OPTIONS.mode), manualMgPerHour: fc.integer({ min: 0, max: 5000 }) }, { requiredKeys: [] }),
    extras: fc.record({ potassium: fc.boolean(), magnesium: fc.boolean(), calcium: fc.boolean() }, { requiredKeys: [] }),
    salts: fc.record(
      {
        mode: fc.constantFrom(...INPUT_OPTIONS.mode),
        sodiumSalt: fc.constantFrom(...INPUT_OPTIONS.sodiumSalt),
        manual: fc.array(fc.record({ ref: fc.constantFrom(31, 33, 39, 's1'), amountMg: fc.integer({ min: 0, max: 20000 }) }), { maxLength: 3 }),
        custom: fc.constantFrom([], [{ key: 's1', name: 'Tabs', sodiumPct: 20, potassiumPct: 5, magnesiumPct: 0, calciumPct: 0, chloridePct: 30 }]),
      },
      { requiredKeys: [] },
    ),
    fluid: fc.record({ mode: fc.constantFrom(...INPUT_OPTIONS.mode), manualMlPerHour: fc.integer({ min: 0, max: 3000 }) }, { requiredKeys: [] }),
    format: fc.record(
      {
        type: fc.constantFrom(...INPUT_OPTIONS.formatType),
        gelsPerHour: fc.constantFrom(0, 0.5, 1, 2, 3, 4, 6, 12),
        view: fc.constantFrom(...INPUT_OPTIONS.view),
        gelConsistency: fc.constantFrom(...INPUT_OPTIONS.gelConsistency),
        bottleMl: fc.constantFrom(250, 500, 750, 950, 1500),
        drinkCarbSharePct: fc.constantFrom(0, 25, 50, 100),
      },
      { requiredKeys: [] },
    ),
    caffeine: fc.record(
      {
        enabled: fc.boolean(),
        mgPerKg: fc.double({ min: 1, max: 6, noNaN: true }),
        asIngredient: fc.boolean(),
        tabletMg: fc.constantFrom(...INPUT_OPTIONS.tabletMg),
      },
      { requiredKeys: [] },
    ),
    bicarb: fc.record({ enabled: fc.boolean(), gPerKg: fc.double({ min: 0.2, max: 0.3, noNaN: true }) }, { requiredKeys: [] }),
  },
  { requiredKeys: [] },
);

describe('catalog', () => {
  it('merges every module catalog', () => {
    for (const catalog of Object.values(CATALOGS)) {
      for (const [key, text] of Object.entries(catalog)) {
        expect(MESSAGES[key]).toBe(text);
      }
    }
  });

  it('defines each key in one catalog only, under its module namespace', () => {
    const owner = new Map();
    for (const [name, catalog] of Object.entries(CATALOGS)) {
      for (const key of Object.keys(catalog)) {
        expect(owner.get(key), `${key} defined in ${owner.get(key)} and ${name}`).toBeUndefined();
        owner.set(key, name);
        expect(key.startsWith(`${name}.`), `${key} in ${name}`).toBe(true);
      }
    }
  });

  it('holds only non-empty strings', () => {
    for (const [key, text] of Object.entries(MESSAGES)) {
      expect(typeof text, key).toBe('string');
      expect(text.trim(), key).not.toBe('');
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(MESSAGES)).toBe(true);
  });
});

describe('t', () => {
  it('fills placeholders from a message descriptor', () => {
    expect(t({ key: 'carbs.why.long', params: { lo: 60, hi: 90, gPerHour: 75 } })).toBe(
      'Over 2.5 h, the evidence range is 60–90 g/h of carbs from mixed glucose and fructose. Your target is 75 g/h.',
    );
  });

  it('accepts a key string with params', () => {
    expect(t('schedule.fuel', { gel: 3 })).toBe('Take gel 3.');
  });

  it('merges extra params over the descriptor params', () => {
    expect(t({ key: 'schedule.fuel', params: { gel: 3 } }, { gel: 4 })).toBe('Take gel 4.');
  });

  it('formats numbers with en-US separators and keeps strings as they are', () => {
    expect(t('fluid.warn.aboveSweat', { mlPerHour: 1500, sweatMlPerHour: 1250 })).toContain('1,500 ml/h');
    expect(t('carbs.warn.tooLittleFructose', { gPerHour: 95, minRatio: '1:0.55' })).toBe(
      'At 95 g/h, use at least 1:0.55 glucose to fructose. Glucose alone cannot be absorbed fast enough.',
    );
    expect(t('schedule.caffeineTablets', { mg: 150, tablets: 1.5 })).toBe('Take 150 mg caffeine. Tablets: 1.5.');
  });

  it('writes negative numbers with a real minus sign, and zero without a sign', () => {
    // The same "−" as every signed number on screen (an invalid sweat test can give a negative rate).
    expect(t('sweat.test.problem.noLoss', { rateLph: -1.14 })).toContain('This test gives \u22121.14 L/h.');
    expect(t('schedule.fuel', { gel: -1234 })).toBe('Take gel \u22121,234.');
    expect(t('schedule.fuel', { gel: -0 })).toBe('Take gel 0.');
    expect(t('schedule.fuel', { gel: -0.0001 })).toBe('Take gel 0.');
  });

  it('leaves placeholders without a value in place', () => {
    expect(t('schedule.fuel')).toBe('Take gel {gel}.');
    expect(t('schedule.fuel', { gel: null })).toBe('Take gel {gel}.');
  });

  it('returns a message without placeholders as is', () => {
    expect(t({ key: 'schedule.finish' })).toBe('Finish. Begin your recovery.');
  });

  it('returns the key for a missing message and logs it once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(t('nope.missing.key')).toBe('nope.missing.key');
    expect(t({ key: 'nope.missing.key', params: { a: 1 } })).toBe('nope.missing.key');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('nope.missing.key');
  });

  it('does not treat inherited properties as messages', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(hasMessage('toString')).toBe(false);
    expect(t('toString')).toBe('toString');
  });

  it('returns an empty string for values that are not messages', () => {
    expect(t(undefined)).toBe('');
    expect(t(null)).toBe('');
    expect(t({})).toBe('');
    expect(t(42)).toBe('');
  });
});

describe('coverage of the domain', () => {
  /**
   * Checks every message the plan can show: the key exists and every
   * placeholder gets a value. Also checks the per-type schedule titles.
   */
  function checkPlan(plan, missing) {
    for (const message of collectMessages(plan)) {
      if (!hasMessage(message.key)) {
        missing.add(`missing key ${message.key}`);
        continue;
      }
      const text = t(message);
      const unfilled = text.match(/\{\w+\}/g);
      if (unfilled) missing.add(`${message.key} leaves ${unfilled.join(', ')}`);
    }
    for (const event of plan.schedule) {
      const title = `schedule.title.${event.type}`;
      if (!hasMessage(title)) missing.add(`missing key ${title}`);
    }
  }

  it('has text for every message reachable from computePlan', () => {
    const missing = new Set();
    const seen = new Set();
    const preset = { source: 'preset' };
    const test = { id: 'a', preKg: 70, postKg: 69, fluidL: 0.5, urineL: 0, durationMin: 60 };
    const hot = { environment: { tempC: 40, humidity: 80 }, event: { sport: 'running', speedKmh: 12 } };
    const fixed = [
      DEFAULT_INPUTS,
      { event: { durationMin: 30 } },
      { event: { durationMin: 60 }, caffeine: { enabled: true } },
      { event: { durationMin: 45 }, bicarb: { enabled: true } },
      { event: { durationMin: 75 }, bicarb: { enabled: true } },
      { event: { durationMin: 300, highCarb: true, intensity: 'race' }, caffeine: { enabled: true, asIngredient: true, mgPerKg: 6 } },
      { event: { durationMin: 120, highCarb: true }, sweat: preset },
      { carbs: { mode: 'manual', manualGPerHour: 150, ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } },
      { carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 0 }, ingredients: [{ ref: 11, weight: 100 }] } },
      { carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 2 } } },
      { carbs: { ingredients: [] } },
      { sodium: { mode: 'manual', manualMgPerHour: 3000 }, fluid: { mode: 'manual', manualMlPerHour: 2500 } },
      { sodium: { mode: 'manual', manualMgPerHour: 1200 }, fluid: { mode: 'manual', manualMlPerHour: 300 } },
      { sweat: { source: 'preset', rateIndex: 5 }, fluid: { mode: 'manual', manualMlPerHour: 1000 } },
      { sweat: { source: 'preset', rateIndex: 3 }, fluid: { mode: 'manual', manualMlPerHour: 1000 } },
      { sweat: { source: 'preset', rateIndex: 4 }, fluid: { mode: 'manual', manualMlPerHour: 500 } },
      { extras: { potassium: true, magnesium: true, calcium: true }, format: { gelsPerHour: 0 } },
      { caffeine: { enabled: true }, format: { gelsPerHour: 0 } },
      // Sweat sources
      { sweat: { source: 'test' } },
      { sweat: { source: 'test', tests: [{ ...test, postKg: 71 }] } },
      { sweat: { source: 'test', tests: [{ ...test, durationMin: 0, preKg: 0 }] } },
      { sweat: { source: 'test', tests: [{ ...test, postKg: 60 }] } },
      { sweat: { source: 'test', tests: [test] } },
      { sweat: { source: 'test', calibrate: false, tests: [test] } },
      { ...hot, sweat: { source: 'test', tests: [{ ...test, preKg: 72, conditions: { tempC: 10 } }] } },
      { ...hot, sweat: { source: 'test', tests: [{ ...test, conditions: { tempC: -20 } }] } },
      hot,
      { environment: { tempC: -20 }, event: { sport: 'running', speedKmh: 3 }, sweat: { source: 'test', tests: [test] } },
      // Formats
      { sweat: preset, format: { type: 'drink' } },
      { sweat: preset, format: { type: 'drink', bottleMl: 1500 }, carbs: { mode: 'manual', manualGPerHour: 120 } },
      { sweat: preset, format: { type: 'drink' }, carbs: { ingredients: [{ ref: 1, weight: 100 }, { ref: 11, weight: 50 }] } },
      { sweat: preset, format: { type: 'drink' }, fluid: { mode: 'manual', manualMlPerHour: 100 } },
      { sweat: preset, format: { type: 'drink' }, fluid: { mode: 'manual', manualMlPerHour: 0 } },
      { sweat: preset, format: { type: 'drink' }, salts: { mode: 'manual', manual: [] } },
      { sweat: preset, format: { type: 'drink' }, sodium: { mode: 'manual', manualMgPerHour: 1500 } },
      { sweat: preset, format: { type: 'drink', bottleMl: 250 }, event: { durationMin: 75 } },
      { sweat: preset, format: { type: 'drink', bottleMl: 250 }, fluid: { mode: 'manual', manualMlPerHour: 3000 } },
      { sweat: preset, format: { type: 'drink' }, carbs: { mode: 'manual', manualGPerHour: 120 }, fluid: { mode: 'manual', manualMlPerHour: 50 } },
      { sweat: preset, format: { type: 'both', drinkCarbSharePct: 30 } },
      { sweat: preset, format: { type: 'both' }, fluid: { mode: 'manual', manualMlPerHour: 0 } },
      { sweat: preset, format: { type: 'both', gelsPerHour: 12 }, event: { durationMin: 61 } },
      { carbs: { ingredients: [{ ref: 1, weight: 100 }, { ref: 11, weight: 30 }] }, format: { gelConsistency: 'thick' } },
      { carbs: { ingredients: [{ ref: 17, weight: 100 }] }, format: { gelConsistency: 'thick' } },
      { format: { gelConsistency: 'isotonic' } },
      // Custom ingredients and salts
      {
        carbs: { custom: [{ key: 'c1', name: 'Oat syrup', carbsPer100g: 70, fructoseSharePct: 10 }], ingredients: [{ ref: 'c1', weight: 100 }] },
        salts: {
          mode: 'manual',
          custom: [{ key: 's1', name: 'Tabs', sodiumPct: 20, potassiumPct: 5, magnesiumPct: 0, calciumPct: 0, chloridePct: 30 }],
          manual: [{ ref: 's1', amountMg: 2000 }],
        },
      },
    ];
    for (const inputs of fixed) {
      const plan = computePlan(inputs);
      collectMessages(plan).forEach((m) => seen.add(m.key));
      checkPlan(plan, missing);
    }
    fc.assert(
      fc.property(inputsArb, (partial) => {
        const plan = computePlan(partial);
        collectMessages(plan).forEach((m) => seen.add(m.key));
        checkPlan(plan, missing);
      }),
      { numRuns: 1000 },
    );
    expect([...missing]).toEqual([]);
    // Sanity check that the walk reaches most of the catalog.
    expect(seen.size).toBeGreaterThan(100);
  });
});
