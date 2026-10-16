import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  DEFAULT_INPUTS,
  INPUT_LIMITS,
  INPUT_OPTIONS,
  normalizeInputs,
  computePlan,
  templateToInputs,
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

/** Paths of every number in `value` that is NaN or infinite. */
function badNumbers(value, path = 'plan', out = []) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) out.push(`${path} = ${value}`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => badNumbers(v, `${path}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) badNumbers(v, `${path}.${k}`, out);
  }
  return out;
}

const ids = (warnings) => warnings.map((w) => w.id);

/** A number field: mostly in range, sometimes out of range or junk. */
const numberish = ([lo, hi]) =>
  fc.oneof(
    { weight: 4, arbitrary: fc.double({ min: lo, max: hi, noNaN: true }) },
    { weight: 1, arbitrary: fc.double({ min: lo - 10 * (hi - lo + 1), max: hi + 10 * (hi - lo + 1), noNaN: true }) },
    { weight: 1, arbitrary: fc.constantFrom(NaN, Infinity, -Infinity, null, undefined, '', '42', 'abc', true, {}, []) },
  );
const enumish = (values) => fc.oneof({ weight: 4, arbitrary: fc.constantFrom(...values) }, { weight: 1, arbitrary: fc.anything() });
const boolish = fc.oneof({ weight: 4, arbitrary: fc.boolean() }, { weight: 1, arbitrary: fc.anything() });
const sourceListish = (idPool) =>
  fc.oneof(
    { weight: 4, arbitrary: fc.array(fc.record({ id: fc.constantFrom(...idPool), percentage: numberish([0, 200]) }), { maxLength: 4 }) },
    { weight: 1, arbitrary: fc.anything() },
  );
const partialRecord = (shape) => fc.record(shape, { requiredKeys: [] });

/** Random partial inputs: mostly plausible values, with junk mixed in. */
const partialInputsArb = partialRecord({
  event: partialRecord({
    durationMin: numberish([0, 600]),
    intensity: enumish(INPUT_OPTIONS.intensity),
    highCarb: boolish,
  }),
  athlete: partialRecord({ massKg: numberish(INPUT_LIMITS.massKg), sex: enumish(INPUT_OPTIONS.sex) }),
  environment: partialRecord({ tempC: numberish(INPUT_LIMITS.tempC), humidity: numberish(INPUT_LIMITS.humidity) }),
  sweat: partialRecord({
    source: enumish(INPUT_OPTIONS.sweatSource),
    rateIndex: numberish(INPUT_LIMITS.presetIndex),
    saltinessIndex: numberish(INPUT_LIMITS.presetIndex),
  }),
  carbs: partialRecord({
    mode: enumish(INPUT_OPTIONS.mode),
    manualGPerHour: numberish(INPUT_LIMITS.manualGPerHour),
    ratioMode: enumish(INPUT_OPTIONS.mode),
    manualRatio: partialRecord({ glucose: numberish([0, 2]), fructose: numberish([0, 2]) }),
    glucoseSources: sourceListish([1, 2, 3, 4, 5, 6, 7, 8, 11, 31]),
    fructoseSources: sourceListish([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 3, 99]),
  }),
  sodium: partialRecord({ mode: enumish(INPUT_OPTIONS.mode), manualMgPerHour: numberish([0, 2500]) }),
  extras: partialRecord({ potassium: boolish, magnesium: boolish, calcium: boolish }),
  salts: partialRecord({
    mode: enumish(INPUT_OPTIONS.mode),
    sodiumSalt: enumish(INPUT_OPTIONS.sodiumSalt),
    manual: fc.oneof(
      fc.array(fc.record({ id: fc.constantFrom(31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 3), amountMg: numberish([0, 20000]) }), { maxLength: 5 }),
      fc.anything(),
    ),
  }),
  fluid: partialRecord({ mode: enumish(INPUT_OPTIONS.mode), manualMlPerHour: numberish([0, 2000]) }),
  format: partialRecord({ gelsPerHour: numberish(INPUT_LIMITS.gelsPerHour), view: enumish(INPUT_OPTIONS.view) }),
  caffeine: partialRecord({
    enabled: boolish,
    mgPerKg: numberish(INPUT_LIMITS.caffeineMgPerKg),
    asIngredient: boolish,
    tabletMg: enumish(INPUT_OPTIONS.tabletMg),
  }),
  bicarb: partialRecord({ enabled: boolish, gPerKg: numberish(INPUT_LIMITS.bicarbGPerKg) }),
});

describe('DEFAULT_INPUTS', () => {
  it('matches the v3 schema in the spec', () => {
    expect(DEFAULT_INPUTS).toEqual({
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
    });
  });

  it('is deeply frozen', () => {
    expect(Object.isFrozen(DEFAULT_INPUTS)).toBe(true);
    expect(Object.isFrozen(DEFAULT_INPUTS.carbs.glucoseSources[0])).toBe(true);
  });
});

describe('normalizeInputs', () => {
  it('returns unfrozen copies of the defaults for empty or junk input', () => {
    for (const junk of [undefined, null, 42, 'x', [], () => {}, new Date(0)]) {
      const result = normalizeInputs(junk);
      expect(result).toEqual(DEFAULT_INPUTS);
      expect(result).not.toBe(DEFAULT_INPUTS);
      expect(Object.isFrozen(result.carbs.glucoseSources)).toBe(false);
    }
  });

  it('deep-merges a partial onto the defaults and drops unknown keys', () => {
    const result = normalizeInputs({
      event: { durationMin: 240, extra: 1 },
      carbs: { manualRatio: { fructose: 0.5 } },
      unknownSection: { a: 1 },
    });
    expect(result.event).toEqual({ durationMin: 240, intensity: 'moderate', highCarb: false });
    expect(result.carbs.manualRatio).toEqual({ glucose: 1, fructose: 0.5 });
    expect(result).not.toHaveProperty('unknownSection');
  });

  it('clamps numbers to the spec bounds', () => {
    const low = normalizeInputs({
      event: { durationMin: -5 },
      athlete: { massKg: 1 },
      environment: { tempC: -100, humidity: -1 },
      carbs: { manualGPerHour: -1, manualRatio: { glucose: -1, fructose: -1 } },
      sodium: { manualMgPerHour: -1 },
      fluid: { manualMlPerHour: -1 },
      format: { gelsPerHour: -1 },
      caffeine: { mgPerKg: 0 },
      bicarb: { gPerKg: 0 },
    });
    expect(low.event.durationMin).toBe(0);
    expect(low.athlete.massKg).toBe(30);
    expect(low.environment).toEqual({ tempC: -20, humidity: 0 });
    expect(low.carbs.manualGPerHour).toBe(0);
    expect(low.carbs.manualRatio).toEqual({ glucose: 0, fructose: 0 });
    expect(low.sodium.manualMgPerHour).toBe(0);
    expect(low.fluid.manualMlPerHour).toBe(0);
    expect(low.format.gelsPerHour).toBe(0);
    expect(low.caffeine.mgPerKg).toBe(1);
    expect(low.bicarb.gPerKg).toBe(0.2);

    const high = normalizeInputs({
      event: { durationMin: 1e9 },
      athlete: { massKg: 1e9 },
      environment: { tempC: 1e9, humidity: 1e9 },
      carbs: { manualGPerHour: 1e9, manualRatio: { glucose: 1e9, fructose: 1e9 } },
      sodium: { manualMgPerHour: 1e9 },
      fluid: { manualMlPerHour: 1e9 },
      format: { gelsPerHour: 1e9 },
      caffeine: { mgPerKg: 1e9 },
      bicarb: { gPerKg: 1e9 },
    });
    expect(high.event.durationMin).toBe(2880);
    expect(high.athlete.massKg).toBe(200);
    expect(high.environment).toEqual({ tempC: 50, humidity: 100 });
    expect(high.carbs.manualGPerHour).toBe(200);
    expect(high.carbs.manualRatio).toEqual({ glucose: 5, fructose: 5 });
    expect(high.sodium.manualMgPerHour).toBe(5000);
    expect(high.fluid.manualMlPerHour).toBe(3000);
    expect(high.format.gelsPerHour).toBe(12);
    expect(high.caffeine.mgPerKg).toBe(6);
    expect(high.bicarb.gPerKg).toBe(0.3);
  });

  it('falls back to defaults for non-finite numbers and wrong types', () => {
    const result = normalizeInputs({
      event: { durationMin: NaN, intensity: 'sprint', highCarb: 'yes' },
      athlete: { massKg: Infinity, sex: 'other' },
      environment: { tempC: -Infinity, humidity: {} },
      sweat: { source: 'test', rateIndex: NaN, saltinessIndex: null },
      format: { gelsPerHour: 'lots', view: 'perBottle' },
      caffeine: { tabletMg: 150, enabled: 1 },
      salts: { sodiumSalt: 'sea', mode: 'auto-ish' },
    });
    expect(result).toEqual(DEFAULT_INPUTS);
  });

  it('coerces numeric strings, as form fields deliver them', () => {
    const result = normalizeInputs({
      event: { durationMin: '95' },
      caffeine: { tabletMg: '200' },
      carbs: { glucoseSources: [{ id: '1', percentage: '50' }] },
    });
    expect(result.event.durationMin).toBe(95);
    expect(result.caffeine.tabletMg).toBe(200);
    expect(result.carbs.glucoseSources).toEqual([{ id: 1, percentage: 50 }]);
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

  it('only keeps carb sources from the matching list', () => {
    const result = normalizeInputs({
      carbs: {
        glucoseSources: [{ id: 11, percentage: 50 }, { id: 3, percentage: 2000 }, { id: 31, percentage: 10 }, 'x', null],
        fructoseSources: [{ id: 3, percentage: 50 }, { id: 18, percentage: NaN }, { percentage: 10 }],
      },
    });
    expect(result.carbs.glucoseSources).toEqual([{ id: 3, percentage: 1000 }]);
    expect(result.carbs.fructoseSources).toEqual([{ id: 18, percentage: 0 }]);
  });

  it('keeps empty source lists but restores defaults for non-arrays', () => {
    expect(normalizeInputs({ carbs: { fructoseSources: [] } }).carbs.fructoseSources).toEqual([]);
    expect(normalizeInputs({ carbs: { fructoseSources: 'none' } }).carbs.fructoseSources).toEqual([
      { id: 11, percentage: 100 },
    ]);
  });

  it('only keeps electrolyte ids in manual salts and clamps amounts', () => {
    const result = normalizeInputs({
      salts: {
        manual: [
          { id: 31, amountMg: 2500 },
          { id: 3, amountMg: 100 },
          { id: 39, amountMg: 1e9 },
          { id: 33, amountMg: -4 },
          { id: 34, amountMg: 'abc' },
        ],
      },
    });
    expect(result.salts.manual).toEqual([
      { id: 31, amountMg: 2500 },
      { id: 39, amountMg: 1100000 },
      { id: 33, amountMg: 0 },
      { id: 34, amountMg: 0 },
    ]);
  });

  it('does not mutate its argument', () => {
    const partial = { event: { durationMin: -10 }, carbs: { glucoseSources: [{ id: 3, percentage: 5000 }] } };
    const snapshot = structuredClone(partial);
    normalizeInputs(partial);
    expect(partial).toEqual(snapshot);
  });

  it('is idempotent and survives a JSON round trip (property)', () => {
    fc.assert(
      fc.property(partialInputsArb, (partial) => {
        const once = normalizeInputs(partial);
        expect(normalizeInputs(once)).toEqual(once);
        expect(JSON.parse(JSON.stringify(once))).toEqual(once);
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
  it('golden: the default plan', () => {
    const plan = computePlan(DEFAULT_INPUTS);
    expect(plan.durationMin).toBe(180);
    expect(plan.durationH).toBe(3);
    // [jeukendrup2014] [burke2011] > 2.5 h, moderate: middle of 60–90 g/h → 75 g/h
    expect(plan.carbs.gPerHour).toBe(75);
    expect(plan.carbs.totalG).toBe(225);
    expect(plan.carbs.recommended.band).toBe('long');
    // [jeukendrup2014] [obrien2013] 60–90 g/h: 2:1 → 1:0.5
    expect(plan.carbs.ratio.value).toEqual({ glucose: 1, fructose: 0.5 });
    expect(plan.carbs.ratio.share).toBeCloseTo(1 / 3, 10);
    expect(plan.carbs.sources.canAchieveRatio).toBe(true);
    // [sawka2007] [mccubbin2023] 1.25 L/h × 40 mmol/L × 22.99 = 1149.5 mg/h loss; half → 570 mg/h
    expect(plan.sweat).toMatchObject({ rateLph: 1.25, sodiumMmolL: 40, source: 'preset' });
    expect(plan.sodium.mgPerHour).toBe(570);
    expect(plan.sodium.totalMg).toBe(1710);
    // [sawka2007] 80% of 1250 ml/h sweat, capped at 800 ml/h
    expect(plan.fluid.mlPerHour).toBe(800);
    expect(plan.fluid.totalMl).toBe(2400);
    expect(plan.gels).toEqual({ perHour: 3, count: 9, times: [0, 20, 40, 60, 80, 100, 120, 140, 160] });
    expect(plan.energy.kcal).toBe(900);
    expect(plan.cost.diy).toBeCloseTo(3.375, 10);
    expect(plan.cost.commercial).toBeCloseTo(22.5, 10);
    expect(plan.cost.savings).toBeCloseTo(19.125, 10);
    expect(plan.caffeine.enabled).toBe(false);
    expect(plan.bicarb.enabled).toBe(false);
    expect(plan.warnings).toEqual([]);
    expect(plan.inputs).toEqual(DEFAULT_INPUTS);
  });

  it('golden: default salts deliver the sodium target from table salt', () => {
    const plan = computePlan(DEFAULT_INPUTS);
    expect(plan.salts.mode).toBe('auto');
    expect(plan.salts.items).toEqual([{ id: 31, amountMg: Math.round(1710 / 0.393) }]);
    expect(plan.salts.delivered.Sodium).toBeCloseTo(1710, 0);
    expect(plan.salts.comparison.Sodium.status).toBe('met');
    // Chloride has no target, so it is not compared (it would read as "over").
    expect(plan.salts.comparison).not.toHaveProperty('Chloride');
    expect(plan.salts.delivered.Chloride).toBeGreaterThan(0);
  });

  it('golden: the default recipe lists maltodextrin, fructose and table salt', () => {
    const plan = computePlan(DEFAULT_INPUTS);
    expect(plan.recipe.view).toBe('total');
    expect(plan.recipe.items.map((i) => i.key)).toEqual(['carb:glucose:3', 'carb:fructose:11', 'salt:31']);
    const perGel = computePlan({ format: { view: 'perGel' } });
    expect(perGel.recipe.items[0].amount).toBeCloseTo(plan.recipe.items[0].amount / 9, 10);
  });

  it('golden: the schedule starts, fuels every 20 min and finishes', () => {
    const plan = computePlan(DEFAULT_INPUTS);
    const types = plan.schedule.map((e) => e.type);
    expect(types[0]).toBe('start');
    expect(types.at(-1)).toBe('finish');
    expect(types.filter((x) => x === 'fuel')).toHaveLength(8);
    // 800 ml/h over 20 min gel intervals: 266.7 ml each, rounded on the running total
    // (260, 270, 270, …), so the 9 gels list exactly the plan's 2,400 ml.
    expect(plan.schedule[0].fluidMl).toBe(260);
    expect(plan.schedule.reduce((sum, e) => sum + (e.fluidMl ?? 0), 0)).toBe(2400);
  });

  it('uses manual values instead of recommendations', () => {
    const plan = computePlan({
      carbs: { mode: 'manual', manualGPerHour: 60, ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 0.8 } },
      sodium: { mode: 'manual', manualMgPerHour: 400 },
      fluid: { mode: 'manual', manualMlPerHour: 600 },
    });
    expect(plan.carbs.gPerHour).toBe(60);
    expect(plan.carbs.recommended.gPerHour).toBe(75);
    expect(plan.carbs.ratio.value).toEqual({ glucose: 1, fructose: 0.8 });
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

  it('manual fluid above the sweat rate gets fluid.aboveSweat', () => {
    // [almond2005] [hewbutler2015] 1.25 L/h sweat, drinking 1500 ml/h
    const plan = computePlan({ fluid: { mode: 'manual', manualMlPerHour: 1500 } });
    expect(ids(plan.fluid.warnings)).toEqual(['fluid.aboveSweat']);
    expect(plan.warnings[0]).toMatchObject({ id: 'fluid.aboveSweat', level: 'danger' });
  });

  it('manual fluid above 800 ml/h but below sweat gets fluid.aboveCeiling', () => {
    // [sawka2007]
    const plan = computePlan({ sweat: { rateIndex: 5 }, fluid: { mode: 'manual', manualMlPerHour: 1000 } });
    expect(ids(plan.fluid.warnings)).toEqual(['fluid.aboveCeiling']);
  });

  it('a manual ratio gets checkRatio warnings; the auto ratio does not', () => {
    const tooLittle = computePlan({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 0 } } });
    expect(ids(tooLittle.carbs.ratio.warnings)).toEqual(['carbs.tooLittleFructose']);
    const tooMuch = computePlan({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 2 } } });
    expect(ids(tooMuch.carbs.ratio.warnings)).toEqual(['carbs.tooMuchFructose']);
    const none = computePlan({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } });
    expect(ids(none.carbs.ratio.warnings)).toEqual(['carbs.noRatio']);
    // 0:0 is already flagged; no second warning about the sources.
    expect(ids(none.warnings)).not.toContain('plan.carbSourcesInfeasible');
    expect(computePlan(DEFAULT_INPUTS).carbs.ratio.warnings).toEqual([]);
  });

  it('warns when the carb sources cannot deliver the ratio', () => {
    const plan = computePlan({ carbs: { fructoseSources: [] } });
    expect(plan.carbs.sources.canAchieveRatio).toBe(false);
    expect(plan.carbs.warnings).toContainEqual({
      id: 'plan.carbSourcesInfeasible',
      level: 'warning',
      message: { key: 'plan.warn.carbSourcesInfeasible', params: { glucose: 1, fructose: 0.5 } },
    });
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
  });

  it('manual salts use the list as given and warn on the sodium they deliver', () => {
    const plan = computePlan({ salts: { mode: 'manual', manual: [{ id: 31, amountMg: 15000 }] } });
    expect(plan.salts.items).toEqual([{ id: 31, amountMg: 15000 }]);
    // 15 g table salt over 3 h ≈ 1965 mg/h sodium
    expect(ids(plan.salts.warnings)).toContain('electrolytes.sodiumFarAbove');
    expect(plan.salts.comparison.Sodium.status).toBe('over');
  });

  it('auto salts follow the sodium salt and enabled extras', () => {
    const plan = computePlan({
      salts: { sodiumSalt: 'mix' },
      extras: { potassium: true, magnesium: true, calcium: true },
    });
    expect(plan.salts.items.map((s) => s.id)).toEqual([31, 33, 39, 34, 35]);
    expect(plan.extras.Potassium.totalMg).toBe(plan.extras.Potassium.mgPerHour * 3);
    for (const ion of ['Sodium', 'Potassium', 'Magnesium', 'Calcium']) {
      expect(plan.salts.comparison[ion].status).toBe('met');
    }
  });

  it('plans caffeine on the gel times and puts it in the schedule and recipe', () => {
    const plan = computePlan({ caffeine: { enabled: true, asIngredient: true } });
    expect(plan.caffeine.enabled).toBe(true);
    const intra = plan.caffeine.doses.find((d) => d.kind === 'intra');
    expect(plan.gels.times).toContain(intra.timeMin);
    expect(plan.schedule.some((e) => e.caffeineMg === intra.mg && e.timeMin === intra.timeMin)).toBe(true);
    expect(plan.recipe.items.some((i) => i.kind === 'caffeine')).toBe(true);
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
    });
    const levels = plan.warnings.map((w) => w.level);
    const rank = { danger: 0, warning: 1, info: 2 };
    expect(levels).toEqual([...levels].sort((a, b) => rank[a] - rank[b]));
    const warningIds = ids(plan.warnings);
    expect(new Set(warningIds).size).toBe(warningIds.length);
  });

  it('handles a zero-length event', () => {
    const plan = computePlan({ event: { durationMin: 0 }, salts: { mode: 'manual', manual: [{ id: 31, amountMg: 500 }] } });
    expect(plan.durationH).toBe(0);
    expect(plan.carbs.totalG).toBe(0);
    expect(plan.salts.warnings).toEqual([]);
    expect(badNumbers(plan)).toEqual([]);
  });

  it('does not mutate its input', () => {
    const inputs = normalizeInputs({ caffeine: { enabled: true } });
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
    ];
    for (const inputs of configs) collectCitationIds(computePlan(inputs), seen);
    fc.assert(
      fc.property(partialInputsArb, (partial) => {
        collectCitationIds(computePlan(normalizeInputs(partial)), seen);
      }),
      { numRuns: 300 },
    );
    expect(seen.size).toBeGreaterThan(20);
    const unknown = [...seen].filter((id) => !Object.hasOwn(CITATIONS, id));
    expect(unknown).toEqual([]);
  });

  it('never throws and never returns NaN or infinite numbers (property)', () => {
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
    expect(kinds(plan)).toEqual(['start', 'hydration', 'finish']);
    expect(plan.schedule.some((e) => /gel/i.test(e.message.key))).toBe(false);
    expect(plan.recipe.items.every((item) => item.kind === 'salt')).toBe(true);
  });

  it('keeps gels for any carb target above 0', () => {
    expect(computePlan({ event: { durationMin: 60 } }).gels.count).toBe(3); // 15 g/h
  });

  // [jeukendrup2014] at ≤ 60 g/h glucose alone works, so glucose-only sources must not empty the recipe
  it('falls back to 1:0 in auto mode when only glucose sources are listed at ≤ 60 g/h', () => {
    const plan = computePlan({ event: { durationMin: 120 }, carbs: { fructoseSources: [] } });
    expect(plan.carbs.gPerHour).toBe(55);
    expect(plan.carbs.ratio.value).toEqual({ glucose: 1, fructose: 0 });
    expect(plan.carbs.sources.canAchieveRatio).toBe(true);
    expect(plan.carbs.sources.items.map((i) => i.id)).toEqual([3]);
    expect(plan.carbs.deliveredG).toBeCloseTo(110, 6);
    expect(ids(plan.carbs.ratio.warnings)).toEqual(['plan.ratioSubstituted']);
    expect(plan.carbs.ratio.warnings[0].message.params).toEqual({ recommended: '1:0.5', used: '1:0', gPerHour: 55 });
    expect(ids(plan.warnings)).not.toContain('plan.carbSourcesInfeasible');
  });

  it('falls back to 1:1 when a mixed fructose source is the only source', () => {
    // Honey is half glucose, so it can make 1:1 alone but not 1:0.5.
    const plan = computePlan({ carbs: { glucoseSources: [], fructoseSources: [{ id: 14, percentage: 100 }] } });
    expect(plan.carbs.ratio.value).toEqual({ glucose: 1, fructose: 1 });
    expect(plan.carbs.sources.canAchieveRatio).toBe(true);
    expect(ids(plan.carbs.ratio.warnings)).toEqual(['plan.ratioSubstituted']);
  });

  it('only falls back inside the allowed range, and never in manual mode', () => {
    // 75 g/h needs at least 1:0.5; glucose alone is not allowed, so the plan stays infeasible.
    const auto = computePlan({ carbs: { fructoseSources: [] } });
    expect(auto.carbs.ratio.value).toEqual({ glucose: 1, fructose: 0.5 });
    expect(ids(auto.warnings)).toContain('plan.carbSourcesInfeasible');
    expect(ids(auto.carbs.ratio.warnings)).toEqual([]);
    const manual = computePlan({
      event: { durationMin: 120 },
      carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 0.5 }, fructoseSources: [] },
    });
    expect(manual.carbs.ratio.value).toEqual({ glucose: 1, fructose: 0.5 });
    expect(ids(manual.warnings)).toContain('plan.carbSourcesInfeasible');
  });

  it('exposes delivered carbs, delivered energy and the g/h on each pathway', () => {
    const plan = computePlan(DEFAULT_INPUTS);
    expect(plan.carbs.deliveredG).toBeCloseTo(225, 6);
    expect(plan.energy.deliveredKcal).toBeCloseTo(900, 6);
    expect(plan.carbs.ratio.glucoseGPerHour).toBeCloseTo(50, 10);
    expect(plan.carbs.ratio.fructoseGPerHour).toBeCloseTo(25, 10);
    const infeasible = computePlan({ carbs: { fructoseSources: [] } });
    expect(infeasible.carbs.deliveredG).toBe(0);
    expect(infeasible.energy).toEqual({ kcal: 900, deliveredKcal: 0 });
    const noRatio = computePlan({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } });
    expect(noRatio.carbs.ratio.glucoseGPerHour).toBe(0);
    expect(noRatio.carbs.ratio.fructoseGPerHour).toBe(0);
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
    const heavy = { event: { durationMin: 2880 }, sweat: { rateIndex: 5, saltinessIndex: 5 } };
    const heavyAuto = computePlan(heavy);
    const heavyManual = computePlan({ ...heavy, salts: { mode: 'manual', manual: heavyAuto.salts.items } });
    expect(heavyManual.salts.delivered.Sodium).toBeCloseTo(heavyAuto.salts.delivered.Sodium, 6);
  });

  it('rounds the per-hour sodium of manual salts in warnings', () => {
    // 30 g table salt over 7 h is 1684.29 mg/h of sodium.
    const plan = computePlan({ event: { durationMin: 420 }, salts: { mode: 'manual', manual: [{ id: 31, amountMg: 30000 }] } });
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

  it('maps a template to partial inputs', () => {
    // 75 g/h ÷ 23 g/gel = 3.26 → 3.5 gels/h. The sodium target is not touched.
    expect(templateToInputs(gu, { gPerHour: 75 })).toEqual({
      carbs: {
        ratioMode: 'manual',
        manualRatio: { glucose: gu.ratio.glucose, fructose: gu.ratio.fructose },
        glucoseSources: gu.glucoseSources.map((s) => ({ ...s })),
        fructoseSources: gu.fructoseSources.map((s) => ({ ...s })),
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
    expect(after.sodium.mgPerHour).toBe(before.sodium.mgPerHour); // 570 mg/h, not 60
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

  it('returns copies, not the frozen template lists', () => {
    const partial = templateToInputs(gu, { gPerHour: 75 });
    expect(partial.carbs.glucoseSources).not.toBe(gu.glucoseSources);
    expect(Object.isFrozen(partial.carbs.glucoseSources[0])).toBe(false);
  });

  it.each(TEMPLATES.map((tpl) => [tpl.id, tpl]))('%s gives a plan whose sources can deliver its ratio', (_, tpl) => {
    const base = normalizeInputs({});
    const partial = templateToInputs(tpl, { gPerHour: 75 });
    const inputs = normalizeInputs({ ...base, ...partial, carbs: { ...base.carbs, ...partial.carbs } });
    expect(inputs.carbs.glucoseSources).toEqual(tpl.glucoseSources);
    expect(inputs.carbs.fructoseSources).toEqual(tpl.fructoseSources);
    expect(inputs.salts.sodiumSalt).toBe(tpl.sodiumSalt);
    const plan = computePlan(inputs);
    expect(plan.carbs.sources.canAchieveRatio).toBe(true);
    expect(plan.sodium.mode).toBe('auto');
    expect(plan.sodium.mgPerHour).toBe(plan.sodium.recommended.mgPerHour);
  });
});
