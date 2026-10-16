import { describe, it, expect } from 'vitest';
import {
  RECIPE_WARNING_IDS,
  SECTION_TITLES,
  amountsCaption,
  countText,
  customDisplayName,
  deliveredRatioText,
  deliveredShare,
  itemAmount,
  osmolalityDisplay,
  recipeItemLabel,
  recipeWarnings,
  servingsText,
} from './recipe';
import { computePlan } from '../../domain/plan';

describe('recipe item helpers', () => {
  it('labels recipe items: strings as they are, messages through t()', () => {
    expect(recipeItemLabel({ label: 'Maltodextrin' })).toBe('Maltodextrin');
    expect(recipeItemLabel({ label: { key: 'recipe.caffeineForGel', params: { gel: 7, tabletMg: 100 } } })).toBe(
      'Caffeine for gel 7 (100 mg tablets)',
    );
    expect(recipeItemLabel({ label: { key: 'recipe.water.gel' } })).toBe('Warm water');
  });

  it('counts with the right noun', () => {
    expect(countText(1, 'gel', 'gels')).toBe('1 gel');
    expect(countText(9, 'gel', 'gels')).toBe('9 gels');
    expect(countText(1200, 'ml', 'ml')).toBe('1,200 ml');
  });

  it('shows the total or the per-serving amount of a line', () => {
    const item = { display: '237 g', perServingDisplay: '26 g' };
    expect(itemAmount(item, 'total')).toBe('237 g');
    expect(itemAmount(item, 'perServing')).toBe('26 g');
  });

  it('names the sections and the warnings that explain the recipe carbs', () => {
    expect(SECTION_TITLES).toEqual({ gel: 'Gels', drink: 'Drink' });
    expect(RECIPE_WARNING_IDS).toEqual(['carbs.noRatio', 'carbs.noIngredients', 'carbs.ratioNotReachable', 'plan.noGels']);
  });

  it('reads the delivered fructose share', () => {
    // Default plan: maltodextrin and fructose make the recommended 1:0.5 exactly.
    expect(deliveredShare(computePlan({}))).toBeCloseTo(1 / 3, 9);
    expect(deliveredShare(computePlan({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } }))).toBeNull();
    // No carb ingredient: 0 g delivered, so there is no delivered ratio (not the 1:0.5 target).
    expect(deliveredShare(computePlan({ carbs: { ingredients: [] } }))).toBeNull();
  });
});

describe('recipe section helpers', () => {
  it('formats the osmolality by section kind', () => {
    // Gels from 1000 mOsm/kg: rounded to 100, likely higher (ideal sugars read low).
    expect(osmolalityDisplay({ mOsmPerKg: 4326.5, tonicity: 'hypertonic' }, 'gel')).toEqual({
      text: '≈ 4,300 mOsm/kg',
      likelyHigher: true,
      tonicity: 'hypertonic',
    });
    // Vist & Maughan 1995: 40 g/L glucose ≈ 228 mOsm/kg, in whole mOsm/kg as the warnings state it.
    expect(osmolalityDisplay({ mOsmPerKg: 228.4, tonicity: 'hypotonic' }, 'drink')).toEqual({
      text: '≈ 228 mOsm/kg',
      likelyHigher: false,
      tonicity: 'hypotonic',
    });
    expect(osmolalityDisplay({ mOsmPerKg: 4046, tonicity: 'hypertonic' }, 'drink').likelyHigher).toBe(false);
    // A drink from 1000 mOsm/kg reads the same in the chip and in its warning: 4,237 → 4,200.
    expect(osmolalityDisplay({ mOsmPerKg: 4237, tonicity: 'hypertonic' }, 'drink').text).toBe('≈ 4,200 mOsm/kg');
    expect(osmolalityDisplay(null, 'gel')).toBeNull();
    expect(osmolalityDisplay({ mOsmPerKg: 0, tonicity: 'hypotonic' }, 'drink')).toBeNull();
    expect(osmolalityDisplay({ mOsmPerKg: Infinity, tonicity: 'hypertonic' }, 'gel')).toBeNull();
    expect(osmolalityDisplay({ mOsmPerKg: 600 }, 'gel')).toEqual({ text: '≈ 600 mOsm/kg', likelyHigher: false, tonicity: 'hypertonic' });
  });

  it('describes servings and the amount column', () => {
    const gel = { kind: 'gel', servings: 1, servingLabelKey: 'recipe.serving.gel', perServing: {} };
    expect(servingsText(gel, 750)).toBe('1 gel');
    expect(servingsText({ ...gel, servings: 0 }, 750)).toBe('No gels planned');
    const drink = { kind: 'drink', servings: 2, servingLabelKey: 'recipe.serving.bottle', perServing: { volumeMl: 750 } };
    expect(servingsText(drink, 750)).toBe('2 bottles of 750 ml');
    expect(servingsText({ ...drink, perServing: { volumeMl: 499.6 } }, 750)).toBe('2 bottles, 500 ml each (750 ml bottle)');
    expect(servingsText({ ...drink, perServing: { volumeMl: 1200 } }, 1500)).toBe('2 bottles, 1,200 ml each (1,500 ml bottle)');
    expect(servingsText({ ...drink, servings: 0 }, 750)).toBe('No bottles: no fluid planned');
    expect(amountsCaption(gel, 'perServing')).toBe('Per gel');
    expect(amountsCaption(drink, 'perServing')).toBe('Per bottle');
    expect(amountsCaption(drink, 'total')).toBe('All bottles');
    expect(amountsCaption({ ...drink, servings: 0 }, 'perServing')).toBe('Whole activity');
  });

  it('picks the plan warnings that explain the recipe carbs', () => {
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

  it('reads the ratio the recipe delivers', () => {
    expect(deliveredRatioText(computePlan({}))).toBe('1:0.5');
    expect(
      deliveredRatioText(computePlan({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } })),
    ).toBe('0:0');
    expect(deliveredRatioText(computePlan({ carbs: { ingredients: [] } }))).toBe('0:0');
  });
});

describe('custom names', () => {
  it('shows the name, else "Custom ingredient N" / "Custom salt N" from the key', () => {
    expect(customDisplayName('carb', { key: 'c2', name: ' Agave blend ' })).toBe('Agave blend');
    expect(customDisplayName('carb', { key: 'c2', name: '' })).toBe('Custom ingredient 2');
    expect(customDisplayName('salt', { key: 's10', name: '  ' })).toBe('Custom salt 10');
  });

  it('names unnamed custom lines in the recipe the same way as the cards', () => {
    // The domain labels an unnamed custom salt or ingredient with its bare key.
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
    const items = plan.recipe.sections[0].items;
    expect(items.map((item) => item.label)).toEqual(expect.arrayContaining(['c1', 's1']));
    const labels = items.map(recipeItemLabel);
    expect(labels).toEqual(expect.arrayContaining(['Custom ingredient 1', 'Custom salt 1']));
    expect(labels).not.toContain('c1');
    expect(labels).not.toContain('s1');
    // A named one keeps its name.
    expect(recipeItemLabel({ kind: 'salt', ref: 's1', label: 'Electrolyte mix' })).toBe('Electrolyte mix');
  });
});
