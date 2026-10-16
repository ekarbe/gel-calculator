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
 * Display labels shared by several cards.
 */

/** Intensity names (`event.intensity`). */
export const INTENSITY_LABELS = Object.freeze({
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
  race: "Race",
});

/** Heart-rate zones that go with each intensity, for the intensity picker. */
export const INTENSITY_ZONES = Object.freeze({
  easy: "Zone 1–2",
  moderate: "Zone 3",
  hard: "Zone 4",
  race: "Zone 4–5",
});

/** Sport names (`event.sport`, and the conditions of a sweat test). */
export const SPORT_LABELS = Object.freeze({
  running: "Running",
  cycling: "Cycling",
  other: "Other sport",
});

/** Where a session takes place (`event.setting`). */
export const SETTING_LABELS = Object.freeze({
  outdoor: "Outdoors",
  indoorFan: "Indoors with a fan",
  indoorNoFan: "Indoors without a fan",
});

/** Sunshine outdoors (`environment.sun`). */
export const SUN_LABELS = Object.freeze({
  none: "Shade or overcast",
  partly: "Partly sunny",
  full: "Full sun",
});
