import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildRecipeItems, formatAmount } from './recipe';
import catalog from '../i18n/en/recipe';

// ---------------------------------------------------------------------------
// Literal inputs. Shapes follow the spec for solveCarbSources(...).items and
// planCaffeine(...), so these tests do not depend on those implementations.
// ---------------------------------------------------------------------------

// solveCarbSources(...).items for 150 g carbs at 1:0.8 with maltodextrin (3)
// and fructose (11) plus honey (14) as a mixed fructose-list source. The
// fructose-list items come first on purpose to test ordering.
const CARB_ITEMS = [
  { id: 11, grams: 54, carbsG: 54, glucoseG: 0, fructoseG: 54, pathway: 'fructose' },
  { id: 3, grams: 72, carbsG: 68.4, glucoseG: 68.4, fructoseG: 0, pathway: 'glucose' },
  { id: 14, grams: 33, carbsG: 27.06, glucoseG: 13.53, fructoseG: 13.53, pathway: 'fructose' },
];

// saltsForTargets(...) output: whole-activity totals.
const SALTS = [
  { id: 31, amountMg: 3750 },
  { id: 39, amountMg: 870 },
];

// planCaffeine({ enabled: true, massKg: 70, mgPerKg: 3, durationMin: 180,
//   gelTimesMin: [0, 20, ..., 160], asIngredient: true, tabletMg: 100 })
const CAFFEINE_TABLETS_180 = {
  enabled: true,
  doses: [
    { timeMin: -60, mg: 150, kind: 'pre', gelIndex: null, tablets: 1.5 },
    { timeMin: 120, mg: 50, kind: 'intra', gelIndex: 6, tablets: 0.5 },
  ],
  totalMg: 200,
  totalMgPerKg: 200 / 70,
  peakBodyLoadMgPerKg: 150 / 70,
  why: { summary: { key: 'caffeine.why.medium' }, citations: ['guest2021'] },
  warnings: [],
};

// Same plan without asIngredient: no tablets, no gel assignment.
const CAFFEINE_NO_TABLETS_180 = {
  enabled: true,
  doses: [
    { timeMin: -60, mg: 140, kind: 'pre', gelIndex: null, tablets: null },
    { timeMin: 120, mg: 70, kind: 'intra', gelIndex: null, tablets: null },
  ],
  totalMg: 210,
  totalMgPerKg: 3,
  peakBodyLoadMgPerKg: 140 / 70,
  why: { summary: { key: 'caffeine.why.medium' }, citations: ['guest2021'] },
  warnings: [],
};

// Long event with 200 mg tablets: two top-ups listed out of gel order.
const CAFFEINE_TABLETS_600 = {
  enabled: true,
  doses: [
    { timeMin: -60, mg: 200, kind: 'pre', gelIndex: null, tablets: 1 },
    { timeMin: 440, mg: 100, kind: 'intra', gelIndex: 22, tablets: 0.5 },
    { timeMin: 300, mg: 100, kind: 'intra', gelIndex: 15, tablets: 0.5 },
  ],
  totalMg: 400,
  totalMgPerKg: 400 / 70,
  peakBodyLoadMgPerKg: 4,
  why: { summary: { key: 'caffeine.why.long' }, citations: ['guest2021'] },
  warnings: [],
};

const CAFFEINE_DISABLED = {
  enabled: false,
  doses: [],
  totalMg: 0,
  totalMgPerKg: 0,
  peakBodyLoadMgPerKg: 0,
  why: { summary: { key: 'caffeine.why.disabled' }, citations: [] },
  warnings: [],
};

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

const GROUP_RANK = { 'carb:glucose': 0, 'carb:fructose': 1, salt: 2, caffeine: 3 };
const rank = (item) => GROUP_RANK[item.kind === 'carb' ? `carb:${item.pathway}` : item.kind];

describe('formatAmount', () => {
  it('shows grams as whole grams', () => {
    expect(formatAmount(53, 'g')).toBe('53 g');
    expect(formatAmount(53.4, 'g')).toBe('53 g');
    expect(formatAmount(52.5, 'g')).toBe('53 g');
    expect(formatAmount(2274.2, 'g')).toBe('2274 g');
  });

  it('shows milligrams below 1000 mg as whole mg', () => {
    expect(formatAmount(870, 'mg')).toBe('870 mg');
    expect(formatAmount(869.6, 'mg')).toBe('870 mg');
    expect(formatAmount(5, 'mg')).toBe('5 mg');
    expect(formatAmount(999.4, 'mg')).toBe('999 mg');
  });

  it('shows 1000 mg and more as grams with one decimal', () => {
    expect(formatAmount(3750, 'mg')).toBe('3.8 g');
    expect(formatAmount(3800, 'mg')).toBe('3.8 g');
    expect(formatAmount(1000, 'mg')).toBe('1.0 g');
    expect(formatAmount(1050, 'mg')).toBe('1.1 g');
    expect(formatAmount(12340, 'mg')).toBe('12.3 g');
  });

  it('switches to grams when the amount rounds to 1000 mg', () => {
    expect(formatAmount(999.6, 'mg')).toBe('1.0 g');
  });

  it('shows zero, negative and non-finite amounts as 0', () => {
    expect(formatAmount(0, 'g')).toBe('0 g');
    expect(formatAmount(0, 'mg')).toBe('0 mg');
    expect(formatAmount(-5, 'g')).toBe('0 g');
    expect(formatAmount(-5, 'mg')).toBe('0 mg');
    expect(formatAmount(NaN, 'g')).toBe('0 g');
    expect(formatAmount(Infinity, 'mg')).toBe('0 mg');
    expect(formatAmount(undefined, 'mg')).toBe('0 mg');
  });

  it('handles huge values', () => {
    expect(formatAmount(1e6, 'mg')).toBe('1000.0 g');
    expect(formatAmount(1e6, 'g')).toBe('1000000 g');
  });

  it('formats mg as whole mg or one-decimal g for any amount (property)', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e7, noNaN: true }), (mg) => {
        const text = formatAmount(mg, 'mg');
        expect(text).toMatch(/^(\d{1,3} mg|\d+\.\d g)$/);
      }),
    );
  });
});

describe('buildRecipeItems: total view', () => {
  const items = buildRecipeItems({
    carbSources: CARB_ITEMS,
    salts: SALTS,
    caffeine: CAFFEINE_TABLETS_180,
    gelCount: 9,
    view: 'total',
  });

  it('orders glucose carbs, fructose carbs, salts, then caffeine', () => {
    expect(items.map((item) => item.key)).toEqual([
      'carb:glucose:3',
      'carb:fructose:11',
      'carb:fructose:14',
      'salt:31',
      'salt:39',
      'caffeine:gel:6',
    ]);
  });

  it('builds carb items with constants labels, grams and the carb breakdown', () => {
    expect(items[0]).toEqual({
      key: 'carb:glucose:3',
      kind: 'carb',
      id: 3,
      label: 'Maltodextrin',
      pathway: 'glucose',
      amount: 72,
      unit: 'g',
      display: '72 g',
      detail: { carbsG: 68.4, glucoseG: 68.4, fructoseG: 0 },
    });
    expect(items[1]).toMatchObject({ label: 'Crystalline Fructose', pathway: 'fructose', amount: 54, display: '54 g' });
    expect(items[2]).toMatchObject({
      label: 'Honey',
      pathway: 'fructose',
      amount: 33,
      display: '33 g',
      detail: { carbsG: 27.06, glucoseG: 13.53, fructoseG: 13.53 },
    });
  });

  it('builds salt items in mg with constants labels', () => {
    expect(items[3]).toEqual({
      key: 'salt:31',
      kind: 'salt',
      id: 31,
      label: 'Sodium Chloride (Table Salt)',
      pathway: null,
      amount: 3750,
      unit: 'mg',
      display: '3.8 g',
      detail: null,
    });
    expect(items[4]).toMatchObject({ label: 'Potassium Citrate (monohydrate)', amount: 870, display: '870 mg' });
  });

  it('adds intra caffeine tablets as one item for their gel and skips the pre-race dose', () => {
    // 70 kg, 3 mg/kg, 180 min, asIngredient, 100 mg tablets: pre 150 mg (schedule only),
    // intra 50 mg (0.5 tablet) in the gel at 120 min, which is gel 7 (index 6).
    expect(items.filter((item) => item.kind === 'caffeine')).toEqual([
      {
        key: 'caffeine:gel:6',
        kind: 'caffeine',
        id: null,
        label: { key: 'recipe.caffeineTablet', params: { tablets: 0.5, tabletMg: 100, gel: 7 } },
        pathway: null,
        amount: 50,
        unit: 'mg',
        display: '50 mg',
        detail: null,
      },
    ]);
  });

  it('treats an unknown view as total', () => {
    expect(
      buildRecipeItems({ carbSources: CARB_ITEMS, salts: SALTS, caffeine: CAFFEINE_TABLETS_180, gelCount: 9, view: 'batch' }),
    ).toEqual(items);
    expect(buildRecipeItems({ carbSources: CARB_ITEMS, salts: SALTS, caffeine: CAFFEINE_TABLETS_180, gelCount: 9 })).toEqual(
      items,
    );
  });
});

describe('buildRecipeItems: per-gel view', () => {
  const items = buildRecipeItems({
    carbSources: CARB_ITEMS,
    salts: SALTS,
    caffeine: CAFFEINE_TABLETS_180,
    gelCount: 9,
    view: 'perGel',
  });

  it('divides carb amounts and the carb breakdown by the gel count', () => {
    expect(items[0].amount).toBeCloseTo(8, 10);
    expect(items[0].display).toBe('8 g');
    expect(items[0].detail.carbsG).toBeCloseTo(7.6, 10);
    expect(items[0].detail.glucoseG).toBeCloseTo(7.6, 10);
    expect(items[0].detail.fructoseG).toBe(0);
    expect(items[1].amount).toBeCloseTo(6, 10);
    expect(items[2].detail.fructoseG).toBeCloseTo(1.503333, 5);
  });

  it('divides salt amounts by the gel count', () => {
    expect(items[3].amount).toBeCloseTo(3750 / 9, 10);
    expect(items[3].display).toBe('417 mg');
    expect(items[4].display).toBe('97 mg');
  });

  it('keeps caffeine amounts because they belong to one specific gel', () => {
    const caffeine = items.find((item) => item.kind === 'caffeine');
    expect(caffeine.amount).toBe(50);
    expect(caffeine.label.params).toEqual({ tablets: 0.5, tabletMg: 100, gel: 7 });
  });

  it('keeps the same keys and order as the total view', () => {
    const total = buildRecipeItems({ carbSources: CARB_ITEMS, salts: SALTS, caffeine: CAFFEINE_TABLETS_180, gelCount: 9 });
    expect(items.map((item) => item.key)).toEqual(total.map((item) => item.key));
  });

  it('uses at least one gel', () => {
    const total = buildRecipeItems({ carbSources: CARB_ITEMS, salts: SALTS, view: 'total' });
    for (const gelCount of [0, -3, 0.5, NaN, Infinity, undefined, null, '9']) {
      expect(buildRecipeItems({ carbSources: CARB_ITEMS, salts: SALTS, gelCount, view: 'perGel' })).toEqual(total);
    }
  });
});

describe('buildRecipeItems: caffeine', () => {
  it('adds nothing when caffeine is not added to gels', () => {
    const items = buildRecipeItems({ carbSources: CARB_ITEMS, caffeine: CAFFEINE_NO_TABLETS_180, gelCount: 9 });
    expect(items.some((item) => item.kind === 'caffeine')).toBe(false);
  });

  it('adds nothing when caffeine is disabled or missing', () => {
    for (const caffeine of [CAFFEINE_DISABLED, null, undefined, {}, { enabled: true }]) {
      const items = buildRecipeItems({ carbSources: CARB_ITEMS, caffeine, gelCount: 9 });
      expect(items.some((item) => item.kind === 'caffeine')).toBe(false);
    }
  });

  it('ignores doses listed in a disabled plan', () => {
    const items = buildRecipeItems({ caffeine: { ...CAFFEINE_TABLETS_180, enabled: false }, gelCount: 9 });
    expect(items).toEqual([]);
  });

  it('lists one item per gel in gel order and derives the tablet size', () => {
    const items = buildRecipeItems({ caffeine: CAFFEINE_TABLETS_600, gelCount: 30, view: 'perGel' });
    expect(items.map((item) => item.key)).toEqual(['caffeine:gel:15', 'caffeine:gel:22']);
    expect(items.map((item) => item.label.params)).toEqual([
      { tablets: 0.5, tabletMg: 200, gel: 16 },
      { tablets: 0.5, tabletMg: 200, gel: 23 },
    ]);
    expect(items.map((item) => item.display)).toEqual(['100 mg', '100 mg']);
  });

  it('adds doses that share a gel together', () => {
    const caffeine = {
      ...CAFFEINE_TABLETS_180,
      doses: [
        { timeMin: 0, mg: 50, kind: 'intra', gelIndex: 0, tablets: 0.5 },
        { timeMin: 0, mg: 100, kind: 'intra', gelIndex: 0, tablets: 1 },
      ],
    };
    expect(buildRecipeItems({ caffeine })).toEqual([
      expect.objectContaining({
        key: 'caffeine:gel:0',
        amount: 150,
        label: { key: 'recipe.caffeineTablet', params: { tablets: 1.5, tabletMg: 100, gel: 1 } },
      }),
    ]);
  });

  it('skips intra doses without a valid gel, tablets or amount', () => {
    const caffeine = {
      enabled: true,
      doses: [
        { timeMin: 60, mg: 50, kind: 'intra', gelIndex: -1, tablets: 0.5 },
        { timeMin: 60, mg: 50, kind: 'intra', gelIndex: 1.5, tablets: 0.5 },
        { timeMin: 60, mg: 0, kind: 'intra', gelIndex: 2, tablets: 0.5 },
        { timeMin: 60, mg: 50, kind: 'intra', gelIndex: 3, tablets: 0 },
        { timeMin: 60, mg: NaN, kind: 'intra', gelIndex: 4, tablets: 0.5 },
        { timeMin: -60, mg: 50, kind: 'pre', gelIndex: 5, tablets: 0.5 },
        null,
      ],
    };
    expect(buildRecipeItems({ caffeine })).toEqual([]);
  });
});

describe('buildRecipeItems: edge cases', () => {
  it('returns an empty list for empty or missing input', () => {
    expect(buildRecipeItems()).toEqual([]);
    expect(buildRecipeItems({})).toEqual([]);
    expect(buildRecipeItems({ carbSources: [], salts: [], caffeine: CAFFEINE_DISABLED, gelCount: 9, view: 'perGel' })).toEqual(
      [],
    );
    expect(buildRecipeItems({ carbSources: null, salts: 'x', caffeine: 5 })).toEqual([]);
  });

  it('skips zero, negative and non-finite amounts', () => {
    const items = buildRecipeItems({
      carbSources: [
        { id: 3, grams: 0, carbsG: 0, glucoseG: 0, fructoseG: 0, pathway: 'glucose' },
        { id: 1, grams: -5, carbsG: -5, glucoseG: -5, fructoseG: 0, pathway: 'glucose' },
        { id: 2, grams: NaN, carbsG: NaN, glucoseG: NaN, fructoseG: 0, pathway: 'glucose' },
        { id: 11, grams: Infinity, carbsG: Infinity, glucoseG: 0, fructoseG: Infinity, pathway: 'fructose' },
        { id: 18, grams: 10, carbsG: 10, glucoseG: 5, fructoseG: 5, pathway: 'fructose' },
      ],
      salts: [
        { id: 31, amountMg: 0 },
        { id: 33, amountMg: -100 },
        { id: 39, amountMg: NaN },
        { id: 34, amountMg: 120 },
      ],
    });
    expect(items.map((item) => item.key)).toEqual(['carb:fructose:18', 'salt:34']);
  });

  it('shows small positive amounts without dropping them', () => {
    const items = buildRecipeItems({
      carbSources: [{ id: 3, grams: 0.3, carbsG: 0.285, glucoseG: 0.285, fructoseG: 0, pathway: 'glucose' }],
      salts: [{ id: 35, amountMg: 0.4 }],
    });
    expect(items.map((item) => item.display)).toEqual(['0 g', '0 mg']);
  });

  it('treats missing or invalid carb breakdown values as 0', () => {
    const [item] = buildRecipeItems({ carbSources: [{ id: 3, grams: 10, pathway: 'glucose' }] });
    expect(item.detail).toEqual({ carbsG: 0, glucoseG: 0, fructoseG: 0 });
  });

  it('skips unknown ids, ids from the wrong list and unknown pathways', () => {
    const items = buildRecipeItems({
      carbSources: [
        { id: 999, grams: 10, carbsG: 10, glucoseG: 10, fructoseG: 0, pathway: 'glucose' },
        { id: 31, grams: 10, carbsG: 10, glucoseG: 10, fructoseG: 0, pathway: 'glucose' },
        { id: 3, grams: 10, carbsG: 9.5, glucoseG: 9.5, fructoseG: 0, pathway: 'galactose' },
        { id: 3, grams: 10, carbsG: 9.5, glucoseG: 9.5, fructoseG: 0 },
        null,
      ],
      salts: [{ id: 999, amountMg: 100 }, { id: 3, amountMg: 100 }, { amountMg: 100 }, null],
    });
    expect(items).toEqual([]);
  });

  it('keeps keys unique when an id repeats', () => {
    const items = buildRecipeItems({
      carbSources: [
        { id: 3, grams: 10, carbsG: 9.5, glucoseG: 9.5, fructoseG: 0, pathway: 'glucose' },
        { id: 3, grams: 20, carbsG: 19, glucoseG: 19, fructoseG: 0, pathway: 'glucose' },
      ],
      salts: [
        { id: 31, amountMg: 100 },
        { id: 31, amountMg: 200 },
        { id: 31, amountMg: 300 },
      ],
    });
    expect(items.map((item) => item.key)).toEqual(['carb:glucose:3', 'carb:glucose:3-2', 'salt:31', 'salt:31-2', 'salt:31-3']);
  });

  it('handles huge values', () => {
    const items = buildRecipeItems({
      carbSources: [{ id: 3, grams: 1e9, carbsG: 9.5e8, glucoseG: 9.5e8, fructoseG: 0, pathway: 'glucose' }],
      salts: [{ id: 31, amountMg: 1e9 }],
      gelCount: 1e6,
      view: 'perGel',
    });
    expect(items.map((item) => item.display)).toEqual(['1000 g', '1.0 g']);
  });

  it('does not mutate its arguments', () => {
    const input = deepFreeze({
      carbSources: structuredClone(CARB_ITEMS),
      salts: structuredClone(SALTS),
      caffeine: structuredClone(CAFFEINE_TABLETS_600),
      gelCount: 9,
      view: 'perGel',
    });
    const before = structuredClone(input);
    expect(() => buildRecipeItems(input)).not.toThrow();
    expect(input).toEqual(before);
  });

  it('returns the same output for the same input', () => {
    const input = { carbSources: CARB_ITEMS, salts: SALTS, caffeine: CAFFEINE_TABLETS_180, gelCount: 9, view: 'perGel' };
    expect(buildRecipeItems(input)).toEqual(buildRecipeItems(input));
  });
});

describe('buildRecipeItems: properties', () => {
  const glucoseIds = [1, 2, 3, 4, 5, 6, 7, 8];
  const fructoseIds = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const saltIds = [31, 32, 33, 34, 35, 36, 37, 38, 39, 40];
  // Realistic amounts (no subnormal floats, which underflow to 0 when divided).
  const amount = fc.oneof(fc.double({ min: 1e-6, max: 5000, noNaN: true }), fc.constant(0));
  const carbItem = (ids, pathway) =>
    fc.record({
      id: fc.constantFrom(...ids),
      grams: amount,
      carbsG: amount,
      glucoseG: amount,
      fructoseG: amount,
      pathway: fc.constant(pathway),
    });
  const input = fc.record({
    carbSources: fc
      .tuple(fc.array(carbItem(glucoseIds, 'glucose'), { maxLength: 4 }), fc.array(carbItem(fructoseIds, 'fructose'), { maxLength: 4 }))
      .chain(([g, f]) => fc.shuffledSubarray([...g, ...f], { minLength: g.length + f.length })),
    salts: fc.array(fc.record({ id: fc.constantFrom(...saltIds), amountMg: fc.oneof(fc.double({ min: 1e-6, max: 1e5, noNaN: true }), fc.constant(0)) }), {
      maxLength: 5,
    }),
    caffeine: fc.record({
      enabled: fc.boolean(),
      doses: fc.array(
        fc.record({
          timeMin: fc.integer({ min: -60, max: 1440 }),
          kind: fc.constantFrom('pre', 'intra'),
          gelIndex: fc.option(fc.integer({ min: 0, max: 40 })),
          tablets: fc.option(fc.integer({ min: 1, max: 6 }).map((halves) => halves / 2)),
          tabletMg: fc.constantFrom(100, 200),
        }).map(({ tabletMg, ...dose }) => ({ ...dose, mg: dose.tablets === null ? 50 : dose.tablets * tabletMg })),
        { maxLength: 6 },
      ),
    }),
    gelCount: fc.integer({ min: 1, max: 100 }),
  });

  it('keeps amounts positive and finite, keys unique, display in sync and groups in order', () => {
    fc.assert(
      fc.property(input, fc.constantFrom('total', 'perGel'), (args, view) => {
        const items = buildRecipeItems({ ...args, view });
        expect(new Set(items.map((item) => item.key)).size).toBe(items.length);
        items.forEach((item, index) => {
          expect(Number.isFinite(item.amount)).toBe(true);
          expect(item.amount).toBeGreaterThan(0);
          expect(item.display).toBe(formatAmount(item.amount, item.unit));
          if (index > 0) expect(rank(item)).toBeGreaterThanOrEqual(rank(items[index - 1]));
        });
      }),
    );
  });

  it('per-gel amounts times the gel count equal the total amounts for carbs and salts', () => {
    fc.assert(
      fc.property(input, (args) => {
        const total = buildRecipeItems({ ...args, view: 'total' });
        const perGel = buildRecipeItems({ ...args, view: 'perGel' });
        expect(perGel.map((item) => item.key)).toEqual(total.map((item) => item.key));
        perGel.forEach((item, index) => {
          const factor = item.kind === 'caffeine' ? 1 : args.gelCount;
          expect(item.amount * factor).toBeCloseTo(total[index].amount, 6);
          if (item.detail) {
            expect(item.detail.carbsG * factor).toBeCloseTo(total[index].detail.carbsG, 6);
          }
        });
      }),
    );
  });
});

describe('i18n catalog (en/recipe)', () => {
  const outputs = [
    buildRecipeItems({ carbSources: CARB_ITEMS, salts: SALTS, caffeine: CAFFEINE_TABLETS_180, gelCount: 9 }),
    buildRecipeItems({ caffeine: CAFFEINE_TABLETS_600, gelCount: 30, view: 'perGel' }),
  ];
  const messages = outputs.flat().flatMap((item) => (typeof item.label === 'object' ? [item.label] : []));

  it('has text for every message key the module returns, with matching placeholders', () => {
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) {
      expect(catalog, `missing key ${message.key}`).toHaveProperty([message.key]);
      const placeholders = [...catalog[message.key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      for (const name of placeholders) {
        expect(message.params, `${message.key} lacks param ${name}`).toHaveProperty(name);
      }
    }
  });

  it('has no unused keys', () => {
    const returned = new Set(messages.map((message) => message.key));
    expect(Object.keys(catalog).filter((key) => !returned.has(key))).toEqual([]);
  });

  it('uses plain copy without em dashes', () => {
    for (const text of Object.values(catalog)) {
      expect(text).not.toMatch(/—/);
    }
  });

  it('uses source labels from constants as plain strings for carbs and salts', () => {
    for (const item of outputs.flat()) {
      if (item.kind !== 'caffeine') expect(typeof item.label).toBe('string');
    }
  });
});
