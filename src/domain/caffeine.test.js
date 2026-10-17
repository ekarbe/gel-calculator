import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { CAFFEINE_HALF_LIFE_MIN, bodyLoadAt, planCaffeine } from './caffeine';
import { CITATIONS } from './evidence';
import caffeineCatalog from '../i18n/en/caffeine';

/** Gel times like the schedule produces: first at 0, then every 60 / perHour min. */
function gelTimes(durationMin, perHour) {
  const interval = 60 / perHour;
  const count = Math.max(1, Math.ceil(durationMin / interval - 1e-9));
  return Array.from({ length: count }, (_, i) => i * interval);
}

const ids = (plan) => plan.warnings.map((w) => w.id);
const strip = (plan) => plan.doses.map(({ timeMin, mg, kind, gelIndex, tablets }) => ({ timeMin, mg, kind, gelIndex, tablets }));

/** Collects every message descriptor in a caffeine plan. */
function messagesOf(plan) {
  return [plan.why.summary, ...(plan.why.details ?? []), ...plan.warnings.map((w) => w.message)];
}

function placeholders(text) {
  return [...text.matchAll(/\{(\w+)(?::\w+)*\}/g)].map((m) => m[1]);
}

describe('CAFFEINE_HALF_LIFE_MIN', () => {
  it('is 5 h', () => {
    expect(CAFFEINE_HALF_LIFE_MIN).toBe(300);
  });
});

describe('bodyLoadAt', () => {
  const doses = [
    { timeMin: -60, mg: 200 },
    { timeMin: 120, mg: 100 },
  ];

  it('halves the load every 300 min', () => {
    expect(bodyLoadAt([{ timeMin: 0, mg: 100 }], 300)).toBeCloseTo(50, 10);
    expect(bodyLoadAt([{ timeMin: 0, mg: 100 }], 600)).toBeCloseTo(25, 10);
  });

  it('counts a dose at its own time with no decay', () => {
    expect(bodyLoadAt([{ timeMin: 0, mg: 100 }], 0)).toBe(100);
  });

  it('ignores doses taken after the time', () => {
    expect(bodyLoadAt(doses, -61)).toBe(0);
    expect(bodyLoadAt(doses, 119)).toBeCloseTo(200 * 0.5 ** (179 / 300), 10);
  });

  it('sums decayed doses', () => {
    expect(bodyLoadAt(doses, 120)).toBeCloseTo(200 * 0.5 ** (180 / 300) + 100, 10);
  });

  it('returns 0 for an empty list, a non-array or a non-finite time', () => {
    expect(bodyLoadAt([], 100)).toBe(0);
    expect(bodyLoadAt(undefined, 100)).toBe(0);
    expect(bodyLoadAt(doses, Number.NaN)).toBe(0);
  });

  it('skips doses with non-finite values', () => {
    expect(bodyLoadAt([{ timeMin: Number.NaN, mg: 100 }, { timeMin: 0, mg: Infinity }, null], 10)).toBe(0);
  });
});

describe('planCaffeine: disabled', () => {
  it('returns an empty plan with no warnings', () => {
    const plan = planCaffeine({ enabled: false, massKg: 70, durationMin: 180 });
    expect(plan).toMatchObject({
      enabled: false,
      doses: [],
      totalMg: 0,
      totalMgPerKg: 0,
      peakBodyLoadMgPerKg: 0,
      warnings: [],
    });
    expect(plan.why.summary.key).toBe('caffeine.why.disabled');
    expect(plan.why.citations).toContain('guest2021');
  });

  it('treats missing input as disabled', () => {
    expect(planCaffeine().enabled).toBe(false);
    expect(planCaffeine({}).doses).toEqual([]);
  });
});

describe('planCaffeine: golden examples', () => {
  it('60 min: one pre dose of D at −60 min', () => {
    // [guest2021] 3–6 mg/kg about 60 min before exercise
    const plan = planCaffeine({ enabled: true, massKg: 70, mgPerKg: 3, durationMin: 60 });
    expect(strip(plan)).toEqual([{ timeMin: -60, mg: 210, kind: 'pre', gelIndex: null, tablets: null }]);
    expect(plan.totalMg).toBe(210);
    expect(plan.totalMgPerKg).toBeCloseTo(3, 10);
    expect(plan.peakBodyLoadMgPerKg).toBeCloseTo(3, 10);
    expect(plan.why.summary.key).toBe('caffeine.why.short');
    expect(plan.why.citations).toEqual(expect.arrayContaining(['guest2021', 'carvalho2022', 'efsa2015']));
  });

  it('75 min is still the single-dose band', () => {
    const plan = planCaffeine({ enabled: true, massKg: 70, mgPerKg: 3, durationMin: 75 });
    expect(plan.doses).toHaveLength(1);
    expect(plan.why.summary.key).toBe('caffeine.why.short');
  });

  it('180 min: pre 2/3 at −60 min and a late intra 1/3 at 2/3 of the event', () => {
    // [talanian2016] low doses late in exercise improve performance
    const plan = planCaffeine({ enabled: true, massKg: 70, mgPerKg: 3, durationMin: 180 });
    expect(strip(plan)).toEqual([
      { timeMin: -60, mg: 140, kind: 'pre', gelIndex: null, tablets: null },
      { timeMin: 120, mg: 70, kind: 'intra', gelIndex: null, tablets: null },
    ]);
    expect(plan.totalMg).toBe(210);
    expect(plan.why.summary.key).toBe('caffeine.why.medium');
    expect(plan.why.summary.params).toMatchObject({ preMg: 140, intraMg: 70 });
    expect(plan.why.citations).toContain('talanian2016');
  });

  it('76 min is the split band', () => {
    const plan = planCaffeine({ enabled: true, massKg: 70, mgPerKg: 3, durationMin: 76 });
    expect(plan.doses.map((d) => d.kind)).toEqual(['pre', 'intra']);
    expect(plan.doses[1].timeMin).toBe(51); // round(76 × 2/3) = round(50.67)
  });

  it('180 min as an ingredient: half-tablet rounding and the gel at or before 120 min', () => {
    // [efsa2015] tablets, not powder; [talanian2016] late dose
    const gels = gelTimes(180, 3); // 0, 20, …, 160
    const plan = planCaffeine({
      enabled: true,
      massKg: 70,
      mgPerKg: 3,
      durationMin: 180,
      gelTimesMin: gels,
      asIngredient: true,
      tabletMg: 100,
    });
    expect(strip(plan)).toEqual([
      { timeMin: -60, mg: 150, kind: 'pre', gelIndex: null, tablets: 1.5 },
      { timeMin: 120, mg: 50, kind: 'intra', gelIndex: 6, tablets: 0.5 },
    ]);
    expect(gels[plan.doses[1].gelIndex]).toBe(120);
  });

  it('moves an intra dose to the last gel up to 30 min before it', () => {
    const plan = planCaffeine({
      enabled: true,
      massKg: 70,
      mgPerKg: 3,
      durationMin: 180,
      gelTimesMin: [0, 50, 100, 150],
      asIngredient: true,
      tabletMg: 100,
    });
    expect(plan.doses[1]).toMatchObject({ kind: 'intra', timeMin: 100, gelIndex: 2, mg: 50, tablets: 0.5 });
  });

  it('300 min: pre dose plus top-ups from halfway, body load ≤ 6 mg/kg', () => {
    // [guest2021] total 3 mg/kg, top-ups of min(1.5, mgPerKg/2) mg/kg
    const plan = planCaffeine({ enabled: true, massKg: 70, mgPerKg: 3, durationMin: 300 });
    expect(strip(plan)).toEqual([
      { timeMin: -60, mg: 140, kind: 'pre', gelIndex: null, tablets: null },
      { timeMin: 150, mg: 105, kind: 'intra', gelIndex: null, tablets: null },
    ]);
    expect(plan.peakBodyLoadMgPerKg).toBeLessThanOrEqual(6);
    expect(plan.peakBodyLoadMgPerKg).toBeCloseTo((140 * 0.5 ** (210 / 300) + 105) / 70, 10);
    expect(plan.why.summary.key).toBe('caffeine.why.long');
    expect(plan.why.summary.params).toMatchObject({ preMg: 140, intraMg: 105, topUps: 1 });
  });

  it('600 min: top-ups every 150 min while t ≤ d − 30', () => {
    const plan = planCaffeine({ enabled: true, massKg: 70, mgPerKg: 3, durationMin: 600 });
    expect(plan.doses.map((d) => [d.kind, d.timeMin, d.mg])).toEqual([
      ['pre', -60, 140],
      ['intra', 300, 105],
      ['intra', 450, 105],
    ]);
  });

  it('habitual intake does not change the dose', () => {
    // [carvalho2022] habitual intake does not change the dose
    const input = { enabled: true, massKg: 70, mgPerKg: 3, durationMin: 180 };
    const plan = planCaffeine(input);
    for (const habit of [{ habituation: 'high' }, { habitual: true }, { habitualMgPerDay: 600 }]) {
      expect(planCaffeine({ ...input, ...habit })).toEqual(plan);
    }
    expect(plan.why.details).toContainEqual({ key: 'caffeine.why.habitual' });
    expect(plan.why.citations).toContain('carvalho2022');
  });

  it('top-ups are mgPerKg / 2 when that is below 1.5 mg/kg', () => {
    const plan = planCaffeine({ enabled: true, massKg: 80, mgPerKg: 2, durationMin: 240 });
    // pre 2 × 80 × 2/3 = 106.67 → 105; top-up 1 × 80 = 80 at 120
    expect(plan.doses.map((d) => [d.kind, d.timeMin, d.mg])).toEqual([
      ['pre', -60, 105],
      ['intra', 120, 80],
    ]);
  });
});

describe('planCaffeine: gel assignment', () => {
  const base = { enabled: true, massKg: 70, mgPerKg: 3, durationMin: 180, asIngredient: true, tabletMg: 100 };

  it('uses the first gel after the dose when every gel comes later', () => {
    const plan = planCaffeine({ ...base, gelTimesMin: [130, 160] });
    expect(plan.doses[1]).toMatchObject({ timeMin: 130, gelIndex: 0 });
  });

  // [talanian2016] a late dose must stay late: never moved to a gel far earlier
  it('keeps a late dose as a separate tablet when the only gel is at the start', () => {
    // 100 min at 0.5 gels/h: one gel at 0; the dose is planned at round(100 × 2/3) = 67 min.
    const plan = planCaffeine({ ...base, durationMin: 100, gelTimesMin: gelTimes(100, 0.5) });
    expect(strip(plan)).toEqual([
      { timeMin: -60, mg: 150, kind: 'pre', gelIndex: null, tablets: 1.5 },
      { timeMin: 67, mg: 50, kind: 'intra', gelIndex: null, tablets: 0.5 },
    ]);
    expect(plan.why.summary.key).toBe('caffeine.why.medium');
  });

  it('uses the next gel when the last earlier gel is more than 30 min before the dose', () => {
    // 150 min at 1 gel/h (0, 60, 120): the dose at 100 min goes to 120, not back to 60.
    const plan = planCaffeine({ ...base, durationMin: 150, gelTimesMin: gelTimes(150, 1) });
    expect(plan.doses[1]).toMatchObject({ kind: 'intra', timeMin: 120, gelIndex: 2 });
  });

  it('never moves a dose more than 30 min or into the last 30 min', () => {
    // Earlier gel 50 min before, later gel 40 min after: neither is close enough.
    expect(planCaffeine({ ...base, gelTimesMin: [0, 70, 160] }).doses[1]).toMatchObject({
      timeMin: 120,
      gelIndex: null,
    });
    // 150 min: the gel at 125 is close to the dose at 100 but inside the last 30 min.
    expect(planCaffeine({ ...base, durationMin: 150, gelTimesMin: [0, 125] }).doses[1]).toMatchObject({
      timeMin: 100,
      gelIndex: null,
    });
  });

  it('keeps gelIndex null without gel times', () => {
    const plan = planCaffeine({ ...base, gelTimesMin: [] });
    expect(plan.doses[1]).toMatchObject({ timeMin: 120, gelIndex: null, tablets: 0.5 });
  });

  it('keeps gelIndex null and the time when caffeine is not an ingredient', () => {
    const plan = planCaffeine({ ...base, asIngredient: false, gelTimesMin: gelTimes(180, 3) });
    expect(plan.doses[1]).toMatchObject({ timeMin: 120, gelIndex: null, tablets: null });
  });

  it('never assigns the pre dose to a gel', () => {
    const plan = planCaffeine({ ...base, gelTimesMin: gelTimes(180, 3) });
    expect(plan.doses[0]).toMatchObject({ kind: 'pre', timeMin: -60, gelIndex: null });
  });

  it('skips non-finite gel times', () => {
    const plan = planCaffeine({ ...base, gelTimesMin: [Number.NaN, 30, 90] });
    expect(plan.doses[1]).toMatchObject({ timeMin: 90, gelIndex: 2 });
    const none = planCaffeine({ ...base, gelTimesMin: [Number.NaN] });
    expect(none.doses[1]).toMatchObject({ timeMin: 120, gelIndex: null });
  });

  it('keeps top-ups far from every gel as separate tablets at their own times', () => {
    // 1440 min, 70 kg, 2 mg/kg: five top-ups of 70 mg → half a tablet (50 mg) each at 720, 870,
    // 1020, 1170 and 1320. The only gel (600 min) is more than 30 min from all of them.
    const plan = planCaffeine({ ...base, mgPerKg: 2, durationMin: 1440, gelTimesMin: [600] });
    const intra = plan.doses.filter((d) => d.kind === 'intra');
    expect(intra.map((d) => [d.timeMin, d.mg, d.gelIndex, d.tablets])).toEqual([
      [720, 50, null, 0.5],
      [870, 50, null, 0.5],
      [1020, 50, null, 0.5],
      [1170, 50, null, 0.5],
      [1320, 50, null, 0.5],
    ]);
    expect(plan.totalMg).toBe(100 + 250); // pre 93.3 mg → 2 half tablets
  });
});

describe('planCaffeine: body-load cap', () => {
  it('rounds a pre dose down when half-tablet rounding would pass 6 mg/kg', () => {
    // [guest2021] 6 mg/kg upper end; 40 kg × 6 = 240 mg → 4.8 halves → 5 → 250 mg > 240 mg
    const plan = planCaffeine({ enabled: true, massKg: 40, mgPerKg: 6, durationMin: 60, asIngredient: true, tabletMg: 100 });
    expect(strip(plan)).toEqual([{ timeMin: -60, mg: 200, kind: 'pre', gelIndex: null, tablets: 2 }]);
    expect(ids(plan)).toContain('caffeine.capped');
    expect(plan.peakBodyLoadMgPerKg).toBeLessThanOrEqual(6);
  });

  it('rounds a pre dose down when 5 mg rounding would pass 6 mg/kg', () => {
    // 40.6 kg × 6 = 243.6 mg → 245 mg would be 6.03 mg/kg
    const plan = planCaffeine({ enabled: true, massKg: 40.6, mgPerKg: 6, durationMin: 60 });
    expect(plan.doses[0].mg).toBe(240);
    expect(ids(plan)).toContain('caffeine.capped');
  });

  it('reduces an intra dose to the largest half-tablet amount that fits', () => {
    // 50 kg, 3 mg/kg, 48 h at 2 gels/h: pre 100 mg, then top-ups of 75 → 100 mg (one tablet) every
    // 150 min from 1440. They build up in the body; at 2340 and 2640 min a whole tablet would pass
    // 300 mg (6 mg/kg), so those gels get half a tablet.
    const plan = planCaffeine({
      enabled: true,
      massKg: 50,
      mgPerKg: 3,
      durationMin: 2880,
      gelTimesMin: gelTimes(2880, 2),
      asIngredient: true,
      tabletMg: 100,
    });
    const intra = plan.doses.filter((d) => d.kind === 'intra');
    expect(intra.map((d) => [d.timeMin, d.mg, d.tablets])).toEqual([
      [1440, 100, 1],
      [1590, 100, 1],
      [1740, 100, 1],
      [1890, 100, 1],
      [2040, 100, 1],
      [2190, 100, 1],
      [2340, 50, 0.5],
      [2490, 100, 1],
      [2640, 50, 0.5],
      [2790, 100, 1],
    ]);
    expect(intra.every((d) => d.gelIndex !== null)).toBe(true);
    expect(ids(plan)).toContain('caffeine.capped');
    expect(plan.peakBodyLoadMgPerKg).toBeLessThanOrEqual(6);
  });

  it('drops an intra dose when not even half a tablet fits', () => {
    // 30 kg, 200 mg tablets: pre 120 → 100 mg; intra 60 → 100 mg, planned at 51 min, moved to the
    // gel at 30 min; load 100 × 0.5^(90/300) + 100 = 181.2 mg > 180 mg, room 98.8 mg < 100 mg
    const plan = planCaffeine({
      enabled: true,
      massKg: 30,
      mgPerKg: 6,
      durationMin: 76,
      gelTimesMin: [30],
      asIngredient: true,
      tabletMg: 200,
    });
    expect(plan.doses.map((d) => d.kind)).toEqual(['pre']);
    expect(ids(plan)).toContain('caffeine.capped');
    // The summary must not promise a 0 mg dose during the event.
    expect(plan.why.summary).toEqual({
      key: 'caffeine.why.preOnly',
      params: { preMg: 100, intraMg: 0, totalMg: 100, topUps: 0, maxMgPerKg: 6 },
    });
  });

  it('uses the pre-only summary when the cap drops the intra dose on a real gel schedule', () => {
    // 40 kg, 6 mg/kg, 200 mg tablets, 100 min, 2 gels/h: pre 240 → 200 mg; intra 80 → 100 mg on the
    // gel at 60 min; load 200 × 0.5^(120/300) + 100 = 251.6 mg > 240 mg, room 88.4 mg < 100 mg
    const plan = planCaffeine({
      enabled: true,
      massKg: 40,
      mgPerKg: 6,
      durationMin: 100,
      gelTimesMin: gelTimes(100, 2),
      asIngredient: true,
      tabletMg: 200,
    });
    expect(strip(plan)).toEqual([{ timeMin: -60, mg: 200, kind: 'pre', gelIndex: null, tablets: 1 }]);
    expect(ids(plan)).toContain('caffeine.capped');
    expect(plan.why.summary.key).toBe('caffeine.why.preOnly');
    expect(plan.why.summary.params).toMatchObject({ preMg: 200, maxMgPerKg: 6 });
  });

  it('keeps the band summary when an intra dose was only reduced', () => {
    const plan = planCaffeine({
      enabled: true,
      massKg: 50,
      mgPerKg: 3,
      durationMin: 2880,
      gelTimesMin: gelTimes(2880, 2),
      asIngredient: true,
      tabletMg: 100,
    });
    expect(ids(plan)).toContain('caffeine.capped');
    expect(plan.why.summary.key).toBe('caffeine.why.long');
    expect(plan.why.summary.params).toMatchObject({ preMg: 100, intraMg: 900, topUps: 10 });
  });

  it('does not warn when nothing was capped', () => {
    const plan = planCaffeine({ enabled: true, massKg: 70, mgPerKg: 3, durationMin: 300 });
    expect(ids(plan)).not.toContain('caffeine.capped');
  });
});

describe('planCaffeine: warnings', () => {
  it('always adds exclusions and try-in-training info', () => {
    // [efsa2015] exclusions: pregnancy, under 18, heart conditions, sensitivity
    const plan = planCaffeine({ enabled: true, massKg: 60, mgPerKg: 2, durationMin: 60 });
    expect(plan.warnings).toEqual([
      expect.objectContaining({ id: 'caffeine.exclusions', level: 'info', citations: ['efsa2015'] }),
      expect.objectContaining({ id: 'caffeine.tryInTraining', level: 'info' }),
    ]);
  });

  it('warns against powder when caffeine is an ingredient', () => {
    const plan = planCaffeine({ enabled: true, massKg: 70, durationMin: 180, asIngredient: true, tabletMg: 200 });
    const w = plan.warnings.find((x) => x.id === 'caffeine.noPowder');
    expect(w).toMatchObject({ level: 'danger', message: { key: 'caffeine.warn.noPowder', params: { tabletMg: 200 } } });
    expect(ids(planCaffeine({ enabled: true, massKg: 70, durationMin: 180 }))).not.toContain('caffeine.noPowder');
  });

  it('flags a single dose above 200 mg', () => {
    // [efsa2015] single doses up to 200 mg raise no safety concern
    const plan = planCaffeine({ enabled: true, massKg: 70, mgPerKg: 3, durationMin: 60 });
    const w = plan.warnings.find((x) => x.id === 'caffeine.singleDoseAbove200');
    expect(w).toMatchObject({ level: 'info', message: { params: { mg: 210 } }, citations: ['efsa2015'] });
    const exactly200 = planCaffeine({ enabled: true, massKg: 50, mgPerKg: 4, durationMin: 60 });
    expect(exactly200.doses[0].mg).toBe(200);
    expect(ids(exactly200)).not.toContain('caffeine.singleDoseAbove200');
  });

  it('flags a total above 9 mg/kg', () => {
    // [guest2021] ≥ 9 mg/kg: high incidence of side effects, no extra benefit
    // 70 kg, 6 mg/kg, 1440 min: pre 280 + 5 × 105 = 805 mg = 11.5 mg/kg
    const plan = planCaffeine({ enabled: true, massKg: 70, mgPerKg: 6, durationMin: 1440 });
    expect(plan.totalMg).toBe(805);
    const w = plan.warnings.find((x) => x.id === 'caffeine.highTotal');
    expect(w).toMatchObject({ level: 'warning', message: { params: { totalMg: 805, totalMgPerKg: 11.5 } } });
    expect(ids(planCaffeine({ enabled: true, massKg: 70, mgPerKg: 6, durationMin: 180 }))).not.toContain('caffeine.highTotal');
  });
});

describe('planCaffeine: edge cases', () => {
  it('clamps mgPerKg to 1–6', () => {
    expect(planCaffeine({ enabled: true, massKg: 70, mgPerKg: 10, durationMin: 60 }).totalMg).toBe(420);
    expect(planCaffeine({ enabled: true, massKg: 70, mgPerKg: 0, durationMin: 60 }).totalMg).toBe(70);
    expect(planCaffeine({ enabled: true, massKg: 70, mgPerKg: -5, durationMin: 60 }).totalMg).toBe(70);
  });

  it('clamps massKg to 30–200', () => {
    expect(planCaffeine({ enabled: true, massKg: 10, mgPerKg: 3, durationMin: 60 }).totalMg).toBe(90);
    expect(planCaffeine({ enabled: true, massKg: 500, mgPerKg: 3, durationMin: 60 }).totalMg).toBe(600);
  });

  it('falls back to defaults for non-finite numbers', () => {
    const plan = planCaffeine({ enabled: true, massKg: Number.NaN, mgPerKg: Infinity, durationMin: 60 });
    expect(plan.totalMg).toBe(210); // 70 kg × 3 mg/kg
    expect(planCaffeine({ enabled: true, massKg: 70, durationMin: 60, asIngredient: true, tabletMg: 0 }).doses[0].tablets).toBe(2);
  });

  it('treats zero, negative, NaN or missing duration as 0 (single pre dose)', () => {
    for (const durationMin of [0, -30, Number.NaN, -Infinity, undefined, null, '300']) {
      const plan = planCaffeine({ enabled: true, massKg: 70, durationMin });
      expect(plan.doses.map((d) => d.kind)).toEqual(['pre']);
    }
  });

  it('bounds the number of top-ups for huge durations, including Infinity', () => {
    const atMax = planCaffeine({ enabled: true, massKg: 70, mgPerKg: 3, durationMin: 2880 });
    for (const durationMin of [1e9, Infinity]) {
      const plan = planCaffeine({ enabled: true, massKg: 70, mgPerKg: 3, durationMin });
      expect(plan.doses).toEqual(atMax.doses);
      expect(plan.why.summary.key).toBe('caffeine.why.long');
    }
    expect(atMax.doses.length).toBeLessThan(12);
  });

  it('gives at least half a tablet per dose', () => {
    // 30 kg, 1 mg/kg, 200 mg tablets: 30 mg rounds up to half a tablet (100 mg), still below 180 mg
    const plan = planCaffeine({ enabled: true, massKg: 30, mgPerKg: 1, durationMin: 60, asIngredient: true, tabletMg: 200 });
    expect(plan.doses[0]).toMatchObject({ mg: 100, tablets: 0.5 });
  });

  it('does not mutate its inputs', () => {
    const gels = Object.freeze(gelTimes(300, 3));
    const input = Object.freeze({ enabled: true, massKg: 70, durationMin: 300, gelTimesMin: gels, asIngredient: true });
    expect(() => planCaffeine(input)).not.toThrow();
    expect(gels).toEqual(gelTimes(300, 3));
  });

  it('is deterministic', () => {
    const input = { enabled: true, massKg: 63, mgPerKg: 4.5, durationMin: 500, gelTimesMin: gelTimes(500, 2), asIngredient: true };
    expect(planCaffeine(input)).toEqual(planCaffeine(input));
  });
});

describe('planCaffeine: properties', () => {
  const inputs = fc.record({
    massKg: fc.double({ min: 40, max: 120, noNaN: true }),
    mgPerKg: fc.double({ min: 1, max: 6, noNaN: true }),
    durationMin: fc.oneof(fc.integer({ min: 0, max: 1440 }), fc.double({ min: 0, max: 1440, noNaN: true })),
    asIngredient: fc.boolean(),
    tabletMg: fc.constantFrom(100, 200),
    gelsPerHour: fc.integer({ min: 0, max: 6 }),
  });

  it('body load never exceeds 6 mg/kg', () => {
    // [guest2021] 6 mg/kg is the top of the effective range
    fc.assert(
      fc.property(inputs, ({ massKg, mgPerKg, durationMin, asIngredient, tabletMg, gelsPerHour }) => {
        const gelTimesMin = gelsPerHour > 0 ? gelTimes(durationMin, gelsPerHour) : [];
        const plan = planCaffeine({ enabled: true, massKg, mgPerKg, durationMin, gelTimesMin, asIngredient, tabletMg });
        const limit = 6 + 1e-6;
        expect(plan.peakBodyLoadMgPerKg).toBeLessThanOrEqual(limit);
        // Check independently at every dose time and on a 5 min grid.
        for (const dose of plan.doses) {
          expect(bodyLoadAt(plan.doses, dose.timeMin) / massKg).toBeLessThanOrEqual(limit);
        }
        for (let t = -60; t <= durationMin; t += 5) {
          expect(bodyLoadAt(plan.doses, t) / massKg).toBeLessThanOrEqual(limit);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('produces well-formed doses', () => {
    fc.assert(
      fc.property(inputs, ({ massKg, mgPerKg, durationMin, asIngredient, tabletMg, gelsPerHour }) => {
        const gelTimesMin = gelsPerHour > 0 ? gelTimes(durationMin, gelsPerHour) : [];
        const plan = planCaffeine({ enabled: true, massKg, mgPerKg, durationMin, gelTimesMin, asIngredient, tabletMg });
        expect(plan.doses.length).toBeGreaterThan(0);
        let sum = 0;
        plan.doses.forEach((dose, i) => {
          expect(Number.isFinite(dose.timeMin)).toBe(true);
          expect(dose.mg).toBeGreaterThan(0);
          if (i > 0) expect(dose.timeMin).toBeGreaterThanOrEqual(plan.doses[i - 1].timeMin);
          if (asIngredient) {
            expect(dose.tablets * tabletMg).toBeCloseTo(dose.mg, 9);
            expect(Number.isInteger(dose.tablets * 2)).toBe(true);
          } else {
            expect(dose.tablets).toBeNull();
            expect(dose.mg % 5).toBe(0);
          }
          if (dose.kind === 'pre') expect(dose.gelIndex).toBeNull();
          if (dose.gelIndex !== null) expect(dose.timeMin).toBe(gelTimesMin[dose.gelIndex]);
          sum += dose.mg;
        });
        // [talanian2016] a dose on a gel is at most 30 min from its planned time and never in the last
        // 30 min (unless planned there); doses never share a gel.
        const plannedIntra = [];
        if (durationMin > 75 && durationMin <= 180) plannedIntra.push(Math.round((durationMin * 2) / 3));
        if (durationMin > 180) {
          for (let t = Math.round(durationMin / 2); t <= durationMin - 30; t += 150) plannedIntra.push(t);
        }
        for (const dose of plan.doses.filter((d) => d.kind === 'intra')) {
          const plannedAt = plannedIntra.find((t) => Math.abs(t - dose.timeMin) <= 30 + 1e-9);
          expect(plannedAt).toBeDefined();
          if (dose.timeMin > plannedAt) expect(dose.timeMin).toBeLessThanOrEqual(durationMin - 30 + 1e-9);
        }
        const gelIndexes = plan.doses.filter((d) => d.gelIndex !== null).map((d) => d.gelIndex);
        expect(new Set(gelIndexes).size).toBe(gelIndexes.length);
        expect(plan.totalMg).toBeCloseTo(sum, 9);
        expect(plan.totalMgPerKg).toBeCloseTo(sum / massKg, 9);
      }),
      { numRuns: 300 },
    );
  });

  it('explains the plan with the amounts it actually contains', () => {
    fc.assert(
      fc.property(inputs, ({ massKg, mgPerKg, durationMin, asIngredient, tabletMg, gelsPerHour }) => {
        const gelTimesMin = gelsPerHour > 0 ? gelTimes(durationMin, gelsPerHour) : [];
        const plan = planCaffeine({ enabled: true, massKg, mgPerKg, durationMin, gelTimesMin, asIngredient, tabletMg });
        const { key, params } = plan.why.summary;
        const intra = plan.doses.filter((d) => d.kind === 'intra');
        // Only the single-dose texts may stand for a plan without intra doses.
        if (intra.length === 0) expect(['caffeine.why.short', 'caffeine.why.preOnly']).toContain(key);
        else expect(['caffeine.why.medium', 'caffeine.why.long']).toContain(key);
        if (key !== 'caffeine.why.short' && key !== 'caffeine.why.preOnly') expect(params.intraMg).toBeGreaterThan(0);
        expect(params.preMg + params.intraMg).toBeCloseTo(plan.totalMg, 9);
        const dose = plan.why.details.find((m) => m.key === 'caffeine.why.dose');
        expect(dose.params.totalMg).toBe(plan.totalMg);
        expect(dose.params.totalMgPerKg).toBe(Math.round(plan.totalMgPerKg * 10) / 10);
      }),
      { numRuns: 300 },
    );
  });
});

describe('caffeine i18n catalog', () => {
  const plans = [
    planCaffeine({ enabled: false }),
    planCaffeine({ enabled: true, massKg: 70, mgPerKg: 3, durationMin: 60 }),
    planCaffeine({ enabled: true, massKg: 70, mgPerKg: 3, durationMin: 180, asIngredient: true, gelTimesMin: gelTimes(180, 3) }),
    planCaffeine({ enabled: true, massKg: 70, mgPerKg: 6, durationMin: 1440 }),
    planCaffeine({ enabled: true, massKg: 40, mgPerKg: 6, durationMin: 60, asIngredient: true }),
    planCaffeine({ enabled: true, massKg: 40, mgPerKg: 6, durationMin: 100, asIngredient: true, tabletMg: 200, gelTimesMin: gelTimes(100, 2) }),
  ];
  const messages = plans.flatMap(messagesOf);

  it('states the real plan total, not D, in the dose detail', () => {
    // 70 kg, 6 mg/kg, 1440 min: D is 420 mg, but pre + top-ups add up to 805 mg (11.5 mg/kg),
    // the same numbers the highTotal warning shows.
    const plan = plans[3];
    const dose = plan.why.details.find((m) => m.key === 'caffeine.why.dose');
    const high = plan.warnings.find((w) => w.id === 'caffeine.highTotal');
    expect(dose.params).toEqual({ mgPerKg: 6, massKg: 70, doseMg: 420, totalMg: 805, totalMgPerKg: 11.5 });
    expect(high.message.params).toEqual({ totalMg: dose.params.totalMg, totalMgPerKg: dose.params.totalMgPerKg });
    expect(caffeineCatalog['caffeine.why.dose']).not.toMatch(/\{doseMg\} mg in total/);
    expect(caffeineCatalog['caffeine.why.dose']).toContain('{totalMg} mg');
  });

  it('has text for every key the module returns, with every placeholder filled', () => {
    for (const message of messages) {
      expect(caffeineCatalog, message.key).toHaveProperty([message.key]);
      for (const name of placeholders(caffeineCatalog[message.key])) {
        expect(message.params, `${message.key} {${name}}`).toHaveProperty([name]);
      }
    }
  });

  it('has no unused keys and only caffeine.* keys', () => {
    const used = new Set(messages.map((m) => m.key));
    expect(Object.keys(caffeineCatalog).sort()).toEqual([...used].sort());
    for (const key of Object.keys(caffeineCatalog)) expect(key.startsWith('caffeine.')).toBe(true);
  });

  it('uses message keys namespaced like the warning ids', () => {
    for (const w of plans.flatMap((p) => p.warnings)) {
      expect(w.message.key).toBe(w.id.replace('caffeine.', 'caffeine.warn.'));
    }
  });

  it('cites only known citation ids', () => {
    const cited = plans.flatMap((p) => [...p.why.citations, ...p.warnings.flatMap((w) => w.citations ?? [])]);
    for (const id of cited) expect(CITATIONS, id).toHaveProperty([id]);
  });
});
