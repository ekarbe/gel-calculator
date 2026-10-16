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

"use client";

import { useId, useSyncExternalStore } from "react";
import { aboutKcal, fmt, formatDuration } from "../shared/format";
import { INTENSITY_LABELS, SETTING_LABELS, SPORT_LABELS, SUN_LABELS } from "../shared/labels";
import { bodyMassText } from "../shared/bodyMass";
import { mixingSteps } from "../shared/mixing";
import {
  amountsCaption,
  countText,
  deliveredRatioText,
  osmolalityDisplay,
  recipeItemLabel,
  servingsText as servingsCount,
} from "../shared/recipe";
import { usePlan } from "../../state/PlanProvider";
import { useUi } from "../../state/UiProvider";
import { formatAmount } from "../../domain/recipe";
import { formatElapsed } from "../../domain/schedule";
import { CITATIONS, citationLabel, citationUrl } from "../../domain/evidence";
import { t } from "../../i18n";

/** @typedef {import('../../domain/plan').Plan} Plan */
/** @typedef {import('../../domain/recipe').RecipeSection} RecipeSection */
/** @typedef {import('../../domain/recipe').RecipeItem} RecipeItem */
/** @typedef {{ id: string, level: 'info'|'warning'|'danger', message: { key: string }, citations?: string[] }} Warning */

/** "October 16, 2026". */
const PRINT_DATE_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });

const SWEAT_SOURCE_LABELS = Object.freeze({
  test: "from your sweat test",
  estimate: "heat-balance estimate",
  preset: "self-assessed preset",
});
/** Section names in the printout ("Gel batch" reads better on paper than the card's "Gels"). */
const SECTION_TITLES = Object.freeze({ gel: "Gel batch", drink: "Drink" });

/** Visible level names, so a printed warning never depends on color. Same words as the on-screen warnings. */
const LEVEL_LABELS = Object.freeze({ danger: "Danger", warning: "Warning", info: "Note" });

/**
 * Calls `onChange` before the page is printed, so the printed date is
 * today's even when the page has been open for days.
 * @param {() => void} onChange
 * @returns {() => void}
 */
function subscribePrintDate(onChange) {
  window.addEventListener("beforeprint", onChange);
  return () => window.removeEventListener("beforeprint", onChange);
}

/** Today's date as printed. */
const printDateSnapshot = () => PRINT_DATE_FORMAT.format(new Date());

/** No date while rendering on the server (the static export has no "today"). */
const serverPrintDate = () => "";

/**
 * Osmolality as printed: "≈ 310 mOsm/kg (isotonic)", rounded as on screen
 * (`osmolalityDisplay`: gels from 1000 mOsm/kg rounded to 100 and marked
 * "likely higher"). `null` without a value.
 * @param {RecipeSection['osmolality']} osmolality
 * @param {'gel'|'drink'} kind
 * @returns {string|null}
 */
export function osmolalityText(osmolality, kind) {
  const shown = osmolalityDisplay(osmolality, kind);
  if (!shown) return null;
  const tonicity = osmolality.tonicity ? ` (${t(`concentration.tonicity.${osmolality.tonicity}`).toLowerCase()})` : "";
  return `${shown.text}${shown.likelyHigher ? ", likely higher" : ""}${tonicity}`;
}

/**
 * The servings of a section as text: "9 gels", "3 bottles of 800 ml",
 * "3 bottles, 800 ml each (950 ml bottle)" (as on screen), or why there are
 * none, worded to follow "Gel batch:" or "Drink:".
 * @param {RecipeSection} section
 * @param {number} bottleMl
 * @returns {string}
 */
function servingsText(section, bottleMl) {
  if (section.servings > 0) return servingsCount(section, bottleMl);
  return section.kind === "gel" ? "no gels planned" : "no bottles, because no fluid is planned";
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
    for (const id of list) if (typeof id === "string" && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * One reference as printed: "Sawka MN et al. (2007). Title. Journal.
 * https://doi.org/…". Unknown ids print their label.
 * @param {string} id
 * @returns {string}
 */
export function referenceText(id) {
  const entry = Object.hasOwn(CITATIONS, id) ? CITATIONS[id] : null;
  if (!entry) return citationLabel(id);
  const url = citationUrl(id);
  return `${entry.authors} (${entry.year}). ${entry.title}. ${entry.journal}.${url ? ` ${url}` : ""}`;
}

/**
 * Summary rows of the plan: what, how much per hour, and the totals.
 * @param {Plan} plan
 * @param {{ massUnit: 'kg'|'lb', tempUnit: 'C'|'F' }} units
 * @returns {Array<[string, string]>}
 */
function summaryRows(plan, { massUnit, tempUnit }) {
  const { inputs } = plan;
  const { event, environment } = inputs;
  const temp = tempUnit === "F" ? `${fmt((environment.tempC * 9) / 5 + 32)} °F` : `${fmt(environment.tempC)} °C`;
  const bodyMass = bodyMassText(plan.hydration, massUnit);
  // The sweat model uses the sun outdoors only, so indoors it is not a condition of this plan.
  const conditions = [SETTING_LABELS[event.setting] ?? event.setting, temp, `${fmt(environment.humidity)}% humidity`];
  if (event.setting === "outdoor") conditions.push((SUN_LABELS[environment.sun] ?? environment.sun).toLowerCase());

  const formatType = plan.format.type;
  const gels =
    plan.gels.count > 0
      ? `${countText(plan.gels.count, "gel", "gels")} (${fmt(plan.gels.perHour, 2)} per hour)`
      : "no gels";
  const drinkSection = plan.recipe.sections.find((section) => section.kind === "drink");
  const bottles = drinkSection ? servingsText(drinkSection, inputs.format.bottleMl) : "no drink";
  let format = `Gels: ${gels}`;
  if (formatType === "drink") format = `Drink: ${bottles}`;
  else if (formatType === "both") format = `Gels: ${gels}. Drink: ${bottles}`;

  /** @type {Array<[string, string]>} */
  const rows = [
    [
      "Activity",
      `${SPORT_LABELS[event.sport] ?? event.sport} · ${formatDuration(plan.durationMin)} · ${INTENSITY_LABELS[event.intensity] ?? event.intensity} intensity`,
    ],
    ["Conditions", conditions.join(" · ")],
    [
      "Carbohydrate",
      `${fmt(plan.carbs.gPerHour)} g/h · ${fmt(plan.carbs.deliveredG)} g in the recipe · glucose:fructose ${deliveredRatioText(plan)}`,
    ],
    ["Sodium", `${fmt(plan.sodium.mgPerHour)} mg/h · ${fmt(plan.salts.delivered.Sodium)} mg in the recipe`],
    ["Fluid", `${fmt(plan.fluid.mlPerHour)} ml/h · ${fmt(plan.fluid.totalMl)} ml in total`],
    [
      "Sweat rate",
      `${fmt(plan.sweat.rateLph, 2)} L/h ± ${fmt(plan.sweat.uncertaintyLph, 2)} (${SWEAT_SOURCE_LABELS[plan.sweat.source] ?? plan.sweat.source})`,
    ],
    [
      "Body mass",
      `About ${bodyMass.scale} on the scale after the activity · ${bodyMass.waterTerm} ${bodyMass.water} · ${bodyMass.label}`,
    ],
    ["Format", format],
  ];
  if (plan.caffeine.enabled) {
    rows.push(["Caffeine", `${fmt(plan.caffeine.totalMg)} mg in total (${fmt(inputs.caffeine.mgPerKg, 1)} mg/kg)`]);
  }
  if (plan.bicarb.enabled) {
    const time = plan.bicarb.timingMin?.recommended;
    rows.push([
      "Sodium bicarbonate",
      `${fmt(plan.bicarb.doseG, 1)} g${Number.isFinite(time) ? `, ${fmt(Math.abs(time))} min before the start` : ""}`,
    ]);
  }
  rows.push([
    "Energy",
    `${fmt(plan.energy.deliveredKcal)} kcal from carbohydrate · about ${aboutKcal(plan.energy.expenditureKcal)} kcal burned (estimate)`,
  ]);
  return rows;
}

/**
 * A heading for one block of the printout. It never ends a page on its own
 * (`break-after: avoid`): the block's first lines always follow it.
 * @param {{ id: string, children: import('react').ReactNode }} props
 */
function BlockHeading({ id, children }) {
  return (
    <h2 id={id} className="text-base font-bold mt-6 mb-2 pb-1 border-b border-gray-400 break-after-avoid">
      {children}
    </h2>
  );
}

/**
 * One recipe section as printed: servings, the ingredient table (whole
 * amount and per gel or bottle), the per-serving facts and the osmolality.
 * @param {{ section: RecipeSection, plan: Plan, index: number }} props
 */
function SectionTable({ section, plan, index }) {
  const hasServings = section.servings > 0;
  const title = SECTION_TITLES[section.kind] ?? section.kind;
  const gel = section.kind === "gel" ? plan.concentration.gel : null;
  const osmolality = hasServings ? osmolalityText(section.osmolality, section.kind) : null;
  const per = section.perServing ?? {};
  const facts = [];
  if (hasServings && section.kind === "gel") {
    if (gel && Number.isFinite(gel.carbPct)) {
      facts.push(`Consistency: ${t(`concentration.consistency.${gel.consistency}`)}, ${fmt(gel.carbPct)}% carbohydrate.`);
    }
    if (Number.isFinite(per.massG) && Number.isFinite(per.volumeMl)) {
      facts.push(
        `Each gel: about ${formatAmount(per.massG, "g")} (${formatAmount(per.volumeMl, "ml")}) with ${formatAmount(per.carbsG, "g")} carbohydrate.`,
      );
    }
  }
  if (hasServings && section.kind === "drink" && Number.isFinite(per.carbPctWv)) {
    facts.push(
      `Each bottle: ${formatAmount(per.carbsG, "g")} carbohydrate (${fmt(per.carbPctWv, 1)}% w/v) and ${fmt(per.sodiumMg)} mg sodium (${fmt(per.sodiumMgPerL)} mg/L).`,
    );
  }
  if (osmolality) facts.push(`Osmolality: ${osmolality}.`);

  return (
    <section aria-labelledby={`print-section-${index}`} data-kind={section.kind} className="break-inside-avoid mb-4">
      <h3 id={`print-section-${index}`} className="font-semibold mb-1">
        {title}: {servingsText(section, plan.inputs.format.bottleMl)}
      </h3>
      {section.items.length > 0 ? (
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{title} ingredients</caption>
          <thead>
            <tr className="border-b border-gray-400">
              <th scope="col" className="py-1 pr-3 font-semibold">
                Ingredient
              </th>
              <th scope="col" className="py-1 pr-3 font-semibold text-right">
                {amountsCaption(section, "total")}
              </th>
              {hasServings && (
                <th scope="col" className="py-1 font-semibold text-right">
                  {t(section.servingLabelKey)}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {section.items.map((item) => (
              <tr key={item.key} data-kind={item.kind} className="border-b border-gray-200 break-inside-avoid">
                <th scope="row" className="py-1 pr-3 font-normal">
                  {recipeItemLabel(item)}
                </th>
                <td className="py-1 pr-3 text-right tabular-nums">{item.display}</td>
                {hasServings && <td className="py-1 text-right tabular-nums">{item.perServingDisplay}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Nothing to mix.</p>
      )}
      {facts.length > 0 && (
        <ul className="mt-1 text-gray-700">
          {facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The mixing steps of one recipe section (`mixingSteps`, the same steps as
 * the mixing modal) as a numbered list: each step's title and text, then the
 * recipe lines it lists. A section without steps (a drink without fluid)
 * prints its warnings, which say why there is nothing to mix.
 * @param {{ section: RecipeSection, bottleMl: number, showTitle: boolean }} props
 */
function MixingBlock({ section, bottleMl, showTitle }) {
  const title = SECTION_TITLES[section.kind] ?? section.kind;
  const steps = mixingSteps(section, bottleMl);
  return (
    <div data-kind={section.kind} className="mb-3">
      {showTitle && <h3 className="font-semibold mb-1">{title}</h3>}
      {steps.length > 0 ? (
        <ol aria-label={`${title} steps`} className="list-decimal pl-5 space-y-0.5">
          {steps.map((step) => (
            <li key={step.key}>
              <span className="font-semibold">{step.title}.</span> {step.text}
              {step.lines.length > 0 && (
                <ul aria-label={step.listLabel ?? step.title} className="list-disc pl-5">
                  {step.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p>
          {section.warnings.length > 0
            ? section.warnings.map((warning) => t(warning.message)).join(" ")
            : "Nothing to mix for this plan."}
        </p>
      )}
    </div>
  );
}

/**
 * The plan as a printable page. It is hidden on screen (`hidden
 * print:block`) and replaces the app when printing, while the app content
 * is `print:hidden` (see `src/app/app.jsx`). "Print / save as PDF" in the
 * recipe card calls `window.print()`.
 *
 * Contents, all from `usePlan()`: a title and the date of printing; a plan
 * summary (activity, conditions, carbs, sodium, fluid, sweat rate, body-mass
 * change, format, caffeine and bicarbonate when on, energy); every recipe
 * section with its ingredients in total and per gel or bottle, the gel
 * consistency, per-serving facts and the osmolality; mixing steps per
 * section (and the mouth rinse protocol when the plan has one); the schedule
 * as a table; every plan warning with its level written out; and the full
 * references of the studies the plan cites.
 *
 * Black on white whatever the theme. The date is today's date, read when the
 * page renders on the client and again just before printing (`beforeprint`);
 * the static server render has none. Temperatures and body mass follow the
 * display units in `useUi()`.
 */
export default function PrintRecipe() {
  const plan = usePlan();
  const { massUnit, tempUnit } = useUi();
  const printedOn = useSyncExternalStore(subscribePrintDate, printDateSnapshot, serverPrintDate);
  const titleId = useId();
  const sections = plan.recipe.sections;
  const rinse = plan.carbs.mouthRinseHowTo;
  const citations = planCitations(plan);

  return (
    <section
      aria-labelledby={titleId}
      data-testid="print-recipe"
      className="hidden print:block bg-white text-black text-sm leading-snug font-sans"
    >
      <div className="flex items-baseline justify-between gap-4 border-b-2 border-black pb-2">
        <h1 id={titleId} className="text-2xl font-bold">
          Gel-Calculator fuel plan
        </h1>
        {printedOn && <p data-testid="print-date">Printed on {printedOn}</p>}
      </div>

      <section aria-labelledby="print-summary">
        <BlockHeading id="print-summary">Plan summary</BlockHeading>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
          {summaryRows(plan, { massUnit, tempUnit }).map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="font-semibold">{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="print-recipe-heading">
        <BlockHeading id="print-recipe-heading">Recipe</BlockHeading>
        {sections.map((section, index) => (
          <SectionTable key={section.kind} section={section} plan={plan} index={index} />
        ))}
      </section>

      <section aria-labelledby="print-mixing" className="break-inside-avoid">
        <BlockHeading id="print-mixing">Mixing</BlockHeading>
        {sections.map((section) => (
          <MixingBlock
            key={section.kind}
            section={section}
            bottleMl={plan.inputs.format.bottleMl}
            showTitle={sections.length > 1}
          />
        ))}
        {rinse && (
          <p data-testid="print-mouth-rinse">
            <span className="font-semibold">Mouth rinse option.</span> {t(rinse.summary)}
          </p>
        )}
      </section>

      <section aria-labelledby="print-schedule">
        <BlockHeading id="print-schedule">Schedule</BlockHeading>
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Race-day schedule</caption>
          <thead>
            <tr className="border-b border-gray-400">
              <th scope="col" className="py-1 pr-3 font-semibold">
                Time
              </th>
              <th scope="col" className="py-1 pr-3 font-semibold">
                Action
              </th>
              <th scope="col" className="py-1 font-semibold">
                Details
              </th>
            </tr>
          </thead>
          <tbody>
            {plan.schedule.map((event, index) => (
              <tr
                key={`${event.type}-${event.timeMin}-${index}`}
                data-type={event.type}
                className="border-b border-gray-200 break-inside-avoid"
              >
                <td className="py-1 pr-3 whitespace-nowrap tabular-nums">{formatElapsed(event.timeMin)}</td>
                <td className="py-1 pr-3 whitespace-nowrap">{t(`schedule.title.${event.type}`)}</td>
                <td className="py-1">{t(event.message)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="print-warnings">
        <BlockHeading id="print-warnings">Warnings and notes</BlockHeading>
        {plan.warnings.length > 0 ? (
          <ul aria-label="Printed warnings" className="space-y-1">
            {plan.warnings.map((warning) => {
              const level = Object.hasOwn(LEVEL_LABELS, warning.level) ? warning.level : "info";
              const sources = Array.isArray(warning.citations) ? [...new Set(warning.citations)] : [];
              return (
                <li key={warning.id} data-level={level} className="break-inside-avoid">
                  <span className="font-semibold">{LEVEL_LABELS[level]}:</span> {t(warning.message)}
                  {sources.length > 0 && <span className="text-gray-700"> ({sources.map(citationLabel).join("; ")})</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>None for this plan.</p>
        )}
      </section>

      {citations.length > 0 && (
        <section aria-labelledby="print-sources">
          <BlockHeading id="print-sources">Sources</BlockHeading>
          <ol aria-label="References" className="list-decimal pl-5 space-y-0.5 text-xs">
            {citations.map((id) => (
              <li key={id} data-citation={id} className="break-inside-avoid">
                {referenceText(id)}
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="mt-6 pt-2 border-t border-gray-400 text-xs text-gray-700">
        Made with Gel-Calculator (eikekarbe.com/gel-calculator). This plan is general guidance, not medical advice. Try
        it in training before you race with it.
      </p>
    </section>
  );
}
