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

import ScheduleEventIcon from "./ScheduleEventIcon";
import { useT } from "../../i18n/useT";
import { cx } from "../ui/cx";

/** @typedef {import('./scheduleText').ScheduleRow} ScheduleRow */

/**
 * A schedule time: the short form on screen ("T+20m", data face, tabular)
 * and the same time in words for screen readers ("20 minutes after the
 * start").
 * @param {{ row: ScheduleRow, className?: string }} props
 */
export function ScheduleTime({ row, className }) {
  return (
    <span className={cx("font-mono num whitespace-nowrap", className)}>
      <span aria-hidden="true">{row.time}</span>
      <span className="sr-only">{row.spokenTime}</span>
    </span>
  );
}

/**
 * The schedule as a list: one item per event with its time, its badge in
 * the substance colour, its title (a heading, so screen-reader users can
 * jump from event to event) and what to do. Each item has `data-type`.
 * The heading carries the time in words for assistive technology ("20
 * minutes after the start: Fuel"), so moving by heading says when each
 * event happens and the headings can be told apart; the short time in the
 * first column and the visible title are hidden from it, so nothing is
 * read twice.
 *
 * @param {{ rows: ScheduleRow[], labelledBy?: string, label?: string, headingLevel?: 3|4|5|6,
 *   className?: string }} props
 *   Name the list with `labelledBy` (the id of the panel heading) or `label`.
 */
export function ScheduleList({ rows, labelledBy, label, headingLevel = 3, className }) {
  const Heading = `h${Math.min(6, Math.max(3, headingLevel))}`;
  return (
    <ol
      role="list"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      className={cx("divide-y divide-line", className)}
    >
      {rows.map((row) => (
        <li
          key={row.key}
          data-type={row.type}
          className="grid grid-cols-[4.75rem_2rem_minmax(0,1fr)] items-start gap-x-3 py-3 first:pt-1 last:pb-1 sm:grid-cols-[5.5rem_2rem_minmax(0,1fr)]"
        >
          <span aria-hidden="true" className="font-mono num whitespace-nowrap pt-1.5 text-body-sm text-ink">
            {row.time}
          </span>
          <ScheduleEventIcon type={row.type} />
          <div className="min-w-0 pt-0.5">
            <Heading className="text-body font-semibold text-ink">
              <span className="sr-only">{row.spokenTitle || row.title}</span>
              <span aria-hidden="true">{row.title}</span>
            </Heading>
            <p className="mt-0.5 text-body-sm text-ink-2">{row.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * The schedule as a table: Time, Action (badge and title) and Details, one
 * row per event (`data-type`). The time cell is the row header (each event
 * is identified by its time), so a screen reader moving down a column hears
 * when each detail happens. The caption names the table (visually hidden:
 * the panel heading says the same). The details wrap (long words too), so
 * the table fits a 360 px screen without scrolling; the badges show from
 * 640 px.
 *
 * @param {{ rows: ScheduleRow[], caption: string, className?: string }} props
 */
export function ScheduleTable({ rows, caption, className }) {
  const t = useT();
  const head = "caption py-2 text-left align-bottom text-muted";
  return (
    <table className={cx("w-full border-collapse text-body-sm", className)}>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-line-strong">
          {/* Time and Action shrink to their content (w-px); Details takes the rest. */}
          <th scope="col" className={cx(head, "w-px whitespace-nowrap pr-3 sm:pr-6")}>
            {t("ui-schedule.table.time")}
          </th>
          <th scope="col" className={cx(head, "w-px whitespace-nowrap pr-3 sm:pr-6")}>
            {t("ui-schedule.table.action")}
          </th>
          <th scope="col" className={head}>
            {t("ui-schedule.table.details")}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} data-type={row.type} className="border-b border-line last:border-b-0">
            <th scope="row" className="py-2.5 pr-3 text-left align-top font-normal text-ink sm:pr-6">
              <ScheduleTime row={row} />
            </th>
            <td className="py-2.5 pr-3 align-top sm:pr-6">
              <span className="flex items-start gap-2">
                <span className="hidden sm:contents">
                  <ScheduleEventIcon type={row.type} size="sm" />
                </span>
                <span className="font-medium text-ink hyphens-auto">{row.title}</span>
              </span>
            </td>
            <td className="py-2.5 align-top text-ink-2 wrap-anywhere">{row.text}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
