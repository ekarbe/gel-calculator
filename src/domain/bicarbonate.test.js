import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { planBicarbonate } from './bicarbonate';
import { CITATIONS } from './evidence';
import bicarbCatalog from '../i18n/en/bicarb';

const ids = (plan) => plan.warnings.map((w) => w.id);

/** Collects every message descriptor in a bicarbonate plan. */
function messagesOf(plan) {
  return [plan.why.summary, ...(plan.why.details ?? []), ...plan.warnings.map((w) => w.message)];
}

function placeholders(text) {
  return [...text.matchAll(/\{(\w+)(?::\w+)*\}/g)].map((m) => m[1]);
}

describe('planBicarbonate: eligibility and visibility', () => {
  it.each([
    [0, true, true],
    [45, true, true],
    [60, true, true],
    [61, false, true],
    [90, false, true],
    [91, false, false],
    [600, false, false],
  ])('%i min → eligible %s, visible %s', (durationMin, eligible, visibleByDefault) => {
    // Product rule from the spec: eligible up to 60 min, shown by default up to 90 min. The cited
    // evidence [grgic2021] is mostly for hard efforts of 30 s to 12 min (see the limitedEvidence test).
    for (const enabled of [true, false]) {
      const plan = planBicarbonate({ enabled, massKg: 70, durationMin });
      expect(plan.eligible).toBe(eligible);
      expect(plan.visibleByDefault).toBe(visibleByDefault);
    }
  });
});

describe('planBicarbonate: dose', () => {
  it('0.3 g/kg for 70 kg is 21 g with 5.75 g sodium', () => {
    // [grgic2021] 0.2–0.3 g/kg; sodium is 27.37 % of NaHCO₃ by mass
    const plan = planBicarbonate({ enabled: true, massKg: 70, gPerKg: 0.3, durationMin: 45 });
    expect(plan.enabled).toBe(true);
    expect(plan.doseG).toBeCloseTo(21, 10);
    expect(plan.sodiumMg).toBeCloseTo(5747.7, 6);
  });

  it('defaults to 0.3 g/kg', () => {
    expect(planBicarbonate({ enabled: true, massKg: 70, durationMin: 45 }).doseG).toBeCloseTo(21, 10);
  });

  it('0.2 g/kg for 70 kg is 14 g', () => {
    // [deoliveira2022] lower doses also buffer, with fewer GI side effects
    const plan = planBicarbonate({ enabled: true, massKg: 70, gPerKg: 0.2, durationMin: 45 });
    expect(plan.doseG).toBeCloseTo(14, 10);
    expect(plan.sodiumMg).toBeCloseTo(3831.8, 6);
  });

  it('clamps gPerKg to 0.2–0.3', () => {
    expect(planBicarbonate({ enabled: true, massKg: 70, gPerKg: 0.5, durationMin: 45 }).doseG).toBeCloseTo(21, 10);
    expect(planBicarbonate({ enabled: true, massKg: 70, gPerKg: 0.1, durationMin: 45 }).doseG).toBeCloseTo(14, 10);
    expect(planBicarbonate({ enabled: true, massKg: 70, gPerKg: -1, durationMin: 45 }).doseG).toBeCloseTo(14, 10);
  });

  it('clamps massKg to 30–200', () => {
    expect(planBicarbonate({ enabled: true, massKg: 10, durationMin: 45 }).doseG).toBeCloseTo(9, 10);
    expect(planBicarbonate({ enabled: true, massKg: 1000, durationMin: 45 }).doseG).toBeCloseTo(60, 10);
  });

  it('falls back to defaults for non-finite numbers', () => {
    const plan = planBicarbonate({ enabled: true, massKg: Number.NaN, gPerKg: Infinity, durationMin: Number.NaN });
    expect(plan.doseG).toBeCloseTo(21, 10); // 70 kg × 0.3 g/kg
    expect(plan.eligible).toBe(true); // duration treated as 0
  });

  it('treats negative, -Infinity, null or non-number duration as 0', () => {
    for (const durationMin of [-30, -Infinity, null, '120']) {
      const plan = planBicarbonate({ enabled: true, massKg: 70, durationMin });
      expect(plan.eligible).toBe(true);
      expect(ids(plan)).not.toContain('bicarb.longEvent');
    }
  });

  it('treats an infinite duration like any huge one: not eligible, long-event warning', () => {
    for (const enabled of [true, false]) {
      const huge = planBicarbonate({ enabled, massKg: 70, durationMin: 1e9 });
      const infinite = planBicarbonate({ enabled, massKg: 70, durationMin: Infinity });
      expect(infinite).toEqual(huge);
      expect(infinite).toMatchObject({ eligible: false, visibleByDefault: false });
      expect(infinite.why.summary.key).toBe('bicarb.why.long');
    }
    expect(ids(planBicarbonate({ enabled: true, massKg: 70, durationMin: Infinity }))).toContain('bicarb.longEvent');
  });

  it('times the dose 60–180 min before the start, 90 min recommended', () => {
    // [grgic2021] ingest 60–180 min before exercise
    for (const enabled of [true, false]) {
      expect(planBicarbonate({ enabled, massKg: 70, durationMin: 45 }).timingMin).toEqual({
        earliest: -180,
        latest: -60,
        recommended: -90,
      });
    }
  });
});

describe('planBicarbonate: disabled', () => {
  it('returns zero dose and no warnings but still computes eligibility', () => {
    const plan = planBicarbonate({ enabled: false, massKg: 70, durationMin: 120 });
    expect(plan).toMatchObject({
      enabled: false,
      eligible: false,
      visibleByDefault: false,
      doseG: 0,
      sodiumMg: 0,
      warnings: [],
    });
    expect(plan.why.summary.key).toBe('bicarb.why.long');
  });

  it('treats missing input as disabled', () => {
    const plan = planBicarbonate();
    expect(plan.enabled).toBe(false);
    expect(plan.doseG).toBe(0);
    expect(plan.eligible).toBe(true);
  });
});

describe('planBicarbonate: warnings', () => {
  it('up to 60 min: GI, sodium load, medical and not-in-race', () => {
    const plan = planBicarbonate({ enabled: true, massKg: 70, durationMin: 60 });
    expect(plan.warnings.map((w) => [w.id, w.level])).toEqual([
      ['bicarb.gi', 'warning'],
      ['bicarb.sodiumLoad', 'info'],
      ['bicarb.medical', 'warning'],
      ['bicarb.notInRace', 'info'],
    ]);
    const load = plan.warnings.find((w) => w.id === 'bicarb.sodiumLoad');
    expect(load.message).toEqual({ key: 'bicarb.warn.sodiumLoad', params: { sodiumG: 5.7 } });
  });

  it('60–90 min: adds limited-evidence info', () => {
    // [grgic2021] [deoliveira2022] most evidence is for efforts of 30 s to 12 min
    const plan = planBicarbonate({ enabled: true, massKg: 70, durationMin: 75 });
    expect(plan.warnings.at(-1)).toMatchObject({ id: 'bicarb.limitedEvidence', level: 'info' });
    expect(ids(plan)).not.toContain('bicarb.longEvent');
  });

  it('above 90 min: adds a long-event warning', () => {
    // [grgic2021] [deoliveira2022] no evidence for multi-hour events
    const plan = planBicarbonate({ enabled: true, massKg: 70, durationMin: 180 });
    expect(plan.warnings.at(-1)).toMatchObject({ id: 'bicarb.longEvent', level: 'warning' });
    expect(ids(plan)).not.toContain('bicarb.limitedEvidence');
  });
});

describe('planBicarbonate: properties', () => {
  it('dose stays within 0.2–0.3 g/kg and sodium is 27.37 % of it', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 30, max: 200, noNaN: true }),
        fc.double({ min: -1, max: 2, noNaN: true }),
        fc.double({ min: -100, max: 3000, noNaN: true }),
        (massKg, gPerKg, durationMin) => {
          const plan = planBicarbonate({ enabled: true, massKg, gPerKg, durationMin });
          expect(plan.doseG / massKg).toBeGreaterThanOrEqual(0.2 - 1e-12);
          expect(plan.doseG / massKg).toBeLessThanOrEqual(0.3 + 1e-12);
          expect(plan.sodiumMg).toBeCloseTo(plan.doseG * 273.7, 6);
          expect(plan.eligible).toBe(Math.max(0, durationMin) <= 60);
          expect(plan.visibleByDefault).toBe(Math.max(0, durationMin) <= 90);
        },
      ),
    );
  });
});

describe('bicarb i18n catalog', () => {
  const plans = [
    planBicarbonate({ enabled: false, durationMin: 30 }),
    planBicarbonate({ enabled: false, durationMin: 75 }),
    planBicarbonate({ enabled: false, durationMin: 180 }),
    planBicarbonate({ enabled: true, massKg: 70, durationMin: 30 }),
    planBicarbonate({ enabled: true, massKg: 70, durationMin: 75 }),
    planBicarbonate({ enabled: true, massKg: 70, durationMin: 180 }),
  ];
  const messages = plans.flatMap(messagesOf);

  it('has text for every key the module returns, with every placeholder filled', () => {
    for (const message of messages) {
      expect(bicarbCatalog, message.key).toHaveProperty([message.key]);
      for (const name of placeholders(bicarbCatalog[message.key])) {
        expect(message.params, `${message.key} {${name}}`).toHaveProperty([name]);
      }
    }
  });

  it('has no unused keys and only bicarb.* keys', () => {
    const used = new Set(messages.map((m) => m.key));
    expect(Object.keys(bicarbCatalog).sort()).toEqual([...used].sort());
    for (const key of Object.keys(bicarbCatalog)) expect(key.startsWith('bicarb.')).toBe(true);
  });

  it('uses message keys namespaced like the warning ids', () => {
    for (const w of plans.flatMap((p) => p.warnings)) {
      expect(w.message.key).toBe(w.id.replace('bicarb.', 'bicarb.warn.'));
    }
  });

  it('does not present the 60 min cutoff as evidence', () => {
    // [grgic2021] effects are mostly shown for hard efforts of 30 s to 12 min
    for (const key of ['bicarb.why.short', 'bicarb.why.medium', 'bicarb.why.long']) {
      expect(bicarbCatalog[key]).toContain('30 s to 12 min');
      expect(bicarbCatalog[key]).not.toMatch(/(improve performance|help) in (high-intensity )?events of up to about 1 h/);
    }
  });

  it('cites only known citation ids', () => {
    const cited = plans.flatMap((p) => [...p.why.citations, ...p.warnings.flatMap((w) => w.citations ?? [])]);
    for (const id of cited) expect(CITATIONS, id).toHaveProperty([id]);
  });
});
