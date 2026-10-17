import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildRecipe, formatAmount } from './recipe';
import catalog from '../i18n/en/recipe';

// ---------------------------------------------------------------------------
// Literal inputs. Shapes follow the Phase 2 spec for solveIngredients(...).items,
// gelBatch(...), drinkBottles(...) and planCaffeine(...), so these tests do not
// depend on those implementations.
// ---------------------------------------------------------------------------

// solveIngredients({ totalCarbsG: 225 (180 min at 75 g/h), targetShare: 1/3, ... }).items
// with their profiles: maltodextrin (3, 0.95 g carbs/g, 5 % water) and fructose (11).
const CARBS = [
  {
    ref: 3,
    label: 'Maltodextrin',
    carbsG: 150,
    grams: 150 / 0.95,
    glucoseG: 150,
    fructoseG: 0,
    carbsPerGram: 0.95,
    osmPerG: 0.95,
    waterFraction: 0.05,
  },
  {
    ref: 11,
    label: 'Crystalline Fructose',
    carbsG: 75,
    grams: 75,
    glucoseG: 0,
    fructoseG: 75,
    carbsPerGram: 1,
    osmPerG: 5.55,
    waterFraction: 0,
  },
];

// Whole-activity salts: table salt for 1,710 mg sodium, plus a custom salt.
const SALTS = [
  { ref: 31, label: 'Sodium Chloride (Table Salt)', amountMg: 4351 },
  { ref: 's1', label: 'My electrolyte mix', amountMg: 420 },
];

// gelBatch(...) for the 225 g at 60 % (standard) plus the 9 gels it fills.
const GEL = {
  servings: 9,
  addedWaterMl: 142.1,
  totalMassG: 375,
  solidsFraction: 0.62,
  densityGPerMl: 1.29,
  volumeMl: 290.7,
  perServing: { massG: 41.67, volumeMl: 32.3, carbsG: 25 },
  osmolality: { mOsmPerKg: 3400, waterG: 150, tonicity: 'hypertonic' },
  waterToDrinkMlPerServing: 210,
  warnings: [{ id: 'concentration.gelTakeWithWater', level: 'info', message: { key: 'concentration.gelTakeWithWater' } }],
};

// drinkBottles(...) for the same carbs and salts in three 750 ml bottles, plus the bottle size.
const DRINK = {
  bottles: 3,
  bottleMl: 750,
  perBottle: {
    carbsG: 75,
    sodiumMg: 570,
    carbPctWv: 10,
    sodiumMgPerL: 760,
    osmolality: { mOsmPerKg: 420, waterG: 700, tonicity: 'hypertonic' },
  },
  warnings: [{ id: 'concentration.drinkStrong', level: 'info', message: { key: 'concentration.drinkStrong' } }],
};

// drinkBottles(...) with no fluid planned (totalFluidMl 0): no bottle, placeholder zeros and a warning.
const NO_FLUID_DRINK = {
  bottles: 0,
  bottleMl: 750,
  perBottle: {
    carbsG: 0,
    sodiumMg: 0,
    carbPctWv: 0,
    sodiumMgPerL: 0,
    osmolality: { mOsmPerKg: 0, waterG: 0, tonicity: 'hypotonic' },
    addedWaterMl: 0,
    fillMl: 0,
  },
  warnings: [{ id: 'concentration.noFluidForDrink', level: 'warning', message: { key: 'concentration.warn.noFluidForDrink' } }],
};

// drinkBottles(...) for CARBS and SALTS (as grams) with 2000 ml of fluid in 750 ml bottles:
// 3 bottles, each filled to 2000 / 3 = 666.7 ml. Added water per bottle:
// 666.67 − (0.625 × 229.771 + 7.895) / 3 = 616.17 ml (1 g of water = 1 ml).
const DRINK_2000 = {
  bottles: 3,
  bottleMl: 750,
  perBottle: {
    carbsG: 75,
    sodiumMg: 570,
    carbPctWv: 11.25,
    sodiumMgPerL: 855,
    osmolality: { mOsmPerKg: 381.8, waterG: 618.8, tonicity: 'hypertonic' },
    addedWaterMl: 616.166,
    fillMl: 2000 / 3,
  },
  warnings: [{ id: 'concentration.hypertonic', level: 'info', message: { key: 'concentration.warn.hypertonic' } }],
};

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

const keysOf = (section) => section.items.map((item) => item.key);
const itemOf = (section, key) => section.items.find((item) => item.key === key);

// ---------------------------------------------------------------------------
// formatAmount
// ---------------------------------------------------------------------------

describe('formatAmount', () => {
  it('shows grams from 10 g as whole grams', () => {
    expect(formatAmount(53, 'g')).toBe('53 g');
    expect(formatAmount(53.4, 'g')).toBe('53 g');
    expect(formatAmount(52.5, 'g')).toBe('53 g');
    expect(formatAmount(10, 'g')).toBe('10 g');
    expect(formatAmount(2274.2, 'g')).toBe('2,274 g');
  });

  it('shows grams below 10 g with one decimal', () => {
    expect(formatAmount(4.5, 'g')).toBe('4.5 g');
    expect(formatAmount(4.54, 'g')).toBe('4.5 g');
    expect(formatAmount(8.3333, 'g')).toBe('8.3 g');
    expect(formatAmount(9.94, 'g')).toBe('9.9 g');
    expect(formatAmount(1, 'g')).toBe('1.0 g');
    expect(formatAmount(0.05, 'g')).toBe('0.1 g');
  });

  it('switches to whole grams when the amount rounds to 10 g', () => {
    expect(formatAmount(9.95, 'g')).toBe('10 g');
    expect(formatAmount(9.99, 'g')).toBe('10 g');
  });

  it('shows salts from 1000 mg as grams with one decimal', () => {
    expect(formatAmount(3750, 'mg')).toBe('3.8 g');
    expect(formatAmount(3800, 'mg')).toBe('3.8 g');
    expect(formatAmount(4351, 'mg')).toBe('4.4 g');
    expect(formatAmount(1000, 'mg')).toBe('1.0 g');
    expect(formatAmount(1050, 'mg')).toBe('1.1 g');
    expect(formatAmount(12340, 'mg')).toBe('12.3 g');
  });

  it('shows salts from 100 to 999 mg as grams with two decimals', () => {
    expect(formatAmount(420, 'mg')).toBe('0.42 g');
    expect(formatAmount(417, 'mg')).toBe('0.42 g');
    expect(formatAmount(483.4, 'mg')).toBe('0.48 g');
    expect(formatAmount(100, 'mg')).toBe('0.10 g');
    expect(formatAmount(994, 'mg')).toBe('0.99 g');
  });

  it('shows salts below 100 mg as whole milligrams', () => {
    expect(formatAmount(60, 'mg')).toBe('60 mg');
    expect(formatAmount(46.67, 'mg')).toBe('47 mg');
    expect(formatAmount(5, 'mg')).toBe('5 mg');
    expect(formatAmount(99.4, 'mg')).toBe('99 mg');
  });

  it('picks the band after rounding, so no "100 mg", "1.00 g" or "10.0 g" appears', () => {
    expect(formatAmount(99.6, 'mg')).toBe('0.10 g');
    expect(formatAmount(995, 'mg')).toBe('1.0 g');
    expect(formatAmount(999.6, 'mg')).toBe('1.0 g');
  });

  it('shows millilitres as whole ml', () => {
    expect(formatAmount(180, 'ml')).toBe('180 ml');
    expect(formatAmount(142.1, 'ml')).toBe('142 ml');
    expect(formatAmount(15.79, 'ml')).toBe('16 ml');
    expect(formatAmount(2098.7, 'ml')).toBe('2,099 ml');
    // thousands separators, as every other number in the app ("2 bottles of 1,200 ml")
    expect(formatAmount(1200, 'ml')).toBe('1,200 ml');
  });

  it('shows tablets with up to two decimals and a singular for one tablet', () => {
    expect(formatAmount(1.5, 'tablet')).toBe('1.5 tablets');
    expect(formatAmount(0.5, 'tablet')).toBe('0.5 tablets');
    expect(formatAmount(2, 'tablet')).toBe('2 tablets');
    expect(formatAmount(1, 'tablet')).toBe('1 tablet');
    expect(formatAmount(0.25, 'tablet')).toBe('0.25 tablets');
    expect(formatAmount(1 / 3, 'tablet')).toBe('0.33 tablets');
  });

  it('shows zero, negative and non-finite amounts as 0', () => {
    expect(formatAmount(0, 'g')).toBe('0 g');
    expect(formatAmount(0, 'mg')).toBe('0 mg');
    expect(formatAmount(0, 'ml')).toBe('0 ml');
    expect(formatAmount(0, 'tablet')).toBe('0 tablets');
    expect(formatAmount(-5, 'g')).toBe('0 g');
    expect(formatAmount(-5, 'mg')).toBe('0 mg');
    expect(formatAmount(NaN, 'g')).toBe('0 g');
    expect(formatAmount(Infinity, 'mg')).toBe('0 mg');
    expect(formatAmount(undefined, 'ml')).toBe('0 ml');
    expect(formatAmount('12', 'g')).toBe('0 g');
  });

  it('shows a positive amount that would round to zero as below the smallest step, never as zero', () => {
    expect(formatAmount(0.04, 'g')).toBe('<0.1 g');
    expect(formatAmount(0.0499, 'g')).toBe('<0.1 g');
    expect(formatAmount(1e-9, 'g')).toBe('<0.1 g');
    expect(formatAmount(0.05, 'g')).toBe('0.1 g');
    expect(formatAmount(0.4, 'mg')).toBe('<1 mg');
    expect(formatAmount(0.5, 'mg')).toBe('1 mg');
    expect(formatAmount(0.4, 'ml')).toBe('<1 ml');
    expect(formatAmount(0.5, 'ml')).toBe('1 ml');
    expect(formatAmount(0.004, 'tablet')).toBe('<0.01 tablets');
    expect(formatAmount(0.005, 'tablet')).toBe('0.01 tablets');
    expect(formatAmount(0.4, 'kcal')).toBe('<1 kcal');
    expect(formatAmount(0.4)).toBe('<1');
    // Zero itself stays a plain zero.
    expect(formatAmount(0, 'g')).toBe('0 g');
    expect(formatAmount(0, 'mg')).toBe('0 mg');
  });

  it('shows other units as a whole number', () => {
    expect(formatAmount(12.6, 'kcal')).toBe('13 kcal');
    expect(formatAmount(12.4)).toBe('12');
    expect(formatAmount(3, 'toString')).toBe('3 toString');
  });

  it('handles huge values', () => {
    expect(formatAmount(1e6, 'mg')).toBe('1,000.0 g');
    expect(formatAmount(1e6, 'g')).toBe('1,000,000 g');
    expect(formatAmount(1e6, 'ml')).toBe('1,000,000 ml');
  });

  it('matches its band and stays within rounding of the amount for grams (property)', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e6, noNaN: true }), (g) => {
        const text = formatAmount(g, 'g');
        expect(text).toMatch(/^(\d{1,3}(,\d{3})* g|\d\.\d g|<0\.1 g)$/);
        expect(text === '0 g').toBe(g === 0);
        expect(text).not.toBe('0.0 g');
        if (text === '<0.1 g') {
          expect(g).toBeGreaterThan(0);
          expect(g).toBeLessThan(0.05 + 1e-12);
          return;
        }
        const shown = Number.parseFloat(text.replaceAll(',', ''));
        expect(Math.abs(shown - g)).toBeLessThanOrEqual(text.includes('.') ? 0.05 + 1e-9 : 0.5 + 1e-9);
      }),
    );
  });

  it('matches its band and stays within rounding of the amount for milligrams (property)', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e7, noNaN: true }), (mg) => {
        const text = formatAmount(mg, 'mg');
        expect(text).toMatch(/^(\d{1,2} mg|<1 mg|0\.\d\d g|\d{1,3}(,\d{3})*\.\d g)$/);
        expect(text === '0 mg').toBe(mg === 0);
        if (text === '<1 mg') {
          expect(mg).toBeGreaterThan(0);
          expect(mg).toBeLessThan(0.5 + 1e-12);
          return;
        }
        const number = Number.parseFloat(text.replaceAll(',', ''));
        const shownMg = text.endsWith(' mg') ? number : number * 1000;
        const tolerance = text.endsWith(' mg') ? 0.5 : /\.\d\d /.test(text) ? 5 : 50;
        expect(Math.abs(shownMg - mg)).toBeLessThanOrEqual(tolerance + 1e-6);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// buildRecipe
// ---------------------------------------------------------------------------

describe('buildRecipe: gel', () => {
  const recipe = buildRecipe({
    type: 'gel',
    carbItems: CARBS,
    saltItems: SALTS,
    caffeine: CAFFEINE_TABLETS_180,
    gel: GEL,
    drink: DRINK,
    view: 'total',
    drinkCarbShare: 0.4,
  });
  const [gel] = recipe.sections;

  it('has one gel section and keeps the view', () => {
    expect(recipe.sections.map((section) => section.kind)).toEqual(['gel']);
    expect(recipe.view).toBe('total');
    expect(gel.servings).toBe(9);
    expect(gel.servingLabelKey).toBe('recipe.serving.gel');
  });

  it('lists carbs, salts, water, then caffeine', () => {
    expect(keysOf(gel)).toEqual(['carb:3', 'carb:11', 'salt:31', 'salt:s1', 'water', 'caffeine:gel:6']);
  });

  it('builds carb lines with the whole batch, the amount per gel and the carb breakdown', () => {
    // 150 g carbs from maltodextrin at 0.95 g/g = 157.9 g; per gel 17.5 g.
    expect(gel.items[0]).toEqual({
      key: 'carb:3',
      kind: 'carb',
      ref: 3,
      label: 'Maltodextrin',
      amount: 150 / 0.95,
      unit: 'g',
      display: '158 g',
      perServing: 150 / 0.95 / 9,
      perServingDisplay: '18 g',
      detail: {
        carbsG: 150,
        glucoseG: 150,
        fructoseG: 0,
        perServing: { carbsG: 150 / 9, glucoseG: 150 / 9, fructoseG: 0 },
      },
    });
    // 75 g fructose; per gel 8.33 g shows one decimal.
    expect(gel.items[1]).toMatchObject({
      ref: 11,
      label: 'Crystalline Fructose',
      amount: 75,
      display: '75 g',
      perServingDisplay: '8.3 g',
    });
    expect(gel.items[1].perServing).toBeCloseTo(8.3333, 4);
  });

  it('builds salt lines in mg, including custom salts', () => {
    expect(gel.items[2]).toEqual({
      key: 'salt:31',
      kind: 'salt',
      ref: 31,
      label: 'Sodium Chloride (Table Salt)',
      amount: 4351,
      unit: 'mg',
      display: '4.4 g',
      perServing: 4351 / 9,
      perServingDisplay: '0.48 g',
      detail: null,
    });
    expect(gel.items[3]).toMatchObject({
      ref: 's1',
      label: 'My electrolyte mix',
      amount: 420,
      display: '0.42 g',
      perServingDisplay: '47 mg',
    });
  });

  it('adds the batch water as a line', () => {
    expect(itemOf(gel, 'water')).toEqual({
      key: 'water',
      kind: 'water',
      ref: null,
      label: { key: 'recipe.water.gel' },
      amount: 142.1,
      unit: 'ml',
      display: '142 ml',
      perServing: 142.1 / 9,
      perServingDisplay: '16 ml',
      detail: null,
    });
    expect(gel.water).toEqual({ totalMl: 142.1, perServingMl: 142.1 / 9 });
  });

  it('adds intra caffeine tablets for their gel and skips the pre-race dose', () => {
    // 70 kg, 3 mg/kg, 180 min, 100 mg tablets: pre 150 mg (schedule only),
    // intra 50 mg (0.5 tablet) in the gel at 120 min, which is gel 7 (index 6).
    expect(gel.items.filter((item) => item.kind === 'caffeine')).toEqual([
      {
        key: 'caffeine:gel:6',
        kind: 'caffeine',
        ref: null,
        label: { key: 'recipe.caffeineForGel', params: { gel: 7, tabletMg: 100 } },
        amount: 0.5,
        unit: 'tablet',
        display: '0.5 tablets',
        perServing: 0.5,
        perServingDisplay: '0.5 tablets',
        detail: { mg: 50, tabletMg: 100 },
      },
    ]);
  });

  it('reports per-gel carbs from the lines and mass, volume and water from the batch', () => {
    expect(gel.perServing.carbsG).toBeCloseTo(25, 10);
    expect(gel.perServing).toMatchObject({ massG: 41.67, volumeMl: 32.3, waterToDrinkMl: 210 });
  });

  it('passes the osmolality and warnings through as copies', () => {
    expect(gel.osmolality).toEqual(GEL.osmolality);
    expect(gel.osmolality).not.toBe(GEL.osmolality);
    expect(gel.warnings).toEqual(GEL.warnings);
    expect(gel.warnings).not.toBe(GEL.warnings);
  });

  it('treats an unknown or missing type as gel', () => {
    const args = { carbItems: CARBS, saltItems: SALTS, caffeine: CAFFEINE_TABLETS_180, gel: GEL, drink: DRINK };
    expect(buildRecipe({ ...args, type: 'bar' })).toEqual(buildRecipe({ ...args, type: 'gel' }));
    expect(buildRecipe({ ...args, type: 'toString' })).toEqual(buildRecipe({ ...args, type: 'gel' }));
    expect(buildRecipe(args)).toEqual(buildRecipe({ ...args, type: 'gel' }));
  });

  it('leaves out the water line when syrups already bring enough water', () => {
    const { sections } = buildRecipe({
      type: 'gel',
      carbItems: CARBS,
      gel: { ...GEL, addedWaterMl: 0, warnings: [{ id: 'concentration.syrupsThinner', level: 'info', message: { key: 'concentration.syrupsThinner' } }] },
    });
    expect(keysOf(sections[0])).toEqual(['carb:3', 'carb:11']);
    expect(sections[0].water).toEqual({ totalMl: 0, perServingMl: 0 });
    expect(sections[0].warnings.map((warning) => warning.id)).toEqual(['concentration.syrupsThinner']);
  });
});

describe('buildRecipe: drink', () => {
  const recipe = buildRecipe({
    type: 'drink',
    carbItems: CARBS,
    saltItems: SALTS,
    caffeine: CAFFEINE_TABLETS_180,
    gel: GEL,
    drink: DRINK,
    view: 'perServing',
  });
  const [drink] = recipe.sections;

  it('has one drink section with all carbs and salts and no caffeine', () => {
    expect(recipe.sections.map((section) => section.kind)).toEqual(['drink']);
    expect(recipe.view).toBe('perServing');
    expect(drink.servings).toBe(3);
    expect(drink.servingLabelKey).toBe('recipe.serving.bottle');
    expect(keysOf(drink)).toEqual(['carb:3', 'carb:11', 'salt:31', 'salt:s1', 'water']);
  });

  it('divides by the bottle count', () => {
    expect(drink.items.map((item) => [item.display, item.perServingDisplay])).toEqual([
      ['158 g', '53 g'],
      ['75 g', '25 g'],
      ['4.4 g', '1.5 g'],
      ['0.42 g', '0.14 g'],
      ['2,098 ml', '699 ml'],
    ]);
    expect(drink.perServing.carbsG).toBeCloseTo(75, 10);
  });

  it('fills each bottle to the mark: bottle − 0.625 × dry solids − ingredient water (no addedWaterMl given)', () => {
    // Per bottle: dry solids (157.89 × 0.95 + 75 + 4.351 + 0.42) / 3 = 76.59 g;
    // maltodextrin water 157.89 × 0.05 / 3 = 2.632 g (= ml, as in drinkBottles).
    // 750 − 0.625 × 76.59 − 2.632 = 699.50 ml.
    const drySolids = (150 + 75 + 4.351 + 0.42) / 3;
    const ingredientWaterMl = (150 / 0.95) * 0.05 / 3;
    const expected = 750 - 0.625 * drySolids - ingredientWaterMl;
    expect(expected).toBeCloseTo(699.50, 2);
    expect(drink.water.perServingMl).toBeCloseTo(expected, 10);
    expect(drink.water.totalMl).toBeCloseTo(3 * expected, 10);
    expect(itemOf(drink, 'water')).toMatchObject({
      kind: 'water',
      ref: null,
      label: { key: 'recipe.water.drink', params: { ml: 750 } },
      unit: 'ml',
      detail: null,
    });
  });

  it('reports the bottle size and the per-bottle values of the drink', () => {
    expect(drink.perServing).toMatchObject({ sodiumMg: 570, volumeMl: 750, carbPctWv: 10, sodiumMgPerL: 760 });
    expect(drink.osmolality).toEqual({ mOsmPerKg: 420, waterG: 700, tonicity: 'hypertonic' });
    expect(drink.warnings.map((warning) => warning.id)).toEqual(['concentration.drinkStrong']);
  });

  it('counts carbs without a water fraction as dry', () => {
    const [section] = buildRecipe({
      type: 'drink',
      carbItems: [{ ref: 18, label: 'Sucrose (Cane Sugar)', carbsG: 60, grams: 60, glucoseG: 30, fructoseG: 30 }],
      drink: { bottles: 1, bottleMl: 1000 },
    }).sections;
    // 60 g sucrose made up to 1 L: 1000 − 0.625 × 60 = 962.5 ml (Vist & Maughan 1995 style solution).
    expect(section.water.perServingMl).toBeCloseTo(962.5, 10);
    expect(itemOf(section, 'water').display).toBe('963 ml');
  });

  it('has no bottle, no water and no bottle values when no fluid is planned', () => {
    const [section] = buildRecipe({ type: 'drink', carbItems: CARBS, saltItems: SALTS, drink: NO_FLUID_DRINK }).sections;
    expect(section.servings).toBe(0);
    // The lines still show what the drink would hold, next to the warning.
    expect(keysOf(section)).toEqual(['carb:3', 'carb:11', 'salt:31', 'salt:s1']);
    for (const item of section.items) expect(item.perServing).toBe(item.amount);
    expect(section.water).toEqual({ totalMl: 0, perServingMl: 0 });
    // The placeholder zeros (0 %, 0 mOsm/kg "hypotonic") do not describe 225 g of carbs, so none is shown.
    expect(section.perServing).toEqual({ carbsG: 225, sodiumMg: null, volumeMl: null, carbPctWv: null, sodiumMgPerL: null });
    expect(section.osmolality).toBeNull();
    expect(section.warnings.map((warning) => warning.id)).toEqual(['concentration.noFluidForDrink']);
  });

  it('ignores per-bottle values that come with 0 bottles', () => {
    const [section] = buildRecipe({ type: 'drink', carbItems: CARBS, saltItems: SALTS, drink: { ...DRINK, bottles: 0 } }).sections;
    expect(section.osmolality).toBeNull();
    expect(section.perServing).toEqual({ carbsG: 225, sodiumMg: null, volumeMl: null, carbPctWv: null, sodiumMgPerL: null });
    expect(section.water).toEqual({ totalMl: 0, perServingMl: 0 });
    expect(keysOf(section)).not.toContain('water');
  });

  it('uses the water and the fill mark of the concentration input, so the lines match its osmolality', () => {
    const [section] = buildRecipe({ type: 'drink', carbItems: CARBS, saltItems: SALTS, drink: DRINK_2000 }).sections;
    expect(section.servings).toBe(3);
    expect(section.water.perServingMl).toBe(616.166);
    expect(section.water.totalMl).toBeCloseTo(3 * 616.166, 10);
    expect(itemOf(section, 'water')).toMatchObject({
      label: { key: 'recipe.water.drink', params: { ml: 667 } },
      display: '1,848 ml',
      perServingDisplay: '616 ml',
    });
    expect(section.perServing).toEqual({ carbsG: 75, sodiumMg: 570, volumeMl: 2000 / 3, carbPctWv: 11.25, sodiumMgPerL: 855 });
    expect(section.osmolality).toEqual(DRINK_2000.perBottle.osmolality);
  });

  it('falls back to the formula when the given water is missing, invalid or larger than the fill', () => {
    // Fill 2000 / 3 ml: 666.67 − (0.625 × 229.771 + 7.895) / 3 = 616.17 ml.
    const expected = 2000 / 3 - (0.625 * (150 + 75 + 4.351 + 0.42) + (150 / 0.95) * 0.05) / 3;
    expect(expected).toBeCloseTo(616.166, 3);
    for (const addedWaterMl of [undefined, null, NaN, -1, Infinity, 700, '616']) {
      const drink = { ...DRINK_2000, perBottle: { ...DRINK_2000.perBottle, addedWaterMl } };
      const [section] = buildRecipe({ type: 'drink', carbItems: CARBS, saltItems: SALTS, drink }).sections;
      expect(section.water.perServingMl).toBeCloseTo(expected, 10);
    }
  });

  it('fills to the bottle size when the fill mark is missing, not above 0 or above the bottle size', () => {
    for (const fillMl of [undefined, 0, -5, NaN, 800]) {
      const drink = { ...DRINK_2000, perBottle: { ...DRINK_2000.perBottle, addedWaterMl: undefined, fillMl } };
      const [section] = buildRecipe({ type: 'drink', carbItems: CARBS, saltItems: SALTS, drink }).sections;
      expect(section.perServing.volumeMl).toBe(750);
      expect(section.water.perServingMl).toBeCloseTo(750 - (0.625 * 229.771 + (150 / 0.95) * 0.05) / 3, 10);
      expect(itemOf(section, 'water').label.params.ml).toBe(750);
    }
  });

  it('never adds negative water when the solids fill the bottle', () => {
    const [section] = buildRecipe({
      type: 'drink',
      carbItems: [{ ref: 11, label: 'Crystalline Fructose', carbsG: 2000, grams: 2000, glucoseG: 0, fructoseG: 2000 }],
      drink: { bottles: 1, bottleMl: 500 },
    }).sections;
    expect(section.water).toEqual({ totalMl: 0, perServingMl: 0 });
    expect(keysOf(section)).toEqual(['carb:11']);
  });

  it('has no water line and no volume without a bottle size', () => {
    const [section] = buildRecipe({ type: 'drink', carbItems: CARBS, drink: { ...DRINK, bottleMl: undefined } }).sections;
    expect(keysOf(section)).toEqual(['carb:3', 'carb:11']);
    expect(section.water).toEqual({ totalMl: 0, perServingMl: 0 });
    expect(section.perServing.volumeMl).toBeNull();
  });
});

describe('buildRecipe: both', () => {
  const recipe = buildRecipe({
    type: 'both',
    carbItems: CARBS,
    saltItems: SALTS,
    caffeine: CAFFEINE_TABLETS_180,
    gel: { ...GEL, addedWaterMl: 85.3 },
    drink: DRINK,
    view: 'perGel',
    drinkCarbShare: 0.4,
  });
  const [gel, drink] = recipe.sections;

  it('has a gel section then a drink section, and reads the v3 perGel view as perServing', () => {
    expect(recipe.sections.map((section) => section.kind)).toEqual(['gel', 'drink']);
    expect(recipe.view).toBe('perServing');
  });

  it('puts (1 − drink share) of each carb in the gels and the caffeine, but no salts', () => {
    expect(keysOf(gel)).toEqual(['carb:3', 'carb:11', 'water', 'caffeine:gel:6']);
    expect(itemOf(gel, 'carb:3').amount).toBeCloseTo((150 / 0.95) * 0.6, 10);
    expect(itemOf(gel, 'carb:3').detail.carbsG).toBeCloseTo(90, 10);
    expect(itemOf(gel, 'carb:11').amount).toBeCloseTo(45, 10);
    expect(itemOf(gel, 'carb:11').detail.fructoseG).toBeCloseTo(45, 10);
    expect(gel.perServing.carbsG).toBeCloseTo(135 / 9, 10);
    expect(itemOf(gel, 'water').amount).toBe(85.3);
  });

  it('puts the rest of the carbs and all salts in the drink', () => {
    expect(keysOf(drink)).toEqual(['carb:3', 'carb:11', 'salt:31', 'salt:s1', 'water']);
    expect(itemOf(drink, 'carb:3').amount).toBeCloseTo((150 / 0.95) * 0.4, 10);
    expect(itemOf(drink, 'carb:11').amount).toBeCloseTo(30, 10);
    expect(itemOf(drink, 'salt:31').amount).toBe(4351);
    expect(drink.perServing.carbsG).toBeCloseTo(90 / 3, 10);
  });

  it('fills the drink bottles for the drink part of the carbs only (no addedWaterMl given)', () => {
    // Per bottle: dry solids ((150 + 75) × 0.4 + 4.351 + 0.42) / 3 = 31.59 g; maltodextrin water
    // 157.89 × 0.05 × 0.4 / 3 = 1.053 g. 750 − 0.625 × 31.59 − 1.053 = 729.20 ml.
    const expected = 750 - 0.625 * (((150 + 75) * 0.4 + 4.351 + 0.42) / 3) - ((150 / 0.95) * 0.05 * 0.4) / 3;
    expect(expected).toBeCloseTo(729.2, 1);
    expect(drink.water.perServingMl).toBeCloseTo(expected, 10);
    expect(drink.water.totalMl).toBeCloseTo(3 * expected, 10);
    expect(itemOf(drink, 'water').display).toBe('2,188 ml');
  });

  it('uses the water the concentration input computed for the drink part', () => {
    const [, d] = buildRecipe({
      type: 'both',
      carbItems: CARBS,
      saltItems: SALTS,
      gel: GEL,
      drink: { ...DRINK, perBottle: { ...DRINK.perBottle, addedWaterMl: 729.2 } },
      drinkCarbShare: 0.4,
    }).sections;
    expect(d.water).toEqual({ totalMl: 3 * 729.2, perServingMl: 729.2 });
  });

  it('keeps the gels and gives the drink no bottle values when no fluid is planned', () => {
    const [g, d] = buildRecipe({
      type: 'both',
      carbItems: CARBS,
      saltItems: SALTS,
      gel: GEL,
      drink: NO_FLUID_DRINK,
      drinkCarbShare: 0.4,
    }).sections;
    expect(g.servings).toBe(9);
    expect(g.osmolality).toEqual(GEL.osmolality);
    expect(d.servings).toBe(0);
    expect(keysOf(d)).toEqual(['carb:3', 'carb:11', 'salt:31', 'salt:s1']);
    expect(d.water).toEqual({ totalMl: 0, perServingMl: 0 });
    expect(d.perServing).toEqual({ carbsG: 90, sodiumMg: null, volumeMl: null, carbPctWv: null, sodiumMgPerL: null });
    expect(d.osmolality).toBeNull();
    expect(d.warnings.map((warning) => warning.id)).toEqual(['concentration.noFluidForDrink']);
  });

  it('splits each carb ingredient without losing any', () => {
    for (const carb of CARBS) {
      const key = `carb:${carb.ref}`;
      expect(itemOf(gel, key).amount + itemOf(drink, key).amount).toBeCloseTo(carb.grams, 10);
      expect(itemOf(gel, key).detail.carbsG + itemOf(drink, key).detail.carbsG).toBeCloseTo(carb.carbsG, 10);
    }
  });

  it('leaves the gels without carbs when the drink carries all of them', () => {
    const [gelOnly, drinkAll] = buildRecipe({
      type: 'both',
      carbItems: CARBS,
      saltItems: SALTS,
      caffeine: CAFFEINE_TABLETS_180,
      gel: { ...GEL, addedWaterMl: 0 },
      drink: DRINK,
      drinkCarbShare: 1,
    }).sections;
    expect(keysOf(gelOnly)).toEqual(['caffeine:gel:6']);
    expect(gelOnly.perServing.carbsG).toBe(0);
    expect(keysOf(drinkAll)).toEqual(['carb:3', 'carb:11', 'salt:31', 'salt:s1', 'water']);
  });

  it('leaves the drink with salts and water when the gels carry all carbs', () => {
    const [gelAll, saltyWater] = buildRecipe({
      type: 'both',
      carbItems: CARBS,
      saltItems: SALTS,
      gel: GEL,
      drink: DRINK,
      drinkCarbShare: 0,
    }).sections;
    expect(keysOf(gelAll)).toEqual(['carb:3', 'carb:11', 'water']);
    expect(itemOf(gelAll, 'carb:11').amount).toBe(75);
    expect(keysOf(saltyWater)).toEqual(['salt:31', 'salt:s1', 'water']);
  });

  it('clamps the drink share to 0–1 and uses 0.5 when it is missing', () => {
    const shareOf = (drinkCarbShare) => {
      const [, d] = buildRecipe({ type: 'both', carbItems: CARBS, gel: GEL, drink: DRINK, drinkCarbShare }).sections;
      return (itemOf(d, 'carb:11')?.amount ?? 0) / 75;
    };
    expect(shareOf(0.25)).toBeCloseTo(0.25, 12);
    expect(shareOf(50)).toBe(1);
    expect(shareOf(-1)).toBe(0);
    expect(shareOf(undefined)).toBe(0.5);
    expect(shareOf(NaN)).toBe(0.5);
    expect(shareOf('0.3')).toBe(0.5);
  });

  it('ignores the drink share outside both', () => {
    const gelOnly = buildRecipe({ type: 'gel', carbItems: CARBS, gel: GEL, drinkCarbShare: 0.9 }).sections[0];
    expect(itemOf(gelOnly, 'carb:11').amount).toBe(75);
    const drinkOnly = buildRecipe({ type: 'drink', carbItems: CARBS, drink: DRINK, drinkCarbShare: 0.1 }).sections[0];
    expect(itemOf(drinkOnly, 'carb:11').amount).toBe(75);
  });
});

describe('buildRecipe: views', () => {
  it('reads perServing and perGel as perServing and anything else as total', () => {
    for (const [view, expected] of [
      ['perServing', 'perServing'],
      ['perGel', 'perServing'],
      ['total', 'total'],
      ['batch', 'total'],
      [undefined, 'total'],
      [null, 'total'],
    ]) {
      expect(buildRecipe({ carbItems: CARBS, gel: GEL, view }).view).toBe(expected);
    }
  });

  it('gives the same lines in every view (the view only picks the column)', () => {
    const args = { carbItems: CARBS, saltItems: SALTS, caffeine: CAFFEINE_TABLETS_180, gel: GEL };
    const total = buildRecipe({ ...args, view: 'total' });
    const perServing = buildRecipe({ ...args, view: 'perServing' });
    expect(perServing.sections).toEqual(total.sections);
  });
});

describe('buildRecipe: servings and caffeine', () => {
  it('divides by at least one serving and adds no caffeine without gels', () => {
    for (const servings of [0, -3, NaN, Infinity, undefined, null, '9']) {
      const [gel] = buildRecipe({ carbItems: CARBS, saltItems: SALTS, caffeine: CAFFEINE_TABLETS_180, gel: { ...GEL, servings } }).sections;
      expect(gel.servings).toBe(0);
      expect(gel.items.some((item) => item.kind === 'caffeine')).toBe(false);
      for (const item of gel.items) expect(item.perServing).toBe(item.amount);
    }
  });

  it('counts whole servings only', () => {
    const [gel] = buildRecipe({ carbItems: CARBS, gel: { ...GEL, servings: 2.7 } }).sections;
    expect(gel.servings).toBe(2);
    expect(itemOf(gel, 'carb:11').perServing).toBe(37.5);
  });

  it('works without a gel batch: no water, no batch values, all lines kept', () => {
    const [gel] = buildRecipe({ type: 'gel', carbItems: CARBS, saltItems: SALTS, caffeine: CAFFEINE_TABLETS_180 }).sections;
    expect(keysOf(gel)).toEqual(['carb:3', 'carb:11', 'salt:31', 'salt:s1']);
    expect(gel.servings).toBe(0);
    expect(gel.water).toEqual({ totalMl: 0, perServingMl: 0 });
    expect(gel.perServing).toEqual({ carbsG: 225, massG: null, volumeMl: null, waterToDrinkMl: null });
    expect(gel.osmolality).toBeNull();
    expect(gel.warnings).toEqual([]);
  });

  it('works without a drink result', () => {
    const [drink] = buildRecipe({ type: 'drink', carbItems: CARBS, drink: null }).sections;
    expect(drink.servings).toBe(0);
    expect(drink.perServing).toEqual({ carbsG: 225, sodiumMg: null, volumeMl: null, carbPctWv: null, sodiumMgPerL: null });
    expect(drink.osmolality).toBeNull();
    expect(drink.warnings).toEqual([]);
  });

  it('drops an osmolality without a finite value and warnings that are not objects', () => {
    const [gel] = buildRecipe({ carbItems: CARBS, gel: { ...GEL, osmolality: { mOsmPerKg: NaN }, warnings: [null, 'x', GEL.warnings[0]] } }).sections;
    expect(gel.osmolality).toBeNull();
    expect(gel.warnings).toEqual(GEL.warnings);
  });

  it('adds nothing when caffeine is not added to gels, disabled or missing', () => {
    for (const caffeine of [CAFFEINE_NO_TABLETS_180, CAFFEINE_DISABLED, { ...CAFFEINE_TABLETS_180, enabled: false }, null, undefined, {}, 5, { enabled: true }]) {
      const [gel] = buildRecipe({ carbItems: CARBS, caffeine, gel: GEL }).sections;
      expect(gel.items.some((item) => item.kind === 'caffeine')).toBe(false);
    }
  });

  it('lists one line per gel in gel order and derives the tablet size', () => {
    const [gel] = buildRecipe({ caffeine: CAFFEINE_TABLETS_600, gel: { servings: 30 } }).sections;
    expect(keysOf(gel)).toEqual(['caffeine:gel:15', 'caffeine:gel:22']);
    expect(gel.items.map((item) => item.label.params)).toEqual([
      { gel: 16, tabletMg: 200 },
      { gel: 23, tabletMg: 200 },
    ]);
    expect(gel.items.map((item) => item.display)).toEqual(['0.5 tablets', '0.5 tablets']);
    expect(gel.items.map((item) => item.detail)).toEqual([
      { mg: 100, tabletMg: 200 },
      { mg: 100, tabletMg: 200 },
    ]);
  });

  it('adds doses that share a gel together', () => {
    const caffeine = {
      enabled: true,
      doses: [
        { timeMin: 0, mg: 50, kind: 'intra', gelIndex: 0, tablets: 0.5 },
        { timeMin: 0, mg: 100, kind: 'intra', gelIndex: 0, tablets: 1 },
      ],
    };
    const [gel] = buildRecipe({ caffeine, gel: { servings: 3 } }).sections;
    expect(gel.items).toEqual([
      expect.objectContaining({
        key: 'caffeine:gel:0',
        amount: 1.5,
        display: '1.5 tablets',
        label: { key: 'recipe.caffeineForGel', params: { gel: 1, tabletMg: 100 } },
        detail: { mg: 150, tabletMg: 100 },
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
    expect(buildRecipe({ caffeine, gel: { servings: 9 } }).sections[0].items).toEqual([]);
  });

  it('skips doses for a gel that does not exist, like buildSchedule does', () => {
    const caffeine = {
      enabled: true,
      doses: [
        { timeMin: 240, mg: 50, kind: 'intra', gelIndex: 12, tablets: 0.5 },
        { timeMin: 180, mg: 100, kind: 'intra', gelIndex: 9, tablets: 1 },
        { timeMin: 160, mg: 50, kind: 'intra', gelIndex: 8, tablets: 0.5 },
      ],
    };
    expect(keysOf(buildRecipe({ caffeine, gel: { servings: 9 } }).sections[0])).toEqual(['caffeine:gel:8']);
  });
});

describe('buildRecipe: ingredient inputs', () => {
  it('returns an empty gel section for empty or missing input', () => {
    for (const args of [undefined, {}, { carbItems: [], saltItems: [] }, { carbItems: null, saltItems: 'x', caffeine: 5, gel: 'x', drink: 7 }]) {
      const recipe = buildRecipe(args);
      expect(recipe.view).toBe('total');
      expect(recipe.sections).toEqual([
        {
          kind: 'gel',
          servings: 0,
          servingLabelKey: 'recipe.serving.gel',
          items: [],
          water: { totalMl: 0, perServingMl: 0 },
          perServing: { carbsG: 0, massG: null, volumeMl: null, waterToDrinkMl: null },
          osmolality: null,
          warnings: [],
        },
      ]);
    }
  });

  it('falls back to the constants label for source ids and to the key for custom refs', () => {
    const [gel] = buildRecipe({
      carbItems: [
        { ref: 3, grams: 10, carbsG: 9.5, glucoseG: 9.5, fructoseG: 0 },
        { ref: 'c1', grams: 20, carbsG: 15, glucoseG: 7.5, fructoseG: 7.5 },
        { ref: 'c2', label: '  Rice cake mix ', grams: 20, carbsG: 15, glucoseG: 15, fructoseG: 0 },
      ],
      saltItems: [
        { ref: 39, amountMg: 870 },
        { ref: 's2', amountMg: 120 },
      ],
      gel: { servings: 2 },
    }).sections;
    expect(gel.items.map((item) => [item.key, item.label])).toEqual([
      ['carb:3', 'Maltodextrin'],
      ['carb:c1', 'c1'],
      ['carb:c2', 'Rice cake mix'],
      ['salt:39', 'Potassium Citrate (monohydrate)'],
      ['salt:s2', 's2'],
    ]);
  });

  it('accepts the Phase 1 id field as the ref of salts and carbs', () => {
    const [gel] = buildRecipe({
      carbItems: [{ id: 11, grams: 30, carbsG: 30, glucoseG: 0, fructoseG: 30 }],
      saltItems: [{ id: 31, amountMg: 3750 }],
    }).sections;
    expect(gel.items.map((item) => [item.key, item.ref, item.label, item.display])).toEqual([
      ['carb:11', 11, 'Crystalline Fructose', '30 g'],
      ['salt:31', 31, 'Sodium Chloride (Table Salt)', '3.8 g'],
    ]);
  });

  it('skips items that cannot be named and bad refs', () => {
    const [gel] = buildRecipe({
      carbItems: [
        { ref: 999, grams: 10, carbsG: 10 },
        { ref: 31, grams: 10, carbsG: 10 },
        { ref: '  ', grams: 10, carbsG: 10 },
        { ref: NaN, label: 'X', grams: 10, carbsG: 10 },
        { grams: 10, carbsG: 10, label: 'No ref' },
        null,
        'x',
      ],
      saltItems: [{ ref: 999, amountMg: 100 }, { ref: 3, amountMg: 100 }, { amountMg: 100 }, null, []],
    }).sections;
    expect(gel.items).toEqual([]);
  });

  it('keeps an unknown source id when the caller gives a label', () => {
    const [gel] = buildRecipe({ carbItems: [{ ref: 999, label: 'New source', grams: 10, carbsG: 9, glucoseG: 9, fructoseG: 0 }] }).sections;
    expect(gel.items.map((item) => [item.key, item.label])).toEqual([['carb:999', 'New source']]);
  });

  it('skips zero, negative, non-finite and float-noise amounts', () => {
    const [gel] = buildRecipe({
      carbItems: [
        { ref: 3, grams: 0, carbsG: 0 },
        { ref: 1, grams: -5, carbsG: -5 },
        { ref: 2, grams: NaN, carbsG: NaN },
        { ref: 11, grams: Infinity, carbsG: Infinity },
        { ref: 4, grams: 7.47939721852737e-15, carbsG: 7.105427357601001e-15 },
        { ref: 5, grams: 1e-6, carbsG: 1e-6 },
        { ref: 18, grams: 10, carbsG: 10, glucoseG: 5, fructoseG: 5 },
      ],
      saltItems: [
        { ref: 31, amountMg: 0 },
        { ref: 33, amountMg: -100 },
        { ref: 39, amountMg: NaN },
        { ref: 32, amountMg: 1e-3 },
        { ref: 34, amountMg: 120 },
      ],
    }).sections;
    expect(keysOf(gel)).toEqual(['carb:18', 'salt:34']);
  });

  it('treats missing or invalid carb breakdown values as 0', () => {
    const [gel] = buildRecipe({ carbItems: [{ ref: 3, grams: 10, carbsG: 'x' }], gel: { servings: 2 } }).sections;
    expect(gel.items[0].detail).toEqual({
      carbsG: 0,
      glucoseG: 0,
      fructoseG: 0,
      perServing: { carbsG: 0, glucoseG: 0, fructoseG: 0 },
    });
  });

  it('keeps keys unique when a ref repeats', () => {
    const [gel] = buildRecipe({
      carbItems: [
        { ref: 3, grams: 10, carbsG: 9.5 },
        { ref: 3, grams: 20, carbsG: 19 },
      ],
      saltItems: [
        { ref: 31, amountMg: 100 },
        { ref: 31, amountMg: 200 },
        { ref: 31, amountMg: 300 },
      ],
    }).sections;
    expect(keysOf(gel)).toEqual(['carb:3', 'carb:3-2', 'salt:31', 'salt:31-2', 'salt:31-3']);
  });

  it('handles huge values', () => {
    const [gel] = buildRecipe({
      carbItems: [{ ref: 3, grams: 1e9, carbsG: 9.5e8, glucoseG: 9.5e8, fructoseG: 0 }],
      saltItems: [{ ref: 31, amountMg: 1e9 }],
      gel: { servings: 1e6 },
    }).sections;
    expect(gel.items.map((item) => item.perServingDisplay)).toEqual(['1,000 g', '1.0 g']);
  });

  it('does not mutate its arguments', () => {
    const input = deepFreeze({
      type: 'both',
      carbItems: structuredClone(CARBS),
      saltItems: structuredClone(SALTS),
      caffeine: structuredClone(CAFFEINE_TABLETS_600),
      gel: structuredClone({ ...GEL, servings: 30 }),
      drink: structuredClone(DRINK),
      view: 'perServing',
      drinkCarbShare: 0.3,
    });
    const before = structuredClone(input);
    expect(() => buildRecipe(input)).not.toThrow();
    expect(input).toEqual(before);
  });

  it('returns the same output for the same input', () => {
    const input = { type: 'both', carbItems: CARBS, saltItems: SALTS, caffeine: CAFFEINE_TABLETS_180, gel: GEL, drink: DRINK, drinkCarbShare: 0.5 };
    expect(buildRecipe(input)).toEqual(buildRecipe(input));
  });
});

describe('buildRecipe: properties', () => {
  const builtInIds = [1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const saltIds = [31, 32, 33, 34, 35, 36, 37, 38, 39, 40];
  // Realistic amounts, exact zeros and solver-style float noise (≤ 1e-9), which must be skipped.
  const noise = fc.double({ min: 0, max: 1e-9, noNaN: true });
  const grams = fc.oneof(fc.double({ min: 1e-5, max: 2000, noNaN: true }), fc.constant(0), noise);
  const carbItem = fc
    .record({
      ref: fc.oneof(fc.constantFrom(...builtInIds), fc.integer({ min: 1, max: 10 }).map((n) => `c${n}`)),
      grams,
      carbsPerGram: fc.double({ min: 0.5, max: 1, noNaN: true }),
      fructoseShare: fc.double({ min: 0, max: 1, noNaN: true }),
      waterFraction: fc.double({ min: 0, max: 0.95, noNaN: true }),
    })
    .map(({ ref, grams: g, carbsPerGram, fructoseShare, waterFraction }) => ({
      ref,
      grams: g,
      carbsG: g * carbsPerGram,
      glucoseG: g * carbsPerGram * (1 - fructoseShare),
      fructoseG: g * carbsPerGram * fructoseShare,
      waterFraction,
    }));
  const saltItem = fc.record({
    ref: fc.oneof(fc.constantFrom(...saltIds), fc.integer({ min: 1, max: 10 }).map((n) => `s${n}`)),
    amountMg: fc.oneof(fc.double({ min: 1e-2, max: 1e5, noNaN: true }), fc.constant(0), noise),
  });
  const caffeine = fc.record({
    enabled: fc.boolean(),
    doses: fc.array(
      fc
        .record({
          timeMin: fc.integer({ min: -60, max: 1440 }),
          kind: fc.constantFrom('pre', 'intra'),
          gelIndex: fc.option(fc.integer({ min: 0, max: 40 })),
          tablets: fc.option(fc.integer({ min: 1, max: 6 }).map((halves) => halves / 2)),
          tabletMg: fc.constantFrom(100, 200),
        })
        .map(({ tabletMg, ...dose }) => ({ ...dose, mg: dose.tablets === null ? 50 : dose.tablets * tabletMg })),
      { maxLength: 6 },
    ),
  });
  const input = fc.record({
    type: fc.constantFrom('gel', 'drink', 'both'),
    carbItems: fc.array(carbItem, { minLength: 1, maxLength: 6 }),
    saltItems: fc.array(saltItem, { maxLength: 5 }),
    caffeine,
    gel: fc.record({ servings: fc.integer({ min: 0, max: 40 }), addedWaterMl: fc.double({ min: 0, max: 1000, noNaN: true }) }),
    drink: fc.record({ bottles: fc.integer({ min: 0, max: 8 }), bottleMl: fc.integer({ min: 250, max: 1500 }) }),
    view: fc.constantFrom('total', 'perServing', 'perGel'),
    drinkCarbShare: fc.integer({ min: 0, max: 100 }).map((pct) => pct / 100),
  });

  it('keeps amounts positive and finite, keys unique, displays in sync and per-serving amounts consistent', () => {
    fc.assert(
      fc.property(input, (args) => {
        const recipe = buildRecipe(args);
        for (const section of recipe.sections) {
          const divisor = Math.max(1, section.servings);
          expect(new Set(keysOf(section)).size).toBe(section.items.length);
          expect(section.water.totalMl).toBeGreaterThanOrEqual(0);
          expect(section.water.perServingMl).toBeGreaterThanOrEqual(0);
          for (const item of section.items) {
            expect(Number.isFinite(item.amount)).toBe(true);
            expect(item.amount).toBeGreaterThan(0);
            expect(item.display).toBe(formatAmount(item.amount, item.unit));
            expect(item.perServingDisplay).toBe(formatAmount(item.perServing, item.unit));
            const factor = item.kind === 'caffeine' ? 1 : divisor;
            expect(item.perServing * factor).toBeCloseTo(item.amount, 6);
          }
        }
      }),
    );
  });

  it('keeps the section order, the group order and puts caffeine only into gels that exist', () => {
    const rank = { carb: 0, salt: 1, water: 2, caffeine: 3 };
    fc.assert(
      fc.property(input, (args) => {
        const recipe = buildRecipe(args);
        const expected = { gel: ['gel'], drink: ['drink'], both: ['gel', 'drink'] }[args.type];
        expect(recipe.sections.map((section) => section.kind)).toEqual(expected);
        for (const section of recipe.sections) {
          section.items.forEach((item, index) => {
            if (index > 0) expect(rank[item.kind]).toBeGreaterThanOrEqual(rank[section.items[index - 1].kind]);
            if (item.kind === 'caffeine') {
              expect(section.kind).toBe('gel');
              expect(item.label.params.gel).toBeLessThanOrEqual(section.servings);
            }
          });
        }
      }),
    );
  });

  it('fills each drink bottle from the drink part of the carbs and all salts, and has no bottle without bottles', () => {
    fc.assert(
      fc.property(input, (args) => {
        const recipe = buildRecipe(args);
        const drink = recipe.sections.find((section) => section.kind === 'drink');
        if (!drink) return;
        const { bottles, bottleMl } = args.drink;
        if (bottles === 0) {
          expect(drink.water).toEqual({ totalMl: 0, perServingMl: 0 });
          expect(drink.perServing.volumeMl).toBeNull();
          expect(drink.osmolality).toBeNull();
          return;
        }
        const share = args.type === 'both' ? args.drinkCarbShare : 1;
        let dry = 0;
        let water = 0;
        for (const carb of args.carbItems) {
          const grams = carb.grams * share;
          if (!(carb.grams > 1e-6) || !(grams > 1e-6)) continue;
          dry += grams * (1 - carb.waterFraction);
          water += grams * carb.waterFraction;
        }
        for (const salt of args.saltItems) if (salt.amountMg > 1e-3) dry += salt.amountMg / 1000;
        const expected = Math.max(0, bottleMl - (0.625 * dry + water) / bottles);
        expect(drink.water.perServingMl).toBeCloseTo(expected, 6);
        expect(drink.water.totalMl).toBeCloseTo(expected * bottles, 6);
        expect(drink.perServing.volumeMl).toBe(bottleMl);
      }),
    );
  });

  it('delivers every carb ingredient once over the sections and every salt in one section', () => {
    fc.assert(
      fc.property(input, (args) => {
        const recipe = buildRecipe(args);
        const lines = recipe.sections.flatMap((section) => section.items);
        const carbTotal = lines.filter((item) => item.kind === 'carb').reduce((sum, item) => sum + item.amount, 0);
        const realCarbs = args.carbItems.filter((item) => item.grams > 1e-6);
        const expectedCarbs = realCarbs.reduce((sum, item) => sum + item.grams, 0);
        // A split part at or below 1 µg is left out, so allow 2 µg per ingredient.
        expect(Math.abs(carbTotal - expectedCarbs)).toBeLessThanOrEqual(2e-6 * realCarbs.length + 1e-9 * expectedCarbs);
        const saltSections = recipe.sections.filter((section) => section.items.some((item) => item.kind === 'salt'));
        expect(saltSections.length).toBeLessThanOrEqual(1);
        const saltTotal = lines.filter((item) => item.kind === 'salt').reduce((sum, item) => sum + item.amount, 0);
        const expectedSalts = args.saltItems.filter((item) => item.amountMg > 1e-3).reduce((sum, item) => sum + item.amountMg, 0);
        expect(saltTotal).toBeCloseTo(expectedSalts, 6);
      }),
    );
  });
});

describe('i18n catalog (en/recipe)', () => {
  const recipes = [
    buildRecipe({ type: 'gel', carbItems: CARBS, saltItems: SALTS, caffeine: CAFFEINE_TABLETS_180, gel: GEL }),
    buildRecipe({ type: 'both', carbItems: CARBS, saltItems: SALTS, caffeine: CAFFEINE_TABLETS_600, gel: { ...GEL, servings: 30 }, drink: DRINK }),
  ];
  const sections = recipes.flatMap((recipe) => recipe.sections);
  const messages = [
    ...sections.flatMap((section) => section.items).flatMap((item) => (typeof item.label === 'object' ? [item.label] : [])),
    ...sections.map((section) => ({ key: section.servingLabelKey })),
  ];

  it('has text for every message key the module returns, with matching placeholders', () => {
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) {
      expect(catalog, `missing key ${message.key}`).toHaveProperty([message.key]);
      const placeholders = [...catalog[message.key].matchAll(/\{(\w+)(?::\w+)*\}/g)].map((m) => m[1]);
      for (const name of placeholders) {
        expect(message.params, `${message.key} lacks param ${name}`).toHaveProperty(name);
      }
    }
  });

  it('has no unused keys', () => {
    const returned = new Set(messages.map((message) => message.key));
    expect(Object.keys(catalog).filter((key) => !returned.has(key))).toEqual([]);
  });

  it('keeps every key under the recipe namespace', () => {
    for (const key of Object.keys(catalog)) expect(key.startsWith('recipe.')).toBe(true);
  });

  it('uses plain copy without em dashes', () => {
    for (const text of Object.values(catalog)) {
      expect(text).not.toMatch(/—/);
    }
  });

  it('uses plain strings for carb and salt labels', () => {
    for (const item of sections.flatMap((section) => section.items)) {
      if (item.kind === 'carb' || item.kind === 'salt') expect(typeof item.label).toBe('string');
      else expect(typeof item.label).toBe('object');
    }
  });
});
