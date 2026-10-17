/*  Gel-Calculator - Personalized fuel calculator for endurance athletes.
    Copyright (C) 2026  Eike Christian Karbe

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>. */

/**
 * Ingredient solver: splits a carbohydrate total across one list of carb
 * ingredients (built-in sources and the user's custom ones) so the mix hits a
 * glucose:fructose share while staying as close as possible to the user's
 * preference weights.
 *
 * Problem, for ingredient carbs `c_i` with fructose share `f_i`:
 *
 *     minimise Σ (c_i − p_i·T)²   subject to   c_i ≥ 0,  Σ c_i = T,  Σ c_i·f_i = s·T
 *
 * with `p_i` the normalised preference weights (all zero → equal). It is the
 * Euclidean projection of the preferred split onto the feasible mixes, so the
 * solution has the form `c_i = max(0, p_i·T + λ + μ·f_i)`.
 *
 * Fructose shares are kept on a 1e-6 grid (custom label values are rounded to
 * 0.0001 percentage points), so two shares are either equal or at least 1e-6
 * apart. Shares closer than that would make the share constraint numerically
 * ill-conditioned while meaning nothing for a recipe.
 *
 * Pure module: no React, no DOM, no clocks, no randomness. Functions never
 * return English text; they return message descriptors whose keys live in
 * `src/i18n/en/carbs.js`.
 */

import { carbSourceOptions } from '../constants/constants';
import { formatRatio, RATIO_CITATIONS } from './carbs';

/** @typedef {{ key: string, params?: Record<string, string|number> }} Message */
/** @typedef {{ id: string, level: 'info'|'warning'|'danger', message: Message, citations?: string[] }} Warning */

/**
 * @typedef {Object} CustomCarb
 * @property {string} key  'c1'..'c10'.
 * @property {string} name  Up to 40 characters, from the user.
 * @property {number} carbsPer100g  Available carbohydrate per 100 g from the label (0–100).
 * @property {number} fructoseSharePct  Share of its carbs absorbed via fructose (0–100).
 * @property {number} [waterPct]  Water per 100 g (0–100). Missing → 100 − carbsPer100g.
 */

/**
 * @typedef {Object} IngredientProfile
 * @property {number|string} ref  Source id (number) or custom key ('c1').
 * @property {string} label  Source label, or the custom ingredient's name (its key when the name is empty).
 * @property {number} carbsPerGram  Available carbohydrate per gram as purchased.
 * @property {number} fructoseShare  Share of its carbs absorbed via fructose (0–1).
 * @property {number} osmPerG  mOsm per gram as purchased.
 * @property {number} waterFraction  Water per gram as purchased (0–0.95).
 * @property {boolean} custom
 */

/** @typedef {{ ref: number|string, weight: number }} IngredientInput */

/**
 * @typedef {Object} IngredientItem
 * @property {number|string} ref
 * @property {string} label
 * @property {number} carbsG  Carbohydrate from this ingredient (g).
 * @property {number} grams  Ingredient mass as purchased (g) = carbsG ÷ carbsPerGram.
 * @property {number} glucoseG  Carbs absorbed via the glucose pathway (g).
 * @property {number} fructoseG  Carbs absorbed via the fructose pathway (g).
 */

/**
 * @typedef {Object} IngredientSolution
 * @property {IngredientItem[]} items  Ingredients that supply carbs, in list order (unused ones are left out).
 * @property {number|null} achievedShare  Fructose share of the delivered carbs; null when nothing is delivered.
 * @property {[number, number]|null} feasibleRange  [min, max] fructose share the ingredients can make; null without a carb ingredient.
 * @property {number} targetShare  The requested share (clamped to 0–1).
 * @property {number|null} usedShare  The share the solver aimed for; null without a carb ingredient.
 * @property {boolean} adjusted  True when `usedShare` differs from `targetShare`.
 * @property {Warning[]} warnings
 */

/** mOsm per gram of a simple sugar (1000 ÷ 180.16 g/mol). Custom ingredients assume this (conservative). */
const SIMPLE_SUGAR_OSM_PER_G = 5.55;
/** Cap on a custom ingredient's water fraction, so it always carries some carbs. */
const MAX_CUSTOM_WATER_FRACTION = 0.95;
/** Custom fructose shares are rounded to multiples of 1 / SHARE_GRID (0.0001 percentage points). */
const SHARE_GRID = 1e6;


/** Shares closer than this count as equal (when picking the share and spotting equal f_i). */
const SHARE_EPS = 1e-9;
/** Relative tolerance on the constraints when accepting a solution. */
const SOLVE_TOL = 1e-9;
/** Relative size below which a carb amount counts as 0 inside the active-set steps (rounding noise). */
const ZERO_TOL = 1e-12;
/**
 * Share of T below which a final carb amount is rounding noise (2 µg of a 225 g
 * plan): it is set to 0 so no empty "0.0 g" ingredient appears.
 */
const NOISE_FLOOR = 1e-8;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const finiteOr = (x, fallback) => (typeof x === 'number' && Number.isFinite(x) ? x : fallback);
const snapShare = (share) => Math.round(share * SHARE_GRID) / SHARE_GRID;

const CARB_SOURCES_BY_ID = new Map(carbSourceOptions.map((option) => [option.id, option]));

/**
 * Carbohydrate, osmolality and water data for one ingredient.
 *
 * Built-in sources (numeric ids from `carbSourceOptions`) use their table
 * values. Custom ingredients (string keys) are looked up in `custom`:
 * `carbsPerGram = carbsPer100g / 100`, `fructoseShare = fructoseSharePct / 100`
 * rounded to 6 decimals (see the module comment),
 * `waterFraction = (waterPct ?? 100 − carbsPer100g) / 100` clamped to
 * [0, min(0.95, 1 − carbsPerGram)] so carbs and water never exceed the mass
 * (an inconsistent label trusts the carbs: less water means a higher, more
 * cautious osmolality), and `osmPerG = carbsPerGram × 5.55`, which treats all
 * their carbs as simple sugars (the conservative, highest-osmolality
 * assumption). Percentages are clamped to 0–100; missing or non-finite ones
 * count as 0.
 *
 * @param {number|string} ref  Source id or custom key.
 * @param {CustomCarb[]} [custom=[]]
 * @returns {IngredientProfile|null} null for unknown refs, salts and other non-carb ids.
 */
export function ingredientProfile(ref, custom = []) {
  if (typeof ref === 'number') {
    const data = CARB_SOURCES_BY_ID.get(ref);
    if (!data) return null;
    return {
      ref,
      label: data.label,
      carbsPerGram: data.carbsPerGram,
      fructoseShare: data.fructoseContent,
      osmPerG: data.osmPerG,
      waterFraction: data.waterFraction,
      custom: false,
    };
  }
  if (typeof ref !== 'string' || !Array.isArray(custom)) return null;
  const entry = custom.find((c) => c !== null && typeof c === 'object' && c.key === ref);
  if (!entry) return null;
  const carbsPer100g = clamp(finiteOr(entry.carbsPer100g, 0), 0, 100);
  const carbsPerGram = carbsPer100g / 100;
  const waterPct = finiteOr(entry.waterPct, 100 - carbsPer100g);
  const maxWaterFraction = Math.min(MAX_CUSTOM_WATER_FRACTION, (100 - carbsPer100g) / 100);
  const name = typeof entry.name === 'string' ? entry.name.trim() : '';
  return {
    ref,
    label: name || ref,
    carbsPerGram,
    fructoseShare: snapShare(clamp(finiteOr(entry.fructoseSharePct, 0), 0, 100) / 100),
    osmPerG: carbsPerGram * SIMPLE_SUGAR_OSM_PER_G,
    waterFraction: clamp(waterPct / 100, 0, maxWaterFraction),
    custom: true,
  };
}

/**
 * Below this many grams of carbs per gram an ingredient counts as carb-free,
 * so `grams = carbsG / carbsPerGram` stays finite (a label value of 0.0001 g
 * per 100 g).
 */
const MIN_CARBS_PER_GRAM = 1e-6;

/** True for a profile that can supply carbs. */
const suppliesCarbs = (profile) =>
  profile !== null &&
  typeof profile === 'object' &&
  Number.isFinite(profile.carbsPerGram) &&
  profile.carbsPerGram >= MIN_CARBS_PER_GRAM &&
  Number.isFinite(profile.fructoseShare);

/**
 * The fructose shares a mix of these ingredients can make: from the lowest to
 * the highest ingredient share. Profiles without carbs (null, carbsPerGram ≤ 0,
 * or below 1e-6) are ignored.
 *
 * @param {(IngredientProfile|null)[]} profiles
 * @returns {[number, number]|null} null when no profile supplies carbs.
 */
export function feasibleShareRange(profiles) {
  if (!Array.isArray(profiles)) return null;
  let lo = Infinity;
  let hi = -Infinity;
  for (const profile of profiles) {
    if (!suppliesCarbs(profile)) continue;
    const share = clamp(profile.fructoseShare, 0, 1);
    lo = Math.min(lo, share);
    hi = Math.max(hi, share);
  }
  return lo <= hi ? [lo, hi] : null;
}

/**
 * Resolves the ingredient list: unknown refs and ingredients without carbs are
 * dropped, repeated refs are merged (weights added, first position kept),
 * fructose shares are clamped to 0–1 and put on the 1e-6 grid, and weights
 * are sanitised (negative or non-finite → 0). Weights come back
 * divided by the largest one, so adding and normalising them cannot overflow
 * however large the finite inputs are (only their proportions matter).
 * @param {IngredientInput[]} ingredients
 * @param {CustomCarb[]} custom
 * @returns {{ profile: IngredientProfile, weight: number }[]}  Weights in [0, number of merged entries].
 */
function resolveIngredients(ingredients, custom) {
  if (!Array.isArray(ingredients)) return [];
  const byRef = new Map();
  let maxWeight = 0;
  for (const ingredient of ingredients) {
    if (ingredient === null || typeof ingredient !== 'object') continue;
    const weight = Math.max(0, finiteOr(ingredient.weight, 0));
    const existing = byRef.get(ingredient.ref);
    if (existing) {
      existing.weights.push(weight);
    } else {
      const profile = ingredientProfile(ingredient.ref, custom);
      if (!suppliesCarbs(profile)) continue;
      byRef.set(ingredient.ref, {
        profile: { ...profile, fructoseShare: snapShare(clamp(profile.fructoseShare, 0, 1)) },
        weights: [weight],
      });
    }
    maxWeight = Math.max(maxWeight, weight);
  }
  return [...byRef.values()].map(({ profile, weights }) => ({
    profile,
    weight: maxWeight > 0 ? weights.reduce((acc, w) => acc + w / maxWeight, 0) : 0,
  }));
}

/**
 * The allowed share range as a sorted pair in [0, 1]. Anything that is not a
 * pair of finite numbers → [target, target].
 * @param {unknown} allowedShare
 * @param {number} target
 * @returns {[number, number]}
 */
function sanitizeAllowed(allowedShare, target) {
  if (!Array.isArray(allowedShare) || allowedShare.length < 2) return [target, target];
  const [a, b] = allowedShare;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return [target, target];
  const lo = clamp(Math.min(a, b), 0, 1);
  const hi = clamp(Math.max(a, b), 0, 1);
  return [lo, hi];
}

/**
 * Picks the share to solve for: the target if the ingredients can make it;
 * else the point of the allowed range they can make that is closest to the
 * target; else the end of the feasible range closest to the target
 * (`reachable: false`).
 * @param {number} target
 * @param {[number, number]} allowed
 * @param {[number, number]} feasible
 * @returns {{ share: number, reachable: boolean }}
 */
function chooseShare(target, [lo, hi], [a, b]) {
  if (target >= a - SHARE_EPS && target <= b + SHARE_EPS) return { share: clamp(target, a, b), reachable: true };
  const overlapLo = Math.max(lo, a);
  const overlapHi = Math.min(hi, b);
  if (overlapLo <= overlapHi + SHARE_EPS) {
    return { share: clamp(clamp(target, overlapLo, Math.max(overlapLo, overlapHi)), a, b), reachable: true };
  }
  return { share: target < a ? a : b, reachable: false };
}

/**
 * Equality-constrained least squares on the free set `free` (all other
 * variables fixed at 0): minimise Σ (y_i − q_i)² subject to Σ y_i = T and
 * Σ y_i·f_i = s·T. The KKT system gives `y_i = q_i + λ + μ·(f_i − f̄)` with
 * `λ = (T − Σq) / n` and `μ = ((s − f̄)·T − Σ (f_i − f̄)·q_i) / Σ (f_i − f̄)²`.
 * When all free f_i are equal the share constraint is dropped (`μ = 0`,
 * `degenerate: true`): it then holds only if that f equals s.
 *
 * @param {number[]} free  Indices of the free variables (non-empty).
 * @param {number[]} q  Preferred carbs per ingredient.
 * @param {number[]} f  Fructose share per ingredient.
 * @param {number} total
 * @param {number} share
 * @returns {{ y: number[], lambda: number, mu: number, meanF: number, degenerate: boolean }}
 */
function solveEqualityConstrained(free, q, f, total, share) {
  const n = free.length;
  let sumQ = 0;
  let sumF = 0;
  let minF = Infinity;
  let maxF = -Infinity;
  for (const i of free) {
    sumQ += q[i];
    sumF += f[i];
    minF = Math.min(minF, f[i]);
    maxF = Math.max(maxF, f[i]);
  }
  const meanF = sumF / n;
  const lambda = (total - sumQ) / n;
  const degenerate = maxF - minF <= SHARE_EPS;
  let mu = 0;
  if (!degenerate) {
    let sumGQ = 0;
    let sumGG = 0;
    for (const i of free) {
      const g = f[i] - meanF;
      sumGQ += g * q[i];
      sumGG += g * g;
    }
    mu = ((share - meanF) * total - sumGQ) / sumGG;
  }
  const y = new Array(q.length).fill(0);
  for (const i of free) y[i] = q[i] + lambda + mu * (f[i] - meanF);
  return { y, lambda, mu, meanF, degenerate };
}

/**
 * KKT sign check for the variables fixed at 0 when the free f_i are all equal
 * (the multipliers are then not unique): is there a μ with
 * `q_j + λ + μ·(f_j − f̄) ≤ 0` for every fixed j?
 */
function degenerateOptimal(fixed, q, f, { lambda, meanF }, tol) {
  let muLo = -Infinity;
  let muHi = Infinity;
  for (const j of fixed) {
    const v = q[j] + lambda;
    const d = f[j] - meanF;
    if (Math.abs(d) <= SHARE_EPS) {
      if (v > tol) return false;
    } else if (d > 0) {
      muHi = Math.min(muHi, -v / d);
    } else {
      muLo = Math.max(muLo, -v / d);
    }
  }
  return muLo <= muHi + tol;
}

/**
 * Active-set method: solve the equality-constrained problem on the free set,
 * fix negative variables at 0 and re-solve; once all free variables are
 * non-negative, free again the fixed variable whose KKT multiplier has the
 * wrong sign. Returns null when it would revisit a free set (a cycle), runs
 * out of iterations or reaches a free set whose equal f_i cannot make the
 * share; the caller then uses {@link dualSearch}.
 * @returns {number[]|null}
 */
function activeSet(q, f, total, share) {
  const n = q.length;
  const tol = ZERO_TOL * Math.max(1, total);
  const kktTol = SOLVE_TOL * Math.max(1, total);
  let free = q.map((_, i) => i);
  const seen = new Set();
  for (let iteration = 0; iteration < 10 * n + 20; iteration++) {
    const key = free.join(',');
    if (free.length === 0 || seen.has(key)) return null;
    seen.add(key);

    const solution = solveEqualityConstrained(free, q, f, total, share);
    const { y } = solution;
    if (free.some((i) => y[i] < -tol)) {
      free = free.filter((i) => y[i] >= -tol);
      continue;
    }

    const freeSet = new Set(free);
    const fixed = q.map((_, i) => i).filter((i) => !freeSet.has(i));
    if (solution.degenerate) {
      if (Math.abs(solution.meanF - share) > SHARE_EPS) return null;
      return degenerateOptimal(fixed, q, f, solution, kktTol) ? y : null;
    }

    let release = -1;
    let worst = kktTol;
    for (const j of fixed) {
      const v = q[j] + solution.lambda + solution.mu * (f[j] - solution.meanF);
      if (v > worst) {
        worst = v;
        release = j;
      }
    }
    if (release < 0) return y;
    free = [...free, release].sort((a, b) => a - b);
  }
  return null;
}

/**
 * Euclidean projection of `v` onto { c ≥ 0, Σ c = total } (sort-based).
 * @param {number[]} v
 * @param {number} total  > 0
 * @returns {number[]}
 */
function projectToSimplex(v, total) {
  const sorted = [...v].sort((a, b) => b - a);
  let cumulative = 0;
  let theta = 0;
  for (let k = 0; k < sorted.length; k++) {
    cumulative += sorted[k];
    const t = (cumulative - total) / (k + 1);
    if (sorted[k] - t > 0) theta = t;
  }
  return v.map((x) => Math.max(0, x - theta));
}

/**
 * Fallback solver on the dual: for a multiplier μ the best split with the
 * right total is the projection of `q + μ·f` onto { c ≥ 0, Σ c = T }, and its
 * fructose share never decreases as μ grows. Bisection on μ finds the share;
 * the equality-constrained solve on the support found then removes the
 * bisection's rounding.
 * @returns {number[]}
 */
function dualSearch(q, f, total, share) {
  const evaluate = (mu) => {
    const c = projectToSimplex(q.map((qi, i) => qi + mu * f[i]), total);
    const achieved = c.reduce((acc, ci, i) => acc + ci * f[i], 0) / total;
    return { c, achieved };
  };
  const scale = Math.max(1, total);
  let hi = scale;
  let lo = -scale;
  for (let k = 0; k < 1100 && evaluate(hi).achieved < share - SHARE_EPS && Number.isFinite(hi * 2); k++) hi *= 2;
  for (let k = 0; k < 1100 && evaluate(lo).achieved > share + SHARE_EPS && Number.isFinite(lo * 2); k++) lo *= 2;

  let best = evaluate(hi);
  for (let k = 0; k < 300; k++) {
    const mid = (lo + hi) / 2;
    if (mid === lo || mid === hi) break;
    const result = evaluate(mid);
    if (Math.abs(result.achieved - share) < Math.abs(best.achieved - share)) best = result;
    if (result.achieved < share) lo = mid;
    else hi = mid;
  }

  const tol = SOLVE_TOL * scale;
  const support = best.c.map((_, i) => i).filter((i) => best.c[i] > tol);
  if (support.length > 0) {
    // The polish is only kept when it really meets the constraints: on an
    // ill-conditioned support its rounding can be worse than the bisection's.
    const polished = solveEqualityConstrained(support, q, f, total, share);
    if (meetsConstraints(polished.y, f, total, share)) return polished.y;
  }
  return best.c;
}

/** True when `c` meets both equality constraints and the bounds within tolerance. */
function meetsConstraints(c, f, total, share) {
  const tol = SOLVE_TOL * Math.max(1, total);
  let sum = 0;
  let fructose = 0;
  for (let i = 0; i < c.length; i++) {
    if (!Number.isFinite(c[i]) || c[i] < -tol) return false;
    sum += c[i];
    fructose += c[i] * f[i];
  }
  return Math.abs(sum - total) <= tol && Math.abs(fructose / total - share) <= SHARE_EPS;
}

/**
 * Carbs per ingredient for the projection problem described in the module
 * comment: the active-set solution, or {@link dualSearch} when that fails or
 * misses the constraints. Amounts below `NOISE_FLOOR × T` (rounding noise,
 * including tiny negatives) are set to 0 and the rest is scaled so it adds up
 * to T; scaling keeps the share.
 * @param {number[]} q  Preferred carbs per ingredient (p_i·T).
 * @param {number[]} f  Fructose share per ingredient.
 * @param {number} total  T > 0.
 * @param {number} share  s within [min f, max f].
 * @returns {number[]}
 */
function splitCarbs(q, f, total, share) {
  let c = activeSet(q, f, total, share);
  if (c === null || !meetsConstraints(c, f, total, share)) c = dualSearch(q, f, total, share);
  const floor = NOISE_FLOOR * total;
  const kept = c.map((ci) => (ci > floor ? ci : 0));
  const keptSum = kept.reduce((acc, ci) => acc + ci, 0);
  return keptSum > 0 ? kept.map((ci) => ci * (total / keptSum)) : kept;
}

/**
 * Internal steps of the solver, exported for tests only (not part of the
 * module's API).
 */
export const solverInternals = { activeSet, dualSearch, splitCarbs, meetsConstraints };

/**
 * Splits `totalCarbsG` across the ingredient list.
 *
 * Unknown refs, salts and ingredients without carbs are ignored; repeated refs
 * are merged. Weights are preferences, not fixed percentages: they are
 * normalised (`p_i = w_i / Σ w`, all zero → equal) and the solver keeps the
 * split as close to `p_i·T` as the share allows (least squares, see the module
 * comment), so an ingredient with weight 0 still gets carbs when the share
 * needs it.
 *
 * Share used (`usedShare`): the target if the ingredients can make it; else
 * the point of `allowedShare ∩ feasibleRange` closest to the target, without a
 * warning (the target was a recommendation inside an allowed range, e.g.
 * glucose-only sources at 60 g/h or less); else the end of the feasible range
 * closest to the target with warning `carbs.ratioNotReachable` (params
 * `achievable` and `target`, ratio text from `formatRatio`). The warning is
 * left out when both texts are the same (the gap is below the 2 decimals the
 * ratio is shown with); `adjusted` still reports the change.
 *
 * No carb ingredient with `totalCarbsG > 0` → warning `carbs.noIngredients`.
 * `totalCarbsG` ≤ 0 or non-finite → no items and no warnings (the share is
 * still chosen, for display).
 *
 * @param {Object} input
 * @param {number} input.totalCarbsG  Carbohydrate to deliver (g).
 * @param {number} input.targetShare  Wanted fructose share (0–1). Non-finite → 0.
 * @param {[number, number]} [input.allowedShare]  Acceptable fructose shares; missing → [target, target].
 * @param {IngredientInput[]} [input.ingredients]
 * @param {CustomCarb[]} [input.custom]
 * @returns {IngredientSolution}
 */
export function solveIngredients({ totalCarbsG, targetShare, allowedShare, ingredients = [], custom = [] } = {}) {
  const total = Math.max(0, finiteOr(totalCarbsG, 0));
  const target = clamp(finiteOr(targetShare, 0), 0, 1);
  const allowed = sanitizeAllowed(allowedShare, target);
  const entries = resolveIngredients(ingredients, custom);
  const feasibleRange = feasibleShareRange(entries.map((entry) => entry.profile));

  if (feasibleRange === null) {
    /** @type {Warning[]} */
    const warnings = total > 0
      ? [{ id: 'carbs.noIngredients', level: 'warning', message: { key: 'carbs.warn.noIngredients' } }]
      : [];
    return { items: [], achievedShare: null, feasibleRange: null, targetShare: target, usedShare: null, adjusted: false, warnings };
  }

  const { share: usedShare, reachable } = chooseShare(target, allowed, feasibleRange);
  const adjusted = Math.abs(usedShare - target) > SHARE_EPS;
  if (total <= 0) {
    return { items: [], achievedShare: null, feasibleRange, targetShare: target, usedShare, adjusted, warnings: [] };
  }

  /** @type {Warning[]} */
  const warnings = [];
  const achievableText = formatRatio({ glucose: 1 - usedShare, fructose: usedShare });
  const targetText = formatRatio({ glucose: 1 - target, fructose: target });
  // A gap below the ratio text's precision would name the same ratio twice.
  if (!reachable && achievableText !== targetText) {
    warnings.push({
      id: 'carbs.ratioNotReachable',
      level: 'warning',
      message: {
        key: 'carbs.warn.ratioNotReachable',
        params: { achievable: achievableText, target: targetText },
      },
      citations: [...RATIO_CITATIONS],
    });
  }

  const weightSum = entries.reduce((acc, entry) => acc + entry.weight, 0);
  const q = entries.map((entry) => (weightSum > 0 ? entry.weight / weightSum : 1 / entries.length) * total);
  const f = entries.map((entry) => entry.profile.fructoseShare);
  const carbs = splitCarbs(q, f, total, usedShare);

  /** @type {IngredientItem[]} */
  const items = [];
  let deliveredCarbs = 0;
  let deliveredFructose = 0;
  entries.forEach(({ profile }, i) => {
    const carbsG = carbs[i];
    if (!(carbsG > 0)) return;
    const fructoseG = carbsG * profile.fructoseShare;
    items.push({
      ref: profile.ref,
      label: profile.label,
      carbsG,
      grams: carbsG / profile.carbsPerGram,
      glucoseG: carbsG - fructoseG,
      fructoseG,
    });
    deliveredCarbs += carbsG;
    deliveredFructose += fructoseG;
  });

  return {
    items,
    achievedShare: deliveredCarbs > 0 ? deliveredFructose / deliveredCarbs : null,
    feasibleRange,
    targetShare: target,
    usedShare,
    adjusted,
    warnings,
  };
}
