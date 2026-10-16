import { describe, it, expect } from 'vitest';
import { TEMPLATES } from './templates';
import { glucoseSourceOptions, fructoseSourceOptions, sourceDataByIdMap } from './constants';

const GLUCOSE_IDS = new Set(glucoseSourceOptions.map((o) => o.id));
const FRUCTOSE_IDS = new Set(fructoseSourceOptions.map((o) => o.id));
const SODIUM_SALTS = ['table', 'citrate', 'mix'];

const sumPercent = (list) => list.reduce((s, x) => s + x.percentage, 0);
const fructoseShare = ({ glucose, fructose }) => (glucose + fructose > 0 ? fructose / (glucose + fructose) : 0);

/**
 * Checks that a template's own sources can deliver its ratio, using the same
 * order as the carb solver: the fructose list covers the fructose target first
 * (a mixed source like honey also delivers glucose), then the glucose list
 * covers what is left of the glucose target. Independent of the solver code.
 */
function deliver(tpl) {
  const total = tpl.carbsPerGelG;
  const fTarget = total * fructoseShare(tpl.ratio);
  const gTarget = total - fTarget;
  let glucose = 0;
  let fructose = 0;
  for (const { id, percentage } of tpl.fructoseSources) {
    const s = sourceDataByIdMap.get(id);
    const carbs = (fTarget * percentage) / 100 / s.fructoseContent;
    glucose += carbs * s.glucoseContent;
    fructose += carbs * s.fructoseContent;
  }
  const glucoseNeed = gTarget - glucose;
  for (const { id, percentage } of tpl.glucoseSources) {
    const s = sourceDataByIdMap.get(id);
    const carbs = (Math.max(0, glucoseNeed) * percentage) / 100 / s.glucoseContent;
    glucose += carbs * s.glucoseContent;
    fructose += carbs * s.fructoseContent;
  }
  return { gTarget, fTarget, glucoseNeed, glucose, fructose };
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

  it('can deliver its own ratio with its own sources', () => {
    for (const t of TEMPLATES) {
      const tol = Math.max(0.5, t.carbsPerGelG * 0.01);
      const r = deliver(t);
      // Mixed fructose-list sources must not overshoot the glucose target.
      expect(r.glucoseNeed, t.id).toBeGreaterThanOrEqual(-tol);
      // Any glucose still needed must have a glucose-list source to come from.
      if (r.glucoseNeed > tol) expect(t.glucoseSources.length, t.id).toBeGreaterThan(0);
      if (r.fTarget > tol) expect(t.fructoseSources.length, t.id).toBeGreaterThan(0);
      expect(Math.abs(r.glucose - r.gTarget), t.id).toBeLessThanOrEqual(tol);
      expect(Math.abs(r.fructose - r.fTarget), t.id).toBeLessThanOrEqual(tol);
    }
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

  it('records the carbohydrate label order in the notes', () => {
    for (const t of TEMPLATES) expect(t.notes, t.id).toMatch(/^Carbohydrates in label order: /);
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

    it('PF 30 Gel: 30 g, no sodium source, stated 2:1', () => {
      const t = byId['pf-30-gel'];
      expect([t.carbsPerGelG, t.sodiumPerGelMg]).toEqual([30, 0]);
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
      const hs = byId['honey-stinger-organic-energy-gel'];
      expect([hs.carbsPerGelG, hs.sodiumPerGelMg]).toEqual([24, 50]);
      for (const id of ['gu-energy-gel', 'gu-roctane-energy-gel', 'honey-stinger-organic-energy-gel']) {
        expect(byId[id].verified, id).toBe(false);
        expect(fructoseShare(byId[id].ratio), id).toBeLessThan(1 / 3);
      }
    });
  });
});
