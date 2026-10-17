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
  carbCalories,
  formatRatio,
} from './carbs';
import { solveIngredients } from './solver';
import catalog from '../i18n/en/carbs';

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
      summary: { key: 'carbs.mouthRinse.howTo', params: { rinseMl: 25 } },
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

describe('formatRatio', () => {
  it('normalises glucose to 1 and rounds fructose to 2 decimals, trimming zeros', () => {
    expect(formatRatio({ glucose: 2, fructose: 1 })).toBe('1:0.5');
    expect(formatRatio({ glucose: 1, fructose: 0.5 })).toBe('1:0.5');
    expect(formatRatio({ glucose: 1, fructose: 0.8 })).toBe('1:0.8');
    expect(formatRatio({ glucose: 1, fructose: 1 })).toBe('1:1');
    expect(formatRatio({ glucose: 0.95, fructose: 0.85 })).toBe('1:0.89');
    expect(formatRatio({ glucose: 3, fructose: 1 })).toBe('1:0.33');
    expect(formatRatio({ glucose: 1, fructose: 0 })).toBe('1:0');
    expect(formatRatio({ glucose: 1, fructose: 2 })).toBe('1:2');
  });

  it('matches the ratio of a fructose share (1/3 → 1:0.5, 0.8/1.8 → 1:0.8)', () => {
    const fromShare = (s) => formatRatio({ glucose: 1 - s, fructose: s });
    expect(fromShare(1 / 3)).toBe('1:0.5');
    expect(fromShare(0.8 / 1.8)).toBe('1:0.8');
    expect(fromShare(0.5)).toBe('1:1');
    expect(fromShare(0)).toBe('1:0');
    expect(fromShare(1)).toBe('0:1');
  });

  it('reads the same as the recommended ratio and the checkRatio minimum', () => {
    for (const g of [45, 75, 100, 120]) {
      const r = recommendRatio(g);
      expect(formatRatio(r.ratio)).toBe(`1:${r.ratio.fructose}`);
    }
    const [warning] = checkRatio(120, { glucose: 1, fructose: 0 });
    const min = recommendRatio(120).minShare;
    expect(warning.message.params.minRatio).toBe(formatRatio({ glucose: 1 - min, fructose: min }));
  });

  it('handles missing parts: no glucose → 0:1, neither → 0:0', () => {
    expect(formatRatio({ glucose: 0, fructose: 1 })).toBe('0:1');
    expect(formatRatio({ glucose: 0, fructose: 0 })).toBe('0:0');
    expect(formatRatio({})).toBe('0:0');
    expect(formatRatio(null)).toBe('0:0');
    expect(formatRatio(undefined)).toBe('0:0');
  });

  it('counts negative and non-finite parts as 0', () => {
    expect(formatRatio({ glucose: -1, fructose: 1 })).toBe('0:1');
    expect(formatRatio({ glucose: 1, fructose: -1 })).toBe('1:0');
    expect(formatRatio({ glucose: NaN, fructose: 0.5 })).toBe('0:1');
    expect(formatRatio({ glucose: Infinity, fructose: 1 })).toBe('0:1');
    expect(formatRatio({ glucose: 1, fructose: '0.5' })).toBe('1:0');
    expect(formatRatio({ glucose: Number.MIN_VALUE, fructose: 1e10 })).toBe('0:1');
  });

  it('always gives "a:b" with finite numbers (property)', () => {
    const part = fc.oneof(fc.double({ noNaN: false }), fc.constantFrom(0, -0, 1, Infinity, NaN));
    fc.assert(
      fc.property(part, part, (glucose, fructose) => {
        const text = formatRatio({ glucose, fructose });
        if (text === '0:1' || text === '0:0') return;
        expect(text.startsWith('1:')).toBe(true);
        const x = Number(text.slice(2));
        expect(Number.isFinite(x)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(Math.abs(x * 100 - Math.round(x * 100))).toBeLessThanOrEqual(1e-6 * Math.max(1, x * 100));
      }),
      { numRuns: 500 },
    );
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
    // solveIngredients (src/domain/solver.js) shares this catalog.
    addWarnings(solveIngredients({
      totalCarbsG: 90,
      targetShare: 1 / 3,
      allowedShare: [1 / 3, 0.5],
      ingredients: [{ ref: 3, weight: 1 }],
    }).warnings);
    addWarnings(solveIngredients({ totalCarbsG: 90, targetShare: 1 / 3, ingredients: [] }).warnings);
    return messages;
  };

  it('has text for every key the module returns, with all placeholders supplied', () => {
    const messages = collectMessages();
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) {
      expect(catalog, `missing key ${message.key}`).toHaveProperty([message.key]);
      const placeholders = [...catalog[message.key].matchAll(/\{(\w+)(?::\w+)*\}/g)].map((m) => m[1]);
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
