import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  DEFAULT_INPUTS,
  INPUT_LIMITS,
  INPUT_OPTIONS,
  normalizeInputs,
  computePlan,
  templateToInputs,
  ingredientsFromV3Sources,
  speedForSport,
  SPORT_SPEED_RANGE_KMH,
  SPORT_DEFAULT_SPEED_KMH,
} from './plan';
import { CITATIONS } from './evidence';
import { TEMPLATES } from '../constants/templates';

/** Collects every value of `citations` arrays anywhere in `value`. */
function collectCitationIds(value, out = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((v) => collectCitationIds(v, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'citations' && Array.isArray(v)) v.forEach((id) => out.add(id));
      else collectCitationIds(v, out);
    }
  }
  return out;
}

/**
 * Numbers the domain documents as possibly infinite: the heat-balance
 * wettedness when the air takes up no sweat (heatBalance.js), and an
 * osmolality with solutes but no water at all (concentration.js). The recipe
 * sections copy only finite osmolalities.
 */
const DOCUMENTED_INFINITY = [
  /^plan\.sweat\.estimate\.wettedness$/,
  /^plan\.concentration\.(gel|drink(\.perBottle)?)\.osmolality\.mOsmPerKg$/,
];

/** Paths of every number in `value` that is NaN, or infinite where the domain does not document it. */
function badNumbers(value, path = 'plan', out = []) {
  if (typeof value === 'number') {
    if (Number.isNaN(value)) out.push(`${path} = NaN`);
    else if (!Number.isFinite(value) && !DOCUMENTED_INFINITY.some((re) => re.test(path))) out.push(`${path} = ${value}`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => badNumbers(v, `${path}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) badNumbers(v, `${path}.${k}`, out);
  }
  return out;
}

const ids = (warnings) => warnings.map((w) => w.id);

/** The Phase 1 sweat preset (1.25 L/h, 40 mmol/L): keeps the fluid and sodium examples of Phase 1. */
const PRESET = Object.freeze({ source: 'preset' });

/** A number field: mostly in range, sometimes out of range or junk. */
const numberish = ([lo, hi]) =>
  fc.oneof(
    { weight: 4, arbitrary: fc.double({ min: lo, max: hi, noNaN: true }) },
    { weight: 1, arbitrary: fc.double({ min: lo - 10 * (hi - lo + 1), max: hi + 10 * (hi - lo + 1), noNaN: true }) },
    { weight: 1, arbitrary: fc.constantFrom(NaN, Infinity, -Infinity, null, undefined, '', '42', 'abc', true, {}, []) },
  );
const enumish = (values) => fc.oneof({ weight: 4, arbitrary: fc.constantFrom(...values) }, { weight: 1, arbitrary: fc.anything() });
const boolish = fc.oneof({ weight: 4, arbitrary: fc.boolean() }, { weight: 1, arbitrary: fc.anything() });
const listish = (item, maxLength) =>
  fc.oneof({ weight: 4, arbitrary: fc.array(item, { maxLength }) }, { weight: 1, arbitrary: fc.anything() });
const partialRecord = (shape) => fc.record(shape, { requiredKeys: [] });
const textish = fc.oneof(fc.string({ maxLength: 70 }), fc.constantFrom(undefined, null, 3, '  Rice  syrup  '));

const conditionsArb = partialRecord({
  sport: enumish(INPUT_OPTIONS.sport),
  speedKmh: numberish(INPUT_LIMITS.speedKmh),
  powerW: numberish(INPUT_LIMITS.powerW),
  mets: numberish(INPUT_LIMITS.mets),
  setting: enumish(INPUT_OPTIONS.setting),
  tempC: numberish(INPUT_LIMITS.tempC),
  humidity: numberish(INPUT_LIMITS.humidity),
  sun: enumish(INPUT_OPTIONS.sun),
});
const sweatTestArb = partialRecord({
  id: fc.oneof(fc.constantFrom('a', 'b', 't1', 't2', 'bad id!', ''), fc.anything()),
  date: fc.constantFrom('2026-07-01', '', 'yesterday', undefined),
  label: textish,
  preKg: numberish([40, 120]),
  postKg: numberish([40, 120]),
  fluidL: numberish([0, 3]),
  urineL: numberish([0, 1]),
  durationMin: numberish([0, 240]),
  conditions: fc.oneof(conditionsArb, fc.anything()),
});
const customCarbArb = partialRecord({
  key: fc.constantFrom('c1', 'c2', 'c3', 'c10', 'c11', 'x'),
  name: textish,
  carbsPer100g: numberish(INPUT_LIMITS.labelPct),
  fructoseSharePct: numberish(INPUT_LIMITS.labelPct),
  waterPct: numberish(INPUT_LIMITS.labelPct),
});
const customSaltArb = partialRecord({
  key: fc.constantFrom('s1', 's2', 's10', 's0', 'c1'),
  name: textish,
  sodiumPct: numberish(INPUT_LIMITS.labelPct),
  potassiumPct: numberish(INPUT_LIMITS.labelPct),
  magnesiumPct: numberish(INPUT_LIMITS.labelPct),
  calciumPct: numberish(INPUT_LIMITS.labelPct),
  chloridePct: numberish(INPUT_LIMITS.labelPct),
});
const v3SourceListish = (idPool) =>
  listish(fc.record({ id: fc.constantFrom(...idPool), percentage: numberish([0, 200]) }), 4);

/** Random partial v4 inputs (with some v3 fields): mostly plausible values, with junk mixed in. */
const partialInputsArb = partialRecord({
  event: partialRecord({
    durationMin: numberish([0, 600]),
    intensity: enumish(INPUT_OPTIONS.intensity),
    highCarb: boolish,
    sport: enumish(INPUT_OPTIONS.sport),
    speedKmh: numberish(INPUT_LIMITS.speedKmh),
    powerW: numberish(INPUT_LIMITS.powerW),
    mets: numberish(INPUT_LIMITS.mets),
    setting: enumish(INPUT_OPTIONS.setting),
  }),
  athlete: partialRecord({
    massKg: numberish(INPUT_LIMITS.massKg),
    heightCm: numberish(INPUT_LIMITS.heightCm),
    acclimatised: boolish,
    sex: enumish(['unspecified', 'female', 'male']),
  }),
  environment: partialRecord({
    tempC: numberish(INPUT_LIMITS.tempC),
    humidity: numberish(INPUT_LIMITS.humidity),
    sun: enumish(INPUT_OPTIONS.sun),
  }),
  sweat: partialRecord({
    source: enumish(INPUT_OPTIONS.sweatSource),
    rateIndex: numberish(INPUT_LIMITS.presetIndex),
    saltinessIndex: numberish(INPUT_LIMITS.presetIndex),
    tests: listish(sweatTestArb, 4),
    selectedTestId: fc.constantFrom(null, 'a', 'b', 't1', 'zzz', 5),
    calibrate: boolish,
  }),
  carbs: partialRecord({
    mode: enumish(INPUT_OPTIONS.mode),
    manualGPerHour: numberish(INPUT_LIMITS.manualGPerHour),
    ratioMode: enumish(INPUT_OPTIONS.mode),
    manualRatio: partialRecord({ glucose: numberish([0, 2]), fructose: numberish([0, 2]) }),
    ingredients: listish(
      fc.record({
        ref: fc.constantFrom(1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 31, 99, '3', 'c1', 'c2', 'c3', 'x'),
        weight: numberish(INPUT_LIMITS.ingredientWeight),
      }),
      6,
    ),
    custom: listish(customCarbArb, 4),
    glucoseSources: v3SourceListish([1, 2, 3, 4, 5, 6, 7, 8, 11, 31]),
    fructoseSources: v3SourceListish([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 3, 99]),
  }),
  sodium: partialRecord({ mode: enumish(INPUT_OPTIONS.mode), manualMgPerHour: numberish([0, 2500]) }),
  extras: partialRecord({ potassium: boolish, magnesium: boolish, calcium: boolish }),
  salts: partialRecord({
    mode: enumish(INPUT_OPTIONS.mode),
    sodiumSalt: enumish(INPUT_OPTIONS.sodiumSalt),
    manual: listish(
      fc.oneof(
        fc.record({ ref: fc.constantFrom(31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 3, 's1', 's2', 'zz'), amountMg: numberish([0, 20000]) }),
        fc.record({ id: fc.constantFrom(31, 33, 39), amountMg: numberish([0, 20000]) }),
      ),
      5,
    ),
    custom: listish(customSaltArb, 3),
  }),
  fluid: partialRecord({ mode: enumish(INPUT_OPTIONS.mode), manualMlPerHour: numberish([0, 2000]) }),
  format: partialRecord({
    type: enumish(INPUT_OPTIONS.formatType),
    gelsPerHour: numberish(INPUT_LIMITS.gelsPerHour),
    view: enumish([...INPUT_OPTIONS.view, 'perGel']),
    gelConsistency: enumish(INPUT_OPTIONS.gelConsistency),
    bottleMl: numberish(INPUT_LIMITS.bottleMl),
    drinkCarbSharePct: numberish(INPUT_LIMITS.drinkCarbSharePct),
  }),
  caffeine: partialRecord({
    enabled: boolish,
    mgPerKg: numberish(INPUT_LIMITS.caffeineMgPerKg),
    asIngredient: boolish,
    tabletMg: enumish(INPUT_OPTIONS.tabletMg),
  }),
  bicarb: partialRecord({ enabled: boolish, gPerKg: numberish(INPUT_LIMITS.bicarbGPerKg) }),
});

describe('DEFAULT_INPUTS', () => {
  it('matches the v4 schema in the spec', () => {
    expect(DEFAULT_INPUTS).toEqual({
      event: {
        durationMin: 180,
        intensity: 'moderate',
        highCarb: false,
        sport: 'cycling',
        speedKmh: 30,
        powerW: 0,
        mets: 8,
        setting: 'outdoor',
      },
      athlete: { massKg: 70, heightCm: 175, acclimatised: false },
      environment: { tempC: 20, humidity: 50, sun: 'none' },
      sweat: { source: 'estimate', rateIndex: 2, saltinessIndex: 2, tests: [], selectedTestId: null, calibrate: true },
      carbs: {
        mode: 'auto',
        manualGPerHour: 60,
        ratioMode: 'auto',
        manualRatio: { glucose: 1, fructose: 0.8 },
        ingredients: [
          { ref: 3, weight: 67 },
          { ref: 11, weight: 33 },
        ],
        custom: [],
      },
      sodium: { mode: 'auto', manualMgPerHour: 500 },
      extras: { potassium: false, magnesium: false, calcium: false },
      salts: { mode: 'auto', sodiumSalt: 'table', manual: [], custom: [] },
      fluid: { mode: 'auto', manualMlPerHour: 500 },
      format: { type: 'gel', gelsPerHour: 3, view: 'total', gelConsistency: 'standard', bottleMl: 750, drinkCarbSharePct: 50 },
      caffeine: { enabled: false, mgPerKg: 3, asIngredient: false, tabletMg: 100 },
      bicarb: { enabled: false, gPerKg: 0.3 },
    });
  });

  it('is deeply frozen', () => {
    expect(Object.isFrozen(DEFAULT_INPUTS)).toBe(true);
    expect(Object.isFrozen(DEFAULT_INPUTS.carbs.ingredients[0])).toBe(true);
    expect(Object.isFrozen(INPUT_LIMITS.speedKmh)).toBe(true);
    expect(Object.isFrozen(INPUT_OPTIONS.sport)).toBe(true);
  });

  it('exports the v4 options and limits for the controls', () => {
    expect(INPUT_OPTIONS.sport).toEqual(['running', 'cycling', 'other']);
    expect(INPUT_OPTIONS.setting).toEqual(['outdoor', 'indoorFan', 'indoorNoFan']);
    expect(INPUT_OPTIONS.sun).toEqual(['none', 'partly', 'full']);
    expect(INPUT_OPTIONS.sweatSource).toEqual(['test', 'estimate', 'preset']);
    expect(INPUT_OPTIONS.formatType).toEqual(['gel', 'drink', 'both']);
    expect(INPUT_OPTIONS.view).toEqual(['total', 'perServing']);
    expect(INPUT_OPTIONS.gelConsistency).toEqual(['isotonic', 'liquid', 'standard', 'thick']);
    expect(INPUT_OPTIONS).not.toHaveProperty('sex');
    expect(INPUT_LIMITS).toMatchObject({
      heightCm: [120, 220],
      speedKmh: [3, 70],
      powerW: [0, 2000],
      mets: [1, 20],
      bottleMl: [250, 1500],
      drinkCarbSharePct: [0, 100],
      ingredientWeight: [0, 100],
      sweatTests: [0, 20],
      customIngredients: [0, 10],
      customSalts: [0, 10],
    });
  });
});

describe('normalizeInputs', () => {
  it('returns unfrozen copies of the defaults for empty or junk input', () => {
    for (const junk of [undefined, null, 42, 'x', [], () => {}, new Date(0)]) {
      const result = normalizeInputs(junk);
      expect(result).toEqual(DEFAULT_INPUTS);
      expect(result).not.toBe(DEFAULT_INPUTS);
      expect(Object.isFrozen(result.carbs.ingredients)).toBe(false);
    }
  });

  it('deep-merges a partial onto the defaults and drops unknown keys', () => {
    const result = normalizeInputs({
      event: { durationMin: 240, sport: 'running', extra: 1 },
      carbs: { manualRatio: { fructose: 0.5 } },
      unknownSection: { a: 1 },
    });
    expect(result.event).toEqual({ ...DEFAULT_INPUTS.event, durationMin: 240, sport: 'running' });
    expect(result.carbs.manualRatio).toEqual({ glucose: 1, fructose: 0.5 });
    expect(result).not.toHaveProperty('unknownSection');
  });

  it('clamps numbers to the spec bounds', () => {
    const low = normalizeInputs({
      event: { durationMin: -5, speedKmh: 0, powerW: -1, mets: 0 },
      athlete: { massKg: 1, heightCm: 50 },
      environment: { tempC: -100, humidity: -1 },
      carbs: { manualGPerHour: -1, manualRatio: { glucose: -1, fructose: -1 }, ingredients: [{ ref: 3, weight: -5 }] },
      sodium: { manualMgPerHour: -1 },
      fluid: { manualMlPerHour: -1 },
      format: { gelsPerHour: -1, bottleMl: 0, drinkCarbSharePct: -10 },
      caffeine: { mgPerKg: 0 },
      bicarb: { gPerKg: 0 },
    });
    expect(low.event).toMatchObject({ durationMin: 0, speedKmh: 3, powerW: 0, mets: 1 });
    expect(low.athlete).toMatchObject({ massKg: 30, heightCm: 120 });
    expect(low.environment).toMatchObject({ tempC: -20, humidity: 0 });
    expect(low.carbs.manualGPerHour).toBe(0);
    expect(low.carbs.manualRatio).toEqual({ glucose: 0, fructose: 0 });
    expect(low.carbs.ingredients).toEqual([{ ref: 3, weight: 0 }]);
    expect(low.sodium.manualMgPerHour).toBe(0);
    expect(low.fluid.manualMlPerHour).toBe(0);
    expect(low.format).toMatchObject({ gelsPerHour: 0, bottleMl: 250, drinkCarbSharePct: 0 });
    expect(low.caffeine.mgPerKg).toBe(1);
    expect(low.bicarb.gPerKg).toBe(0.2);

    const high = normalizeInputs({
      event: { durationMin: 1e9, speedKmh: 1e9, powerW: 1e9, mets: 1e9 },
      athlete: { massKg: 1e9, heightCm: 1e9 },
      environment: { tempC: 1e9, humidity: 1e9 },
      carbs: { manualGPerHour: 1e9, manualRatio: { glucose: 1e9, fructose: 1e9 }, ingredients: [{ ref: 3, weight: 1e9 }] },
      sodium: { manualMgPerHour: 1e9 },
      fluid: { manualMlPerHour: 1e9 },
      format: { gelsPerHour: 1e9, bottleMl: 1e9, drinkCarbSharePct: 1e9 },
      caffeine: { mgPerKg: 1e9 },
      bicarb: { gPerKg: 1e9 },
    });
    expect(high.event).toMatchObject({ durationMin: 2880, speedKmh: 70, powerW: 2000, mets: 20 });
    expect(high.athlete).toMatchObject({ massKg: 200, heightCm: 220 });
    expect(high.environment).toMatchObject({ tempC: 50, humidity: 100 });
    expect(high.carbs.manualGPerHour).toBe(200);
    expect(high.carbs.manualRatio).toEqual({ glucose: 5, fructose: 5 });
    expect(high.carbs.ingredients).toEqual([{ ref: 3, weight: 100 }]);
    expect(high.sodium.manualMgPerHour).toBe(5000);
    expect(high.fluid.manualMlPerHour).toBe(3000);
    expect(high.format).toMatchObject({ gelsPerHour: 12, bottleMl: 1500, drinkCarbSharePct: 100 });
    expect(high.caffeine.mgPerKg).toBe(6);
    expect(high.bicarb.gPerKg).toBe(0.3);
  });

  it('falls back to defaults for non-finite numbers, wrong types and unknown enums', () => {
    const result = normalizeInputs({
      event: { durationMin: NaN, intensity: 'sprint', highCarb: 'yes', sport: 'rowing', setting: 'cave', speedKmh: 'fast' },
      athlete: { massKg: Infinity, heightCm: null, acclimatised: 'yes' },
      environment: { tempC: -Infinity, humidity: {}, sun: 'blazing' },
      sweat: { source: 'guess', rateIndex: NaN, saltinessIndex: null, calibrate: 0, tests: 'none', selectedTestId: 3 },
      carbs: { ingredients: 'none', custom: 'none' },
      format: { type: 'bar', gelsPerHour: 'lots', view: 'perBottle', gelConsistency: 'solid', bottleMl: 'big' },
      caffeine: { tabletMg: 150, enabled: 1 },
      salts: { sodiumSalt: 'sea', mode: 'auto-ish', custom: {} },
    });
    expect(result).toEqual(DEFAULT_INPUTS);
  });

  it('coerces numeric strings, as form fields deliver them', () => {
    const result = normalizeInputs({
      event: { durationMin: '95', speedKmh: '12.5' },
      caffeine: { tabletMg: '200' },
      carbs: { ingredients: [{ ref: '1', weight: '50' }] },
      salts: { manual: [{ ref: '31', amountMg: '1200' }] },
    });
    expect(result.event.durationMin).toBe(95);
    expect(result.event.speedKmh).toBe(12.5);
    expect(result.caffeine.tabletMg).toBe(200);
    expect(result.carbs.ingredients).toEqual([{ ref: 1, weight: 50 }]);
    expect(result.salts.manual).toEqual([{ ref: 31, amountMg: 1200 }]);
  });

  it('rounds and clamps sweat preset indices to integers 0–5', () => {
    expect(normalizeInputs({ sweat: { rateIndex: 3.6, saltinessIndex: -2 } }).sweat).toMatchObject({
      rateIndex: 4,
      saltinessIndex: 0,
    });
    expect(normalizeInputs({ sweat: { rateIndex: 99 } }).sweat.rateIndex).toBe(5);
  });

  it('snaps gels per hour to 0.01, so subnormal rates become 0', () => {
    expect(normalizeInputs({ format: { gelsPerHour: 10 / 3 } }).format.gelsPerHour).toBe(3.33);
    // 60 / 5e-324 overflows to Infinity and getGelTimes would return [NaN].
    expect(normalizeInputs({ format: { gelsPerHour: 5e-324 } }).format.gelsPerHour).toBe(0);
    expect(computePlan({ format: { gelsPerHour: 5e-324 } }).gels).toEqual({ perHour: 0, count: 0, times: [] });
  });

  it('snaps the manual fluid rate to 0.01 ml/h, so a subnormal rate cannot overflow a drink', () => {
    expect(normalizeInputs({ fluid: { manualMlPerHour: 512.345 } }).fluid.manualMlPerHour).toBe(512.35);
    const plan = computePlan({ fluid: { mode: 'manual', manualMlPerHour: 5e-324 }, format: { type: 'drink' } });
    expect(plan.fluid.mlPerHour).toBe(0);
    expect(plan.concentration.drink.bottles).toBe(0);
  });

  describe('ingredients and custom ingredients', () => {
    it('keeps carb source ids and custom keys, drops salts, unknown ids and missing custom keys', () => {
      const result = normalizeInputs({
        carbs: {
          custom: [{ key: 'c2', name: 'Oat syrup', carbsPer100g: 70, fructoseSharePct: 10 }],
          ingredients: [
            { ref: 3, weight: 40 },
            { ref: 31, weight: 10 },
            { ref: 99, weight: 10 },
            { ref: 'c2', weight: 20 },
            { ref: 'c1', weight: 20 },
            { ref: 18, weight: NaN },
            { weight: 10 },
            'x',
            null,
          ],
        },
      });
      expect(result.carbs.ingredients).toEqual([
        { ref: 3, weight: 40 },
        { ref: 'c2', weight: 20 },
        { ref: 18, weight: 0 },
      ]);
    });

    it('keeps an empty ingredient list but restores the defaults for a non-array', () => {
      expect(normalizeInputs({ carbs: { ingredients: [] } }).carbs.ingredients).toEqual([]);
      expect(normalizeInputs({ carbs: { ingredients: 'none' } }).carbs.ingredients).toEqual(DEFAULT_INPUTS.carbs.ingredients);
    });

    it('normalizes custom ingredients: keys c1–c10, unique, at most 10, names cut to 40 characters', () => {
      const long = 'x'.repeat(50);
      const result = normalizeInputs({
        carbs: {
          custom: [
            { key: 'c1', name: long, carbsPer100g: 150, fructoseSharePct: -5, waterPct: 20 },
            { key: 'c1', name: 'duplicate' },
            { key: 'c11', name: 'bad key' },
            { key: 'x', name: 'bad key' },
            { key: 'c10', name: '  Honey mix ', carbsPer100g: 'abc', fructoseSharePct: 50, waterPct: null },
            'junk',
          ],
        },
      });
      expect(result.carbs.custom).toEqual([
        { key: 'c1', name: 'x'.repeat(40), carbsPer100g: 100, fructoseSharePct: 0, waterPct: 20 },
        // Names are not trimmed (inputs are normalized on every keystroke); the solver trims labels.
        { key: 'c10', name: '  Honey mix ', carbsPer100g: 0, fructoseSharePct: 50 },
      ]);
      const many = Array.from({ length: 12 }, (_, i) => ({ key: `c${(i % 10) + 1}`, name: `n${i}` }));
      expect(normalizeInputs({ carbs: { custom: many } }).carbs.custom).toHaveLength(10);
    });
  });

  describe('salts', () => {
    it('keeps salt ids and custom salt keys in manual salts and clamps amounts', () => {
      const result = normalizeInputs({
        salts: {
          custom: [{ key: 's1', name: 'Tabs', sodiumPct: 25, potassiumPct: 150, magnesiumPct: 'x', calciumPct: 0, chloridePct: 30 }],
          manual: [
            { ref: 31, amountMg: 2500 },
            { ref: 3, amountMg: 100 },
            { ref: 39, amountMg: 1e9 },
            { ref: 's1', amountMg: -4 },
            { ref: 's2', amountMg: 10 },
            { ref: 34, amountMg: 'abc' },
          ],
        },
      });
      expect(result.salts.manual).toEqual([
        { ref: 31, amountMg: 2500 },
        { ref: 39, amountMg: 1100000 },
        { ref: 's1', amountMg: 0 },
        { ref: 34, amountMg: 0 },
      ]);
      expect(result.salts.custom).toEqual([
        { key: 's1', name: 'Tabs', sodiumPct: 25, potassiumPct: 100, magnesiumPct: 0, calciumPct: 0, chloridePct: 30 },
      ]);
    });
  });

  describe('sweat tests', () => {
    it('normalizes each test and fills missing conditions from the event and environment', () => {
      const result = normalizeInputs({
        event: { sport: 'running', speedKmh: 12 },
        environment: { tempC: 28, sun: 'full' },
        sweat: {
          tests: [
            {
              id: 'hot-run',
              date: '2026-07-01',
              label: 'Hot run',
              preKg: 70.4,
              postKg: 69.3,
              fluidL: 0.5,
              urineL: 0.1,
              durationMin: 60,
              conditions: { tempC: 31, humidity: 'x', sun: 'partly' },
            },
          ],
        },
      });
      expect(result.sweat.tests).toEqual([
        {
          id: 'hot-run',
          date: '2026-07-01',
          label: 'Hot run',
          preKg: 70.4,
          postKg: 69.3,
          fluidL: 0.5,
          urineL: 0.1,
          durationMin: 60,
          conditions: {
            sport: 'running',
            speedKmh: 12,
            powerW: 0,
            mets: 8,
            setting: 'outdoor',
            tempC: 31,
            humidity: 50,
            sun: 'partly',
          },
        },
      ]);
    });

    it('gives tests without a usable or unique id the first free t<n>, and cleans dates, labels and numbers', () => {
      const result = normalizeInputs({
        sweat: {
          tests: [
            { label: 'no id' },
            { id: 't1', date: '1.7.2026', label: 'y'.repeat(80), preKg: NaN, postKg: 1e9, fluidL: -1, durationMin: 'x' },
            { id: 't1', label: 'duplicate' },
            { id: 'bad id!', label: 'bad id' },
            42,
          ],
        },
      });
      expect(result.sweat.tests.map((t) => t.id)).toEqual(['t2', 't1', 't3', 't4']);
      expect(normalizeInputs({ sweat: { tests: [{ durationMin: 1.53e-322 }, { durationMin: 59.996 }] } }).sweat.tests.map((t) => t.durationMin)).toEqual([0, 60]);
      expect(result.sweat.tests[1]).toMatchObject({
        date: '',
        label: 'y'.repeat(60),
        preKg: 0,
        postKg: 300,
        fluidL: 0,
        urineL: 0,
        durationMin: 0,
      });
    });

    it('keeps at most 20 tests and resets a selected id that names no test', () => {
      const tests = Array.from({ length: 25 }, (_, i) => ({ id: `x${i}`, preKg: 70, postKg: 69, durationMin: 60 }));
      const result = normalizeInputs({ sweat: { tests, selectedTestId: 'x3' } });
      expect(result.sweat.tests).toHaveLength(20);
      expect(result.sweat.selectedTestId).toBe('x3');
      expect(normalizeInputs({ sweat: { tests, selectedTestId: 'x24' } }).sweat.selectedTestId).toBeNull();
      expect(normalizeInputs({ sweat: { selectedTestId: 'x3' } }).sweat.selectedTestId).toBeNull();
    });
  });

  describe('v3 → v4 migration', () => {
    // The v3 defaults, as a v3 share link decodes them.
    const v3Defaults = {
      event: { durationMin: 180, intensity: 'moderate', highCarb: false },
      athlete: { massKg: 70, sex: 'unspecified' },
      environment: { tempC: 20, humidity: 50 },
      sweat: { source: 'preset', rateIndex: 2, saltinessIndex: 2 },
      carbs: {
        mode: 'auto',
        manualGPerHour: 60,
        ratioMode: 'auto',
        manualRatio: { glucose: 1, fructose: 0.8 },
        glucoseSources: [{ id: 3, percentage: 100 }],
        fructoseSources: [{ id: 11, percentage: 100 }],
      },
      sodium: { mode: 'auto', manualMgPerHour: 500 },
      extras: { potassium: false, magnesium: false, calcium: false },
      salts: { mode: 'auto', sodiumSalt: 'table', manual: [] },
      fluid: { mode: 'auto', manualMlPerHour: 500 },
      format: { gelsPerHour: 3, view: 'total' },
      caffeine: { enabled: false, mgPerKg: 3, asIngredient: false, tabletMg: 100 },
      bicarb: { enabled: false, gPerKg: 0.3 },
    };

    it('turns the v3 source lists into ingredients weighted by the 2:1 default ratio in auto mode', () => {
      const result = normalizeInputs(v3Defaults);
      // weight = percentage × poolShare: 100 × 2/3 and 100 × 1/3
      expect(result.carbs.ingredients).toEqual([
        { ref: 3, weight: 66.67 },
        { ref: 11, weight: 33.33 },
      ]);
      expect(result.athlete).toEqual({ massKg: 70, heightCm: 175, acclimatised: false });
      expect(result.sweat.source).toBe('preset');
      // The migrated plan is the Phase 1 default plan.
      const plan = computePlan(result);
      expect(plan.carbs.ingredients.items.map((i) => [i.ref, Math.round(i.grams)])).toEqual([
        [3, 158],
        [11, 75],
      ]);
      expect(plan.sodium.mgPerHour).toBe(570);
      expect(plan.fluid.mlPerHour).toBe(800);
    });

    it('weights the lists by the manual ratio in manual ratio mode', () => {
      const result = normalizeInputs({
        carbs: {
          ratioMode: 'manual',
          manualRatio: { glucose: 1, fructose: 0.8 },
          glucoseSources: [{ id: 3, percentage: 60 }, { id: 1, percentage: 40 }, { id: 11, percentage: 10 }],
          fructoseSources: [{ id: 14, percentage: 100 }, { id: 3, percentage: 10 }],
        },
      });
      // glucose pool 1/1.8, fructose pool 0.8/1.8; ids outside their v3 list are dropped
      expect(result.carbs.ingredients).toEqual([
        { ref: 3, weight: 33.33 },
        { ref: 1, weight: 22.22 },
        { ref: 14, weight: 44.44 },
      ]);
    });

    it('scales the weights down together when one is above 100, and uses the v3 default for a missing list', () => {
      expect(normalizeInputs({ carbs: { glucoseSources: [{ id: 3, percentage: 900 }] } }).carbs.ingredients).toEqual([
        { ref: 3, weight: 100 },
        { ref: 11, weight: 5.56 },
      ]);
      expect(normalizeInputs({ carbs: { fructoseSources: [] } }).carbs.ingredients).toEqual([{ ref: 3, weight: 66.67 }]);
    });

    it('prefers a v4 ingredient list over v3 source lists', () => {
      const result = normalizeInputs({ carbs: { ingredients: [{ ref: 18, weight: 10 }], glucoseSources: [{ id: 3, percentage: 100 }] } });
      expect(result.carbs.ingredients).toEqual([{ ref: 18, weight: 10 }]);
      expect(result.carbs).not.toHaveProperty('glucoseSources');
    });

    it('reads manual salt ids as refs, perGel as perServing, drops sex and keeps the estimate source', () => {
      const result = normalizeInputs({
        athlete: { sex: 'female', massKg: 60 },
        sweat: { source: 'estimate' },
        salts: { mode: 'manual', manual: [{ id: 31, amountMg: 1500 }, { id: 3, amountMg: 10 }] },
        format: { view: 'perGel' },
      });
      expect(result.salts.manual).toEqual([{ ref: 31, amountMg: 1500 }]);
      expect(result.format.view).toBe('perServing');
      expect(result.athlete).toEqual({ massKg: 60, heightCm: 175, acclimatised: false });
      expect(result.sweat.source).toBe('estimate');
    });

    it('ingredientsFromV3Sources rounds to 0.01 and skips entries that are not objects', () => {
      expect(ingredientsFromV3Sources([{ id: 3, percentage: 100 }, null], [{ id: 11, percentage: 50 }], 0.25)).toEqual([
        { ref: 3, weight: 75 },
        { ref: 11, weight: 12.5 },
      ]);
      expect(ingredientsFromV3Sources([], [], NaN)).toEqual([]);
    });
  });

  it('does not mutate its argument', () => {
    const partial = {
      event: { durationMin: -10 },
      carbs: { glucoseSources: [{ id: 3, percentage: 5000 }] },
      sweat: { tests: [{ label: 'x' }] },
    };
    const snapshot = structuredClone(partial);
    normalizeInputs(partial);
    expect(partial).toEqual(snapshot);
  });

  it('is idempotent and survives a JSON round trip (property)', () => {
    fc.assert(
      fc.property(partialInputsArb, (partial) => {
        const once = normalizeInputs(partial);
        expect(normalizeInputs(once)).toEqual(once);
        expect(JSON.parse(JSON.stringify(once))).toStrictEqual(once);
      }),
      { numRuns: 300 },
    );
  });

  it('never throws on arbitrary values (property)', () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        expect(normalizeInputs(value)).toBeTypeOf('object');
      }),
      { numRuns: 300 },
    );
  });
});

describe('computePlan', () => {
  it('golden: the default plan (heat-balance estimate, 2:1 gel)', () => {
    const plan = computePlan(DEFAULT_INPUTS);
    expect(plan.durationMin).toBe(180);
    expect(plan.durationH).toBe(3);
    // [gagnon2013] [cramer2019] [jay2024] cycling 30 km/h (157.7 W from the speed), 70 kg/175 cm,
    // 20 °C/50 % shade: the strong air flow carries most heat away, so the model predicts 0.15 L/h
    // (final_model.py gives the same 0.1504 L/h).
    expect(plan.sweat).toMatchObject({ source: 'estimate', uncertaintyLph: 0.5, sodiumMmolL: 40, test: null, calibration: null });
    expect(plan.sweat.rateLph).toBeCloseTo(0.1504, 4);
    expect(plan.sweat.estimate.powerW).toBeCloseTo(157.7, 6);
    expect(plan.sweat.estimate.energyKcalPerHour).toBeCloseTo(678.44, 2);
    // [jeukendrup2014] [burke2011] > 2.5 h, moderate: middle of 60–90 g/h → 75 g/h
    expect(plan.carbs.gPerHour).toBe(75);
    expect(plan.carbs.totalG).toBe(225);
    // [jeukendrup2014] [obrien2013] 60–90 g/h: 2:1 → 1:0.5
    expect(plan.carbs.ratio.value).toEqual({ glucose: 1, fructose: 0.5 });
    expect(plan.carbs.ratio.share).toBeCloseTo(1 / 3, 12);
    expect(plan.carbs.ratio.allowedShare).toEqual([1 / 3, 0.5]);
    expect(plan.carbs.ingredients).toMatchObject({ feasibleRange: [0, 1], adjusted: false, warnings: [] });
    expect(plan.carbs.ingredients.achievedShare).toBeCloseTo(1 / 3, 9);
    expect(plan.carbs.deliveredG).toBeCloseTo(225, 9);
    // [sawka2007] 80 % of 150 ml/h sweat → 120 → rounded to 100 ml/h
    expect(plan.fluid.mlPerHour).toBe(100);
    expect(plan.fluid.totalMl).toBe(300);
    // [sawka2007] [mccubbin2023] 3 h: at least 300 mg/h (half of a 138 mg/h loss is below the floor)
    expect(plan.sodium.mgPerHour).toBe(300);
    expect(plan.sodium.totalMg).toBe(900);
    // [cheuvront2017] 0.15 L deficit (0.2 % of 70 kg); the scale also drops 0.2 g per kcal
    expect(plan.hydration.level).toBe('ok');
    expect(plan.hydration.waterDeficitL).toBeCloseTo(0.1512, 4);
    expect(plan.hydration.scaleChangeKg).toBeCloseTo(-0.558, 3);
    expect(plan.gels).toEqual({ perHour: 3, count: 9, times: [0, 20, 40, 60, 80, 100, 120, 140, 160] });
    expect(plan.energy.kcal).toBe(900);
    expect(plan.energy.deliveredKcal).toBeCloseTo(900, 9);
    expect(plan.energy.expenditureKcalPerHour).toBeCloseTo(678.44, 2);
    expect(plan.energy.expenditureKcal).toBeCloseTo(2035.3, 1);
    expect(plan.cost.diy).toBeCloseTo(3.375, 10);
    expect(plan.cost.commercial).toBeCloseTo(22.5, 10);
    expect(plan.cost.savings).toBeCloseTo(19.125, 10);
    expect(plan.format).toEqual({ type: 'gel', requestedType: 'gel', drinkCarbShare: 0 });
    expect(plan.concentration.drink).toBeNull();
    expect(plan.caffeine.enabled).toBe(false);
    expect(plan.bicarb.enabled).toBe(false);
    // [efsa2011] 900 mg sodium in 300 ml fluid = 3000 mg/L; [vist1995] [pfeiffer2010] a 60 % gel
    expect(plan.warnings.map((w) => [w.id, w.level])).toEqual([
      ['electrolytes.concentrationHigh', 'warning'],
      ['concentration.gelTakeWithWater', 'info'],
    ]);
    expect(plan.inputs).toEqual(DEFAULT_INPUTS);
  });

  it('golden: the default gel batch, made up to 60 % carbohydrate', () => {
    const gel = computePlan(DEFAULT_INPUTS).concentration.gel;
    // 225 g carbs / 0.60 = 375 g; ingredients 157.9 + 75 + 2.29 g → 139.8 ml water
    expect(gel.totalMassG).toBeCloseTo(375, 9);
    expect(gel.addedWaterMl).toBeCloseTo(139.815, 3);
    expect(gel.perServing.massG).toBeCloseTo(41.667, 3);
    expect(gel.perServing.carbsG).toBeCloseTo(25, 9);
    expect(gel.volumeMl).toBeCloseTo(290.03, 2);
    expect(gel.osmolality.mOsmPerKg).toBeCloseTo(4326.5, 1);
    expect(gel.osmolality.tonicity).toBe('hypertonic');
    // [pfeiffer2010] 25 g / 0.10 − 41.7 g ≈ 208 → 210 ml with each gel
    expect(gel.waterToDrinkMlPerServing).toBe(210);
  });

  it('golden: default salts deliver the sodium target from table salt', () => {
    const plan = computePlan(DEFAULT_INPUTS);
    expect(plan.salts.mode).toBe('auto');
    expect(plan.salts.items).toEqual([{ ref: 31, amountMg: Math.round(900 / 0.393) }]);
    expect(plan.salts.delivered.Sodium).toBeCloseTo(900, 0);
    expect(plan.salts.comparison.Sodium.status).toBe('met');
    // Chloride has no target, so it is not compared (it would read as "over").
    expect(plan.salts.comparison).not.toHaveProperty('Chloride');
    expect(plan.salts.delivered.Chloride).toBeGreaterThan(0);
  });

  it('golden: the default recipe is one gel section with carbs, salt and water', () => {
    const plan = computePlan(DEFAULT_INPUTS);
    expect(plan.recipe.view).toBe('total');
    expect(plan.recipe.sections).toHaveLength(1);
    const [gel] = plan.recipe.sections;
    expect(gel).toMatchObject({ kind: 'gel', servings: 9, servingLabelKey: 'recipe.serving.gel' });
    expect(gel.items.map((i) => [i.key, i.display, i.perServingDisplay])).toEqual([
      ['carb:3', '158 g', '18 g'],
      ['carb:11', '75 g', '8.3 g'],
      ['salt:31', '2.3 g', '0.25 g'],
      ['water', '140 ml', '16 ml'],
    ]);
    expect(gel.perServing).toMatchObject({ carbsG: 25, waterToDrinkMl: 210 });
    const perServing = computePlan({ format: { view: 'perServing' } });
    expect(perServing.recipe.view).toBe('perServing');
  });

  it('golden: the schedule starts, fuels every 20 min and lists the plan fluid with the gels', () => {
    const plan = computePlan(DEFAULT_INPUTS);
    const types = plan.schedule.map((e) => e.type);
    expect(types[0]).toBe('start');
    expect(types.at(-1)).toBe('finish');
    expect(types.filter((x) => x === 'fuel')).toHaveLength(8);
    // 100 ml/h over 20 min gel intervals: 33.3 ml each, rounded on the running total.
    expect(plan.schedule.map((e) => e.fluidMl ?? 0)).toEqual([30, 30, 40, 30, 30, 40, 30, 30, 40, 0]);
  });

  it('keeps the Phase 1 numbers with the preset sweat source', () => {
    // [sawka2007] [mccubbin2023] 1.25 L/h × 40 mmol/L × 22.99 = 1149.5 mg/h loss; half → 570 mg/h
    const plan = computePlan({ sweat: PRESET });
    expect(plan.sweat).toMatchObject({ rateLph: 1.25, source: 'preset', uncertaintyLph: 0.5 });
    expect(plan.sodium.mgPerHour).toBe(570);
    expect(plan.fluid.mlPerHour).toBe(800);
    expect(plan.salts.items).toEqual([{ ref: 31, amountMg: Math.round(1710 / 0.393) }]);
    // [sawka2007] 1.35 L deficit = 1.9 % of 70 kg: below the 2 % mark
    expect(plan.hydration).toMatchObject({ level: 'ok', warnings: [] });
    expect(plan.hydration.deficitPct).toBeCloseTo(1.93, 2);
    expect(ids(plan.warnings)).toEqual(['concentration.gelTakeWithWater']);
  });

  it('uses manual values instead of recommendations', () => {
    const plan = computePlan({
      sweat: PRESET,
      carbs: { mode: 'manual', manualGPerHour: 60, ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 0.8 } },
      sodium: { mode: 'manual', manualMgPerHour: 400 },
      fluid: { mode: 'manual', manualMlPerHour: 600 },
    });
    expect(plan.carbs.gPerHour).toBe(60);
    expect(plan.carbs.recommended.gPerHour).toBe(75);
    expect(plan.carbs.ratio.value).toEqual({ glucose: 1, fructose: 0.8 });
    expect(plan.carbs.ratio.allowedShare).toEqual([0.8 / 1.8, 0.8 / 1.8]);
    expect(plan.carbs.ingredients.achievedShare).toBeCloseTo(0.8 / 1.8, 9);
    expect(plan.carbs.ratio.recommended.ratio).toEqual({ glucose: 1, fructose: 0.5 });
    expect(plan.sodium.mgPerHour).toBe(400);
    expect(plan.sodium.recommended.mgPerHour).toBe(570);
    expect(plan.fluid.mlPerHour).toBe(600);
    expect(plan.fluid.recommended.mlPerHour).toBe(800);
  });

  it('manual carbs above 120 g/h get carbs.aboveStudied and carbs.gutTraining', () => {
    // [podlogar2022] [hearris2022] nothing above 120 g/h has been studied
    const plan = computePlan({ carbs: { mode: 'manual', manualGPerHour: 130 } });
    expect(ids(plan.carbs.warnings)).toEqual(['carbs.aboveStudied', 'carbs.gutTraining']);
    expect(plan.warnings[0].id).toBe('carbs.aboveStudied');
    expect(plan.warnings[0].level).toBe('danger');
  });

  it('manual sodium of 2000 mg/h gets electrolytes.sodiumFarAbove', () => {
    // [mccubbin2023] [hoffman2015]
    const plan = computePlan({ sodium: { mode: 'manual', manualMgPerHour: 2000 } });
    expect(ids(plan.sodium.warnings)).toContain('electrolytes.sodiumFarAbove');
    expect(ids(plan.warnings)).toContain('electrolytes.sodiumFarAbove');
  });

  it('checks the sodium concentration against the effective fluid intake', () => {
    // [efsa2011] 900 mg/h in 400 ml/h = 2250 mg/L > 1725 mg/L
    const plan = computePlan({
      sodium: { mode: 'manual', manualMgPerHour: 900 },
      fluid: { mode: 'manual', manualMlPerHour: 400 },
    });
    expect(ids(plan.sodium.warnings)).toEqual(['electrolytes.concentrationHigh']);
  });

  it('manual fluid above the sweat rate gets fluid.aboveSweat and a projected gain', () => {
    // [almond2005] [hewbutler2015] 1.25 L/h sweat, drinking 1500 ml/h
    const plan = computePlan({ sweat: PRESET, fluid: { mode: 'manual', manualMlPerHour: 1500 } });
    expect(ids(plan.fluid.warnings)).toEqual(['fluid.aboveSweat']);
    expect(plan.hydration.level).toBe('gain');
    expect(ids(plan.hydration.warnings)).toEqual(['fluid.projectedGain']);
    expect(plan.hydration.waterDeficitL).toBeCloseTo(-0.75, 9);
    expect(plan.warnings.slice(0, 2).map((w) => [w.id, w.level])).toEqual([
      ['fluid.aboveSweat', 'danger'],
      ['fluid.projectedGain', 'danger'],
    ]);
  });

  it('manual fluid above 800 ml/h but below sweat gets fluid.aboveCeiling', () => {
    // [sawka2007]
    const plan = computePlan({ sweat: { source: 'preset', rateIndex: 5 }, fluid: { mode: 'manual', manualMlPerHour: 1000 } });
    expect(ids(plan.fluid.warnings)).toEqual(['fluid.aboveCeiling']);
  });

  it('projects a high water deficit when little is drunk in the heat', () => {
    // [sawka2007] 2.25 L/h for 3 h with 500 ml/h: 5.25 L = 7.5 % of 70 kg
    const plan = computePlan({ sweat: { source: 'preset', rateIndex: 4 }, fluid: { mode: 'manual', manualMlPerHour: 500 } });
    expect(plan.hydration.level).toBe('high');
    expect(plan.hydration.deficitPct).toBeCloseTo(7.5, 9);
    expect(ids(plan.warnings)).toContain('fluid.deficitHigh');
  });

  it('a manual ratio gets checkRatio warnings; the auto ratio does not', () => {
    const tooLittle = computePlan({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 0 } } });
    expect(ids(tooLittle.carbs.ratio.warnings)).toEqual(['carbs.tooLittleFructose']);
    const tooMuch = computePlan({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 2 } } });
    expect(ids(tooMuch.carbs.ratio.warnings)).toEqual(['carbs.tooMuchFructose']);
    expect(computePlan(DEFAULT_INPUTS).carbs.ratio.warnings).toEqual([]);
  });

  it('a manual 0:0 ratio is a danger and splits no carbs', () => {
    const none = computePlan({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } });
    expect(ids(none.carbs.ratio.warnings)).toEqual(['carbs.noRatio']);
    expect(none.carbs.ingredients.items).toEqual([]);
    expect(none.carbs.deliveredG).toBe(0);
    expect(none.carbs.ratio.glucoseGPerHour).toBe(0);
    expect(none.carbs.ratio.fructoseGPerHour).toBe(0);
    // Already flagged; no second warning about the ingredients.
    expect(ids(none.warnings)).not.toContain('carbs.ratioNotReachable');
    expect(ids(none.warnings)).not.toContain('carbs.noIngredients');
  });

  it('auto carbs carry the recommendation warnings, de-duplicated', () => {
    // [podlogar2022] [hearris2022] [jeukendrup2017] high-carb mode at race intensity → 120 g/h
    const plan = computePlan({ event: { intensity: 'race', highCarb: true } });
    expect(plan.carbs.gPerHour).toBe(120);
    expect(ids(plan.carbs.warnings)).toEqual(['carbs.gutTraining']);
    const short = computePlan({ event: { durationMin: 120, highCarb: true } });
    expect(ids(short.carbs.warnings)).toEqual(['carbs.highCarbLongOnly']);
  });

  it('uses the ratio recommendation for the effective carb target', () => {
    // [podlogar2022] 120 g/h → 1:0.8
    const plan = computePlan({ carbs: { mode: 'manual', manualGPerHour: 120 } });
    expect(plan.carbs.ratio.value).toEqual({ glucose: 1, fructose: 0.8 });
    expect(plan.carbs.ingredients.achievedShare).toBeCloseTo(0.8 / 1.8, 9);
  });

  it('manual salts use the list as given and warn on the sodium they deliver', () => {
    const plan = computePlan({ salts: { mode: 'manual', manual: [{ ref: 31, amountMg: 15000 }] } });
    expect(plan.salts.items).toEqual([{ ref: 31, amountMg: 15000 }]);
    // 15 g table salt over 3 h ≈ 1965 mg/h sodium
    expect(ids(plan.salts.warnings)).toContain('electrolytes.sodiumFarAbove');
    expect(plan.salts.comparison.Sodium.status).toBe('over');
  });

  it('auto salts follow the sodium salt and enabled extras', () => {
    const plan = computePlan({
      sweat: PRESET,
      salts: { sodiumSalt: 'mix' },
      extras: { potassium: true, magnesium: true, calcium: true },
    });
    expect(plan.salts.items.map((s) => s.ref)).toEqual([31, 33, 39, 34, 35]);
    expect(plan.extras.Potassium.totalMg).toBe(plan.extras.Potassium.mgPerHour * 3);
    for (const ion of ['Sodium', 'Potassium', 'Magnesium', 'Calcium']) {
      expect(plan.salts.comparison[ion].status).toBe('met');
    }
  });

  it('plans caffeine on the gel times and puts it in the schedule and the gel recipe', () => {
    const plan = computePlan({ caffeine: { enabled: true, asIngredient: true } });
    expect(plan.caffeine.enabled).toBe(true);
    const intra = plan.caffeine.doses.find((d) => d.kind === 'intra');
    expect(plan.gels.times).toContain(intra.timeMin);
    expect(plan.schedule.some((e) => e.caffeineMg === intra.mg && e.timeMin === intra.timeMin)).toBe(true);
    expect(plan.recipe.sections[0].items.some((i) => i.kind === 'caffeine')).toBe(true);
    expect(ids(plan.warnings)[0]).toBe('caffeine.noPowder');
  });

  it('plans bicarbonate with the athlete mass and adds a schedule event', () => {
    const plan = computePlan({ event: { durationMin: 45 }, athlete: { massKg: 80 }, bicarb: { enabled: true, gPerKg: 0.25 } });
    expect(plan.bicarb.doseG).toBeCloseTo(20, 10);
    expect(plan.schedule[0]).toMatchObject({ type: 'bicarb', timeMin: -90 });
  });

  it('sorts warnings danger > warning > info and de-duplicates by id', () => {
    const plan = computePlan({
      carbs: { mode: 'manual', manualGPerHour: 130 },
      fluid: { mode: 'manual', manualMlPerHour: 1500 },
      caffeine: { enabled: true },
      event: { highCarb: true, intensity: 'race' },
      format: { type: 'both' },
    });
    const levels = plan.warnings.map((w) => w.level);
    const rank = { danger: 0, warning: 1, info: 2 };
    expect(levels).toEqual([...levels].sort((a, b) => rank[a] - rank[b]));
    const warningIds = ids(plan.warnings);
    expect(new Set(warningIds).size).toBe(warningIds.length);
  });

  it('handles a zero-length event', () => {
    const plan = computePlan({
      event: { durationMin: 0 },
      salts: { mode: 'manual', manual: [{ ref: 31, amountMg: 500 }] },
      format: { type: 'both' },
    });
    expect(plan.durationH).toBe(0);
    expect(plan.carbs.totalG).toBe(0);
    expect(plan.salts.warnings).toEqual([]);
    expect(plan.hydration).toMatchObject({ waterDeficitL: 0, level: 'ok' });
    expect(plan.energy.expenditureKcal).toBe(0);
    expect(badNumbers(plan)).toEqual([]);
  });

  it('does not mutate its input', () => {
    const inputs = normalizeInputs({
      caffeine: { enabled: true },
      format: { type: 'both' },
      sweat: { source: 'test', tests: [{ id: 'a', preKg: 70, postKg: 69, durationMin: 60 }] },
    });
    const snapshot = structuredClone(inputs);
    computePlan(inputs);
    expect(inputs).toEqual(snapshot);
  });

  it('only cites ids that exist in CITATIONS', () => {
    const seen = new Set();
    const configs = [
      DEFAULT_INPUTS,
      { caffeine: { enabled: true }, bicarb: { enabled: true }, extras: { potassium: true, magnesium: true, calcium: true } },
      { event: { durationMin: 30 } },
      { event: { durationMin: 60 } },
      { event: { durationMin: 300, highCarb: true }, caffeine: { enabled: true, asIngredient: true } },
      { carbs: { mode: 'manual', manualGPerHour: 150, ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } },
      { sodium: { mode: 'manual', manualMgPerHour: 3000 }, fluid: { mode: 'manual', manualMlPerHour: 2500 } },
      { sweat: { source: 'test', tests: [{ id: 'a', preKg: 70, postKg: 69, durationMin: 60 }] } },
      { sweat: { source: 'test' } },
      { sweat: PRESET, format: { type: 'drink' }, carbs: { ingredients: [{ ref: 1, weight: 100 }, { ref: 11, weight: 50 }] } },
      { environment: { tempC: 40, humidity: 80 }, event: { sport: 'running', speedKmh: 12 } },
    ];
    for (const inputs of configs) collectCitationIds(computePlan(inputs), seen);
    fc.assert(
      fc.property(partialInputsArb, (partial) => {
        collectCitationIds(computePlan(normalizeInputs(partial)), seen);
      }),
      { numRuns: 300 },
    );
    expect(seen.size).toBeGreaterThan(25);
    for (const id of ['gagnon2013', 'cramer2019', 'jay2024', 'cheuvront2017', 'vist1995', 'pfeiffer2010']) {
      expect(seen.has(id), id).toBe(true);
    }
    const unknown = [...seen].filter((id) => !Object.hasOwn(CITATIONS, id));
    expect(unknown).toEqual([]);
  });

  it('never throws and never returns NaN, or Infinity outside the documented fields (property)', () => {
    fc.assert(
      fc.property(partialInputsArb, (partial) => {
        const plan = computePlan(normalizeInputs(partial));
        expect(badNumbers(plan)).toEqual([]);
      }),
      { numRuns: 500 },
    );
  });

  it('never throws on arbitrary values (property)', () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        expect(computePlan(value).inputs).toBeTypeOf('object');
      }),
      { numRuns: 200 },
    );
  });
});

describe('computePlan: sweat sources', () => {
  const test = { id: 'a', preKg: 70, postKg: 69, fluidL: 0.5, urineL: 0, durationMin: 60 };

  // [baker2017] [sawka2007] [cheuvront2017]
  it('uses a sweat test as measured when calibration is off', () => {
    const plan = computePlan({ sweat: { source: 'test', calibrate: false, tests: [test] } });
    // (70 − 69 + 0.5) L in 1 h, minus 0.2 g per kcal of the 678 kcal session
    expect(plan.sweat.source).toBe('test');
    expect(plan.sweat.uncertaintyLph).toBe(0.15);
    expect(plan.sweat.rateLph).toBeCloseTo(1.5 - 0.0002 * 678.44, 3);
    expect(plan.sweat.calibration.applied).toBe(false);
    expect(plan.fluid.mlPerHour).toBe(800);
  });

  it('scales a sweat test to the event conditions with the model', () => {
    // The test ran at 25 °C; the event is at 20 °C, where the model predicts under half the sweat:
    // the plan scales the measured rate down by at most half, and says the rate is less certain.
    const plan = computePlan({
      sweat: { source: 'test', tests: [{ ...test, conditions: { tempC: 25 } }] },
    });
    expect(plan.sweat.calibration).toMatchObject({ applied: true, clamped: true, factor: 0.5 });
    expect(plan.sweat.rateLph).toBeCloseTo(0.5 * plan.sweat.test.rateLph, 12);
    expect(plan.sweat.uncertaintyLph).toBe(0.5);
    expect(ids(plan.warnings)).toContain('sweat.calibrationLimited');
    expect(plan.sweat.test).toMatchObject({ id: 'a', valid: true });
  });

  it('keeps a measured rate far above the model when the test matches the event (default ride)', () => {
    // [baker2017] The add form fills in the event conditions; the model says 0.15 L/h for them.
    const event = { sport: 'cycling', speedKmh: 30, powerW: 0, mets: 8, setting: 'outdoor', tempC: 20, humidity: 50, sun: 'none' };
    const measured = { id: 'a', preKg: 70.5, postKg: 69.5, fluidL: 0.5, urineL: 0, durationMin: 60, conditions: event };
    const plan = computePlan({ sweat: { source: 'test', tests: [measured] } });
    expect(plan.sweat.estimate.rateLph).toBeCloseTo(0.15, 2);
    expect(plan.sweat.test.rateLph).toBeCloseTo(1.364, 3);
    expect(plan.sweat.rateLph).toBe(plan.sweat.test.rateLph);
    expect(plan.sweat.calibration).toMatchObject({ factor: 1, clamped: false });
    expect(plan.sweat.uncertaintyLph).toBe(0.15);
    // [sawka2007] 80 % of 1.36 L/h, capped at 800 ml/h
    expect(plan.fluid.mlPerHour).toBe(800);
    expect(ids(plan.warnings)).not.toContain('sweat.calibrationLimited');
  });

  it('falls back to the estimate with sweat.testUnusable when there is no usable test', () => {
    const none = computePlan({ sweat: { source: 'test' } });
    expect(none.sweat.source).toBe('estimate');
    expect(none.sweat.rateLph).toBe(none.sweat.estimate.rateLph);
    expect(ids(none.warnings)).toContain('sweat.testUnusable');
    const invalid = computePlan({ sweat: { source: 'test', tests: [{ id: 'x', preKg: 70, postKg: 71, durationMin: 60 }] } });
    expect(invalid.sweat.source).toBe('estimate');
    expect(invalid.sweat.tests[0].valid).toBe(false);
    expect(ids(invalid.warnings)).toContain('sweat.testUnusable');
  });

  it('selects a test by id', () => {
    const plan = computePlan({
      sweat: {
        source: 'test',
        calibrate: false,
        selectedTestId: 'first',
        tests: [
          { ...test, id: 'first', postKg: 69.5 },
          { ...test, id: 'second' },
        ],
      },
    });
    expect(plan.sweat.test.id).toBe('first');
    expect(plan.sweat.tests.map((t) => t.id)).toEqual(['first', 'second']);
  });

  // [gagnon2013] [cramer2019]
  it('raises sweat.uncompensable in hot, humid conditions for every source', () => {
    const hot = { environment: { tempC: 40, humidity: 80 }, event: { sport: 'running', speedKmh: 12 } };
    for (const sweat of [{ source: 'estimate' }, PRESET]) {
      const plan = computePlan({ ...hot, sweat });
      expect(plan.warnings[0]).toMatchObject({ id: 'sweat.uncompensable', level: 'danger' });
    }
    expect(computePlan(hot).sweat.rateLph).toBeCloseTo(computePlan(hot).sweat.estimate.maxRateLph, 12);
  });

  it('reads the athlete height and acclimatisation and the event sport', () => {
    const base = computePlan({ event: { sport: 'running', speedKmh: 12 }, environment: { tempC: 30, humidity: 60 } });
    // [jay2024] research table: 70 kg/175 cm running 12 km/h at 30 °C/60 % → 1.59 L/h
    expect(base.sweat.rateLph).toBeCloseTo(1.59, 1);
    const taller = computePlan({ ...base.inputs, athlete: { ...base.inputs.athlete, heightCm: 190 } });
    expect(taller.sweat.estimate.bsaM2).toBeGreaterThan(base.sweat.estimate.bsaM2);
    expect(computePlan({ event: { sport: 'other', mets: 8 } }).sweat.estimate.externalWorkW).toBe(0);
  });
});

describe('computePlan: ingredients', () => {
  // [jeukendrup2014] at ≤ 60 g/h glucose alone works, so glucose-only ingredients make a 1:0 recipe
  it('uses glucose alone at ≤ 60 g/h without a warning', () => {
    const plan = computePlan({ event: { durationMin: 120 }, carbs: { ingredients: [{ ref: 3, weight: 100 }] } });
    expect(plan.carbs.gPerHour).toBe(55);
    expect(plan.carbs.ingredients).toMatchObject({ usedShare: 0, achievedShare: 0, adjusted: true, warnings: [] });
    expect(plan.carbs.ingredients.items.map((i) => i.ref)).toEqual([3]);
    expect(plan.carbs.deliveredG).toBeCloseTo(110, 9);
    expect(plan.carbs.ratio.glucoseGPerHour).toBeCloseTo(55, 9);
    expect(plan.carbs.ratio.fructoseGPerHour).toBe(0);
    expect(ids(plan.warnings)).not.toContain('carbs.ratioNotReachable');
  });

  it('warns when the ingredients cannot reach the allowed ratio and uses the closest they can make', () => {
    const plan = computePlan({ carbs: { ingredients: [{ ref: 3, weight: 100 }] } });
    expect(plan.carbs.warnings).toContainEqual(
      expect.objectContaining({
        id: 'carbs.ratioNotReachable',
        level: 'warning',
        message: { key: 'carbs.warn.ratioNotReachable', params: { achievable: '1:0', target: '1:0.5' } },
      }),
    );
    expect(plan.carbs.deliveredG).toBeCloseTo(225, 9);
    expect(plan.carbs.ratio.fructoseGPerHour).toBe(0);
  });

  it.each([
    ['no carb ingredient', { carbs: { ingredients: [] } }, 'carbs.noIngredients'],
    ['a 0:0 ratio', { carbs: { ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } }, 'carbs.noRatio'],
    [
      'only a custom ingredient without carbs',
      {
        carbs: {
          custom: [{ key: 'c1', name: 'Water flavour', carbsPer100g: 0, fructoseSharePct: 0 }],
          ingredients: [{ ref: 'c1', weight: 100 }],
        },
      },
      'carbs.noIngredients',
    ],
  ])('plans no salt-only gels when the recipe delivers no carbs (%s)', (_, inputs, warningId) => {
    const plan = computePlan(inputs);
    expect(ids(plan.warnings)).toContain(warningId);
    expect(plan.carbs.totalG).toBe(225);
    expect(plan.carbs.deliveredG).toBe(0);
    expect(plan.energy).toMatchObject({ kcal: 900, deliveredKcal: 0 });
    // The gels would hold only salt, so there are none: the salts go into a checked drink.
    expect(plan.gels).toEqual({ perHour: 0, count: 0, times: [] });
    expect(plan.concentration.gel).toBeNull();
    expect(plan.format).toEqual({ type: 'drink', requestedType: 'gel', drinkCarbShare: 1 });
    const [section] = plan.recipe.sections;
    expect(plan.recipe.sections).toHaveLength(1);
    expect(section.kind).toBe('drink');
    expect(section.items.map((i) => i.kind)).toEqual(['salt', 'water']);
    expect(plan.warnings.find((w) => w.id === 'plan.noGels')).toEqual({
      id: 'plan.noGels',
      level: 'info',
      message: { key: 'plan.warn.noGelsSaltsInDrink' },
    });
    expect(plan.schedule.some((e) => e.type === 'fuel' || /gel/i.test(e.message.key))).toBe(false);
    // Nothing is delivered, so nothing reaches either pathway.
    expect(plan.carbs.ratio.glucoseGPerHour).toBe(0);
    expect(plan.carbs.ratio.fructoseGPerHour).toBe(0);
  });

  it('assigns no caffeine tablet to a gel when the recipe delivers no carbs', () => {
    const plan = computePlan({ carbs: { ingredients: [] }, caffeine: { enabled: true, asIngredient: true } });
    expect(plan.gels.count).toBe(0);
    expect(plan.caffeine.doses.every((dose) => dose.gelIndex === null || dose.gelIndex === undefined)).toBe(true);
    expect(plan.recipe.sections.some((s) => s.items.some((i) => i.kind === 'caffeine'))).toBe(false);
  });

  it('splits the delivered carbs per hour by pathway', () => {
    const plan = computePlan(DEFAULT_INPUTS);
    // 225 g over 3 h at 1:0.5 → 50 g/h glucose, 25 g/h fructose
    expect(plan.carbs.ratio.glucoseGPerHour).toBeCloseTo(50, 9);
    expect(plan.carbs.ratio.fructoseGPerHour).toBeCloseTo(25, 9);
  });

  it('a mixed ingredient alone makes its own ratio in auto mode (honey, 1:1)', () => {
    const plan = computePlan({ carbs: { ingredients: [{ ref: 14, weight: 100 }] } });
    expect(plan.carbs.ingredients).toMatchObject({ usedShare: 0.5, achievedShare: 0.5, adjusted: true, warnings: [] });
  });

  it('puts custom ingredients and custom salts into the recipe, the ions and the osmolality', () => {
    const plan = computePlan({
      carbs: {
        custom: [{ key: 'c1', name: 'Rice syrup X', carbsPer100g: 80, fructoseSharePct: 0 }],
        ingredients: [
          { ref: 'c1', weight: 50 },
          { ref: 11, weight: 50 },
        ],
      },
      salts: {
        mode: 'manual',
        custom: [{ key: 's1', name: 'Electrolyte mix', sodiumPct: 20, potassiumPct: 5, magnesiumPct: 0, calciumPct: 0, chloridePct: 30 }],
        manual: [
          { ref: 's1', amountMg: 3000 },
          { ref: 31, amountMg: 1000 },
        ],
      },
    });
    const [c1, fructose] = plan.carbs.ingredients.items;
    expect(c1).toMatchObject({ ref: 'c1', label: 'Rice syrup X', custom: true, carbsPerGram: 0.8, waterFraction: 0.2 });
    expect(c1.carbsG).toBeCloseTo(150, 9);
    expect(c1.grams).toBeCloseTo(187.5, 9);
    expect(fructose.carbsG).toBeCloseTo(75, 9);
    // 20 % of 3000 mg + 39.3 % of 1000 mg
    expect(plan.salts.delivered.Sodium).toBeCloseTo(993, 9);
    expect(plan.salts.delivered.Potassium).toBeCloseTo(150, 9);
    const lines = plan.recipe.sections[0].items.map((i) => [i.key, i.label, i.display]);
    expect(lines.slice(0, 4)).toEqual([
      ['carb:c1', 'Rice syrup X', '188 g'],
      ['carb:11', 'Crystalline Fructose', '75 g'],
      ['salt:s1', 'Electrolyte mix', '3.0 g'],
      ['salt:31', 'Sodium Chloride (Table Salt)', '1.0 g'],
    ]);
    expect(Number.isFinite(plan.concentration.gel.osmolality.mOsmPerKg)).toBe(true);
  });
});

describe('computePlan: formats', () => {
  // [vist1995] [shi1995] drink concentration; [efsa2011] sodium per litre
  it('drink: no gels, equal bottles that hold the plan fluid, and drink sips in the schedule', () => {
    const plan = computePlan({ sweat: PRESET, format: { type: 'drink' } });
    expect(plan.format).toEqual({ type: 'drink', requestedType: 'drink', drinkCarbShare: 1 });
    expect(plan.gels).toEqual({ perHour: 0, count: 0, times: [] });
    expect(plan.concentration.gel).toBeNull();
    const { drink } = plan.concentration;
    // 2400 ml in 750 ml bottles → 4 bottles filled to 600 ml
    expect(drink.bottles).toBe(4);
    expect(drink.perBottle.fillMl).toBe(600);
    expect(drink.perBottle.carbsG).toBeCloseTo(56.25, 9);
    expect(drink.perBottle.carbPctWv).toBeCloseTo(9.375, 9);
    expect(ids(drink.warnings)).toEqual(['concentration.drinkStrong']);
    const [section] = plan.recipe.sections;
    expect(section).toMatchObject({ kind: 'drink', servings: 4, servingLabelKey: 'recipe.serving.bottle' });
    expect(section.items.map((i) => i.key)).toEqual(['carb:3', 'carb:11', 'salt:31', 'water']);
    expect(section.perServing.volumeMl).toBe(600);
    const sips = plan.schedule.filter((e) => e.type === 'drink');
    expect(sips).toHaveLength(9);
    expect(sips.reduce((total, e) => total + e.fluidMl, 0)).toBe(2400);
    expect(sips.at(-1).bottle).toBe(4);
    expect(plan.schedule.some((e) => e.type === 'fuel')).toBe(false);
  });

  it('drink: caffeine tablets stay in the schedule, not in the recipe', () => {
    const plan = computePlan({ sweat: PRESET, format: { type: 'drink' }, caffeine: { enabled: true, asIngredient: true } });
    expect(plan.recipe.sections[0].items.some((i) => i.kind === 'caffeine')).toBe(false);
    expect(plan.schedule.filter((e) => e.type === 'caffeine').length).toBeGreaterThan(1);
  });

  it('drink without fluid warns that there is nothing to mix', () => {
    const plan = computePlan({ format: { type: 'drink' }, fluid: { mode: 'manual', manualMlPerHour: 0 } });
    expect(plan.concentration.drink.bottles).toBe(0);
    expect(ids(plan.warnings)).toContain('concentration.noFluidForDrink');
  });

  it('both: the drink takes its share of each ingredient and all salts, the gels the rest', () => {
    const plan = computePlan({ sweat: PRESET, format: { type: 'both', drinkCarbSharePct: 40 } });
    expect(plan.format).toEqual({ type: 'both', requestedType: 'both', drinkCarbShare: 0.4 });
    expect(plan.gels.count).toBe(9);
    const [gel, drink] = plan.recipe.sections;
    expect(gel.kind).toBe('gel');
    expect(drink.kind).toBe('drink');
    const amount = (section, key) => section.items.find((i) => i.key === key)?.amount;
    expect(amount(gel, 'carb:11')).toBeCloseTo(45, 9);
    expect(amount(drink, 'carb:11')).toBeCloseTo(30, 9);
    expect(gel.items.some((i) => i.kind === 'salt')).toBe(false);
    expect(amount(drink, 'salt:31')).toBe(4351);
    // The gel batch is made from 60 % of the carbs; the drink holds 90 g carbs and all sodium in 4 bottles.
    expect(plan.concentration.gel.perServing.carbsG).toBeCloseTo(15, 9);
    expect(plan.concentration.drink.perBottle.carbsG).toBeCloseTo(22.5, 9);
    expect(plan.concentration.drink.perBottle.sodiumMg).toBeCloseTo(plan.salts.delivered.Sodium / 4, 9);
    // Gels carry the fluid, as in gel mode.
    expect(plan.schedule.filter((e) => e.type === 'fuel')).toHaveLength(8);
  });

  it('both at 100 % drink has no gels and is a drink', () => {
    const plan = computePlan({ format: { type: 'both', drinkCarbSharePct: 100 } });
    expect(plan.gels.count).toBe(0);
    expect(plan.concentration.gel).toBeNull();
    expect(plan.format).toEqual({ type: 'drink', requestedType: 'both', drinkCarbShare: 1 });
    expect(plan.recipe.sections.map((s) => s.kind)).toEqual(['drink']);
    // The athlete chose to put every carb in the drink: nothing to explain.
    expect(ids(plan.warnings)).not.toContain('plan.noGels');
  });

  it.each([
    ['gel at 0 gels per hour', { format: { gelsPerHour: 0 } }, 'gel'],
    ['both at 0 gels per hour', { format: { type: 'both', gelsPerHour: 0 } }, 'both'],
  ])('without gels the whole recipe goes into a checked drink (%s)', (_, inputs, requestedType) => {
    const plan = computePlan(inputs);
    expect(plan.gels.count).toBe(0);
    expect(plan.concentration.gel).toBeNull();
    expect(plan.format).toEqual({ type: 'drink', requestedType, drinkCarbShare: 1 });
    // One drink section with every carb and salt: no gel section to "mix into the drink".
    expect(plan.recipe.sections.map((s) => s.kind)).toEqual(['drink']);
    const [drinkSection] = plan.recipe.sections;
    expect(drinkSection.items.map((i) => i.key)).toEqual(['carb:3', 'carb:11', 'salt:31', 'water']);
    // [jeukendrup2014] 180 min moderate: 75 g/h → 225 g, all of it in the drink.
    expect(plan.carbs.deliveredG).toBeCloseTo(225, 6);
    const { drink } = plan.concentration;
    expect(drink.perBottle.carbsG).toBeCloseTo(225, 6);
    // [vist1995] [shi1995] 225 g in the plan's 300 ml is 75 % w/v: the checks see all of it.
    expect(drink.perBottle.carbPctWv).toBeCloseTo(75, 6);
    expect(ids(plan.warnings)).toEqual(
      expect.arrayContaining(['concentration.drinkTooStrong', 'concentration.veryHypertonic', 'plan.noGels']),
    );
    expect(plan.warnings.find((w) => w.id === 'plan.noGels').message).toEqual({ key: 'plan.warn.noGelsCarbsInDrink' });
    expect(ids(plan.warnings)).not.toContain('concentration.gelTakeWithWater');
    // The schedule lists drink sips with the bottle, not gels.
    expect(plan.schedule.some((e) => e.type === 'fuel')).toBe(false);
    expect(plan.schedule.filter((e) => e.type === 'drink').length).toBeGreaterThan(0);
  });

  it('both at 0 gels per hour checks the whole carb load per bottle (preset sweat)', () => {
    // [vist1995] 225 g in 2400 ml is 9.4 % w/v: strong, where half the carbs alone read 4.7 % and hypotonic.
    const plan = computePlan({ sweat: PRESET, format: { type: 'both', gelsPerHour: 0 } });
    const { drink } = plan.concentration;
    expect(drink.bottles).toBe(4);
    expect(drink.perBottle.carbsG).toBeCloseTo(56.25, 9);
    expect(drink.perBottle.carbPctWv).toBeCloseTo(9.375, 9);
    expect(ids(drink.warnings)).toContain('concentration.drinkStrong');
  });

  it('a gel plan without gels and without fluid says there is no drink to mix', () => {
    const plan = computePlan({ format: { gelsPerHour: 0 }, fluid: { mode: 'manual', manualMlPerHour: 0 } });
    expect(plan.format.type).toBe('drink');
    expect(plan.concentration.drink.bottles).toBe(0);
    expect(ids(plan.warnings)).toEqual(expect.arrayContaining(['concentration.noFluidForDrink', 'plan.noGels']));
  });

  it('a gel plan with nothing to mix stays an empty gel recipe', () => {
    const plan = computePlan({
      event: { durationMin: 30 },
      sodium: { mode: 'manual', manualMgPerHour: 0 },
    });
    expect(plan.carbs.totalG).toBe(0);
    expect(plan.salts.items).toEqual([]);
    expect(plan.format).toEqual({ type: 'gel', requestedType: 'gel', drinkCarbShare: 0 });
    expect(plan.recipe.sections).toHaveLength(1);
    expect(plan.recipe.sections[0]).toMatchObject({ kind: 'gel', servings: 0, items: [] });
    expect(ids(plan.warnings)).not.toContain('plan.noGels');
    expect(ids(plan.warnings)).not.toContain('concentration.noFluidForDrink');
  });

  it('a thinner gel consistency adds more water', () => {
    const standard = computePlan(DEFAULT_INPUTS).concentration.gel;
    const liquid = computePlan({ format: { gelConsistency: 'liquid' } }).concentration.gel;
    // [GEL_CONSISTENCY_PCT] 225 g carbs at 45 % → 500 g batch
    expect(liquid.totalMassG).toBeCloseTo(500, 9);
    expect(liquid.addedWaterMl).toBeGreaterThan(standard.addedWaterMl);
  });

  it('uses the bottle size from the inputs', () => {
    const plan = computePlan({ sweat: PRESET, format: { type: 'drink', bottleMl: 500 } });
    expect(plan.concentration.drink.bottles).toBe(5);
    expect(plan.concentration.drink.perBottle.fillMl).toBe(480);
  });
});

describe('computePlan: review regressions', () => {
  const kinds = (plan) => plan.schedule.map((e) => e.type);

  // [thomas2016] [jeukendrup2014] no carbs needed under 45 min, and 0 g/h at easy 45–75 min
  it.each([
    ['30 min', { event: { durationMin: 30 } }],
    ['60 min easy', { event: { durationMin: 60, intensity: 'easy' } }],
    ['manual 0 g/h', { carbs: { mode: 'manual', manualGPerHour: 0 } }],
  ])('plans no gels when the carb target is 0 g/h (%s)', (_, partial) => {
    const plan = computePlan(partial);
    expect(plan.carbs.totalG).toBe(0);
    expect(plan.gels).toEqual({ perHour: 0, count: 0, times: [] });
    // The salts go into the drink, so the schedule lists drink sips, never a gel.
    expect(kinds(plan).filter((kind) => kind !== 'drink')).toEqual(['start', 'finish']);
    expect(kinds(plan)).toContain('drink');
    expect(plan.schedule.some((e) => /gel/i.test(e.message.key))).toBe(false);
    expect(plan.recipe.sections.map((s) => s.kind)).toEqual(['drink']);
    expect(plan.recipe.sections[0].items.map((item) => item.kind)).toEqual(['salt', 'water']);
  });

  // [hewbutler2015] [sawka2007] an all-auto plan never asks for more fluid than the sweat loss
  it.each([17.6, 17.7, 17.9, 18.9])('an all-auto plan at %s °C never plans to drink more than it sweats', (tempC) => {
    const plan = computePlan({ environment: { tempC } });
    expect(plan.fluid.mode).toBe('auto');
    expect(plan.fluid.mlPerHour).toBeLessThanOrEqual(Math.round(plan.sweat.rateLph * 1000));
    expect(ids(plan.warnings)).not.toContain('fluid.aboveSweat');
    expect(ids(plan.warnings)).not.toContain('fluid.projectedGain');
    expect(plan.hydration.level).not.toBe('gain');
    // The model predicts very little sweat here, and the plan says so.
    expect(ids(plan.warnings)).toContain('sweat.estimateLow');
  });

  it('keeps gels for any carb target above 0', () => {
    expect(computePlan({ event: { durationMin: 60 } }).gels.count).toBe(3); // 15 g/h
  });

  // [carter2004] [brietzke2019]
  it('passes the mouth rinse protocol through for 45–75 min', () => {
    expect(computePlan({ event: { durationMin: 60 } }).carbs.mouthRinseHowTo).toEqual({
      summary: { key: 'carbs.mouthRinse.howTo' },
      citations: ['carter2004', 'brietzke2019'],
    });
    expect(computePlan(DEFAULT_INPUTS).carbs.mouthRinseHowTo).toBeNull();
  });

  it('lets manual salts hold the largest auto amounts, so switching to Manual keeps the sodium', () => {
    // 48 h at the 5000 mg/h manual sodium limit, all from sodium citrate.
    const extreme = {
      event: { durationMin: 2880 },
      sodium: { mode: 'manual', manualMgPerHour: 5000 },
      salts: { sodiumSalt: 'citrate' },
    };
    const auto = computePlan(extreme);
    const largest = Math.max(...auto.salts.items.map((item) => item.amountMg));
    expect(largest).toBeGreaterThan(1000000);
    expect(largest).toBeLessThanOrEqual(INPUT_LIMITS.saltAmountMg[1]);
    const manual = computePlan({ ...extreme, salts: { mode: 'manual', manual: auto.salts.items } });
    expect(manual.salts.items).toEqual(auto.salts.items);
    expect(manual.salts.comparison.Sodium.status).toBe('met');
    // The case from the review: 48 h, heaviest and saltiest sweat, table salt.
    const heavy = { event: { durationMin: 2880 }, sweat: { source: 'preset', rateIndex: 5, saltinessIndex: 5 } };
    const heavyAuto = computePlan(heavy);
    const heavyManual = computePlan({ ...heavy, salts: { mode: 'manual', manual: heavyAuto.salts.items } });
    expect(heavyManual.salts.delivered.Sodium).toBeCloseTo(heavyAuto.salts.delivered.Sodium, 6);
  });

  it('rounds the per-hour sodium of manual salts in warnings', () => {
    // 30 g table salt over 7 h is 1684.29 mg/h of sodium.
    const plan = computePlan({ event: { durationMin: 420 }, salts: { mode: 'manual', manual: [{ ref: 31, amountMg: 30000 }] } });
    const warning = plan.salts.warnings.find((w) => w.id === 'electrolytes.sodiumFarAbove');
    expect(warning.message.params).toEqual({ mgPerHour: 1684, limitMgPerHour: 1500 });
  });

  // [sawka2007] [mccubbin2023] a manual target under the evidence range is flagged
  it('notes a manual sodium target below the evidence range', () => {
    const low = computePlan({ sodium: { mode: 'manual', manualMgPerHour: 60 } });
    const note = low.sodium.warnings.find((w) => w.id === 'plan.sodiumBelowRange');
    expect(note).toMatchObject({ level: 'info', message: { params: { mgPerHour: 60, lo: 300, hi: 600 } } });
    expect(ids(computePlan(DEFAULT_INPUTS).sodium.warnings)).not.toContain('plan.sodiumBelowRange');
    // Under 120 min sodium is optional (range starts at 0), so nothing is flagged.
    const short = computePlan({ event: { durationMin: 90 }, sodium: { mode: 'manual', manualMgPerHour: 0 } });
    expect(ids(short.sodium.warnings)).not.toContain('plan.sodiumBelowRange');
  });

  // [talanian2016] a late caffeine dose stays late when the gels are sparse
  it('does not move the late caffeine dose to the start gel', () => {
    const plan = computePlan({
      event: { durationMin: 100 },
      format: { gelsPerHour: 0.5 },
      caffeine: { enabled: true, asIngredient: true },
    });
    const intra = plan.caffeine.doses.find((d) => d.kind === 'intra');
    expect(intra).toMatchObject({ timeMin: 67, gelIndex: null });
    expect(plan.schedule.find((e) => e.type === 'start').caffeineMg).toBeUndefined();
    expect(plan.schedule.some((e) => e.type === 'caffeine' && e.timeMin === 67)).toBe(true);
  });
});

describe('templateToInputs', () => {
  const gu = TEMPLATES.find((tpl) => tpl.id === 'gu-energy-gel');

  it('maps a template to partial inputs with one weighted ingredient list', () => {
    // 75 g/h ÷ 23 g/gel = 3.26 → 3.5 gels/h. The sodium target is not touched.
    // 1:0.33 → glucose pool 1/1.33, fructose pool 0.33/1.33
    expect(templateToInputs(gu, { gPerHour: 75 })).toEqual({
      carbs: {
        ratioMode: 'manual',
        manualRatio: { glucose: gu.ratio.glucose, fructose: gu.ratio.fructose },
        ingredients: [
          { ref: 3, weight: 75.19 },
          { ref: 11, weight: 24.81 },
        ],
      },
      format: { gelsPerHour: 3.5 },
      salts: { mode: 'auto', sodiumSalt: gu.sodiumSalt },
    });
  });

  // [sawka2007] [mccubbin2023] a gel label's sodium must not replace the evidence-based target
  it('keeps the sodium target when a low-sodium template is applied', () => {
    const maurten = TEMPLATES.find((tpl) => tpl.id === 'maurten-gel-100');
    const before = computePlan(DEFAULT_INPUTS);
    const after = computePlan(normalizeInputs({ ...DEFAULT_INPUTS, ...templateToInputs(maurten, { gPerHour: 75 }) }));
    expect(after.sodium.mode).toBe('auto');
    expect(after.sodium.mgPerHour).toBe(before.sodium.mgPerHour);
    expect(after.salts.comparison.Sodium.target).toBe(before.salts.comparison.Sodium.target);
  });

  it('uses at least one gel per hour', () => {
    expect(templateToInputs(gu, { gPerHour: 0 }).format.gelsPerHour).toBe(1);
    expect(templateToInputs(gu, { gPerHour: NaN }).format.gelsPerHour).toBe(1);
    expect(templateToInputs({ ...gu, carbsPerGelG: 0 }, { gPerHour: 90 }).format.gelsPerHour).toBe(1);
    expect(templateToInputs(gu, { gPerHour: 10 }).format.gelsPerHour).toBe(1);
  });

  it('rounds gels per hour to the nearest 0.5 and caps it at 12', () => {
    expect(templateToInputs({ ...gu, carbsPerGelG: 25 }, { gPerHour: 90 }).format.gelsPerHour).toBe(3.5);
    expect(templateToInputs({ ...gu, carbsPerGelG: 30 }, { gPerHour: 60 }).format.gelsPerHour).toBe(2);
    expect(templateToInputs({ ...gu, carbsPerGelG: 1 }, { gPerHour: 200 }).format.gelsPerHour).toBe(12);
  });

  it('returns new objects and copes with a missing template', () => {
    const partial = templateToInputs(gu, { gPerHour: 75 });
    expect(Object.isFrozen(partial.carbs.ingredients[0])).toBe(false);
    expect(templateToInputs(undefined).carbs.ingredients).toEqual([]);
  });

  it.each(TEMPLATES.map((tpl) => [tpl.id, tpl]))('%s gives a plan whose ingredients make its ratio', (_, tpl) => {
    const base = normalizeInputs({});
    const partial = templateToInputs(tpl, { gPerHour: 75 });
    const inputs = normalizeInputs({ ...base, ...partial, carbs: { ...base.carbs, ...partial.carbs } });
    const refs = [...tpl.glucoseSources, ...tpl.fructoseSources].map((s) => s.id);
    expect(inputs.carbs.ingredients.map((i) => i.ref)).toEqual(refs);
    expect(inputs.salts.sodiumSalt).toBe(tpl.sodiumSalt);
    const plan = computePlan(inputs);
    expect(plan.carbs.warnings.map((w) => w.id)).not.toContain('carbs.ratioNotReachable');
    const share = tpl.ratio.fructose / (tpl.ratio.glucose + tpl.ratio.fructose);
    expect(plan.carbs.ingredients.achievedShare).toBeCloseTo(share, 6);
    expect(plan.carbs.deliveredG).toBeCloseTo(225, 6);
    expect(plan.sodium.mode).toBe('auto');
    expect(plan.sodium.mgPerHour).toBe(plan.sodium.recommended.mgPerHour);
  });
});

describe('speedForSport', () => {
  it('replaces a speed that does not fit the new sport with its typical speed', () => {
    // A 30 km/h ride as a run would be 2:00 min/km, twice world-record pace.
    expect(speedForSport('running', 30)).toBe(SPORT_DEFAULT_SPEED_KMH.running);
    expect(speedForSport('cycling', 8)).toBe(SPORT_DEFAULT_SPEED_KMH.cycling);
    expect(speedForSport('running', NaN)).toBe(11);
  });

  it('keeps a speed that fits, and the speed of sports without one', () => {
    expect(speedForSport('running', 12)).toBe(12);
    expect(speedForSport('cycling', 18)).toBe(18);
    expect(speedForSport('other', 30)).toBe(30);
    expect(speedForSport('swimming', 30)).toBe(30);
    for (const sport of ['running', 'cycling']) {
      const [lo, hi] = SPORT_SPEED_RANGE_KMH[sport];
      expect(speedForSport(sport, lo)).toBe(lo);
      expect(speedForSport(sport, hi)).toBe(hi);
      expect(lo).toBeGreaterThanOrEqual(INPUT_LIMITS.speedKmh[0]);
      expect(hi).toBeLessThanOrEqual(INPUT_LIMITS.speedKmh[1]);
    }
  });

  it('keeps a running estimate off the model ceiling after switching from the default ride', () => {
    const ride = computePlan(DEFAULT_INPUTS);
    const run = computePlan({ event: { sport: 'running', speedKmh: speedForSport('running', ride.inputs.event.speedKmh) } });
    expect(run.sweat.estimate.capped).toBe(false);
    expect(run.sweat.rateLph).toBeLessThan(1.5);
  });
});
