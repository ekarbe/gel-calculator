import { describe, it, expect, vi, afterEach } from 'vitest';
import fc from 'fast-check';
import {
  t,
  createT,
  hasMessage,
  MESSAGES,
  CATALOGS,
  LOCALE_CATALOGS,
  LOCALE_MESSAGES,
  LOCALES,
  DEFAULT_LOCALE,
  PLACEHOLDER_TYPES,
  placeholdersOf,
  placeholderNames,
  fillPlaceholders,
} from './index';
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
      const unfilled = text.match(/\{\w+(?::\w+)*\}/g);
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

describe('placeholders', () => {
  it('lists plain, typed and unit-less placeholders in order', () => {
    const text = 'Drink {mlPerHour:volume}/h, {lo:volumeL:nounit}–{hi:volumeL}/h, gel {gel}.';
    expect(placeholdersOf(text)).toEqual(['mlPerHour:volume', 'lo:volumeL:nounit', 'hi:volumeL', 'gel']);
    expect(placeholderNames(text)).toEqual(['mlPerHour', 'lo', 'hi', 'gel']);
    expect(placeholdersOf(undefined)).toEqual([]);
    expect(placeholderNames(42)).toEqual([]);
  });

  it('uses only known placeholder types in every catalog', () => {
    for (const [key, text] of Object.entries(MESSAGES)) {
      for (const token of placeholdersOf(text)) {
        const [, type, ...flags] = token.split(':');
        if (type !== undefined) expect(PLACEHOLDER_TYPES, `${key}: ${token}`).toContain(type);
        for (const flag of flags) expect(flag, `${key}: ${token}`).toBe('nounit');
      }
    }
  });

  it('types the quantity placeholders of the domain catalogs', () => {
    // Every ml, L, kg, % or °C right after a placeholder must come from a typed one.
    for (const [key, text] of Object.entries(MESSAGES)) {
      expect(text, key).not.toMatch(/\{\w+\} ?(ml|L\b|kg|%|°|km\/h|cm)/);
    }
  });

  it('writes no fixed volume, mass or temperature as literal text, so imperial converts them too', () => {
    // A literal "25 ml" or "1 kg" would stay metric in imperial; quantities go through typed placeholders.
    // Nutrients (g, mg, mg/L, mmol/L, mOsm/kg) and percentages are not converted, so they may be literal.
    const literal = /\b\d+(?:[.,]\d+)?\s?(ml|L|kg|°C|km\/h|cm)(?![\w/])/;
    for (const [key, text] of Object.entries(MESSAGES)) {
      if (key.startsWith('ui-dialogs.templates.data.')) continue; // product label prose, quoted as printed
      expect(text, key).not.toMatch(literal);
    }
  });
});

describe('createT', () => {
  const metric = createT('en', { unitSystem: 'metric' });
  const imperial = createT('en', { unitSystem: 'imperial' });
  const de = createT('de', { unitSystem: 'metric' });

  it('is the module t for English metric, cached per locale, units and currency', () => {
    expect(createT()).toBe(t);
    expect(createT('en', { unitSystem: 'metric', currency: 'EUR' })).toBe(t);
    expect(createT('en', { unitSystem: 'imperial' })).toBe(imperial);
    expect(createT('xx')).toBe(t);
    expect(t.locale).toBe('en');
    expect(t.unitSystem).toBe('metric');
    expect(imperial.unitSystem).toBe('imperial');
    expect(de.locale).toBe('de');
    expect(Object.isFrozen(t)).toBe(true);
  });

  it('keeps every English sentence unchanged in metric', () => {
    expect(metric('fluid.why.plan', { mlPerHour: 800, sharePct: 80, sweatMlPerHour: 1250, maxMlPerHour: 800 })).toBe(
      'Drink about 800 ml/h. This replaces roughly 80% of your sweat loss of 1,250 ml/h, capped at 800 ml/h. Drinking less than you sweat avoids weight gain.',
    );
    expect(metric('sweat.why.test', { rateLph: 1.36, uncertaintyLph: 0.15, lo: 1.21, hi: 1.51 })).toBe(
      'Your sweat test gives 1.36 L/h for this event. A careful test is accurate to about ±0.15 L/h, so your rate is likely 1.21–1.51 L/h.',
    );
    expect(metric('bicarb.why.dose', { gPerKg: 0.3, massKg: 70, doseG: 21 })).toBe('Your dose is 0.3 g/kg for 70 kg, or 21 g.');
    expect(metric('recipe.water.drink', { ml: 600 })).toBe('Water, to fill each bottle to 600 ml');
    expect(metric('concentration.warn.syrupsThinner', { targetPct: 60, pct: 52.5 })).toContain('more than a 60% gel');
    expect(metric('fluid.warn.deficitMild', { deficitL: 1.35, deficitPct: 1.9, limitPct: 2 })).toBe(
      'With this plan you would lose about 1.35 L of water, 1.9% of your body mass. Losses above 2% can start to hurt performance, mostly in the heat.',
    );
    expect(metric('carbs.warn.tooLittleFructose', { gPerHour: 95, minRatio: '1:0.55' })).toContain('use at least 1:0.55 glucose');
    // A mass is written as a mass (1 L of water is 1 kg; the old text said "0.18 L of mass").
    expect(metric('sweat.why.testCorrection', { correctionL: 0.18, energyKcal: 913 })).toBe(
      'The test result leaves out 0.18 kg of mass you lost by burning about 913 kcal. That loss comes from fuel and breathing, not sweat.',
    );
  });

  it('converts typed quantities to imperial units', () => {
    expect(imperial('fluid.warn.aboveCeiling', { mlPerHour: 1000, maxMlPerHour: 800 })).toBe(
      'You plan to drink 34 fl oz/h. Guidelines suggest up to 27 fl oz/h. Larger amounts can upset your stomach.',
    );
    expect(imperial('sweat.why.test', { rateLph: 1.36, uncertaintyLph: 0.15, lo: 1.21, hi: 1.51 })).toBe(
      'Your sweat test gives 46 fl oz/h for this event. A careful test is accurate to about ±5.1 fl oz/h, so your rate is likely 41–51 fl oz/h.',
    );
    expect(imperial('bicarb.why.dose', { gPerKg: 0.3, massKg: 70, doseG: 21 })).toBe('Your dose is 0.3 g/kg for 154.3 lb, or 21 g.');
    expect(imperial('schedule.fuelWithFluid', { gel: 2, fluidMl: 150 })).toBe('Take gel 2 with about 5.1 fl oz fluid.');
    // Nutrients and percentages are never converted.
    expect(imperial('electrolytes.warn.sodiumHigh', { mgPerHour: 1200, limitMgPerHour: 1000 })).toContain('1,200 mg/h');
    expect(imperial('fluid.warn.deficitMild', { deficitL: 1.35, deficitPct: 1.9, limitPct: 2 })).toContain('46 fl oz of water, 1.9% of');
    // A mass stays a mass in imperial (lb, never fl oz).
    expect(imperial('sweat.why.testCorrection', { correctionL: 0.4, energyKcal: 2000 })).toContain('leaves out 0.9 lb of mass');
    // The sweat-test rule and the mouth rinse follow the unit system the test form and the drink use.
    expect(metric('sweat.why.measure', { lossKg: 1, sweatL: 1 })).toMatch(/ Count 1 kg as 1 L\.$/);
    expect(imperial('sweat.why.measure', { lossKg: 1, sweatL: 1 })).toMatch(/ Count 2\.2 lb as 34 fl oz\.$/);
    expect(metric('carbs.mouthRinse.howTo', { rinseMl: 25 })).toContain('Swish 25 ml of a 6–8% maltodextrin drink');
    expect(imperial('carbs.mouthRinse.howTo', { rinseMl: 25 })).toContain('Swish 0.8 fl oz of a 6–8% maltodextrin drink');
  });

  it('writes German text with German numbers and typed values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(de('fluid.warn.aboveSweat', { mlPerHour: 1500, sweatMlPerHour: 1250.5 })).toContain('Du planst 1.500 ml/h zu trinken.');
    expect(de('sweat.why.preset', { rateLph: 1.25, lo: 0.75, hi: 1.75 })).toBe(
      'Du hast eine Schweißrate von 1,25 L/h gewählt. Eine Selbsteinschätzung ist grob, deine tatsächliche Rate liegt also wahrscheinlich bei 0,75–1,75 L/h.',
    );
    expect(de('concentration.warn.drinkStrong', { pct: 9.5, limitPct: 8 })).toBe(
      'Jede Flasche enthält 9,5 % Kohlenhydrate. Über 8 % verlässt ein Getränk den Magen langsamer. Teste es im Training.',
    );
    expect(de('carbs.warn.ratioNotReachable', { target: '1:0.5', achievable: '1:0.25' })).toContain(
      'Mit deinen Zutaten ist 1:0,5 Glukose zu Fruktose nicht möglich. Das Rezept nutzt 1:0,25,',
    );
    expect(de('carbs.ratio.why.medium', { fructose: 0.5 })).toContain('Nimm 1:0,5 Glukose zu Fruktose');
    expect(de('schedule.fuel', { gel: -1234 })).toBe('Nimm Gel −1.234.');
    expect(de('bicarb.why.dose', { gPerKg: 0.3, massKg: 70, doseG: 21 })).toBe('Deine Dosis: 0,3 g/kg bei 70 kg, also 21 g.');
    expect(de('fluid.warn.deficitMild', { deficitL: 1.35, deficitPct: 1.9, limitPct: 2 })).toContain(
      'etwa 1,35 L Wasser verlieren, 1,9 % deines Körpergewichts',
    );
    expect(de('ui-common.why')).toBe('Warum?');
    // Every key has German text, so nothing falls back.
    expect(warn).not.toHaveBeenCalled();
  });

  it('converts typed quantities to imperial units in German too', () => {
    const deImperial = createT('de', { unitSystem: 'imperial' });
    expect(deImperial('fluid.warn.aboveCeiling', { mlPerHour: 1000, maxMlPerHour: 800 })).toBe(
      'Du planst 34 fl oz/h zu trinken. Leitlinien empfehlen bis zu 27 fl oz/h. Größere Mengen können deinen Magen belasten.',
    );
    expect(deImperial('schedule.fuelWithFluid', { gel: 2, fluidMl: 150 })).toBe('Nimm Gel 2 mit etwa 5,1 fl oz Flüssigkeit.');
    expect(deImperial('bicarb.why.dose', { gPerKg: 0.3, massKg: 70, doseG: 21 })).toBe('Deine Dosis: 0,3 g/kg bei 154,3 lb, also 21 g.');
    // Nutrients stay in mg in every unit system.
    expect(deImperial('electrolytes.warn.sodiumHigh', { mgPerHour: 1200, limitMgPerHour: 1000 })).toContain('1.200 mg/h');
  });

  it('falls back to English for a key German lacks, and warns once per locale and key', async () => {
    // A German catalog without its keys, in a fresh copy of this module.
    vi.resetModules();
    vi.doMock('./de/ui-common', () => ({ default: {} }));
    try {
      const fresh = await import('./index');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const deFresh = fresh.createT('de');
      const key = 'ui-common.close';
      expect(fresh.hasMessage(key, 'de')).toBe(false);
      expect(deFresh(key)).toBe('Close');
      expect(deFresh(key)).toBe('Close');
      expect(deFresh('ui-common.increase', { label: 1234.5 })).toBe('Increase 1.234,5');
      expect(warn.mock.calls.filter(([text]) => text.includes(`[i18n] Missing de message: ${key} (using en)`))).toHaveLength(1);
    } finally {
      vi.doUnmock('./de/ui-common');
      vi.resetModules();
    }
  });

  it('leaves typed placeholders without a value as written', () => {
    expect(imperial('recipe.water.drink')).toBe('Water, to fill each bottle to {ml:volume}');
    expect(imperial('recipe.water.drink', { ml: null })).toBe('Water, to fill each bottle to {ml:volume}');
  });

  it('accepts numeric strings for typed placeholders and keeps other strings', () => {
    expect(imperial('recipe.water.drink', { ml: '600' })).toBe('Water, to fill each bottle to 20 fl oz');
    expect(imperial('recipe.water.drink', { ml: 'lots of' })).toBe('Water, to fill each bottle to lots of');
    expect(metric('schedule.fuel', { gel: 'two' })).toBe('Take gel two.');
  });

  it('formats every placeholder type', () => {
    const fill = (template, params) => fillPlaceholders(template, params, { locale: 'en', unitSystem: 'imperial', currency: 'USD' });
    expect(fill('{v:temp}', { v: 20 })).toBe('68 °F');
    expect(fill('{v:speed}', { v: 30 })).toBe('18.6 mph');
    expect(fill('{v:height}', { v: 175 })).toBe('5 ft 9 in');
    expect(fill('{v:pace}', { v: 5 })).toBe('8:03 min/mi');
    expect(fill('{v:pace:nounit}', { v: 5 })).toBe('8:03');
    expect(fill('{v:integer}', { v: 2.6 })).toBe('3');
    expect(fill('{v:currency}', { v: 3.375 })).toBe('$3.38');
    expect(fill('{v:ratio}', { v: { glucose: 2, fructose: 1 } })).toBe('1:0.5');
    expect(fill('{v:ratio}', { v: 3 })).toBe('3');
    expect(fill('{v:unknown}', { v: 1234.5678 })).toBe('1,234.568');
    expect(fill('{v:mass:nounit}', { v: 70 })).toBe('154.3');
    expect(fill('{v:volumeL}', { v: 0.15 })).toBe('5.1 fl oz');
    expect(fill('{v:percent}', { v: 12.25 })).toBe('12.25%');
    expect(fill('{a} and {b}', { a: 1 })).toBe('1 and {b}');
    expect(fill('no placeholders', undefined)).toBe('no placeholders');
    const metricFill = (template, params) => fillPlaceholders(template, params);
    expect(metricFill('{v:temp}', { v: 20.25 })).toBe('20.25 °C');
    expect(metricFill('{v:height}', { v: 175 })).toBe('175 cm');
    expect(metricFill('{v:currency}', { v: 3.375 })).toBe('€3.38');
    expect(fillPlaceholders('{v:currency}', { v: 3.375 }, { locale: 'de', currency: 'EUR' })).toBe('3,38\u00a0€');
  });
});

describe('catalogs per locale', () => {
  it('registers English and German catalogs under the same namespaces', () => {
    expect(LOCALES).toEqual(['en', 'de']);
    expect(DEFAULT_LOCALE).toBe('en');
    expect(LOCALE_CATALOGS.en).toBe(CATALOGS);
    expect(LOCALE_MESSAGES.en).toBe(MESSAGES);
    expect(Object.isFrozen(LOCALE_MESSAGES.de)).toBe(true);
    expect(Object.keys(LOCALE_CATALOGS.de)).toEqual(Object.keys(CATALOGS));
  });

  it('registers every UI namespace', () => {
    for (const name of [
      'ui-common',
      'ui-setup',
      'ui-setup-event',
      'ui-setup-sweat',
      'ui-setup-targets',
      'ui-setup-recipe',
      'ui-recipe',
      'ui-board',
      'ui-schedule',
      'ui-print',
      'ui-dialogs',
      'ui-guided',
      'ui-shell',
    ]) {
      expect(CATALOGS, name).toHaveProperty([name]);
    }
  });

  it('has a German twin for every English catalog, with the same keys and placeholders', () => {
    for (const [name, en] of Object.entries(CATALOGS)) {
      const catalog = LOCALE_CATALOGS.de[name];
      expect(catalog, `en/${name} has no de twin`).toBeDefined();
      expect(Object.keys(catalog).sort(), name).toEqual(Object.keys(en).sort());
      for (const [key, text] of Object.entries(catalog)) {
        // The same placeholders, each as often as in English, with the same {name:type} suffixes.
        expect(placeholdersOf(text).sort(), key).toEqual(placeholdersOf(en[key]).sort());
      }
    }
    for (const name of Object.keys(LOCALE_CATALOGS.de)) {
      expect(CATALOGS[name], `de/${name} has no en twin`).toBeDefined();
    }
    expect(Object.keys(LOCALE_MESSAGES.de).sort()).toEqual(Object.keys(MESSAGES).sort());
  });

  it('holds only non-empty German strings, written the German way', () => {
    for (const [key, text] of Object.entries(LOCALE_MESSAGES.de)) {
      expect(typeof text, key).toBe('string');
      expect(text.trim(), key).not.toBe('');
      // Quantities come from typed placeholders, as in English.
      expect(text, key).not.toMatch(/\{\w+\} ?(ml|L\b|kg|%|°|km\/h|cm)/);
      // Literal decimals use a comma ("2,5 h", "1:0,8"); "1.150" is a thousands separator.
      expect(text, key).not.toMatch(/\d\.\d{1,2}(?!\d)/);
      // A space before the percent sign ("50 %"), German quotes („…“).
      expect(text, key).not.toMatch(/\d%/);
      expect(text, key).not.toMatch(/[”]/);
    }
  });

  it('hasMessage looks at one locale only', () => {
    expect(hasMessage('schedule.fuel')).toBe(true);
    expect(hasMessage('schedule.fuel', 'en')).toBe(true);
    expect(hasMessage('schedule.fuel', 'xx')).toBe(true);
    expect(hasMessage('schedule.fuel', 'de')).toBe(true);
    expect(LOCALE_MESSAGES.de['schedule.fuel']).toBe('Nimm Gel {gel}.');
  });
});
