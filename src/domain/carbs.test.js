import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  HIGH_CARB_MIN_DURATION_MIN,
  INTENSITIES,
  recommendCarbs,
  recommendRatio,
  ratioShare,
  checkRatio,
  carbIntakeWarnings,
  solveCarbSources,
  carbCalories,
} from './carbs';
import catalog from '../i18n/en/carbs';
import { glucoseSourceOptions, fructoseSourceOptions } from '../constants/constants';

const ids = (warnings) => warnings.map((w) => w.id);
const rec = (durationMin, intensity, highCarb) => recommendCarbs({ durationMin, intensity, highCarb });

describe('recommendCarbs', () => {
  it('exports the four intensities', () => {
    expect(INTENSITIES).toEqual(['easy', 'moderate', 'hard', 'race']);
  });

  // [thomas2016] [jeukendrup2014] < 45 min: no carbs needed during exercise
  it('recommends nothing under 45 min for any intensity', () => {
    for (const intensity of INTENSITIES) {
      const r = rec(30, intensity);
      expect(r.gPerHour).toBe(0);
      expect(r.band).toBe('none');
      expect(r.range).toEqual([0, 0]);
      expect(r.mouthRinse).toBe(false);
      expect(r.why.citations).toEqual(['thomas2016', 'jeukendrup2014']);
    }
  });

  // [jeukendrup2014] [carter2004] [brietzke2019] 45–75 min: mouth rinse or small amounts
  it('suggests a mouth rinse and small amounts for 45–75 min', () => {
    const moderate = rec(60, 'moderate');
    expect(moderate.gPerHour).toBe(15);
    expect(moderate.band).toBe('rinse');
    expect(moderate.range).toEqual([0, 30]);
    expect(moderate.mouthRinse).toBe(true);
    expect(moderate.why.citations).toEqual(['jeukendrup2014', 'carter2004', 'brietzke2019']);

    const easy = rec(60, 'easy');
    expect(easy.gPerHour).toBe(0);
    expect(easy.mouthRinse).toBe(true);
  });

  // [jeukendrup2014] [thomas2016] 75–120 min: 30–45 g/h
  it('recommends 30–45 g/h for 75–120 min (90 min moderate: 37.5 → 40)', () => {
    const r = rec(90, 'moderate');
    expect(r.gPerHour).toBe(40);
    expect(r.band).toBe('short');
    expect(r.range).toEqual([30, 45]);
    expect(r.mouthRinse).toBe(false);
    expect(r.why.citations).toEqual(['jeukendrup2014', 'thomas2016']);
  });

  // [jeukendrup2014] [thomas2016] [burke2011] 2–2.5 h: 45–60 g/h
  it('recommends 45–60 g/h for 120–150 min', () => {
    const moderate = rec(120, 'moderate');
    expect(moderate.gPerHour).toBe(55); // 52.5 → 55
    expect(moderate.band).toBe('medium');
    expect(moderate.range).toEqual([45, 60]);
    expect(moderate.why.citations).toEqual(['jeukendrup2014', 'thomas2016', 'burke2011']);

    expect(rec(150, 'hard').gPerHour).toBe(60);
    expect(rec(150, 'hard').band).toBe('medium');
  });

  // [jeukendrup2014] [burke2011] [smith2013] > 2.5 h: 60–90 g/h
  it('recommends 60–90 g/h above 150 min', () => {
    expect(rec(180, 'moderate').gPerHour).toBe(75);
    expect(rec(180, 'easy').gPerHour).toBe(50); // 48 → 50
    expect(rec(180, 'race').gPerHour).toBe(90);
    expect(rec(180, 'hard').gPerHour).toBe(90);
    const r = rec(180, 'moderate');
    expect(r.band).toBe('long');
    expect(r.range).toEqual([60, 90]);
    expect(r.warnings).toEqual([]);
    expect(r.why.citations).toEqual(['jeukendrup2014', 'burke2011', 'smith2013']);
  });

  // [podlogar2022] [hearris2022] [jeukendrup2017] > 2.5 h with high-carb opt-in: 90–120 g/h
  it('recommends 90–120 g/h in high-carb mode above 150 min, with a gut-training warning', () => {
    const race = rec(180, 'race', true);
    expect(race.gPerHour).toBe(120);
    expect(race.band).toBe('veryHigh');
    expect(race.range).toEqual([90, 120]);
    expect(race.why.citations).toEqual(['podlogar2022', 'hearris2022', 'jeukendrup2017']);

    const moderate = rec(180, 'moderate', true);
    expect(moderate.gPerHour).toBe(105);

    // [jeukendrup2017] [cox2010] gut training needed above 90 g/h
    const warning = moderate.warnings.find((w) => w.id === 'carbs.gutTraining');
    expect(warning).toMatchObject({
      level: 'warning',
      message: { key: 'carbs.warn.gutTraining' },
      citations: ['jeukendrup2017', 'cox2010'],
    });
  });

  // [jeukendrup2017] [cox2010] gut training is about intakes above 90 g/h, not the band
  it('gives no gut-training warning when easy intensity keeps the high-carb target at 70 g/h', () => {
    const easy = rec(180, 'easy', true);
    expect(easy.band).toBe('veryHigh');
    expect(easy.gPerHour).toBe(70); // round5(90 × 0.8 = 72)
    expect(easy.warnings).toEqual([]);
    expect(easy.why.details).toEqual([{ key: 'carbs.why.intensity.easy' }]);
    // Every other intensity in the band is above 90 g/h and keeps the warning.
    for (const intensity of ['moderate', 'hard', 'race']) {
      expect(ids(rec(180, intensity, true).warnings)).toEqual(['carbs.gutTraining']);
    }
  });

  it('exports the high-carb duration threshold the UI uses', () => {
    expect(HIGH_CARB_MIN_DURATION_MIN).toBe(150);
    expect(rec(HIGH_CARB_MIN_DURATION_MIN, 'race', true).band).toBe('medium');
    expect(rec(HIGH_CARB_MIN_DURATION_MIN + 1, 'race', true).band).toBe('veryHigh');
  });

  // [carter2004] [brietzke2019] mouth rinse for 45–75 min
  it('gives the mouth rinse protocol only in the rinse band', () => {
    expect(rec(60).mouthRinseHowTo).toEqual({
      summary: { key: 'carbs.mouthRinse.howTo' },
      citations: ['carter2004', 'brietzke2019'],
    });
    for (const d of [30, 90, 180]) expect(rec(d).mouthRinseHowTo).toBeNull();
  });

  it('ignores high-carb mode at or below 150 min and adds an info warning', () => {
    const r = rec(120, 'moderate', true);
    expect(r.gPerHour).toBe(55);
    expect(r.band).toBe('medium');
    expect(r.warnings).toEqual([
      { id: 'carbs.highCarbLongOnly', level: 'info', message: { key: 'carbs.warn.highCarbLongOnly' } },
    ]);
    expect(ids(rec(150, 'race', true).warnings)).toEqual(['carbs.highCarbLongOnly']);
    expect(ids(rec(30, 'race', true).warnings)).toEqual(['carbs.highCarbLongOnly']);
  });

  // [jeukendrup2014] lower absolute intensity → adjust down, never above the range
  it('never places the target above the range', () => {
    for (const d of [0, 50, 60, 90, 120, 150, 180, 600]) {
      for (const intensity of INTENSITIES) {
        for (const highCarb of [false, true]) {
          const r = rec(d, intensity, highCarb);
          expect(r.gPerHour).toBeLessThanOrEqual(r.range[1]);
          expect(r.gPerHour % 5).toBe(0);
        }
      }
    }
  });

  it('switches bands at the documented boundaries', () => {
    expect(rec(44.9).band).toBe('none');
    expect(rec(45).band).toBe('rinse');
    expect(rec(74.9).band).toBe('rinse');
    expect(rec(75).band).toBe('short');
    expect(rec(119.9).band).toBe('short');
    expect(rec(120).band).toBe('medium');
    expect(rec(150).band).toBe('medium');
    expect(rec(150.1).band).toBe('long');
    expect(rec(150.1, 'moderate', true).band).toBe('veryHigh');
  });

  it('treats unknown intensity as moderate', () => {
    const r = rec(180, 'sprint');
    expect(r.gPerHour).toBe(75);
    expect(r.why.details).toEqual([{ key: 'carbs.why.intensity.moderate' }]);
    expect(rec(180).gPerHour).toBe(75);
  });

  it('treats non-finite or negative duration as 0', () => {
    for (const d of [NaN, -30, Infinity, -Infinity, undefined, null, '120']) {
      const r = rec(d, 'race');
      expect(r.band).toBe('none');
      expect(r.gPerHour).toBe(0);
    }
    expect(recommendCarbs().band).toBe('none');
  });

  it('handles very long events', () => {
    expect(rec(2880, 'race').gPerHour).toBe(90);
    expect(rec(1e9, 'race', true).gPerHour).toBe(120);
  });

  it('builds the explanation from band and intensity', () => {
    const r = rec(90, 'easy');
    expect(r.gPerHour).toBe(25); // 30 * 0.8 = 24 → 25
    expect(r.why.summary).toEqual({ key: 'carbs.why.short', params: { lo: 30, hi: 45, gPerHour: 25 } });
    expect(r.why.details).toEqual([{ key: 'carbs.why.intensity.easy' }]);
  });

  it('does not share mutable state between calls', () => {
    const a = rec(180, 'moderate');
    a.range.push(1);
    a.why.citations.push('x');
    const b = rec(180, 'moderate');
    expect(b.range).toEqual([60, 90]);
    expect(b.why.citations).toEqual(['jeukendrup2014', 'burke2011', 'smith2013']);
  });
});

describe('recommendRatio', () => {
  const RATIO_CITATIONS = ['jeukendrup2014', 'rowlands2015', 'obrien2013', 'podlogar2022', 'wallis2005'];

  // [jeukendrup2014] [wallis2005] ≤ 60 g/h: glucose alone works; 2:1 recommended
  it('allows glucose alone up to 60 g/h and recommends 2:1', () => {
    for (const g of [0, 30, 60]) {
      const r = recommendRatio(g);
      expect(r.minShare).toBe(0);
      expect(r.maxShare).toBe(0.5);
      expect(r.recommendedShare).toBeCloseTo(1 / 3, 10);
      expect(r.ratio).toEqual({ glucose: 1, fructose: 0.5 });
      expect(r.why.summary.key).toBe('carbs.ratio.why.low');
      expect(r.why.citations).toEqual(RATIO_CITATIONS);
    }
  });

  // [jeukendrup2014] [rowlands2015] 60–90 g/h: at least 2:1 multiple transportable carbs
  it('requires 2:1 between 60 and 90 g/h', () => {
    for (const g of [61, 75, 90]) {
      const r = recommendRatio(g);
      expect(r.minShare).toBeCloseTo(1 / 3, 10);
      expect(r.recommendedShare).toBeCloseTo(1 / 3, 10);
      expect(r.ratio).toEqual({ glucose: 1, fructose: 0.5 });
      expect(r.why.summary.key).toBe('carbs.ratio.why.medium');
    }
  });

  // [obrien2013] [podlogar2022] > 90 g/h: share rises to 1:0.8 at 120 g/h
  it('raises the fructose share above 90 g/h to 1:0.8 at 120 g/h', () => {
    const at120 = recommendRatio(120);
    expect(at120.minShare).toBeCloseTo(0.8 / 1.8, 10);
    expect(at120.recommendedShare).toBeCloseTo(0.4444, 4);
    expect(at120.ratio).toEqual({ glucose: 1, fructose: 0.8 });
    expect(at120.why.summary).toEqual({ key: 'carbs.ratio.why.high', params: { gPerHour: 120, fructose: 0.8 } });

    const at105 = recommendRatio(105);
    expect(at105.recommendedShare).toBeCloseTo((1 / 3 + 0.8 / 1.8) / 2, 10);
    expect(at105.ratio.fructose).toBe(0.64);

    expect(recommendRatio(91).why.summary.key).toBe('carbs.ratio.why.high');
  });

  it('caps the share at the 120 g/h value', () => {
    expect(recommendRatio(200).ratio).toEqual({ glucose: 1, fructose: 0.8 });
    expect(recommendRatio(1e9).recommendedShare).toBeCloseTo(0.8 / 1.8, 10);
  });

  it('treats NaN, non-numbers or negative intake as 0', () => {
    for (const g of [NaN, -10, -Infinity, undefined, null, '120']) {
      const r = recommendRatio(g);
      expect(r.why.summary.key).toBe('carbs.ratio.why.low');
      expect(r.why.summary.params.gPerHour).toBe(0);
      expect(r.minShare).toBe(0);
    }
  });

  it('treats +Infinity as above 120 g/h, not as 0', () => {
    const r = recommendRatio(Infinity);
    expect(r.why.summary.key).toBe('carbs.ratio.why.high');
    expect(r.minShare).toBeCloseTo(0.8 / 1.8, 10);
    expect(r.ratio).toEqual({ glucose: 1, fructose: 0.8 });
  });

  it('keeps the share between minShare and maxShare', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 500, noNaN: true }), (g) => {
        const r = recommendRatio(g);
        expect(r.maxShare).toBe(0.5);
        expect(r.recommendedShare).toBeGreaterThanOrEqual(r.minShare);
        expect(r.recommendedShare).toBeLessThanOrEqual(r.maxShare);
      }),
    );
  });
});

describe('ratioShare', () => {
  it('returns the fructose share of total parts', () => {
    expect(ratioShare({ glucose: 2, fructose: 1 })).toBeCloseTo(1 / 3, 10);
    expect(ratioShare({ glucose: 1, fructose: 0.8 })).toBeCloseTo(0.8 / 1.8, 10);
    expect(ratioShare({ glucose: 0, fructose: 1 })).toBe(1);
    expect(ratioShare({ glucose: 1, fructose: 0 })).toBe(0);
  });

  it('returns 0 when both parts are 0 or invalid', () => {
    expect(ratioShare({ glucose: 0, fructose: 0 })).toBe(0);
    expect(ratioShare({ glucose: NaN, fructose: -1 })).toBe(0);
    expect(ratioShare({})).toBe(0);
    expect(ratioShare()).toBe(0);
  });
});

describe('checkRatio', () => {
  const RATIO_CITATIONS = ['jeukendrup2014', 'rowlands2015', 'obrien2013', 'podlogar2022', 'wallis2005'];

  it('flags a missing ratio as danger', () => {
    expect(checkRatio(60, { glucose: 0, fructose: 0 })).toEqual([
      { id: 'carbs.noRatio', level: 'danger', message: { key: 'carbs.warn.noRatio' }, citations: RATIO_CITATIONS },
    ]);
    expect(ids(checkRatio(60, { glucose: -1, fructose: NaN }))).toEqual(['carbs.noRatio']);
    expect(ids(checkRatio(60))).toEqual(['carbs.noRatio']);
  });

  // [jeukendrup2014] [wallis2005] glucose alone is fine at ≤ 60 g/h
  it('accepts glucose alone up to 60 g/h', () => {
    expect(checkRatio(60, { glucose: 1, fructose: 0 })).toEqual([]);
  });

  // [jeukendrup2014] [rowlands2015] above 60 g/h at least 2:1
  it('warns about too little fructose above 60 g/h', () => {
    const [w] = checkRatio(80, { glucose: 1, fructose: 0 });
    expect(w).toEqual({
      id: 'carbs.tooLittleFructose',
      level: 'warning',
      message: { key: 'carbs.warn.tooLittleFructose', params: { gPerHour: 80, minRatio: '1:0.5' } },
      citations: RATIO_CITATIONS,
    });
    expect(ids(checkRatio(80, { glucose: 1, fructose: 0.4 }))).toEqual(['carbs.tooLittleFructose']);
  });

  it('allows 0.02 of slack below the minimum share', () => {
    expect(checkRatio(80, { glucose: 1, fructose: 0.5 })).toEqual([]);
    // share 0.3103 < 0.3333 - 0.02 = 0.3133 → outside the slack
    expect(ids(checkRatio(80, { glucose: 1, fructose: 0.45 }))).toEqual(['carbs.tooLittleFructose']);
    // share 0.3182 ≥ 0.3133 → fine
    expect(checkRatio(80, { glucose: 1, fructose: 0.4667 })).toEqual([]);
  });

  // [obrien2013] [podlogar2022] 120 g/h needs about 1:0.8
  it('raises the minimum at 120 g/h', () => {
    const [w] = checkRatio(120, { glucose: 1, fructose: 0.5 });
    expect(w.id).toBe('carbs.tooLittleFructose');
    expect(w.message.params.minRatio).toBe('1:0.8');
    expect(checkRatio(120, { glucose: 1, fructose: 0.8 })).toEqual([]);
  });

  it('warns when fructose exceeds glucose beyond the slack', () => {
    expect(checkRatio(60, { glucose: 1, fructose: 1 })).toEqual([]);
    expect(checkRatio(60, { glucose: 1, fructose: 1.05 })).toEqual([]); // share 0.512
    expect(checkRatio(60, { glucose: 1, fructose: 1.2 })).toEqual([
      {
        id: 'carbs.tooMuchFructose',
        level: 'warning',
        message: { key: 'carbs.warn.tooMuchFructose' },
        citations: RATIO_CITATIONS,
      },
    ]);
    expect(ids(checkRatio(90, { glucose: 0, fructose: 1 }))).toEqual(['carbs.tooMuchFructose']);
  });

  it('handles non-finite intake', () => {
    expect(checkRatio(NaN, { glucose: 1, fructose: 0 })).toEqual([]);
    expect(ids(checkRatio(Infinity, { glucose: 1, fructose: 2 }))).toEqual(['carbs.tooMuchFructose']);
  });

  it('keeps warning about too little fructose for huge or infinite intakes', () => {
    expect(ids(checkRatio(1e9, { glucose: 1, fructose: 0 }))).toEqual(['carbs.tooLittleFructose']);
    const [w] = checkRatio(Infinity, { glucose: 1, fructose: 0 });
    expect(w.id).toBe('carbs.tooLittleFructose');
    expect(w.message.params.minRatio).toBe('1:0.8');
  });
});

describe('carbIntakeWarnings', () => {
  it('returns nothing up to 90 g/h', () => {
    expect(carbIntakeWarnings(0, { durationMin: 180 })).toEqual([]);
    expect(carbIntakeWarnings(90, { durationMin: 180 })).toEqual([]);
  });

  // [jeukendrup2017] [cox2010] above 90 g/h needs gut training
  it('warns about gut training above 90 g/h', () => {
    expect(carbIntakeWarnings(95, { durationMin: 180, highCarb: true })).toEqual([
      {
        id: 'carbs.gutTraining',
        level: 'warning',
        message: { key: 'carbs.warn.gutTraining' },
        citations: ['jeukendrup2017', 'cox2010'],
      },
    ]);
    expect(ids(carbIntakeWarnings(120, { durationMin: 60 }))).toEqual(['carbs.gutTraining']);
  });

  // [podlogar2022] [hearris2022] 120 g/h is the highest intake studied
  it('flags intakes above 120 g/h as danger', () => {
    const warnings = carbIntakeWarnings(130, { durationMin: 300, highCarb: true });
    expect(ids(warnings)).toEqual(['carbs.aboveStudied', 'carbs.gutTraining']);
    expect(warnings[0]).toEqual({
      id: 'carbs.aboveStudied',
      level: 'danger',
      message: { key: 'carbs.warn.aboveStudied', params: { gPerHour: 130 } },
      citations: ['podlogar2022', 'hearris2022'],
    });
  });

  it('returns the same gut-training warning as recommendCarbs so the plan can de-duplicate by id', () => {
    const fromBand = rec(180, 'race', true).warnings.find((w) => w.id === 'carbs.gutTraining');
    const fromIntake = carbIntakeWarnings(120, {}).find((w) => w.id === 'carbs.gutTraining');
    expect(fromIntake).toEqual(fromBand);
  });

  it('handles invalid intake without throwing', () => {
    expect(carbIntakeWarnings(NaN, {})).toEqual([]);
    expect(carbIntakeWarnings(-50, {})).toEqual([]);
    expect(carbIntakeWarnings(-Infinity)).toEqual([]);
    expect(carbIntakeWarnings('130')).toEqual([]);
    expect(carbIntakeWarnings(undefined)).toEqual([]);
    expect(ids(carbIntakeWarnings(1e9))).toEqual(['carbs.aboveStudied', 'carbs.gutTraining']);
  });

  it('keeps both warnings for an infinite intake', () => {
    expect(ids(carbIntakeWarnings(Infinity))).toEqual(['carbs.aboveStudied', 'carbs.gutTraining']);
  });

  it('never returns fewer warnings for a larger intake', () => {
    const intake = fc.oneof(
      fc.double({ min: 0, max: 1000, noNaN: true }),
      fc.constantFrom(Infinity, Number.MAX_VALUE, 90, 120),
    );
    fc.assert(
      fc.property(intake, intake, (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        const higher = new Set(ids(carbIntakeWarnings(hi)));
        for (const id of ids(carbIntakeWarnings(lo))) expect(higher.has(id)).toBe(true);
        const higherRatio = new Set(ids(checkRatio(hi, { glucose: 1, fructose: 0 })));
        for (const id of ids(checkRatio(lo, { glucose: 1, fructose: 0 }))) expect(higherRatio.has(id)).toBe(true);
      }),
    );
  });
});

describe('solveCarbSources', () => {
  const byId = (result) => Object.fromEntries(result.items.map((item) => [item.id, item]));

  it('splits maltodextrin and fructose for a 1:0.8 ratio', () => {
    const r = solveCarbSources({
      totalCarbsG: 100,
      ratio: { glucose: 1, fructose: 0.8 },
      glucoseSources: [{ id: 3, percentage: 100 }],
      fructoseSources: [{ id: 11, percentage: 100 }],
    });
    expect(r.canAchieveRatio).toBe(true);
    expect(r.items.map((i) => i.id)).toEqual([3, 11]);
    const items = byId(r);
    expect(items[3].pathway).toBe('glucose');
    expect(items[3].grams).toBeCloseTo(100 / 1.8 / 0.95, 6); // 58.48 g maltodextrin
    expect(items[3].carbsG).toBeCloseTo(100 / 1.8, 6);
    expect(items[3].glucoseG).toBeCloseTo(100 / 1.8, 6);
    expect(items[3].fructoseG).toBe(0);
    expect(items[11].pathway).toBe('fructose');
    expect(items[11].grams).toBeCloseTo(80 / 1.8, 6); // 44.44 g fructose
    expect(items[11].fructoseG).toBeCloseTo(80 / 1.8, 6);
    expect(r.totalPowderG).toBeCloseTo(100 / 1.8 / 0.95 + 80 / 1.8, 6);
    expect(r.deliveredGlucoseG).toBeCloseTo(100 / 1.8, 6);
    expect(r.deliveredFructoseG).toBeCloseTo(80 / 1.8, 6);
  });

  it('lets a mixed source cover its list target first, so pure sources get only what remains', () => {
    // Sucrose (50/50) covers 100% of the 45 g fructose target and also delivers 45 g glucose,
    // so maltodextrin is not needed.
    const r = solveCarbSources({
      totalCarbsG: 90,
      ratio: { glucose: 1, fructose: 1 },
      glucoseSources: [{ id: 3, percentage: 100 }],
      fructoseSources: [{ id: 18, percentage: 100 }],
    });
    expect(r.canAchieveRatio).toBe(true);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ id: 18, pathway: 'fructose' });
    expect(r.items[0].grams).toBeCloseTo(90, 6);
    expect(r.items[0].glucoseG).toBeCloseTo(45, 6);
    expect(r.items[0].fructoseG).toBeCloseTo(45, 6);
    expect(r.totalPowderG).toBeCloseTo(90, 6);
  });

  it('combines a mixed source with pure sources by percentage', () => {
    // 120 g at 1:0.8 → 66.67 g glucose, 53.33 g fructose.
    // Honey covers 50% of fructose (26.67 g) and brings 26.67 g glucose.
    // Fructose covers the remaining 26.67 g; maltodextrin the remaining 40 g glucose.
    const r = solveCarbSources({
      totalCarbsG: 120,
      ratio: { glucose: 1, fructose: 0.8 },
      glucoseSources: [{ id: 3, percentage: 100 }],
      fructoseSources: [{ id: 14, percentage: 50 }, { id: 11, percentage: 50 }],
    });
    expect(r.canAchieveRatio).toBe(true);
    expect(r.items.map((i) => i.id)).toEqual([3, 14, 11]);
    const items = byId(r);
    expect(items[14].grams).toBeCloseTo((120 / 1.8 * 0.8 * 0.5) / (0.5 * 0.82), 6); // 65.04 g honey
    expect(items[11].grams).toBeCloseTo(120 / 1.8 * 0.8 * 0.5, 6); // 26.67 g fructose
    expect(items[3].grams).toBeCloseTo(40 / 0.95, 6); // 42.11 g maltodextrin
    expect(r.deliveredGlucoseG).toBeCloseTo(120 / 1.8, 6);
    expect(r.deliveredFructoseG).toBeCloseTo(120 / 1.8 * 0.8, 6);
  });

  it('sizes an uneven mixed source in the fructose list by its fructose content (agave)', () => {
    // 90 g at 1:0.8 → 50 g glucose, 40 g fructose.
    // Agave (0.18 glucose / 0.82 fructose, 0.76 g carbs per g) covers 100% of the 40 g fructose
    // target and brings 40 × 0.18 / 0.82 = 8.78 g glucose. Maltodextrin covers the remaining 41.22 g.
    const r = solveCarbSources({
      totalCarbsG: 90,
      ratio: { glucose: 1, fructose: 0.8 },
      glucoseSources: [{ id: 3, percentage: 100 }],
      fructoseSources: [{ id: 13, percentage: 100 }],
    });
    expect(r.canAchieveRatio).toBe(true);
    expect(r.items.map((i) => i.id)).toEqual([3, 13]);
    const items = byId(r);
    const agaveGlucose = (40 / 0.82) * 0.18;
    expect(items[13].pathway).toBe('fructose');
    expect(items[13].grams).toBeCloseTo(40 / (0.82 * 0.76), 6); // 64.185 g agave
    expect(items[13].fructoseG).toBeCloseTo(40, 6);
    expect(items[13].glucoseG).toBeCloseTo(agaveGlucose, 6); // 8.780 g
    expect(items[3].grams).toBeCloseTo((50 - agaveGlucose) / 0.95, 6); // 43.389 g maltodextrin
    expect(r.deliveredGlucoseG).toBeCloseTo(50, 6);
    expect(r.deliveredFructoseG).toBeCloseTo(40, 6);
  });

  it('sizes every uneven mixed fructose-list source by its fructose content', () => {
    // HFCS (12) 0.45/0.55, agave (13) 0.18/0.82, apple juice concentrate (20) 0.30/0.70.
    for (const id of [12, 13, 20]) {
      const data = fructoseSourceOptions.find((o) => o.id === id);
      const r = solveCarbSources({
        totalCarbsG: 90,
        ratio: { glucose: 1, fructose: 0.8 },
        glucoseSources: [{ id: 3, percentage: 100 }],
        fructoseSources: [{ id, percentage: 100 }],
      });
      expect(r.canAchieveRatio, `source ${id}`).toBe(true);
      const item = byId(r)[id];
      expect(item.grams).toBeCloseTo(40 / (data.fructoseContent * data.carbsPerGram), 6);
      expect(item.fructoseG).toBeCloseTo(40, 6);
      expect(item.glucoseG).toBeCloseTo((40 / data.fructoseContent) * data.glucoseContent, 6);
      expect(r.deliveredGlucoseG).toBeCloseTo(50, 6);
      expect(r.deliveredFructoseG).toBeCloseTo(40, 6);
    }
  });

  it('splits pure sources in proportion to their percentages', () => {
    const r = solveCarbSources({
      totalCarbsG: 90,
      ratio: { glucose: 2, fructose: 1 },
      glucoseSources: [{ id: 3, percentage: 60 }, { id: 1, percentage: 20 }],
      fructoseSources: [{ id: 11, percentage: 100 }],
    });
    expect(r.canAchieveRatio).toBe(true);
    const items = byId(r);
    // 60 g glucose split 3:1 (percentages 60 and 20 renormalised)
    expect(items[3].carbsG).toBeCloseTo(45, 6);
    expect(items[1].carbsG).toBeCloseTo(15, 6);
    expect(items[1].grams).toBeCloseTo(15, 6);
    expect(items[11].carbsG).toBeCloseTo(30, 6);
  });

  it('is infeasible when a list has no source for the remaining need', () => {
    // Sucrose covers the 30 g fructose target but only 30 of the 60 g glucose.
    const r = solveCarbSources({
      totalCarbsG: 90,
      ratio: { glucose: 2, fructose: 1 },
      glucoseSources: [],
      fructoseSources: [{ id: 18, percentage: 100 }],
    });
    expect(r.canAchieveRatio).toBe(false);
    expect(r.items).toEqual([]);
    expect(r.totalPowderG).toBe(0);
    expect(r.deliveredGlucoseG).toBeCloseTo(30, 6);
    expect(r.deliveredFructoseG).toBeCloseTo(30, 6);
  });

  it('is infeasible when a mixed source overshoots the other pathway', () => {
    // Barley malt extract is 3% fructose, but the ratio asks for no fructose.
    const r = solveCarbSources({
      totalCarbsG: 100,
      ratio: { glucose: 1, fructose: 0 },
      glucoseSources: [{ id: 7, percentage: 100 }],
      fructoseSources: [],
    });
    expect(r.canAchieveRatio).toBe(false);
    expect(r.items).toEqual([]);
    expect(r.deliveredFructoseG).toBeCloseTo((100 / 0.97) * 0.03, 6); // 3.09 g > 1 g tolerance
  });

  it('is infeasible when all pure source percentages are 0', () => {
    const r = solveCarbSources({
      totalCarbsG: 60,
      ratio: { glucose: 1, fructose: 0.5 },
      glucoseSources: [{ id: 3, percentage: 0 }],
      fructoseSources: [{ id: 11, percentage: 100 }],
    });
    expect(r.canAchieveRatio).toBe(false);
  });

  it('is infeasible when both ratio parts are 0', () => {
    const r = solveCarbSources({
      totalCarbsG: 60,
      ratio: { glucose: 0, fructose: 0 },
      glucoseSources: [{ id: 3, percentage: 100 }],
      fructoseSources: [{ id: 11, percentage: 100 }],
    });
    expect(r.canAchieveRatio).toBe(false);
    expect(r.items).toEqual([]);
  });

  it('returns an empty feasible result for zero or invalid totals', () => {
    const empty = { items: [], totalPowderG: 0, deliveredGlucoseG: 0, deliveredFructoseG: 0, canAchieveRatio: true };
    for (const totalCarbsG of [0, -10, -Infinity, NaN, undefined, '90']) {
      expect(
        solveCarbSources({
          totalCarbsG,
          ratio: { glucose: 1, fructose: 0.8 },
          glucoseSources: [{ id: 3, percentage: 100 }],
          fructoseSources: [{ id: 11, percentage: 100 }],
        }),
      ).toEqual(empty);
    }
    expect(solveCarbSources()).toEqual(empty);
  });

  it('reports an infinite total as infeasible', () => {
    expect(
      solveCarbSources({
        totalCarbsG: Infinity,
        ratio: { glucose: 1, fructose: 0.8 },
        glucoseSources: [{ id: 3, percentage: 100 }],
        fructoseSources: [{ id: 11, percentage: 100 }],
      }),
    ).toEqual({ items: [], totalPowderG: 0, deliveredGlucoseG: 0, deliveredFructoseG: 0, canAchieveRatio: false });
  });

  it('uses a tolerance of max(0.5 g, 1% of the total)', () => {
    // No sources at all: 0.4 g missing is within the 0.5 g floor.
    expect(solveCarbSources({ totalCarbsG: 0.4, ratio: { glucose: 1, fructose: 1 } }).canAchieveRatio).toBe(true);
    expect(solveCarbSources({ totalCarbsG: 0.6, ratio: { glucose: 1, fructose: 1 } }).canAchieveRatio).toBe(false);
    // Barley malt extract (97% glucose, 3% fructose) matches a 0.97:0.03 ratio exactly.
    const exact = solveCarbSources({
      totalCarbsG: 100,
      ratio: { glucose: 0.97, fructose: 0.03 },
      glucoseSources: [{ id: 7, percentage: 100 }],
      fructoseSources: [],
    });
    expect(exact.canAchieveRatio).toBe(true);
    expect(exact.items[0].grams).toBeCloseTo(97 / (0.97 * 0.72), 6);
  });

  it('accepts an error above 0.5 g when it is within 1% of the total', () => {
    const barley = (totalCarbsG, glucose, fructose) =>
      solveCarbSources({
        totalCarbsG,
        ratio: { glucose, fructose },
        glucoseSources: [{ id: 7, percentage: 100 }],
        fructoseSources: [],
      });
    // 100 g at 0.975:0.025 → barley covers 97.5 g glucose and brings 97.5 × 0.03 / 0.97 = 3.015 g
    // fructose: 0.515 g over the 2.5 g target. Over the 0.5 g floor, within 1% (1 g).
    const within = barley(100, 0.975, 0.025);
    expect(within.deliveredFructoseG - 2.5).toBeCloseTo(0.5155, 4);
    expect(within.canAchieveRatio).toBe(true);
    expect(within.items.map((i) => i.id)).toEqual([7]);
    // 100 g at 0.98:0.02 → 3.031 g fructose against a 2 g target: 1.031 g over, beyond 1%.
    const beyond = barley(100, 0.98, 0.02);
    expect(beyond.deliveredFructoseG - 2).toBeCloseTo(1.0309, 4);
    expect(beyond.canAchieveRatio).toBe(false);
    // The 1% part scales with the total: 5.15 g over at 1000 g is within 10 g, 10.3 g is not.
    expect(barley(1000, 0.975, 0.025).canAchieveRatio).toBe(true);
    expect(barley(1000, 0.98, 0.02).canAchieveRatio).toBe(false);
  });

  it('ignores unknown ids, electrolyte ids and sources that cannot supply their list', () => {
    const base = solveCarbSources({
      totalCarbsG: 100,
      ratio: { glucose: 1, fructose: 0.8 },
      glucoseSources: [{ id: 3, percentage: 100 }],
      fructoseSources: [{ id: 11, percentage: 100 }],
    });
    const noisy = solveCarbSources({
      totalCarbsG: 100,
      ratio: { glucose: 1, fructose: 0.8 },
      glucoseSources: [
        { id: 999, percentage: 50 },
        { id: 31, percentage: 50 },
        { id: 3, percentage: 100 },
        { id: 11, percentage: 100 }, // pure fructose in the glucose list
        null,
      ],
      fructoseSources: [{ id: 11, percentage: 100 }, { id: 3, percentage: 30 }],
    });
    expect(noisy).toEqual(base);
  });

  it('treats negative or non-finite percentages and ratio parts as 0', () => {
    const r = solveCarbSources({
      totalCarbsG: 100,
      ratio: { glucose: 1, fructose: -5 },
      glucoseSources: [{ id: 3, percentage: 100 }, { id: 1, percentage: -50 }, { id: 2, percentage: NaN }],
      fructoseSources: [],
    });
    expect(r.canAchieveRatio).toBe(true);
    expect(r.items.map((i) => i.id)).toEqual([3, 1, 2]);
    expect(byId(r)[3].carbsG).toBeCloseTo(100, 6);
    expect(byId(r)[1].grams).toBe(0);
    expect(byId(r)[2].grams).toBe(0);
  });

  it('merges repeated ids into one item', () => {
    const r = solveCarbSources({
      totalCarbsG: 100,
      ratio: { glucose: 1, fructose: 0 },
      glucoseSources: [{ id: 3, percentage: 50 }, { id: 3, percentage: 50 }],
      fructoseSources: [],
    });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].grams).toBeCloseTo(100 / 0.95, 6);
  });

  it('handles very large totals', () => {
    const r = solveCarbSources({
      totalCarbsG: 1e7,
      ratio: { glucose: 1, fructose: 0.8 },
      glucoseSources: [{ id: 3, percentage: 100 }],
      fructoseSources: [{ id: 17, percentage: 40 }, { id: 11, percentage: 60 }],
    });
    expect(r.canAchieveRatio).toBe(true);
    expect(Number.isFinite(r.totalPowderG)).toBe(true);
  });

  it('does not mutate its arguments', () => {
    const input = {
      totalCarbsG: 120,
      ratio: Object.freeze({ glucose: 1, fructose: 0.8 }),
      glucoseSources: Object.freeze([Object.freeze({ id: 3, percentage: 100 })]),
      fructoseSources: Object.freeze([Object.freeze({ id: 14, percentage: 50 }), Object.freeze({ id: 11, percentage: 50 })]),
    };
    const snapshot = JSON.parse(JSON.stringify(input));
    solveCarbSources(Object.freeze(input));
    expect(JSON.parse(JSON.stringify(input))).toEqual(snapshot);
  });

  describe('property: random valid inputs', () => {
    const sourceList = (options) =>
      fc.uniqueArray(
        fc.record({ id: fc.constantFrom(...options.map((o) => o.id)), percentage: fc.integer({ min: 0, max: 200 }) }),
        { selector: (s) => s.id, maxLength: options.length },
      );

    const ratioParts = fc.record({
      glucose: fc.double({ min: 0, max: 5, noNaN: true }),
      fructose: fc.double({ min: 0, max: 5, noNaN: true }),
    });

    // Realistic totals. fc.double alone over [0, 5000] mostly yields values below 0.5 g,
    // where the 0.5 g tolerance floor makes any result feasible.
    const realisticTotal = fc.oneof(
      fc.integer({ min: 1, max: 5000 }),
      fc.double({ min: 1, max: 5000, noNaN: true }),
    );

    const targetsFor = ({ totalCarbsG: total, ratio }) => {
      const parts = ratio.glucose + ratio.fructose;
      const validParts = parts > 0 ? parts : 1;
      return {
        targetGlucose: (ratio.glucose / validParts) * total,
        targetFructose: (ratio.fructose / validParts) * total,
      };
    };

    const checkShape = (r) => {
      for (const item of r.items) {
        expect(Number.isFinite(item.grams)).toBe(true);
        expect(item.grams).toBeGreaterThanOrEqual(0);
        for (const key of ['carbsG', 'glucoseG', 'fructoseG']) {
          expect(Number.isFinite(item[key])).toBe(true);
          expect(item[key]).toBeGreaterThanOrEqual(0);
        }
        expect(Math.abs(item.glucoseG + item.fructoseG - item.carbsG)).toBeLessThan(1e-6 * Math.max(1, item.carbsG));
      }
      expect(Number.isFinite(r.totalPowderG)).toBe(true);
      expect(r.totalPowderG).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(r.deliveredGlucoseG)).toBe(true);
      expect(Number.isFinite(r.deliveredFructoseG)).toBe(true);
      if (!r.canAchieveRatio) {
        expect(r.items).toEqual([]);
        expect(r.totalPowderG).toBe(0);
      }
    };

    it('returns finite non-negative grams and meets targets within tolerance when feasible', () => {
      const input = fc.record({
        totalCarbsG: realisticTotal,
        ratio: ratioParts,
        glucoseSources: sourceList(glucoseSourceOptions),
        fructoseSources: sourceList(fructoseSourceOptions),
      });
      fc.assert(
        fc.property(input, (input) => {
          const r = solveCarbSources(input);
          checkShape(r);
          if (r.canAchieveRatio) {
            const total = input.totalCarbsG;
            const { targetGlucose, targetFructose } = targetsFor(input);
            // tiny epsilon for float error at the tolerance boundary
            const tolerance = Math.max(0.5, total * 0.01) + 1e-9 * Math.max(1, total);
            expect(Math.abs(r.deliveredGlucoseG - targetGlucose)).toBeLessThanOrEqual(tolerance);
            expect(Math.abs(r.deliveredFructoseG - targetFructose)).toBeLessThanOrEqual(tolerance);
            expect(Math.abs(r.deliveredGlucoseG + r.deliveredFructoseG - total)).toBeLessThanOrEqual(tolerance);
            const itemGlucose = r.items.reduce((acc, i) => acc + i.glucoseG, 0);
            const itemFructose = r.items.reduce((acc, i) => acc + i.fructoseG, 0);
            expect(itemGlucose).toBeCloseTo(r.deliveredGlucoseG, 6);
            expect(itemFructose).toBeCloseTo(r.deliveredFructoseG, 6);
          }
        }),
        { numRuns: 500 },
      );
    });

    it('returns well-formed results for totals below 1 g', () => {
      const input = fc.record({
        totalCarbsG: fc.double({ min: 0, max: 1, noNaN: true }),
        ratio: ratioParts,
        glucoseSources: sourceList(glucoseSourceOptions),
        fructoseSources: sourceList(fructoseSourceOptions),
      });
      fc.assert(fc.property(input, (input) => checkShape(solveCarbSources(input))), { numRuns: 200 });
    });

    it('is always feasible and exact for pure sources that cover both pathways', () => {
      // Pure glucose sources (ids 1–6 and 8) and crystalline fructose (11), each list with at least
      // one positive percentage, and a ratio with a positive sum: the solver must hit the targets.
      const pureGlucoseIds = glucoseSourceOptions.filter((o) => o.fructoseContent === 0).map((o) => o.id);
      const pureFructoseIds = fructoseSourceOptions.filter((o) => o.glucoseContent === 0).map((o) => o.id);
      expect([...pureGlucoseIds].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 8]);
      expect(pureFructoseIds).toEqual([11]);

      const pureList = (pureIds) =>
        fc
          .uniqueArray(
            fc.record({ id: fc.constantFrom(...pureIds), percentage: fc.integer({ min: 0, max: 200 }) }),
            { selector: (s) => s.id, minLength: 1, maxLength: pureIds.length },
          )
          .filter((list) => list.some((s) => s.percentage > 0));

      const input = fc.record({
        totalCarbsG: realisticTotal,
        ratio: ratioParts.filter((r) => r.glucose + r.fructose > 0),
        glucoseSources: pureList(pureGlucoseIds),
        fructoseSources: pureList(pureFructoseIds),
      });

      fc.assert(
        fc.property(input, (input) => {
          const r = solveCarbSources(input);
          checkShape(r);
          const total = input.totalCarbsG;
          const { targetGlucose, targetFructose } = targetsFor(input);
          const eps = 1e-6 * Math.max(1, total);
          expect(r.canAchieveRatio).toBe(true);
          expect(Math.abs(r.items.reduce((acc, i) => acc + i.carbsG, 0) - total)).toBeLessThanOrEqual(eps);
          expect(Math.abs(r.deliveredGlucoseG - targetGlucose)).toBeLessThanOrEqual(eps);
          expect(Math.abs(r.deliveredFructoseG - targetFructose)).toBeLessThanOrEqual(eps);
          for (const pathway of ['glucose', 'fructose']) {
            const carbs = r.items.filter((i) => i.pathway === pathway).reduce((acc, i) => acc + i.carbsG, 0);
            const target = pathway === 'glucose' ? targetGlucose : targetFructose;
            expect(Math.abs(carbs - target)).toBeLessThanOrEqual(eps);
          }
        }),
        { numRuns: 500 },
      );
    });
  });
});

describe('carbCalories', () => {
  it('uses 4 kcal per gram', () => {
    expect(carbCalories(100)).toBe(400);
    expect(carbCalories(0)).toBe(0);
    expect(carbCalories(1e6)).toBe(4e6);
  });

  it('returns 0 for negative or non-finite input', () => {
    expect(carbCalories(-5)).toBe(0);
    expect(carbCalories(NaN)).toBe(0);
    expect(carbCalories(undefined)).toBe(0);
  });
});

describe('i18n catalog (en/carbs)', () => {
  const collectMessages = () => {
    const messages = [];
    const addWarnings = (warnings) => warnings.forEach((w) => messages.push(w.message));
    const addWhy = (why) => {
      messages.push(why.summary);
      (why.details ?? []).forEach((m) => messages.push(m));
    };
    for (const d of [0, 30, 60, 90, 120, 150, 180, 600]) {
      for (const intensity of [...INTENSITIES, 'unknown']) {
        for (const highCarb of [false, true]) {
          const r = recommendCarbs({ durationMin: d, intensity, highCarb });
          addWhy(r.why);
          addWarnings(r.warnings);
          if (r.mouthRinseHowTo) messages.push(r.mouthRinseHowTo.summary);
        }
      }
    }
    for (const g of [0, 45, 60, 75, 90, 105, 120, 150]) {
      addWhy(recommendRatio(g).why);
      addWarnings(carbIntakeWarnings(g, {}));
      for (const ratio of [
        { glucose: 0, fructose: 0 },
        { glucose: 1, fructose: 0 },
        { glucose: 1, fructose: 0.5 },
        { glucose: 1, fructose: 2 },
      ]) {
        addWarnings(checkRatio(g, ratio));
      }
    }
    return messages;
  };

  it('has text for every key the module returns, with all placeholders supplied', () => {
    const messages = collectMessages();
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) {
      expect(catalog, `missing key ${message.key}`).toHaveProperty([message.key]);
      const placeholders = [...catalog[message.key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      for (const name of placeholders) {
        expect(message.params ?? {}, `${message.key} needs param ${name}`).toHaveProperty([name]);
      }
    }
  });

  it('has no unreachable keys', () => {
    const returned = new Set(collectMessages().map((m) => m.key));
    expect(Object.keys(catalog).filter((key) => !returned.has(key))).toEqual([]);
  });

  it('keeps every key in the carbs namespace and follows the copy style', () => {
    for (const [key, text] of Object.entries(catalog)) {
      expect(key.startsWith('carbs.')).toBe(true);
      expect(typeof text).toBe('string');
      expect(text).not.toMatch(/—/); // no em dash
      expect(text).not.toMatch(/\d-\d/); // ranges use an en dash
    }
  });
});
