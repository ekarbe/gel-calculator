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
 * Text of the printed plan (`PrintRecipe`) in the UI language and unit
 * system, from the `ui-print.*` catalog: the plan summary, the recipe
 * tables, the per-serving facts, the mixing steps as printed and the
 * references. Display only: every number comes from the plan; these
 * helpers pick, round and format it. No React. The recipe text every view
 * shares (amounts, names, osmolality, mixing steps) is in
 * `../recipe/recipeText.js`, the schedule text in
 * `../schedule/scheduleText.js`.
 */

import { CITATIONS, citationLabel, citationUrl } from '../../domain/evidence';
import { DEFICIT_HIGH_PCT, DEFICIT_MILD_PCT } from '../../domain/hydration';
import { roundTo } from '../../domain/units';
import { finite } from '../../i18n/formatters';
import { countText, pluralOf } from '../../i18n/plural';
import { deliveredRatio, formatAmount, mixingSteps, osmolalityText as recipeOsmolality } from '../recipe/recipeText';
import { bottlesText } from '../schedule/scheduleText';

/** @typedef {import('../../i18n/index').TranslateFn} TranslateFn */
/** @typedef {import('../../i18n/formatters').Formatters} Formatters */
/** @typedef {import('../../domain/plan').Plan} Plan */
/** @typedef {import('../../domain/recipe').RecipeSection} RecipeSection */
/** @typedef {import('../../domain/recipe').Osmolality} Osmolality */

/**
 * The name of a recipe section on paper: "Gel batch" or "Drink".
 * @param {TranslateFn} t
 * @param {RecipeSection} section
 * @returns {string}
 */
export function sectionTitle(t, section) {
  return t(section.kind === 'gel' ? 'ui-print.section.gel' : 'ui-print.section.drink');
}

/**
 * The servings of a section, worded to follow "Gel batch:" or "Drink:":
 * "9 gels", "3 bottles of 800 ml", "4 bottles, 600 ml each (750 ml
 * bottle)", or why there are none.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {RecipeSection} section
 * @param {number} bottleMl  Bottle size from the inputs.
 * @returns {string}
 */
export function servingsText(t, f, section, bottleMl) {
  const count = finite(section.servings);
  if (section.kind === 'gel') {
    return count > 0 ? countText(t, f, 'ui-recipe.servings.gels', count) : t('ui-print.servings.gelNone');
  }
  return bottlesText(t, f, section, bottleMl) ?? t('ui-print.servings.drinkNone');
}

/**
 * Heading of a section's whole-amount column: the whole batch, all bottles,
 * or (without servings) the whole activity.
 * @param {TranslateFn} t
 * @param {RecipeSection} section
 * @returns {string}
 */
export function amountsCaption(t, section) {
  if (!(section.servings > 0)) return t('ui-print.amounts.activity');
  return t(section.kind === 'gel' ? 'ui-print.amounts.batch' : 'ui-print.amounts.allBottles');
}

/**
 * Osmolality as printed: "≈ 310 mOsm/kg (isotonic)", rounded and marked as
 * on screen (`osmolalityText` of the shared recipe text: whole mOsm/kg,
 * from 1000 rounded to 100, gels from 1000 mOsm/kg "likely higher"). The
 * tonicity follows in lower case when the value has one. `null` without a
 * finite value above 0.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {Osmolality|null|undefined} osmolality
 * @param {'gel'|'drink'} kind
 * @returns {string|null}
 */
export function osmolalityText(t, f, osmolality, kind) {
  const shown = recipeOsmolality(t, f, osmolality, kind);
  if (!shown) return null;
  if (!osmolality?.tonicity) return shown.text;
  const tonicity = t(`concentration.tonicity.${osmolality.tonicity}`).toLocaleLowerCase(f.tag);
  return t('ui-print.osmo.withTonicity', { value: shown.text, tonicity });
}

/**
 * One mixing step as printed: the shared step (`mixingSteps` of the recipe
 * text, the same steps as the mixing dialog), its recipe lines written out
 * as text ("158 g Maltodextrin"; caffeine tablets "Caffeine for gel 7 (100 mg
 * tablets): 0.5 tablets").
 * @typedef {Omit<import('../recipe/recipeText').MixStep, 'lines'> & { lines: string[] }} PrintMixStep
 */

/**
 * The mixing steps of one recipe section as the print view lists them.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {RecipeSection} section
 * @param {number} bottleMl  Bottle size from the inputs (`inputs.format.bottleMl`).
 * @returns {PrintMixStep[]}
 */
export function printMixingSteps(t, f, section, bottleMl) {
  return mixingSteps(t, f, section, bottleMl).map((step) => ({
    ...step,
    lines: step.lines.map((line) =>
      step.key === 'caffeine'
        ? t('ui-print.mix.caffeine.line', { name: line.name, amount: line.amount })
        : t('ui-print.mix.line', { amount: line.amount, name: line.name }),
    ),
  }));
}

/**
 * The facts printed under a section's table: for gels the consistency and
 * carbohydrate share, then the mass, volume and carbs of each gel; for a
 * drink the carbs, strength and sodium of each bottle; then the osmolality.
 * Nothing for a section without servings.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {Plan} plan
 * @param {RecipeSection} section
 * @returns {string[]}
 */
export function sectionFacts(t, f, plan, section) {
  if (!(section.servings > 0)) return [];
  const per = section.perServing ?? {};
  const facts = [];
  if (section.kind === 'gel') {
    const gel = plan.concentration.gel;
    if (gel && Number.isFinite(gel.carbPct)) {
      facts.push(
        t('ui-print.fact.consistency', {
          consistency: t(`concentration.consistency.${gel.consistency}`),
          pct: Math.round(gel.carbPct),
        }),
      );
    }
    if (Number.isFinite(per.massG) && Number.isFinite(per.volumeMl)) {
      facts.push(
        t('ui-print.fact.eachGel', {
          mass: formatAmount(t, f, per.massG, 'g'),
          volume: formatAmount(t, f, per.volumeMl, 'ml'),
          carbs: formatAmount(t, f, per.carbsG, 'g'),
        }),
      );
    }
  }
  if (section.kind === 'drink' && Number.isFinite(per.carbPctWv)) {
    facts.push(
      t('ui-print.fact.eachBottle', {
        carbs: formatAmount(t, f, per.carbsG, 'g'),
        pct: roundTo(per.carbPctWv, 1),
        sodiumMg: f.number(per.sodiumMg),
        mgPerL: f.number(per.sodiumMgPerL),
      }),
    );
  }
  const osmolality = osmolalityText(t, f, section.osmolality, section.kind);
  if (osmolality) facts.push(t('ui-print.fact.osmolality', { value: osmolality }));
  return facts;
}

/**
 * Every citation the printed plan relies on, in order of first use: the
 * explanations of the recommendations it shows (sweat, carbs, ratio, sodium,
 * fluid, and the extras, caffeine and bicarbonate when they are on), then
 * the warnings' citations. Each id once.
 * @param {Plan} plan
 * @returns {string[]}
 */
export function planCitations(plan) {
  const inputs = plan.inputs;
  const extrasOn = inputs.extras.potassium || inputs.extras.magnesium || inputs.extras.calcium;
  const lists = [
    plan.sweat.why?.citations,
    plan.carbs.recommended.why?.citations,
    plan.carbs.ratio.recommended.why?.citations,
    plan.sodium.recommended.why?.citations,
    plan.fluid.recommended.why?.citations,
    extrasOn ? plan.extras.why?.citations : null,
    plan.caffeine.enabled ? plan.caffeine.why?.citations : null,
    plan.bicarb.enabled ? plan.bicarb.why?.citations : null,
    ...plan.warnings.map((warning) => warning.citations),
  ];
  const ids = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const id of list) if (typeof id === 'string' && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * One reference as printed: "Sawka MN et al. (2007). Title. Journal.
 * https://doi.org/…" (authors, title and journal as the study gives them).
 * Unknown ids print their label.
 * @param {TranslateFn} t
 * @param {string} id
 * @returns {string}
 */
export function referenceText(t, id) {
  const entry = Object.hasOwn(CITATIONS, id) ? CITATIONS[id] : null;
  if (!entry) return citationLabel(id);
  const url = citationUrl(id);
  const params = { authors: entry.authors, year: String(entry.year), title: entry.title, journal: entry.journal };
  return url ? t('ui-print.referenceWithUrl', { ...params, url }) : t('ui-print.reference', params);
}

/**
 * The projected body-mass change (`plan.hydration`) as printed: the change on
 * the scale, signed after rounding to one decimal ("−0.6 kg", "+1.2 lb",
 * "0 kg"); the water lost (or gained, when the plan drinks more than it
 * sweats) and its share of body mass, both without sign; and the level
 * ("Up to 2% loss"). A level the domain never returns counts as `ok`.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {Plan['hydration']} hydration
 * @returns {string}
 */
export function bodyMassText(t, f, hydration) {
  const levels = ['ok', 'mild', 'high', 'gain'];
  const level = levels.includes(hydration?.level) ? hydration.level : 'ok';
  const gain = level === 'gain';
  const water = t(gain ? 'ui-print.bodyMass.gained' : 'ui-print.bodyMass.lost', {
    waterL: roundTo(Math.abs(finite(hydration?.waterDeficitL)), 2),
    pct: roundTo(Math.abs(finite(hydration?.deficitPct)), 1),
  });
  const levelText = t(`ui-print.bodyMass.level.${level}`, {
    limit: level === 'high' ? DEFICIT_HIGH_PCT : DEFICIT_MILD_PCT,
    lo: DEFICIT_MILD_PCT,
    hi: DEFICIT_HIGH_PCT,
  });
  return t('ui-print.summary.bodyMass', {
    scale: f.mass(finite(hydration?.scaleChangeKg), { digits: 1, signed: true }),
    water,
    level: levelText,
  });
}

/**
 * The "Format" row: the gels (count and per hour) and/or the bottles of the
 * format the recipe uses.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {Plan} plan
 * @returns {string}
 */
function formatSummary(t, f, plan) {
  const count = finite(plan.gels.count);
  const gels =
    count > 0
      ? t(`ui-print.summary.gels.${pluralOf(count)}`, { count: f.number(count), perHour: f.number(plan.gels.perHour, 2) })
      : t('ui-print.summary.gels.none');
  const drinkSection = plan.recipe.sections.find((section) => section.kind === 'drink');
  const bottles = drinkSection
    ? servingsText(t, f, drinkSection, plan.inputs.format.bottleMl)
    : t('ui-print.summary.drink.none');
  if (plan.format.type === 'drink') return t('ui-print.summary.format.drink', { bottles });
  if (plan.format.type === 'both') return t('ui-print.summary.format.both', { gels, bottles });
  return t('ui-print.summary.format.gel', { gels });
}

/**
 * One row of the plan summary.
 * @typedef {{ id: string, term: string, value: string }} SummaryRow
 */

/**
 * The plan summary: activity, conditions, carbs, sodium, fluid, sweat rate,
 * body-mass change, format, caffeine and bicarbonate when they are on, and
 * energy. Quantities follow the unit system (temperature, fluid, sweat rate,
 * water and body mass); nutrients stay g and mg.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {Plan} plan
 * @returns {SummaryRow[]}
 */
export function summaryRows(t, f, plan) {
  const { inputs } = plan;
  const { event, environment } = inputs;
  const outdoor = event.setting === 'outdoor';
  const conditions = t(outdoor ? 'ui-print.summary.conditionsSun' : 'ui-print.summary.conditions', {
    setting: t(`ui-common.setting.${event.setting}`),
    // One decimal in °C, as the field shows it (a value typed in °F is stored exactly); °F rounds itself.
    tempC: t.unitSystem === 'metric' ? roundTo(finite(environment.tempC), 1) : finite(environment.tempC),
    humidity: environment.humidity,
    sun: t(`ui-print.sun.${environment.sun}`),
  });

  /** @type {SummaryRow[]} */
  const rows = [
    {
      id: 'activity',
      value: t('ui-print.summary.activity', {
        sport: t(`ui-common.sport.${event.sport}`),
        duration: f.duration(plan.durationMin),
        intensity: t(`ui-print.intensity.${event.intensity}`),
      }),
    },
    { id: 'conditions', value: conditions },
    {
      id: 'carbs',
      value: t('ui-print.summary.carbs', {
        gPerHour: f.number(plan.carbs.gPerHour),
        deliveredG: f.number(plan.carbs.deliveredG),
        ratio: deliveredRatio(plan),
      }),
    },
    {
      id: 'sodium',
      value: t('ui-print.summary.sodium', {
        mgPerHour: f.number(plan.sodium.mgPerHour),
        deliveredMg: f.number(plan.salts.delivered.Sodium),
      }),
    },
    {
      id: 'fluid',
      value: t('ui-print.summary.fluid', {
        mlPerHour: Math.round(finite(plan.fluid.mlPerHour)),
        totalMl: Math.round(finite(plan.fluid.totalMl)),
      }),
    },
    {
      id: 'sweat',
      value: t('ui-print.summary.sweat', {
        rateLph: roundTo(finite(plan.sweat.rateLph), 2),
        uncertaintyLph: roundTo(finite(plan.sweat.uncertaintyLph), 2),
        source: t(`ui-print.sweatSource.${plan.sweat.source}`),
      }),
    },
    { id: 'bodyMass', value: bodyMassText(t, f, plan.hydration) },
    { id: 'format', value: formatSummary(t, f, plan) },
  ].map((row) => ({ ...row, term: t(`ui-print.term.${row.id}`) }));

  if (plan.caffeine.enabled) {
    rows.push({
      id: 'caffeine',
      term: t('ui-print.term.caffeine'),
      value: t('ui-print.summary.caffeine', {
        totalMg: f.number(plan.caffeine.totalMg),
        mgPerKg: f.number(inputs.caffeine.mgPerKg, 1),
      }),
    });
  }
  if (plan.bicarb.enabled) {
    const time = plan.bicarb.timingMin?.recommended;
    const doseG = f.number(plan.bicarb.doseG, 1);
    rows.push({
      id: 'bicarb',
      term: t('ui-print.term.bicarb'),
      value: Number.isFinite(time)
        ? t('ui-print.summary.bicarb', { doseG, minutes: f.number(Math.abs(time)) })
        : t('ui-print.summary.bicarbNoTime', { doseG }),
    });
  }
  // The burn is an estimate, rounded to 10 kcal as every view shows it.
  rows.push({
    id: 'energy',
    term: t('ui-print.term.energy'),
    value: t('ui-print.summary.energy', {
      deliveredKcal: f.number(plan.energy.deliveredKcal),
      burnedKcal: f.number(Math.round(finite(plan.energy.expenditureKcal) / 10) * 10),
    }),
  });
  return rows;
}
