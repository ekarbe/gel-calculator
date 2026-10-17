import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  FLUID_MAX_ML_PER_HOUR,
  FLUID_SHARE_OF_SWEAT,
  DEFICIT_MILD_PCT,
  DEFICIT_HIGH_PCT,
  recommendFluid,
  fluidWarnings,
  projectBodyMass,
} from './hydration';
import { estimateSweatRate } from './heatBalance';
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
  return [...text.matchAll(/\{(\w+)(?::\w+)*\}/g)].map((m) => m[1]);
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

  it('never rounds a tiny sweat rate up above the sweat loss', () => {
    // [hewbutler2015] 0.04 L/h × 0.8 = 32 → round50 gives 50 ml/h, above the 40 ml/h sweat loss:
    // the plan takes the sweat loss rounded down to 50 ml/h instead.
    const r = recommendFluid({ durationMin: 180, sweatRateLph: 0.04, tempC: 20 });
    expect(r.mlPerHour).toBe(0);
    expect(r.warnings).toEqual([]);
    // 0.096 L/h × 0.8 = 77 → 100 ml/h by round50, above the 96 ml/h loss → 50 ml/h.
    expect(recommendFluid({ durationMin: 180, sweatRateLph: 0.096, tempC: 20 }).mlPerHour).toBe(50);
    // Exactly the sweat loss is not above it.
    expect(recommendFluid({ durationMin: 180, sweatRateLph: 0.05, tempC: 20 })).toMatchObject({ mlPerHour: 50, warnings: [] });
  });

  it('never warns about its own recommendation from 0 to 0.125 L/h', () => {
    for (let ml = 0; ml <= 125; ml += 0.5) {
      const r = recommendFluid({ durationMin: 180, sweatRateLph: ml / 1000, tempC: 20 });
      expect(r.warnings).toEqual([]);
      expect(r.mlPerHour).toBeLessThanOrEqual(Math.round(ml));
    }
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
          // and never above the sweat loss (whole ml/h), so the plan never warns about itself
          expect(r.mlPerHour).toBeLessThanOrEqual(Math.round(sweatRateLph * 1000));
          expect(r.warnings).toEqual(fluidWarnings(r.mlPerHour, { sweatRateLph }));
          expect(r.warnings).toEqual([]);
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
    // sums of rounded terms land just below the value they stand for
    const male = 0.96 - 0.36 - 0.05;
    expect(male * 1000).toBeLessThan(550);
    expect(fluidWarnings(550, { sweatRateLph: male })).toEqual([]);
    const easy = 0.52 + 0.09 - 0.16;
    expect(easy * 1000).toBeLessThan(450);
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

  it('never flags intake equal to a heat-balance estimate (in whole ml/h) as above sweat loss', () => {
    for (const sport of ['running', 'cycling', 'other']) {
      for (let tempC = -20; tempC <= 50; tempC += 2) {
        for (let humidity = 0; humidity <= 100; humidity += 5) {
          const sweatRateLph = estimateSweatRate({ sport, tempC, humidity }).rateLph;
          const ml = Math.round(sweatRateLph * 1000);
          if (ml <= 0) continue;
          const ids = fluidWarnings(ml, { sweatRateLph }).map((w) => w.id);
          expect(ids, `${sport}/${tempC} °C/${humidity} %`).not.toContain('fluid.aboveSweat');
          // and the projection agrees: no gain
          expect(projectBodyMass({ sweatRateLph, fluidMlPerHour: ml, durationMin: 240, massKg: 70 }).level).not.toBe('gain');
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

describe('projectBodyMass', () => {
  it('projects a mild deficit above 2 % of body mass', () => {
    // [sawka2007] 1.0 L/h sweat, 500 ml/h drunk, 3 h: 1.5 L = 2.14 % of 70 kg
    // [cheuvront2017] the scale also drops 0.0002 kg × 900 kcal/h × 3 h = 0.54 kg
    const p = projectBodyMass({ sweatRateLph: 1.0, fluidMlPerHour: 500, durationMin: 180, massKg: 70, energyKcalPerHour: 900 });
    expect(p.waterDeficitL).toBeCloseTo(1.5, 12);
    expect(p.deficitPct).toBeCloseTo(2.142857, 5);
    expect(p.scaleChangeKg).toBeCloseTo(-2.04, 12);
    expect(p.level).toBe('mild');
    expect(p.warnings).toEqual([
      {
        id: 'fluid.deficitMild',
        level: 'info',
        message: { key: 'fluid.warn.deficitMild', params: { deficitL: 1.5, deficitPct: 2.1, limitPct: 2 } },
        citations: ['sawka2007'],
      },
    ]);
  });

  it('warns about a deficit above 3 % of body mass', () => {
    // [sawka2007] 1.5 L/h sweat, 400 ml/h drunk, 4 h: 4.4 L = 7.3 % of 60 kg
    const p = projectBodyMass({ sweatRateLph: 1.5, fluidMlPerHour: 400, durationMin: 240, massKg: 60, energyKcalPerHour: 800 });
    expect(p.waterDeficitL).toBeCloseTo(4.4, 12);
    expect(p.deficitPct).toBeCloseTo(7.3333, 4);
    expect(p.scaleChangeKg).toBeCloseTo(-4.4 - 0.64, 12);
    expect(p.level).toBe('high');
    expect(p.warnings).toEqual([
      {
        id: 'fluid.deficitHigh',
        level: 'warning',
        message: { key: 'fluid.warn.deficitHigh', params: { deficitL: 4.4, deficitPct: 7.3, limitPct: 3 } },
        citations: ['sawka2007'],
      },
    ]);
  });

  it('flags a projected water gain as a danger', () => {
    // [hewbutler2015] 0.5 L/h sweat, 800 ml/h drunk, 4 h: 1.2 L more water than sweat
    const p = projectBodyMass({ sweatRateLph: 0.5, fluidMlPerHour: 800, durationMin: 240, massKg: 70, energyKcalPerHour: 600 });
    expect(p.waterDeficitL).toBeCloseTo(-1.2, 12);
    expect(p.deficitPct).toBeCloseTo(-1.7143, 4);
    // the scale shows less than the water gain: 1.2 − 0.0002 × 600 × 4 = 0.72 kg
    expect(p.scaleChangeKg).toBeCloseTo(0.72, 12);
    expect(p.level).toBe('gain');
    expect(p.warnings).toEqual([
      {
        id: 'fluid.projectedGain',
        level: 'danger',
        message: { key: 'fluid.warn.projectedGain', params: { gainL: 1.2 } },
        citations: ['hewbutler2015'],
      },
    ]);
  });

  it('is ok up to 2 % and mild up to 3 % of the shown (0.1 %) value', () => {
    expect(DEFICIT_MILD_PCT).toBe(2);
    expect(DEFICIT_HIGH_PCT).toBe(3);
    // 50 kg, 2 h: 500 ml/h net → 1.0 L = 2 %; 750 ml/h net → 1.5 L = 3 %
    const at = (sweatRateLph) => projectBodyMass({ sweatRateLph, fluidMlPerHour: 0, durationMin: 120, massKg: 50 });
    expect(at(0.5).deficitPct).toBe(2);
    expect(at(0.5).level).toBe('ok');
    expect(at(0.5).warnings).toEqual([]);
    // 2.004 % shows as 2 %: still ok, so no message reads "2% … above 2%"
    expect(at(0.501).deficitPct).toBeCloseTo(2.004, 12);
    expect(at(0.501).level).toBe('ok');
    expect(at(0.53).level).toBe('mild');
    expect(at(0.53).warnings[0].message.params).toEqual({ deficitL: 1.1, deficitPct: 2.1, limitPct: 2 });
    expect(at(0.75).deficitPct).toBe(3);
    expect(at(0.75).level).toBe('mild');
    expect(at(0.76).deficitPct).toBeCloseTo(3.04, 12);
    expect(at(0.76).level).toBe('mild');
    expect(at(0.76).warnings[0].message.params.deficitPct).toBe(3);
    expect(at(0.77).level).toBe('high');
    expect(at(0.77).warnings[0].message.params).toEqual({ deficitL: 1.5, deficitPct: 3.1, limitPct: 3 });
  });

  it('never shows a deficit at or below the limit it says was passed', () => {
    // 1.0 L/h sweat, 500 ml/h drunk, 2 h, 49 kg → 1.0 L = 2.04 %, shown as 2 %
    expect(projectBodyMass({ sweatRateLph: 1.0, fluidMlPerHour: 500, durationMin: 120, massKg: 49 }).level).toBe('ok');
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 4, noNaN: true }),
        fc.integer({ min: 0, max: 1500 }),
        fc.integer({ min: 1, max: 1440 }),
        fc.double({ min: 30, max: 200, noNaN: true }),
        (sweatRateLph, fluidMlPerHour, durationMin, massKg) => {
          for (const w of projectBodyMass({ sweatRateLph, fluidMlPerHour, durationMin, massKg }).warnings) {
            const { deficitPct, limitPct } = w.message.params;
            if (limitPct !== undefined) expect(deficitPct).toBeGreaterThan(limitPct);
          }
        },
      ),
    );
  });

  it('uses the spec formula without rounding the sweat rate', () => {
    // waterDeficitL = (SR − F/1000) × h: 1.5858 L/h for 10 h → 15.858 L (not 15.86)
    const p = projectBodyMass({ sweatRateLph: 1.5858, fluidMlPerHour: 0, durationMin: 600, massKg: 70, energyKcalPerHour: 900 });
    expect(p.waterDeficitL).toBeCloseTo(15.858, 12);
    expect(p.deficitPct).toBeCloseTo((100 * 15.858) / 70, 12);
    expect(p.scaleChangeKg).toBeCloseTo(-15.858 - 0.0002 * 900 * 10, 12);
    const q = projectBodyMass({ sweatRateLph: 0.9506, fluidMlPerHour: 600, durationMin: 150, massKg: 70 });
    expect(q.waterDeficitL).toBeCloseTo((0.9506 - 0.6) * 2.5, 12);
  });

  it('gives no projection for an unknown sweat rate, like fluidWarnings', () => {
    const none = { waterDeficitL: 0, deficitPct: 0, scaleChangeKg: 0, level: 'ok', warnings: [] };
    for (const sweatRateLph of [undefined, null, NaN, Infinity, -Infinity, '1.2']) {
      const p = projectBodyMass({ sweatRateLph, fluidMlPerHour: 500, durationMin: 120, massKg: 70, energyKcalPerHour: 800 });
      expect(p, String(sweatRateLph)).toEqual(none);
      expect(fluidWarnings(500, { sweatRateLph })).toEqual([]);
    }
  });

  it('is ok when intake matches sweat loss, also with float noise in the rate', () => {
    for (const sweatRateLph of [0.55, 0.96 - 0.36 - 0.05]) {
      const p = projectBodyMass({ sweatRateLph, fluidMlPerHour: 550, durationMin: 300, massKg: 70 });
      expect(p).toEqual({ waterDeficitL: 0, deficitPct: 0, scaleChangeKg: 0, level: 'ok', warnings: [] });
      expect(Object.is(p.waterDeficitL, -0)).toBe(false);
    }
    // one ml/h above the sweat loss is a gain, shown as at least 0.01 L
    const over = projectBodyMass({ sweatRateLph: 0.55, fluidMlPerHour: 551, durationMin: 60, massKg: 70 });
    expect(over.level).toBe('gain');
    expect(over.warnings[0].message.params.gainL).toBe(0.01);
  });

  it('compares and writes a manual intake in whole ml/h (34 fl oz/h is stored as 1005.5 ml/h)', () => {
    const [ceiling] = fluidWarnings(1005.5, {});
    expect(ceiling.message.params.mlPerHour).toBe(1006);
    const [above] = fluidWarnings(1005.5, { sweatRateLph: 0.8 });
    expect(above.message.params).toEqual({ mlPerHour: 1006, sweatMlPerHour: 800 });
    // Half a ml/h above the sweat loss rounds to it: no "550 ml/h is more than 550 ml/h".
    expect(fluidWarnings(550.4, { sweatRateLph: 0.55 })).toEqual([]);
    expect(projectBodyMass({ sweatRateLph: 0.55, fluidMlPerHour: 550.4, durationMin: 60, massKg: 70 }).level).toBe('ok');
  });

  it('agrees with fluidWarnings about drinking more than you sweat (property)', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.double({ min: -1, max: 4, noNaN: true }), fc.constantFrom(NaN, Infinity, undefined)),
        fc.oneof(fc.integer({ min: 1, max: 3000 }), fc.double({ min: 0, max: 3000, noNaN: true })),
        fc.integer({ min: 1, max: 2880 }),
        (sweatRateLph, fluidMlPerHour, durationMin) => {
          const p = projectBodyMass({ sweatRateLph, fluidMlPerHour, durationMin, massKg: 70 });
          const above = fluidWarnings(fluidMlPerHour, { sweatRateLph }).some((w) => w.id === 'fluid.aboveSweat');
          expect(p.level === 'gain').toBe(above);
        },
      ),
    );
  });

  it('keeps level, warnings and numbers consistent (property)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 4, noNaN: true }),
        fc.double({ min: 0, max: 3000, noNaN: true }),
        fc.double({ min: 0, max: 2880, noNaN: true }),
        fc.double({ min: 30, max: 200, noNaN: true }),
        fc.double({ min: 0, max: 2000, noNaN: true }),
        (sweatRateLph, fluidMlPerHour, durationMin, massKg, energyKcalPerHour) => {
          const p = projectBodyMass({ sweatRateLph, fluidMlPerHour, durationMin, massKg, energyKcalPerHour });
          for (const x of [p.waterDeficitL, p.deficitPct, p.scaleChangeKg]) expect(Number.isFinite(x)).toBe(true);
          expect(p.scaleChangeKg).toBeLessThanOrEqual(-p.waterDeficitL + 1e-12);
          expect(Math.sign(p.deficitPct)).toBe(Math.sign(p.waterDeficitL));
          // the spec formula; only sub-0.5 ml/h rounding of the sweat rate and the intake is set to 0
          const hours = durationMin / 60;
          const spec = (sweatRateLph - fluidMlPerHour / 1000) * hours;
          const gain = hours > 0 && Math.round(fluidMlPerHour) > Math.round(sweatRateLph * 1000);
          expect(p.waterDeficitL).toBeCloseTo(gain ? Math.min(spec, 0) : Math.max(spec, 0), 9);
          expect(Math.abs(p.waterDeficitL - spec)).toBeLessThanOrEqual(0.001 * hours + 1e-9);
          expect(p.scaleChangeKg).toBeCloseTo(-p.waterDeficitL - 0.0002 * energyKcalPerHour * hours, 9);
          if (gain) expect(p.waterDeficitL).toBeLessThanOrEqual(0);
          else expect(p.waterDeficitL).toBeGreaterThanOrEqual(0);
          const shown = Math.round(p.deficitPct * 10) / 10;
          const expected = gain ? 'gain' : shown > 3 ? 'high' : shown > 2 ? 'mild' : 'ok';
          expect(p.level).toBe(expected);
          expect(p.warnings).toHaveLength(p.level === 'ok' ? 0 : 1);
        },
      ),
    );
  });

  it('counts missing, negative or non-finite numbers as 0', () => {
    const zero = { waterDeficitL: 0, deficitPct: 0, scaleChangeKg: 0, level: 'ok', warnings: [] };
    expect(projectBodyMass()).toEqual(zero);
    expect(projectBodyMass(null)).toEqual(zero);
    expect(projectBodyMass({ sweatRateLph: 1, fluidMlPerHour: 500, durationMin: 0, massKg: 70 })).toEqual(zero);
    expect(projectBodyMass({ sweatRateLph: 1, fluidMlPerHour: 500, durationMin: -60, massKg: 70 })).toEqual(zero);
    expect(projectBodyMass({ sweatRateLph: NaN, fluidMlPerHour: -5, durationMin: 60, massKg: 70, energyKcalPerHour: Infinity })).toEqual(zero);
    // without a body mass the percentage is 0, but a gain is still a gain
    const noMass = projectBodyMass({ sweatRateLph: 0.4, fluidMlPerHour: 600, durationMin: 120, massKg: undefined });
    expect(noMass.deficitPct).toBe(0);
    expect(noMass.waterDeficitL).toBeCloseTo(-0.4, 12);
    expect(noMass.level).toBe('gain');
    expect(projectBodyMass({ sweatRateLph: 2, fluidMlPerHour: 0, durationMin: 600, massKg: 0 }).level).toBe('ok');
  });

  it('does not mutate its input and is deterministic', () => {
    const input = Object.freeze({ sweatRateLph: 1.2, fluidMlPerHour: 500, durationMin: 240, massKg: 70, energyKcalPerHour: 800 });
    const a = projectBodyMass(input);
    expect(a).toEqual(projectBodyMass({ ...input }));
    a.warnings.push('x');
    expect(projectBodyMass(input).warnings).toHaveLength(1);
    const none = projectBodyMass(Object.freeze({}));
    none.warnings.push('x');
    expect(projectBodyMass({}).warnings).toEqual([]);
  });

  it('only cites ids from the evidence registry', () => {
    const all = [
      projectBodyMass({ sweatRateLph: 0.5, fluidMlPerHour: 800, durationMin: 240, massKg: 70 }),
      projectBodyMass({ sweatRateLph: 1.5, fluidMlPerHour: 400, durationMin: 240, massKg: 60 }),
      projectBodyMass({ sweatRateLph: 1.0, fluidMlPerHour: 500, durationMin: 180, massKg: 70 }),
    ].flatMap((p) => p.warnings);
    expect(all).toHaveLength(3);
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
    projectBodyMass({ sweatRateLph: 0.5, fluidMlPerHour: 800, durationMin: 240, massKg: 70 }).warnings,
    projectBodyMass({ sweatRateLph: 1.5, fluidMlPerHour: 400, durationMin: 240, massKg: 60 }).warnings,
    projectBodyMass({ sweatRateLph: 1.0, fluidMlPerHour: 500, durationMin: 180, massKg: 70 }).warnings,
  ];

  it('has text for every message key the module returns', () => {
    const keys = new Set(samples.flatMap(messagesOf).map((m) => m.key));
    expect([...keys].sort()).toEqual([
      'fluid.warn.aboveCeiling',
      'fluid.warn.aboveSweat',
      'fluid.warn.deficitHigh',
      'fluid.warn.deficitMild',
      'fluid.warn.projectedGain',
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
