import { describe, it, expect } from 'vitest';
import { mixingSteps } from './mixing';
import { computePlan } from '../../domain/plan';

/** A gel section as `buildRecipe` returns it (literal values). */
const GEL = {
  kind: 'gel',
  servings: 1,
  items: [{ key: 'carb:1', kind: 'carb', label: 'Dextrose', display: '25 g', perServingDisplay: '25 g' }],
  water: { totalMl: 12, perServingMl: 12 },
  perServing: { volumeMl: 30, massG: 37 },
};

describe('mixingSteps', () => {
  it('makes a gel batch: weigh, dissolve in the warm water, fill the flasks', () => {
    expect(mixingSteps(GEL, 750)).toEqual([
      {
        key: 'weigh',
        title: 'Weigh the Ingredients',
        text: 'Weigh these for the whole batch of 1 gel:',
        lines: ['25 g Dextrose'],
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
        text: 'Fill the batch into 1 flask of about 30 ml (37 g). Keep them closed and cool until the start.',
        lines: [],
      },
    ]);
  });

  it('adds water only when the recipe lists a water line (0.5 ml or more)', () => {
    // The recipe drops a water line that rounds to 0 ml; the steps follow the same rule.
    for (const totalMl of [0, 0.23, 0.49]) {
      const [, dissolve] = mixingSteps({ ...GEL, water: { totalMl, perServingMl: totalMl } }, 750);
      expect(dissolve.text).toBe(
        'Add no water: your syrups bring enough. Stir the powders into the syrups until they dissolve and the gel is smooth.',
      );
    }
    const [, dissolve] = mixingSteps({ ...GEL, water: { totalMl: 0.5, perServingMl: 0.5 } }, 750);
    expect(dissolve.text).toMatch(/^Warm 1 ml of water\./);
  });

  it('has no steps for a section without servings', () => {
    expect(mixingSteps({ ...GEL, servings: 0 }, 750)).toEqual([]);
    expect(mixingSteps({ ...GEL, kind: 'drink', servings: 0 }, 750)).toEqual([]);
    expect(mixingSteps(null, 750)).toEqual([]);
  });

  it('mixes a bottle of water only when there is nothing to add', () => {
    const steps = mixingSteps(
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

  it('says when a bottle is not filled to the top', () => {
    const plan = computePlan({ sweat: { source: 'preset' }, format: { type: 'drink' } });
    const [add, shake] = mixingSteps(plan.recipe.sections[0], 750);
    expect(add.lines).toEqual(['39 g Maltodextrin', '19 g Crystalline Fructose', '1.1 g Sodium Chloride (Table Salt)']);
    expect(shake.text).toContain('up to the 600 ml mark. Your 750 ml bottle will not be full');
  });

  it('lists the caffeine tablets after the batch', () => {
    const plan = computePlan({ caffeine: { enabled: true, asIngredient: true } });
    const steps = mixingSteps(plan.recipe.sections[0], 750);
    expect(steps.map((step) => step.key)).toEqual(['weigh', 'dissolve', 'fill', 'caffeine']);
    expect(steps.at(-1)).toMatchObject({ listLabel: 'Caffeine tablets', lines: ['Caffeine for gel 7 (100 mg tablets): 0.5 tablets'] });
    expect(steps.at(-1).text).toContain('Never use pure caffeine powder.');
  });
});
