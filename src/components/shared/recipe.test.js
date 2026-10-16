import { describe, it, expect } from 'vitest';
import { CARB_RECIPE_WARNING_IDS, carbRecipeWarnings, recipeItemDotClass, recipeItemLabel } from './recipe';
import { computePlan } from '../../domain/plan';

describe('recipe helpers', () => {
  it('labels and colors recipe items', () => {
    expect(recipeItemLabel({ label: 'Maltodextrin' })).toBe('Maltodextrin');
    expect(recipeItemLabel({ label: { key: 'recipe.caffeineTablet', params: { tablets: 1, tabletMg: 100, gel: 2 } } })).toMatch(
      /gel 2/,
    );
    expect(recipeItemDotClass({ kind: 'carb', pathway: 'fructose' })).toBe('bg-apple-purple');
  });

  it('picks the warnings that explain a recipe without carbs', () => {
    expect(CARB_RECIPE_WARNING_IDS).toEqual(['plan.carbSourcesInfeasible', 'carbs.noRatio']);
    expect(carbRecipeWarnings(computePlan({}))).toEqual([]);
    expect(carbRecipeWarnings(computePlan({ carbs: { fructoseSources: [] } })).map((w) => w.id)).toEqual([
      'plan.carbSourcesInfeasible',
    ]);
    const noRatio = computePlan({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } });
    expect(carbRecipeWarnings(noRatio).map((w) => w.id)).toEqual(['carbs.noRatio']);
  });
});
