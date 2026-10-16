import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getGelTimes, getGelCount, formatElapsed, buildSchedule } from './schedule';
import catalog from '../i18n/en/schedule';

const EVENT_TYPES = ['bicarb', 'caffeine', 'start', 'fuel', 'hydration', 'finish'];

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

describe('getGelTimes / getGelCount / formatElapsed (moved from src/lib/schedule.js)', () => {
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

  it('formats elapsed time without producing 60 minutes', () => {
    expect(formatElapsed(30)).toBe('T+30m');
    expect(formatElapsed(60)).toBe('T+1h');
    expect(formatElapsed(85.7)).toBe('T+1h 26m');
    expect(formatElapsed(119.6)).toBe('T+2h');
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
      { timeMin: 0, type: 'start', message: { key: 'schedule.startWithGel' } },
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
    expect(events[0]).toEqual({ timeMin: 0, type: 'start', message: { key: 'schedule.startWithGel' } });
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
      const fuel = byType(buildSchedule({ durationMin: 90, gelsPerHour: 2, fluidMlPerHour }), 'fuel');
      expect(fuel).toEqual([
        { timeMin: 30, type: 'fuel', message: { key: 'schedule.fuel', params: { gel: 2 } } },
        { timeMin: 60, type: 'fuel', message: { key: 'schedule.fuel', params: { gel: 3 } } },
      ]);
    }
    // 20 ml/h × 5 min / 60 = 1.7 → 0
    const fuel = byType(buildSchedule({ durationMin: 60, gelsPerHour: 12, fluidMlPerHour: 20 }), 'fuel');
    expect(fuel).toHaveLength(11);
    expect(fuel.every((e) => !('fluidMl' in e) && e.message.key === 'schedule.fuel')).toBe(true);
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
      expect(buildSchedule({ durationMin, gelsPerHour: 3, fluidMlPerHour: 500 })).toEqual([
        { timeMin: 0, type: 'start', message: { key: 'schedule.startWithGel' } },
        { timeMin: 0, type: 'finish', message: { key: 'schedule.finish' } },
      ]);
    }
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
        message: { key: 'schedule.startWithGelAndCaffeine', params: { caffeineMg: 50 } },
        caffeineMg: 50,
      },
      { timeMin: 100, type: 'finish', message: { key: 'schedule.finish' } },
    ]);
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
        expect(byType(events, 'hydration')).toHaveLength(gelCount === 0 && input.fluidMlPerHour > 0 ? 1 : 0);
        expect(byType(events, 'bicarb')).toHaveLength(input.bicarb.enabled ? 1 : 0);

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
    ];
    return inputs.flatMap((input) => buildSchedule(input).map((e) => e.message));
  };

  it('has text for every key the module returns, with exactly the params it uses', () => {
    const messages = collectMessages();
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) {
      expect(catalog, `missing key ${message.key}`).toHaveProperty([message.key]);
      const placeholders = [...catalog[message.key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
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
