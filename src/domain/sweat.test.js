import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  SWEAT_RATE_PRESETS_LPH,
  SWEAT_SODIUM_PRESETS_MMOL,
  SWEAT_TEST_UNCERTAINTY_LPH,
  sweatTestRate,
  resolveSweat,
} from './sweat';
import * as sweatModule from './sweat';
import { estimateSweatRate } from './heatBalance';
import { SWEAT_RATES, ELECTROLYTE_CONCENTRATIONS } from '../constants/constants';
import { CITATIONS } from './evidence';
import sweatCatalog from '../i18n/en/sweat';

/** Test session: tempo run, 70 kg/175 cm, 12 km/h, 20 °C/50 %, shade. */
const TEST_CONDITIONS = Object.freeze({
  sport: 'running',
  speedKmh: 12,
  powerW: 0,
  mets: 8,
  setting: 'outdoor',
  tempC: 20,
  humidity: 50,
  sun: 'none',
});

/** 60 min, lost 0.8 kg, drank 0.3 L, passed 0.1 L urine → 1.0 L/h before the correction. */
const TEST = Object.freeze({
  id: 't1',
  date: '2026-06-01',
  label: 'Tempo run',
  preKg: 70,
  postKg: 69.2,
  fluidL: 0.3,
  urineL: 0.1,
  durationMin: 60,
  conditions: TEST_CONDITIONS,
});

const ATHLETE = Object.freeze({ massKg: 70, heightCm: 175, acclimatised: false });

/** v4 context: race run at 12 km/h, 30 °C/60 %, shade (frozen all the way down). */
const CONTEXT = deepFreeze({
  event: { durationMin: 180, intensity: 'moderate', sport: 'running', speedKmh: 12, powerW: 0, mets: 8, setting: 'outdoor' },
  athlete: ATHLETE,
  environment: { tempC: 30, humidity: 60, sun: 'none' },
});

/** The race conditions of CONTEXT as a model input. */
const RACE = { ...TEST_CONDITIONS, tempC: 30, humidity: 60, massKg: 70, heightCm: 175 };

/** Race in the test conditions (20 °C/50 %): model 0.95 L/h. */
const COOL = deepFreeze({ ...CONTEXT, environment: { tempC: 20, humidity: 50, sun: 'none' } });

/** Hot race: 35 °C/50 %, full sun: model 2.65 L/h, ceiling min(3, 1.5 × 1.848 m²) = 2.77 L/h. */
const HOT = deepFreeze({ ...CONTEXT, environment: { tempC: 35, humidity: 50, sun: 'full' } });

/** Freezes an object and everything in it. */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/** Collects every message descriptor in a resolveSweat result. */
function messagesOf(result) {
  return [
    result.why.summary,
    ...(result.why.details ?? []),
    ...result.warnings.map((w) => w.message),
    ...result.tests.flatMap((t) => t.problems),
  ];
}

function placeholders(text) {
  return [...text.matchAll(/\{(\w+)(?::\w+)*\}/g)].map((m) => m[1]);
}

describe('presets', () => {
  it('re-exports the sweat rate presets from constants', () => {
    expect(SWEAT_RATE_PRESETS_LPH).toEqual(SWEAT_RATES);
    expect(SWEAT_RATE_PRESETS_LPH).toEqual([0.25, 0.75, 1.25, 1.75, 2.25, 2.75]);
  });

  it('uses the sodium concentrations from constants', () => {
    expect(SWEAT_SODIUM_PRESETS_MMOL).toEqual(ELECTROLYTE_CONCENTRATIONS.Sodium);
    expect(SWEAT_SODIUM_PRESETS_MMOL).toEqual([15, 25, 40, 55, 70, 90]);
  });

  it('uses ±0.15 L/h for a sweat test', () => {
    expect(SWEAT_TEST_UNCERTAINTY_LPH).toBe(0.15);
  });

  it('no longer exports the legacy estimate', () => {
    expect(sweatModule).not.toHaveProperty('estimateSweatRateLegacy');
  });
});

describe('sweatTestRate', () => {
  it('subtracts 0.2 g per kcal burned from the mass balance', () => {
    // [baker2017] [sawka2007] sweat = pre − post + fluid − urine
    // [cheuvront2017] correction 0.0002 kg/kcal × 912.6 kcal = 0.183 L
    const r = sweatTestRate(TEST, ATHLETE);
    expect(r.valid).toBe(true);
    expect(r.problems).toEqual([]);
    expect(r.rawLph).toBeCloseTo(1.0, 9);
    expect(r.energyKcal).toBeCloseTo((1060.675 * 3600) / 4184, 6);
    expect(r.correctionL).toBeCloseTo(0.0002 * r.energyKcal, 12);
    expect(r.correctionL).toBeCloseTo(0.1825, 4);
    expect(r.rateLph).toBeCloseTo(0.8175, 4);
  });

  it('divides by the duration in hours and scales the energy with it', () => {
    // 90 min, lost 1.2 kg, drank 0.6 L, no urine → 1.8 L / 1.5 h = 1.2 L/h raw
    const r = sweatTestRate({ ...TEST, durationMin: 90, postKg: 68.8, fluidL: 0.6, urineL: 0 }, ATHLETE);
    expect(r.rawLph).toBeCloseTo(1.2, 9);
    expect(r.energyKcal).toBeCloseTo(912.6267 * 1.5, 3);
    expect(r.rateLph).toBeCloseTo(1.2 - (0.0002 * 912.6267 * 1.5) / 1.5, 6);
  });

  it('uses the energy of the test conditions from the heat-balance model', () => {
    const cycling = { ...TEST, conditions: { sport: 'cycling', powerW: 200, speedKmh: 30, tempC: 20, humidity: 50 } };
    // 200 W at 20 % efficiency = 1000 W = 860.4 kcal/h
    expect(sweatTestRate(cycling, ATHLETE).energyKcal).toBeCloseTo((1000 * 3600) / 4184, 6);
    // missing conditions use the plan defaults
    const plain = { ...TEST, conditions: undefined };
    expect(sweatTestRate(plain, ATHLETE).energyKcal).toBeCloseTo(estimateSweatRate({ massKg: 70, heightCm: 175 }).energyKcalPerHour, 9);
  });

  it('takes conditions the test does not set from the fallback conditions', () => {
    const plain = { ...TEST, conditions: undefined };
    expect(sweatTestRate(plain, ATHLETE, TEST_CONDITIONS)).toEqual(sweatTestRate(TEST, ATHLETE));
    // field by field: the test's own values win, unusable values are replaced
    const partial = { ...TEST, conditions: { tempC: 20, humidity: 50, sport: 'swim', speedKmh: NaN } };
    expect(sweatTestRate(partial, ATHLETE, TEST_CONDITIONS)).toEqual(sweatTestRate(TEST, ATHLETE));
    const cycling = { sport: 'cycling', powerW: 200, speedKmh: 30 };
    expect(sweatTestRate(TEST, ATHLETE, cycling)).toEqual(sweatTestRate(TEST, ATHLETE));
    expect(sweatTestRate(plain, ATHLETE, null)).toEqual(sweatTestRate(plain, ATHLETE));
  });

  it("uses the test's pre-session mass when the athlete mass is missing", () => {
    const heavy = { ...TEST, preKg: 90, postKg: 89.2 };
    expect(sweatTestRate(heavy, {}).energyKcal).toBeCloseTo(
      estimateSweatRate({ ...TEST_CONDITIONS, massKg: 90 }).energyKcalPerHour,
      9,
    );
    expect(sweatTestRate(heavy, { massKg: 70 }).energyKcal).toBeCloseTo(912.6267, 3);
  });

  it('counts a missing, negative or non-finite fluid or urine volume as 0', () => {
    const base = sweatTestRate({ ...TEST, fluidL: 0, urineL: 0 }, ATHLETE);
    expect(sweatTestRate({ ...TEST, fluidL: undefined, urineL: null }, ATHLETE)).toEqual(base);
    expect(sweatTestRate({ ...TEST, fluidL: -1, urineL: NaN }, ATHLETE)).toEqual(base);
    expect(base.rawLph).toBeCloseTo(0.8, 9);
  });

  it('is invalid when the duration is not above 0', () => {
    for (const durationMin of [0, -30, NaN, undefined, '60']) {
      const r = sweatTestRate({ ...TEST, durationMin }, ATHLETE);
      expect(r).toEqual({
        valid: false,
        rateLph: 0,
        rawLph: 0,
        correctionL: 0,
        energyKcal: 0,
        problems: [{ key: 'sweat.test.problem.duration' }],
      });
    }
  });

  it('is invalid when a body mass is not above 0', () => {
    expect(sweatTestRate({ ...TEST, preKg: 0 }, ATHLETE).problems).toEqual([{ key: 'sweat.test.problem.mass' }]);
    expect(sweatTestRate({ ...TEST, postKg: -1 }, ATHLETE).problems).toEqual([{ key: 'sweat.test.problem.mass' }]);
    expect(sweatTestRate({ ...TEST, postKg: undefined }, ATHLETE).valid).toBe(false);
    // both problems at once
    expect(sweatTestRate({ ...TEST, durationMin: 0, preKg: NaN }, ATHLETE).problems).toEqual([
      { key: 'sweat.test.problem.duration' },
      { key: 'sweat.test.problem.mass' },
    ]);
  });

  it('is invalid when the rate is not above 0', () => {
    // gained 0.2 kg: (70 − 70.2 + 0 − 0) − 0.18 = −0.38 L/h
    const r = sweatTestRate({ ...TEST, postKg: 70.2, fluidL: 0, urineL: 0 }, ATHLETE);
    expect(r.valid).toBe(false);
    expect(r.rateLph).toBeCloseTo(-0.3825, 4);
    expect(r.problems).toEqual([{ key: 'sweat.test.problem.noLoss', params: { rateLph: -0.38 } }]);
    // exactly the correction: rate 0 is not valid either
    const zero = sweatTestRate({ ...TEST, postKg: 70, fluidL: 0, urineL: 0, durationMin: 60 }, ATHLETE);
    expect(zero.valid).toBe(false);
  });

  it('is invalid when the rate is above 5 L/h', () => {
    // lost 6 kg in 1 h
    const r = sweatTestRate({ ...TEST, postKg: 64, fluidL: 0, urineL: 0 }, ATHLETE);
    expect(r.valid).toBe(false);
    expect(r.rateLph).toBeCloseTo(5.8175, 4);
    expect(r.problems).toEqual([{ key: 'sweat.test.problem.tooHigh', params: { rateLph: 5.82, maxLph: 5 } }]);
  });

  it('treats a missing or null test or athlete as {}', () => {
    expect(sweatTestRate(null).valid).toBe(false);
    expect(sweatTestRate(undefined, null).problems).toHaveLength(2);
    expect(sweatTestRate(TEST, null).valid).toBe(true);
  });

  it('does not mutate its arguments and is deterministic', () => {
    expect(sweatTestRate(TEST, ATHLETE)).toEqual(sweatTestRate({ ...TEST }, { ...ATHLETE }));
  });
});

describe('resolveSweat: estimate', () => {
  it('uses the heat-balance model for the event conditions', () => {
    // [gagnon2013] [cramer2019] [jay2024] run 12 km/h at 30 °C/60 % → 1.59 L/h
    const r = resolveSweat({ source: 'estimate', saltinessIndex: 2 }, CONTEXT);
    expect(r.source).toBe('estimate');
    expect(r.rateLph).toBe(estimateSweatRate(RACE).rateLph);
    expect(r.rateLph).toBeCloseTo(1.59, 2);
    expect(r.uncertaintyLph).toBe(0.5);
    expect(r.estimate).toEqual(estimateSweatRate(RACE));
    expect(r.test).toBeNull();
    expect(r.calibration).toBeNull();
    expect(r.warnings).toEqual([]);
    expect(r.why).toEqual({
      summary: { key: 'sweat.why.estimate', params: { rateLph: 1.59, lo: 1.09, hi: 2.09, uncertaintyLph: 0.5 } },
      details: [
        { key: 'sweat.why.estimateDrivers', params: { heatW: 1061, energyKcalPerHour: 913 } },
        { key: 'sweat.why.sodium', params: { sodiumMmolL: 40 } },
        { key: 'sweat.why.measure', params: { lossKg: 1, sweatL: 1 } },
      ],
      citations: ['gagnon2013', 'cramer2019', 'jay2024'],
    });
  });

  it('is the source for an unknown or missing source', () => {
    expect(resolveSweat({ source: 'sweatTest' }, CONTEXT).source).toBe('estimate');
    expect(resolveSweat({}, CONTEXT).source).toBe('estimate');
    expect(resolveSweat(undefined, CONTEXT).rateLph).toBe(resolveSweat({ source: 'estimate' }, CONTEXT).rateLph);
  });

  it('notes when the estimate hits the ceiling', () => {
    const hot = { ...CONTEXT, environment: { tempC: 40, humidity: 90, sun: 'full' } };
    const r = resolveSweat({ source: 'estimate' }, hot);
    expect(r.estimate.capped).toBe(true);
    expect(r.why.details).toContainEqual({
      key: 'sweat.why.estimateCapped',
      params: { maxLph: Math.round(r.estimate.maxRateLph * 100) / 100 },
    });
  });

  it('warns of uncompensable heat stress (danger)', () => {
    // [gagnon2013] [cramer2019] wettedness above 0.85: heat balance is not possible
    const humid = { ...CONTEXT, environment: { tempC: 36, humidity: 60, sun: 'none' } };
    const r = resolveSweat({ source: 'estimate' }, humid);
    expect(r.estimate.uncompensable).toBe(true);
    expect(r.warnings).toEqual([
      {
        id: 'sweat.uncompensable',
        level: 'danger',
        message: { key: 'sweat.warn.uncompensable' },
        citations: ['gagnon2013', 'cramer2019'],
      },
    ]);
  });

  it('reads sport, speed, power, METs, setting, mass, height, acclimatisation and sun from the context', () => {
    const ctx = {
      event: { sport: 'cycling', speedKmh: 30, powerW: 200, mets: 8, setting: 'outdoor' },
      athlete: { massKg: 75, heightCm: 180, acclimatised: true },
      environment: { tempC: 25, humidity: 50, sun: 'partly' },
    };
    expect(resolveSweat({}, ctx).estimate).toEqual(
      estimateSweatRate({ sport: 'cycling', speedKmh: 30, powerW: 200, mets: 8, setting: 'outdoor', massKg: 75, heightCm: 180, acclimatised: true, tempC: 25, humidity: 50, sun: 'partly' }),
    );
  });

  it('uses the plan defaults for missing context sections', () => {
    expect(resolveSweat({}).estimate).toEqual(estimateSweatRate({}));
    expect(resolveSweat({}, null).estimate).toEqual(estimateSweatRate({}));
    // the v3 flat context has no v4 sections: defaults, no crash
    expect(resolveSweat({}, { sex: 'male', intensity: 'hard', tempC: 30, humidity: 80 }).estimate).toEqual(
      estimateSweatRate({}),
    );
  });
});

describe('resolveSweat: preset', () => {
  it('uses the picked preset rate and saltiness', () => {
    // [baker2017] [barnes2019] self-assessed presets with ±0.5 L/h uncertainty
    const r = resolveSweat({ source: 'preset', rateIndex: 2, saltinessIndex: 3 }, CONTEXT);
    expect(r.rateLph).toBe(1.25);
    expect(r.sodiumMmolL).toBe(55);
    expect(r.source).toBe('preset');
    expect(r.uncertaintyLph).toBe(0.5);
    expect(r.estimate).toEqual(estimateSweatRate(RACE));
    expect(r.why).toEqual({
      summary: { key: 'sweat.why.preset', params: { rateLph: 1.25, lo: 0.75, hi: 1.75, uncertaintyLph: 0.5 } },
      details: [{ key: 'sweat.why.sodium', params: { sodiumMmolL: 55 } }, { key: 'sweat.why.measure', params: { lossKg: 1, sweatL: 1 } }],
      citations: ['baker2017', 'barnes2019'],
    });
  });

  it('maps every preset index to its rate and sodium value', () => {
    for (let i = 0; i < 6; i += 1) {
      const r = resolveSweat({ source: 'preset', rateIndex: i, saltinessIndex: i });
      expect(r.rateLph).toBe(SWEAT_RATES[i]);
      expect(r.sodiumMmolL).toBe(ELECTROLYTE_CONCENTRATIONS.Sodium[i]);
    }
  });

  it('clamps and rounds indices to 0–5 and falls back to the middle preset', () => {
    expect(resolveSweat({ source: 'preset', rateIndex: -3, saltinessIndex: -1 })).toMatchObject({ rateLph: 0.25, sodiumMmolL: 15 });
    expect(resolveSweat({ source: 'preset', rateIndex: 9, saltinessIndex: 100 })).toMatchObject({ rateLph: 2.75, sodiumMmolL: 90 });
    expect(resolveSweat({ source: 'preset', rateIndex: 2.6, saltinessIndex: 0.4 })).toMatchObject({ rateLph: 1.75, sodiumMmolL: 15 });
    expect(resolveSweat({ source: 'preset', rateIndex: NaN, saltinessIndex: undefined })).toMatchObject({ rateLph: 1.25, sodiumMmolL: 40 });
    expect(resolveSweat({ source: 'preset', rateIndex: '4', saltinessIndex: null })).toMatchObject({ rateLph: 1.25, sodiumMmolL: 40 });
  });

  it('never reports a negative lower bound', () => {
    const r = resolveSweat({ source: 'preset', rateIndex: 0 });
    expect(r.why.summary.params.lo).toBe(0);
    expect(r.why.summary.params.hi).toBe(0.75);
  });

  it('still warns of uncompensable heat stress', () => {
    const humid = { ...CONTEXT, environment: { tempC: 36, humidity: 60, sun: 'none' } };
    expect(resolveSweat({ source: 'preset' }, humid).warnings.map((w) => w.id)).toEqual(['sweat.uncompensable']);
  });
});

describe('resolveSweat: sweat test', () => {
  const sweat = (over = {}) => ({ source: 'test', saltinessIndex: 2, tests: [TEST], selectedTestId: null, calibrate: true, ...over });

  it('scales the test to the event with the model (calibrate)', () => {
    // [baker2017] [cheuvront2017] test 0.8175 L/h; model 0.9506 L/h for the test (20 °C) and
    // 1.5858 L/h for the event (30 °C/60 %) → factor 1.668 → 1.668 × 0.8175 = 1.364 L/h,
    // the same as the spec's 0.8175 / 0.9506 × 1.5858.
    const r = resolveSweat(sweat(), CONTEXT);
    const testModel = estimateSweatRate({ ...TEST_CONDITIONS, massKg: 70, heightCm: 175 }).rateLph;
    expect(r.source).toBe('test');
    expect(r.uncertaintyLph).toBe(0.15);
    expect(r.calibration).toEqual({
      factor: expect.closeTo(1.5858 / 0.9506, 3),
      ratio: r.calibration.factor,
      testRatio: expect.closeTo(0.8175 / 0.9506, 3),
      applied: true,
      clamped: false,
      capped: false,
      limitLph: r.estimate.maxRateLph,
      testModelLph: testModel,
    });
    expect(r.calibration.factor).toBeCloseTo(r.estimate.rateLph / testModel, 12);
    expect(r.rateLph).toBeCloseTo(r.calibration.factor * r.test.rateLph, 12);
    expect(r.rateLph).toBeCloseTo((r.test.rateLph / testModel) * r.estimate.rateLph, 12);
    expect(r.rateLph).toBeCloseTo(1.364, 3);
    expect(r.test).toEqual({ id: 't1', ...sweatTestRate(TEST, ATHLETE) });
    expect(r.warnings).toEqual([]);
    expect(r.why).toEqual({
      summary: { key: 'sweat.why.test', params: { rateLph: 1.36, lo: 1.21, hi: 1.51, uncertaintyLph: 0.15 } },
      details: [
        { key: 'sweat.why.testCorrection', params: { correctionL: 0.18, energyKcal: 913 } },
        { key: 'sweat.why.testCalibrated', params: { testRateLph: 0.82, testModelLph: 0.95, estimateLph: 1.59, ratio: 1.67, factor: 1.67 } },
        { key: 'sweat.why.sodium', params: { sodiumMmolL: 40 } },
      ],
      citations: ['baker2017', 'sawka2007', 'cheuvront2017'],
    });
  });

  it('returns the measured rate when the test conditions equal the event (golden)', () => {
    // [baker2017] a test in the event's own conditions needs no scaling, however far it is from the model.
    // Default ride (cycling 30 km/h, 20 °C shade): the model says 0.15 L/h, the athlete measured 1.36 L/h.
    const ride = {
      event: { sport: 'cycling', speedKmh: 30, powerW: 0, mets: 8, setting: 'outdoor' },
      athlete: ATHLETE,
      environment: { tempC: 20, humidity: 50, sun: 'none' },
    };
    const conditions = { ...ride.event, ...ride.environment };
    const test = { id: 't1', date: '', label: '', preKg: 70.5, postKg: 69.5, fluidL: 0.5, urineL: 0, durationMin: 60, conditions };
    const r = resolveSweat(sweat({ tests: [test] }), ride);
    expect(r.estimate.rateLph).toBeCloseTo(0.1504, 4);
    expect(r.test.rateLph).toBeCloseTo(1.364, 3);
    expect(r.calibration).toMatchObject({ factor: 1, ratio: 1, applied: true, clamped: false, capped: false });
    expect(r.calibration.testRatio).toBeCloseTo(r.test.rateLph / r.estimate.rateLph, 12);
    expect(r.rateLph).toBe(r.test.rateLph);
    expect(r.uncertaintyLph).toBe(0.15);
    expect(r.warnings).toEqual([]);
    // A 90 min test with 1.5 kg lost keeps its own rate too.
    const long = { ...test, postKg: 69, durationMin: 90 };
    const l = resolveSweat(sweat({ tests: [long] }), ride);
    expect(l.rateLph).toBe(l.test.rateLph);
    expect(l.rateLph).toBeGreaterThan(1.1);
  });

  it('keeps the measured rate for identical conditions whatever the test measured (property)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.3, max: 3, noNaN: true }),
        fc.double({ min: 10, max: 35, noNaN: true }),
        fc.constantFrom('running', 'cycling', 'other'),
        (lossKg, tempC, sport) => {
          const ctx = {
            event: { sport, speedKmh: sport === 'running' ? 11 : 30, powerW: 0, mets: 8, setting: 'outdoor' },
            athlete: ATHLETE,
            environment: { tempC, humidity: 50, sun: 'none' },
          };
          const test = { ...TEST, postKg: 70 - lossKg, fluidL: 0, urineL: 0, conditions: { ...ctx.event, ...ctx.environment } };
          const r = resolveSweat(sweat({ tests: [test] }), ctx);
          if (!r.test.valid) return;
          if (r.calibration.testModelLph > 0) expect(r.calibration.factor).toBe(1);
          expect(r.rateLph).toBe(r.test.rateLph);
        },
      ),
    );
  });

  it('calibrates by default when calibrate is missing', () => {
    expect(resolveSweat(sweat({ calibrate: undefined }), CONTEXT).rateLph).toBe(resolveSweat(sweat(), CONTEXT).rateLph);
  });

  it('uses the test rate as it is without calibrate', () => {
    const r = resolveSweat(sweat({ calibrate: false }), CONTEXT);
    expect(r.rateLph).toBe(r.test.rateLph);
    expect(r.rateLph).toBeCloseTo(0.8175, 4);
    expect(r.calibration).toMatchObject({ applied: false, clamped: false, capped: false });
    expect(r.calibration.factor).toBeCloseTo(1.67, 2);
    expect(r.why.details).toContainEqual({ key: 'sweat.why.testDirect', params: { testRateLph: 0.82 } });
    expect(r.why.details.map((d) => d.key)).not.toContain('sweat.why.testCalibrated');
  });

  it('never limits how far the athlete may differ from the model', () => {
    // lost 2.8 kg in 1 h: 2.82 L/h is 2.96 × the model (0.95 L/h), in the event's own conditions
    const heavy = { ...TEST, postKg: 67.2 };
    const r = resolveSweat(sweat({ tests: [heavy] }), COOL);
    expect(r.calibration).toMatchObject({ factor: 1, ratio: 1, applied: true, clamped: false, capped: false });
    expect(r.calibration.testRatio).toBeCloseTo(2.8175 / 0.9506, 3);
    expect(r.rateLph).toBe(r.test.rateLph);
    expect(r.warnings).toEqual([]);
    // a very light test keeps its own low rate, scaled by the conditions only
    const light = { ...TEST, postKg: 69.9, fluidL: 0.1, urineL: 0 };
    const l = resolveSweat(sweat({ tests: [light] }), CONTEXT);
    expect(l.test.rateLph).toBeCloseTo(0.0175, 4);
    expect(l.calibration).toMatchObject({ clamped: false, capped: false });
    expect(l.rateLph).toBeCloseTo(l.test.rateLph * (1.5858 / 0.9506), 3);
    expect(l.uncertaintyLph).toBe(0.15);
  });

  it('limits the change of conditions to 0.5–2 with a warning and a wider uncertainty', () => {
    // test at 20 °C shade (model 0.95 L/h), race at 35 °C full sun (model 2.65 L/h): 2.79 × → factor 2
    const r = resolveSweat(sweat(), HOT);
    expect(r.calibration).toMatchObject({ factor: 2, applied: true, clamped: true, capped: false });
    expect(r.calibration.ratio).toBeCloseTo(2.653 / 0.9506, 2);
    expect(r.rateLph).toBeCloseTo(2 * r.test.rateLph, 12);
    expect(r.rateLph).toBeCloseTo(1.63, 2);
    // beyond the limit the model cannot carry the test to the event: the model's ±0.5 L/h
    expect(r.uncertaintyLph).toBe(0.5);
    expect(r.why.details).toEqual([
      { key: 'sweat.why.testCorrection', params: { correctionL: 0.18, energyKcal: 913 } },
      { key: 'sweat.why.testCalibrated', params: { testRateLph: 0.82, testModelLph: 0.95, estimateLph: 2.65, ratio: 2.79, factor: 2 } },
      { key: 'sweat.why.calibrationClamped', params: { ratio: 2.79, factor: 2, min: 0.5, max: 2 } },
      { key: 'sweat.why.sodium', params: { sodiumMmolL: 40 } },
    ]);
    expect(r.warnings).toEqual([
      {
        id: 'sweat.calibrationLimited',
        level: 'warning',
        message: { key: 'sweat.warn.calibrationLimited', params: { min: 0.5, max: 2, uncertaintyLph: 0.5 } },
        citations: ['baker2017'],
      },
    ]);
    // a test in the heat for a cool race: 0.2 × → factor 0.5
    const hotTest = { ...TEST, conditions: { ...TEST_CONDITIONS, tempC: 35, sun: 'full' } };
    const cold = resolveSweat(sweat({ tests: [hotTest] }), { ...COOL, environment: { tempC: 10, humidity: 50, sun: 'none' } });
    expect(cold.calibration).toMatchObject({ factor: 0.5, clamped: true, capped: false });
    expect(cold.rateLph).toBeCloseTo(0.5 * cold.test.rateLph, 12);
    // without calibrate nothing is scaled, so nothing is limited
    expect(resolveSweat(sweat({ calibrate: false }), HOT).warnings).toEqual([]);
    expect(resolveSweat(sweat({ calibrate: false }), HOT).uncertaintyLph).toBe(0.15);
  });

  it('keeps a calibrated rate within the model ceiling unless the test measured more', () => {
    // 15 °C test: lost 1.7 kg, drank 0.6 L in 1 h → 2.12 L/h; the model gives 0.73 for the test and
    // 2.65 for the hot race (3.6 ×) → factor 2: 2 × 2.12 = 4.23 L/h would be above the ceiling of
    // 2.77 L/h (min(3, 1.5 × BSA)).
    const cool = { ...TEST, postKg: 68.3, fluidL: 0.6, urineL: 0, conditions: { ...TEST_CONDITIONS, tempC: 15 } };
    const r = resolveSweat(sweat({ tests: [cool] }), HOT);
    expect(r.test.rateLph).toBeCloseTo(2.1175, 4);
    expect(r.estimate.rateLph).toBeCloseTo(2.653, 3);
    expect(r.estimate.maxRateLph).toBeCloseTo(2.772, 3);
    expect(r.calibration).toMatchObject({ factor: 2, clamped: true, capped: true, limitLph: r.estimate.maxRateLph });
    expect(r.rateLph).toBe(r.estimate.maxRateLph);
    expect(r.uncertaintyLph).toBe(0.5);
    expect(r.why.details).toContainEqual({ key: 'sweat.why.calibrationCapped', params: { scaledLph: 4.23, maxLph: 2.77 } });
    // a heavy sweater who measured more than the ceiling keeps the measured rate
    const heavy = { ...TEST, postKg: 67.1, fluidL: 0.2, urineL: 0, conditions: { ...TEST_CONDITIONS, tempC: 25 } };
    const h = resolveSweat(sweat({ tests: [heavy] }), HOT);
    expect(h.test.rateLph).toBeCloseTo(2.9175, 4);
    expect(h.calibration).toMatchObject({ capped: true, limitLph: h.test.rateLph });
    expect(h.rateLph).toBe(h.test.rateLph);
    expect(h.why.details).toContainEqual({ key: 'sweat.why.calibrationCapped', params: { scaledLph: 5.83, maxLph: 2.92 } });
    // without calibrate the measured rate is used and nothing is capped
    const d = resolveSweat(sweat({ tests: [cool], calibrate: false }), HOT);
    expect(d.rateLph).toBe(d.test.rateLph);
    expect(d.calibration.capped).toBe(false);
  });

  it('takes test conditions the test does not set from the event', () => {
    // no conditions: the test model is the event model, so calibrating changes nothing
    const plain = { ...TEST, conditions: undefined };
    const r = resolveSweat(sweat({ tests: [plain] }), CONTEXT);
    expect(r.calibration.testModelLph).toBe(r.estimate.rateLph);
    expect(r.calibration).toMatchObject({ clamped: false, capped: false });
    expect(r.rateLph).toBeCloseTo(r.test.rateLph, 12);
    expect(r.test).toEqual({ id: 't1', ...sweatTestRate(plain, ATHLETE, { ...CONTEXT.event, ...CONTEXT.environment }) });
    // only the weather given: sport, speed, setting and sun come from the event
    const partial = { ...TEST, conditions: { tempC: 20, humidity: 50 } };
    expect(resolveSweat(sweat({ tests: [partial] }), CONTEXT)).toEqual(resolveSweat(sweat(), CONTEXT));
  });

  it('uses the test as it is when the model predicts no sweat for the test conditions', () => {
    const cold = { ...TEST, postKg: 69.6, fluidL: 0, urineL: 0, conditions: { sport: 'other', mets: 1, tempC: -20, humidity: 50 } };
    const r = resolveSweat(sweat({ tests: [cold] }), CONTEXT);
    expect(r.calibration).toEqual({
      factor: 1,
      ratio: 1,
      testRatio: 1,
      applied: false,
      clamped: false,
      capped: false,
      limitLph: Math.max(r.estimate.maxRateLph, r.test.rateLph),
      testModelLph: 0,
    });
    expect(r.rateLph).toBe(r.test.rateLph);
    expect(r.why.details).toContainEqual({ key: 'sweat.why.calibrationUnavailable', params: { testRateLph: 0.39 } });
  });

  it('picks the selected test by id, else the last one', () => {
    const second = { ...TEST, id: 't2', postKg: 68.8 };
    const tests = [TEST, second];
    expect(resolveSweat(sweat({ tests, selectedTestId: 't1' }), CONTEXT).test.id).toBe('t1');
    expect(resolveSweat(sweat({ tests, selectedTestId: null }), CONTEXT).test.id).toBe('t2');
    expect(resolveSweat(sweat({ tests, selectedTestId: 'gone' }), CONTEXT).test.id).toBe('t2');
    expect(resolveSweat(sweat({ tests, selectedTestId: undefined }), CONTEXT).test.id).toBe('t2');
  });

  it('returns a result for every test in the list', () => {
    const broken = { ...TEST, id: 't2', durationMin: 0 };
    const r = resolveSweat(sweat({ tests: [TEST, broken], selectedTestId: 't1' }), CONTEXT);
    expect(r.tests).toEqual([
      { id: 't1', ...sweatTestRate(TEST, ATHLETE) },
      { id: 't2', ...sweatTestRate(broken, ATHLETE) },
    ]);
    // also when the source is not 'test'
    expect(resolveSweat({ source: 'preset', tests: [TEST] }, CONTEXT).tests).toHaveLength(1);
    expect(resolveSweat({ source: 'preset', tests: [TEST] }, CONTEXT).test).toBeNull();
    // one result per entry, so indices match the input list; a missing id is null
    const mixed = resolveSweat(sweat({ tests: [null, { ...TEST, id: undefined }, 3] }), CONTEXT);
    expect(mixed.tests.map((t) => [t.id, t.valid])).toEqual([
      [null, false],
      [null, true],
      [null, false],
    ]);
    expect(mixed.tests[0].problems.map((p) => p.key)).toEqual(['sweat.test.problem.duration', 'sweat.test.problem.mass']);
    // an entry that is not an object is never selected: the last object is
    expect(mixed.source).toBe('test');
    expect(mixed.test).toBe(mixed.tests[1]);
    expect(resolveSweat(sweat({ tests: [null, 3] }), CONTEXT).warnings[0].message.key).toBe('sweat.warn.noTest');
  });

  it('falls back to the estimate when there is no test', () => {
    for (const tests of [[], undefined, 'x']) {
      const r = resolveSweat(sweat({ tests }), CONTEXT);
      expect(r.source).toBe('estimate');
      expect(r.rateLph).toBe(r.estimate.rateLph);
      expect(r.uncertaintyLph).toBe(0.5);
      expect(r.test).toBeNull();
      expect(r.calibration).toBeNull();
      expect(r.warnings).toEqual([
        { id: 'sweat.testUnusable', level: 'warning', message: { key: 'sweat.warn.noTest' }, citations: ['baker2017'] },
      ]);
      expect(r.why.summary.key).toBe('sweat.why.estimate');
      expect(r.why.citations).toEqual(['gagnon2013', 'cramer2019', 'jay2024']);
    }
  });

  it('falls back to the estimate when the selected test is invalid', () => {
    const broken = { ...TEST, id: 't2', postKg: 72 };
    const r = resolveSweat(sweat({ tests: [TEST, broken], selectedTestId: 't2' }), CONTEXT);
    expect(r.source).toBe('estimate');
    expect(r.rateLph).toBe(r.estimate.rateLph);
    expect(r.test).toMatchObject({ id: 't2', valid: false });
    expect(r.test.problems[0].key).toBe('sweat.test.problem.noLoss');
    expect(r.calibration).toBeNull();
    expect(r.warnings.map((w) => [w.id, w.level, w.message.key])).toEqual([
      ['sweat.testUnusable', 'warning', 'sweat.warn.testUnusable'],
    ]);
  });

  it('takes the sodium from the saltiness preset', () => {
    expect(resolveSweat(sweat({ saltinessIndex: 5 }), CONTEXT).sodiumMmolL).toBe(90);
  });
});

describe('resolveSweat: general', () => {
  it('does not mutate its arguments and is deterministic', () => {
    const input = deepFreeze({
      source: 'test',
      saltinessIndex: 5,
      tests: [{ ...TEST, conditions: { ...TEST_CONDITIONS } }, { ...TEST, id: 't2', conditions: undefined }],
      calibrate: true,
    });
    const context = deepFreeze(structuredClone(HOT));
    const a = resolveSweat(input, context);
    const b = resolveSweat(input, context);
    expect(a).toEqual(b);
    expect(a.calibration.capped).toBe(false);
    a.why.citations.push('x');
    expect(resolveSweat(input, context).why.citations).toEqual(['baker2017', 'sawka2007', 'cheuvront2017']);
    const t = deepFreeze({ ...TEST, conditions: undefined });
    expect(sweatTestRate(t, deepFreeze({ ...ATHLETE }), deepFreeze({ ...TEST_CONDITIONS }))).toEqual(sweatTestRate(TEST, ATHLETE));
  });

  it('only cites ids from the evidence registry', () => {
    const humid = { ...CONTEXT, environment: { tempC: 36, humidity: 60 } };
    const results = [
      resolveSweat({ source: 'test', tests: [TEST] }, humid),
      resolveSweat({ source: 'test', tests: [] }, humid),
      resolveSweat({ source: 'estimate' }, humid),
      resolveSweat({ source: 'preset' }, humid),
    ];
    for (const r of results) {
      for (const id of r.why.citations) expect(CITATIONS[id], id).toBeDefined();
      for (const w of r.warnings) for (const id of w.citations) expect(CITATIONS[id], id).toBeDefined();
    }
  });

  it('returns valid output for any inputs (property)', () => {
    const testArb = fc.record({
      id: fc.constantFrom('a', 'b', 'c'),
      preKg: fc.double({ min: -10, max: 150 }),
      postKg: fc.double({ min: -10, max: 150 }),
      fluidL: fc.double({ min: -1, max: 5 }),
      urineL: fc.double({ min: -1, max: 2 }),
      durationMin: fc.double({ min: -10, max: 600 }),
      conditions: fc.record(
        {
          sport: fc.constantFrom('running', 'cycling', 'other', 'x'),
          speedKmh: fc.double(),
          tempC: fc.double({ min: -30, max: 60 }),
          humidity: fc.double({ min: 0, max: 100 }),
        },
        { requiredKeys: [] },
      ),
    });
    fc.assert(
      fc.property(
        fc.constantFrom('test', 'estimate', 'preset', 'other', undefined),
        fc.oneof(fc.integer({ min: -10, max: 10 }), fc.double(), fc.constant(undefined)),
        fc.array(testArb, { maxLength: 4 }),
        fc.constantFrom('a', 'b', null, undefined),
        fc.boolean(),
        fc.double({ min: -30, max: 60 }),
        fc.double({ min: 0, max: 100 }),
        (source, saltinessIndex, tests, selectedTestId, calibrate, tempC, humidity) => {
          const r = resolveSweat(
            { source, rateIndex: 2, saltinessIndex, tests, selectedTestId, calibrate },
            { event: { sport: 'running', speedKmh: 12 }, athlete: { massKg: 70, heightCm: 175 }, environment: { tempC, humidity } },
          );
          expect(Number.isFinite(r.rateLph)).toBe(true);
          expect(r.rateLph).toBeGreaterThanOrEqual(0);
          expect(r.rateLph).toBeLessThanOrEqual(5);
          expect(SWEAT_SODIUM_PRESETS_MMOL).toContain(r.sodiumMmolL);
          expect(['test', 'estimate', 'preset']).toContain(r.source);
          expect(r.uncertaintyLph).toBe(r.source === 'test' ? 0.15 : 0.5);
          expect(r.tests).toHaveLength(tests.length);
          if (r.source === 'test') {
            expect(r.test.valid).toBe(true);
            expect(r.calibration.factor).toBeGreaterThanOrEqual(0.5);
            expect(r.calibration.factor).toBeLessThanOrEqual(2);
            // a calibrated rate never exceeds the model ceiling or the measured rate, whichever is higher
            expect(r.calibration.limitLph).toBe(Math.max(r.estimate.maxRateLph, r.test.rateLph));
            if (r.calibration.applied) expect(r.rateLph).toBeLessThanOrEqual(r.calibration.limitLph);
            else expect(r.rateLph).toBe(r.test.rateLph);
          } else {
            expect(r.calibration).toBeNull();
          }
          if (source === 'test' && r.source !== 'test') {
            expect(r.warnings.map((w) => w.id)).toContain('sweat.testUnusable');
          }
          for (const t of r.tests) {
            expect(t.valid).toBe(t.problems.length === 0);
            if (t.valid) {
              expect(t.rateLph).toBeGreaterThan(0);
              expect(t.rateLph).toBeLessThanOrEqual(5);
            }
          }
        },
      ),
    );
  });
});

describe('resolveSweat: low estimate', () => {
  const ride = (tempC) => ({
    event: { sport: 'cycling', speedKmh: 30, powerW: 0, mets: 8, setting: 'outdoor' },
    athlete: ATHLETE,
    environment: { tempC, humidity: 50, sun: 'none' },
  });

  it('notes when the model predicts very little sweat (a cool ride in race kit)', () => {
    // [gagnon2013] [jay2024] 30 km/h in race kit at 15 °C: the air carries all the heat away (Ereq ≤ 0)
    const r = resolveSweat({ source: 'estimate' }, ride(15));
    expect(r.rateLph).toBe(0);
    expect(r.warnings).toEqual([
      {
        id: 'sweat.estimateLow',
        level: 'info',
        message: { key: 'sweat.warn.estimateLow', params: { rateLph: 0, hi: 0.5 } },
        citations: ['jay2024', 'kenefick2018'],
      },
    ]);
    // 17.7 °C: 0.04 L/h, still low
    expect(resolveSweat({ source: 'estimate' }, ride(17.7)).warnings.map((w) => w.id)).toEqual(['sweat.estimateLow']);
  });

  it('has no low-estimate note at 20 °C (0.15 L/h) or for a preset', () => {
    expect(resolveSweat({ source: 'estimate' }, ride(20)).warnings).toEqual([]);
    expect(resolveSweat({ source: 'preset' }, ride(15)).warnings).toEqual([]);
  });
});

describe('i18n catalog (src/i18n/en/sweat.js)', () => {
  const humid = { ...CONTEXT, environment: { tempC: 36, humidity: 60 } };
  const hot = { ...CONTEXT, environment: { tempC: 40, humidity: 90, sun: 'full' } };
  const cold = { ...TEST, postKg: 69.6, fluidL: 0, urineL: 0, conditions: { sport: 'other', mets: 1, tempC: -20, humidity: 50 } };
  const samples = [
    resolveSweat(),
    resolveSweat({ source: 'preset', rateIndex: 0, saltinessIndex: 5 }, humid),
    resolveSweat({ source: 'estimate' }, hot),
    resolveSweat({ source: 'test', tests: [TEST] }, CONTEXT),
    resolveSweat({ source: 'test', tests: [TEST], calibrate: false }, CONTEXT),
    resolveSweat({ source: 'test', tests: [{ ...TEST, postKg: 67.2 }] }, CONTEXT),
    resolveSweat({ source: 'test', tests: [{ ...TEST, postKg: 67.2 }] }, COOL),
    resolveSweat({ source: 'test', tests: [cold] }, CONTEXT),
    resolveSweat({ source: 'test', tests: [TEST] }, HOT),
    resolveSweat(
      { source: 'estimate' },
      { ...CONTEXT, event: { ...CONTEXT.event, sport: 'cycling', speedKmh: 30 }, environment: { tempC: 5, humidity: 50 } },
    ),
    resolveSweat({ source: 'test', tests: [] }, CONTEXT),
    resolveSweat(
      {
        source: 'test',
        tests: [
          { ...TEST, durationMin: 0, preKg: 0 },
          { ...TEST, postKg: 71 },
          { ...TEST, postKg: 60 },
        ],
      },
      CONTEXT,
    ),
  ];
  const messages = samples.flatMap(messagesOf);

  it('reaches every message key the module can return', () => {
    const keys = new Set(messages.map((m) => m.key));
    for (const key of [
      'sweat.why.test',
      'sweat.why.estimate',
      'sweat.why.preset',
      'sweat.why.testCorrection',
      'sweat.why.testCalibrated',
      'sweat.why.calibrationClamped',
      'sweat.why.calibrationCapped',
      'sweat.why.calibrationUnavailable',
      'sweat.why.testDirect',
      'sweat.why.estimateDrivers',
      'sweat.why.estimateCapped',
      'sweat.why.sodium',
      'sweat.why.measure',
      'sweat.warn.noTest',
      'sweat.warn.testUnusable',
      'sweat.warn.calibrationLimited',
      'sweat.warn.estimateLow',
      'sweat.warn.uncompensable',
      'sweat.test.problem.duration',
      'sweat.test.problem.mass',
      'sweat.test.problem.noLoss',
      'sweat.test.problem.tooHigh',
    ]) {
      expect(keys.has(key), key).toBe(true);
    }
  });

  it('has text for every message key the module returns', () => {
    for (const message of messages) {
      expect(sweatCatalog, message.key).toHaveProperty([message.key]);
      expect(typeof sweatCatalog[message.key]).toBe('string');
    }
  });

  it('only uses placeholders the module provides as params', () => {
    for (const message of messages) {
      for (const name of placeholders(sweatCatalog[message.key])) {
        expect(message.params ?? {}, `${message.key} {${name}}`).toHaveProperty([name]);
      }
    }
  });

  it('keeps every key in the sweat namespace and has the UI help texts', () => {
    for (const key of Object.keys(sweatCatalog)) expect(key.startsWith('sweat.')).toBe(true);
    expect(placeholders(sweatCatalog['sweat.test.protocol'])).toEqual([]);
    expect(placeholders(sweatCatalog['sweat.test.calibrateHelp'])).toEqual([]);
  });

  it('explains how to do a sweat test', () => {
    // [baker2017] sweat loss = body mass lost + fluid drunk − urine
    expect(sweatCatalog['sweat.why.measure']).toMatch(/weigh yourself before and after/i);
    expect(sweatCatalog['sweat.why.measure']).toMatch(/what you drank/);
    expect(sweatCatalog['sweat.test.protocol']).toMatch(/urine/);
  });

  it('does not use em-dash asides', () => {
    for (const text of Object.values(sweatCatalog)) expect(text).not.toMatch(/—/);
  });

  it('says the plan scales the measured rate by the factor', () => {
    expect(sweatCatalog['sweat.why.testCalibrated']).toMatch(/scales your measured rate by \{factor\}/);
    expect(sweatCatalog['sweat.why.calibrationClamped']).toMatch(/\{ratio\} times/);
  });
});
