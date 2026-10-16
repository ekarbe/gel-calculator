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
 * English text for message keys returned by `src/domain/sweat.js`.
 * Placeholders use `{name}` syntax.
 * @type {Record<string, string>}
 */
const sweat = {
  // resolveSweat: summary by source
  'sweat.why.preset':
    'You picked a sweat rate of {rateLph} L/h. Self-assessment is rough, so your real rate is likely {lo}–{hi} L/h.',
  'sweat.why.estimate':
    'Your estimated sweat rate is {rateLph} L/h. This rough estimate uses sex, intensity, temperature and humidity. Your real rate is likely {lo}–{hi} L/h.',

  // resolveSweat: details
  'sweat.why.sodium':
    'You picked a sweat sodium level of {sodiumMmolL} mmol/L. Most athletes fall in the 10–90 mmol/L range.',
  'sweat.why.variability':
    'Sweat rate and sweat sodium vary widely between athletes. To measure your own rate, weigh yourself before and after a 1 h session.',
};

export default sweat;
