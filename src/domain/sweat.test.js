import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  SWEAT_RATE_PRESETS_LPH,
  SWEAT_SODIUM_PRESETS_MMOL,
  estimateSweatRateLegacy,
  resolveSweat,
} from './sweat';
import { SWEAT_RATES, ELECTROLYTE_CONCENTRATIONS } from '../constants/constants';
import { CITATIONS } from './evidence';
import sweatCatalog from '../i18n/en/sweat';

const SEXES = ['unspecified', 'female', 'male'];
const INTENSITIES = ['easy', 'moderate', 'hard', 'race'];

/** The formula exactly as it was written in the former useStrategyCalculation hook. */
function originalHookFormula({ gender, intensity, tempInC, humidity }) {
  let intensityModifier = 1.0;
  if (intensity === 'recovery') intensityModifier = 0.8;
  else if (intensity === 'tempo') intensityModifier = 1.2;
  else if (intensity === 'threshold') intensityModifier = 1.5;
  else if (intensity === 'maximum') intensityModifier = 1.8;
  const baseSweat = gender === 'female' ? 0.5 : 0.8;
  const heatLoad = (tempInC - 15) * 0.03;
  const humidityLoad = (humidity - 50) * 0.005;
  let sweatRate = baseSweat * intensityModifier + heatLoad + humidityLoad;
  return Math.max(0.3, Math.min(sweatRate, 3.5));
}
const LEGACY_INTENSITY = { easy: 'recovery', moderate: 'tempo', hard: 'threshold', race: 'maximum' };

/** Collects every message descriptor in a resolveSweat result. */
function messagesOf(result) {
  return [result.why.summary, ...(result.why.details ?? [])];
}

function placeholders(text) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
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
});

describe('estimateSweatRateLegacy', () => {
  it('reproduces the legacy formula at the reference conditions', () => {
    // 15 °C and 50 % add nothing: base × intensity factor only
    expect(estimateSweatRateLegacy({ sex: 'male', intensity: 'moderate', tempC: 15, humidity: 50 })).toBeCloseTo(0.96, 10);
    expect(estimateSweatRateLegacy({ sex: 'female', intensity: 'easy', tempC: 15, humidity: 50 })).toBeCloseTo(0.4, 10);
    expect(estimateSweatRateLegacy({ sex: 'unspecified', intensity: 'hard', tempC: 15, humidity: 50 })).toBeCloseTo(0.975, 10);
    expect(estimateSweatRateLegacy({ sex: 'male', intensity: 'race', tempC: 15, humidity: 50 })).toBeCloseTo(1.44, 10);
  });

  it('adds 0.03 L/h per °C above 15 °C and 0.005 L/h per % humidity above 50 %', () => {
    // 0.96 + (20 − 15) × 0.03 = 1.11
    expect(estimateSweatRateLegacy({ sex: 'male', intensity: 'moderate', tempC: 20, humidity: 50 })).toBeCloseTo(1.11, 10);
    // 0.65 × 1.8 + 15 × 0.03 + 30 × 0.005 = 1.17 + 0.45 + 0.15 = 1.77
    expect(estimateSweatRateLegacy({ sex: 'unspecified', intensity: 'race', tempC: 30, humidity: 80 })).toBeCloseTo(1.77, 10);
    // cold and dry lowers the estimate: 0.5 × 1.2 − 0.15 − 0.1 = 0.35
    expect(estimateSweatRateLegacy({ sex: 'female', intensity: 'moderate', tempC: 10, humidity: 30 })).toBeCloseTo(0.35, 10);
  });

  it('uses 0.65 L/h as the base for unspecified sex, between female and male', () => {
    const at = (sex) => estimateSweatRateLegacy({ sex, intensity: 'moderate', tempC: 15, humidity: 50 });
    expect(at('unspecified')).toBeCloseTo(0.78, 10);
    expect(at('female')).toBeLessThan(at('unspecified'));
    expect(at('unspecified')).toBeLessThan(at('male'));
  });

  it('clamps to 0.3–3.5 L/h', () => {
    // 0.4 − 0.45 − 0.25 = −0.3 → 0.3
    expect(estimateSweatRateLegacy({ sex: 'female', intensity: 'easy', tempC: 0, humidity: 0 })).toBe(0.3);
    // 1.44 + 1.95 + 0.25 = 3.64 → 3.5
    expect(estimateSweatRateLegacy({ sex: 'male', intensity: 'race', tempC: 80, humidity: 100 })).toBe(3.5);
    expect(estimateSweatRateLegacy({ sex: 'male', intensity: 'race', tempC: 1e9, humidity: 1e9 })).toBe(3.5);
    expect(estimateSweatRateLegacy({ sex: 'male', intensity: 'race', tempC: -1e9, humidity: -1e9 })).toBe(0.3);
  });

  it('treats unknown sex as unspecified and unknown intensity as moderate', () => {
    const ctx = { tempC: 22, humidity: 60 };
    expect(estimateSweatRateLegacy({ ...ctx, sex: 'other', intensity: 'hard' })).toBe(
      estimateSweatRateLegacy({ ...ctx, sex: 'unspecified', intensity: 'hard' }),
    );
    expect(estimateSweatRateLegacy({ ...ctx, sex: 'male', intensity: 'tempo' })).toBe(
      estimateSweatRateLegacy({ ...ctx, sex: 'male', intensity: 'moderate' }),
    );
    expect(estimateSweatRateLegacy({ ...ctx, sex: '__proto__', intensity: 'toString' })).toBe(
      estimateSweatRateLegacy({ ...ctx, sex: 'unspecified', intensity: 'moderate' }),
    );
  });

  it('adds no adjustment for a non-finite temperature or humidity', () => {
    const ref = estimateSweatRateLegacy({ sex: 'male', intensity: 'hard', tempC: 15, humidity: 50 });
    expect(estimateSweatRateLegacy({ sex: 'male', intensity: 'hard', tempC: NaN, humidity: Infinity })).toBe(ref);
    expect(estimateSweatRateLegacy({ sex: 'male', intensity: 'hard' })).toBe(ref);
    expect(estimateSweatRateLegacy({ sex: 'male', intensity: 'hard', tempC: '30', humidity: null })).toBe(ref);
  });

  it('works with no arguments or null', () => {
    expect(estimateSweatRateLegacy()).toBeCloseTo(0.78, 10);
    expect(estimateSweatRateLegacy({})).toBeCloseTo(0.78, 10);
    expect(estimateSweatRateLegacy(null)).toBe(estimateSweatRateLegacy());
  });

  it('matches the original hook formula for male and female athletes (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('male', 'female'),
        fc.constantFrom(...INTENSITIES),
        fc.double({ min: -40, max: 60, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        (sex, intensity, tempC, humidity) => {
          const ported = estimateSweatRateLegacy({ sex, intensity, tempC, humidity });
          const original = originalHookFormula({
            gender: sex,
            intensity: LEGACY_INTENSITY[intensity],
            tempInC: tempC,
            humidity,
          });
          expect(ported).toBeCloseTo(original, 12);
        },
      ),
    );
  });

  it('always returns a finite rate inside 0.3–3.5 L/h that rises with heat and humidity (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SEXES),
        fc.constantFrom(...INTENSITIES),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: 0, max: 50, noNaN: true }),
        (sex, intensity, tempC, humidity, delta) => {
          const rate = estimateSweatRateLegacy({ sex, intensity, tempC, humidity });
          expect(Number.isFinite(rate)).toBe(true);
          expect(rate).toBeGreaterThanOrEqual(0.3);
          expect(rate).toBeLessThanOrEqual(3.5);
          expect(estimateSweatRateLegacy({ sex, intensity, tempC: tempC + delta, humidity })).toBeGreaterThanOrEqual(rate);
          expect(estimateSweatRateLegacy({ sex, intensity, tempC, humidity: humidity + delta })).toBeGreaterThanOrEqual(rate);
        },
      ),
    );
  });
});

describe('resolveSweat', () => {
  const context = { sex: 'male', intensity: 'moderate', tempC: 20, humidity: 50 };

  it('uses the picked preset rate and saltiness', () => {
    // [baker2017] [barnes2019] self-assessed presets with ±0.5 L/h uncertainty
    const r = resolveSweat({ source: 'preset', rateIndex: 2, saltinessIndex: 2 }, context);
    expect(r.rateLph).toBe(1.25);
    expect(r.sodiumMmolL).toBe(40);
    expect(r.source).toBe('preset');
    expect(r.uncertaintyLph).toBe(0.5);
    expect(r.why.citations).toEqual(['baker2017', 'barnes2019']);
  });

  it('uses the legacy estimate for source "estimate"', () => {
    // [baker2017] [barnes2019] interim estimate with ±0.4 L/h uncertainty
    const r = resolveSweat({ source: 'estimate', rateIndex: 0, saltinessIndex: 4 }, context);
    expect(r.rateLph).toBe(estimateSweatRateLegacy(context));
    expect(r.rateLph).toBeCloseTo(1.11, 10);
    expect(r.source).toBe('estimate');
    expect(r.uncertaintyLph).toBe(0.4);
    // sodium still comes from the saltiness preset
    expect(r.sodiumMmolL).toBe(70);
    expect(r.why.citations).toEqual(['baker2017', 'barnes2019']);
  });

  it('maps every preset index to its rate and sodium value', () => {
    for (let i = 0; i < 6; i += 1) {
      const r = resolveSweat({ source: 'preset', rateIndex: i, saltinessIndex: i });
      expect(r.rateLph).toBe(SWEAT_RATES[i]);
      expect(r.sodiumMmolL).toBe(ELECTROLYTE_CONCENTRATIONS.Sodium[i]);
    }
  });

  it('clamps and rounds indices to 0–5', () => {
    expect(resolveSweat({ source: 'preset', rateIndex: -3, saltinessIndex: -1 })).toMatchObject({ rateLph: 0.25, sodiumMmolL: 15 });
    expect(resolveSweat({ source: 'preset', rateIndex: 9, saltinessIndex: 100 })).toMatchObject({ rateLph: 2.75, sodiumMmolL: 90 });
    expect(resolveSweat({ source: 'preset', rateIndex: 2.6, saltinessIndex: 0.4 })).toMatchObject({ rateLph: 1.75, sodiumMmolL: 15 });
    expect(resolveSweat({ source: 'preset', rateIndex: Infinity, saltinessIndex: -Infinity })).toMatchObject({ rateLph: 1.25, sodiumMmolL: 40 });
  });

  it('falls back to the middle preset for missing or non-numeric indices', () => {
    expect(resolveSweat({ source: 'preset', rateIndex: NaN, saltinessIndex: undefined })).toMatchObject({ rateLph: 1.25, sodiumMmolL: 40 });
    expect(resolveSweat({ source: 'preset', rateIndex: '4', saltinessIndex: null })).toMatchObject({ rateLph: 1.25, sodiumMmolL: 40 });
  });

  it('falls back to the preset source for an unknown or missing source', () => {
    const r = resolveSweat({ source: 'sweatTest', rateIndex: 1, saltinessIndex: 1 }, context);
    expect(r).toMatchObject({ source: 'preset', rateLph: 0.75, sodiumMmolL: 25, uncertaintyLph: 0.5 });
    expect(resolveSweat({ rateIndex: 3 }).source).toBe('preset');
  });

  it('works with no arguments', () => {
    expect(resolveSweat()).toMatchObject({ source: 'preset', rateLph: 1.25, sodiumMmolL: 40, uncertaintyLph: 0.5 });
    expect(resolveSweat({ source: 'estimate' })).toMatchObject({ source: 'estimate', sodiumMmolL: 40 });
    expect(resolveSweat({ source: 'estimate' }).rateLph).toBeCloseTo(0.78, 10);
    expect(resolveSweat({ source: 'estimate' }, null).rateLph).toBeCloseTo(0.78, 10);
    expect(resolveSweat(null)).toEqual(resolveSweat());
    expect(resolveSweat(null, null)).toEqual(resolveSweat());
  });

  it('explains the source with a summary and the sodium preset in details', () => {
    const preset = resolveSweat({ source: 'preset', rateIndex: 2, saltinessIndex: 3 });
    expect(preset.why.summary).toEqual({
      key: 'sweat.why.preset',
      params: { rateLph: 1.25, lo: 0.75, hi: 1.75, uncertaintyLph: 0.5 },
    });
    expect(preset.why.details).toEqual([
      { key: 'sweat.why.sodium', params: { sodiumMmolL: 55 } },
      { key: 'sweat.why.variability' },
    ]);

    const estimate = resolveSweat({ source: 'estimate', saltinessIndex: 2 }, context);
    expect(estimate.why.summary).toEqual({
      key: 'sweat.why.estimate',
      params: { rateLph: 1.11, lo: 0.71, hi: 1.51, uncertaintyLph: 0.4 },
    });
  });

  it('never reports a negative lower bound', () => {
    const r = resolveSweat({ source: 'preset', rateIndex: 0 });
    expect(r.why.summary.params.lo).toBe(0);
    expect(r.why.summary.params.hi).toBe(0.75);
  });

  it('does not mutate its arguments and is deterministic', () => {
    const sweat = Object.freeze({ source: 'estimate', rateIndex: 2, saltinessIndex: 5 });
    const ctx = Object.freeze({ sex: 'female', intensity: 'race', tempC: 28, humidity: 70 });
    const a = resolveSweat(sweat, ctx);
    const b = resolveSweat(sweat, ctx);
    expect(a).toEqual(b);
    a.why.citations.push('x');
    expect(resolveSweat(sweat, ctx).why.citations).toEqual(['baker2017', 'barnes2019']);
  });

  it('only cites ids from the evidence registry', () => {
    const r = resolveSweat({ source: 'estimate' }, context);
    for (const id of r.why.citations) expect(CITATIONS[id]).toBeDefined();
  });

  it('returns valid output for any inputs (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('preset', 'estimate', 'other', undefined),
        fc.oneof(fc.integer({ min: -10, max: 10 }), fc.double(), fc.constant(undefined)),
        fc.oneof(fc.integer({ min: -10, max: 10 }), fc.double(), fc.constant(undefined)),
        fc.constantFrom(...SEXES, 'x', undefined),
        fc.constantFrom(...INTENSITIES, 'x', undefined),
        fc.double(),
        fc.double(),
        (source, rateIndex, saltinessIndex, sex, intensity, tempC, humidity) => {
          const r = resolveSweat({ source, rateIndex, saltinessIndex }, { sex, intensity, tempC, humidity });
          expect(Number.isFinite(r.rateLph)).toBe(true);
          expect(r.rateLph).toBeGreaterThan(0);
          expect(SWEAT_SODIUM_PRESETS_MMOL).toContain(r.sodiumMmolL);
          expect(['preset', 'estimate']).toContain(r.source);
          if (r.source === 'preset') expect(SWEAT_RATE_PRESETS_LPH).toContain(r.rateLph);
          expect(r.uncertaintyLph).toBe(r.source === 'preset' ? 0.5 : 0.4);
        },
      ),
    );
  });
});

describe('i18n catalog (src/i18n/en/sweat.js)', () => {
  const samples = [
    resolveSweat(),
    resolveSweat({ source: 'preset', rateIndex: 0, saltinessIndex: 5 }),
    resolveSweat({ source: 'estimate', saltinessIndex: 0 }, { sex: 'female', intensity: 'race', tempC: 35, humidity: 90 }),
  ];

  it('has text for every message key the module returns', () => {
    for (const result of samples) {
      for (const message of messagesOf(result)) {
        expect(sweatCatalog, message.key).toHaveProperty([message.key]);
        expect(typeof sweatCatalog[message.key]).toBe('string');
      }
    }
  });

  it('only uses placeholders the module provides as params', () => {
    for (const result of samples) {
      for (const message of messagesOf(result)) {
        for (const name of placeholders(sweatCatalog[message.key])) {
          expect(message.params ?? {}, `${message.key} {${name}}`).toHaveProperty([name]);
        }
      }
    }
  });

  it('keeps every key in the sweat namespace', () => {
    for (const key of Object.keys(sweatCatalog)) expect(key.startsWith('sweat.')).toBe(true);
  });

  it('tells athletes to count fluid drunk during a sweat test', () => {
    // [baker2017] sweat loss = body mass lost + fluid drunk
    expect(sweatCatalog['sweat.why.variability']).toMatch(/weigh yourself before and after/);
    expect(sweatCatalog['sweat.why.variability']).toMatch(/what you drank/);
  });
});
