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
 * English text for message keys returned by `src/domain/hydration.js`
 * (`recommendFluid`, `fluidWarnings`, `projectBodyMass`).
 * Placeholders use `{name}` or typed `{name:type}` syntax (`src/i18n/index.js`).
 * @type {Record<string, string>}
 */
const fluid = {
  // recommendFluid
  'fluid.why.plan':
    'Drink about {mlPerHour:volume}/h. This replaces roughly {sharePct:percent} of your sweat loss of {sweatMlPerHour:volume}/h, capped at {maxMlPerHour:volume}/h. Drinking less than you sweat avoids weight gain.',
  'fluid.why.thirst':
    'For events under 90 min or in cool weather, drinking to thirst works well. Use the plan as a rough guide.',

  // Warnings
  'fluid.warn.aboveSweat':
    'You plan to drink {mlPerHour:volume}/h. That is more than you sweat ({sweatMlPerHour:volume}/h). Weight gain during exercise can cause hyponatremia, a dangerous drop in blood sodium. Drink less than you sweat.',
  'fluid.warn.aboveCeiling':
    'You plan to drink {mlPerHour:volume}/h. Guidelines suggest up to {maxMlPerHour:volume}/h. Larger amounts can upset your stomach.',

  // projectBodyMass
  'fluid.warn.projectedGain':
    'With this plan you would drink about {gainL:volumeL} more than you sweat. Weight gain during exercise can cause hyponatremia, a dangerous drop in blood sodium. Drink less.',
  'fluid.warn.deficitHigh':
    'With this plan you would lose about {deficitL:volumeL} of water, {deficitPct:percent} of your body mass. Losses above {limitPct:percent} hurt performance and heat tolerance. Drink more if your stomach allows it, and plan your refills.',
  'fluid.warn.deficitMild':
    'With this plan you would lose about {deficitL:volumeL} of water, {deficitPct:percent} of your body mass. Losses above {limitPct:percent} can start to hurt performance, mostly in the heat.',
};

export default fluid;
