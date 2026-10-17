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

import { Coffee, CupSoda, Droplets, Flag, Play, Zap } from "lucide-react";
import Icon from "../ui/Icon";
import { cx, toneClasses } from "../ui/cx";

/**
 * Look of each schedule event type: the substance colour it is about (gels
 * carry the carbs, so glucose; drink sips and hydration are fluid;
 * bicarbonate is sodium; caffeine is caffeine; start and finish are
 * neutral) and its own icon shape. Bicarbonate has no icon in lucide, so it
 * shows an "Na" badge. Every event also shows its title, so the type never
 * depends on colour or shape alone.
 * @type {Readonly<Record<string, Readonly<{ tone: string, icon: import('react').ComponentType<any>|null }>>>}
 */
export const EVENT_LOOKS = Object.freeze({
  bicarb: Object.freeze({ tone: "sodium", icon: null }),
  caffeine: Object.freeze({ tone: "caffeine", icon: Coffee }),
  start: Object.freeze({ tone: "neutral", icon: Play }),
  fuel: Object.freeze({ tone: "glucose", icon: Zap }),
  drink: Object.freeze({ tone: "fluid", icon: CupSoda }),
  hydration: Object.freeze({ tone: "fluid", icon: Droplets }),
  finish: Object.freeze({ tone: "neutral", icon: Flag }),
});

/**
 * The look of an event type; unknown types look like the start.
 * @param {string} type
 */
export const eventLook = (type) => (Object.hasOwn(EVENT_LOOKS, type) ? EVENT_LOOKS[type] : EVENT_LOOKS.start);

/**
 * The round, decorative badge of a schedule event: its icon (or "Na") in
 * the substance colour on the soft tint, with a border in the same colour.
 * Hidden from assistive technology: the event title names the event.
 * @param {{ type: string, size?: 'sm'|'md', className?: string }} props
 *   `md` is 32 px (the list), `sm` 24 px (the table).
 */
export default function ScheduleEventIcon({ type, size = "md", className }) {
  const look = eventLook(type);
  const tone = toneClasses(look.tone);
  const small = size === "sm";
  return (
    <span
      aria-hidden="true"
      data-tone={look.tone}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full border",
        small ? "size-6" : "size-8",
        tone.soft,
        tone.text,
        tone.border,
        className,
      )}
    >
      {look.icon ? (
        <Icon icon={look.icon} size={small ? 14 : 16} />
      ) : (
        <span className="font-display text-caption font-bold leading-none">Na</span>
      )}
    </span>
  );
}
