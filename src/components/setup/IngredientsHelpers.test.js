import { describe, it, expect } from 'vitest';
import {
  checkIngredientDraft,
  customIngredientName,
  customSaltName,
  draftFrom,
  freeCustomKey,
  listText,
  shareRatio,
} from './IngredientsHelpers';
import { createT } from '../../i18n';
import { createFormat } from '../../i18n/formatters';
import { countText } from '../../i18n/plural';

const t = createT('en');
const f = createFormat('en');
const de = createFormat('de');

describe('names and keys', () => {
  it('names custom ingredients and salts, with a numbered fallback', () => {
    expect(customIngredientName(t, { key: 'c3', name: ' Gel X ' })).toBe('Gel X');
    expect(customIngredientName(t, { key: 'c3', name: '' })).toBe('Custom ingredient 3');
    expect(customSaltName(t, { key: 's10' })).toBe('Custom salt 10');
    expect(customSaltName(t, { key: 's1', name: 'Mix' })).toBe('Mix');
  });

  it('finds the first free custom key, or null when all ten are used', () => {
    expect(freeCustomKey([], 'c')).toBe('c1');
    expect(freeCustomKey([{ key: 'c1' }, { key: 'c3' }], 'c')).toBe('c2');
    expect(freeCustomKey(Array.from({ length: 10 }, (_, i) => ({ key: `s${i + 1}` })), 's')).toBeNull();
  });

  it('joins names as a list in the UI language', () => {
    expect(listText(f, ['A', 'B', 'C'])).toBe('A, B, and C');
    expect(listText(de, ['A', 'B', 'C'])).toBe('A, B und C');
    expect(listText(f, ['A', 'B'], 'unit')).toBe('A, B');
    expect(listText(f, [])).toBe('');
  });

  it('writes shares as glucose:fructose ratios', () => {
    expect(shareRatio(1 / 3)).toBe('1:0.5');
    expect(shareRatio(0)).toBe('1:0');
    expect(shareRatio(1)).toBe('0:1');
  });

  it('picks the text for one and for many', () => {
    expect(countText(t, f, 'ui-setup-recipe.format.gels.total', 1)).toBe('1 gel in total');
    expect(countText(t, f, 'ui-setup-recipe.format.gels.total', 9)).toBe('9 gels in total');
    expect(countText(t, f, 'ui-setup-recipe.format.gels.total', 0)).toBe('0 gels in total');
  });
});

describe('the custom ingredient form', () => {
  const draft = (fields) => ({ name: 'Gel', carbsPer100g: '60', fructoseSharePct: '50', waterPct: '', ...fields });

  it('accepts a complete draft and leaves out an empty water field', () => {
    expect(checkIngredientDraft(f, draft())).toEqual({
      errors: {},
      value: { name: 'Gel', carbsPer100g: 60, fructoseSharePct: 50 },
    });
    expect(checkIngredientDraft(f, draft({ name: ' Gel ', waterPct: '38' })).value).toEqual({
      name: 'Gel',
      carbsPer100g: 60,
      fructoseSharePct: 50,
      waterPct: 38,
    });
  });

  it('names every problem with a message key', () => {
    expect(checkIngredientDraft(f, { name: ' ', carbsPer100g: '0', fructoseSharePct: '101', waterPct: 'x' })).toEqual({
      errors: {
        name: 'ui-setup-recipe.custom.error.name',
        carbsPer100g: 'ui-setup-recipe.custom.error.carbs',
        fructoseSharePct: 'ui-setup-recipe.custom.error.fructose',
        waterPct: 'ui-setup-recipe.custom.error.water',
      },
      value: null,
    });
    expect(checkIngredientDraft(f, draft({ carbsPer100g: '70', waterPct: '35' })).errors).toEqual({
      waterPct: 'ui-setup-recipe.custom.error.waterSum',
    });
    expect(checkIngredientDraft(f, draft({ carbsPer100g: '' })).errors.carbsPer100g).toBe(
      'ui-setup-recipe.custom.error.carbs',
    );
  });

  it('reads numbers in the locale and writes them back for an edit', () => {
    expect(checkIngredientDraft(de, draft({ carbsPer100g: '62,5' })).value.carbsPer100g).toBe(62.5);
    expect(draftFrom(de, { key: 'c1', name: 'Gel', carbsPer100g: 62.5, fructoseSharePct: 0 })).toEqual({
      name: 'Gel',
      carbsPer100g: '62,5',
      fructoseSharePct: '0',
      waterPct: '',
    });
    expect(draftFrom(f, null)).toEqual({ name: '', carbsPer100g: '', fructoseSharePct: '', waterPct: '' });
  });
});
