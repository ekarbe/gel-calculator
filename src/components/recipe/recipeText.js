/*  Gel-Calculator - Personalized fuel calculator for endurance athletes.
    Copyright (C) 2026  Eike Christian Karbe

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>. */

/**
 * Text of the recipe itself, shared by every view that shows it: the race
 * board, the mixing dialog and the share image, the print view, the setup
 * sections and the guided pantry. One copy, so every view writes an
 * amount, an ingredient name, the osmolality, a bottle's fill and the mixing
 * steps the same way, in the UI language and unit system (`ui-recipe.*`).
 * Each view keeps only its own wording around them (section titles,
 * captions). Display only: every number comes from the plan (`buildRecipe`);
 * these helpers pick, round and format it. No React.
 */

import { sourceDataByIdMap } from '../../constants/constants';
import { formatRatio } from '../../domain/carbs';
import { OSMOLALITY_COARSE_FROM_MOSM, roundOsmolality } from '../../domain/concentration';
import { ML_PER_FL_OZ, roundTo } from '../../domain/units';
import { finite } from '../../i18n/formatters';
import { countText, pluralOf } from '../../i18n/plural';

/** @typedef {import('../../i18n/index').TranslateFn} TranslateFn */
/** @typedef {import('../../i18n/formatters').Formatters} Formatters */
/** @typedef {import('../../domain/plan').Plan} Plan */
/** @typedef {import('../../domain/recipe').RecipeItem} RecipeItem */
/** @typedef {import('../../domain/recipe').RecipeSection} RecipeSection */
/** @typedef {import('../../domain/recipe').Osmolality} Osmolality */

/**
 * Plan warnings that explain the recipe itself: a 0:0 ratio (no carbs), no
 * carb ingredient (no carbs), a ratio the ingredients cannot make (the
 * recipe uses the closest one), or a gel plan without gels whose carbs or
 * salts went into the drink. Views that show the recipe without the board's
 * warnings panel (the mixing dialog, the share image) list them
 * ({@link recipeWarnings}).
 */
export const RECIPE_WARNING_IDS = Object.freeze([
  'carbs.noRatio',
  'carbs.noIngredients',
  'carbs.ratioNotReachable',
  'plan.noGels',
]);

/**
 * The plan's warnings about the recipe ({@link RECIPE_WARNING_IDS}), plus the
 * "tablets, never powder" danger when a section lists caffeine tablets. In
 * plan order.
 * @param {Plan} plan
 * @returns {Plan['warnings']}
 */
export function recipeWarnings(plan) {
  const sections = Array.isArray(plan?.recipe?.sections) ? plan.recipe.sections : [];
  const hasTablets = sections.some((section) => section.items.some((item) => item.kind === 'caffeine'));
  return (plan?.warnings ?? []).filter(
    (warning) => RECIPE_WARNING_IDS.includes(warning.id) || (hasTablets && warning.id === 'caffeine.noPowder'),
  );
}

/**
 * An amount of a recipe line in the locale's number format, with the bands
 * of `formatAmount` in `src/domain/recipe.js` (so in English and metric it
 * is the recipe's own `display` text):
 * - `'g'`: whole grams from 10 g, one decimal below ("158 g", "8.3 g");
 * - `'mg'` (salts): grams with one decimal from 1000 mg ("2.3 g"), two
 *   decimals from 100 mg ("0.25 g"), whole mg below ("89 mg");
 * - `'ml'` (water): a volume in the unit system ("140 ml" / "4.7 fl oz");
 * - `'tablet'`: up to two decimals ("0.5 tablets", "1 tablet").
 * Zero shows as "0 g"; a positive amount that would round to zero shows as
 * below the smallest step ("<0.1 g", "<1 mg", "<1 ml", "<0.1 fl oz",
 * "<0.01 tablets"); non-finite or negative amounts count as zero.
 *
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {number} amount  In `unit`.
 * @param {'g'|'mg'|'ml'|'tablet'|string} unit
 * @returns {string}
 */
export function formatAmount(t, f, amount, unit) {
  const value = Math.max(0, finite(amount));
  const below = (text) => t('ui-recipe.amount.below', { value: text });
  const grams = (n, digits) => t('ui-recipe.amount.g', { value: f.number(n, { digits, minDigits: digits }) });
  switch (unit) {
    case 'mg': {
      if (value > 0 && Math.round(value) === 0) return below(t('ui-recipe.amount.mg', { value: f.number(1) }));
      if (Math.round(value) < 100) return t('ui-recipe.amount.mg', { value: f.number(Math.round(value)) });
      const hundredths = Math.round(value / 10) / 100;
      if (hundredths < 1) return grams(hundredths, 2);
      return grams(Math.round(value / 100) / 10, 1);
    }
    case 'ml': {
      const imperial = f.unitSystem === 'imperial';
      // The smallest step a volume shows: 1 ml, or 0.1 fl oz (whole fl oz from 10).
      const shown = imperial ? roundTo(value / ML_PER_FL_OZ, 1) : Math.round(value);
      if (value > 0 && shown === 0) return below(f.volume(imperial ? 0.1 * ML_PER_FL_OZ : 1));
      return f.volume(value);
    }
    case 'tablet': {
      if (value > 0 && Math.round(value * 100) === 0) {
        return below(t('ui-recipe.amount.tablets.other', { value: f.number(0.01, 2) }));
      }
      const tablets = Math.round(value * 100) / 100;
      return t(`ui-recipe.amount.tablets.${pluralOf(tablets)}`, { value: f.number(tablets, 2) });
    }
    case 'g':
    default: {
      if (value === 0) return grams(0, 0);
      const tenths = Math.round(value * 10) / 10;
      if (tenths === 0) return below(grams(0.1, 1));
      return tenths >= 10 ? grams(Math.round(value), 0) : grams(tenths, 1);
    }
  }
}

/**
 * The amount of a recipe line for the whole section or for one serving.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {RecipeItem} item
 * @param {'total'|'perServing'} [view='total']
 * @returns {string}
 */
export function itemAmount(t, f, item, view = 'total') {
  return formatAmount(t, f, view === 'perServing' ? item.perServing : item.amount, item.unit);
}

/**
 * The name of a built-in carb source or salt (`src/constants/constants.js`)
 * in the UI language ("Honey" / "Honig"); `null` for any other id.
 * @param {TranslateFn} t
 * @param {unknown} id
 * @returns {string|null}
 */
export function sourceName(t, id) {
  return typeof id === 'number' && sourceDataByIdMap.has(id) ? t(`ui-recipe.source.${id}`) : null;
}

/**
 * The name of an unnamed custom ingredient or salt ("Custom ingredient 2",
 * "Custom salt 1") from its key (`'c2'`, `'s1'`).
 * @param {TranslateFn} t
 * @param {'carb'|'salt'} kind
 * @param {unknown} key
 * @returns {string}
 */
export function customFallbackName(t, kind, key) {
  return t(kind === 'salt' ? 'ui-recipe.custom.salt' : 'ui-recipe.custom.carb', { number: String(key ?? '').slice(1) });
}

/**
 * The text label of a recipe line. A built-in carb source or salt reads in
 * the UI language ({@link sourceName}); a custom one by the name it was
 * given, and an unnamed one (the domain falls back to its key, 'c2' or
 * 's1') "Custom ingredient 2" / "Custom salt 1". Water and caffeine labels
 * are message descriptors and go through `t()` (so the water mark is in the
 * unit system).
 * @param {TranslateFn} t
 * @param {RecipeItem|null|undefined} item
 * @returns {string}
 */
export function itemLabel(t, item) {
  if (typeof item?.label !== 'string') return t(/** @type {any} */ (item?.label));
  if (item.kind !== 'carb' && item.kind !== 'salt') return item.label;
  if (typeof item.ref === 'string' && item.label === item.ref) return customFallbackName(t, item.kind, item.ref);
  // A built-in source keeps its label from the constants unless the inputs named it otherwise.
  if (typeof item.ref === 'number' && item.label === sourceDataByIdMap.get(item.ref)?.label) {
    return sourceName(t, item.ref) ?? item.label;
  }
  return item.label;
}

/**
 * The substance colour of a recipe line: a carb ingredient takes the
 * pathway that carries most of its carbs (glucose on a tie, so sucrose is
 * glucose), salts are sodium, water is fluid, caffeine is caffeine.
 * @param {RecipeItem|null|undefined} item
 * @returns {'glucose'|'fructose'|'sodium'|'fluid'|'caffeine'|'neutral'}
 */
export function itemTone(item) {
  switch (item?.kind) {
    case 'carb': {
      const detail = /** @type {any} */ (item.detail);
      return finite(detail?.fructoseG) > finite(detail?.glucoseG) ? 'fructose' : 'glucose';
    }
    case 'salt':
      return 'sodium';
    case 'water':
      return 'fluid';
    case 'caffeine':
      return 'caffeine';
    default:
      return 'neutral';
  }
}

/**
 * The fructose share the recipe delivers: the share of the solved
 * ingredients, else the share the solver chose, else the target. `null`
 * when the recipe delivers no carbs (a 0:0 ratio, or no carb ingredient).
 * @param {Plan} plan
 * @returns {number|null}
 */
export function deliveredShare(plan) {
  const { ratio, ingredients, deliveredG } = plan.carbs;
  if (!(ratio.value.glucose + ratio.value.fructose > 0) || !(deliveredG > 0)) return null;
  return ingredients.achievedShare ?? ingredients.usedShare ?? ratio.share;
}

/**
 * The glucose:fructose ratio the recipe delivers, as the domain writes it
 * (`1:0.5`; pass it to a `{x:ratio}` placeholder or `f.ratio` for the
 * locale's decimals); `0:0` when it delivers no carbs.
 * @param {Plan} plan
 * @returns {string}
 */
export function deliveredRatio(plan) {
  const share = deliveredShare(plan);
  return share === null ? '0:0' : formatRatio({ glucose: 1 - share, fructose: share });
}

/**
 * Osmolality as shown: `roundOsmolality` from the domain (whole mOsm/kg,
 * from 1000 rounded to 100), the value the drink warnings state. Gels from
 * 1000 mOsm/kg are marked "likely higher": sugars are taken as ideal
 * solutes, which reads about 10 % low at gel strength. `null` without a
 * finite value above 0; the tonicity falls back to `'hypertonic'`.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {Osmolality|null|undefined} osmolality
 * @param {'gel'|'drink'} kind
 * @returns {{ text: string, tonicity: 'hypotonic'|'isotonic'|'hypertonic' }|null}
 */
export function osmolalityText(t, f, osmolality, kind) {
  const value = osmolality?.mOsmPerKg;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  const higher = kind === 'gel' && value >= OSMOLALITY_COARSE_FROM_MOSM;
  return {
    text: t(higher ? 'ui-recipe.osmo.valueHigher' : 'ui-recipe.osmo.value', { mOsm: f.number(roundOsmolality(value)) }),
    tonicity: osmolality.tonicity ?? 'hypertonic',
  };
}

/**
 * How full a drink's bottles are: the fill and the bottle size in whole ml,
 * and whether the bottles show as not filled to the top. That needs the
 * fill below the size and the two volumes to read differently in the unit
 * system: a 740 ml fill of a 750 ml bottle reads "25 fl oz" like the bottle,
 * so no view ever says "25 fl oz each (25 fl oz bottle)" or "up to the
 * 25 fl oz mark. Your 25 fl oz bottle will not be full".
 * @param {Formatters} f
 * @param {RecipeSection} section  A drink section.
 * @param {number} bottleMl  Bottle size from the inputs.
 * @returns {{ fill: number, size: number, partial: boolean }}
 */
export function bottleFill(f, section, bottleMl) {
  const size = Math.round(finite(bottleMl));
  const fill = Math.round(finite(section?.perServing?.volumeMl ?? bottleMl));
  return { fill, size, partial: fill < size && f.volume(fill) !== f.volume(size) };
}

/**
 * One recipe line a mixing step lists.
 * @typedef {Object} MixLine
 * @property {string} key  The recipe item's key.
 * @property {string} name  Its label ("Maltodextrin", "Caffeine for gel 7 (100 mg tablets)").
 * @property {string} amount  Its amount for the step ("158 g", "0.5 tablets").
 * @property {string} tone  Its substance colour ({@link itemTone}).
 */

/**
 * One step of the mixing instructions.
 * @typedef {Object} MixStep
 * @property {'weigh'|'dissolve'|'fill'|'caffeine'|'add'|'shake'} key  Stable id of the step.
 * @property {string} title  Short heading ("Weigh the Ingredients").
 * @property {string} text  The instruction. When `lines` follow, it ends with a colon.
 * @property {MixLine[]} lines  Recipe lines listed under the text; may be empty.
 * @property {string} [listLabel]  Accessible name of the list of `lines` ("Gel ingredients").
 */

/**
 * Whether a section adds water: the rule of the recipe's water line
 * (`Math.round(ml) > 0`), so no step mentions water the recipe does not list.
 * @param {unknown} ml
 * @returns {boolean}
 */
const addsWater = (ml) => typeof ml === 'number' && Number.isFinite(ml) && Math.round(ml) > 0;

/**
 * The carbs and salts of a section.
 * @param {RecipeSection} section
 * @returns {RecipeItem[]}
 */
const ingredientsOf = (section) => section.items.filter((item) => item.kind === 'carb' || item.kind === 'salt');

/**
 * A recipe item as a step line, with its whole or per-serving amount.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {RecipeItem} item
 * @param {boolean} perServing
 * @returns {MixLine}
 */
const lineOf = (t, f, item, perServing) => ({
  key: item.key,
  name: itemLabel(t, item),
  amount: itemAmount(t, f, item, perServing ? 'perServing' : 'total'),
  tone: itemTone(item),
});

/**
 * "Divide the batch into 9 flasks of about 32 ml (42 g) each. Keep them
 * closed and cool until the start." (1 flask: "Fill the batch into 1 flask
 * …"), without the size when the gel volume is unknown.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {RecipeSection} section
 * @returns {string}
 */
function fillText(t, f, section) {
  const count = finite(section.servings);
  const plural = pluralOf(count);
  const { volumeMl, massG } = section.perServing ?? {};
  const hasVolume = typeof volumeMl === 'number' && Number.isFinite(volumeMl) && volumeMl > 0;
  const hasMass = hasVolume && typeof massG === 'number' && Number.isFinite(massG) && massG > 0;
  const variant = hasMass ? 'VolumeMass' : hasVolume ? 'Volume' : '';
  const fill = t(`ui-recipe.mix.fill.${plural}${variant}`, {
    count: f.number(count),
    volume: hasVolume ? formatAmount(t, f, volumeMl, 'ml') : null,
    mass: hasMass ? formatAmount(t, f, massG, 'g') : null,
  });
  const keep = t(plural === 'one' ? 'ui-recipe.mix.fill.keepOne' : 'ui-recipe.mix.fill.keepOther');
  return `${fill} ${keep}`;
}

/**
 * Steps for a gel batch: weigh the whole batch, dissolve the powders in the
 * warm added water (or in the syrups when no water is added), divide it into
 * the flasks, then stir caffeine tablets into their gels.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {RecipeSection} section
 * @returns {MixStep[]}
 */
function gelSteps(t, f, section) {
  const ingredients = ingredientsOf(section);
  const tablets = section.items.filter((item) => item.kind === 'caffeine');
  /** @type {MixStep[]} */
  const steps = [];
  if (ingredients.length > 0) {
    const waterMl = section.water?.totalMl;
    steps.push(
      {
        key: 'weigh',
        title: t('ui-recipe.mix.weigh.title'),
        text: t('ui-recipe.mix.weigh.text', { gels: countText(t, f, 'ui-recipe.servings.gels', section.servings) }),
        lines: ingredients.map((item) => lineOf(t, f, item, false)),
        listLabel: t('ui-recipe.mix.weigh.list'),
      },
      {
        key: 'dissolve',
        title: t('ui-recipe.mix.dissolve.title'),
        text: addsWater(waterMl)
          ? t('ui-recipe.mix.dissolve.water', { water: formatAmount(t, f, waterMl, 'ml') })
          : t('ui-recipe.mix.dissolve.noWater'),
        lines: [],
      },
      { key: 'fill', title: t('ui-recipe.mix.fill.title'), text: fillText(t, f, section), lines: [] },
    );
  }
  if (tablets.length > 0) {
    steps.push({
      key: 'caffeine',
      title: t('ui-recipe.mix.caffeine.title'),
      text: t('ui-recipe.mix.caffeine.text'),
      lines: tablets.map((item) => lineOf(t, f, item, false)),
      listLabel: t('ui-recipe.mix.caffeine.list'),
    });
  }
  return steps;
}

/**
 * Steps for the drink: what goes into each bottle, then fill to the mark and
 * shake. A bottle that is not filled to the top says so, when the fill mark
 * and the bottle size read differently in the unit system ({@link bottleFill}).
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {RecipeSection} section
 * @param {number} bottleMl  Bottle size from the inputs.
 * @returns {MixStep[]}
 */
function drinkSteps(t, f, section, bottleMl) {
  const ingredients = ingredientsOf(section);
  const { fill, size, partial } = bottleFill(f, section, bottleMl);
  const waterMl = section.water?.perServingMl;
  const bottles = countText(t, f, 'ui-recipe.servings.bottles', section.servings);
  const mark = formatAmount(t, f, fill, 'ml');
  /** @type {MixStep[]} */
  const steps = [];
  if (ingredients.length > 0) {
    steps.push({
      key: 'add',
      title: t('ui-recipe.mix.add.title'),
      text: t('ui-recipe.mix.add.text', { bottles }),
      lines: ingredients.map((item) => lineOf(t, f, item, true)),
      listLabel: t('ui-recipe.mix.add.list'),
    });
  }
  const sentences = [];
  if (ingredients.length === 0) sentences.push(t('ui-recipe.mix.shake.water', { bottles }));
  sentences.push(
    addsWater(waterMl)
      ? t('ui-recipe.mix.shake.addWater', { water: formatAmount(t, f, waterMl, 'ml'), mark })
      : t('ui-recipe.mix.shake.toMark', { mark }),
  );
  if (partial) sentences.push(t('ui-recipe.mix.shake.notFull', { bottle: f.volume(size) }));
  sentences.push(t('ui-recipe.mix.shake.shake'));
  steps.push({ key: 'shake', title: t('ui-recipe.mix.shake.title'), text: sentences.join(' '), lines: [] });
  return steps;
}

/**
 * Mixing steps for one recipe section, the same in the mixing dialog and
 * the print view.
 *
 * - Gel: weigh the whole batch (each line's whole amount), dissolve the
 *   powders in the warm added water and stir (no water when the recipe adds
 *   none: the syrups bring it), divide into N flasks of about X ml (Y g),
 *   then stir each caffeine tablet into its gel.
 * - Drink: per bottle add the powders (each line's per-bottle amount), add
 *   the water up to the fill mark, shake. A bottle that is not filled to the
 *   top says so.
 * - A section without servings (no gels, or no fluid for a drink) has no
 *   steps; its warnings say why.
 *
 * Water follows the recipe's water line: a step adds water only when the
 * recipe lists it (at least 0.5 ml), and writes it as that line does
 * ({@link formatAmount}, so a tiny amount reads "<0.1 fl oz", never
 * "0 fl oz"). Volumes follow the unit system; nutrients stay g and mg.
 *
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {RecipeSection} section
 * @param {number} bottleMl  Bottle size from the inputs (`inputs.format.bottleMl`).
 * @returns {MixStep[]}
 */
export function mixingSteps(t, f, section, bottleMl) {
  if (!(section?.servings > 0)) return [];
  return section.kind === 'drink' ? drinkSteps(t, f, section, bottleMl) : gelSteps(t, f, section);
}
