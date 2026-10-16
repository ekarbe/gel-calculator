import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ingredientProfile, feasibleShareRange, solveIngredients, solverInternals } from './solver';
import { formatRatio } from './carbs';
import catalog from '../i18n/en/carbs';

const SHARE_2_TO_1 = 1 / 3;
const ids = (warnings) => warnings.map((w) => w.id);
const sum = (xs) => xs.reduce((acc, x) => acc + x, 0);
const itemFor = (solution, ref) => solution.items.find((item) => item.ref === ref);
const shareText = (share) => formatRatio({ glucose: 1 - share, fructose: share });

/**
 * Brute force reference for the projection problem: the best strictly feasible
 * equality-constrained solution over every support set. Shares are measured
 * from the first share of the support so near-equal shares do not cancel.
 * A support whose solution has a negative amount beyond rounding is rejected;
 * the clipped candidate must meet Σc = T and the share to 1e-9.
 */
const bruteForceObjective = (q, f, T, s) => {
  const n = q.length;
  const scale = Math.max(1, T);
  let best = Infinity;
  for (let mask = 1; mask < 1 << n; mask++) {
    const S = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) S.push(i);
    const k = S.length;
    const f0 = f[S[0]];
    const g = f.map((x) => x - f0);
    const sq = sum(S.map((i) => q[i]));
    const sg = sum(S.map((i) => g[i]));
    const sgg = sum(S.map((i) => g[i] * g[i]));
    const sqg = sum(S.map((i) => q[i] * g[i]));
    const c = new Array(n).fill(0);
    if (Math.max(...S.map((i) => f[i])) - Math.min(...S.map((i) => f[i])) <= 1e-9) {
      if (Math.abs(f0 - s) > 1e-9) continue;
      for (const i of S) c[i] = q[i] + (T - sq) / k;
    } else {
      const det = k * sgg - sg * sg;
      const r1 = T - sq;
      const r2 = (s - f0) * T - sqg;
      const lambda = (r1 * sgg - r2 * sg) / det;
      const mu = (k * r2 - sg * r1) / det;
      for (const i of S) c[i] = q[i] + lambda + mu * g[i];
    }
    if (c.some((x) => x < -1e-12 * scale)) continue;
    const clipped = c.map((x) => Math.max(0, x));
    if (Math.abs(sum(clipped) - T) > 1e-9 * scale) continue;
    if (Math.abs(sum(clipped.map((x, i) => x * f[i])) / T - s) > 1e-9) continue;
    best = Math.min(best, sum(clipped.map((x, i) => (x - q[i]) ** 2)));
  }
  return best;
};

// Literal profiles so the solver tests do not depend on the data table.
const profile = (ref, fructoseShare, carbsPerGram = 1) => ({
  ref, label: String(ref), carbsPerGram, fructoseShare, osmPerG: 5.55, waterFraction: 0, custom: false,
});

describe('ingredientProfile', () => {
  it('reads built-in sources from the data table', () => {
    const malto = ingredientProfile(3);
    expect(malto).toEqual({
      ref: 3,
      label: 'Maltodextrin',
      carbsPerGram: 0.95,
      fructoseShare: 0,
      osmPerG: 0.95,
      waterFraction: 0.05,
      custom: false,
    });
    const honey = ingredientProfile(14);
    expect(honey.fructoseShare).toBe(0.5);
    expect(honey.waterFraction).toBe(0.17);
    expect(honey.custom).toBe(false);
  });

  it('returns null for salts, unknown ids, unknown custom keys and other values', () => {
    expect(ingredientProfile(31)).toBeNull();
    expect(ingredientProfile(999)).toBeNull();
    expect(ingredientProfile('c1')).toBeNull();
    expect(ingredientProfile('c1', [{ key: 'c2', name: 'x', carbsPer100g: 50, fructoseSharePct: 0 }])).toBeNull();
    expect(ingredientProfile('c1', null)).toBeNull();
    expect(ingredientProfile(undefined)).toBeNull();
    expect(ingredientProfile(null, [null])).toBeNull();
    expect(ingredientProfile('3')).toBeNull();
  });

  it('derives a custom ingredient from its label values', () => {
    const custom = [{ key: 'c1', name: '  My syrup ', carbsPer100g: 70, fructoseSharePct: 40 }];
    const p = ingredientProfile('c1', custom);
    expect(p.ref).toBe('c1');
    expect(p.label).toBe('My syrup');
    expect(p.custom).toBe(true);
    expect(p.carbsPerGram).toBeCloseTo(0.7, 12);
    expect(p.fructoseShare).toBeCloseTo(0.4, 12);
    // waterPct missing → 100 − carbsPer100g
    expect(p.waterFraction).toBeCloseTo(0.3, 12);
    // treated as simple sugars: 5.55 mOsm per gram of carbs
    expect(p.osmPerG).toBeCloseTo(0.7 * 5.55, 12);
  });

  it('uses waterPct when given and clamps the water fraction to [0, min(0.95, 1 − carbsPerGram)]', () => {
    const make = (extra, carbsPer100g = 60) =>
      ingredientProfile('c1', [{ key: 'c1', name: 'x', carbsPer100g, fructoseSharePct: 0, ...extra }]);
    expect(make({ waterPct: 10 }).waterFraction).toBeCloseTo(0.1, 12);
    expect(make({ waterPct: 0 }).waterFraction).toBe(0);
    expect(make({ waterPct: -5 }).waterFraction).toBe(0);
    expect(make({ waterPct: NaN }).waterFraction).toBeCloseTo(0.4, 12);
    // Carbs and water cannot exceed the mass: an inconsistent label trusts the carbs.
    expect(make({ waterPct: 99 }).waterFraction).toBeCloseTo(0.4, 12);
    expect(make({ waterPct: 50 }, 90).waterFraction).toBeCloseTo(0.1, 12);
    expect(make({ waterPct: 20 }, 100).waterFraction).toBe(0);
    // The 0.95 cap still applies to nearly carb-free ingredients.
    expect(make({ waterPct: 99 }, 2).waterFraction).toBe(0.95);
    expect(make({}, 2).waterFraction).toBe(0.95);
  });

  it('never gives a custom ingredient more carbs plus water than its mass', () => {
    const pct = fc.oneof(fc.integer({ min: -10, max: 110 }), fc.double({ min: -10, max: 110, noNaN: true }));
    fc.assert(
      fc.property(pct, fc.option(pct, { nil: undefined }), (carbsPer100g, waterPct) => {
        const p = ingredientProfile('c1', [{ key: 'c1', name: 'x', carbsPer100g, fructoseSharePct: 0, waterPct }]);
        expect(p.waterFraction).toBeGreaterThanOrEqual(0);
        expect(p.waterFraction).toBeLessThanOrEqual(0.95);
        expect(p.carbsPerGram + p.waterFraction).toBeLessThanOrEqual(1 + 1e-12);
      }),
      { numRuns: 500 },
    );
  });

  it('rounds a custom fructose share to 6 decimals (0.0001 percentage points)', () => {
    const share = (fructoseSharePct) =>
      ingredientProfile('c1', [{ key: 'c1', name: 'x', carbsPer100g: 70, fructoseSharePct }]).fructoseShare;
    expect(share(50.0000002)).toBe(0.5);
    expect(share(33.33333333)).toBe(0.333333);
    expect(share(12.34567)).toBe(0.123457);
    expect(share(1e-7)).toBe(0);
    expect(share(33.3)).toBe(0.333);
    expect(share(100)).toBe(1);
  });

  it('clamps and sanitises custom percentages and falls back to the key for an empty name', () => {
    const p = ingredientProfile('c3', [{ key: 'c3', name: '  ', carbsPer100g: 150, fructoseSharePct: -20 }]);
    expect(p.label).toBe('c3');
    expect(p.carbsPerGram).toBe(1);
    expect(p.fructoseShare).toBe(0);
    expect(p.waterFraction).toBe(0);
    const q = ingredientProfile('c4', [{ key: 'c4', carbsPer100g: 'a lot', fructoseSharePct: 250 }]);
    expect(q.carbsPerGram).toBe(0);
    expect(q.fructoseShare).toBe(1);
    expect(q.osmPerG).toBe(0);
    expect(q.label).toBe('c4');
  });
});

describe('feasibleShareRange', () => {
  it('spans the lowest to the highest fructose share', () => {
    expect(feasibleShareRange([profile(1, 0), profile(2, 1), profile(3, 0.5)])).toEqual([0, 1]);
    expect(feasibleShareRange([profile(1, 0.5), profile(2, 0.82)])).toEqual([0.5, 0.82]);
    expect(feasibleShareRange([profile(1, 0.5)])).toEqual([0.5, 0.5]);
  });

  it('ignores profiles without carbs and returns null when none supply any', () => {
    expect(feasibleShareRange([profile(1, 0, 0), profile(2, 1)])).toEqual([1, 1]);
    expect(feasibleShareRange([profile(1, 0, 1e-9), profile(2, 1)])).toEqual([1, 1]);
    expect(feasibleShareRange([null, profile(1, 0.3, 0)])).toBeNull();
    expect(feasibleShareRange([])).toBeNull();
    expect(feasibleShareRange(undefined)).toBeNull();
  });

  it('works on built-in and custom profiles', () => {
    const custom = [{ key: 'c1', name: 'Agave blend', carbsPer100g: 75, fructoseSharePct: 70 }];
    expect(feasibleShareRange([ingredientProfile(3), ingredientProfile('c1', custom)])).toEqual([0, 0.7]);
  });
});

describe('solveIngredients', () => {
  // Phase 1 golden plan: 225 g at 1:0.5 from maltodextrin and fructose is 150 g + 75 g
  // carbs (158 g maltodextrin powder at 0.95 g carbs/g). [jeukendrup2014]
  it('makes the default 1:0.5 mix from maltodextrin and fructose', () => {
    const r = solveIngredients({
      totalCarbsG: 225,
      targetShare: SHARE_2_TO_1,
      allowedShare: [SHARE_2_TO_1, 0.5],
      ingredients: [{ ref: 3, weight: 67 }, { ref: 11, weight: 33 }],
    });
    expect(r.warnings).toEqual([]);
    expect(r.adjusted).toBe(false);
    expect(r.feasibleRange).toEqual([0, 1]);
    expect(r.usedShare).toBe(SHARE_2_TO_1);
    expect(r.targetShare).toBe(SHARE_2_TO_1);
    expect(r.achievedShare).toBeCloseTo(SHARE_2_TO_1, 12);
    expect(r.items.map((i) => i.ref)).toEqual([3, 11]);
    const malto = itemFor(r, 3);
    expect(malto.label).toBe('Maltodextrin');
    expect(malto.carbsG).toBeCloseTo(150, 9);
    expect(malto.grams).toBeCloseTo(150 / 0.95, 9);
    expect(Math.round(malto.grams)).toBe(158);
    expect(malto.glucoseG).toBeCloseTo(150, 9);
    expect(malto.fructoseG).toBe(0);
    const fructose = itemFor(r, 11);
    expect(fructose.carbsG).toBeCloseTo(75, 9);
    expect(fructose.grams).toBeCloseTo(75, 9);
    expect(fructose.fructoseG).toBeCloseTo(75, 9);
    expect(fructose.glucoseG).toBeCloseTo(0, 9);
  });

  it('stays as close to the weights as the share allows (least squares)', () => {
    // Equal weights, f = 0, 0.5, 1, T = 90, s = 1/3: c = 30 + λ + μ(f − 0.5) with λ = 0, μ = −30.
    const r = solveIngredients({
      totalCarbsG: 90,
      targetShare: SHARE_2_TO_1,
      allowedShare: [SHARE_2_TO_1, 0.5],
      ingredients: [{ ref: 3, weight: 1 }, { ref: 18, weight: 1 }, { ref: 11, weight: 1 }],
    });
    expect(itemFor(r, 3).carbsG).toBeCloseTo(45, 9);
    expect(itemFor(r, 18).carbsG).toBeCloseTo(30, 9);
    expect(itemFor(r, 11).carbsG).toBeCloseTo(15, 9);
    expect(r.achievedShare).toBeCloseTo(SHARE_2_TO_1, 12);
  });

  it('sets a negative ingredient to 0 and re-solves (active set)', () => {
    // Sucrose preferred: the unconstrained split would need −15 g fructose. Without it,
    // maltodextrin 30 g + sucrose 60 g makes 30 g fructose = 1/3 of 90 g.
    const r = solveIngredients({
      totalCarbsG: 90,
      targetShare: SHARE_2_TO_1,
      allowedShare: [SHARE_2_TO_1, 0.5],
      ingredients: [{ ref: 3, weight: 0 }, { ref: 18, weight: 100 }, { ref: 11, weight: 0 }],
    });
    expect(r.items.map((i) => i.ref)).toEqual([3, 18]);
    expect(itemFor(r, 3).carbsG).toBeCloseTo(30, 9);
    expect(itemFor(r, 18).carbsG).toBeCloseTo(60, 9);
    expect(itemFor(r, 18).grams).toBeCloseTo(60, 9);
    expect(itemFor(r, 11)).toBeUndefined();
    expect(r.achievedShare).toBeCloseTo(SHARE_2_TO_1, 12);
  });

  it('gives a weight-0 ingredient carbs when the share needs it', () => {
    const r = solveIngredients({
      totalCarbsG: 120,
      targetShare: 0.5,
      allowedShare: [0.5, 0.5],
      ingredients: [{ ref: 3, weight: 100 }, { ref: 11, weight: 0 }],
    });
    expect(itemFor(r, 11).carbsG).toBeCloseTo(60, 9);
    expect(itemFor(r, 3).carbsG).toBeCloseTo(60, 9);
  });

  it('splits by the weights when all fructose shares are equal (share constraint dropped)', () => {
    const r = solveIngredients({
      totalCarbsG: 100,
      targetShare: 0,
      allowedShare: [0, 0.5],
      ingredients: [{ ref: 3, weight: 3 }, { ref: 1, weight: 1 }],
    });
    expect(itemFor(r, 3).carbsG).toBeCloseTo(75, 9);
    expect(itemFor(r, 1).carbsG).toBeCloseTo(25, 9);
    expect(r.warnings).toEqual([]);
  });

  it('splits equally when every weight is 0', () => {
    const r = solveIngredients({
      totalCarbsG: 90,
      targetShare: 0,
      ingredients: [{ ref: 3, weight: 0 }, { ref: 1, weight: 0 }, { ref: 5, weight: 0 }],
    });
    for (const ref of [3, 1, 5]) expect(itemFor(r, ref).carbsG).toBeCloseTo(30, 9);
  });

  it('handles equal shares in the middle of the range (degenerate free set)', () => {
    // Two 50/50 sources plus glucose and fructose; s = 0.5 is met by the 50/50 sources alone.
    const r = solveIngredients({
      totalCarbsG: 100,
      targetShare: 0.5,
      ingredients: [{ ref: 18, weight: 50 }, { ref: 14, weight: 50 }, { ref: 3, weight: 0 }, { ref: 11, weight: 0 }],
    });
    expect(itemFor(r, 18).carbsG).toBeCloseTo(50, 9);
    expect(itemFor(r, 14).carbsG).toBeCloseTo(50, 9);
    expect(r.items).toHaveLength(2);
    expect(r.achievedShare).toBeCloseTo(0.5, 12);
  });

  it('reaches the end of the range with several ingredients at that end', () => {
    // s = 1 can only come from the two fructose-only ingredients. Preferred split
    // q = 50 × (5/9, 3/9, 1/9); maltodextrin drops to 0 and the other two share the
    // rest equally: λ = (50 − 200/9) / 2 = 125/9 → 275/9 and 175/9 g.
    const custom = [{ key: 'c1', name: 'Pure fructose syrup', carbsPer100g: 80, fructoseSharePct: 100 }];
    const r = solveIngredients({
      totalCarbsG: 50,
      targetShare: 1,
      ingredients: [{ ref: 3, weight: 50 }, { ref: 11, weight: 30 }, { ref: 'c1', weight: 10 }],
      custom,
    });
    expect(itemFor(r, 3)).toBeUndefined();
    expect(itemFor(r, 11).carbsG).toBeCloseTo(275 / 9, 9);
    expect(itemFor(r, 'c1').carbsG).toBeCloseTo(175 / 9, 9);
    expect(itemFor(r, 'c1').grams).toBeCloseTo(175 / 9 / 0.8, 9);
    expect(itemFor(r, 'c1').label).toBe('Pure fructose syrup');
    expect(r.achievedShare).toBeCloseTo(1, 12);
  });

  describe('choice of share', () => {
    // [jeukendrup2014] ≤ 60 g/h: glucose alone works, so glucose-only sources need no warning.
    it('uses the allowed range without a warning when the target is out of reach', () => {
      const r = solveIngredients({
        totalCarbsG: 120,
        targetShare: SHARE_2_TO_1,
        allowedShare: [0, 0.5],
        ingredients: [{ ref: 3, weight: 100 }],
      });
      expect(r.feasibleRange).toEqual([0, 0]);
      expect(r.usedShare).toBe(0);
      expect(r.adjusted).toBe(true);
      expect(r.warnings).toEqual([]);
      expect(r.achievedShare).toBe(0);
      expect(itemFor(r, 3).carbsG).toBeCloseTo(120, 9);
    });

    it('picks the point of the allowed range closest to the target', () => {
      // Honey alone makes only 1:1; auto mode at 75 g/h allows 1:0.5 to 1:1.
      const honey = solveIngredients({
        totalCarbsG: 75,
        targetShare: SHARE_2_TO_1,
        allowedShare: [SHARE_2_TO_1, 0.5],
        ingredients: [{ ref: 14, weight: 100 }],
      });
      expect(honey.usedShare).toBe(0.5);
      expect(honey.adjusted).toBe(true);
      expect(honey.warnings).toEqual([]);
      // Agave (0.82) and HFCS (0.55): the closest point of [1/3, 0.5] ∩ [0.55, 0.82] is... none,
      // so the feasible end 0.55 is used with a warning.
      const syrups = solveIngredients({
        totalCarbsG: 75,
        targetShare: SHARE_2_TO_1,
        allowedShare: [SHARE_2_TO_1, 0.5],
        ingredients: [{ ref: 13, weight: 50 }, { ref: 12, weight: 50 }],
      });
      expect(syrups.feasibleRange).toEqual([0.55, 0.82]);
      expect(syrups.usedShare).toBe(0.55);
      expect(ids(syrups.warnings)).toEqual(['carbs.ratioNotReachable']);
      // Allowed range [0.2, 0.6] meets [0.55, 0.82] at 0.55..0.6; the target 0.1 is closest to 0.55.
      const overlap = solveIngredients({
        totalCarbsG: 75,
        targetShare: 0.1,
        allowedShare: [0.2, 0.6],
        ingredients: [{ ref: 13, weight: 50 }, { ref: 12, weight: 50 }],
      });
      expect(overlap.usedShare).toBe(0.55);
      expect(overlap.warnings).toEqual([]);
    });

    // [jeukendrup2014] [rowlands2015] above 60 g/h at least 1:0.5 is needed.
    it('warns with ratio text when glucose-only ingredients cannot make 1:0.5', () => {
      const r = solveIngredients({
        totalCarbsG: 225,
        targetShare: SHARE_2_TO_1,
        allowedShare: [SHARE_2_TO_1, 0.5],
        ingredients: [{ ref: 3, weight: 50 }, { ref: 1, weight: 50 }],
      });
      expect(r.usedShare).toBe(0);
      expect(r.adjusted).toBe(true);
      expect(r.warnings).toHaveLength(1);
      expect(r.warnings[0]).toMatchObject({
        id: 'carbs.ratioNotReachable',
        level: 'warning',
        message: { key: 'carbs.warn.ratioNotReachable', params: { achievable: '1:0', target: '1:0.5' } },
      });
      expect(r.warnings[0].citations).toContain('jeukendrup2014');
      expect(sum(r.items.map((i) => i.carbsG))).toBeCloseTo(225, 9);
    });

    it('warns when fructose alone cannot make a manual ratio', () => {
      const r = solveIngredients({
        totalCarbsG: 60,
        targetShare: 0.4,
        allowedShare: [0.4, 0.4],
        ingredients: [{ ref: 11, weight: 1 }],
      });
      expect(r.usedShare).toBe(1);
      expect(r.warnings[0].message.params).toEqual({ achievable: '0:1', target: '1:0.67' });
      expect(itemFor(r, 11).fructoseG).toBeCloseTo(60, 9);
    });

    it('does not warn when the reachable ratio reads the same as the target', () => {
      // 33.3 % fructose cannot make exactly 1/3, but both read "1:0.5": a warning would contradict itself.
      const close = solveIngredients({
        totalCarbsG: 75,
        targetShare: SHARE_2_TO_1,
        allowedShare: [SHARE_2_TO_1, 0.5],
        ingredients: [{ ref: 'c1', weight: 1 }],
        custom: [{ key: 'c1', name: 'x', carbsPer100g: 70, fructoseSharePct: 33.3 }],
      });
      expect(close.feasibleRange).toEqual([0.333, 0.333]);
      expect(close.usedShare).toBe(0.333);
      expect(close.adjusted).toBe(true);
      expect(close.warnings).toEqual([]);
      // 30 % reads differently ("1:0.43"), so the warning stays.
      const far = solveIngredients({
        totalCarbsG: 75,
        targetShare: SHARE_2_TO_1,
        allowedShare: [SHARE_2_TO_1, 0.5],
        ingredients: [{ ref: 'c1', weight: 1 }],
        custom: [{ key: 'c1', name: 'x', carbsPer100g: 70, fructoseSharePct: 30 }],
      });
      expect(far.warnings.map((w) => w.message.params)).toEqual([{ achievable: '1:0.43', target: '1:0.5' }]);
    });

    it('uses the target as is when the allowed range is missing or malformed', () => {
      for (const allowedShare of [undefined, null, [0.1], [NaN, 0.5], 'x']) {
        const r = solveIngredients({
          totalCarbsG: 60,
          targetShare: 0.25,
          allowedShare,
          ingredients: [{ ref: 3, weight: 1 }],
        });
        expect(r.usedShare).toBe(0);
        expect(ids(r.warnings)).toEqual(['carbs.ratioNotReachable']);
      }
    });

    it('sorts and clamps the allowed range', () => {
      const r = solveIngredients({
        totalCarbsG: 60,
        targetShare: 0.25,
        allowedShare: [0.5, -1],
        ingredients: [{ ref: 3, weight: 1 }],
      });
      expect(r.usedShare).toBe(0);
      expect(r.warnings).toEqual([]);
    });

    it('clamps the target share to 0–1 (non-finite → 0)', () => {
      const ingredients = [{ ref: 3, weight: 1 }, { ref: 11, weight: 1 }];
      expect(solveIngredients({ totalCarbsG: 10, targetShare: 2, ingredients }).targetShare).toBe(1);
      expect(solveIngredients({ totalCarbsG: 10, targetShare: -1, ingredients }).targetShare).toBe(0);
      expect(solveIngredients({ totalCarbsG: 10, targetShare: NaN, ingredients }).targetShare).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('returns no items when there are no carbs to deliver, but still describes the share', () => {
      for (const totalCarbsG of [0, -10, NaN, undefined, Infinity, '50']) {
        const r = solveIngredients({
          totalCarbsG,
          targetShare: SHARE_2_TO_1,
          allowedShare: [SHARE_2_TO_1, 0.5],
          ingredients: [{ ref: 3, weight: 1 }],
        });
        expect(r.items).toEqual([]);
        expect(r.achievedShare).toBeNull();
        expect(r.feasibleRange).toEqual([0, 0]);
        expect(r.usedShare).toBe(0);
        expect(r.warnings).toEqual([]);
      }
    });

    it('warns when no ingredient supplies carbs', () => {
      const r = solveIngredients({
        totalCarbsG: 100,
        targetShare: SHARE_2_TO_1,
        ingredients: [{ ref: 31, weight: 1 }, { ref: 999, weight: 1 }, { ref: 'c9', weight: 1 }],
      });
      expect(r.items).toEqual([]);
      expect(r.feasibleRange).toBeNull();
      expect(r.usedShare).toBeNull();
      expect(r.achievedShare).toBeNull();
      expect(r.adjusted).toBe(false);
      expect(r.warnings).toEqual([
        { id: 'carbs.noIngredients', level: 'warning', message: { key: 'carbs.warn.noIngredients' } },
      ]);
      expect(solveIngredients({ totalCarbsG: 0, ingredients: [] }).warnings).toEqual([]);
      expect(solveIngredients().items).toEqual([]);
      expect(solveIngredients({ totalCarbsG: 10, ingredients: 'x' }).feasibleRange).toBeNull();
    });

    it('ignores unknown refs, salts, carb-free custom ingredients and malformed entries', () => {
      const custom = [{ key: 'c1', name: 'Water', carbsPer100g: 0, fructoseSharePct: 0 }];
      const r = solveIngredients({
        totalCarbsG: 90,
        targetShare: SHARE_2_TO_1,
        ingredients: [null, 'x', { ref: 31, weight: 50 }, { ref: 'c1', weight: 50 }, { ref: 3, weight: 2 }, { ref: 11, weight: 1 }],
        custom,
      });
      expect(r.items.map((i) => i.ref)).toEqual([3, 11]);
      expect(r.feasibleRange).toEqual([0, 1]);
      expect(itemFor(r, 3).carbsG).toBeCloseTo(60, 9);
    });

    it('merges repeated refs (weights added, first position kept)', () => {
      const r = solveIngredients({
        totalCarbsG: 100,
        targetShare: 0,
        ingredients: [{ ref: 3, weight: 1 }, { ref: 1, weight: 2 }, { ref: 3, weight: 1 }],
      });
      expect(r.items.map((i) => i.ref)).toEqual([3, 1]);
      expect(itemFor(r, 3).carbsG).toBeCloseTo(50, 9);
      expect(itemFor(r, 1).carbsG).toBeCloseTo(50, 9);
    });

    it('treats negative and non-finite weights as 0', () => {
      const r = solveIngredients({
        totalCarbsG: 100,
        targetShare: 0,
        ingredients: [{ ref: 3, weight: -5 }, { ref: 1, weight: NaN }, { ref: 5, weight: 4 }],
      });
      expect(r.items.map((i) => i.ref)).toEqual([5]);
      expect(itemFor(r, 5).carbsG).toBeCloseTo(100, 9);
    });

    it('keeps the weight proportions for huge finite weights (no overflow)', () => {
      // Merged 1e308 + 1e308 used to overflow to Infinity and break Σc = T.
      const merged = solveIngredients({
        totalCarbsG: 100,
        targetShare: SHARE_2_TO_1,
        ingredients: [{ ref: 3, weight: 1e308 }, { ref: 3, weight: 1e308 }, { ref: 11, weight: 1 }, { ref: 18, weight: 1 }],
      });
      expect(sum(merged.items.map((i) => i.carbsG))).toBeCloseTo(100, 9);
      expect(merged.achievedShare).toBeCloseTo(SHARE_2_TO_1, 12);
      expect(merged.warnings).toEqual([]);
      // p ≈ (1, 0, 0): c = 100 + λ, λ + μ, λ + μ/2 with Σc = 100 and fructose 100/3 → 200/3, 100/3, 0.
      expect(itemFor(merged, 3).carbsG).toBeCloseTo(200 / 3, 9);
      expect(itemFor(merged, 11).carbsG).toBeCloseTo(100 / 3, 9);
      expect(itemFor(merged, 18)).toBeUndefined();

      // A sum of finite weights that overflows used to zero every weight (equal split).
      const sumOverflow = solveIngredients({
        totalCarbsG: 100,
        targetShare: 0,
        ingredients: [{ ref: 3, weight: 1e308 }, { ref: 1, weight: 1e308 }, { ref: 5, weight: 1 }],
      });
      expect(sumOverflow.items.map((i) => i.ref)).toEqual([3, 1]);
      expect(itemFor(sumOverflow, 3).carbsG).toBeCloseTo(50, 9);
      expect(itemFor(sumOverflow, 1).carbsG).toBeCloseTo(50, 9);

      const proportional = solveIngredients({
        totalCarbsG: 90,
        targetShare: 0,
        ingredients: [{ ref: 3, weight: Number.MAX_VALUE }, { ref: 1, weight: Number.MAX_VALUE / 2 }],
      });
      expect(itemFor(proportional, 3).carbsG).toBeCloseTo(60, 9);
      expect(itemFor(proportional, 1).carbsG).toBeCloseTo(30, 9);
    });

    it('treats shares closer than the 1e-6 grid as equal and leaves no noise-sized items', () => {
      // Honey (0.5) and a custom 50.0000002 % ingredient: before rounding the share this went
      // down an ill-conditioned path and returned honey 225.0000072 g plus a 7e-6 g phantom item.
      const equal = solveIngredients({
        totalCarbsG: 225,
        targetShare: 0.4,
        allowedShare: [0.4, 0.4],
        ingredients: [{ ref: 14, weight: 50 }, { ref: 'c1', weight: 67 }],
        custom: [{ key: 'c1', name: 'x', carbsPer100g: 75, fructoseSharePct: 50.0000002 }],
      });
      expect(equal.feasibleRange).toEqual([0.5, 0.5]);
      expect(itemFor(equal, 14).carbsG).toBeCloseTo((225 * 50) / 117, 9);
      expect(itemFor(equal, 'c1').carbsG).toBeCloseTo((225 * 67) / 117, 9);
      expect(Math.abs(sum(equal.items.map((i) => i.carbsG)) - 225)).toBeLessThan(1e-12 * 225);

      // One grid step above honey: s = 0.5 can only come from honey, so the custom one is left out.
      for (const fructoseSharePct of [50.0001, 50.0003, 50.001]) {
        const apart = solveIngredients({
          totalCarbsG: 225,
          targetShare: 0.4,
          allowedShare: [0.4, 0.4],
          ingredients: [{ ref: 14, weight: 50 }, { ref: 'c1', weight: 67 }],
          custom: [{ key: 'c1', name: 'x', carbsPer100g: 75, fructoseSharePct }],
        });
        expect(apart.usedShare).toBe(0.5);
        expect(apart.items.map((i) => i.ref)).toEqual([14]);
        expect(itemFor(apart, 14).carbsG).toBeCloseTo(225, 9);
        expect(apart.achievedShare).toBe(0.5);
      }
    });

    it('returns the same result for the same input', () => {
      const input = {
        totalCarbsG: 180,
        targetShare: 0.4,
        allowedShare: [0.4, 0.5],
        ingredients: [{ ref: 3, weight: 40 }, { ref: 14, weight: 30 }, { ref: 11, weight: 20 }, { ref: 'c1', weight: 10 }],
        custom: [{ key: 'c1', name: 'Gel base', carbsPer100g: 65, fructoseSharePct: 30, waterPct: 30 }],
      };
      expect(solveIngredients(input)).toEqual(solveIngredients(input));
    });
  });

  describe('property: random ingredient lists (1–6, built-in and custom)', () => {
    const BUILT_IN = [1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const customCarb = (key) =>
      fc.record(
        {
          key: fc.constant(key),
          name: fc.string({ maxLength: 40 }),
          carbsPer100g: fc.oneof(fc.integer({ min: 0, max: 100 }), fc.double({ min: 0, max: 100, noNaN: true })),
          fructoseSharePct: fc.oneof(
            fc.constantFrom(0, 30, 50, 100),
            fc.integer({ min: 0, max: 100 }),
            // Label values (2 decimals) and raw doubles, including near-equal shares the grid rounds together.
            fc.integer({ min: 0, max: 10000 }).map((x) => x / 100),
            fc.double({ min: 0, max: 100, noNaN: true }),
          ),
          waterPct: fc.integer({ min: 0, max: 100 }),
        },
        { requiredKeys: ['key', 'name', 'carbsPer100g', 'fructoseSharePct'] },
      );
    const customList = fc.tuple(customCarb('c1'), customCarb('c2'), customCarb('c3'));
    const ingredient = fc.record({
      ref: fc.oneof(fc.constantFrom(...BUILT_IN), fc.constantFrom('c1', 'c2', 'c3')),
      weight: fc.oneof(fc.integer({ min: 0, max: 100 }), fc.double({ min: 0, max: 100, noNaN: true })),
    });
    const share = fc.oneof(fc.double({ min: 0, max: 1, noNaN: true }), fc.constantFrom(0, SHARE_2_TO_1, 0.5, 1));
    const input = fc
      .record({
        totalCarbsG: fc.oneof(fc.integer({ min: 1, max: 2000 }), fc.double({ min: 0.5, max: 2000, noNaN: true })),
        targetShare: share,
        allowed: fc.tuple(share, share),
        pinned: fc.boolean(),
        ingredients: fc.array(ingredient, { minLength: 1, maxLength: 6 }),
        custom: customList,
      })
      .map(({ allowed, pinned, targetShare, ...rest }) => ({
        ...rest,
        targetShare,
        allowedShare: pinned ? [targetShare, targetShare] : [Math.min(...allowed), Math.max(...allowed)],
      }));

    /** Resolved and merged ingredient data, built independently of the solver. */
    const resolve = ({ ingredients, custom }) => {
      const byRef = new Map();
      for (const { ref, weight } of ingredients) {
        if (byRef.has(ref)) {
          byRef.get(ref).weight += weight;
          continue;
        }
        const p = ingredientProfile(ref, custom);
        if (p && p.carbsPerGram >= 1e-6) byRef.set(ref, { p, weight });
      }
      return [...byRef.values()];
    };

    it('solves the earlier flaky counterexample (a custom share of 1e-9) optimally', () => {
      // The old reference accepted a −6e-10 g "amount" of maple syrup and reported a better
      // optimum than any real split. 1e-7 % fructose rounds to 0, so c3 joins dextrose.
      const custom = [{ key: 'c3', name: 'x', carbsPer100g: 1, fructoseSharePct: 1e-7 }];
      const r = solveIngredients({
        totalCarbsG: 1,
        targetShare: 0,
        allowedShare: [0, 0],
        ingredients: [{ ref: 1, weight: 0 }, { ref: 17, weight: 0 }, { ref: 'c3', weight: 0 }],
        custom,
      });
      expect(r.items.map((i) => i.ref)).toEqual([1, 'c3']);
      expect(itemFor(r, 1).carbsG).toBeCloseTo(0.5, 12);
      expect(itemFor(r, 'c3').carbsG).toBeCloseTo(0.5, 12);
      const q = [1 / 3, 1 / 3, 1 / 3];
      const c = [itemFor(r, 1).carbsG, 0, itemFor(r, 'c3').carbsG];
      const objective = sum(c.map((x, i) => (x - q[i]) ** 2));
      expect(objective).toBeCloseTo(1 / 6, 12);
      expect(bruteForceObjective(q, [0, 0.5, 0], 1, 0)).toBeCloseTo(1 / 6, 12);
      // Unrounded, the strict reference no longer counts the negative split: its best is all dextrose.
      expect(bruteForceObjective(q, [0, 0.5, 1e-9 * 1.0000001], 1, 0)).toBeCloseTo(2 / 3, 12);
    });

    it('delivers T with non-negative amounts at the chosen share, optimally and deterministically', () => {
      fc.assert(
        fc.property(input, (inp) => {
          const r = solveIngredients(inp);
          const T = inp.totalCarbsG;
          const resolved = resolve(inp);
          if (resolved.length === 0) {
            expect(r.items).toEqual([]);
            expect(ids(r.warnings)).toEqual(['carbs.noIngredients']);
            return;
          }

          // All c_i ≥ −1e-9 and finite grams.
          for (const item of r.items) {
            expect(item.carbsG).toBeGreaterThanOrEqual(-1e-9);
            expect(Number.isFinite(item.grams)).toBe(true);
            expect(item.grams).toBeGreaterThanOrEqual(0);
            expect(item.glucoseG + item.fructoseG).toBeCloseTo(item.carbsG, 9);
          }
          // Σc ≈ T.
          const delivered = sum(r.items.map((i) => i.carbsG));
          expect(Math.abs(delivered - T)).toBeLessThanOrEqual(1e-9 * Math.max(1, T) * 10);

          // Achieved share inside the feasible range and on the used share.
          const [lo, hi] = r.feasibleRange;
          expect(r.achievedShare).toBeGreaterThanOrEqual(lo - 1e-9);
          expect(r.achievedShare).toBeLessThanOrEqual(hi + 1e-9);
          expect(r.usedShare).toBeGreaterThanOrEqual(lo);
          expect(r.usedShare).toBeLessThanOrEqual(hi);
          expect(Math.abs(r.achievedShare - r.usedShare)).toBeLessThan(1e-6);

          // The target is kept whenever the ingredients can make it.
          const target = inp.targetShare;
          if (target >= lo && target <= hi) {
            expect(r.usedShare).toBe(target);
            expect(r.adjusted).toBe(false);
            expect(Math.abs(r.achievedShare - target)).toBeLessThan(1e-6);
          }
          // Warning only when neither the target nor the allowed range is reachable, and the
          // reachable ratio does not read the same as the target.
          const [alo, ahi] = inp.allowedShare;
          const overlap = Math.max(alo, lo) <= Math.min(ahi, hi) + 1e-9;
          const reachable = (target >= lo - 1e-9 && target <= hi + 1e-9) || overlap;
          const sameText = shareText(r.usedShare) === shareText(target);
          expect(ids(r.warnings)).toEqual(reachable || sameText ? [] : ['carbs.ratioNotReachable']);

          // Optimal: no feasible split is closer to the weights.
          const weightSum = sum(resolved.map((e) => e.weight));
          const q = resolved.map((e) => (weightSum > 0 ? e.weight / weightSum : 1 / resolved.length) * T);
          const f = resolved.map((e) => e.p.fructoseShare);
          const c = resolved.map((e) => r.items.find((item) => item.ref === e.p.ref)?.carbsG ?? 0);
          const objective = sum(c.map((x, i) => (x - q[i]) ** 2));
          const best = bruteForceObjective(q, f, T, r.usedShare);
          expect(objective).toBeLessThanOrEqual(best + 1e-6 * Math.max(1, T * T));

          // Deterministic.
          expect(solveIngredients(inp)).toEqual(r);
        }),
        { numRuns: 1000 },
      );
    });

    it('hits targets inside a mixed range to 1e-6 for any weights', () => {
      const mixed = fc.record({
        totalCarbsG: fc.double({ min: 1, max: 1000, noNaN: true }),
        targetShare: fc.double({ min: 0, max: 0.5, noNaN: true }),
        weights: fc.array(fc.double({ min: 0, max: 100, noNaN: true }), { minLength: 4, maxLength: 4 }),
      });
      fc.assert(
        fc.property(mixed, ({ totalCarbsG, targetShare, weights }) => {
          const refs = [3, 14, 18, 11];
          const r = solveIngredients({
            totalCarbsG,
            targetShare,
            allowedShare: [targetShare, targetShare],
            ingredients: refs.map((ref, i) => ({ ref, weight: weights[i] })),
          });
          expect(r.usedShare).toBe(targetShare);
          expect(Math.abs(r.achievedShare - targetShare)).toBeLessThan(1e-6);
          expect(Math.abs(sum(r.items.map((i) => i.carbsG)) - totalCarbsG)).toBeLessThan(1e-6);
        }),
        { numRuns: 500 },
      );
    });
  });
});

describe('solver internals', () => {
  const { activeSet, dualSearch, splitCarbs, meetsConstraints } = solverInternals;
  const objective = (c, q) => sum(c.map((x, i) => (x - q[i]) ** 2));
  const shareOf = (c, f, T) => sum(c.map((x, i) => x * f[i])) / T;

  // Random projection problems with shares on the 1e-6 grid (as solveIngredients makes them),
  // including equal and adjacent shares; s anywhere in [min f, max f].
  const problem = fc
    .record({
      T: fc.oneof(fc.constantFrom(0.5, 1, 90, 225, 2000), fc.double({ min: 0.5, max: 2000, noNaN: true })),
      weights: fc.array(fc.oneof(fc.constantFrom(0, 1, 50), fc.double({ min: 0, max: 100, noNaN: true })), {
        minLength: 1,
        maxLength: 6,
      }),
      shares: fc.array(
        fc.oneof(
          fc.constantFrom(0, 0.5, 1, 0.55, 0.82, 0.499999, 0.500001, 0.500002),
          fc.integer({ min: 0, max: 1e6 }).map((x) => x / 1e6),
        ),
        { minLength: 6, maxLength: 6 },
      ),
      at: fc.oneof(fc.constantFrom(0, 0.5, 1), fc.double({ min: 0, max: 1, noNaN: true })),
    })
    .map(({ T, weights, shares, at }) => {
      const n = weights.length;
      const weightSum = sum(weights);
      const q = weights.map((w) => (weightSum > 0 ? w / weightSum : 1 / n) * T);
      const f = shares.slice(0, n);
      const lo = Math.min(...f);
      const hi = Math.max(...f);
      return { q, f, T, s: Math.min(hi, lo + at * (hi - lo)) };
    });

  it('dualSearch (the fallback) meets the constraints and matches the brute force optimum', () => {
    fc.assert(
      fc.property(problem, ({ q, f, T, s }) => {
        const c = dualSearch(q, f, T, s);
        expect(meetsConstraints(c, f, T, s)).toBe(true);
        expect(objective(c, q)).toBeLessThanOrEqual(bruteForceObjective(q, f, T, s) + 1e-6 * Math.max(1, T * T));
        // Where the active set succeeds, both find the same optimum.
        const primal = activeSet(q, f, T, s);
        if (primal !== null && meetsConstraints(primal, f, T, s)) {
          expect(Math.abs(objective(primal, q) - objective(c, q))).toBeLessThanOrEqual(1e-6 * Math.max(1, T * T));
        }
      }),
      { numRuns: 300 },
    );
  });

  it('splitCarbs gives exactly T with no noise-sized amounts', () => {
    fc.assert(
      fc.property(problem, ({ q, f, T, s }) => {
        const c = splitCarbs(q, f, T, s);
        expect(Math.abs(sum(c) - T)).toBeLessThanOrEqual(1e-12 * T);
        for (const x of c) expect(x === 0 || x > 0.999e-8 * T).toBe(true);
        expect(Math.abs(shareOf(c, f, T) - s)).toBeLessThan(1e-6);
      }),
      { numRuns: 300 },
    );
  });

  it('splitCarbs stays within the constraints on near-equal shares below the grid (fallback path)', () => {
    // Shares 2e-9 apart make the active-set solve ill-conditioned; the dual search takes over.
    // Only the internals can see such shares (solveIngredients rounds them to the grid).
    const T = 225;
    const q = [(T * 50) / 117, (T * 67) / 117];
    for (const [f, s] of [
      [[0.5, 0.500000002], 0.5],
      [[0.5, 0.500000002], 0.500000001],
      [[0.5, 0.500000002], 0.500000002],
      [[0.3, 0.3000000015, 0.3000000045], 0.300000003],
    ]) {
      const qs = f.length === q.length ? q : f.map(() => T / f.length);
      const c = splitCarbs(qs, f, T, s);
      expect(c.every((x) => x >= 0)).toBe(true);
      expect(Math.abs(sum(c) - T)).toBeLessThanOrEqual(1e-12 * T);
      expect(Math.abs(shareOf(c, f, T) - s)).toBeLessThanOrEqual(1e-9);
      expect(meetsConstraints(dualSearch(qs, f, T, s), f, T, s)).toBe(true);
    }
  });
});

describe('i18n (en/carbs) for solver messages', () => {
  it('has text and placeholders for every solver warning', () => {
    const messages = [
      ...solveIngredients({ totalCarbsG: 90, targetShare: 0.4, allowedShare: [0.4, 0.4], ingredients: [{ ref: 3, weight: 1 }] }).warnings,
      ...solveIngredients({ totalCarbsG: 90, targetShare: 0.4, ingredients: [] }).warnings,
    ].map((w) => w.message);
    expect(messages.map((m) => m.key)).toEqual(['carbs.warn.ratioNotReachable', 'carbs.warn.noIngredients']);
    for (const message of messages) {
      expect(catalog).toHaveProperty([message.key]);
      const placeholders = [...catalog[message.key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      for (const name of placeholders) expect(message.params ?? {}).toHaveProperty([name]);
    }
  });
});
