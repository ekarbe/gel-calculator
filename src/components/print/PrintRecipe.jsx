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

import { useCallback, useId, useMemo, useSyncExternalStore } from "react";
import { BlockHeading, MixingBlock, PRINT_TH, SectionTable } from "./PrintSections";
import { planCitations, referenceText, summaryRows } from "./printText";
import { elapsedText } from "../schedule/scheduleText";
import { usePlan } from "../../state/PlanProvider";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { citationLabel } from "../../domain/evidence";

/** Warning levels, each written out on paper (`ui-common.level.*`), so a printed warning never depends on colour. */
const LEVELS = Object.freeze(["danger", "warning", "info"]);

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

/** No date while rendering on the server (the static export has no "today"). */
const serverPrintDate = () => "";

/**
 * The plan as a printable page, in the UI language and units. The shell
 * renders it in its print host (`hidden print:block`), which replaces the
 * app when printing while the app content is `print:hidden`; the board's
 * Print action calls `window.print()`.
 *
 * Contents, all from `usePlan()`: a title (`h1`: the printed page has no
 * other) and the date of printing; a plan summary (activity, conditions,
 * carbs, sodium, fluid, sweat rate, body-mass change, format, caffeine and
 * bicarbonate when on, energy); every recipe section with its ingredients in
 * total and per gel or bottle, the gel consistency, per-serving facts and
 * the osmolality; mixing steps per section (and the mouth rinse protocol
 * when the plan has one); the schedule as a table; every plan warning with
 * its level written out; the full references of the studies the plan
 * cites; and the disclaimer.
 *
 * Styled with the design tokens, which the print styles in `globals.css`
 * flatten to black on white in both themes, so nothing depends on colour:
 * levels are words, amounts sit in tables. Each block keeps its heading
 * with its first lines, and rows and steps do not split across pages. The
 * date is today's, read when the page renders on the client and again just
 * before printing (`beforeprint`); the static server render has none.
 * Quantities follow the unit system (temperature, fluid, water, body mass);
 * nutrients stay g and mg.
 */
export default function PrintRecipe() {
  const t = useT();
  const f = useFormat();
  const plan = usePlan();
  const baseId = useId();
  const id = (name) => `${baseId}-${name}`;
  const getPrintDate = useCallback(() => f.date(new Date(), { dateStyle: "long" }), [f]);
  const printedOn = useSyncExternalStore(subscribePrintDate, getPrintDate, serverPrintDate);
  const summary = useMemo(() => summaryRows(t, f, plan), [t, f, plan]);
  const citations = useMemo(() => planCitations(plan), [plan]);
  const sections = plan.recipe.sections;
  const bottleMl = plan.inputs.format.bottleMl;
  const rinse = plan.carbs.mouthRinseHowTo;

  return (
    <section
      aria-labelledby={id("title")}
      data-testid="print-recipe"
      className="mx-auto max-w-[190mm] bg-surface font-sans text-body-sm text-ink"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 border-b-2 border-ink pb-2">
        <h1 id={id("title")} className="display-section text-ink">
          {t("ui-print.title")}
        </h1>
        {printedOn ? (
          <p data-testid="print-date" className="text-caption text-muted">
            {t("ui-print.printedOn", { date: printedOn })}
          </p>
        ) : null}
      </div>

      <section aria-labelledby={id("summary")}>
        <BlockHeading id={id("summary")}>{t("ui-print.block.summary")}</BlockHeading>
        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1">
          {summary.map((row) => (
            <div key={row.id} data-row={row.id} className="contents">
              <dt className="font-semibold">{row.term}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby={id("recipe")}>
        <BlockHeading id={id("recipe")}>{t("ui-print.block.recipe")}</BlockHeading>
        {sections.map((section) => (
          <SectionTable key={section.kind} section={section} plan={plan} />
        ))}
      </section>

      <section aria-labelledby={id("mixing")} className="break-inside-avoid">
        <BlockHeading id={id("mixing")}>{t("ui-print.block.mixing")}</BlockHeading>
        {sections.map((section) => (
          <MixingBlock key={section.kind} section={section} bottleMl={bottleMl} showTitle={sections.length > 1} />
        ))}
        {rinse ? (
          <p data-testid="print-mouth-rinse">
            <span className="font-semibold">{t("ui-print.mix.rinse")}</span> {t(rinse.summary)}
          </p>
        ) : null}
      </section>

      <section aria-labelledby={id("schedule")}>
        <BlockHeading id={id("schedule")}>{t("ui-print.block.schedule")}</BlockHeading>
        <table className="w-full border-collapse">
          <caption className="sr-only">{t("ui-print.schedule.caption")}</caption>
          <thead>
            <tr className="border-b border-line-strong">
              <th scope="col" className={PRINT_TH}>
                {t("ui-schedule.table.time")}
              </th>
              <th scope="col" className={PRINT_TH}>
                {t("ui-schedule.table.action")}
              </th>
              <th scope="col" className={PRINT_TH}>
                {t("ui-schedule.table.details")}
              </th>
            </tr>
          </thead>
          <tbody>
            {plan.schedule.map((event, index) => (
              <tr
                key={`${event.type}-${event.timeMin}-${index}`}
                data-type={event.type}
                className="border-b border-line align-top break-inside-avoid"
              >
                <th scope="row" className="whitespace-nowrap py-1 pr-3 text-left font-mono font-normal">
                  {elapsedText(t, f, event.timeMin)}
                </th>
                <td className="whitespace-nowrap py-1 pr-3 font-semibold">{t(`schedule.title.${event.type}`)}</td>
                <td className="py-1">{t(event.message)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby={id("warnings")}>
        <BlockHeading id={id("warnings")}>{t("ui-print.block.warnings")}</BlockHeading>
        {plan.warnings.length > 0 ? (
          <ul aria-label={t("ui-print.warnings.list")} className="space-y-1">
            {plan.warnings.map((warning) => {
              const level = LEVELS.includes(warning.level) ? warning.level : "info";
              const sources = Array.isArray(warning.citations) ? [...new Set(warning.citations)] : [];
              return (
                <li key={warning.id} data-level={level} className="break-inside-avoid">
                  <span className="font-semibold">{t(`ui-common.level.${level}`)}:</span> {t(warning.message)}
                  {sources.length > 0 ? <span className="text-ink-2"> ({sources.map(citationLabel).join("; ")})</span> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>{t("ui-print.warnings.none")}</p>
        )}
      </section>

      {citations.length > 0 ? (
        <section aria-labelledby={id("sources")}>
          <BlockHeading id={id("sources")}>{t("ui-print.block.sources")}</BlockHeading>
          <ol aria-label={t("ui-print.references")} className="list-decimal space-y-0.5 pl-5 text-caption">
            {citations.map((citation) => (
              <li key={citation} data-citation={citation} className="break-inside-avoid">
                {referenceText(t, citation)}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <p className="mt-6 border-t border-line-strong pt-2 text-caption text-ink-2">{t("ui-print.footer")}</p>
    </section>
  );
}
