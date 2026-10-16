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
 * Minutes after the start at which a gel is taken. The first gel is taken at
 * the start, then one every 60 / gelsPerHour minutes while the activity lasts.
 * The per-gel recipe divides the batch by the length of this list, so both
 * always agree.
 */
export function getGelTimes(durationMinutes, gelsPerHour) {
  if (!(gelsPerHour > 0) || !(durationMinutes >= 0)) return [];
  const interval = 60 / gelsPerHour;
  // Small epsilon so float drift (e.g. 7 gels/hr) never adds a gel at the finish line.
  const count = Math.max(1, Math.ceil(durationMinutes / interval - 1e-9));
  return Array.from({ length: count }, (_, i) => i * interval);
}

export function getGelCount(durationMinutes, gelsPerHour) {
  return getGelTimes(durationMinutes, gelsPerHour).length;
}

export function formatElapsed(minutes) {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours > 0) return `T+${hours}h${mins > 0 ? ` ${mins}m` : ""}`;
  return `T+${mins}m`;
}
