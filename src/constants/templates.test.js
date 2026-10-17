import { describe, it, expect } from 'vitest';
import { TEMPLATES } from './templates';
import { glucoseSourceOptions, fructoseSourceOptions, sourceDataByIdMap } from './constants';

const GLUCOSE_IDS = new Set(glucoseSourceOptions.map((o) => o.id));
const FRUCTOSE_IDS = new Set(fructoseSourceOptions.map((o) => o.id));
const SODIUM_SALTS = ['table', 'citrate', 'mix'];

const sumPercent = (list) => list.reduce((s, x) => s + x.percentage, 0);
const fructoseShare = ({ glucose, fructose }) => (glucose + fructose > 0 ? fructose / (glucose + fructose) : 0);

/**
 * Delivers a blend's ratio from its own sources by the carb solver algorithm
 * in the Phase 1 spec (section 2), on carbohydrate grams:
 * 1. mixed sources (glucose and fructose content both > 0), from either list,
 *    each cover their percentage of their own list's target;
 * 2. pure sources split what each list still needs, in proportion to their
 *    percentages;
 * 3. feasible when glucose, fructose and the total are each within
 *    `max(0.5, total * 1%)` of the targets.
 * Sources with no content for their list's pathway are skipped, as in the
 * solver. Written from the spec, not from `src/domain/carbs.js`, so this test
 * does not depend on the solver implementation.
 *
 * @param {{ carbsPerGelG: number, ratio: { glucose: number, fructose: number },
 *   glucoseSources: { id: number, percentage: number }[],
 *   fructoseSources: { id: number, percentage: number }[] }} blend
 */
function deliver({ carbsPerGelG: total, ratio, glucoseSources, fructoseSources }) {
  const fructoseTarget = total * fructoseShare(ratio);
  const target = { glucose: total - fructoseTarget, fructose: fructoseTarget };
  const content = (data, pathway) => (pathway === 'glucose' ? data.glucoseContent : data.fructoseContent);
  const sources = [
    ...glucoseSources.map((s) => ({ ...s, pathway: 'glucose' })),
    ...fructoseSources.map((s) => ({ ...s, pathway: 'fructose' })),
  ]
    .map((s) => ({ ...s, data: sourceDataByIdMap.get(s.id) }))
    .filter((s) => s.data && content(s.data, s.pathway) > 0);
  const isMixed = (s) => s.data.glucoseContent > 0 && s.data.fructoseContent > 0;

  const delivered = { glucose: 0, fructose: 0 };
  const addCarbs = (s, carbsG) => {
    delivered.glucose += carbsG * s.data.glucoseContent;
    delivered.fructose += carbsG * s.data.fructoseContent;
  };

  for (const s of sources.filter(isMixed)) {
    addCarbs(s, (target[s.pathway] * s.percentage) / 100 / content(s.data, s.pathway));
  }
  const remaining = {
    glucose: Math.max(0, target.glucose - delivered.glucose),
    fructose: Math.max(0, target.fructose - delivered.fructose),
  };
  for (const pathway of ['glucose', 'fructose']) {
    const pool = sources.filter((s) => !isMixed(s) && s.pathway === pathway);
    const percentageSum = sumPercent(pool);
    if (remaining[pathway] <= 0 || percentageSum <= 0) continue;
    for (const s of pool) {
      addCarbs(s, (remaining[pathway] * s.percentage) / percentageSum / content(s.data, pathway));
    }
  }

  const tol = Math.max(0.5, total * 0.01);
  const feasible =
    Math.abs(delivered.glucose + delivered.fructose - total) <= tol &&
    Math.abs(delivered.glucose - target.glucose) <= tol &&
    Math.abs(delivered.fructose - target.fructose) <= tol;
  return { target, delivered, feasible };
}

/** Hosts of a template's sources, without a leading `www.`. */
const sourceHosts = (t) => new Set(t.sources.map((s) => new URL(s.url).hostname.replace(/^www\./, '')));

/** Carbohydrates named in the first sentence of `notes`, lower case, parentheses dropped. */
function labelOrderCarbs(notes) {
  const m = /^Carbohydrates in label order: ([^.]+)\./.exec(notes);
  if (!m) return null;
  return m[1].split(', ').map((c) => c.replace(/\s*\(.*\)$/, '').trim().toLowerCase());
}

describe('TEMPLATES', () => {
  it('lists the eight researched products', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual([
      'gu-energy-gel',
      'honey-stinger-organic-energy-gel',
      'maurten-gel-100',
      'bpn-go-gel-endurance',
      'sis-go-isotonic-energy-gel',
      'pf-30-gel',
      'gu-roctane-energy-gel',
      'untapped-maple-syrup-gel',
    ]);
  });

  it('has unique kebab-case ids', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('fills every text field', () => {
    for (const t of TEMPLATES) {
      for (const key of ['name', 'brand', 'description', 'otherIngredients', 'notes']) {
        expect(typeof t[key], `${t.id}.${key}`).toBe('string');
        expect(t[key].trim().length, `${t.id}.${key}`).toBeGreaterThan(0);
      }
      expect(typeof t.verified, t.id).toBe('boolean');
    }
  });

  it('has finite, non-negative per-gel numbers and a caffeine-free base', () => {
    for (const t of TEMPLATES) {
      expect(Number.isFinite(t.carbsPerGelG), t.id).toBe(true);
      expect(t.carbsPerGelG, t.id).toBeGreaterThan(0);
      expect(t.carbsPerGelG, t.id).toBeLessThanOrEqual(60);
      expect(Number.isFinite(t.sodiumPerGelMg), t.id).toBe(true);
      expect(t.sodiumPerGelMg, t.id).toBeGreaterThanOrEqual(0);
      expect(t.sodiumPerGelMg, t.id).toBeLessThanOrEqual(500);
      expect(t.caffeinePerGelMg, t.id).toBe(0);
    }
  });

  it('resolves every source id into the right list', () => {
    for (const t of TEMPLATES) {
      for (const { id } of t.glucoseSources) {
        expect(GLUCOSE_IDS.has(id), `${t.id} glucose ${id}`).toBe(true);
        expect(sourceDataByIdMap.has(id), `${t.id} glucose ${id}`).toBe(true);
      }
      for (const { id } of t.fructoseSources) {
        expect(FRUCTOSE_IDS.has(id), `${t.id} fructose ${id}`).toBe(true);
        expect(sourceDataByIdMap.has(id), `${t.id} fructose ${id}`).toBe(true);
      }
    }
  });

  it('sums each list to 100 percent or leaves it empty', () => {
    for (const t of TEMPLATES) {
      for (const list of [t.glucoseSources, t.fructoseSources]) {
        for (const { percentage } of list) expect(percentage, t.id).toBeGreaterThan(0);
        if (list.length > 0) expect(sumPercent(list), t.id).toBeCloseTo(100, 6);
      }
      expect(t.glucoseSources.length + t.fructoseSources.length, t.id).toBeGreaterThan(0);
    }
  });

  it('has non-negative ratio parts and never more fructose than glucose', () => {
    for (const t of TEMPLATES) {
      expect(Number.isFinite(t.ratio.glucose) && t.ratio.glucose >= 0, t.id).toBe(true);
      expect(Number.isFinite(t.ratio.fructose) && t.ratio.fructose >= 0, t.id).toBe(true);
      expect(t.ratio.glucose + t.ratio.fructose, t.id).toBeGreaterThan(0);
      expect(fructoseShare(t.ratio), t.id).toBeLessThanOrEqual(0.5 + 1e-9);
    }
  });

  it('can deliver its own ratio with its own sources, per gel and per hour', () => {
    for (const t of TEMPLATES) {
      for (const carbsPerGelG of [t.carbsPerGelG, 60, 90, 120]) {
        const r = deliver({ ...t, carbsPerGelG });
        expect(r.feasible, `${t.id} at ${carbsPerGelG} g: ${JSON.stringify(r)}`).toBe(true);
      }
    }
  });

  describe('deliver() test helper follows the spec solver order', () => {
    it('runs a mixed glucose-list source before the pure fructose source', () => {
      // Barley malt (id 7) is 0.97 glucose / 0.03 fructose. As a mixed source it
      // covers the glucose target first; crystalline fructose fills the rest.
      const r = deliver({
        carbsPerGelG: 30,
        ratio: { glucose: 1, fructose: 0.5 },
        glucoseSources: [{ id: 7, percentage: 100 }],
        fructoseSources: [{ id: 11, percentage: 100 }],
      });
      expect(r.feasible).toBe(true);
      expect(r.delivered.glucose).toBeCloseTo(20, 9);
      expect(r.delivered.fructose).toBeCloseTo(10, 9);
    });

    it('splits pure sources by percentage after a mixed fructose-list source', () => {
      // Honey (id 14, 50/50) covers the 10 g fructose target and adds 10 g glucose;
      // maltodextrin and dextrose split the remaining 10 g glucose 1:3.
      const r = deliver({
        carbsPerGelG: 30,
        ratio: { glucose: 1, fructose: 0.5 },
        glucoseSources: [{ id: 3, percentage: 25 }, { id: 1, percentage: 75 }],
        fructoseSources: [{ id: 14, percentage: 100 }],
      });
      expect(r.feasible).toBe(true);
      expect(r.delivered.glucose).toBeCloseTo(20, 9);
      expect(r.delivered.fructose).toBeCloseTo(10, 9);
    });

    it('flags a blend that cannot reach its ratio', () => {
      // Honey alone gives 1:1; a 1:0.5 target leaves 10 g glucose with no source.
      const r = deliver({
        carbsPerGelG: 30,
        ratio: { glucose: 1, fructose: 0.5 },
        glucoseSources: [],
        fructoseSources: [{ id: 14, percentage: 100 }],
      });
      expect(r.feasible).toBe(false);
    });
  });

  it('uses a known sodium salt', () => {
    for (const t of TEMPLATES) expect(SODIUM_SALTS, t.id).toContain(t.sodiumSalt);
  });

  it('cites at least one https source checked in a YYYY-MM month', () => {
    for (const t of TEMPLATES) {
      expect(t.sources.length, t.id).toBeGreaterThanOrEqual(1);
      for (const s of t.sources) {
        expect(s.label.trim().length, t.id).toBeGreaterThan(0);
        expect(() => new URL(s.url), `${t.id} ${s.url}`).not.toThrow();
        expect(new URL(s.url).protocol, `${t.id} ${s.url}`).toBe('https:');
        expect(s.checked, t.id).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
        expect(s.checked, t.id).toBe('2026-10');
      }
    }
  });

  it('cites a nutrition panel for every template and two sites for every verified one', () => {
    for (const t of TEMPLATES) {
      expect(t.sources.some((s) => /panel/i.test(s.label)), t.id).toBe(true);
      if (t.verified) expect(sourceHosts(t).size, t.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('records the carbohydrates, and only those, in label order in the notes', () => {
    for (const t of TEMPLATES) {
      const carbs = labelOrderCarbs(t.notes);
      expect(carbs, t.id).not.toBeNull();
      const other = t.otherIngredients.toLowerCase();
      for (const c of carbs) {
        expect(c.length, t.id).toBeGreaterThan(0);
        expect(c, t.id).not.toMatch(/\bwater\b/);
        expect(other, `${t.id}: ${c} is also in otherIngredients`).not.toContain(c);
      }
    }
  });

  it('explains every unverified template as an estimate', () => {
    for (const t of TEMPLATES.filter((x) => !x.verified)) {
      expect(t.notes, t.id).toMatch(/estimate|derived/);
    }
  });

  it('is deeply frozen', () => {
    expect(Object.isFrozen(TEMPLATES)).toBe(true);
    for (const t of TEMPLATES) {
      expect(Object.isFrozen(t), t.id).toBe(true);
      expect(Object.isFrozen(t.ratio), t.id).toBe(true);
      expect(Object.isFrozen(t.glucoseSources), t.id).toBe(true);
      expect(Object.isFrozen(t.sources[0]), t.id).toBe(true);
    }
  });

  describe('label values (checked 2026-10)', () => {
    const byId = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

    it('Maurten Gel 100: 25 g, 20 mg sodium (US label), stated 1:0.8 glucose to fructose', () => {
      const t = byId['maurten-gel-100'];
      expect([t.carbsPerGelG, t.sodiumPerGelMg, t.caffeinePerGelMg]).toEqual([25, 20, 0]);
      expect(t.ratio).toEqual({ glucose: 1, fructose: 0.8 });
      expect(t.verified).toBe(true);
    });

    it('PF 30 Gel: 30 g, 0 mg sodium on a cited panel, stated 2:1', () => {
      const t = byId['pf-30-gel'];
      expect([t.carbsPerGelG, t.sodiumPerGelMg]).toEqual([30, 0]);
      expect(t.verified).toBe(true);
      expect(t.notes).toMatch(/0 mg sodium/);
      expect(t.ratio).toEqual({ glucose: 1, fructose: 0.5 });
      expect(t.glucoseSources).toEqual([{ id: 3, percentage: 100 }]);
      expect(t.fructoseSources).toEqual([{ id: 11, percentage: 100 }]);
    });

    it('SiS GO Isotonic: 22 g maltodextrin only, trace sodium', () => {
      const t = byId['sis-go-isotonic-energy-gel'];
      expect(t.carbsPerGelG).toBe(22);
      expect(t.ratio.fructose).toBe(0);
      expect(t.fructoseSources).toEqual([]);
      expect(t.sodiumPerGelMg).toBeLessThan(20);
    });

    it('UnTapped: maple syrup only, 1:1, 26 g', () => {
      const t = byId['untapped-maple-syrup-gel'];
      expect(t.carbsPerGelG).toBe(26);
      expect(t.ratio).toEqual({ glucose: 1, fructose: 1 });
      expect(t.glucoseSources).toEqual([]);
      expect(t.fructoseSources).toEqual([{ id: 17, percentage: 100 }]);
    });

    it('BPN Go Gel: apple juice concentrate and brown rice syrup, 110 mg sea salt sodium', () => {
      const t = byId['bpn-go-gel-endurance'];
      expect([t.carbsPerGelG, t.sodiumPerGelMg]).toEqual([24, 110]);
      expect(t.glucoseSources).toEqual([{ id: 6, percentage: 100 }]);
      expect(t.fructoseSources).toEqual([{ id: 20, percentage: 100 }]);
      expect(t.sodiumSalt).toBe('table');
    });

    it('GU gels and Honey Stinger: label numbers, estimated ratio, marked unverified', () => {
      expect([byId['gu-energy-gel'].carbsPerGelG, byId['gu-energy-gel'].sodiumPerGelMg]).toEqual([23, 55]);
      expect([byId['gu-roctane-energy-gel'].carbsPerGelG, byId['gu-roctane-energy-gel'].sodiumPerGelMg]).toEqual([21, 125]);
      // Both GU labels list sodium citrate and sea salt.
      expect(byId['gu-energy-gel'].sodiumSalt).toBe('mix');
      expect(byId['gu-roctane-energy-gel'].sodiumSalt).toBe('mix');
      expect(byId['gu-energy-gel'].otherIngredients).toMatch(/sea salt/);
      expect(byId['gu-energy-gel'].otherIngredients).not.toMatch(/histidine/i);
      const hs = byId['honey-stinger-organic-energy-gel'];
      expect([hs.carbsPerGelG, hs.sodiumPerGelMg]).toEqual([24, 50]);
      for (const id of ['gu-energy-gel', 'gu-roctane-energy-gel', 'honey-stinger-organic-energy-gel']) {
        expect(byId[id].verified, id).toBe(false);
        expect(fructoseShare(byId[id].ratio), id).toBeLessThan(1 / 3);
      }
    });
  });
});
