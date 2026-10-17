import { describe, it, expect } from 'vitest';
import { amountsCaption, formatMonth, planSummary, sectionTitle, servingsText, splitAround } from './dialogText';
import { copyName, recipeNameOrUntitled } from './share';
import { computePlan } from '../../domain/plan';
import { createT } from '../../i18n';
import { createFormat } from '../../i18n/formatters';
import { countText } from '../../i18n/plural';

const t = createT('en');
const f = createFormat('en');
const fImperial = createFormat('en', { unitSystem: 'imperial' });
const tImperial = createT('en', { unitSystem: 'imperial' });
const fDe = createFormat('de');
const tDe = createT('de');

describe('counts', () => {
  it('counts gels and bottles with the right form', () => {
    expect(countText(t, f, 'ui-recipe.servings.gels', 1)).toBe('1 gel');
    expect(countText(t, f, 'ui-recipe.servings.gels', 9)).toBe('9 gels');
    expect(countText(t, f, 'ui-recipe.servings.bottles', 1200)).toBe('1,200 bottles');
    expect(countText(tDe, fDe, 'ui-recipe.servings.bottles', 1)).toBe('1 Flasche');
  });
});

describe('recipe section helpers', () => {
  it('names the sections', () => {
    expect(sectionTitle(t, { kind: 'gel' })).toBe('Gels');
    expect(sectionTitle(t, { kind: 'drink' })).toBe('Drink');
  });

  it('describes servings and the amount caption', () => {
    const gel = { kind: 'gel', servings: 1, servingLabelKey: 'recipe.serving.gel', perServing: {} };
    expect(servingsText(t, f, gel, 750)).toBe('1 gel');
    expect(servingsText(t, f, { ...gel, servings: 0 }, 750)).toBe('No gels planned');
    const drink = { kind: 'drink', servings: 2, servingLabelKey: 'recipe.serving.bottle', perServing: { volumeMl: 750 } };
    expect(servingsText(t, f, drink, 750)).toBe('2 bottles of 750 ml');
    expect(servingsText(t, f, { ...drink, perServing: { volumeMl: 499.6 } }, 750)).toBe('2 bottles, 500 ml each (750 ml bottle)');
    expect(servingsText(t, f, { ...drink, perServing: { volumeMl: 1200 } }, 1500)).toBe(
      '2 bottles, 1,200 ml each (1,500 ml bottle)',
    );
    expect(servingsText(t, f, { ...drink, servings: 0 }, 750)).toBe('No bottles: no fluid planned');
    expect(servingsText(tImperial, fImperial, drink, 750)).toBe('2 bottles of 25 fl oz');
    expect(servingsText(tImperial, fImperial, { ...drink, perServing: { volumeMl: 600 } }, 750)).toBe(
      '2 bottles, 20 fl oz each (25 fl oz bottle)',
    );
    expect(amountsCaption(t, gel, 'perServing')).toBe('Per gel');
    expect(amountsCaption(t, gel, 'total')).toBe('Whole batch');
    expect(amountsCaption(t, drink, 'perServing')).toBe('Per bottle');
    expect(amountsCaption(t, drink, 'total')).toBe('All bottles');
    expect(amountsCaption(t, { ...drink, servings: 0 }, 'perServing')).toBe('Whole activity');
  });

  it.each([730, 735, 740, 749])('never names a bottle size that reads like the fill (%s ml of 750 ml in fl oz)', (ml) => {
    const drink = { kind: 'drink', servings: 2, perServing: { volumeMl: ml } };
    // Before: "2 bottles, 25 fl oz each (25 fl oz bottle)".
    expect(servingsText(tImperial, fImperial, drink, 750)).toBe('2 bottles of 25 fl oz');
    expect(servingsText(t, f, drink, 750)).toBe(`2 bottles, ${ml} ml each (750 ml bottle)`);
    const tDeImperial = createT('de', { unitSystem: 'imperial' });
    expect(servingsText(tDeImperial, createFormat('de', { unitSystem: 'imperial' }), drink, 750)).toBe('2 Flaschen à 25 fl oz');
  });
});

describe('other text helpers', () => {
  it('summarises a plan with the duration as the board writes it', () => {
    expect(planSummary(t, f, computePlan({ event: { durationMin: 95 } }))).toMatch(/^1:35 h · \d+ g\/h · Gel$/);
    expect(planSummary(tDe, fDe, computePlan({ format: { type: 'drink' } }))).toMatch(/^3:00 h · \d+ g\/h · Getränk$/);
  });

  it('formats a checked month in the locale, and leaves other text as it is', () => {
    expect(formatMonth(f, '2026-10')).toBe('Oct 2026');
    expect(formatMonth(fDe, '2026-10')).toBe('Okt. 2026');
    expect(formatMonth(f, 'sometime')).toBe('sometime');
  });

  it('splits a message around a placeholder for an element', () => {
    expect(splitAround(t, 'ui-dialogs.recipes.saved', 'time')).toEqual(['Saved ', '']);
    expect(splitAround(t, 'ui-dialogs.recipes.current', 'summary')).toEqual(['Current plan: ', '']);
    expect(splitAround(t, 'ui-dialogs.recipes.empty', 'time')).toEqual([t('ui-dialogs.recipes.empty'), '']);
  });

  it('names untitled recipes and copies in the UI language', () => {
    expect(recipeNameOrUntitled(t, '  ')).toBe('Untitled recipe');
    expect(recipeNameOrUntitled(t, undefined)).toBe('Untitled recipe');
    expect(recipeNameOrUntitled(t, ' Long ride ')).toBe(' Long ride ');
    expect(copyName(t, 'Long ride')).toBe('Long ride (copy)');
    // Whole characters a person sees: a flag emoji is never split.
    const flags = '🇩🇪'.repeat(60);
    const copy = copyName(t, flags);
    expect(copy.endsWith(' (copy)')).toBe(true);
    expect(copy.replace(' (copy)', '')).toBe('🇩🇪'.repeat(53));
  });
});
