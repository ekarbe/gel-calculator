import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  RECIPE_WARNING_IDS,
  bottleFill,
  customFallbackName,
  deliveredRatio,
  deliveredShare,
  formatAmount,
  itemAmount,
  itemLabel,
  itemTone,
  mixingSteps,
  osmolalityText,
  recipeWarnings,
  sourceName,
} from './recipeText';
import { allSourcesOptions } from '../../constants/constants';
import { computePlan } from '../../domain/plan';
import { formatAmount as domainFormatAmount } from '../../domain/recipe';
import { LOCALE_CATALOGS, MESSAGES, createT, placeholdersOf } from '../../i18n';
import { createFormat } from '../../i18n/formatters';
import uiRecipe from '../../i18n/en/ui-recipe';

const en = { t: createT('en'), f: createFormat('en') };
const de = { t: createT('de'), f: createFormat('de') };
const us = { t: createT('en', { unitSystem: 'imperial', currency: 'USD' }), f: createFormat('en', { unitSystem: 'imperial', currency: 'USD' }) };
const deUs = { t: createT('de', { unitSystem: 'imperial' }), f: createFormat('de', { unitSystem: 'imperial' }) };

/** A gel section as `buildRecipe` returns it (literal values). */
const GEL = {
  kind: 'gel',
  servings: 1,
  items: [
    { key: 'carb:1', kind: 'carb', label: 'Dextrose', amount: 25, perServing: 25, unit: 'g', detail: { glucoseG: 22.8, fructoseG: 0 } },
  ],
  water: { totalMl: 12, perServingMl: 12 },
  perServing: { volumeMl: 30, massG: 37 },
};

/** The sections of a plan by kind. */
const sectionOf = (plan, kind) => plan.recipe.sections.find((section) => section.kind === kind);

describe('ui-recipe catalog', () => {
  it('namespaces every key and is registered with the other catalogs', () => {
    for (const [key, text] of Object.entries(uiRecipe)) {
      expect(key.startsWith('ui-recipe.'), key).toBe(true);
      expect(MESSAGES[key], key).toBe(text);
    }
  });

  it('names every built-in carb source and salt in both languages, in English as the constants do', () => {
    for (const source of allSourcesOptions) {
      expect(uiRecipe[`ui-recipe.source.${source.id}`], source.label).toBe(source.label);
      expect(LOCALE_CATALOGS.de['ui-recipe'][`ui-recipe.source.${source.id}`], source.label).toEqual(expect.any(String));
    }
    expect(Object.keys(uiRecipe).filter((key) => key.startsWith('ui-recipe.source.'))).toHaveLength(allSourcesOptions.length);
  });

  it('takes every amount already formatted, so each view writes it the same way', () => {
    for (const [key, text] of Object.entries(uiRecipe)) {
      expect(text, key).not.toMatch(/\{\w+\} ?(ml|L\b|fl oz)/);
      expect(placeholdersOf(text).every((name) => !name.includes(':')), key).toBe(true);
    }
  });
});

describe('formatAmount', () => {
  it.each([
    [158.3, 'g'], [8.33, 'g'], [9.96, 'g'], [1250, 'g'], [0, 'g'], [0.04, 'g'], [0.05, 'g'],
    [2290, 'mg'], [254.4, 'mg'], [99.6, 'mg'], [999.6, 'mg'], [89, 'mg'], [0.3, 'mg'], [0, 'mg'], [12345, 'mg'],
    [140, 'ml'], [2249.4, 'ml'], [0.3, 'ml'], [0, 'ml'],
    [0.5, 'tablet'], [1, 'tablet'], [1.555, 'tablet'], [0.001, 'tablet'], [0, 'tablet'],
    [-3, 'g'], [NaN, 'mg'],
  ])('reads like the domain in English metric: %s %s', (amount, unit) => {
    expect(formatAmount(en.t, en.f, amount, unit)).toBe(domainFormatAmount(amount, unit));
  });

  it('matches the domain for any amount in g, mg and ml', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100000, noNaN: true }), fc.constantFrom('g', 'mg', 'ml'), (amount, unit) =>
        formatAmount(en.t, en.f, amount, unit) === domainFormatAmount(amount, unit),
      ),
    );
  });

  it('never shows an ingredient as zero, and treats bad amounts as zero', () => {
    expect(formatAmount(en.t, en.f, 0.04, 'g')).toBe('<0.1 g');
    expect(formatAmount(en.t, en.f, 0.4, 'mg')).toBe('<1 mg');
    expect(formatAmount(en.t, en.f, 0.3, 'ml')).toBe('<1 ml');
    expect(formatAmount(en.t, en.f, 0.004, 'tablet')).toBe('<0.01 tablets');
    expect(formatAmount(en.t, en.f, NaN, 'g')).toBe('0 g');
    expect(formatAmount(en.t, en.f, -5, 'mg')).toBe('0 mg');
    expect(formatAmount(en.t, en.f, undefined, 'ml')).toBe('0 ml');
  });

  it('uses German decimals and thousands', () => {
    expect(formatAmount(de.t, de.f, 8.33, 'g')).toBe('8,3 g');
    expect(formatAmount(de.t, de.f, 1250, 'g')).toBe('1.250 g');
    expect(formatAmount(de.t, de.f, 2290, 'mg')).toBe('2,3 g');
    expect(formatAmount(de.t, de.f, 420, 'mg')).toBe('0,42 g');
    expect(formatAmount(de.t, de.f, 0.04, 'g')).toBe('<0,1 g');
    expect(formatAmount(de.t, de.f, 2249, 'ml')).toBe('2.249 ml');
    expect(formatAmount(de.t, de.f, 0.5, 'tablet')).toBe('0,5 Tabletten');
  });

  it('shows water in US fl oz and keeps nutrients in g and mg', () => {
    // 140 ml = 4.73 fl oz; 2,249 ml = 76.05 fl oz; 1 ml = 0.03 fl oz rounds to 0.
    expect(formatAmount(us.t, us.f, 140, 'ml')).toBe('4.7 fl oz');
    expect(formatAmount(us.t, us.f, 600, 'ml')).toBe('20 fl oz');
    expect(formatAmount(us.t, us.f, 2249, 'ml')).toBe('76 fl oz');
    expect(formatAmount(us.t, us.f, 1, 'ml')).toBe('<0.1 fl oz');
    expect(formatAmount(us.t, us.f, 0, 'ml')).toBe('0 fl oz');
    expect(formatAmount(us.t, us.f, 158, 'g')).toBe('158 g');
    expect(formatAmount(us.t, us.f, 2290, 'mg')).toBe('2.3 g');
  });

  it('formats a line for the whole section or one serving', () => {
    const [malto] = sectionOf(computePlan({}), 'gel').items;
    expect(itemAmount(en.t, en.f, malto)).toBe('158 g');
    expect(itemAmount(en.t, en.f, malto, 'perServing')).toBe('18 g');
    expect(itemAmount(en.t, en.f, { amount: 237, perServing: 26.3, unit: 'g' }, 'total')).toBe('237 g');
  });
});

describe('names, labels and tones', () => {
  it('names the built-in sources in the UI language', () => {
    expect(sourceName(en.t, 14)).toBe('Honey');
    expect(sourceName(de.t, 14)).toBe('Honig');
    expect(sourceName(de.t, 11)).toBe('Fruktose (kristallin)');
    expect(sourceName(de.t, 31)).toBe('Natriumchlorid (Kochsalz)');
    expect(sourceName(de.t, 38)).toBe('Natron (Natriumbicarbonat)');
    expect(sourceName(en.t, 99)).toBeNull();
    expect(sourceName(en.t, 'c1')).toBeNull();
  });

  it('labels built-in lines in the UI language and keeps the names people gave', () => {
    const plan = computePlan({});
    const enLabels = sectionOf(plan, 'gel').items.map((item) => itemLabel(en.t, item));
    const deLabels = sectionOf(plan, 'gel').items.map((item) => itemLabel(de.t, item));
    expect(enLabels).toEqual(['Maltodextrin', 'Crystalline Fructose', 'Sodium Chloride (Table Salt)', 'Warm water']);
    expect(deLabels).toEqual(['Maltodextrin', 'Fruktose (kristallin)', 'Natriumchlorid (Kochsalz)', 'Warmes Wasser']);
    // A name from the inputs is never translated.
    expect(itemLabel(de.t, { kind: 'carb', ref: 14, label: 'Waldhonig vom Imker' })).toBe('Waldhonig vom Imker');
    expect(itemLabel(de.t, { kind: 'carb', ref: 'c1', label: 'Oat syrup' })).toBe('Oat syrup');
    expect(itemLabel(en.t, { kind: 'salt', ref: 's1', label: 'Electrolyte mix' })).toBe('Electrolyte mix');
    expect(itemLabel(en.t, { label: 'Dextrose' })).toBe('Dextrose');
  });

  it('names custom ingredients and salts without a name, and translates water and caffeine', () => {
    expect(itemLabel(en.t, { kind: 'carb', ref: 'c2', label: 'c2' })).toBe('Custom ingredient 2');
    expect(itemLabel(en.t, { kind: 'salt', ref: 's10', label: 's10' })).toBe('Custom salt 10');
    expect(itemLabel(de.t, { kind: 'salt', ref: 's1', label: 's1' })).toBe('Eigenes Salz 1');
    expect(customFallbackName(en.t, 'carb', 'c3')).toBe('Custom ingredient 3');
    expect(itemLabel(en.t, { kind: 'water', label: { key: 'recipe.water.drink', params: { ml: 600 } } })).toBe(
      'Water, to fill each bottle to 600 ml',
    );
    expect(itemLabel(us.t, { kind: 'water', label: { key: 'recipe.water.drink', params: { ml: 600 } } })).toBe(
      'Water, to fill each bottle to 20 fl oz',
    );
    expect(itemLabel(en.t, { kind: 'caffeine', label: { key: 'recipe.caffeineForGel', params: { gel: 7, tabletMg: 100 } } })).toBe(
      'Caffeine for gel 7 (100 mg tablets)',
    );
    expect(itemLabel(en.t, null)).toBe('');
  });

  it('names the unnamed custom lines of a real plan', () => {
    const plan = computePlan({
      carbs: {
        ingredients: [{ ref: 'c1', weight: 100 }],
        custom: [{ key: 'c1', name: '', carbsPer100g: 80, fructoseSharePct: 30 }],
      },
      salts: {
        mode: 'manual',
        manual: [{ ref: 's1', amountMg: 2000 }],
        custom: [{ key: 's1', name: '', sodiumPct: 39, potassiumPct: 0, magnesiumPct: 0, calciumPct: 0, chloridePct: 61 }],
      },
    });
    const labels = plan.recipe.sections[0].items.map((item) => itemLabel(en.t, item));
    expect(labels).toEqual(expect.arrayContaining(['Custom ingredient 1', 'Custom salt 1']));
    expect(labels).not.toContain('c1');
  });

  it('colours a lane by the pathway that carries most of its carbs', () => {
    expect(itemTone({ kind: 'carb', detail: { glucoseG: 150, fructoseG: 0 } })).toBe('glucose');
    expect(itemTone({ kind: 'carb', detail: { glucoseG: 0, fructoseG: 75 } })).toBe('fructose');
    // Sucrose: half and half reads as glucose.
    expect(itemTone({ kind: 'carb', detail: { glucoseG: 10, fructoseG: 10 } })).toBe('glucose');
    expect(itemTone({ kind: 'salt' })).toBe('sodium');
    expect(itemTone({ kind: 'water' })).toBe('fluid');
    expect(itemTone({ kind: 'caffeine' })).toBe('caffeine');
    expect(itemTone({ kind: 'other' })).toBe('neutral');
    expect(itemTone(null)).toBe('neutral');
  });
});

describe('plan helpers', () => {
  it('gives the delivered ratio and fructose share, or 0:0 without carbs', () => {
    expect(deliveredShare(computePlan({}))).toBeCloseTo(1 / 3, 9);
    expect(deliveredRatio(computePlan({}))).toBe('1:0.5');
    expect(deliveredShare(computePlan({ carbs: { ingredients: [] } }))).toBeNull();
    expect(deliveredRatio(computePlan({ carbs: { ingredients: [] } }))).toBe('0:0');
    expect(deliveredRatio(computePlan({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } }))).toBe('0:0');
    // Maltodextrin alone cannot make 1:1.
    expect(
      deliveredRatio(
        computePlan({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 1 }, ingredients: [{ ref: 3, weight: 100 }] } }),
      ),
    ).toBe('1:0');
  });

  it('picks the plan warnings that explain the recipe', () => {
    expect(RECIPE_WARNING_IDS).toEqual(['carbs.noRatio', 'carbs.noIngredients', 'carbs.ratioNotReachable', 'plan.noGels']);
    expect(recipeWarnings(computePlan({}))).toEqual([]);
    // No carbs: the salts go into the drink, and the recipe says why.
    expect(recipeWarnings(computePlan({ carbs: { ingredients: [] } })).map((w) => w.id)).toEqual([
      'carbs.noIngredients',
      'plan.noGels',
    ]);
    const noRatio = computePlan({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } });
    expect(recipeWarnings(noRatio).map((w) => w.id)).toEqual(['carbs.noRatio', 'plan.noGels']);
    expect(recipeWarnings(computePlan({ format: { gelsPerHour: 0 } })).map((w) => w.id)).toEqual(['plan.noGels']);
    const tablets = computePlan({ caffeine: { enabled: true, asIngredient: true } });
    expect(recipeWarnings(tablets).map((w) => w.id)).toEqual(['caffeine.noPowder']);
    // Caffeine tablets without a gel to carry them: no no-powder warning in the recipe.
    const pre = computePlan({ event: { durationMin: 60 }, caffeine: { enabled: true, asIngredient: true } });
    expect(recipeWarnings(pre).map((w) => w.id)).toEqual([]);
  });

  it('rounds osmolality like the domain and marks strong gels as likely higher', () => {
    const plan = computePlan({});
    expect(osmolalityText(en.t, en.f, sectionOf(plan, 'gel').osmolality, 'gel')).toEqual({
      text: '≈ 4,300 mOsm/kg, likely higher',
      tonicity: 'hypertonic',
    });
    // Vist & Maughan 1995: 40 g/L glucose ≈ 228 mOsm/kg, in whole mOsm/kg as the warnings state it.
    expect(osmolalityText(en.t, en.f, { mOsmPerKg: 228.4, tonicity: 'hypotonic' }, 'drink')).toEqual({
      text: '≈ 228 mOsm/kg',
      tonicity: 'hypotonic',
    });
    // A drink from 1000 mOsm/kg reads the same as its warning: 4,237 → 4,200, not "likely higher".
    expect(osmolalityText(en.t, en.f, { mOsmPerKg: 4237, tonicity: 'hypertonic' }, 'drink').text).toBe('≈ 4,200 mOsm/kg');
    expect(osmolalityText(de.t, de.f, { mOsmPerKg: 4326 }, 'gel')).toEqual({
      text: '≈ 4.300 mOsm/kg, wahrscheinlich höher',
      tonicity: 'hypertonic',
    });
    expect(osmolalityText(en.t, en.f, null, 'gel')).toBeNull();
    expect(osmolalityText(en.t, en.f, { mOsmPerKg: 0 }, 'gel')).toBeNull();
    expect(osmolalityText(en.t, en.f, { mOsmPerKg: NaN }, 'gel')).toBeNull();
    expect(osmolalityText(en.t, en.f, { mOsmPerKg: Infinity }, 'gel')).toBeNull();
  });
});

describe('bottleFill', () => {
  it('calls a bottle partly filled only when the fill and the size read differently', () => {
    const drink = (ml) => ({ kind: 'drink', servings: 2, perServing: { volumeMl: ml } });
    expect(bottleFill(en.f, drink(600), 750)).toEqual({ fill: 600, size: 750, partial: true });
    expect(bottleFill(en.f, drink(750), 750)).toEqual({ fill: 750, size: 750, partial: false });
    expect(bottleFill(us.f, drink(600), 750)).toEqual({ fill: 600, size: 750, partial: true });
    // 730–749 ml and 750 ml all read 25 fl oz.
    for (let ml = 730; ml < 750; ml += 1) {
      expect(bottleFill(en.f, drink(ml), 750).partial, `${ml} ml`).toBe(true);
      expect(bottleFill(us.f, drink(ml), 750).partial, `${ml} ml`).toBe(false);
    }
    // No fill given: the bottle is full.
    expect(bottleFill(en.f, { kind: 'drink', servings: 1 }, 500)).toEqual({ fill: 500, size: 500, partial: false });
  });
});

describe('mixingSteps', () => {
  it('makes a gel batch: weigh, dissolve in the warm water, fill the flask', () => {
    expect(mixingSteps(en.t, en.f, GEL, 750)).toEqual([
      {
        key: 'weigh',
        title: 'Weigh the Ingredients',
        text: 'Weigh these for the whole batch of 1 gel:',
        lines: [{ key: 'carb:1', name: 'Dextrose', amount: '25 g', tone: 'glucose' }],
        listLabel: 'Gel ingredients',
      },
      {
        key: 'dissolve',
        title: 'Dissolve',
        text: 'Warm 12 ml of water. Stir in the powders and syrups until they dissolve and the gel is smooth.',
        lines: [],
      },
      {
        key: 'fill',
        title: 'Fill the Flasks',
        text: 'Fill the batch into 1 flask of about 30 ml (37 g). Keep it closed and cool until the start.',
        lines: [],
      },
    ]);
  });

  it('fills one gel of a real plan into one flask', () => {
    // Half a gel per hour for 1 h: one gel of about 19 ml (25 g).
    const plan = computePlan({ format: { gelsPerHour: 0.5 }, event: { durationMin: 60 } });
    const steps = mixingSteps(en.t, en.f, sectionOf(plan, 'gel'), 750);
    expect(steps.map((step) => step.key)).toEqual(['weigh', 'dissolve', 'fill']);
    expect(steps[2].text).toBe('Fill the batch into 1 flask of about 19 ml (25 g). Keep it closed and cool until the start.');
  });

  it('leaves out the flask size when the gel volume is unknown', () => {
    const [, , fill] = mixingSteps(en.t, en.f, { ...GEL, servings: 3, perServing: {} }, 750);
    expect(fill.text).toBe('Divide the batch into 3 flasks. Keep them closed and cool until the start.');
    const [, , withVolume] = mixingSteps(en.t, en.f, { ...GEL, servings: 3, perServing: { volumeMl: 30 } }, 750);
    expect(withVolume.text).toBe('Divide the batch into 3 flasks of about 30 ml each. Keep them closed and cool until the start.');
  });

  it('adds water only when the recipe lists a water line (0.5 ml or more)', () => {
    // The recipe drops a water line that rounds to 0 ml; the steps follow the same rule.
    for (const totalMl of [0, 0.23, 0.49]) {
      const [, dissolve] = mixingSteps(en.t, en.f, { ...GEL, water: { totalMl, perServingMl: totalMl } }, 750);
      expect(dissolve.text).toBe(
        'Add no water: your syrups bring enough. Stir the powders into the syrups until they dissolve and the gel is smooth.',
      );
    }
    const [, dissolve] = mixingSteps(en.t, en.f, { ...GEL, water: { totalMl: 0.5, perServingMl: 0.5 } }, 750);
    expect(dissolve.text).toMatch(/^Warm 1 ml of water\./);
  });

  it('has no steps for a section without servings', () => {
    expect(mixingSteps(en.t, en.f, { ...GEL, servings: 0 }, 750)).toEqual([]);
    expect(mixingSteps(en.t, en.f, { ...GEL, kind: 'drink', servings: 0 }, 750)).toEqual([]);
    expect(mixingSteps(en.t, en.f, null, 750)).toEqual([]);
  });

  it('mixes a bottle of water only when there is nothing to add', () => {
    const steps = mixingSteps(
      en.t,
      en.f,
      { kind: 'drink', servings: 2, items: [], water: { totalMl: 1000, perServingMl: 500 }, perServing: { volumeMl: 500 } },
      500,
    );
    expect(steps).toEqual([
      {
        key: 'shake',
        title: 'Fill and Shake',
        text: 'Make 2 bottles of water. Add about 500 ml of water, up to the 500 ml mark. Shake until nothing is left at the bottom.',
        lines: [],
      },
    ]);
  });

  it('says when a bottle is not filled to the top, with per-bottle amounts', () => {
    const plan = computePlan({ sweat: { source: 'preset' }, format: { type: 'drink' } });
    const [add, shake] = mixingSteps(en.t, en.f, plan.recipe.sections[0], 750);
    expect(add.text).toBe('Make 4 bottles. Put this in each bottle:');
    expect(add.lines.map((line) => [line.amount, line.name])).toEqual([
      ['39 g', 'Maltodextrin'],
      ['19 g', 'Crystalline Fructose'],
      ['1.1 g', 'Sodium Chloride (Table Salt)'],
    ]);
    expect(add.lines.map((line) => line.tone)).toEqual(['glucose', 'fructose', 'sodium']);
    expect(shake.text).toContain('up to the 600 ml mark. Your 750 ml bottle will not be full');
  });

  it('writes the water and the marks in fl oz in imperial units', () => {
    const plan = computePlan({ sweat: { source: 'preset' }, format: { type: 'drink' } });
    const [add, shake] = mixingSteps(us.t, us.f, plan.recipe.sections[0], 750);
    expect(add.lines[0].amount).toBe('39 g');
    expect(shake.text).toBe(
      'Add about 19 fl oz of water, up to the 20 fl oz mark. Your 25 fl oz bottle will not be full: that is all the fluid the plan needs from it. Shake until nothing is left at the bottom.',
    );
    const gel = computePlan({}).recipe.sections[0];
    const [, dissolve, fill] = mixingSteps(us.t, us.f, gel, 750);
    // 140 ml = 4.7 fl oz; each gel about 32 ml = 1.1 fl oz (42 g).
    expect(dissolve.text).toMatch(/^Warm 4\.7 fl oz of water\./);
    expect(fill.text).toMatch(/^Divide the batch into 9 flasks of about 1\.1 fl oz \(42 g\) each\./);
  });

  it.each([
    [490, 2, 735],
    [740, 3, 740],
  ])('never says "up to the 25 fl oz mark. Your 25 fl oz bottle will not be full" (%s ml/h for 3 h)', (mlPerHour, bottles, fillMl) => {
    const plan = computePlan({ format: { type: 'drink', bottleMl: 750 }, fluid: { mode: 'manual', manualMlPerHour: mlPerHour } });
    const drink = sectionOf(plan, 'drink');
    expect(drink.servings).toBe(bottles);
    expect(Math.round(drink.perServing.volumeMl)).toBe(fillMl);
    // In ml the fill reads lower than the bottle, so the bottle is not full.
    expect(mixingSteps(en.t, en.f, drink, 750).at(-1).text).toMatch(
      new RegExp(`up to the ${fillMl} ml mark\\. Your 750 ml bottle will not be full`),
    );
    // In fl oz both read 25.
    const imperial = mixingSteps(us.t, us.f, drink, 750).at(-1).text;
    expect(imperial).toMatch(/up to the 25 fl oz mark\. Shake until nothing is left at the bottom\.$/);
    expect(imperial).not.toContain('will not be full');
    const german = mixingSteps(deUs.t, deUs.f, drink, 750).at(-1).text;
    expect(german).toContain('bis zur Markierung bei 25 fl oz.');
    expect(german).not.toContain('wird nicht voll');
  });

  it('writes a tiny amount of water as the recipe line does, never "0 fl oz"', () => {
    // 1 ml is 0.03 fl oz: the recipe line reads "<0.1 fl oz", and so do the steps.
    const [, dissolve] = mixingSteps(us.t, us.f, { ...GEL, water: { totalMl: 1, perServingMl: 1 } }, 750);
    expect(dissolve.text).toMatch(/^Warm <0\.1 fl oz of water\./);
    const drink = { kind: 'drink', servings: 1, items: GEL.items, water: { totalMl: 1.2, perServingMl: 1.2 }, perServing: { volumeMl: 500 } };
    const [, shake] = mixingSteps(us.t, us.f, drink, 500);
    expect(shake.text).toMatch(/^Add about <0\.1 fl oz of water, up to the 17 fl oz mark\./);
    // Metric: whole ml, as before.
    const [, metric] = mixingSteps(en.t, en.f, drink, 500);
    expect(metric.text).toMatch(/^Add about 1 ml of water, up to the 500 ml mark\./);
  });

  it('lists the caffeine tablets after the batch', () => {
    const plan = computePlan({ caffeine: { enabled: true, asIngredient: true } });
    const steps = mixingSteps(en.t, en.f, plan.recipe.sections[0], 750);
    expect(steps.map((step) => step.key)).toEqual(['weigh', 'dissolve', 'fill', 'caffeine']);
    expect(steps.at(-1)).toMatchObject({ listLabel: 'Caffeine tablets' });
    expect(steps.at(-1).lines).toEqual([
      expect.objectContaining({ name: 'Caffeine for gel 7 (100 mg tablets)', amount: '0.5 tablets', tone: 'caffeine' }),
    ]);
    expect(steps.at(-1).text).toContain('Never use pure caffeine powder.');
  });

  it('writes the steps in German with German numbers and names', () => {
    const steps = mixingSteps(de.t, de.f, sectionOf(computePlan({}), 'gel'), 750);
    expect(steps[0].text).toBe('Wiege diese Mengen für 9 Gels ab:');
    expect(steps[0].lines.map((line) => `${line.amount} ${line.name}`)).toContain('2,3 g Natriumchlorid (Kochsalz)');
  });
});
