import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  GEL_CONSISTENCY_PCT,
  TONICITY_BANDS,
  EFSA_SODIUM_MG_PER_L,
  DEFAULT_BOTTLE_ML,
  MIN_DRINK_FLUID_ML,
  solutionDensity,
  tonicityOf,
  roundOsmolality,
  ingredientVolumeMl,
  osmolality,
  gelBatch,
  drinkBottles,
} from './concentration';
import { CITATIONS } from './evidence';
import catalog from '../i18n/en/concentration';

// Literal ingredient profiles (osmPerG and waterFraction as purchased, research
// notes C), so these tests do not depend on the constants module.
const DEXTROSE = { ref: 1, osmPerG: 5.55, waterFraction: 0, carbsPerGram: 1 };
const DEXTROSE_MONO = { ref: 8, osmPerG: 5.05, waterFraction: 0.091, carbsPerGram: 0.91 };
const GLUCOSE_SYRUP = { ref: 2, osmPerG: 1.86, waterFraction: 0.2, carbsPerGram: 0.8 };
const MALTODEXTRIN = { ref: 3, osmPerG: 0.95, waterFraction: 0.05, carbsPerGram: 0.95 };
const HBCD = { ref: 5, osmPerG: 0.02, waterFraction: 0.05, carbsPerGram: 0.95 };
const FRUCTOSE = { ref: 11, osmPerG: 5.55, waterFraction: 0, carbsPerGram: 1 };
const HONEY = { ref: 14, osmPerG: 4.5, waterFraction: 0.17, carbsPerGram: 0.82 };
const MAPLE = { ref: 17, osmPerG: 1.95, waterFraction: 0.32, carbsPerGram: 0.67 };
const SUCROSE = { ref: 18, osmPerG: 2.92, waterFraction: 0, carbsPerGram: 1 };
const NACL = { osmPerG: 31.8 };

/** A carb item as the plan passes it: a solver item merged with its profile. */
function carb(profile, carbsG) {
  const { carbsPerGram, ...rest } = profile;
  return { ...rest, carbsG, grams: carbsG / carbsPerGram };
}

/** Freezes an object graph so a test fails if a function mutates its input. */
function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function placeholders(text) {
  return [...text.matchAll(/\{(\w+)(?::\w+)*\}/g)].map((m) => m[1]);
}

const ids = (result) => result.warnings.map((w) => w.id);

describe('constants', () => {
  it('defines the gel consistency presets in % carbohydrate w/w', () => {
    // research notes D: isotonic-style 30–35, liquid 40–50, standard 55–65, thick 68–72
    expect(GEL_CONSISTENCY_PCT).toEqual({ isotonic: 33, liquid: 45, standard: 60, thick: 70 });
  });

  it('defines the tonicity bands in mOsm/kg', () => {
    // [efsa2011] 200–330 mOsm/kg for carbohydrate-electrolyte solutions
    expect(TONICITY_BANDS).toEqual({ hypotonic: 270, isotonic: 330 });
  });

  it('uses the EFSA sodium range of 20–50 mmol/L', () => {
    // [efsa2011] 20 mmol × 22.99 = 460 mg, 50 mmol × 22.99 = 1150 mg
    expect(EFSA_SODIUM_MG_PER_L).toEqual([460, 1150]);
  });
});

describe('solutionDensity', () => {
  it('matches the density table of the research notes', () => {
    // research notes D: rho = 1/((1−w)/0.9982 + 0.625·w), fit to the ICUMSA sucrose table
    expect(solutionDensity(0)).toBeCloseTo(0.9982, 6);
    expect(Math.abs(solutionDensity(0.1) - 1.037)).toBeLessThan(0.005);
    expect(Math.abs(solutionDensity(0.3) - 1.125)).toBeLessThan(0.005);
    expect(Math.abs(solutionDensity(0.5) - 1.229)).toBeLessThan(0.005);
    expect(Math.abs(solutionDensity(0.6) - 1.289)).toBeLessThan(0.005);
    expect(Math.abs(solutionDensity(0.7) - 1.355)).toBeLessThan(0.005);
  });

  it('stays within 0.6% of the ICUMSA sucrose densities at 20 °C', () => {
    // research notes D (solar_density.py): ICUMSA / Landolt-Börnstein true densities, w/w %
    const icumsa = { 10: 1.0381, 20: 1.08093, 30: 1.12695, 40: 1.17641, 50: 1.22957, 60: 1.28642, 70: 1.34714 };
    for (const [pct, rho] of Object.entries(icumsa)) {
      expect(Math.abs(solutionDensity(pct / 100) - rho) / rho, `${pct}%`).toBeLessThan(0.006);
    }
  });

  it('clamps the fraction to [0, 1] and treats bad values as water', () => {
    expect(solutionDensity(-0.5)).toBe(solutionDensity(0));
    expect(solutionDensity(2)).toBe(solutionDensity(1));
    expect(solutionDensity(1)).toBeCloseTo(1.6, 10);
    for (const bad of [NaN, Infinity, undefined, null, '0.5']) expect(solutionDensity(bad)).toBe(solutionDensity(0));
  });

  it('rises with the solids fraction', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(solutionDensity(lo)).toBeLessThanOrEqual(solutionDensity(hi));
      }),
    );
  });
});

describe('tonicityOf', () => {
  it('splits at 270 and 330 mOsm/kg', () => {
    expect(tonicityOf(0)).toBe('hypotonic');
    expect(tonicityOf(269)).toBe('hypotonic');
    expect(tonicityOf(270)).toBe('isotonic');
    expect(tonicityOf(330)).toBe('isotonic');
    expect(tonicityOf(331)).toBe('hypertonic');
    expect(tonicityOf(Infinity)).toBe('hypertonic');
  });

  it('classifies the whole mOsm/kg value that is shown', () => {
    expect(tonicityOf(269.4)).toBe('hypotonic');
    expect(tonicityOf(269.6)).toBe('isotonic');
    expect(tonicityOf(330.4)).toBe('isotonic');
    expect(tonicityOf(330.6)).toBe('hypertonic');
  });

  it('treats bad values as 0', () => {
    for (const bad of [NaN, -5, -Infinity, undefined, null]) expect(tonicityOf(bad)).toBe('hypotonic');
  });
});

describe('osmolality', () => {
  it('reproduces Vist & Maughan: 40 g glucose made up to 1 L ≈ 228 mOsm/kg', () => {
    // [vist1995] measured 230 mOsm/kg; added water = 1000 − 0.625 × 40 = 975 g
    const result = osmolality([{ grams: 40, osmPerG: 5.55, waterFraction: 0 }], 975);
    expect(Math.abs(result.mOsmPerKg - 228)).toBeLessThanOrEqual(5);
    expect(result.waterG).toBe(975);
    expect(result.tonicity).toBe('hypotonic');
  });

  it('gives ≈ 182 mOsm/kg for a 6% w/v sucrose drink', () => {
    // research notes C (osmo.py): 60 g sucrose made up to 1 L, water 1000 − 0.625 × 60 = 962.5 g
    const result = osmolality([{ grams: 60, osmPerG: 2.92, waterFraction: 0 }], 962.5);
    expect(Math.abs(result.mOsmPerKg - 182)).toBeLessThanOrEqual(5);
  });

  it('gives ≈ 4644 mOsm/kg for the 60% maltodextrin/fructose gel of osmo.py', () => {
    // research notes C (osmo.py "DIY 60% MD19:fru 1.5:1 30 g CHO in 50 g"):
    // 18 g maltodextrin DE19 (19/18.016 mOsm/g), 12 g fructose (5.551), 0.2 g NaCl (2 × 0.93 / 58.443 mol), 19.8 g water
    const components = [
      { grams: 18, osmPerG: 19 / 18.016, waterFraction: 0 },
      { grams: 12, osmPerG: 5.551, waterFraction: 0 },
      { grams: 0.2, osmPerG: (2 * 1000 * 0.93) / 58.443 },
    ];
    const result = osmolality(components, 19.8);
    expect(Math.abs(result.mOsmPerKg - 4644)).toBeLessThanOrEqual(5);
    expect(result.tonicity).toBe('hypertonic');
  });

  it('counts the water inside syrups and crystal water as solvent', () => {
    const result = osmolality([{ grams: 10, osmPerG: 4.5, waterFraction: 0.17 }], 100);
    expect(result.waterG).toBeCloseTo(101.7, 10);
    expect(result.mOsmPerKg).toBeCloseTo((1000 * 45) / 101.7, 10);
  });

  it('returns 0 without solutes and Infinity with solutes but no water', () => {
    expect(osmolality([], 500)).toEqual({ mOsmPerKg: 0, waterG: 500, tonicity: 'hypotonic' });
    expect(osmolality([], 0)).toEqual({ mOsmPerKg: 0, waterG: 0, tonicity: 'hypotonic' });
    expect(osmolality([{ grams: 10, osmPerG: 5.55 }], 0)).toEqual({
      mOsmPerKg: Infinity,
      waterG: 0,
      tonicity: 'hypertonic',
    });
  });

  it('treats bad numbers as 0 and skips entries that are not objects', () => {
    const result = osmolality(
      [null, 3, 'x', { grams: -5, osmPerG: 5 }, { grams: 10, osmPerG: NaN }, { grams: 10, osmPerG: 5, waterFraction: 3 }],
      NaN,
    );
    // the last entry is all water (fraction clamped to 1): 50 mOsm in 10 g of water
    expect(result.waterG).toBe(10);
    expect(result.mOsmPerKg).toBe(5000);
    expect(osmolality(undefined, 100)).toEqual({ mOsmPerKg: 0, waterG: 100, tonicity: 'hypotonic' });
    expect(osmolality('nope', -1)).toEqual({ mOsmPerKg: 0, waterG: 0, tonicity: 'hypotonic' });
  });

  it('does not mutate its arguments', () => {
    const components = deepFreeze([{ grams: 10, osmPerG: 5, waterFraction: 0.1 }]);
    expect(() => osmolality(components, 100)).not.toThrow();
  });
});

describe('gelBatch', () => {
  /** 30 g carbs: 20 g maltodextrin, 10 g fructose, 0.2 g salt (app profiles). */
  const defaultGel = (extra = {}) =>
    gelBatch({
      carbItems: [carb(MALTODEXTRIN, 20), carb(FRUCTOSE, 10)],
      saltItems: [{ ...NACL, grams: 0.2 }],
      totalCarbsG: 30,
      servings: 1,
      consistency: 'standard',
      ...extra,
    });

  it('makes the osmo.py 60% gel up to 50 g with 19.8 g of water', () => {
    // research notes C (osmo.py): 30 g CHO in 50 g → ≈ 4644 mOsm/kg (φ = 1)
    const batch = gelBatch({
      carbItems: [
        { ref: 3, carbsG: 18, grams: 18, osmPerG: 19 / 18.016, waterFraction: 0 },
        { ref: 11, carbsG: 12, grams: 12, osmPerG: 5.551, waterFraction: 0 },
      ],
      saltItems: [{ grams: 0.2, osmPerG: (2 * 1000 * 0.93) / 58.443 }],
      totalCarbsG: 30,
      servings: 1,
      consistency: 'standard',
    });
    expect(batch.addedWaterMl).toBeCloseTo(19.8, 10);
    expect(batch.totalMassG).toBeCloseTo(50, 10);
    expect(Math.abs(batch.osmolality.mOsmPerKg - 4644)).toBeLessThanOrEqual(5);
    expect(batch.carbPct).toBeCloseTo(60, 10);
  });

  it('computes water, solids, density and volume with the app profiles', () => {
    const batch = defaultGel();
    // maltodextrin 20 g carbs = 21.05 g as purchased (1.05 g water); target mass 30 / 0.60 = 50 g
    expect(batch.addedWaterMl).toBeCloseTo(50 - 20 / 0.95 - 10 - 0.2, 10);
    expect(batch.totalMassG).toBeCloseTo(50, 10);
    // solids = 20 g dry maltodextrin + 10 g fructose + 0.2 g salt
    expect(batch.solidsFraction).toBeCloseTo(30.2 / 50, 10);
    expect(Math.abs(batch.densityGPerMl - 1.2916)).toBeLessThan(0.0005);
    expect(batch.volumeMl).toBeCloseTo(50 / batch.densityGPerMl, 10);
    // water = added + maltodextrin water = 19.8 g; solutes 20 + 55.5 + 6.36 mOsm
    expect(batch.osmolality.waterG).toBeCloseTo(19.8, 10);
    expect(batch.osmolality.mOsmPerKg).toBeCloseTo(4134.34, 1);
    expect(batch.consistency).toBe('standard');
    expect(batch.targetPct).toBe(60);
  });

  it('makes each preset up to its carbohydrate percentage', () => {
    for (const [consistency, pct] of Object.entries(GEL_CONSISTENCY_PCT)) {
      const batch = gelBatch({ carbItems: [carb(DEXTROSE, 15), carb(FRUCTOSE, 15)], totalCarbsG: 30, servings: 1, consistency });
      expect(batch.totalMassG, consistency).toBeCloseTo(3000 / pct, 10);
      expect(batch.addedWaterMl, consistency).toBeCloseTo(3000 / pct - 30, 10);
      expect(batch.carbPct, consistency).toBeCloseTo(pct, 10);
      expect(batch.targetPct).toBe(pct);
    }
  });

  it('uses the standard preset for an unknown or missing consistency', () => {
    for (const consistency of [undefined, 'runny', '', null, 'toString']) {
      const batch = defaultGel({ consistency });
      expect(batch.consistency).toBe('standard');
      expect(batch.totalMassG).toBeCloseTo(50, 10);
    }
  });

  it('divides the batch into servings and suggests water with each gel', () => {
    // [pfeiffer2010] gel + water ≈ 10% carbohydrate: 15 g / 0.10 − 25 g = 125 ml → 130 ml
    const batch = defaultGel({ servings: 2 });
    expect(batch.perServing.massG).toBeCloseTo(25, 10);
    expect(batch.perServing.carbsG).toBe(15);
    expect(batch.perServing.volumeMl).toBeCloseTo(batch.volumeMl / 2, 10);
    expect(batch.waterToDrinkMlPerServing).toBe(130);
    // 30 g per 50 g gel: 300 − 50 = 250 ml
    expect(defaultGel().waterToDrinkMlPerServing).toBe(250);
  });

  it('treats missing, zero or negative servings as one serving', () => {
    for (const servings of [undefined, 0, -3, NaN, Infinity]) {
      const batch = defaultGel({ servings });
      expect(batch.perServing.massG, String(servings)).toBeCloseTo(batch.totalMassG, 10);
      expect(batch.perServing.carbsG).toBe(30);
    }
  });

  it('takes the carb total from the items when totalCarbsG is missing', () => {
    const batch = defaultGel({ totalCarbsG: undefined });
    expect(batch.totalMassG).toBeCloseTo(50, 10);
    expect(batch.perServing.carbsG).toBe(30);
  });

  it('adds no water and warns about nothing without carbohydrate', () => {
    for (const totalCarbsG of [0, -10]) {
      const batch = gelBatch({ carbItems: [], saltItems: [{ ...NACL, grams: 1 }], totalCarbsG, servings: 2 });
      expect(batch.addedWaterMl).toBe(0);
      expect(batch.totalMassG).toBe(1);
      expect(batch.carbPct).toBe(0);
      expect(batch.waterToDrinkMlPerServing).toBe(0);
      expect(batch.warnings).toEqual([]);
    }
    const empty = gelBatch();
    expect(empty).toMatchObject({ addedWaterMl: 0, totalMassG: 0, solidsFraction: 0, volumeMl: 0, warnings: [] });
    expect(empty.densityGPerMl).toBeCloseTo(0.9982, 10);
    expect(empty.osmolality).toEqual({ mOsmPerKg: 0, waterG: 0, tonicity: 'hypotonic' });
    expect(gelBatch(null).totalMassG).toBe(0);
  });

  it('counts syrup water toward the water and says when syrups make the gel thinner', () => {
    // 30 g carbs from maple syrup = 44.8 g syrup, more than a 70% gel of 42.9 g
    const batch = gelBatch({ carbItems: [carb(MAPLE, 30)], totalCarbsG: 30, servings: 1, consistency: 'thick' });
    expect(batch.addedWaterMl).toBe(0);
    expect(batch.totalMassG).toBeCloseTo(30 / 0.67, 10);
    expect(batch.carbPct).toBeCloseTo(67, 10);
    const warning = batch.warnings.find((w) => w.id === 'concentration.syrupsThinner');
    expect(warning).toEqual({
      id: 'concentration.syrupsThinner',
      level: 'info',
      message: { key: 'concentration.warn.syrupsThinner', params: { pct: 67, targetPct: 70 } },
    });
    // the same syrup at 60% leaves room for 5.2 g of water and no message
    const standard = gelBatch({ carbItems: [carb(MAPLE, 30)], totalCarbsG: 30, servings: 1 });
    expect(standard.addedWaterMl).toBeCloseTo(50 - 30 / 0.67, 10);
    expect(ids(standard)).not.toContain('concentration.syrupsThinner');
    // honey (82% carbs) reaches every preset with added water
    const honey = gelBatch({ carbItems: [carb(HONEY, 30)], totalCarbsG: 30, servings: 1, consistency: 'thick' });
    expect(honey.addedWaterMl).toBeGreaterThan(0);
    expect(ids(honey)).not.toContain('concentration.syrupsThinner');
  });

  it('gives the same thinner-gel info when dry non-carb mass, not water, makes the gel heavy', () => {
    // a custom ingredient with 50 g carbs per 100 g and waterPct 0: 30 g carbs = 60 g, above the 50 g target
    const dry = gelBatch({
      carbItems: [{ ref: 'c1', carbsG: 30, grams: 60, osmPerG: 2.775, waterFraction: 0 }],
      totalCarbsG: 30,
      servings: 1,
    });
    expect(dry.addedWaterMl).toBe(0);
    expect(dry.warnings.find((w) => w.id === 'concentration.syrupsThinner').message.params).toEqual({ pct: 50, targetPct: 60 });
    // the text speaks of the ingredients' weight, so it is true here (no syrup water at all)
    expect(catalog['concentration.warn.syrupsThinner']).toMatch(/ingredients already weigh more/);
    // no water at all: the documented infinite osmolality, and the gel is taken with water
    expect(dry.osmolality).toEqual({ mOsmPerKg: Infinity, waterG: 0, tonicity: 'hypertonic' });
    expect(ids(dry)).toContain('concentration.gelTakeWithWater');
  });

  it('warns that dextrose-heavy gels can crystallise', () => {
    // glucose solubility ≈ 48% w/w at 25 °C (research notes D), relative to the water:
    // warn when dextrose / (dextrose + water) is above 45%. All-dextrose 60%: 30 g in 20 g water → 60%
    const allDextrose = gelBatch({ carbItems: [carb(DEXTROSE, 30)], totalCarbsG: 30, servings: 1 });
    const warning = allDextrose.warnings.find((w) => w.id === 'concentration.crystallise');
    expect(warning).toEqual({
      id: 'concentration.crystallise',
      level: 'warning',
      message: { key: 'concentration.warn.crystallise', params: { glucosePct: 60, limitPct: 45 } },
    });
    // monohydrate counts with its glucose (carbsG); its crystal water joins the solvent:
    // 30 g glucose with 3.0 g crystal water + 17.0 g added water → 60%
    const mono = gelBatch({ carbItems: [carb(DEXTROSE_MONO, 30)], totalCarbsG: 30, servings: 1 });
    expect(mono.warnings.find((w) => w.id === 'concentration.crystallise').message.params.glucosePct).toBe(60);
    // 30 g in a 45% gel of 66.7 g: 30 / (30 + 36.7) = 45% → at the limit, no warning
    const liquid = gelBatch({ carbItems: [carb(DEXTROSE_MONO, 30)], totalCarbsG: 30, servings: 1, consistency: 'liquid' });
    expect(ids(liquid)).not.toContain('concentration.crystallise');
  });

  it('judges dextrose against the gel water, not the whole gel mass', () => {
    // research notes D: solubility is ~48% w/w of a glucose + water solution, so the other
    // sugars do not dilute it. A DIY 2:1 dextrose:fructose 60% gel: 20 g in 20 g water → 50%
    // (only 40% of the 50 g gel, which a gel-mass rule would miss)
    const diy = gelBatch({ carbItems: [carb(DEXTROSE, 20), carb(FRUCTOSE, 10)], totalCarbsG: 30, servings: 1 });
    expect(diy.warnings.find((w) => w.id === 'concentration.crystallise').message.params).toEqual({ glucosePct: 50, limitPct: 45 });
    // 1:1 at 70%: 15 g in 12.9 g water → 54% → warning
    const thick = gelBatch({ carbItems: [carb(DEXTROSE, 15), carb(FRUCTOSE, 15)], totalCarbsG: 30, servings: 1, consistency: 'thick' });
    expect(ids(thick)).toContain('concentration.crystallise');
    // the same 1:1 mix at 45%: 15 g in 36.7 g water → 29% → no warning
    const liquid = gelBatch({ carbItems: [carb(DEXTROSE, 15), carb(FRUCTOSE, 15)], totalCarbsG: 30, servings: 1, consistency: 'liquid' });
    expect(ids(liquid)).not.toContain('concentration.crystallise');
    // boundary at 60% (20 g water): 16 g → 16/36 = 44% no warning; 17 g → 17/37 = 46% warning
    const below = gelBatch({ carbItems: [carb(DEXTROSE, 16), carb(FRUCTOSE, 14)], totalCarbsG: 30, servings: 1 });
    expect(ids(below)).not.toContain('concentration.crystallise');
    const above = gelBatch({ carbItems: [carb(DEXTROSE, 17), carb(FRUCTOSE, 13)], totalCarbsG: 30, servings: 1 });
    expect(above.warnings.find((w) => w.id === 'concentration.crystallise').message.params.glucosePct).toBe(46);
  });

  it('does not count glucose syrup, maltodextrin or fructose toward crystallisation', () => {
    const syrup = gelBatch({ carbItems: [carb(GLUCOSE_SYRUP, 30)], totalCarbsG: 30, servings: 1, consistency: 'thick' });
    expect(ids(syrup)).not.toContain('concentration.crystallise');
    expect(ids(defaultGel({ consistency: 'thick' }))).not.toContain('concentration.crystallise');
    const fructose = gelBatch({ carbItems: [carb(FRUCTOSE, 30)], totalCarbsG: 30, servings: 1, consistency: 'thick' });
    expect(ids(fructose)).not.toContain('concentration.crystallise');
  });

  it('uses the dry grams of a dextrose item without carbsG', () => {
    const batch = gelBatch({ carbItems: [{ ref: 8, grams: 33, osmPerG: 5.05, waterFraction: 0.091 }], totalCarbsG: 30, servings: 1 });
    // 33 × 0.909 = 30.0 g glucose; water 33 × 0.091 + 17 g added = 20.0 g → 60%
    expect(batch.warnings.find((w) => w.id === 'concentration.crystallise').message.params.glucosePct).toBe(60);
  });

  it('says to take a hypertonic gel with water', () => {
    // [vist1995] [pfeiffer2010] gels above ~600 mOsm/kg → take with water
    const warning = defaultGel({ servings: 2 }).warnings.find((w) => w.id === 'concentration.gelTakeWithWater');
    expect(warning).toEqual({
      id: 'concentration.gelTakeWithWater',
      level: 'info',
      message: { key: 'concentration.warn.gelTakeWithWater', params: { waterMl: 130 } },
      citations: ['vist1995', 'pfeiffer2010'],
    });
  });

  it('does not ask for water with a near-isotonic HBCD gel', () => {
    // 22 g HBCD at 33% (SiS-like): ≈ 10 mOsm/kg
    const batch = gelBatch({ carbItems: [carb(HBCD, 22)], totalCarbsG: 22, servings: 1, consistency: 'isotonic' });
    expect(batch.osmolality.mOsmPerKg).toBeLessThan(270);
    expect(batch.osmolality.tonicity).toBe('hypotonic');
    expect(batch.warnings).toEqual([]);
  });

  it('asks for water only above 600 mOsm/kg as shown (boundary)', () => {
    // 30 g of a dry custom carb at 60%: 20 g of water, so osmolality = 1500 × osmPerG
    const gelAt = (mOsm) =>
      gelBatch({ carbItems: [{ ref: 'c1', carbsG: 30, grams: 30, osmPerG: mOsm / 1500, waterFraction: 0 }], totalCarbsG: 30, servings: 1 });
    expect(gelAt(600).osmolality.mOsmPerKg).toBeCloseTo(600, 9);
    expect(ids(gelAt(600))).toEqual([]);
    expect(ids(gelAt(600.4))).toEqual([]); // shown as 600
    expect(ids(gelAt(600.6))).toEqual(['concentration.gelTakeWithWater']); // shown as 601
    expect(ids(gelAt(601))).toEqual(['concentration.gelTakeWithWater']);
  });

  it('does not mutate its input and is deterministic', () => {
    const input = deepFreeze({
      carbItems: [carb(MALTODEXTRIN, 20), carb(FRUCTOSE, 10)],
      saltItems: [{ ...NACL, grams: 0.2 }],
      totalCarbsG: 30,
      servings: 3,
      consistency: 'liquid',
    });
    expect(gelBatch(input)).toEqual(gelBatch(input));
  });

  const profileArb = fc.record({
    ref: fc.oneof(fc.constantFrom(1, 2, 3, 4, 5, 8, 11, 14, 17, 18), fc.constant('c1')),
    carbsPerGram: fc.double({ min: 0.3, max: 1, noNaN: true }),
    osmPerG: fc.double({ min: 0, max: 6, noNaN: true }),
  });
  // Subnormal masses (below about 2e-308 g) lose precision in `carbs / pct`, so a gel of
  // 5e-324 g carbs could read 33.3 % at a 33 % preset. They never reach the module: the
  // solver sets amounts below 1e-8 of the total to 0.
  const carbGramsArb = fc.double({ min: 0, max: 200, noNaN: true }).filter((g) => g === 0 || g >= 1e-300);
  const gelArb = fc.record({
    items: fc.array(fc.tuple(profileArb, carbGramsArb), { maxLength: 6 }),
    salts: fc.array(fc.record({ grams: fc.double({ min: 0, max: 5, noNaN: true }), osmPerG: fc.double({ min: 0, max: 32, noNaN: true }) }), { maxLength: 4 }),
    servings: fc.integer({ min: 1, max: 30 }),
    consistency: fc.constantFrom(...Object.keys(GEL_CONSISTENCY_PCT)),
  });

  it('keeps every value finite (osmolality too, when the gel has water) and consistent (property)', () => {
    fc.assert(
      fc.property(gelArb, ({ items, salts, servings, consistency }) => {
        // the rest of an ingredient's mass is water, as for the custom ingredients
        const carbItems = items.map(([p, carbsG]) => ({
          ref: p.ref,
          carbsG,
          grams: carbsG / p.carbsPerGram,
          osmPerG: p.osmPerG,
          waterFraction: Math.min(0.95, 1 - p.carbsPerGram),
        }));
        const totalCarbsG = carbItems.reduce((s, c) => s + c.carbsG, 0);
        const batch = gelBatch({ carbItems, saltItems: salts, totalCarbsG, servings, consistency });
        const ingredientG = [...carbItems, ...salts].reduce((s, c) => s + c.grams, 0);
        const values = [
          batch.addedWaterMl,
          batch.totalMassG,
          batch.solidsFraction,
          batch.densityGPerMl,
          batch.volumeMl,
          batch.carbPct,
          batch.waterToDrinkMlPerServing,
          batch.osmolality.waterG,
          ...Object.values(batch.perServing),
        ];
        for (const value of values) expect(Number.isFinite(value)).toBe(true);
        // osmolality is finite whenever there is water; the documented exception is a mix
        // with solutes and no water at all (Infinity, hypertonic)
        if (batch.osmolality.waterG > 0) expect(Number.isFinite(batch.osmolality.mOsmPerKg)).toBe(true);
        else expect([0, Infinity]).toContain(batch.osmolality.mOsmPerKg);
        if (batch.osmolality.mOsmPerKg === Infinity) expect(batch.osmolality.tonicity).toBe('hypertonic');
        // no message ever carries a non-finite number
        for (const w of batch.warnings) {
          for (const param of Object.values(w.message.params ?? {})) expect(Number.isFinite(param)).toBe(true);
        }
        expect(batch.addedWaterMl).toBeGreaterThanOrEqual(0);
        expect(batch.totalMassG).toBeCloseTo(ingredientG + batch.addedWaterMl, 6);
        expect(batch.solidsFraction).toBeGreaterThanOrEqual(0);
        expect(batch.solidsFraction).toBeLessThanOrEqual(1);
        expect(batch.densityGPerMl).toBeGreaterThanOrEqual(0.9982 - 1e-12);
        expect(batch.volumeMl).toBeLessThanOrEqual(batch.totalMassG / 0.9982 + 1e-9);
        // the gel is never stronger than its preset
        expect(batch.carbPct).toBeLessThanOrEqual(GEL_CONSISTENCY_PCT[consistency] + 1e-9);
        expect(batch.waterToDrinkMlPerServing % 10).toBe(0);
        expect(batch.waterToDrinkMlPerServing).toBeGreaterThanOrEqual(0);
        expect(batch.perServing.massG * servings).toBeCloseTo(batch.totalMassG, 6);
        expect(batch.osmolality.mOsmPerKg).toBeGreaterThanOrEqual(0);
        expect(gelBatch({ carbItems, saltItems: salts, totalCarbsG, servings, consistency })).toEqual(batch);
      }),
    );
  });

  it('has water and a finite osmolality whenever it has carbs and the ingredients carry water (property)', () => {
    // the common case for the app: syrups or maltodextrin with some water, so the batch always has water
    fc.assert(
      fc.property(gelArb, ({ items, salts, servings, consistency }) => {
        const carbItems = items.map(([p, carbsG]) => ({
          ref: p.ref,
          carbsG: carbsG + 1,
          grams: (carbsG + 1) / p.carbsPerGram,
          osmPerG: p.osmPerG,
          waterFraction: Math.max(0.01, Math.min(0.95, 1 - p.carbsPerGram)),
        }));
        fc.pre(carbItems.length > 0);
        const batch = gelBatch({ carbItems, saltItems: salts, servings, consistency });
        expect(batch.osmolality.waterG).toBeGreaterThan(0);
        expect(Number.isFinite(batch.osmolality.mOsmPerKg)).toBe(true);
      }),
    );
  });
});

describe('drinkBottles', () => {
  /** 60 g carbs (maltodextrin 40 g + fructose 20 g), 1 g salt, 1.5 L of fluid in 750 ml bottles. */
  const defaultDrink = (extra = {}) =>
    drinkBottles({
      carbItems: [carb(MALTODEXTRIN, 40), carb(FRUCTOSE, 20)],
      saltItems: [{ ...NACL, grams: 2 }],
      totalCarbsG: 60,
      totalSodiumMg: 1000,
      totalFluidMl: 1500,
      bottleMl: 750,
      ...extra,
    });

  it('reproduces Vist & Maughan: 40 g glucose in a 1 L bottle ≈ 228 mOsm/kg', () => {
    // [vist1995] measured 230 mOsm/kg; filled to the mark: 1000 − 0.625 × 40 = 975 g of water
    const drink = drinkBottles({
      carbItems: [carb(DEXTROSE, 40)],
      totalCarbsG: 40,
      totalSodiumMg: 0,
      totalFluidMl: 1000,
      bottleMl: 1000,
    });
    expect(drink.bottles).toBe(1);
    expect(drink.perBottle.addedWaterMl).toBeCloseTo(975, 10);
    expect(Math.abs(drink.perBottle.osmolality.mOsmPerKg - 228)).toBeLessThanOrEqual(5);
    expect(drink.perBottle.carbPctWv).toBeCloseTo(4, 10);
  });

  it('gives ≈ 182 mOsm/kg for a 6% w/v sucrose drink', () => {
    // research notes C (osmo.py): 60 g sucrose made up to 1 L, water 962.5 g
    const drink = drinkBottles({ carbItems: [carb(SUCROSE, 60)], totalCarbsG: 60, totalFluidMl: 1000, bottleMl: 1000 });
    expect(drink.perBottle.addedWaterMl).toBeCloseTo(962.5, 10);
    expect(Math.abs(drink.perBottle.osmolality.mOsmPerKg - 182)).toBeLessThanOrEqual(5);
    expect(drink.perBottle.osmolality.tonicity).toBe('hypotonic');
  });

  it('counts the water in syrups toward filling the bottle', () => {
    // 40 g honey: 33.2 g solids, 6.8 g water; 500 − 0.625 × 33.2 − 6.8 = 472.45 ml added
    const drink = drinkBottles({ carbItems: [{ ...HONEY, carbsG: 32.8, grams: 40 }], totalCarbsG: 32.8, totalFluidMl: 500, bottleMl: 500 });
    expect(drink.perBottle.addedWaterMl).toBeCloseTo(472.45, 10);
    expect(drink.perBottle.osmolality.waterG).toBeCloseTo(479.25, 10);
    expect(drink.perBottle.osmolality.mOsmPerKg).toBeCloseTo((1000 * 40 * 4.5) / 479.25, 10);
  });

  it('splits the totals over the bottles', () => {
    const drink = defaultDrink();
    expect(drink.bottles).toBe(2);
    expect(drink.bottleMl).toBe(750);
    expect(drink.perBottle.carbsG).toBe(30);
    expect(drink.perBottle.sodiumMg).toBe(500);
    expect(drink.perBottle.carbPctWv).toBeCloseTo(4, 10);
    expect(drink.perBottle.sodiumMgPerL).toBeCloseTo(666.67, 1);
    // per bottle: 21.05 g maltodextrin (20 g dry, 1.05 g water), 10 g fructose, 1 g NaCl
    const solids = 20 + 10 + 1;
    expect(drink.perBottle.addedWaterMl).toBeCloseTo(750 - 0.625 * solids - 20 * 0.05 / 0.95, 10);
    expect(drink.perBottle.osmolality.waterG).toBeCloseTo(750 - 0.625 * solids, 10);
    expect(drink.perBottle.osmolality.mOsmPerKg).toBeCloseTo((1000 * (20 + 55.5 + 31.8)) / (750 - 0.625 * solids), 10);
    expect(drink.warnings).toEqual([]);
  });

  it('rounds the bottle count up and uses at least one bottle', () => {
    expect(defaultDrink({ totalFluidMl: 100 }).bottles).toBe(1);
    expect(defaultDrink({ totalFluidMl: 750 }).bottles).toBe(1);
    expect(defaultDrink({ totalFluidMl: 751 }).bottles).toBe(2);
    expect(defaultDrink({ totalFluidMl: 1600 }).bottles).toBe(3);
    expect(defaultDrink({ totalFluidMl: 0.1 + 0.2 + 1499.7 }).bottles).toBe(2);
    expect(defaultDrink({ totalFluidMl: 2400, bottleMl: 500 }).bottles).toBe(5);
  });

  it('fills each bottle with an equal share of the fluid, so the plan delivers all its carbs and sodium', () => {
    // 1650 ml in 750 ml bottles: 3 bottles of 550 ml. Drinking the plan's 1650 ml finishes them all.
    const drink = defaultDrink({ totalFluidMl: 1650 });
    expect(drink.bottles).toBe(3);
    expect(drink.bottleMl).toBe(750);
    expect(drink.perBottle.fillMl).toBeCloseTo(550, 10);
    expect(drink.perBottle.carbsG * drink.bottles).toBeCloseTo(60, 10);
    expect(drink.perBottle.sodiumMg * drink.bottles).toBeCloseTo(1000, 10);
    // the strength is the plan's carbs and sodium per litre of fluid
    expect(drink.perBottle.carbPctWv).toBeCloseTo((60 / 1650) * 100, 10);
    expect(drink.perBottle.sodiumMgPerL).toBeCloseTo(1000 / 1.65, 10);
    // per bottle: 20 g maltodextrin (dry) + 6.67 g fructose + 0.67 g NaCl, filled to 550 ml
    const solids = (40 + 20 + 2) / 3;
    const maltoWater = ((40 / 0.95) * 0.05) / 3;
    expect(drink.perBottle.addedWaterMl).toBeCloseTo(550 - 0.625 * solids - maltoWater, 10);
    // 300 ml of fluid: one bottle with 300 ml in it, not a full 750 ml bottle
    const small = defaultDrink({ totalFluidMl: 300 });
    expect(small.bottles).toBe(1);
    expect(small.perBottle.fillMl).toBe(300);
    expect(small.perBottle.carbPctWv).toBeCloseTo(20, 10);
    // a multiple of the bottle size fills each bottle to the mark
    expect(defaultDrink().perBottle.fillMl).toBe(750);
    // float noise above a multiple never overfills the bottle
    expect(defaultDrink({ totalFluidMl: 1500.0000000002 }).perBottle.fillMl).toBe(750);
  });

  it('describes the same drink whatever the bottle size', () => {
    // 180 g carbs (maltodextrin 120 g + fructose 60 g), 2.54 g NaCl = 1000 mg sodium, 1000 ml of fluid
    const plan = (bottleMl) =>
      drinkBottles({
        carbItems: [carb(MALTODEXTRIN, 120), carb(FRUCTOSE, 60)],
        saltItems: [{ ...NACL, grams: 2.54 }],
        totalCarbsG: 180,
        totalSodiumMg: 1000,
        totalFluidMl: 1000,
        bottleMl,
      });
    const twoSmall = plan(750);
    const oneLarge = plan(1000);
    expect(twoSmall.bottles).toBe(2);
    expect(twoSmall.perBottle.fillMl).toBe(500);
    expect(oneLarge.bottles).toBe(1);
    for (const drink of [twoSmall, oneLarge]) {
      expect(drink.perBottle.carbPctWv).toBeCloseTo(18, 10);
      expect(drink.perBottle.sodiumMgPerL).toBeCloseTo(1000, 10);
      // 18% w/v and ≈ 603 mOsm/kg either way; 1000 mg/L sodium is inside the EFSA range
      expect(ids(drink)).toEqual(['concentration.drinkTooStrong', 'concentration.veryHypertonic']);
    }
    expect(twoSmall.perBottle.osmolality.mOsmPerKg).toBeCloseTo(oneLarge.perBottle.osmolality.mOsmPerKg, 9);
  });

  it('says when the powders and syrups do not fit in the fluid of a bottle', () => {
    // 1300 g dextrose in 500 ml: 0.625 × 1300 = 812.5 ml of solids, more than the 500 ml fill
    const dry = drinkBottles({ carbItems: [carb(DEXTROSE, 1300)], totalCarbsG: 1300, totalSodiumMg: 500, totalFluidMl: 500, bottleMl: 750 });
    expect(dry.bottles).toBe(1);
    expect(dry.perBottle.addedWaterMl).toBe(0);
    expect(dry.perBottle.osmolality.mOsmPerKg).toBe(Infinity);
    expect(dry.warnings).toEqual([
      {
        id: 'concentration.drinkDoesNotFit',
        level: 'warning',
        message: { key: 'concentration.warn.drinkDoesNotFit', params: { ingredientsMl: 813, fillMl: 500 } },
      },
    ]);
    // syrups bring their own water: 300 g honey = 249 g solids (155.6 ml) + 51 g water, more than 200 ml
    const syrup = drinkBottles({ carbItems: [{ ...HONEY, carbsG: 246, grams: 300 }], totalCarbsG: 246, totalFluidMl: 200, bottleMl: 500 });
    expect(Number.isFinite(syrup.perBottle.osmolality.mOsmPerKg)).toBe(true);
    expect(syrup.warnings).toEqual([
      {
        id: 'concentration.drinkDoesNotFit',
        level: 'warning',
        message: { key: 'concentration.warn.drinkDoesNotFit', params: { ingredientsMl: 207, fillMl: 200 } },
      },
    ]);
    // ingredients that take up exactly the fill leave no water: still does not fit
    const exact = drinkBottles({ carbItems: [carb(DEXTROSE, 800)], totalCarbsG: 800, totalFluidMl: 500, bottleMl: 500 });
    expect(ids(exact)).toEqual(['concentration.drinkDoesNotFit']);
    // just below the fill there is water and the usual warnings, with finite numbers
    const tight = drinkBottles({ carbItems: [carb(DEXTROSE, 790)], totalCarbsG: 790, totalSodiumMg: 500, totalFluidMl: 500, bottleMl: 500 });
    expect(ids(tight)).toEqual(['concentration.drinkTooStrong', 'concentration.veryHypertonic']);
    expect(Number.isFinite(tight.warnings[1].message.params.mOsm)).toBe(true);
  });

  it('uses a 750 ml bottle when the size is missing or not above 0', () => {
    for (const bottleMl of [undefined, 0, -500, NaN, Infinity, '500']) {
      const drink = defaultDrink({ bottleMl });
      expect(drink.bottleMl).toBe(DEFAULT_BOTTLE_ML);
      expect(drink.bottles).toBe(2);
    }
  });

  it('has no bottles and warns when the plan has no fluid', () => {
    // Under half a millilitre shows as 0 ml and would overflow the per-litre values (1000 mg in 1e-306 ml).
    for (const totalFluidMl of [0, -100, NaN, undefined, 5e-324, 4.2e-320, 1e-306, 0.4999]) {
      const drink = defaultDrink({ totalFluidMl });
      expect(drink.bottles).toBe(0);
      expect(drink.perBottle).toEqual({
        carbsG: 0,
        sodiumMg: 0,
        carbPctWv: 0,
        sodiumMgPerL: 0,
        osmolality: { mOsmPerKg: 0, waterG: 0, tonicity: 'hypotonic' },
        addedWaterMl: 0,
        fillMl: 0,
      });
      expect(drink.warnings).toEqual([
        { id: 'concentration.noFluidForDrink', level: 'warning', message: { key: 'concentration.warn.noFluidForDrink' } },
      ]);
    }
    expect(drinkBottles().bottles).toBe(0);
    expect(drinkBottles(null).warnings.map((w) => w.id)).toEqual(['concentration.noFluidForDrink']);
  });

  it('makes a drink from half a millilitre of fluid on, with finite values', () => {
    expect(MIN_DRINK_FLUID_ML).toBe(0.5);
    const drink = defaultDrink({ totalFluidMl: MIN_DRINK_FLUID_ML });
    expect(drink.bottles).toBe(1);
    expect(drink.perBottle.fillMl).toBe(0.5);
    // 1000 mg of sodium in 0.5 ml: 2,000,000 mg/L, and the powders do not fit
    expect(drink.perBottle.sodiumMgPerL).toBeCloseTo(2e6, 6);
    for (const value of Object.values(drink.perBottle).filter((v) => typeof v === 'number')) expect(Number.isFinite(value)).toBe(true);
    expect(drink.warnings.map((w) => w.id)).toEqual(['concentration.drinkDoesNotFit']);
  });

  /** A drink of HBCD only (near-zero osmolality) so the strength warnings can be tested alone. */
  const hbcdDrink = (carbsG) =>
    drinkBottles({ carbItems: [carb(HBCD, carbsG)], totalCarbsG: carbsG, totalSodiumMg: 500, totalFluidMl: 1000, bottleMl: 1000 });

  it('flags drinks above 8% w/v as strong and above 12% as too strong', () => {
    // research notes D: 4–8% default, up to 10–12% with glucose+fructose
    expect(ids(hbcdDrink(80))).toEqual([]);
    expect(ids(hbcdDrink(80.4))).toEqual([]);
    expect(hbcdDrink(81).warnings).toEqual([
      {
        id: 'concentration.drinkStrong',
        level: 'info',
        message: { key: 'concentration.warn.drinkStrong', params: { pct: 8.1, limitPct: 8 } },
        citations: ['vist1995', 'shi1995'],
      },
    ]);
    expect(ids(hbcdDrink(120))).toEqual(['concentration.drinkStrong']);
    expect(hbcdDrink(121).warnings).toEqual([
      {
        id: 'concentration.drinkTooStrong',
        level: 'warning',
        message: { key: 'concentration.warn.drinkTooStrong', params: { pct: 12.1, limitPct: 12 } },
        citations: ['vist1995', 'shi1995'],
      },
    ]);
  });

  /** Fructose-only bottle of 1 L with 500 mg sodium, osmolality ≈ 5.55 × g / water. */
  const fructoseDrink = (carbsG) =>
    drinkBottles({ carbItems: [carb(FRUCTOSE, carbsG)], totalCarbsG: carbsG, totalSodiumMg: 500, totalFluidMl: 1000, bottleMl: 1000 });

  it('flags hypertonic and very hypertonic drinks', () => {
    // [vist1995] [shi1995] hypertonic drinks slow gastric emptying and water absorption
    const iso = fructoseDrink(55); // 55 × 5.55 / 965.6 ≈ 316
    expect(iso.perBottle.osmolality.tonicity).toBe('isotonic');
    expect(ids(iso)).toEqual([]);
    const hyper = fructoseDrink(70); // ≈ 395
    expect(hyper.perBottle.osmolality.tonicity).toBe('hypertonic');
    expect(hyper.warnings).toEqual([
      {
        id: 'concentration.hypertonic',
        level: 'info',
        message: {
          key: 'concentration.warn.hypertonic',
          params: { mOsm: Math.round(hyper.perBottle.osmolality.mOsmPerKg), limit: 330 },
        },
        citations: ['vist1995', 'shi1995'],
      },
    ]);
    const very = fructoseDrink(110); // ≈ 652, 11% w/v
    expect(very.perBottle.osmolality.mOsmPerKg).toBeGreaterThanOrEqual(600);
    expect(ids(very)).toEqual(['concentration.drinkStrong', 'concentration.veryHypertonic']);
    expect(very.warnings[1].level).toBe('warning');
    expect(very.warnings[1].message.params.limit).toBe(600);
  });

  it('switches the osmolality messages at 330 and 600 mOsm/kg as shown (boundary)', () => {
    // 40 g of a dry custom carb in a 1 L bottle: 975 g of water, so osmolality = 40000 × osmPerG / 975;
    // 4% w/v and 700 mg/L sodium keep the other checks quiet
    const drinkAt = (mOsm) =>
      drinkBottles({
        carbItems: [{ ref: 'c1', carbsG: 40, grams: 40, osmPerG: (mOsm * 975) / 40000, waterFraction: 0 }],
        totalCarbsG: 40,
        totalSodiumMg: 700,
        totalFluidMl: 1000,
        bottleMl: 1000,
      });
    expect(drinkAt(330).perBottle.osmolality.mOsmPerKg).toBeCloseTo(330, 9);
    expect(ids(drinkAt(330))).toEqual([]);
    expect(ids(drinkAt(330.4))).toEqual([]); // shown as 330
    expect(drinkAt(330.6).warnings.map((w) => [w.id, w.message.params.mOsm])).toEqual([['concentration.hypertonic', 331]]);
    expect(ids(drinkAt(331))).toEqual(['concentration.hypertonic']);
    expect(ids(drinkAt(599))).toEqual(['concentration.hypertonic']);
    expect(ids(drinkAt(599.4))).toEqual(['concentration.hypertonic']); // shown as 599
    expect(drinkAt(599.6).warnings.map((w) => [w.id, w.message.params.mOsm])).toEqual([['concentration.veryHypertonic', 600]]);
    expect(ids(drinkAt(600))).toEqual(['concentration.veryHypertonic']);
    // From 1000 mOsm/kg the message states the value rounded to 100, as the recipe chip shows it.
    expect(drinkAt(4237).warnings.find((w) => w.id === 'concentration.veryHypertonic').message.params.mOsm).toBe(4200);
  });

  it('rounds an osmolality the way every view shows it', () => {
    expect(roundOsmolality(527.4)).toBe(527);
    expect(roundOsmolality(999.4)).toBe(999);
    expect(roundOsmolality(999.6)).toBe(1000);
    expect(roundOsmolality(4237)).toBe(4200);
    expect(roundOsmolality(4250)).toBe(4300);
    expect(roundOsmolality(Infinity)).toBe(Infinity);
    expect(roundOsmolality(NaN)).toBe(0);
    expect(roundOsmolality(-5)).toBe(0);
  });

  it('measures the volume ingredients take up in a bottle: 0.625 ml per g of solids plus their water', () => {
    // 60 g sucrose: 0.625 × 60 = 37.5 ml (Vist & Maughan style: 1000 − 37.5 = 962.5 ml of water)
    expect(ingredientVolumeMl([{ grams: 60, waterFraction: 0 }])).toBeCloseTo(37.5, 12);
    // 100 g glucose syrup with 20 % water: 0.625 × 80 + 20 = 70 ml
    expect(ingredientVolumeMl([{ grams: 100, waterFraction: 0.2 }, null, { grams: -3 }])).toBeCloseTo(70, 12);
    expect(ingredientVolumeMl(undefined)).toBe(0);
  });

  it('checks the sodium of an electrolyte-only bottle', () => {
    // 'both' mode with no carbs in the drink: 0.76 g NaCl = 300 mg sodium in 1 L
    const drink = drinkBottles({ carbItems: [], saltItems: [{ ...NACL, grams: 0.76 }], totalCarbsG: 0, totalSodiumMg: 300, totalFluidMl: 1000, bottleMl: 1000 });
    expect(drink.perBottle.osmolality.tonicity).toBe('hypotonic');
    expect(drink.warnings).toEqual([
      {
        id: 'concentration.sodiumOutsideEfsa',
        level: 'info',
        message: { key: 'concentration.warn.sodiumBelowEfsa', params: { mgPerL: 300, lo: 460, hi: 1150 } },
        citations: ['efsa2011'],
      },
    ]);
    // sodium but no listed salt items still counts as a drink, not plain water
    const sodiumOnly = drinkBottles({ totalCarbsG: 0, totalSodiumMg: 300, totalFluidMl: 1000, bottleMl: 1000 });
    expect(ids(sodiumOnly)).toEqual(['concentration.sodiumOutsideEfsa']);
    // a carb-free, sodium-free bottle with another salt (KCl) is below the range too
    const potassium = drinkBottles({ saltItems: [{ grams: 1, osmPerG: 24.7 }], totalCarbsG: 0, totalSodiumMg: 0, totalFluidMl: 1000, bottleMl: 1000 });
    expect(ids(potassium)).toEqual(['concentration.sodiumOutsideEfsa']);
  });

  it('flags sodium outside the EFSA range of 460–1150 mg/L', () => {
    // [efsa2011] 20–50 mmol/L for carbohydrate-electrolyte solutions
    const withSodium = (totalSodiumMg) =>
      drinkBottles({ carbItems: [carb(HBCD, 40)], totalCarbsG: 40, totalSodiumMg, totalFluidMl: 1000, bottleMl: 1000 });
    expect(ids(withSodium(460))).toEqual([]);
    expect(ids(withSodium(1150))).toEqual([]);
    expect(ids(withSodium(459.6))).toEqual([]); // shown as 460 mg/L
    expect(withSodium(300).warnings).toEqual([
      {
        id: 'concentration.sodiumOutsideEfsa',
        level: 'info',
        message: { key: 'concentration.warn.sodiumBelowEfsa', params: { mgPerL: 300, lo: 460, hi: 1150 } },
        citations: ['efsa2011'],
      },
    ]);
    expect(withSodium(0).warnings[0].message.key).toBe('concentration.warn.sodiumBelowEfsa');
    expect(withSodium(1200).warnings[0].message).toEqual({
      key: 'concentration.warn.sodiumAboveEfsa',
      params: { mgPerL: 1200, lo: 460, hi: 1150 },
    });
    // per litre, not per bottle: 400 mg in a 500 ml bottle is 800 mg/L
    const half = drinkBottles({ carbItems: [carb(HBCD, 20)], totalCarbsG: 20, totalSodiumMg: 400, totalFluidMl: 500, bottleMl: 500 });
    expect(half.perBottle.sodiumMgPerL).toBe(800);
    expect(ids(half)).toEqual([]);
  });

  it('gives a bottle of plain water no composition warnings', () => {
    const water = drinkBottles({ carbItems: [], saltItems: [], totalCarbsG: 0, totalSodiumMg: 0, totalFluidMl: 1000, bottleMl: 500 });
    expect(water.bottles).toBe(2);
    expect(water.perBottle.addedWaterMl).toBe(500);
    expect(water.warnings).toEqual([]);
  });

  it('takes the carb total from the items when totalCarbsG is missing', () => {
    expect(defaultDrink({ totalCarbsG: undefined }).perBottle.carbsG).toBe(30);
    expect(defaultDrink({ totalCarbsG: -5 }).perBottle.carbsG).toBe(0);
  });

  it('does not mutate its input and is deterministic', () => {
    const input = deepFreeze({
      carbItems: [carb(MALTODEXTRIN, 40), carb(FRUCTOSE, 20)],
      saltItems: [{ ...NACL, grams: 2 }],
      totalCarbsG: 60,
      totalSodiumMg: 1000,
      totalFluidMl: 2000,
      bottleMl: 500,
    });
    expect(drinkBottles(input)).toEqual(drinkBottles(input));
  });

  it('holds exactly the plan fluid, keeps messages finite and the osmolality finite when the drink fits (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.constantFrom(DEXTROSE, MALTODEXTRIN, FRUCTOSE, HONEY, MAPLE, SUCROSE), fc.double({ min: 0, max: 150, noNaN: true })), { maxLength: 6 }),
        fc.double({ min: 0, max: 10, noNaN: true }),
        fc.double({ min: 0, max: 5000, noNaN: true }),
        fc.double({ min: 1, max: 8000, noNaN: true }),
        fc.integer({ min: 250, max: 1500 }),
        (items, saltG, totalSodiumMg, totalFluidMl, bottleMl) => {
          const carbItems = items.map(([profile, carbsG]) => carb(profile, carbsG));
          const totalCarbsG = carbItems.reduce((s, c) => s + c.carbsG, 0);
          const drink = drinkBottles({ carbItems, saltItems: [{ ...NACL, grams: saltG }], totalCarbsG, totalSodiumMg, totalFluidMl, bottleMl });
          expect(Number.isInteger(drink.bottles)).toBe(true);
          expect(drink.bottles).toBeGreaterThanOrEqual(1);
          expect(drink.bottles * bottleMl).toBeGreaterThanOrEqual(totalFluidMl - 1e-6);
          expect((drink.bottles - 1) * bottleMl).toBeLessThan(totalFluidMl);
          for (const value of Object.values(drink.perBottle).filter((v) => typeof v === 'number')) {
            expect(Number.isFinite(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
          }
          // equal bottles that hold the plan's fluid: drinking it delivers every gram and mg
          const { fillMl } = drink.perBottle;
          expect(fillMl).toBeLessThanOrEqual(bottleMl);
          expect(Math.abs(fillMl * drink.bottles - totalFluidMl)).toBeLessThan(1e-6 * Math.max(1, totalFluidMl));
          expect(drink.perBottle.carbsG * drink.bottles).toBeCloseTo(totalCarbsG, 6);
          expect(drink.perBottle.sodiumMg * drink.bottles).toBeCloseTo(totalSodiumMg, 6);
          expect(drink.perBottle.carbPctWv).toBeCloseTo((100 * totalCarbsG) / totalFluidMl, 6);
          expect(drink.perBottle.osmolality.mOsmPerKg).toBeGreaterThanOrEqual(0);
          const doesNotFit = ids(drink).includes('concentration.drinkDoesNotFit');
          if (doesNotFit) expect(ids(drink)).toEqual(['concentration.drinkDoesNotFit']);
          else expect(Number.isFinite(drink.perBottle.osmolality.mOsmPerKg)).toBe(true);
          for (const w of drink.warnings) {
            expect(['info', 'warning']).toContain(w.level);
            for (const param of Object.values(w.message.params ?? {})) expect(Number.isFinite(param)).toBe(true);
          }
        },
      ),
    );
  });
});

describe('i18n catalog (src/i18n/en/concentration.js)', () => {
  const samples = [
    gelBatch({ carbItems: [carb(MAPLE, 30)], totalCarbsG: 30, servings: 1, consistency: 'thick' }),
    gelBatch({ carbItems: [carb(DEXTROSE, 30)], totalCarbsG: 30, servings: 2 }),
    drinkBottles({ totalFluidMl: 0 }),
    drinkBottles({ carbItems: [carb(HBCD, 90)], totalCarbsG: 90, totalSodiumMg: 300, totalFluidMl: 1000, bottleMl: 1000 }),
    drinkBottles({ carbItems: [carb(HBCD, 130)], totalCarbsG: 130, totalSodiumMg: 1500, totalFluidMl: 1000, bottleMl: 1000 }),
    drinkBottles({ carbItems: [carb(FRUCTOSE, 70)], totalCarbsG: 70, totalSodiumMg: 500, totalFluidMl: 1000, bottleMl: 1000 }),
    drinkBottles({ carbItems: [carb(FRUCTOSE, 110)], totalCarbsG: 110, totalSodiumMg: 500, totalFluidMl: 1000, bottleMl: 1000 }),
    drinkBottles({ carbItems: [carb(DEXTROSE, 1300)], totalCarbsG: 1300, totalSodiumMg: 500, totalFluidMl: 500, bottleMl: 750 }),
  ];
  const warnings = samples.flatMap((s) => s.warnings);

  it('has text for every message key the module returns', () => {
    const keys = new Set(warnings.map((w) => w.message.key));
    expect([...keys].sort()).toEqual([
      'concentration.warn.crystallise',
      'concentration.warn.drinkDoesNotFit',
      'concentration.warn.drinkStrong',
      'concentration.warn.drinkTooStrong',
      'concentration.warn.gelTakeWithWater',
      'concentration.warn.hypertonic',
      'concentration.warn.noFluidForDrink',
      'concentration.warn.sodiumAboveEfsa',
      'concentration.warn.sodiumBelowEfsa',
      'concentration.warn.syrupsThinner',
      'concentration.warn.veryHypertonic',
    ]);
    for (const key of keys) expect(typeof catalog[key], key).toBe('string');
  });

  it('only uses placeholders the module provides as params', () => {
    for (const { message } of warnings) {
      for (const name of placeholders(catalog[message.key])) {
        expect(message.params ?? {}, `${message.key} {${name}}`).toHaveProperty([name]);
      }
    }
  });

  it('cites only ids in the citation registry', () => {
    for (const w of warnings) for (const id of w.citations ?? []) expect(CITATIONS[id], id).toBeDefined();
  });

  it('has a label for every tonicity band and consistency preset', () => {
    for (const band of ['hypotonic', 'isotonic', 'hypertonic']) {
      expect(typeof catalog[`concentration.tonicity.${band}`]).toBe('string');
    }
    for (const preset of Object.keys(GEL_CONSISTENCY_PCT)) {
      expect(typeof catalog[`concentration.consistency.${preset}`]).toBe('string');
    }
  });

  it('states the numbers as what they are', () => {
    // 330 mOsm/kg is the top of the isotonic band, not the osmolality of body fluids (~290)
    expect(catalog['concentration.warn.hypertonic']).toContain('isotonic range');
    expect(catalog['concentration.warn.hypertonic']).not.toContain('body fluids ({limit}');
    // [efsa2011] 460–1150 mg/L is the EFSA criterion for sports drinks, not what they contain
    for (const key of ['concentration.warn.sodiumBelowEfsa', 'concentration.warn.sodiumAboveEfsa']) {
      expect(catalog[key], key).toContain('EFSA range');
      expect(catalog[key], key).not.toContain('Sports drinks hold');
    }
    // research notes D: the 33% preset is only "isotonic-style" (near-isotonic with HBCD or low-DE maltodextrin)
    expect(catalog['concentration.consistency.isotonic']).toBe('Isotonic-style');
    expect(catalog['concentration.consistency.isotonicNote']).toMatch(/HBCD/);
    // with the default 2:1 maltodextrin:fructose mix a 33% gel is hypertonic
    const defaultMix = gelBatch({ carbItems: [carb(MALTODEXTRIN, 20), carb(FRUCTOSE, 10)], totalCarbsG: 30, servings: 1, consistency: 'isotonic' });
    expect(defaultMix.osmolality.tonicity).toBe('hypertonic');
  });

  it('keeps every key in the concentration namespace and uses no em-dashes', () => {
    for (const [key, text] of Object.entries(catalog)) {
      expect(key.startsWith('concentration.')).toBe(true);
      expect(text, key).not.toContain('—');
    }
  });
});
