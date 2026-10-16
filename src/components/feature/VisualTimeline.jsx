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

import { useId, useState } from "react";
import { Clock, Droplets, Zap, Coffee, CheckCircle2, List, Table, Info } from "lucide-react";
import Card from "../shared/Card";
import Warnings from "../shared/Warnings";
import { CitationLinks } from "../shared/Why";
import { fmt } from "../shared/format";
import { usePlan } from "../../state/PlanProvider";
import { formatElapsed } from "../../domain/schedule";
import { t } from "../../i18n";

/** @typedef {import('../../domain/schedule').ScheduleEvent} ScheduleEvent */

/**
 * Look of each schedule event type: the ring color and the icon. Bicarbonate
 * uses the "Na" text badge instead of an icon.
 */
const EVENT_STYLES = {
  bicarb: { color: "text-apple-purple border-apple-purple/40", Icon: null },
  caffeine: { color: "text-apple-amber border-apple-amber/40", Icon: Coffee },
  start: { color: "text-text-secondary border-card-border", Icon: Clock },
  fuel: { color: "text-apple-blue border-apple-blue/40", Icon: Zap },
  hydration: { color: "text-apple-teal border-apple-teal/40", Icon: Droplets },
  finish: { color: "text-apple-green border-apple-green/40", Icon: CheckCircle2 },
};

/**
 * Style for an event type; unknown types look like the start event.
 * @param {string} type
 */
const styleFor = (type) => EVENT_STYLES[type] ?? EVENT_STYLES.start;

/**
 * The icon inside an event's ring (decorative; the title names the event).
 * @param {{ type: string }} props
 */
function EventIcon({ type }) {
  const { Icon } = styleFor(type);
  if (!Icon) {
    return (
      <span aria-hidden="true" className="font-black text-[10px]">
        Na
      </span>
    );
  }
  return <Icon size={16} aria-hidden="true" />;
}

/**
 * Race-day schedule: every event of `plan.schedule` (bicarbonate, pre-race
 * caffeine, start, each gel with its fluid and caffeine, hydration, finish)
 * as a timeline or a table, followed by the fluid advice.
 *
 * Times use `formatElapsed` (`T−1h 30m`, `T+20m`). Event titles and
 * descriptions are domain messages rendered with `t()`. The fluid advice shows
 * the fluid recommendation's explanation (or, for a manual target, the chosen
 * and recommended values), the drink-to-thirst hint when it applies, the
 * citations and any fluid warnings. It is hidden when no fluid is planned.
 */
const VisualTimeline = () => {
  const plan = usePlan();
  const [viewMode, setViewMode] = useState("timeline"); // 'timeline' | 'table'
  const headingId = useId();

  /** @type {ScheduleEvent[]} */
  const events = plan.schedule;
  const { fluid } = plan;
  const fluidRec = fluid.recommended;
  const fluidDetails = Array.isArray(fluidRec.why?.details) ? fluidRec.why.details : [];

  const rows = events.map((event, index) => ({
    key: `${event.type}-${event.timeMin}-${index}`,
    type: event.type,
    time: formatElapsed(event.timeMin),
    title: t(`schedule.title.${event.type}`),
    desc: t(event.message),
    color: styleFor(event.type).color,
  }));

  const toggleClass = (active) =>
    `p-1.5 rounded-md transition-colors ${active ? "bg-card text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`;

  return (
    <Card>
      <section aria-labelledby={headingId}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 id={headingId} className="text-lg font-bold text-text-primary">
              Execution Schedule
            </h2>
            <p className="text-sm text-text-secondary">Your personalized strategy</p>
          </div>
          <div role="group" aria-label="Schedule view" className="flex bg-card-border/50 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              className={toggleClass(viewMode === "timeline")}
              title="Timeline View"
              aria-label="Timeline view"
              aria-pressed={viewMode === "timeline"}
            >
              <List size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={toggleClass(viewMode === "table")}
              title="Table View"
              aria-label="Table view"
              aria-pressed={viewMode === "table"}
            >
              <Table size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {viewMode === "timeline" ? (
          <ol aria-label="Schedule" className="relative border-l-2 border-card-border ml-4 pl-6 space-y-8 mt-4">
            {rows.map((row) => (
              <li key={row.key} data-type={row.type} className="relative">
                <div
                  className={`absolute -left-[37px] top-1 w-8 h-8 rounded-full border-2 bg-modal flex items-center justify-center ${row.color}`}
                >
                  <EventIcon type={row.type} />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-1">
                    {row.time}
                  </span>
                  <h3 className="text-base font-bold text-text-primary">{row.title}</h3>
                  <p className="text-sm text-text-secondary mt-1">{row.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <caption className="sr-only">Schedule</caption>
              <thead>
                <tr className="border-b border-card-border">
                  <th scope="col" className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-text-secondary">
                    Time
                  </th>
                  <th scope="col" className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-text-secondary">
                    Action
                  </th>
                  <th scope="col" className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-text-secondary">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.key}
                    data-type={row.type}
                    className="border-b border-card-border/50 hover:bg-card-border/20 transition-colors"
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-sm font-bold text-text-primary">{row.time}</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center border bg-modal ${row.color}`}>
                        {/* Scale icon down slightly for table */}
                        <div className="scale-75">
                          <EventIcon type={row.type} />
                        </div>
                      </div>
                      <span className="text-sm font-medium text-text-primary">{row.title}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-text-secondary min-w-[200px]">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {fluid.mlPerHour > 0 && (
          <section aria-label="Fluid advice" className="mt-6 space-y-3">
            <div className="text-xs text-text-secondary flex gap-2 items-start">
              <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div className="space-y-1">
                <p>
                  {fluid.mode === "manual"
                    ? `You set your own fluid target of ${fmt(fluid.mlPerHour)} ml/h. The recommendation is ${fmt(fluidRec.mlPerHour)} ml/h.`
                    : t(fluidRec.why?.summary)}
                </p>
                {fluidDetails.map((detail, index) => (
                  <p key={`${detail?.key}-${index}`}>{t(detail)}</p>
                ))}
                <CitationLinks ids={fluidRec.why?.citations} />
              </div>
            </div>
            <Warnings warnings={fluid.warnings} />
          </section>
        )}
      </section>
    </Card>
  );
};

export default VisualTimeline;
