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
const inputsArb = fc.record(
  {
    event: fc.record(
      {
        durationMin: fc.oneof(fc.integer({ min: 0, max: 600 }), fc.constantFrom(0, 30, 44, 45, 60, 74, 75, 90, 119, 120, 150, 151, 180, 181, 240, 241, 2880)),
        intensity: fc.constantFrom(...INPUT_OPTIONS.intensity),
        highCarb: fc.boolean(),
      },
      { requiredKeys: [] },
    ),
    athlete: fc.record({ massKg: fc.integer({ min: 30, max: 200 }), sex: fc.constantFrom(...INPUT_OPTIONS.sex) }, { requiredKeys: [] }),
    environment: fc.record({ tempC: fc.integer({ min: -20, max: 50 }), humidity: fc.integer({ min: 0, max: 100 }) }, { requiredKeys: [] }),
    sweat: fc.record(
      {
        source: fc.constantFrom(...INPUT_OPTIONS.sweatSource),
        rateIndex: fc.integer({ min: 0, max: 5 }),
        saltinessIndex: fc.integer({ min: 0, max: 5 }),
      },
      { requiredKeys: [] },
    ),
    carbs: fc.record(
      {
        mode: fc.constantFrom(...INPUT_OPTIONS.mode),
        manualGPerHour: fc.integer({ min: 0, max: 200 }),
        ratioMode: fc.constantFrom(...INPUT_OPTIONS.mode),
        manualRatio: fc.record({ glucose: fc.double({ min: 0, max: 2, noNaN: true }), fructose: fc.double({ min: 0, max: 2, noNaN: true }) }),
        fructoseSources: fc.constantFrom([], [{ id: 11, percentage: 100 }], [{ id: 18, percentage: 100 }]),
      },
      { requiredKeys: [] },
    ),
    sodium: fc.record({ mode: fc.constantFrom(...INPUT_OPTIONS.mode), manualMgPerHour: fc.integer({ min: 0, max: 5000 }) }, { requiredKeys: [] }),
    extras: fc.record({ potassium: fc.boolean(), magnesium: fc.boolean(), calcium: fc.boolean() }, { requiredKeys: [] }),
    salts: fc.record(
      {
        mode: fc.constantFrom(...INPUT_OPTIONS.mode),
        sodiumSalt: fc.constantFrom(...INPUT_OPTIONS.sodiumSalt),
        manual: fc.array(fc.record({ id: fc.constantFrom(31, 33, 39), amountMg: fc.integer({ min: 0, max: 20000 }) }), { maxLength: 3 }),
      },
      { requiredKeys: [] },
    ),
    fluid: fc.record({ mode: fc.constantFrom(...INPUT_OPTIONS.mode), manualMlPerHour: fc.integer({ min: 0, max: 3000 }) }, { requiredKeys: [] }),
    format: fc.record({ gelsPerHour: fc.constantFrom(0, 0.5, 1, 2, 3, 4, 6, 12), view: fc.constantFrom(...INPUT_OPTIONS.view) }, { requiredKeys: [] }),
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
    const fixed = [
      DEFAULT_INPUTS,
      { event: { durationMin: 30 } },
      { event: { durationMin: 60 }, caffeine: { enabled: true } },
      { event: { durationMin: 45 }, bicarb: { enabled: true } },
      { event: { durationMin: 75 }, bicarb: { enabled: true } },
      { event: { durationMin: 300, highCarb: true, intensity: 'race' }, caffeine: { enabled: true, asIngredient: true, mgPerKg: 6 } },
      { event: { durationMin: 120, highCarb: true }, sweat: { source: 'estimate' } },
      { carbs: { mode: 'manual', manualGPerHour: 150, ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } },
      { carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 0 }, fructoseSources: [] } },
      { carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 2 } } },
      { sodium: { mode: 'manual', manualMgPerHour: 3000 }, fluid: { mode: 'manual', manualMlPerHour: 2500 } },
      { sodium: { mode: 'manual', manualMgPerHour: 1200 }, fluid: { mode: 'manual', manualMlPerHour: 300 } },
      { sweat: { rateIndex: 5 }, fluid: { mode: 'manual', manualMlPerHour: 1000 } },
      { extras: { potassium: true, magnesium: true, calcium: true }, format: { gelsPerHour: 0 } },
      { caffeine: { enabled: true }, format: { gelsPerHour: 0 } },
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
    expect(seen.size).toBeGreaterThan(60);
  });
});
