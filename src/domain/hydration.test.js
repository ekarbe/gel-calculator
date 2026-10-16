import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  FLUID_MAX_ML_PER_HOUR,
  FLUID_SHARE_OF_SWEAT,
  recommendFluid,
  fluidWarnings,
} from './hydration';
import { estimateSweatRateLegacy } from './sweat';
import { CITATIONS } from './evidence';
import fluidCatalog from '../i18n/en/fluid';

const PLAN_CITATIONS = ['sawka2007', 'hewbutler2015', 'kenefick2018', 'almond2005'];
/** Rule constants passed to the fluid.why.plan text. */
const RULE_PARAMS = { sharePct: 80, maxMlPerHour: 800 };

/** Collects every message descriptor in a recommendFluid result or a warning list. */
function messagesOf(result) {
  if (Array.isArray(result)) return result.map((w) => w.message);
  return [result.why.summary, ...(result.why.details ?? []), ...result.warnings.map((w) => w.message)];
}

function placeholders(text) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}

describe('constants', () => {
  it('caps planned drinking at 800 ml/h and replaces 80% of sweat loss', () => {
    // [sawka2007] 0.4–0.8 L/h, replace less than full sweat loss
    expect(FLUID_MAX_ML_PER_HOUR).toBe(800);
    expect(FLUID_SHARE_OF_SWEAT).toBe(0.8);
  });
});

describe('recommendFluid', () => {
  it('replaces 80% of sweat loss, rounded to 50 ml/h', () => {
    // [sawka2007] [hewbutler2015] drink less than you sweat
    expect(recommendFluid({ durationMin: 180, sweatRateLph: 0.75, tempC: 20 }).mlPerHour).toBe(600);
    expect(recommendFluid({ durationMin: 180, sweatRateLph: 0.25, tempC: 20 }).mlPerHour).toBe(200);
    // 0.6 L/h × 0.8 = 480 → 500
    expect(recommendFluid({ durationMin: 180, sweatRateLph: 0.6, tempC: 20 }).mlPerHour).toBe(500);
    // 0.55 L/h × 0.8 = 440 → 450
    expect(recommendFluid({ durationMin: 180, sweatRateLph: 0.55, tempC: 20 }).mlPerHour).toBe(450);
    // 0.53 L/h × 0.8 = 424 → 400
    expect(recommendFluid({ durationMin: 180, sweatRateLph: 0.53, tempC: 20 }).mlPerHour).toBe(400);
  });

  it('caps the plan at 800 ml/h', () => {
    // [sawka2007] upper end of the 0.4–0.8 L/h guideline range
    expect(recommendFluid({ durationMin: 180, sweatRateLph: 1.0, tempC: 20 }).mlPerHour).toBe(800);
    expect(recommendFluid({ durationMin: 180, sweatRateLph: 1.25, tempC: 20 }).mlPerHour).toBe(800);
    expect(recommendFluid({ durationMin: 180, sweatRateLph: 2.75, tempC: 30 }).mlPerHour).toBe(800);
    expect(recommendFluid({ durationMin: 180, sweatRateLph: 1e9, tempC: 30 }).mlPerHour).toBe(800);
  });

  it('returns 0 ml/h when the sweat rate is zero, negative or not a number', () => {
    for (const sweatRateLph of [0, -1, NaN, Infinity, -Infinity, undefined, null, '1.2']) {
      const r = recommendFluid({ durationMin: 180, sweatRateLph, tempC: 20 });
      expect(r.mlPerHour).toBe(0);
      expect(r.warnings).toEqual([]);
      expect(r.why.summary.params).toEqual({ mlPerHour: 0, sweatMlPerHour: 0, ...RULE_PARAMS });
    }
  });

  it('always reports the 400–800 ml/h guideline range', () => {
    // [sawka2007] 0.4–0.8 L/h
    expect(recommendFluid({ durationMin: 180, sweatRateLph: 0.25, tempC: 20 }).range).toEqual([400, 800]);
    expect(recommendFluid({ durationMin: 30, sweatRateLph: 2.75, tempC: 35 }).range).toEqual([400, 800]);
  });

  it('suggests drinking to thirst for events under 90 min', () => {
    // [kenefick2018] drinking to thirst is enough for shorter events
    expect(recommendFluid({ durationMin: 60, sweatRateLph: 1.25, tempC: 25 }).drinkToThirst).toBe(true);
    expect(recommendFluid({ durationMin: 89, sweatRateLph: 1.25, tempC: 25 }).drinkToThirst).toBe(true);
    expect(recommendFluid({ durationMin: 90, sweatRateLph: 1.25, tempC: 25 }).drinkToThirst).toBe(false);
    expect(recommendFluid({ durationMin: 240, sweatRateLph: 1.25, tempC: 25 }).drinkToThirst).toBe(false);
  });

  it('suggests drinking to thirst below 15 °C', () => {
    // [kenefick2018] drinking to thirst is enough in cool conditions
    expect(recommendFluid({ durationMin: 240, sweatRateLph: 1.25, tempC: 10 }).drinkToThirst).toBe(true);
    expect(recommendFluid({ durationMin: 240, sweatRateLph: 1.25, tempC: 14.9 }).drinkToThirst).toBe(true);
    expect(recommendFluid({ durationMin: 240, sweatRateLph: 1.25, tempC: 15 }).drinkToThirst).toBe(false);
  });

  it('treats a non-finite or negative duration as 0 and ignores a non-finite temperature', () => {
    expect(recommendFluid({ durationMin: NaN, sweatRateLph: 1.25, tempC: 25 }).drinkToThirst).toBe(true);
    expect(recommendFluid({ durationMin: -30, sweatRateLph: 1.25, tempC: 25 }).drinkToThirst).toBe(true);
    expect(recommendFluid({ durationMin: 240, sweatRateLph: 1.25, tempC: NaN }).drinkToThirst).toBe(false);
    expect(recommendFluid({ durationMin: 240, sweatRateLph: 1.25 }).drinkToThirst).toBe(false);
    expect(recommendFluid({ durationMin: 240, sweatRateLph: 1.25, tempC: -Infinity }).drinkToThirst).toBe(false);
  });

  it('works with no arguments or null', () => {
    const r = recommendFluid();
    expect(r).toMatchObject({ mlPerHour: 0, range: [400, 800], drinkToThirst: true, warnings: [] });
    expect(recommendFluid({}).mlPerHour).toBe(0);
    expect(recommendFluid(null)).toEqual(r);
  });

  it('explains the plan and adds the thirst detail only when it applies', () => {
    // [sawka2007] [hewbutler2015] [kenefick2018] [almond2005]
    const long = recommendFluid({ durationMin: 180, sweatRateLph: 1.25, tempC: 20 });
    expect(long.why).toEqual({
      summary: { key: 'fluid.why.plan', params: { mlPerHour: 800, sweatMlPerHour: 1250, ...RULE_PARAMS } },
      details: [],
      citations: PLAN_CITATIONS,
    });

    const short = recommendFluid({ durationMin: 60, sweatRateLph: 0.6, tempC: 20 });
    expect(short.why).toEqual({
      summary: { key: 'fluid.why.plan', params: { mlPerHour: 500, sweatMlPerHour: 600, ...RULE_PARAMS } },
      details: [{ key: 'fluid.why.thirst' }],
      citations: PLAN_CITATIONS,
    });
  });

  it('rounds the sweat loss param to whole ml', () => {
    const r = recommendFluid({ durationMin: 180, sweatRateLph: 1.1099999999999999, tempC: 20 });
    expect(r.why.summary.params.sweatMlPerHour).toBe(1110);
  });

  it('does not warn about its own recommendation for realistic sweat rates', () => {
    expect(recommendFluid({ durationMin: 180, sweatRateLph: 1.25, tempC: 20 }).warnings).toEqual([]);
    expect(recommendFluid({ durationMin: 600, sweatRateLph: 0.25, tempC: 5 }).warnings).toEqual([]);
  });

  it('keeps the round50 rule for tiny sweat rates and flags the result', () => {
    // 0.04 L/h × 0.8 = 32 → 50 ml/h, above the 40 ml/h sweat loss
    const r = recommendFluid({ durationMin: 180, sweatRateLph: 0.04, tempC: 20 });
    expect(r.mlPerHour).toBe(50);
    expect(r.warnings.map((w) => w.id)).toEqual(['fluid.aboveSweat']);
  });

  it('does not mutate its arguments and is deterministic', () => {
    const input = Object.freeze({ durationMin: 180, sweatRateLph: 1.75, tempC: 28 });
    const a = recommendFluid(input);
    expect(recommendFluid(input)).toEqual(a);
    a.why.citations.push('x');
    a.range.push(1);
    expect(recommendFluid(input).why.citations).toEqual(PLAN_CITATIONS);
    expect(recommendFluid(input).range).toEqual([400, 800]);
  });

  it('only cites ids from the evidence registry', () => {
    for (const id of PLAN_CITATIONS) expect(CITATIONS[id]).toBeDefined();
  });

  it('stays within the cap, below sweat loss and on a 50 ml grid (property)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 5, noNaN: true }),
        fc.double({ min: 0, max: 2880, noNaN: true }),
        fc.double({ min: -20, max: 50, noNaN: true }),
        (sweatRateLph, durationMin, tempC) => {
          const r = recommendFluid({ durationMin, sweatRateLph, tempC });
          expect(Number.isFinite(r.mlPerHour)).toBe(true);
          expect(r.mlPerHour).toBeGreaterThanOrEqual(0);
          expect(r.mlPerHour).toBeLessThanOrEqual(FLUID_MAX_ML_PER_HOUR);
          expect(r.mlPerHour % 50).toBe(0);
          // round50 can lift the value by at most 25 ml above 80% of sweat loss
          expect(r.mlPerHour).toBeLessThanOrEqual(sweatRateLph * 1000 * FLUID_SHARE_OF_SWEAT + 25);
          expect(r.warnings).toEqual(fluidWarnings(r.mlPerHour, { sweatRateLph }));
          // from 0.125 L/h up, 80% + 25 ml stays at or below the sweat loss, so the plan never warns
          if (sweatRateLph >= 0.125) expect(r.warnings).toEqual([]);
          expect(r.drinkToThirst).toBe(durationMin < 90 || tempC < 15);
        },
      ),
    );
  });
});

describe('fluidWarnings', () => {
  it('flags drinking more than you sweat as dangerous', () => {
    // [almond2005] [hewbutler2015] weight gain → exercise-associated hyponatremia
    const w = fluidWarnings(900, { sweatRateLph: 0.75 });
    expect(w).toEqual([
      {
        id: 'fluid.aboveSweat',
        level: 'danger',
        message: { key: 'fluid.warn.aboveSweat', params: { mlPerHour: 900, sweatMlPerHour: 750 } },
        citations: ['almond2005', 'hewbutler2015'],
      },
    ]);
    expect(fluidWarnings(600, { sweatRateLph: 0.5 }).map((x) => x.id)).toEqual(['fluid.aboveSweat']);
  });

  it('warns above 800 ml/h when intake is still below sweat loss', () => {
    // [sawka2007] upper end of the 0.4–0.8 L/h range
    expect(fluidWarnings(900, { sweatRateLph: 2.0 })).toEqual([
      {
        id: 'fluid.aboveCeiling',
        level: 'warning',
        message: { key: 'fluid.warn.aboveCeiling', params: { mlPerHour: 900, maxMlPerHour: 800 } },
        citations: ['sawka2007'],
      },
    ]);
  });

  it('returns only the danger when intake is above both sweat loss and the ceiling', () => {
    expect(fluidWarnings(1500, { sweatRateLph: 1.0 }).map((x) => x.id)).toEqual(['fluid.aboveSweat']);
  });

  it('has no warnings at or below sweat loss and the ceiling', () => {
    expect(fluidWarnings(800, { sweatRateLph: 0.8 })).toEqual([]);
    expect(fluidWarnings(800, { sweatRateLph: 2.0 })).toEqual([]);
    expect(fluidWarnings(500, { sweatRateLph: 1.25 })).toEqual([]);
  });

  it('ignores float noise when intake equals the estimated sweat loss', () => {
    // [almond2005] [hewbutler2015] strict ">": intake equal to sweat loss is not a danger
    expect(fluidWarnings(550, { sweatRateLph: 0.5499999999999999 })).toEqual([]);
    expect(fluidWarnings(450, { sweatRateLph: 0.44999999999999996 })).toEqual([]);
    const male = estimateSweatRateLegacy({ sex: 'male', intensity: 'moderate', tempC: 3, humidity: 40 });
    expect(male * 1000).toBeLessThan(550);
    expect(fluidWarnings(550, { sweatRateLph: male })).toEqual([]);
    const easy = estimateSweatRateLegacy({ sex: 'unspecified', intensity: 'easy', tempC: 18, humidity: 18 });
    expect(fluidWarnings(450, { sweatRateLph: easy })).toEqual([]);
    // one ml/h above the sweat loss still warns, with the shown sweat loss
    expect(fluidWarnings(551, { sweatRateLph: male })).toEqual([
      {
        id: 'fluid.aboveSweat',
        level: 'danger',
        message: { key: 'fluid.warn.aboveSweat', params: { mlPerHour: 551, sweatMlPerHour: 550 } },
        citations: ['almond2005', 'hewbutler2015'],
      },
    ]);
  });

  it('never flags intake equal to any legacy estimate on the 50 ml grid as above sweat loss', () => {
    for (const sex of ['unspecified', 'female', 'male']) {
      for (const intensity of ['easy', 'moderate', 'hard', 'race']) {
        for (let tempC = -20; tempC <= 50; tempC += 1) {
          for (let humidity = 0; humidity <= 100; humidity += 1) {
            const sweatRateLph = estimateSweatRateLegacy({ sex, intensity, tempC, humidity });
            const ml = Math.round(sweatRateLph * 1000);
            if (ml % 50 !== 0) continue;
            const ids = fluidWarnings(ml, { sweatRateLph }).map((w) => w.id);
            expect(ids, `${sex}/${intensity}/${tempC} °C/${humidity} %`).not.toContain('fluid.aboveSweat');
          }
        }
      }
    }
  });

  it('only warns above sweat loss when the shown numbers agree (property)', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 5, noNaN: true }), fc.integer({ min: 1, max: 3000 }), (sweatRateLph, ml) => {
        const shown = Math.round(sweatRateLph * 1000);
        const w = fluidWarnings(ml, { sweatRateLph });
        const above = w.find((x) => x.id === 'fluid.aboveSweat');
        expect(Boolean(above)).toBe(ml > shown);
        if (above) {
          expect(above.message.params.sweatMlPerHour).toBe(shown);
          expect(above.message.params.mlPerHour).toBeGreaterThan(above.message.params.sweatMlPerHour);
        }
      }),
    );
  });

  it('treats a zero or negative sweat rate as no sweat loss', () => {
    expect(fluidWarnings(100, { sweatRateLph: 0 }).map((x) => x.id)).toEqual(['fluid.aboveSweat']);
    expect(fluidWarnings(100, { sweatRateLph: -1 }).map((x) => x.id)).toEqual(['fluid.aboveSweat']);
  });

  it('skips the sweat check when the sweat rate is unknown', () => {
    expect(fluidWarnings(900, { sweatRateLph: NaN }).map((x) => x.id)).toEqual(['fluid.aboveCeiling']);
    expect(fluidWarnings(900).map((x) => x.id)).toEqual(['fluid.aboveCeiling']);
    expect(fluidWarnings(900, null).map((x) => x.id)).toEqual(['fluid.aboveCeiling']);
    expect(fluidWarnings(500, {})).toEqual([]);
    expect(fluidWarnings(500, null)).toEqual([]);
  });

  it('returns no warnings for zero, negative or non-finite intake', () => {
    for (const ml of [0, -100, NaN, Infinity, undefined]) {
      expect(fluidWarnings(ml, { sweatRateLph: 1.0 })).toEqual([]);
    }
  });

  it('only cites ids from the evidence registry', () => {
    const all = [...fluidWarnings(900, { sweatRateLph: 0.5 }), ...fluidWarnings(900, { sweatRateLph: 2 })];
    for (const w of all) for (const id of w.citations) expect(CITATIONS[id]).toBeDefined();
  });
});

describe('i18n catalog (src/i18n/en/fluid.js)', () => {
  const samples = [
    recommendFluid({ durationMin: 180, sweatRateLph: 1.25, tempC: 20 }),
    recommendFluid({ durationMin: 60, sweatRateLph: 0.5, tempC: 10 }),
    recommendFluid(),
    fluidWarnings(900, { sweatRateLph: 0.5 }),
    fluidWarnings(900, { sweatRateLph: 2.0 }),
  ];

  it('has text for every message key the module returns', () => {
    const keys = new Set(samples.flatMap(messagesOf).map((m) => m.key));
    expect([...keys].sort()).toEqual([
      'fluid.warn.aboveCeiling',
      'fluid.warn.aboveSweat',
      'fluid.why.plan',
      'fluid.why.thirst',
    ]);
    for (const key of keys) expect(typeof fluidCatalog[key], key).toBe('string');
  });

  it('only uses placeholders the module provides as params', () => {
    for (const message of samples.flatMap(messagesOf)) {
      for (const name of placeholders(fluidCatalog[message.key])) {
        expect(message.params ?? {}, `${message.key} {${name}}`).toHaveProperty([name]);
      }
    }
  });

  it('keeps every key in the fluid namespace', () => {
    for (const key of Object.keys(fluidCatalog)) expect(key.startsWith('fluid.')).toBe(true);
  });

  it('takes the share and the cap of the plan text from params', () => {
    // round50 can lift the plan above 80% (0.3 L/h → 250 ml/h = 83%), so the text must not say "up to"
    expect(recommendFluid({ durationMin: 180, sweatRateLph: 0.3, tempC: 20 }).mlPerHour).toBe(250);
    expect(fluidCatalog['fluid.why.plan']).not.toMatch(/up to|80|800/);
    expect(placeholders(fluidCatalog['fluid.why.plan'])).toEqual(
      expect.arrayContaining(['sharePct', 'maxMlPerHour']),
    );
  });
});
