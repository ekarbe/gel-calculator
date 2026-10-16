import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  SODIUM_HARD_CAP_MG_PER_HOUR,
  SODIUM_HIGH_MG_PER_HOUR,
  SWEAT_EXTRAS_MMOL,
  MG_PER_MMOL,
  recommendSodium,
  sodiumWarnings,
  recommendExtras,
  deliveredIons,
  saltsForTargets,
  compareIons,
} from './electrolytes';
import { CITATIONS } from './evidence';
import electrolytesCatalog from '../i18n/en/electrolytes';

const SODIUM_CITATIONS = ['sawka2007', 'mccubbin2023', 'hoffman2015', 'delcoso2016', 'baker2017'];
const NO_IONS = { Sodium: 0, Chloride: 0, Potassium: 0, Magnesium: 0, Calcium: 0 };
const ALL_EXTRAS = { potassium: true, magnesium: true, calcium: true };

function placeholders(text) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}

/** Collects every message descriptor in a recommendation or a warning list. */
function messagesOf(result) {
  if (Array.isArray(result)) return result.map((w) => w.message);
  return [
    result.why.summary,
    ...(result.why.details ?? []),
    ...(result.warnings ?? []).map((w) => w.message),
  ];
}

describe('constants', () => {
  it('exposes the sodium limits, sweat concentrations and molar masses', () => {
    expect(SODIUM_HARD_CAP_MG_PER_HOUR).toBe(1500);
    expect(SODIUM_HIGH_MG_PER_HOUR).toBe(1000);
    // [baker2017] [montain2007] typical sweat K, Mg, Ca in mmol/L
    expect(SWEAT_EXTRAS_MMOL).toEqual({ Potassium: 4.5, Magnesium: 0.05, Calcium: 0.5 });
    expect(MG_PER_MMOL).toEqual({
      Sodium: 22.99,
      Chloride: 35.45,
      Potassium: 39.1,
      Magnesium: 24.31,
      Calcium: 40.08,
    });
  });
});

describe('recommendSodium', () => {
  it('replaces half of the sweat loss for 2–4 h events (golden: 180 min, 1.25 L/h, 40 mmol/L → 570)', () => {
    // [sawka2007] [mccubbin2023] partial replacement of sweat sodium
    const r = recommendSodium({ durationMin: 180, sweatRateLph: 1.25, sweatSodiumMmolL: 40 });
    expect(r.estimatedLossMgPerHour).toBeCloseTo(1149.5, 6);
    expect(r.replacementShare).toBe(0.5);
    // base 574.75 → round10 → 570
    expect(r.mgPerHour).toBe(570);
    expect(r.range).toEqual([300, 600]);
    expect(r.optional).toBe(false);
    expect(r.warnings).toEqual([]);
  });

  it('makes sodium optional and caps it at 300 mg/h under 2 h (golden: 60 min → 300)', () => {
    // [hoffman2015] [sawka2007] sodium is not needed for short events
    const r = recommendSodium({ durationMin: 60, sweatRateLph: 1.25, sweatSodiumMmolL: 40 });
    expect(r.mgPerHour).toBe(300);
    expect(r.range).toEqual([0, 300]);
    expect(r.optional).toBe(true);
    expect(r.why.summary.key).toBe('electrolytes.why.sodium.short');
  });

  it('keeps short-event sodium below half the loss when the loss is small', () => {
    // 0.25 L/h × 15 mmol/L × 22.99 = 86.2 → base 43.1 → 40
    const r = recommendSodium({ durationMin: 60, sweatRateLph: 0.25, sweatSodiumMmolL: 15 });
    expect(r.mgPerHour).toBe(40);
    expect(r.optional).toBe(true);
  });

  it('caps long events at 1000 mg/h (golden: 300 min, 2.0 L/h, 70 mmol/L → 1000)', () => {
    // [mccubbin2023] [delcoso2016] upper end of studied intakes
    const r = recommendSodium({ durationMin: 300, sweatRateLph: 2.0, sweatSodiumMmolL: 70 });
    expect(0.5 * r.estimatedLossMgPerHour).toBeCloseTo(1609.3, 6);
    expect(r.mgPerHour).toBe(1000);
    expect(r.range).toEqual([300, 1000]);
    expect(r.why.summary.key).toBe('electrolytes.why.sodium.long');
    expect(r.warnings).toEqual([]);
  });

  it('lifts low losses to the 300 mg/h floor from 2 h (golden: 180 min, 0.5 L/h, 25 mmol/L → 300)', () => {
    // [sawka2007] [mccubbin2023] floor for events of 2 h or more
    const r = recommendSodium({ durationMin: 180, sweatRateLph: 0.5, sweatSodiumMmolL: 25 });
    expect(0.5 * r.estimatedLossMgPerHour).toBeCloseTo(143.6875, 6);
    expect(r.mgPerHour).toBe(300);
    expect(r.range).toEqual([300, 600]);
    expect(
      recommendSodium({ durationMin: 300, sweatRateLph: 0.25, sweatSodiumMmolL: 15 }).mgPerHour,
    ).toBe(300);
  });

  it('uses the higher 2–4 h range for heavy or salty sweaters', () => {
    // [baker2017] [mccubbin2023] heavy, salty sweaters lose much more sodium
    // 1.25 L/h × 50 mmol/L: base 718.5, normal sweat → capped at 600
    expect(
      recommendSodium({ durationMin: 180, sweatRateLph: 1.25, sweatSodiumMmolL: 50 }),
    ).toMatchObject({ mgPerHour: 600, range: [300, 600] });
    // 1.5 L/h counts as heavy: base 689.7 → 690
    expect(
      recommendSodium({ durationMin: 180, sweatRateLph: 1.5, sweatSodiumMmolL: 40 }),
    ).toMatchObject({ mgPerHour: 690, range: [300, 1000] });
    // 55 mmol/L counts as salty: base 790.3 → 790
    expect(
      recommendSodium({ durationMin: 180, sweatRateLph: 1.25, sweatSodiumMmolL: 55 }),
    ).toMatchObject({ mgPerHour: 790, range: [300, 1000] });
    // 1.25 L/h × 70 mmol/L: base 1005.8 → 1000
    expect(
      recommendSodium({ durationMin: 180, sweatRateLph: 1.25, sweatSodiumMmolL: 70 }),
    ).toMatchObject({ mgPerHour: 1000, range: [300, 1000] });
  });

  it('switches bands at 120 and 240 min', () => {
    const at = (durationMin) =>
      recommendSodium({ durationMin, sweatRateLph: 1.25, sweatSodiumMmolL: 40 }).why.summary.key;
    expect(at(119)).toBe('electrolytes.why.sodium.short');
    expect(at(119.99)).toBe('electrolytes.why.sodium.short');
    expect(at(120)).toBe('electrolytes.why.sodium.medium');
    expect(at(240)).toBe('electrolytes.why.sodium.medium');
    expect(at(240.01)).toBe('electrolytes.why.sodium.long');
    expect(at(241)).toBe('electrolytes.why.sodium.long');
  });

  it('explains the target with partial replacement and the sodium citations', () => {
    // [sawka2007] [mccubbin2023] [hoffman2015] [delcoso2016] [baker2017]
    const r = recommendSodium({ durationMin: 180, sweatRateLph: 1.25, sweatSodiumMmolL: 40 });
    expect(r.why.summary).toEqual({
      key: 'electrolytes.why.sodium.medium',
      params: { loss: 1150, mgPerHour: 570, lo: 300, hi: 600 },
    });
    expect(r.why.details).toEqual([{ key: 'electrolytes.why.partial' }]);
    expect(r.why.citations).toEqual(SODIUM_CITATIONS);
  });

  it('treats missing, non-finite and negative inputs as 0', () => {
    for (const bad of [undefined, null, NaN, Infinity, -Infinity, -1, '1.25']) {
      const short = recommendSodium({ durationMin: bad, sweatRateLph: 1.25, sweatSodiumMmolL: 40 });
      expect(short.optional).toBe(true);
      expect(short.mgPerHour).toBe(300);

      const noRate = recommendSodium({ durationMin: 60, sweatRateLph: bad, sweatSodiumMmolL: 40 });
      expect(noRate.mgPerHour).toBe(0);
      expect(noRate.estimatedLossMgPerHour).toBe(0);

      const noSalt = recommendSodium({ durationMin: 180, sweatRateLph: 1.25, sweatSodiumMmolL: bad });
      expect(noSalt.mgPerHour).toBe(300);
      expect(noSalt.estimatedLossMgPerHour).toBe(0);
    }
    expect(recommendSodium()).toMatchObject({ mgPerHour: 0, range: [0, 300], optional: true });
    expect(recommendSodium({})).toMatchObject({ mgPerHour: 0, estimatedLossMgPerHour: 0 });
  });

  it('never exceeds 1000 mg/h for huge inputs', () => {
    for (const durationMin of [60, 180, 600, 1e9]) {
      const r = recommendSodium({ durationMin, sweatRateLph: 1e6, sweatSodiumMmolL: 1e6 });
      expect(r.mgPerHour).toBeLessThanOrEqual(SODIUM_HIGH_MG_PER_HOUR);
      expect(Number.isFinite(r.mgPerHour)).toBe(true);
    }
  });

  it('does not mutate its input', () => {
    const input = Object.freeze({ durationMin: 180, sweatRateLph: 1.25, sweatSodiumMmolL: 40 });
    expect(() => recommendSodium(input)).not.toThrow();
  });

  it('keeps the target inside its range, on a 10 mg grid and below the hard cap (property)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 2880, noNaN: true }),
        fc.double({ min: 0, max: 5, noNaN: true }),
        fc.double({ min: 0, max: 150, noNaN: true }),
        (durationMin, sweatRateLph, sweatSodiumMmolL) => {
          const r = recommendSodium({ durationMin, sweatRateLph, sweatSodiumMmolL });
          expect(Number.isFinite(r.mgPerHour)).toBe(true);
          expect(r.mgPerHour % 10).toBe(0);
          expect(r.mgPerHour).toBeGreaterThanOrEqual(r.range[0]);
          expect(r.mgPerHour).toBeLessThanOrEqual(r.range[1]);
          expect(r.mgPerHour).toBeLessThanOrEqual(SODIUM_HARD_CAP_MG_PER_HOUR);
          expect(r.optional).toBe(durationMin < 120);
          expect(r.warnings).toEqual([]);
        },
      ),
    );
  });
});

describe('sodiumWarnings', () => {
  it('flags intakes far above guidelines as danger', () => {
    // [mccubbin2023] [hoffman2015] no guideline supports more than 1500 mg/h
    const w = sodiumWarnings(1501);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({
      id: 'electrolytes.sodiumFarAbove',
      level: 'danger',
      message: {
        key: 'electrolytes.warn.sodiumFarAbove',
        params: { mgPerHour: 1501, limitMgPerHour: 1500 },
      },
    });
    expect(sodiumWarnings(2000).map((x) => x.id)).toEqual(['electrolytes.sodiumFarAbove']);
  });

  it('warns above 1000 mg/h up to and including 1500 mg/h', () => {
    // [mccubbin2023] usual upper end of sodium guidance
    expect(sodiumWarnings(1000)).toEqual([]);
    for (const mg of [1001, 1200, 1500]) {
      const w = sodiumWarnings(mg);
      expect(w).toHaveLength(1);
      expect(w[0]).toMatchObject({
        id: 'electrolytes.sodiumHigh',
        level: 'warning',
        message: { key: 'electrolytes.warn.sodiumHigh', params: { mgPerHour: mg, limitMgPerHour: 1000 } },
      });
    }
  });

  it('warns when the drink concentration is above 1725 mg/L (75 mmol/L)', () => {
    // [efsa2011] carbohydrate-electrolyte solutions: 460–1150 mg/L sodium
    // 862.5 mg/h in 500 ml/h = exactly 1725 mg/L → no warning
    expect(sodiumWarnings(862.5, { fluidMlPerHour: 500 })).toEqual([]);
    // 870 mg/h in 500 ml/h = 1740 mg/L
    const w = sodiumWarnings(870, { fluidMlPerHour: 500 });
    expect(w).toEqual([
      {
        id: 'electrolytes.concentrationHigh',
        level: 'warning',
        message: {
          key: 'electrolytes.warn.concentrationHigh',
          params: { mgPerL: 1740, limitMgPerL: 1725 },
        },
        citations: ['efsa2011'],
      },
    ]);
    // 570 mg/h in 600 ml/h = 950 mg/L, inside the EFSA range
    expect(sodiumWarnings(570, { fluidMlPerHour: 600 })).toEqual([]);
  });

  it('rounds the concentration for display', () => {
    // 1000 mg/h in 550 ml/h = 1818.18 mg/L
    const [w] = sodiumWarnings(1000, { fluidMlPerHour: 550 });
    expect(w.message.params.mgPerL).toBe(1818);
  });

  it('can return both an intake and a concentration warning', () => {
    const ids = sodiumWarnings(2000, { fluidMlPerHour: 500 }).map((w) => w.id);
    expect(ids).toEqual(['electrolytes.sodiumFarAbove', 'electrolytes.concentrationHigh']);
    const ids2 = sodiumWarnings(1200, { fluidMlPerHour: 400 }).map((w) => w.id);
    expect(ids2).toEqual(['electrolytes.sodiumHigh', 'electrolytes.concentrationHigh']);
  });

  it('skips the concentration check without a positive fluid intake', () => {
    for (const fluidMlPerHour of [0, -500, NaN, Infinity, undefined, null]) {
      expect(sodiumWarnings(900, { fluidMlPerHour })).toEqual([]);
    }
    expect(sodiumWarnings(900)).toEqual([]);
  });

  it('treats non-finite or negative intakes as 0', () => {
    for (const mg of [NaN, Infinity, -Infinity, -2000, undefined, null]) {
      expect(sodiumWarnings(mg, { fluidMlPerHour: 500 })).toEqual([]);
    }
    expect(sodiumWarnings(0, { fluidMlPerHour: 500 })).toEqual([]);
  });

  it('handles huge values', () => {
    const ids = sodiumWarnings(1e12, { fluidMlPerHour: 1 }).map((w) => w.id);
    expect(ids).toEqual(['electrolytes.sodiumFarAbove', 'electrolytes.concentrationHigh']);
  });
});

describe('recommendExtras', () => {
  it('replaces half of typical K, Mg and Ca sweat losses when enabled', () => {
    // [baker2017] [montain2007] typical sweat mineral concentrations
    const r = recommendExtras({ sweatRateLph: 1.25, enabled: ALL_EXTRAS });
    // K: 0.5 × 1.25 × 4.5 × 39.10 = 109.97 → round10 → 110
    expect(r.Potassium).toEqual({ mgPerHour: 110, enabled: true });
    // Mg: 0.5 × 1.25 × 0.05 × 24.31 = 0.76 → 1
    expect(r.Magnesium).toEqual({ mgPerHour: 1, enabled: true });
    // Ca: 0.5 × 1.25 × 0.5 × 40.08 = 12.525 → 13
    expect(r.Calcium).toEqual({ mgPerHour: 13, enabled: true });

    const r2 = recommendExtras({ sweatRateLph: 2.0, enabled: ALL_EXTRAS });
    // K 175.95 → 180; Mg 1.2155 → 1; Ca 20.04 → 20
    expect(r2.Potassium.mgPerHour).toBe(180);
    expect(r2.Magnesium.mgPerHour).toBe(1);
    expect(r2.Calcium.mgPerHour).toBe(20);
  });

  it('caps K at 300, Mg at 50 and Ca at 100 mg/h', () => {
    const r = recommendExtras({ sweatRateLph: 10, enabled: ALL_EXTRAS });
    expect(r.Potassium.mgPerHour).toBe(300);
    expect(r.Magnesium.mgPerHour).toBe(6);
    expect(r.Calcium.mgPerHour).toBe(100);
    const huge = recommendExtras({ sweatRateLph: 1e9, enabled: ALL_EXTRAS });
    expect(huge.Potassium.mgPerHour).toBe(300);
    expect(huge.Magnesium.mgPerHour).toBe(50);
    expect(huge.Calcium.mgPerHour).toBe(100);
  });

  it('returns 0 for disabled ions', () => {
    const r = recommendExtras({
      sweatRateLph: 1.25,
      enabled: { potassium: true, magnesium: false, calcium: false },
    });
    expect(r.Potassium).toEqual({ mgPerHour: 110, enabled: true });
    expect(r.Magnesium).toEqual({ mgPerHour: 0, enabled: false });
    expect(r.Calcium).toEqual({ mgPerHour: 0, enabled: false });

    for (const enabled of [undefined, null, {}]) {
      const off = recommendExtras({ sweatRateLph: 1.25, enabled });
      expect(off.Potassium).toEqual({ mgPerHour: 0, enabled: false });
      expect(off.Magnesium).toEqual({ mgPerHour: 0, enabled: false });
      expect(off.Calcium).toEqual({ mgPerHour: 0, enabled: false });
    }
    expect(recommendExtras().Potassium).toEqual({ mgPerHour: 0, enabled: false });
  });

  it('treats non-finite or negative sweat rates as 0', () => {
    for (const sweatRateLph of [NaN, Infinity, -1, undefined, null]) {
      const r = recommendExtras({ sweatRateLph, enabled: ALL_EXTRAS });
      expect(r.Potassium).toEqual({ mgPerHour: 0, enabled: true });
      expect(r.Magnesium).toEqual({ mgPerHour: 0, enabled: true });
      expect(r.Calcium).toEqual({ mgPerHour: 0, enabled: true });
    }
  });

  it('explains that the extras are optional and do not prevent cramps', () => {
    // [baker2017] [montain2007]
    const r = recommendExtras({ sweatRateLph: 1.25, enabled: ALL_EXTRAS });
    expect(r.why).toEqual({
      summary: { key: 'electrolytes.why.extras' },
      citations: ['baker2017', 'montain2007'],
    });
  });
});

describe('deliveredIons', () => {
  it('uses the mass fraction as sold with no absorption factor', () => {
    // [sawka2007] [efsa2011] [fine1991] guidance is stated as ingested amounts
    const table = deliveredIons([{ id: 31, amountMg: 1000 }]);
    expect(table.Sodium).toBeCloseTo(393, 9);
    expect(table.Chloride).toBeCloseTo(607, 9);
    expect(table.Potassium).toBe(0);

    expect(deliveredIons([{ id: 33, amountMg: 1000 }]).Sodium).toBeCloseTo(234.5, 9);
    expect(deliveredIons([{ id: 39, amountMg: 1000 }]).Potassium).toBeCloseTo(361.6, 9);
    expect(deliveredIons([{ id: 34, amountMg: 1000 }]).Magnesium).toBeCloseTo(161.6, 9);
    expect(deliveredIons([{ id: 35, amountMg: 1000 }]).Calcium).toBeCloseTo(210.8, 9);
    const kcl = deliveredIons([{ id: 32, amountMg: 1000 }]);
    expect(kcl.Potassium).toBeCloseTo(524, 9);
    expect(kcl.Chloride).toBeCloseTo(476, 9);
  });

  it('sums several salts', () => {
    const r = deliveredIons([
      { id: 31, amountMg: 1000 },
      { id: 33, amountMg: 2000 },
      { id: 36, amountMg: 500 },
    ]);
    expect(r.Sodium).toBeCloseTo(393 + 469, 9);
    expect(r.Chloride).toBeCloseTo(607 + 174.4, 9);
    expect(r.Magnesium).toBeCloseTo(59.8, 9);
  });

  it('ignores unknown ids, carb sources and bad amounts', () => {
    expect(
      deliveredIons([
        { id: 999, amountMg: 1000 },
        { id: 3, amountMg: 1000 },
        { id: 31, amountMg: -100 },
        { id: 31, amountMg: NaN },
        { id: 31, amountMg: Infinity },
        { id: 31 },
        null,
      ]),
    ).toEqual(NO_IONS);
    for (const salts of [[], undefined, null, 'x']) {
      expect(deliveredIons(salts)).toEqual(NO_IONS);
    }
  });

  it('does not mutate its input', () => {
    const salts = Object.freeze([Object.freeze({ id: 31, amountMg: 1000 })]);
    expect(() => deliveredIons(salts)).not.toThrow();
    expect(salts).toEqual([{ id: 31, amountMg: 1000 }]);
  });
});

describe('saltsForTargets', () => {
  it('takes all sodium from table salt by default', () => {
    // 1000 / 0.393 = 2544.5 → 2545
    expect(saltsForTargets({ sodiumMg: 1000, sodiumSalt: 'table' })).toEqual([{ id: 31, amountMg: 2545 }]);
    expect(saltsForTargets({ sodiumMg: 1000 })).toEqual([{ id: 31, amountMg: 2545 }]);
    expect(saltsForTargets({ sodiumMg: 1000, sodiumSalt: 'other' })).toEqual([{ id: 31, amountMg: 2545 }]);
  });

  it('takes all sodium from sodium citrate dihydrate', () => {
    // 1000 / 0.2345 = 4264.4 → 4264
    expect(saltsForTargets({ sodiumMg: 1000, sodiumSalt: 'citrate' })).toEqual([{ id: 33, amountMg: 4264 }]);
  });

  it('splits sodium half and half for the mix', () => {
    // 500 / 0.393 = 1272.3 → 1272; 500 / 0.2345 = 2132.2 → 2132
    expect(saltsForTargets({ sodiumMg: 1000, sodiumSalt: 'mix' })).toEqual([
      { id: 31, amountMg: 1272 },
      { id: 33, amountMg: 2132 },
    ]);
  });

  it('uses potassium, magnesium and calcium citrate for the extras', () => {
    // K 300 / 0.3616 = 829.6 → 830; Mg 50 / 0.1616 = 309.4 → 309; Ca 100 / 0.2108 = 474.4 → 474
    expect(
      saltsForTargets({
        sodiumMg: 2000,
        potassiumMg: 300,
        magnesiumMg: 50,
        calciumMg: 100,
        sodiumSalt: 'table',
      }),
    ).toEqual([
      { id: 31, amountMg: 5089 },
      { id: 39, amountMg: 830 },
      { id: 34, amountMg: 309 },
      { id: 35, amountMg: 474 },
    ]);
  });

  it('omits zero amounts, including amounts that round to 0', () => {
    expect(saltsForTargets({ sodiumMg: 0, potassiumMg: 0, magnesiumMg: 0, calciumMg: 0 })).toEqual([]);
    expect(saltsForTargets({ sodiumMg: 0.1, sodiumSalt: 'table' })).toEqual([]);
    expect(saltsForTargets({ potassiumMg: 100 })).toEqual([{ id: 39, amountMg: 277 }]);
    expect(saltsForTargets()).toEqual([]);
  });

  it('treats non-finite or negative targets as 0', () => {
    for (const bad of [NaN, Infinity, -Infinity, -100, undefined, null, '500']) {
      expect(
        saltsForTargets({ sodiumMg: bad, potassiumMg: bad, magnesiumMg: bad, calciumMg: bad }),
      ).toEqual([]);
    }
  });

  it('round-trips through deliveredIons within the compareIons tolerance (property)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 50000, noNaN: true }),
        fc.double({ min: 0, max: 5000, noNaN: true }),
        fc.double({ min: 0, max: 1000, noNaN: true }),
        fc.double({ min: 0, max: 2000, noNaN: true }),
        fc.constantFrom('table', 'citrate', 'mix'),
        (sodiumMg, potassiumMg, magnesiumMg, calciumMg, sodiumSalt) => {
          const salts = saltsForTargets({ sodiumMg, potassiumMg, magnesiumMg, calciumMg, sodiumSalt });
          for (const s of salts) {
            expect(Number.isInteger(s.amountMg)).toBe(true);
            expect(s.amountMg).toBeGreaterThan(0);
          }
          const targets = { Sodium: sodiumMg, Potassium: potassiumMg, Magnesium: magnesiumMg, Calcium: calciumMg };
          const cmp = compareIons(deliveredIons(salts), targets);
          for (const ion of ['Sodium', 'Potassium', 'Magnesium', 'Calcium']) {
            if (cmp[ion]) expect(cmp[ion].status).toBe('met');
          }
        },
      ),
    );
  });
});

describe('compareIons', () => {
  it('marks amounts within max(1 mg, 2%) as met', () => {
    const r = compareIons(
      { Sodium: 505, Potassium: 20.9, Magnesium: 0, Calcium: 0, Chloride: 0 },
      { Sodium: 500, Potassium: 20 },
    );
    expect(r).toEqual({
      Sodium: { target: 500, delivered: 505, diff: 5, status: 'met' },
      Potassium: { target: 20, delivered: 20.9, diff: expect.closeTo(0.9, 9), status: 'met' },
    });
    // exactly on the 2% boundary
    expect(compareIons({ Sodium: 510 }, { Sodium: 500 }).Sodium.status).toBe('met');
    expect(compareIons({ Sodium: 490 }, { Sodium: 500 }).Sodium.status).toBe('met');
  });

  it('marks larger gaps as short or over', () => {
    expect(compareIons({ Sodium: 489 }, { Sodium: 500 }).Sodium).toEqual({
      target: 500,
      delivered: 489,
      diff: -11,
      status: 'short',
    });
    expect(compareIons({ Sodium: 511 }, { Sodium: 500 }).Sodium.status).toBe('over');
    // 1 mg floor for small targets
    expect(compareIons({ Potassium: 21.5 }, { Potassium: 20 }).Potassium.status).toBe('over');
    expect(compareIons({ Potassium: 18.5 }, { Potassium: 20 }).Potassium.status).toBe('short');
    expect(compareIons({ Magnesium: 1 }, { Magnesium: 0 }).Magnesium.status).toBe('met');
  });

  it('lists only ions with a target or a delivered amount', () => {
    const r = compareIons(deliveredIons([{ id: 31, amountMg: 1000 }]), { Sodium: 400, Potassium: 0 });
    expect(Object.keys(r)).toEqual(['Sodium', 'Chloride']);
    expect(r.Sodium.status).toBe('met');
    expect(r.Chloride).toMatchObject({ target: 0, status: 'over' });
    expect(r.Chloride.delivered).toBeCloseTo(607, 9);

    expect(compareIons({}, { Calcium: 100 })).toEqual({
      Calcium: { target: 100, delivered: 0, diff: -100, status: 'short' },
    });
    expect(compareIons(NO_IONS, NO_IONS)).toEqual({});
    expect(compareIons(undefined, undefined)).toEqual({});
  });

  it('treats non-finite or negative amounts as 0', () => {
    expect(compareIons({ Sodium: NaN, Potassium: -5 }, { Sodium: Infinity, Potassium: -1 })).toEqual({});
  });
});

describe('i18n catalog and citations', () => {
  const recommendations = [
    recommendSodium({ durationMin: 60, sweatRateLph: 1.25, sweatSodiumMmolL: 40 }),
    recommendSodium({ durationMin: 180, sweatRateLph: 1.25, sweatSodiumMmolL: 40 }),
    recommendSodium({ durationMin: 300, sweatRateLph: 2.0, sweatSodiumMmolL: 70 }),
    recommendExtras({ sweatRateLph: 1.25, enabled: ALL_EXTRAS }),
  ];
  const warningLists = [
    sodiumWarnings(2000, { fluidMlPerHour: 500 }),
    sodiumWarnings(1200, { fluidMlPerHour: 1000 }),
  ];
  const messages = [...recommendations.flatMap(messagesOf), ...warningLists.flatMap(messagesOf)];

  it('has text for every key the module returns, with every placeholder filled', () => {
    for (const m of messages) {
      expect(electrolytesCatalog, m.key).toHaveProperty([m.key]);
      for (const name of placeholders(electrolytesCatalog[m.key])) {
        expect(m.params ?? {}, `${m.key} {${name}}`).toHaveProperty([name]);
      }
    }
  });

  it('has no unused keys and only electrolytes.* keys', () => {
    const used = new Set(messages.map((m) => m.key));
    expect(Object.keys(electrolytesCatalog).sort()).toEqual([...used].sort());
    for (const key of Object.keys(electrolytesCatalog)) {
      expect(key.startsWith('electrolytes.')).toBe(true);
    }
  });

  it('uses warning ids that match their message keys', () => {
    for (const w of warningLists.flat()) {
      expect(w.message.key).toBe(w.id.replace(/^electrolytes\./, 'electrolytes.warn.'));
    }
  });

  it('cites only registered citations', () => {
    const ids = [
      ...recommendations.flatMap((r) => r.why.citations),
      ...warningLists.flat().flatMap((w) => w.citations ?? []),
    ];
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(CITATIONS, id).toHaveProperty([id]);
  });

  it('follows the copy style: no em dashes, en dash ranges', () => {
    for (const text of Object.values(electrolytesCatalog)) {
      expect(text).not.toMatch(/—/);
      expect(text).not.toMatch(/\d-\d/);
    }
  });
});
