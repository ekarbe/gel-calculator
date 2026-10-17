import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getGelTimes, getGelCount, formatElapsed, buildSchedule, DRINK_INTERVAL_MIN } from './schedule';
import catalog from '../i18n/en/schedule';

const EVENT_TYPES = ['bicarb', 'caffeine', 'start', 'fuel', 'drink', 'hydration', 'finish'];

// Hand-built plan objects in the shape `planCaffeine` / `planBicarbonate` return
// (spec section 5), so these tests do not depend on those modules.

/** 70 kg, 3 mg/kg, 180 min, caffeine taken on its own: pre 140 mg, intra 70 mg at 120 min. */
const CAFFEINE_180 = {
  enabled: true,
  doses: [
    { timeMin: -60, mg: 140, kind: 'pre', gelIndex: null, tablets: null },
    { timeMin: 120, mg: 70, kind: 'intra', gelIndex: null, tablets: null },
  ],
  totalMg: 210,
  totalMgPerKg: 3,
  peakBodyLoadMgPerKg: 2.5,
  why: { summary: { key: 'caffeine.why.medium' }, citations: ['guest2021'] },
  warnings: [],
};

/** Same with 100 mg tablets added to the gels (3 gels/h → gel times 0, 20, …, 160; index 6 = 120 min). */
const CAFFEINE_180_TABLETS = {
  enabled: true,
  doses: [
    { timeMin: -60, mg: 150, kind: 'pre', gelIndex: null, tablets: 1.5 },
    { timeMin: 120, mg: 50, kind: 'intra', gelIndex: 6, tablets: 0.5 },
  ],
  totalMg: 200,
  totalMgPerKg: 200 / 70,
  peakBodyLoadMgPerKg: 2.6,
  why: { summary: { key: 'caffeine.why.medium' }, citations: ['guest2021'] },
  warnings: [],
};

const CAFFEINE_OFF = {
  enabled: false,
  doses: [],
  totalMg: 0,
  totalMgPerKg: 0,
  peakBodyLoadMgPerKg: 0,
  why: { summary: { key: 'caffeine.why.short' }, citations: [] },
  warnings: [],
};

/** 70 kg, 0.3 g/kg: 21 g sodium bicarbonate, 21 × 1000 × 0.2737 = 5747.7 mg sodium. */
const BICARB_ON = {
  enabled: true,
  eligible: true,
  visibleByDefault: true,
  doseG: 21,
  sodiumMg: 5747.7,
  timingMin: { earliest: -180, latest: -60, recommended: -90 },
  why: { summary: { key: 'bicarb.why' }, citations: ['grgic2021'] },
  warnings: [],
};

const BICARB_OFF = { ...BICARB_ON, enabled: false, doseG: 0, sodiumMg: 0 };

const byType = (events, type) => events.filter((e) => e.type === type);
const at = (events, timeMin) => events.filter((e) => e.timeMin === timeMin);

describe('getGelTimes / getGelCount / formatElapsed (moved from the former src/lib/schedule.js)', () => {
  it('takes the first gel at the start and one per interval after', () => {
    expect(getGelTimes(60, 2)).toEqual([0, 30]);
    expect(getGelTimes(90, 2)).toEqual([0, 30, 60]);
  });

  it('counts a gel for a partial final interval so per-gel amounts match the schedule', () => {
    expect(getGelCount(75, 2)).toBe(3);
  });

  it('does not add a gel at the finish line due to float drift', () => {
    expect(getGelCount(60, 7)).toBe(7);
    expect(getGelCount(180, 3)).toBe(9);
  });

  it('returns no gels when gels per hour is zero or invalid', () => {
    expect(getGelTimes(60, 0)).toEqual([]);
    expect(getGelTimes(60, -1)).toEqual([]);
    expect(getGelCount(60, NaN)).toBe(0);
  });

  it('takes one gel at the start when the rate is too small for a finite interval', () => {
    // 60 / 5e-324 overflows to Infinity; 0 * Infinity used to give [NaN].
    expect(getGelTimes(180, Number.MIN_VALUE)).toEqual([0]);
    expect(getGelTimes(180, 1e-10)).toEqual([0]);
    expect(getGelCount(180, Number.MIN_VALUE)).toBe(1);
  });

  it('returns no gels for an infinite duration instead of building an endless list', () => {
    expect(getGelTimes(Infinity, 3)).toEqual([]);
    expect(getGelTimes(-Infinity, 3)).toEqual([]);
  });

  it('formats elapsed time without producing 60 minutes', () => {
    expect(formatElapsed(30)).toBe('T+30m');
    expect(formatElapsed(60)).toBe('T+1h');
    expect(formatElapsed(85.7)).toBe('T+1h 26m');
    expect(formatElapsed(119.6)).toBe('T+2h');
  });

  it('formats times before the start with a minus sign on the absolute value', () => {
    expect(formatElapsed(-90)).toBe('T\u22121h 30m');
    expect(formatElapsed(-60)).toBe('T\u22121h');
    expect(formatElapsed(-30)).toBe('T\u221230m');
    expect(formatElapsed(-1)).toBe('T\u22121m');
    expect(formatElapsed(-180.4)).toBe('T\u22123h');
    // Anything that rounds to 0 is the start.
    expect(formatElapsed(-0.4)).toBe('T+0m');
    expect(formatElapsed(0)).toBe('T+0m');
  });

  it('formats every buildSchedule event time, including pre-race doses', () => {
    const events = buildSchedule({
      durationMin: 180,
      gelsPerHour: 1,
      fluidMlPerHour: 500,
      caffeine: CAFFEINE_180,
      bicarb: BICARB_ON,
    });
    expect(events.map((e) => [e.type, formatElapsed(e.timeMin)])).toEqual([
      ['bicarb', 'T\u22121h 30m'],
      ['caffeine', 'T\u22121h'],
      ['start', 'T+0m'],
      ['fuel', 'T+1h'],
      ['fuel', 'T+2h'],
      ['caffeine', 'T+2h'],
      ['finish', 'T+3h'],
    ]);
  });

  it('gives one gel at the start for a zero duration and none for a negative one', () => {
    expect(getGelTimes(0, 3)).toEqual([0]);
    expect(getGelTimes(-10, 3)).toEqual([]);
    expect(getGelTimes(NaN, 3)).toEqual([]);
  });
});

describe('buildSchedule: gels and fluid', () => {
  it('builds start, one fuel event per later gel, and finish', () => {
    expect(buildSchedule({ durationMin: 60, gelsPerHour: 2, fluidMlPerHour: 500 })).toEqual([
      {
        timeMin: 0,
        type: 'start',
        message: { key: 'schedule.startWithGelAndFluid', params: { fluidMl: 250 } },
        fluidMl: 250,
      },
      {
        timeMin: 30,
        type: 'fuel',
        message: { key: 'schedule.fuelWithFluid', params: { gel: 2, fluidMl: 250 } },
        fluidMl: 250,
      },
      { timeMin: 60, type: 'finish', message: { key: 'schedule.finish' } },
    ]);
  });

  it('adds a fuel event for every gel time after 0 and numbers gels from 1', () => {
    const events = buildSchedule({ durationMin: 180, gelsPerHour: 3, fluidMlPerHour: 600 });
    const fuel = byType(events, 'fuel');
    expect(fuel.map((e) => e.timeMin)).toEqual([20, 40, 60, 80, 100, 120, 140, 160]);
    expect(fuel.map((e) => e.message.params.gel)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    // 600 ml/h × 20 min / 60 = 200 ml per gel
    expect(fuel.every((e) => e.fluidMl === 200)).toBe(true);
    expect(events[0]).toEqual({
      timeMin: 0,
      type: 'start',
      message: { key: 'schedule.startWithGelAndFluid', params: { fluidMl: 200 } },
      fluidMl: 200,
    });
    expect(events.at(-1)).toEqual({ timeMin: 180, type: 'finish', message: { key: 'schedule.finish' } });
  });

  it('rounds the fluid per gel to 10 ml', () => {
    // 500 ml/h × 20 min / 60 = 166.7 → 170
    const fuel = byType(buildSchedule({ durationMin: 180, gelsPerHour: 3, fluidMlPerHour: 500 }), 'fuel');
    expect(fuel[0].fluidMl).toBe(170);
    expect(fuel[0].message).toEqual({ key: 'schedule.fuelWithFluid', params: { gel: 2, fluidMl: 170 } });
    // 450 ml/h × 7.5 min / 60 = 56.25 → 60
    const fuel8 = byType(buildSchedule({ durationMin: 120, gelsPerHour: 8, fluidMlPerHour: 450 }), 'fuel');
    expect(fuel8[0].fluidMl).toBe(60);
  });

  it('leaves out the fluid when there is no fluid target or it rounds to 0', () => {
    for (const fluidMlPerHour of [0, -200, NaN, undefined]) {
      expect(buildSchedule({ durationMin: 90, gelsPerHour: 2, fluidMlPerHour })).toEqual([
        { timeMin: 0, type: 'start', message: { key: 'schedule.startWithGel' } },
        { timeMin: 30, type: 'fuel', message: { key: 'schedule.fuel', params: { gel: 2 } } },
        { timeMin: 60, type: 'fuel', message: { key: 'schedule.fuel', params: { gel: 3 } } },
        { timeMin: 90, type: 'finish', message: { key: 'schedule.finish' } },
      ]);
    }
    // 20 ml/h × 5 min / 60 = 1.7 → 0
    const events = buildSchedule({ durationMin: 60, gelsPerHour: 12, fluidMlPerHour: 20 });
    const fuel = byType(events, 'fuel');
    expect(fuel).toHaveLength(11);
    expect(fuel.every((e) => !('fluidMl' in e) && e.message.key === 'schedule.fuel')).toBe(true);
    expect(events[0]).toEqual({ timeMin: 0, type: 'start', message: { key: 'schedule.startWithGel' } });
  });

  it('keeps the fluid target as a hydration event when the fluid per gel rounds to 0', () => {
    // 20 ml/h at 12 gels/h is 1.7 ml per gel, which rounds to 0.
    const events = buildSchedule({ durationMin: 60, gelsPerHour: 12, fluidMlPerHour: 20 });
    expect(byType(events, 'hydration')).toEqual([
      { timeMin: 0, type: 'hydration', message: { key: 'schedule.hydrationOnly', params: { mlPerHour: 20 } } },
    ]);
    expect(events.some((e) => 'fluidMl' in e)).toBe(false);
  });

  it('gives the first gel its fluid, so a one-gel plan keeps the fluid target', () => {
    // 60 min at 1 gel/h: the only gel is at the start.
    expect(buildSchedule({ durationMin: 60, gelsPerHour: 1, fluidMlPerHour: 500 })).toEqual([
      {
        timeMin: 0,
        type: 'start',
        message: { key: 'schedule.startWithGelAndFluid', params: { fluidMl: 500 } },
        fluidMl: 500,
      },
      { timeMin: 60, type: 'finish', message: { key: 'schedule.finish' } },
    ]);
    // 40 min at 1.5 gels/h: one gel, 500 ml/h × 40 min / 60 = 333 → 330
    const [start] = buildSchedule({ durationMin: 40, gelsPerHour: 1.5, fluidMlPerHour: 500 });
    expect(start.fluidMl).toBe(330);
    // 20 min at 3 gels/h: one gel, 500 ml/h × 20 min / 60 = 167 → 160 (rounded down, never above the plan)
    expect(buildSchedule({ durationMin: 20, gelsPerHour: 3, fluidMlPerHour: 500 })[0].fluidMl).toBe(160);
  });

  // [almond2005] [hewbutler2015] the schedule must never list more fluid than the plan
  it('gives the last gel only the fluid until the finish', () => {
    const fluidOf = (events) => events.filter((e) => e.type === 'start' || e.type === 'fuel').map((e) => e.fluidMl ?? 0);
    // 61 min at 1 gel/h: gel 2 at 60 min covers the last minute only (813 ml in total).
    expect(fluidOf(buildSchedule({ durationMin: 61, gelsPerHour: 1, fluidMlPerHour: 800 }))).toEqual([800, 10]);
    // 30 min at 3 gels/h: gel 2 at 20 min covers 10 min (400 ml in total, not 2 × 270).
    expect(fluidOf(buildSchedule({ durationMin: 30, gelsPerHour: 3, fluidMlPerHour: 800 }))).toEqual([260, 140]);
    // 130 min at 1 gel/h: 1733 ml in total, not 3 × 800.
    expect(fluidOf(buildSchedule({ durationMin: 130, gelsPerHour: 1, fluidMlPerHour: 800 }))).toEqual([800, 800, 130]);
  });

  it('rounds on the running total, so many small gels add up to the plan', () => {
    const total = (events) => events.reduce((sum, e) => sum + (e.fluidMl ?? 0), 0);
    // 12 gels/h at 800 ml/h: 66.7 ml each; rounding each gel alone would list 840 ml in the hour.
    const twelve = buildSchedule({ durationMin: 60, gelsPerHour: 12, fluidMlPerHour: 800 });
    expect(total(twelve)).toBe(800);
    expect(new Set(twelve.filter((e) => 'fluidMl' in e).map((e) => e.fluidMl))).toEqual(new Set([60, 70]));
    // 190 min at 3 gels/h, 800 ml/h: 2533 ml planned → 2530 ml listed (was 2700).
    expect(total(buildSchedule({ durationMin: 190, gelsPerHour: 3, fluidMlPerHour: 800 }))).toBe(2530);
  });

  it('caps the fluid of a single gel at the event duration', () => {
    // 0.25 gels/h is one gel per 240 min, but the event lasts only 60 min: 500 ml, not 2000 ml.
    const [start] = buildSchedule({ durationMin: 60, gelsPerHour: 0.25, fluidMlPerHour: 500 });
    expect(start.fluidMl).toBe(500);
  });

  it('lists the whole fluid target across the gels', () => {
    // 180 min at 600 ml/h = 1800 ml; 9 gels × 200 ml.
    const events = buildSchedule({ durationMin: 180, gelsPerHour: 3, fluidMlPerHour: 600 });
    expect(events.reduce((sum, e) => sum + (e.fluidMl ?? 0), 0)).toBe(1800);
    // 60 min at 500 ml/h = 500 ml; 2 gels × 250 ml.
    const short = buildSchedule({ durationMin: 60, gelsPerHour: 2, fluidMlPerHour: 500 });
    expect(short.reduce((sum, e) => sum + (e.fluidMl ?? 0), 0)).toBe(500);
  });

  it('uses a single hydration event when there are no gels', () => {
    expect(buildSchedule({ durationMin: 90, gelsPerHour: 0, fluidMlPerHour: 400 })).toEqual([
      { timeMin: 0, type: 'start', message: { key: 'schedule.start' } },
      {
        timeMin: 0,
        type: 'hydration',
        message: { key: 'schedule.hydrationOnly', params: { mlPerHour: 400 } },
      },
      { timeMin: 90, type: 'finish', message: { key: 'schedule.finish' } },
    ]);
  });

  it('has only start and finish without gels or fluid', () => {
    for (const gelsPerHour of [0, -1, NaN, undefined]) {
      expect(buildSchedule({ durationMin: 45, gelsPerHour, fluidMlPerHour: 0 })).toEqual([
        { timeMin: 0, type: 'start', message: { key: 'schedule.start' } },
        { timeMin: 45, type: 'finish', message: { key: 'schedule.finish' } },
      ]);
    }
  });

  it('treats a non-finite or negative duration as 0', () => {
    for (const durationMin of [0, -30, NaN, Infinity, undefined]) {
      // A zero-length event gives the gel no fluid, so the target is a hydration event.
      expect(buildSchedule({ durationMin, gelsPerHour: 3, fluidMlPerHour: 500 })).toEqual([
        { timeMin: 0, type: 'start', message: { key: 'schedule.startWithGel' } },
        {
          timeMin: 0,
          type: 'hydration',
          message: { key: 'schedule.hydrationOnly', params: { mlPerHour: 500 } },
        },
        { timeMin: 0, type: 'finish', message: { key: 'schedule.finish' } },
      ]);
      expect(buildSchedule({ durationMin, gelsPerHour: 3 })).toEqual([
        { timeMin: 0, type: 'start', message: { key: 'schedule.startWithGel' } },
        { timeMin: 0, type: 'finish', message: { key: 'schedule.finish' } },
      ]);
    }
  });

  it('treats a non-finite gel rate as no gels and never throws on huge values', () => {
    for (const gelsPerHour of [Infinity, -Infinity]) {
      expect(buildSchedule({ durationMin: 60, gelsPerHour, fluidMlPerHour: 500 })).toEqual(
        buildSchedule({ durationMin: 60, gelsPerHour: 0, fluidMlPerHour: 500 }),
      );
    }
    // Finite rates above 60 gels/h are clamped to one gel per minute.
    for (const gelsPerHour of [1e9, Number.MAX_VALUE]) {
      const events = buildSchedule({ durationMin: 60, gelsPerHour, fluidMlPerHour: 600 });
      expect(events).toEqual(buildSchedule({ durationMin: 60, gelsPerHour: 60, fluidMlPerHour: 600 }));
      expect(byType(events, 'fuel')).toHaveLength(59);
      // 600 ml/h × 1 min / 60 = 10 ml
      expect(byType(events, 'fuel').every((e) => e.fluidMl === 10)).toBe(true);
    }
    // Finite durations above 7 days are clamped to 10080 min.
    for (const durationMin of [1e12, Number.MAX_VALUE]) {
      const events = buildSchedule({ durationMin, gelsPerHour: 1, fluidMlPerHour: 500 });
      expect(events).toEqual(buildSchedule({ durationMin: 10080, gelsPerHour: 1, fluidMlPerHour: 500 }));
      expect(byType(events, 'fuel')).toHaveLength(167);
      expect(events.at(-1)).toEqual({ timeMin: 10080, type: 'finish', message: { key: 'schedule.finish' } });
    }
    // Both at once stay bounded: at most one gel per minute for 7 days.
    const worst = buildSchedule({ durationMin: 1e12, gelsPerHour: 1e9, fluidMlPerHour: 500 });
    expect(byType(worst, 'fuel')).toHaveLength(10080 - 1);
    expect(worst.every((e) => Number.isFinite(e.timeMin))).toBe(true);
  });

  it('works without arguments', () => {
    expect(buildSchedule()).toEqual([
      { timeMin: 0, type: 'start', message: { key: 'schedule.start' } },
      { timeMin: 0, type: 'finish', message: { key: 'schedule.finish' } },
    ]);
  });

  it('handles very long events with many gels', () => {
    const events = buildSchedule({ durationMin: 2880, gelsPerHour: 12, fluidMlPerHour: 3000 });
    expect(byType(events, 'fuel')).toHaveLength(2880 / 5 - 1);
    // 3000 ml/h × 5 min / 60 = 250 ml
    expect(byType(events, 'fuel').every((e) => e.fluidMl === 250)).toBe(true);
    expect(events.at(-1).timeMin).toBe(2880);
  });
});

describe('buildSchedule: caffeine', () => {
  it('adds the pre-race dose and a separate intra dose when caffeine is taken on its own', () => {
    const events = buildSchedule({
      durationMin: 180,
      gelsPerHour: 3,
      fluidMlPerHour: 600,
      caffeine: CAFFEINE_180,
    });
    expect(events[0]).toEqual({
      timeMin: -60,
      type: 'caffeine',
      message: { key: 'schedule.caffeine', params: { mg: 140 } },
      caffeineMg: 140,
    });
    expect(events[1].type).toBe('start');
    // The gel at 120 min carries no caffeine; the caffeine dose follows it.
    expect(at(events, 120)).toEqual([
      {
        timeMin: 120,
        type: 'fuel',
        message: { key: 'schedule.fuelWithFluid', params: { gel: 7, fluidMl: 200 } },
        fluidMl: 200,
      },
      {
        timeMin: 120,
        type: 'caffeine',
        message: { key: 'schedule.caffeine', params: { mg: 70 } },
        caffeineMg: 70,
      },
    ]);
    expect(byType(events, 'fuel').some((e) => 'caffeineMg' in e)).toBe(false);
  });

  it('puts intra caffeine into the gel with that gelIndex when added as tablets', () => {
    const events = buildSchedule({
      durationMin: 180,
      gelsPerHour: 3,
      fluidMlPerHour: 600,
      caffeine: CAFFEINE_180_TABLETS,
    });
    expect(events[0]).toEqual({
      timeMin: -60,
      type: 'caffeine',
      message: { key: 'schedule.caffeineTablets', params: { mg: 150, tablets: 1.5 } },
      caffeineMg: 150,
    });
    expect(at(events, 120)).toEqual([
      {
        timeMin: 120,
        type: 'fuel',
        message: {
          key: 'schedule.fuelWithFluidAndCaffeine',
          params: { gel: 7, fluidMl: 200, caffeineMg: 50 },
        },
        fluidMl: 200,
        caffeineMg: 50,
      },
    ]);
    expect(byType(events, 'caffeine')).toHaveLength(1);
    expect(byType(events, 'fuel').filter((e) => 'caffeineMg' in e)).toHaveLength(1);
  });

  it('uses the caffeine-only gel message when there is no fluid', () => {
    const fuel = byType(
      buildSchedule({ durationMin: 180, gelsPerHour: 3, fluidMlPerHour: 0, caffeine: CAFFEINE_180_TABLETS }),
      'fuel',
    );
    expect(fuel[5]).toEqual({
      timeMin: 120,
      type: 'fuel',
      message: { key: 'schedule.fuelWithCaffeine', params: { gel: 7, caffeineMg: 50 } },
      caffeineMg: 50,
    });
  });

  it('adds caffeine in the first gel to the start event', () => {
    // 0.5 gels/h over 100 min → one gel at 0; the intra dose sits in it.
    const caffeine = {
      ...CAFFEINE_OFF,
      enabled: true,
      doses: [
        { timeMin: -60, mg: 100, kind: 'pre', gelIndex: null, tablets: 1 },
        { timeMin: 0, mg: 50, kind: 'intra', gelIndex: 0, tablets: 0.5 },
      ],
    };
    // The single gel covers the whole 100 min: 500 ml/h × 100 / 60 = 833 → 830 ml.
    expect(buildSchedule({ durationMin: 100, gelsPerHour: 0.5, fluidMlPerHour: 500, caffeine })).toEqual([
      {
        timeMin: -60,
        type: 'caffeine',
        message: { key: 'schedule.caffeineTablets', params: { mg: 100, tablets: 1 } },
        caffeineMg: 100,
      },
      {
        timeMin: 0,
        type: 'start',
        message: {
          key: 'schedule.startWithGelFluidAndCaffeine',
          params: { fluidMl: 830, caffeineMg: 50 },
        },
        fluidMl: 830,
        caffeineMg: 50,
      },
      { timeMin: 100, type: 'finish', message: { key: 'schedule.finish' } },
    ]);
    expect(buildSchedule({ durationMin: 100, gelsPerHour: 0.5, caffeine })[1]).toEqual({
      timeMin: 0,
      type: 'start',
      message: { key: 'schedule.startWithGelAndCaffeine', params: { caffeineMg: 50 } },
      caffeineMg: 50,
    });
  });

  it('sums intra doses that share a gel', () => {
    const caffeine = {
      ...CAFFEINE_OFF,
      enabled: true,
      doses: [
        { timeMin: 240, mg: 100, kind: 'intra', gelIndex: 1, tablets: 1 },
        { timeMin: 390, mg: 50, kind: 'intra', gelIndex: 1, tablets: 0.5 },
      ],
    };
    // 0.25 gels/h over 420 min → gels at 0 and 240
    const fuel = byType(buildSchedule({ durationMin: 420, gelsPerHour: 0.25, caffeine }), 'fuel');
    expect(fuel).toEqual([
      {
        timeMin: 240,
        type: 'fuel',
        message: { key: 'schedule.fuelWithCaffeine', params: { gel: 2, caffeineMg: 150 } },
        caffeineMg: 150,
      },
    ]);
  });

  it('keeps intra doses whose gel is not in this schedule as separate caffeine events', () => {
    const caffeine = {
      ...CAFFEINE_OFF,
      enabled: true,
      doses: [
        { timeMin: 150, mg: 100, kind: 'intra', gelIndex: 40, tablets: 1 },
        { timeMin: 170, mg: 50, kind: 'intra', gelIndex: null, tablets: 0.5 },
      ],
    };
    const events = buildSchedule({ durationMin: 180, gelsPerHour: 3, fluidMlPerHour: 600, caffeine });
    expect(byType(events, 'caffeine')).toEqual([
      {
        timeMin: 150,
        type: 'caffeine',
        message: { key: 'schedule.caffeineTablets', params: { mg: 100, tablets: 1 } },
        caffeineMg: 100,
      },
      {
        timeMin: 170,
        type: 'caffeine',
        message: { key: 'schedule.caffeineTablets', params: { mg: 50, tablets: 0.5 } },
        caffeineMg: 50,
      },
    ]);
    // Without gels, a dose assigned to a gel still shows up at its own time.
    const noGels = buildSchedule({ durationMin: 180, gelsPerHour: 0, caffeine: CAFFEINE_180_TABLETS });
    expect(byType(noGels, 'caffeine').map((e) => [e.timeMin, e.caffeineMg])).toEqual([
      [-60, 150],
      [120, 50],
    ]);
  });

  it('ignores a disabled or missing caffeine plan and invalid doses', () => {
    const plain = buildSchedule({ durationMin: 180, gelsPerHour: 3, fluidMlPerHour: 600 });
    expect(buildSchedule({ durationMin: 180, gelsPerHour: 3, fluidMlPerHour: 600, caffeine: CAFFEINE_OFF })).toEqual(plain);
    // A stale plan with doses but enabled: false adds nothing.
    expect(
      buildSchedule({
        durationMin: 180,
        gelsPerHour: 3,
        fluidMlPerHour: 600,
        caffeine: { ...CAFFEINE_180, enabled: false },
      }),
    ).toEqual(plain);
    expect(
      buildSchedule({
        durationMin: 180,
        gelsPerHour: 3,
        fluidMlPerHour: 600,
        caffeine: {
          enabled: true,
          doses: [
            null,
            { timeMin: NaN, mg: 100, kind: 'pre', gelIndex: null, tablets: null },
            { timeMin: -60, mg: 0, kind: 'pre', gelIndex: null, tablets: null },
            { timeMin: 90, mg: -5, kind: 'intra', gelIndex: 4, tablets: null },
          ],
        },
      }),
    ).toEqual(plain);
    expect(
      buildSchedule({ durationMin: 180, gelsPerHour: 3, fluidMlPerHour: 600, caffeine: { enabled: true } }),
    ).toEqual(plain);
  });
});

describe('buildSchedule: bicarbonate', () => {
  it('adds the bicarbonate dose at the recommended time with dose and sodium in g', () => {
    // [grgic2021] 0.2–0.3 g/kg, 60–180 min before exercise
    const events = buildSchedule({ durationMin: 60, gelsPerHour: 0, bicarb: BICARB_ON });
    expect(events[0]).toEqual({
      timeMin: -90,
      type: 'bicarb',
      message: { key: 'schedule.bicarb', params: { doseG: 21, sodiumG: 5.7 } },
    });
  });

  it('rounds dose and sodium to 0.1 g', () => {
    // 0.25 g/kg × 73 kg = 18.25 g; 18.25 × 1000 × 0.2737 = 4995.0 mg
    const bicarb = { ...BICARB_ON, doseG: 18.25, sodiumMg: 4995.025 };
    const [event] = buildSchedule({ durationMin: 60, bicarb });
    expect(event.message.params).toEqual({ doseG: 18.3, sodiumG: 5 });
  });

  it('follows the plan timing and falls back to −90 min without one', () => {
    const custom = { ...BICARB_ON, timingMin: { earliest: -180, latest: -60, recommended: -120 } };
    expect(buildSchedule({ durationMin: 60, bicarb: custom })[0].timeMin).toBe(-120);
    const noTiming = { ...BICARB_ON, timingMin: undefined };
    expect(buildSchedule({ durationMin: 60, bicarb: noTiming })[0].timeMin).toBe(-90);
  });

  it('orders bicarbonate before pre-race caffeine and the start', () => {
    const events = buildSchedule({
      durationMin: 180,
      gelsPerHour: 3,
      fluidMlPerHour: 600,
      caffeine: CAFFEINE_180_TABLETS,
      bicarb: BICARB_ON,
    });
    expect(events.slice(0, 3).map((e) => [e.timeMin, e.type])).toEqual([
      [-90, 'bicarb'],
      [-60, 'caffeine'],
      [0, 'start'],
    ]);
  });

  it('skips bicarbonate when disabled, missing or without a dose', () => {
    const plain = buildSchedule({ durationMin: 60, gelsPerHour: 2, fluidMlPerHour: 500 });
    expect(buildSchedule({ durationMin: 60, gelsPerHour: 2, fluidMlPerHour: 500, bicarb: BICARB_OFF })).toEqual(plain);
    expect(
      buildSchedule({ durationMin: 60, gelsPerHour: 2, fluidMlPerHour: 500, bicarb: { ...BICARB_ON, doseG: 0 } }),
    ).toEqual(plain);
    expect(byType(plain, 'bicarb')).toEqual([]);
  });
});

describe('buildSchedule: purity', () => {
  it('does not mutate its arguments and returns the same output for the same input', () => {
    const deepFreeze = (o) => {
      Object.values(o).forEach((v) => v && typeof v === 'object' && deepFreeze(v));
      return Object.freeze(o);
    };
    const caffeine = deepFreeze(structuredClone(CAFFEINE_180_TABLETS));
    const bicarb = deepFreeze(structuredClone(BICARB_ON));
    const input = deepFreeze({ durationMin: 180, gelsPerHour: 3, fluidMlPerHour: 500, caffeine, bicarb });
    const first = buildSchedule(input);
    expect(buildSchedule(input)).toEqual(first);
    expect(caffeine).toEqual(CAFFEINE_180_TABLETS);
    expect(bicarb).toEqual(BICARB_ON);
  });
});

/** Arbitrary inputs plus a hand-built caffeine plan whose gel indices match the schedule's gels. */
const scheduleInput = fc
  .record({
    durationMin: fc.integer({ min: 0, max: 1440 }),
    gelsPerHour: fc.constantFrom(0, 0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 7, 12),
    fluidMlPerHour: fc.integer({ min: 0, max: 1500 }),
    preMg: fc.option(fc.integer({ min: 1, max: 80 }).map((n) => n * 5)),
    intra: fc.array(
      fc.record({
        timeShare: fc.double({ min: 0, max: 1, noNaN: true }),
        mg: fc.integer({ min: 1, max: 40 }).map((n) => n * 5),
        gelPick: fc.option(fc.nat()),
      }),
      { maxLength: 6 },
    ),
    bicarbOn: fc.boolean(),
  })
  .map(({ durationMin, gelsPerHour, fluidMlPerHour, preMg, intra, bicarbOn }) => {
    const gelCount = getGelCount(durationMin, gelsPerHour);
    const doses = [];
    if (preMg !== null) doses.push({ timeMin: -60, mg: preMg, kind: 'pre', gelIndex: null, tablets: null });
    for (const { timeShare, mg, gelPick } of intra) {
      const gelIndex = gelPick !== null && gelCount > 0 ? gelPick % gelCount : null;
      doses.push({ timeMin: Math.round(timeShare * durationMin), mg, kind: 'intra', gelIndex, tablets: null });
    }
    return {
      durationMin,
      gelsPerHour,
      fluidMlPerHour,
      caffeine: { ...CAFFEINE_OFF, enabled: true, doses },
      bicarb: bicarbOn ? BICARB_ON : BICARB_OFF,
    };
  });

describe('buildSchedule: properties', () => {
  it('is sorted, has one start and one finish, and keeps every gel and every mg of caffeine', () => {
    fc.assert(
      fc.property(scheduleInput, (input) => {
        const events = buildSchedule(input);
        const gelCount = getGelCount(input.durationMin, input.gelsPerHour);

        for (let i = 1; i < events.length; i += 1) {
          expect(events[i].timeMin).toBeGreaterThanOrEqual(events[i - 1].timeMin);
        }
        expect(byType(events, 'start')).toHaveLength(1);
        expect(byType(events, 'start')[0].timeMin).toBe(0);
        expect(events.at(-1)).toEqual({
          timeMin: input.durationMin,
          type: 'finish',
          message: { key: 'schedule.finish' },
        });
        expect(byType(events, 'fuel')).toHaveLength(Math.max(0, gelCount - 1));
        expect(byType(events, 'bicarb')).toHaveLength(input.bicarb.enabled ? 1 : 0);

        // Fluid: each gel carries the fluid for its own stretch of time, or none
        // does and one hydration event states the rate. A fluid target > 0 always
        // shows up.
        const gelEvents = events.filter((e) => e.type === 'fuel' || (e.type === 'start' && gelCount > 0));
        expect(gelEvents).toHaveLength(gelCount);
        const withFluid = events.filter((e) => 'fluidMl' in e);
        const hydration = byType(events, 'hydration');
        if (input.fluidMlPerHour > 0) {
          expect(withFluid.length > 0 ? 0 : 1).toBe(hydration.length);
          if (withFluid.length > 0) {
            expect(withFluid).toEqual(gelEvents.filter((e) => 'fluidMl' in e));
            // [almond2005] the listed fluid never exceeds the plan, and misses it by
            // less than 10 ml (rounding on the running total).
            const planned = (input.fluidMlPerHour * input.durationMin) / 60;
            const listed = withFluid.reduce((sum, e) => sum + e.fluidMl, 0);
            expect(listed).toBeLessThanOrEqual(planned + 1e-6);
            expect(listed).toBeGreaterThan(planned - 10 - 1e-6);
            // Each gel gets the fluid until the next gel (or the finish), within 10 ml.
            gelEvents.forEach((e, i) => {
              const end = i + 1 < gelEvents.length ? gelEvents[i + 1].timeMin : input.durationMin;
              const exact = (input.fluidMlPerHour * (end - e.timeMin)) / 60;
              expect(Math.abs((e.fluidMl ?? 0) - exact)).toBeLessThan(10 + 1e-6);
            });
          } else {
            expect(hydration[0].message.params.mlPerHour).toBe(input.fluidMlPerHour);
          }
        } else {
          expect(withFluid).toHaveLength(0);
          expect(hydration).toHaveLength(0);
        }

        const plannedMg = input.caffeine.doses.reduce((sum, d) => sum + d.mg, 0);
        const scheduledMg = events.reduce((sum, e) => sum + (e.caffeineMg ?? 0), 0);
        expect(scheduledMg).toBe(plannedMg);

        for (const e of events) {
          expect(EVENT_TYPES).toContain(e.type);
          expect(Number.isFinite(e.timeMin)).toBe(true);
          expect(catalog).toHaveProperty([e.message.key]);
          if ('fluidMl' in e) {
            expect(e.fluidMl).toBeGreaterThan(0);
            expect(e.fluidMl % 10).toBe(0);
          }
        }
      }),
    );
  });
});

/** A sip event in the shape `buildSchedule` returns, for a sip from one bottle. */
const sip = (timeMin, ml, bottle) => ({
  timeMin,
  type: 'drink',
  message: { key: 'schedule.drinkSip', params: { ml, bottle } },
  fluidMl: ml,
  bottle,
});
/** A sip that finishes bottle `bottle` (and the ones up to `next − 1`) and goes on with bottle `next`. */
const sipOn = (timeMin, ml, bottle, next) => ({
  timeMin,
  type: 'drink',
  message:
    next === bottle + 1
      ? { key: 'schedule.drinkSipSwitch', params: { ml, bottle, next } }
      : { key: 'schedule.drinkSipSpan', params: { ml, bottle, finished: next - 1, next } },
  fluidMl: ml,
  bottle,
  lastBottle: next,
});
/** Fluid listed per bottle (ml), splitting each sip at the marks of bottles filled to `fillMl`. */
const fluidPerBottle = (events, fillMl) => {
  const perBottle = [];
  let listed = 0;
  for (const e of byType(events, 'drink')) {
    const end = listed + e.fluidMl;
    for (let i = Math.floor(listed / fillMl); i * fillMl < end; i += 1) {
      const ml = Math.min(end, (i + 1) * fillMl) - Math.max(listed, i * fillMl);
      if (ml > 0) perBottle[i] = (perBottle[i] ?? 0) + ml;
    }
    listed = end;
  }
  return Array.from(perBottle, (ml) => ml ?? 0);
};
const totalFluid = (events) => events.reduce((sum, e) => sum + (e.fluidMl ?? 0), 0);

describe('buildSchedule: format type', () => {
  it('treats a missing or unknown type as gel, so the Phase 1 call is unchanged', () => {
    const base = { durationMin: 180, gelsPerHour: 3, fluidMlPerHour: 500, caffeine: CAFFEINE_180_TABLETS, bicarb: BICARB_ON };
    const gel = buildSchedule({ ...base, type: 'gel' });
    expect(buildSchedule(base)).toEqual(gel);
    for (const type of [undefined, null, '', 'gels', 'Drink', 3, {}]) {
      expect(buildSchedule({ ...base, type })).toEqual(gel);
    }
    // Gel mode ignores the drink.
    expect(buildSchedule({ ...base, type: 'gel', drink: { bottles: 3, bottleMl: 500 } })).toEqual(gel);
    expect(byType(gel, 'drink')).toEqual([]);
  });

  it('drinks every 20 min in drink mode and finishes the bottles in order', () => {
    expect(DRINK_INTERVAL_MIN).toBe(20);
    // 120 min at 600 ml/h = 1200 ml in two 750 ml bottles. drinkBottles fills each to 1200 / 2 = 600 ml,
    // so the plan's fluid empties both. 600 × 20 / 60 = 200 ml per sip: 600 ml are listed before the
    // sip at 60 min, so bottle 1 is empty and that sip is from bottle 2.
    expect(
      buildSchedule({ durationMin: 120, type: 'drink', gelsPerHour: 3, fluidMlPerHour: 600, drink: { bottles: 2, bottleMl: 750 } }),
    ).toEqual([
      { timeMin: 0, type: 'start', message: { key: 'schedule.start' } },
      sip(0, 200, 1),
      sip(20, 200, 1),
      sip(40, 200, 1),
      sip(60, 200, 2),
      sip(80, 200, 2),
      sip(100, 200, 2),
      { timeMin: 120, type: 'finish', message: { key: 'schedule.finish' } },
    ]);
  });

  it('names the bottle that holds the first ml of the sip', () => {
    // Three 500 ml bottles for 1200 ml, each filled to 400 ml: 0 and 200 ml listed before the first two
    // sips → bottle 1; 400 and 600 → bottle 2; 800 and 1000 → bottle 3.
    const events = buildSchedule({ durationMin: 120, type: 'drink', fluidMlPerHour: 600, drink: { bottles: 3, bottleMl: 500 } });
    expect(byType(events, 'drink').map((e) => e.bottle)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(byType(events, 'drink').map((e) => e.message.params.bottle)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('lists exactly the drink that was mixed, so its carbs and sodium are all taken', () => {
    // drinkBottles mixes ceil(F / bottleMl) bottles, each filled to F / bottles. Listing only F (rounded down
    // to 10 ml) against full 750 ml bottles would leave 700 ml (47 % of the carbs and sodium) in bottle 2.
    // 120 min at 400 ml/h = 800 ml: two bottles of 400 ml. 133.3 ml per 20 min → 130, 130, 140, … .
    const events = buildSchedule({ durationMin: 120, type: 'drink', fluidMlPerHour: 400, drink: { bottles: 2, bottleMl: 750 } });
    expect(byType(events, 'drink')).toEqual([
      sip(0, 130, 1),
      sip(20, 130, 1),
      sip(40, 140, 1),
      sip(60, 130, 2),
      sip(80, 130, 2),
      sip(100, 140, 2),
    ]);
    expect(fluidPerBottle(events, 400)).toEqual([400, 400]);
    // The fill drinkBottles reports (perBottle.fillMl) gives the same schedule.
    expect(
      buildSchedule({
        durationMin: 120,
        type: 'drink',
        fluidMlPerHour: 400,
        drink: { bottles: 2, bottleMl: 750, perBottle: { fillMl: 400, carbsG: 30 } },
      }),
    ).toEqual(events);
    // Drink sizes like drinkBottles makes them: the listed fluid is the mixed volume to within 10 ml,
    // and every bottle is emptied (the last one to within 10 ml).
    for (const [durationMin, fluidMlPerHour, bottleMl] of [
      [180, 600, 750],
      [135, 550, 750],
      [200, 830, 500],
      [95, 700, 950],
      [61, 760, 750],
    ]) {
      const plannedMl = (fluidMlPerHour * durationMin) / 60;
      const bottles = Math.max(1, Math.ceil(plannedMl / bottleMl - 1e-9));
      const fillMl = plannedMl / bottles;
      const drinkEvents = buildSchedule({
        durationMin,
        type: 'drink',
        fluidMlPerHour,
        drink: { bottles, bottleMl, perBottle: { fillMl } },
      });
      const listed = totalFluid(drinkEvents);
      expect(listed).toBeLessThanOrEqual(bottles * fillMl + 1e-6);
      expect(listed).toBeGreaterThan(bottles * fillMl - 10);
      const perBottle = fluidPerBottle(drinkEvents, fillMl);
      expect(perBottle).toHaveLength(bottles);
      perBottle.slice(0, -1).forEach((ml, i) => expect(ml, `bottle ${i + 1}`).toBeCloseTo(fillMl, 6));
      expect(perBottle.at(-1)).toBeGreaterThan(fillMl - 10);
      expect(perBottle.at(-1)).toBeLessThanOrEqual(fillMl + 1e-6);
      const lastSip = byType(drinkEvents, 'drink').at(-1);
      expect(lastSip.lastBottle ?? lastSip.bottle).toBe(bottles);
      // Without the fill, the same fill is derived from the plan's fluid.
      expect(buildSchedule({ durationMin, type: 'drink', fluidMlPerHour, drink: { bottles, bottleMl } })).toEqual(drinkEvents);
    }
  });

  it('says when a sip finishes a bottle and goes on with the next ones', () => {
    // [almond2005] 180 min at 500 ml/h = 1500 ml in two 750 ml bottles. Running totals 160, 330, 500, 660:
    // the sip at 80 min (660 → 830 ml) empties bottle 1 (90 ml left) and goes on with bottle 2.
    const events = buildSchedule({ durationMin: 180, type: 'drink', fluidMlPerHour: 500, drink: { bottles: 2, bottleMl: 750 } });
    expect(byType(events, 'drink')).toEqual([
      sip(0, 160, 1),
      sip(20, 170, 1),
      sip(40, 170, 1),
      sip(60, 160, 1),
      sipOn(80, 170, 1, 2),
      sip(100, 170, 2),
      sip(120, 160, 2),
      sip(140, 170, 2),
      sip(160, 170, 2),
    ]);
    expect(at(events, 80)[0].message).toEqual({ key: 'schedule.drinkSipSwitch', params: { ml: 170, bottle: 1, next: 2 } });
    // 60 min at 1200 ml/h in 250 ml bottles: five bottles of 240 ml, 400 ml sips. The sip at 20 min
    // (400 → 800 ml) empties bottles 2 and 3 and goes on with bottle 4.
    const span = buildSchedule({ durationMin: 60, type: 'drink', fluidMlPerHour: 1200, drink: { bottleMl: 250 } });
    expect(byType(span, 'drink')).toEqual([sipOn(0, 400, 1, 2), sipOn(20, 400, 2, 4), sipOn(40, 400, 4, 5)]);
    expect(at(span, 20)[0].message).toEqual({
      key: 'schedule.drinkSipSpan',
      params: { ml: 400, bottle: 2, finished: 3, next: 4 },
    });
    // A sip that ends exactly at a bottle mark stays on that bottle; the next one starts the next bottle.
    const exact = buildSchedule({ durationMin: 120, type: 'drink', fluidMlPerHour: 600, drink: { bottles: 2, bottleMl: 750 } });
    expect(byType(exact, 'drink').every((e) => !('lastBottle' in e))).toBe(true);
  });

  it('follows the fill the drink reports and derives it when that is missing or invalid', () => {
    // A fill of 750 ml (filled to the mark) for 1200 ml: the sip at 60 min (600 → 800 ml) goes on with bottle 2.
    const marked = buildSchedule({
      durationMin: 120,
      type: 'drink',
      fluidMlPerHour: 600,
      drink: { bottles: 2, bottleMl: 750, perBottle: { fillMl: 750 } },
    });
    expect(byType(marked, 'drink').map((e) => [e.bottle, e.lastBottle ?? e.bottle])).toEqual([
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 2],
      [2, 2],
      [2, 2],
    ]);
    // Fills that are not a number above 0 and at most the bottle size are ignored: 1200 / 2 = 600 ml.
    const derived = buildSchedule({ durationMin: 120, type: 'drink', fluidMlPerHour: 600, drink: { bottles: 2, bottleMl: 750 } });
    for (const fillMl of [0, -5, NaN, Infinity, 751, '600', null]) {
      expect(
        buildSchedule({ durationMin: 120, type: 'drink', fluidMlPerHour: 600, drink: { bottles: 2, bottleMl: 750, perBottle: { fillMl } } }),
      ).toEqual(derived);
    }
    for (const perBottle of [null, undefined, 3, {}]) {
      expect(buildSchedule({ durationMin: 120, type: 'drink', fluidMlPerHour: 600, drink: { bottles: 2, bottleMl: 750, perBottle } })).toEqual(
        derived,
      );
    }
  });

  it('rounds the sips on the running total and never lists more than the plan', () => {
    // [almond2005] [hewbutler2015] 500 ml/h × 20 min / 60 = 166.7 ml; 120 min = 1000 ml.
    const events = buildSchedule({ durationMin: 120, type: 'drink', fluidMlPerHour: 500, drink: { bottles: 2, bottleMl: 750 } });
    expect(byType(events, 'drink').map((e) => e.fluidMl)).toEqual([160, 170, 170, 160, 170, 170]);
    expect(totalFluid(events)).toBe(1000);
    // 70 min at 600 ml/h: the last sip covers 10 min only (700 ml, not 4 × 200).
    const short = buildSchedule({ durationMin: 70, type: 'drink', fluidMlPerHour: 600, drink: { bottles: 1, bottleMl: 750 } });
    expect(byType(short, 'drink').map((e) => [e.timeMin, e.fluidMl])).toEqual([
      [0, 200],
      [20, 200],
      [40, 200],
      [60, 100],
    ]);
    // 190 min at 800 ml/h: 2533 ml planned → 2530 ml listed.
    expect(totalFluid(buildSchedule({ durationMin: 190, type: 'drink', fluidMlPerHour: 800 }))).toBe(2530);
  });

  it('ignores the gels in drink mode and moves gel caffeine to its own event', () => {
    const events = buildSchedule({
      durationMin: 180,
      type: 'drink',
      gelsPerHour: 3,
      fluidMlPerHour: 600,
      drink: { bottles: 3, bottleMl: 750 },
      caffeine: CAFFEINE_180_TABLETS,
      bicarb: BICARB_ON,
    });
    expect(byType(events, 'fuel')).toEqual([]);
    expect(byType(events, 'start')).toEqual([{ timeMin: 0, type: 'start', message: { key: 'schedule.start' } }]);
    expect(events.slice(0, 4).map((e) => [e.timeMin, e.type])).toEqual([
      [-90, 'bicarb'],
      [-60, 'caffeine'],
      [0, 'start'],
      [0, 'drink'],
    ]);
    // The intra dose was meant for gel 7 (gelIndex 6); without gels it is taken on its own, after the sip.
    // Three bottles of 600 ml: 1200 ml listed before 120 min, so that sip is from bottle 3.
    expect(at(events, 120)).toEqual([
      sip(120, 200, 3),
      {
        timeMin: 120,
        type: 'caffeine',
        message: { key: 'schedule.caffeineTablets', params: { mg: 50, tablets: 0.5 } },
        caffeineMg: 50,
      },
    ]);
    expect(byType(events, 'drink')).toHaveLength(9);
    expect(totalFluid(events)).toBe(1800);
    expect(events.at(-1)).toEqual({ timeMin: 180, type: 'finish', message: { key: 'schedule.finish' } });
  });

  it('uses 750 ml bottles and enough of them when the drink is missing or invalid', () => {
    // 180 min at 600 ml/h = 1800 ml → 3 bottles of 750 ml, each filled to 600 ml; 1200 ml listed before the
    // sip at 120 min → bottle 3.
    const expected = buildSchedule({ durationMin: 180, type: 'drink', fluidMlPerHour: 600, drink: { bottles: 3, bottleMl: 750 } });
    for (const drink of [
      undefined,
      null,
      {},
      { bottles: 0, bottleMl: -1 },
      { bottles: NaN, bottleMl: Infinity },
      // Sizes below 10 ml (one rounding step of the listed fluid) are not bottles: 750 ml.
      { bottleMl: 1e-320 },
      { bottleMl: 0.001 },
      { bottleMl: 9.99 },
      { bottleMl: Number.MIN_VALUE },
    ]) {
      expect(buildSchedule({ durationMin: 180, type: 'drink', fluidMlPerHour: 600, drink })).toEqual(expected);
    }
    expect(byType(expected, 'drink').map((e) => e.bottle)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
    // The count follows the size when only the size is given: 1800 ml in 500 ml bottles → 4 of 450 ml.
    const small = buildSchedule({ durationMin: 180, type: 'drink', fluidMlPerHour: 600, drink: { bottleMl: 500 } });
    expect(Math.max(...byType(small, 'drink').map((e) => e.lastBottle ?? e.bottle))).toBe(4);
    expect(fluidPerBottle(small, 450)).toEqual([450, 450, 450, 450]);
    // 10 ml is the smallest size used as given: 60 ml in 10 ml bottles → 6 bottles, 20 ml sips over two each.
    const tiny = buildSchedule({ durationMin: 60, type: 'drink', fluidMlPerHour: 60, drink: { bottleMl: 10 } });
    expect(byType(tiny, 'drink')).toEqual([sipOn(0, 20, 1, 2), sipOn(20, 20, 3, 4), sipOn(40, 20, 5, 6)]);
  });

  it('keeps bottle numbers finite for tiny sizes and huge counts', () => {
    // [JSON] a non-finite bottle number would turn into null in a share or print payload.
    for (const drink of [
      { bottleMl: 1e-320 },
      { bottleMl: 0.001 },
      { bottles: Number.MAX_VALUE, bottleMl: 750 },
      { bottles: 1e300, bottleMl: 1e-320 },
      { bottles: 1e300, bottleMl: 750, perBottle: { fillMl: Number.MIN_VALUE } },
    ]) {
      for (const durationMin of [120, 1e12]) {
        const events = buildSchedule({ durationMin, type: 'drink', fluidMlPerHour: Number.MAX_VALUE, drink });
        const sips = byType(events, 'drink');
        expect(sips.length).toBeGreaterThan(0);
        for (const e of sips) {
          for (const n of [e.bottle, e.lastBottle ?? e.bottle, ...Object.values(e.message.params)]) {
            expect(Number.isSafeInteger(n), JSON.stringify(e)).toBe(true);
          }
          expect(e.bottle).toBeGreaterThanOrEqual(1);
          expect(e.lastBottle ?? e.bottle).toBeLessThanOrEqual(1680000);
        }
        expect(JSON.parse(JSON.stringify(events))).toEqual(events);
      }
    }
    // A huge count is clamped to 1 680 000 bottles (100 l/h for 7 days in 10 ml bottles).
    const huge = buildSchedule({ durationMin: 120, type: 'drink', fluidMlPerHour: 600, drink: { bottles: Number.MAX_VALUE, bottleMl: 750 } });
    expect(byType(huge, 'drink').at(-1).lastBottle).toBe(1680000);
  });

  it('never names a bottle past the last one and floors a fractional count', () => {
    // One 500 ml bottle for 1200 ml: the athlete refills it, the number stays 1.
    const one = buildSchedule({ durationMin: 120, type: 'drink', fluidMlPerHour: 600, drink: { bottles: 1, bottleMl: 500 } });
    expect(byType(one, 'drink').every((e) => e.bottle === 1)).toBe(true);
    const frac = buildSchedule({ durationMin: 120, type: 'drink', fluidMlPerHour: 600, drink: { bottles: 2.7, bottleMl: 500 } });
    expect(byType(frac, 'drink').map((e) => e.bottle)).toEqual([1, 1, 1, 2, 2, 2]);
  });

  it('leaves out sips that round to 0 ml and keeps the fluid target visible', () => {
    // 20 ml/h: 6.7 ml per 20 min. Running total 0, 10, 20 ml → sips of 0, 10 and 10 ml.
    expect(buildSchedule({ durationMin: 60, type: 'drink', fluidMlPerHour: 20 })).toEqual([
      { timeMin: 0, type: 'start', message: { key: 'schedule.start' } },
      sip(20, 10, 1),
      sip(40, 10, 1),
      { timeMin: 60, type: 'finish', message: { key: 'schedule.finish' } },
    ]);
    // 10 ml/h: 3.3 ml per sip rounds to 0, so one hydration event states the rate.
    expect(buildSchedule({ durationMin: 60, type: 'drink', fluidMlPerHour: 10 })).toEqual([
      { timeMin: 0, type: 'start', message: { key: 'schedule.start' } },
      { timeMin: 0, type: 'hydration', message: { key: 'schedule.hydrationOnly', params: { mlPerHour: 10 } } },
      { timeMin: 60, type: 'finish', message: { key: 'schedule.finish' } },
    ]);
  });

  it('has only start and finish in drink mode without fluid or duration', () => {
    for (const fluidMlPerHour of [0, -100, NaN, undefined]) {
      expect(buildSchedule({ durationMin: 90, type: 'drink', gelsPerHour: 3, fluidMlPerHour })).toEqual([
        { timeMin: 0, type: 'start', message: { key: 'schedule.start' } },
        { timeMin: 90, type: 'finish', message: { key: 'schedule.finish' } },
      ]);
    }
    for (const durationMin of [0, -30, NaN, Infinity, undefined]) {
      expect(buildSchedule({ durationMin, type: 'drink', fluidMlPerHour: 500 })).toEqual([
        { timeMin: 0, type: 'start', message: { key: 'schedule.start' } },
        { timeMin: 0, type: 'hydration', message: { key: 'schedule.hydrationOnly', params: { mlPerHour: 500 } } },
        { timeMin: 0, type: 'finish', message: { key: 'schedule.finish' } },
      ]);
    }
  });

  it('keeps huge inputs bounded and finite in drink mode', () => {
    const events = buildSchedule({ durationMin: 1e12, type: 'drink', fluidMlPerHour: 600 });
    expect(events).toEqual(buildSchedule({ durationMin: 10080, type: 'drink', fluidMlPerHour: 600 }));
    expect(byType(events, 'drink')).toHaveLength(10080 / 20);
    // Fluid rates above 100 l/h are clamped, so the running totals never overflow.
    for (const type of ['gel', 'drink', 'both']) {
      const huge = buildSchedule({ durationMin: 120, type, gelsPerHour: 1, fluidMlPerHour: Number.MAX_VALUE });
      expect(huge).toEqual(buildSchedule({ durationMin: 120, type, gelsPerHour: 1, fluidMlPerHour: 100000 }));
      expect(huge.every((e) => !('fluidMl' in e) || Number.isFinite(e.fluidMl))).toBe(true);
      expect(totalFluid(huge)).toBe(200000);
    }
  });

  it('builds gel events with their fluid in both mode, exactly as in gel mode', () => {
    const drink = { bottles: 2, bottleMl: 750 };
    for (const base of [
      { durationMin: 180, gelsPerHour: 3, fluidMlPerHour: 500, caffeine: CAFFEINE_180_TABLETS, bicarb: BICARB_ON },
      { durationMin: 61, gelsPerHour: 1, fluidMlPerHour: 800 },
      { durationMin: 100, gelsPerHour: 0.5, fluidMlPerHour: 500, caffeine: CAFFEINE_180 },
      { durationMin: 90, gelsPerHour: 2, fluidMlPerHour: 0 },
    ]) {
      expect(buildSchedule({ ...base, type: 'both', drink })).toEqual(buildSchedule({ ...base, type: 'gel' }));
    }
  });

  it('lists the drink as sips in both mode when no gel carries the fluid', () => {
    // No gels (e.g. a plan without carbs): the bottle carries the fluid and the electrolytes.
    expect(
      buildSchedule({ durationMin: 60, type: 'both', gelsPerHour: 0, fluidMlPerHour: 450, drink: { bottles: 1, bottleMl: 500 } }),
    ).toEqual([
      { timeMin: 0, type: 'start', message: { key: 'schedule.start' } },
      sip(0, 150, 1),
      sip(20, 150, 1),
      sip(40, 150, 1),
      { timeMin: 60, type: 'finish', message: { key: 'schedule.finish' } },
    ]);
    // 12 gels/h at 30 ml/h: 2.5 ml per gel rounds to 0, but 10 ml per 20 min does not.
    const events = buildSchedule({ durationMin: 60, type: 'both', gelsPerHour: 12, fluidMlPerHour: 30 });
    const gelOnly = buildSchedule({ durationMin: 60, type: 'gel', gelsPerHour: 12, fluidMlPerHour: 30 });
    expect(byType(events, 'fuel')).toEqual(byType(gelOnly, 'fuel'));
    expect(byType(events, 'hydration')).toEqual([]);
    expect(byType(events, 'drink')).toEqual([sip(0, 10, 1), sip(20, 10, 1), sip(40, 10, 1)]);
    // At the same minute the sip comes after the start and before the gel (gel 5 at 20 min).
    expect(at(events, 0).map((e) => e.type)).toEqual(['start', 'drink']);
    expect(at(events, 20).map((e) => [e.type, e.message.params])).toEqual([
      ['drink', { ml: 10, bottle: 1 }],
      ['fuel', { gel: 5 }],
    ]);
  });

  it('does not mutate a drink plan and returns the same output for the same input', () => {
    const deepFreeze = (o) => {
      Object.values(o).forEach((v) => v && typeof v === 'object' && deepFreeze(v));
      return Object.freeze(o);
    };
    const input = deepFreeze({
      durationMin: 180,
      type: 'drink',
      fluidMlPerHour: 600,
      drink: { bottles: 2, bottleMl: 950, perBottle: { carbsG: 45, fillMl: 900 } },
      caffeine: structuredClone(CAFFEINE_180),
      bicarb: structuredClone(BICARB_ON),
    });
    const first = buildSchedule(input);
    expect(buildSchedule(input)).toEqual(first);
    expect(input.drink).toEqual({ bottles: 2, bottleMl: 950, perBottle: { carbsG: 45, fillMl: 900 } });
    expect(input.caffeine).toEqual(CAFFEINE_180);
  });
});

/** Drink and both mode inputs: a drink sized like `drinkBottles`, a given count, or none. */
const formatInput = fc
  .record({
    type: fc.constantFrom('drink', 'both'),
    durationMin: fc.integer({ min: 0, max: 1440 }),
    gelsPerHour: fc.constantFrom(0, 0.25, 1, 2, 3, 4, 6, 12),
    fluidMlPerHour: fc.integer({ min: 0, max: 1500 }),
    bottleMl: fc.oneof(fc.constantFrom(500, 750, 950), fc.integer({ min: 250, max: 1500 })),
    bottlesMode: fc.constantFrom('derived', 'given', 'missing'),
    givenBottles: fc.integer({ min: 1, max: 8 }),
    intra: fc.array(
      fc.record({ timeShare: fc.double({ min: 0, max: 1, noNaN: true }), mg: fc.integer({ min: 1, max: 40 }).map((n) => n * 5) }),
      { maxLength: 4 },
    ),
  })
  .map(({ type, durationMin, gelsPerHour, fluidMlPerHour, bottleMl, bottlesMode, givenBottles, intra }) => {
    const plannedMl = (fluidMlPerHour * durationMin) / 60;
    // A missing drink means 750 ml bottles, as many as the plan's fluid needs.
    const sizeMl = bottlesMode === 'missing' ? 750 : bottleMl;
    const derived = plannedMl > 0 ? Math.max(1, Math.ceil(plannedMl / sizeMl - 1e-9)) : 0;
    let drink;
    if (bottlesMode === 'derived') drink = { bottles: derived, bottleMl };
    else if (bottlesMode === 'given') drink = { bottles: givenBottles, bottleMl };
    const doses = intra.map(({ timeShare, mg }) => ({
      timeMin: Math.round(timeShare * durationMin),
      mg,
      kind: 'intra',
      gelIndex: 0,
      tablets: null,
    }));
    return {
      type,
      durationMin,
      gelsPerHour,
      fluidMlPerHour,
      drink,
      caffeine: { ...CAFFEINE_OFF, enabled: true, doses },
      expectedBottleMl: sizeMl,
      expectedBottles: bottlesMode === 'given' ? givenBottles : Math.max(1, derived),
      countGiven: bottlesMode === 'given',
    };
  });

describe('buildSchedule: drink and both properties', () => {
  it('keeps the sips on the 20 min grid, within the plan, with valid bottle numbers', () => {
    fc.assert(
      fc.property(formatInput, ({ expectedBottleMl, expectedBottles, countGiven, ...input }) => {
        const events = buildSchedule(input);
        for (let i = 1; i < events.length; i += 1) {
          expect(events[i].timeMin).toBeGreaterThanOrEqual(events[i - 1].timeMin);
        }
        expect(byType(events, 'start')).toHaveLength(1);
        expect(events.at(-1)).toEqual({ timeMin: input.durationMin, type: 'finish', message: { key: 'schedule.finish' } });

        const gelMode = buildSchedule({ ...input, type: 'gel' });
        const gelsCarryFluid = gelMode.some((e) => 'fluidMl' in e);
        if (input.type === 'drink') {
          expect(byType(events, 'fuel')).toEqual([]);
          expect(byType(events, 'start')[0].message).toEqual({ key: 'schedule.start' });
        } else if (gelsCarryFluid) {
          // Both mode with fluid on the gels is gel mode.
          expect(events).toEqual(gelMode);
        } else {
          expect(byType(events, 'fuel')).toEqual(byType(gelMode, 'fuel'));
        }

        const sips = byType(events, 'drink');
        const planned = (input.fluidMlPerHour * input.durationMin) / 60;
        // Each bottle is filled to an equal share of the plan's fluid (at most its size), as drinkBottles fills it.
        const fillMl = Math.min(expectedBottleMl, planned / expectedBottles);
        let listedBefore = 0;
        let previousLast = 1;
        for (const e of sips) {
          expect(e.timeMin % DRINK_INTERVAL_MIN).toBe(0);
          expect(e.timeMin).toBeLessThan(input.durationMin);
          expect(e.fluidMl).toBeGreaterThan(0);
          expect(e.fluidMl % 10).toBe(0);
          const last = e.lastBottle ?? e.bottle;
          if (last === e.bottle) {
            expect('lastBottle' in e).toBe(false);
            expect(e.message).toEqual({ key: 'schedule.drinkSip', params: { ml: e.fluidMl, bottle: e.bottle } });
          } else if (last === e.bottle + 1) {
            expect(e.message).toEqual({ key: 'schedule.drinkSipSwitch', params: { ml: e.fluidMl, bottle: e.bottle, next: last } });
          } else {
            expect(last).toBeGreaterThan(e.bottle + 1);
            expect(e.message).toEqual({
              key: 'schedule.drinkSipSpan',
              params: { ml: e.fluidMl, bottle: e.bottle, finished: last - 1, next: last },
            });
          }
          // Within 10 ml of the plan's fluid for its 20 min (or until the finish).
          const end = Math.min(e.timeMin + DRINK_INTERVAL_MIN, input.durationMin);
          expect(Math.abs(e.fluidMl - (input.fluidMlPerHour * (end - e.timeMin)) / 60)).toBeLessThan(10 + 1e-6);
          // [almond2005] the running total never runs ahead of the plan.
          const before = listedBefore;
          listedBefore += e.fluidMl;
          expect(listedBefore).toBeLessThanOrEqual((input.fluidMlPerHour * end) / 60 + 1e-6);
          // The bottles holding the first and the last ml of the sip, never past the last bottle.
          expect(e.bottle).toBe(Math.min(expectedBottles, Math.floor(before / fillMl + 1e-9) + 1));
          expect(last).toBe(Math.min(expectedBottles, Math.max(e.bottle, Math.ceil(listedBefore / fillMl - 1e-9))));
          // Bottles are drunk in order: a sip starts on the bottle the last one ended in, or the next one.
          expect(e.bottle).toBeGreaterThanOrEqual(previousLast);
          expect(e.bottle).toBeLessThanOrEqual(previousLast + 1);
          expect(last).toBeLessThanOrEqual(expectedBottles);
          previousLast = last;
        }
        // With bottles sized like drinkBottles (the derived or default count), the listed sips empty every
        // bottle: they reach the last bottle and leave less than 10 ml of the mixed drink.
        if (!countGiven && sips.length > 0) {
          expect(previousLast).toBe(expectedBottles);
          expect(listedBefore).toBeGreaterThan(expectedBottles * fillMl - 10);
        }

        const listed = totalFluid(events);
        expect(listed).toBeLessThanOrEqual(planned + 1e-6);
        const hydration = byType(events, 'hydration');
        if (input.fluidMlPerHour > 0 && input.durationMin > 0) {
          if (listed > 0) {
            expect(hydration).toEqual([]);
            expect(listed).toBeGreaterThan(planned - 10 - 1e-6);
          } else {
            expect(hydration).toHaveLength(1);
          }
        } else if (input.fluidMlPerHour === 0) {
          expect(sips).toEqual([]);
          expect(hydration).toEqual([]);
        }

        const plannedMg = input.caffeine.doses.reduce((sum, d) => sum + d.mg, 0);
        expect(events.reduce((sum, e) => sum + (e.caffeineMg ?? 0), 0)).toBe(plannedMg);
        for (const e of events) {
          expect(EVENT_TYPES).toContain(e.type);
          expect(catalog).toHaveProperty([e.message.key]);
        }
      }),
    );
  });
});

describe('i18n catalog (en/schedule)', () => {
  const collectMessages = () => {
    const inputs = [
      {},
      { durationMin: 90, gelsPerHour: 0, fluidMlPerHour: 400 },
      { durationMin: 180, gelsPerHour: 3, fluidMlPerHour: 0, caffeine: CAFFEINE_180_TABLETS },
      { durationMin: 180, gelsPerHour: 3, fluidMlPerHour: 600, caffeine: CAFFEINE_180, bicarb: BICARB_ON },
      { durationMin: 180, gelsPerHour: 3, fluidMlPerHour: 600, caffeine: CAFFEINE_180_TABLETS },
      {
        durationMin: 100,
        gelsPerHour: 0.5,
        caffeine: {
          ...CAFFEINE_OFF,
          enabled: true,
          doses: [{ timeMin: 0, mg: 50, kind: 'intra', gelIndex: 0, tablets: 0.5 }],
        },
      },
      {
        durationMin: 100,
        gelsPerHour: 0.5,
        fluidMlPerHour: 500,
        caffeine: {
          ...CAFFEINE_OFF,
          enabled: true,
          doses: [{ timeMin: 0, mg: 50, kind: 'intra', gelIndex: 0, tablets: 0.5 }],
        },
      },
      { durationMin: 60, gelsPerHour: 12, fluidMlPerHour: 20 },
      { durationMin: 120, type: 'drink', fluidMlPerHour: 600, drink: { bottles: 2, bottleMl: 750 }, caffeine: CAFFEINE_180 },
      { durationMin: 90, type: 'both', gelsPerHour: 0, fluidMlPerHour: 500, drink: { bottles: 1, bottleMl: 750 } },
      { durationMin: 180, type: 'drink', fluidMlPerHour: 500, drink: { bottles: 2, bottleMl: 750 } },
      { durationMin: 60, type: 'drink', fluidMlPerHour: 1200, drink: { bottleMl: 250 } },
    ];
    return inputs.flatMap((input) => buildSchedule(input).map((e) => e.message));
  };

  it('has text for every key the module returns, with exactly the params it uses', () => {
    const messages = collectMessages();
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) {
      expect(catalog, `missing key ${message.key}`).toHaveProperty([message.key]);
      const placeholders = [...catalog[message.key].matchAll(/\{(\w+)(?::\w+)*\}/g)].map((m) => m[1]).sort();
      expect(placeholders, message.key).toEqual(Object.keys(message.params ?? {}).sort());
    }
  });

  it('has no unreachable message keys', () => {
    const returned = new Set(collectMessages().map((m) => m.key));
    const messageKeys = Object.keys(catalog).filter((key) => !key.startsWith('schedule.title.'));
    expect(messageKeys.filter((key) => !returned.has(key))).toEqual([]);
  });

  it('has a title for every event type', () => {
    for (const type of EVENT_TYPES) {
      expect(catalog).toHaveProperty([`schedule.title.${type}`]);
    }
  });

  it('keeps every key in the schedule namespace and follows the copy style', () => {
    for (const [key, text] of Object.entries(catalog)) {
      expect(key.startsWith('schedule.')).toBe(true);
      expect(typeof text).toBe('string');
      expect(text).not.toMatch(/—/); // no em dash
      expect(text).not.toMatch(/\d-\d/); // ranges use an en dash
    }
  });
});
