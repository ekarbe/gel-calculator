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
 * Helpers shared by the Sweat section's parts (`Sweat*.jsx`): display text
 * built from catalog keys (`ui-setup-sweat.*`) and the defaults of a new
 * sweat test (focus handling after an inline form or row goes away is
 * `../ui/useFocusAfterRender.js`). Display only: every sweat number comes
 * from the plan or from `sweatTestRate`.
 */

import { roundTo } from '../../domain/units';
import { MG_PER_MMOL } from '../../domain/electrolytes';

/** @typedef {import('../../i18n/index').TranslateFn} TranslateFn */
/** @typedef {import('../../domain/sweat').SweatTest} SweatTest */
/** @typedef {import('../../domain/sweat').SweatTestConditions} SweatTestConditions */

/**
 * A sweat test being typed in the form: the fields of a {@link SweatTest}
 * without the id, always in the plan's units (kg, L, min, km/h, °C).
 * @typedef {Omit<SweatTest, 'id'> & { date: string, label: string, conditions: Required<SweatTestConditions> }} SweatTestDraft
 */

/** The sweat sources, in tab order. */
export const SWEAT_SOURCES = Object.freeze(['test', 'estimate', 'preset']);

/** Duration of a new sweat test in minutes (the protocol's "about 60 min"). */
export const NEW_TEST_DURATION_MIN = 60;

/**
 * A rate in L/h rounded for display (the typed `volumeL` placeholder shows a
 * metric value as given, so it is rounded here: 2 decimals, like the domain).
 * @param {unknown} lph
 * @returns {number}
 */
export const rateForText = (lph) => roundTo(typeof lph === 'number' ? lph : 0, 2);

/**
 * Sweat sodium in whole mg/L from mmol/L.
 * @param {unknown} mmolL
 * @returns {number}
 */
export const sodiumMgPerL = (mmolL) => roundTo((typeof mmolL === 'number' ? mmolL : 0) * MG_PER_MMOL.Sodium, 0);

/**
 * Today's date as 'YYYY-MM-DD' in local time (the default date of a new test).
 * @param {Date} [now]
 * @returns {string}
 */
export function todayIso(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * The first free test id (`t1`, `t2`, …).
 * @param {ReadonlyArray<{ id: string }>} tests
 * @returns {string}
 */
export function freeTestId(tests) {
  const used = new Set(tests.map((test) => test.id));
  let n = 1;
  while (used.has(`t${n}`)) n += 1;
  return `t${n}`;
}

/**
 * The event and environment inputs as sweat test conditions.
 * @param {import('../../domain/plan').PlanInputs} inputs
 * @returns {Required<SweatTestConditions>}
 */
export function currentConditions(inputs) {
  const { event, environment } = inputs;
  return {
    sport: event.sport,
    speedKmh: event.speedKmh,
    powerW: event.powerW,
    mets: event.mets,
    setting: event.setting,
    tempC: environment.tempC,
    humidity: environment.humidity,
    sun: environment.sun,
  };
}

/**
 * The draft of a new sweat test: today, no masses yet, 60 min, in the
 * current event conditions.
 * @param {import('../../domain/plan').PlanInputs} inputs
 * @param {string} [date]  Default today.
 * @returns {SweatTestDraft}
 */
export function newTestDraft(inputs, date = todayIso()) {
  return {
    date,
    label: '',
    preKg: 0,
    postKg: 0,
    fluidL: 0,
    urineL: 0,
    durationMin: NEW_TEST_DURATION_MIN,
    conditions: currentConditions(inputs),
  };
}

/**
 * The name a sweat test is shown with: its label, else "Sweat test N".
 * @param {TranslateFn} t
 * @param {{ label?: string }} test
 * @param {number} index  Position in the list (0-based).
 * @returns {string}
 */
export function testName(t, test, index) {
  const label = typeof test?.label === 'string' ? test.label.trim() : '';
  return label || t('ui-setup-sweat.tests.defaultName', { number: index + 1 });
}

/**
 * Exercise conditions as one line ("Cycling at 30 km/h (about 158 W),
 * outdoors, 20 °C, 50% humidity, shade or overcast"), in the UI language and
 * units. The sun is named outdoors only, as the model uses it only there.
 * Speed and temperature go to their typed placeholders unrounded in
 * imperial, which rounds them in mph and °F: rounding to 0.1 °C first would
 * shift a typed 87 °F to "87.1 °F". In metric they are rounded to one
 * decimal here, as the fields show them.
 * @param {TranslateFn} t
 * @param {SweatTestConditions} c
 * @param {number} [derivedPowerW]  Cycling power the model derived from the speed, shown after it.
 * @returns {string}
 */
export function describeConditions(t, c, derivedPowerW) {
  const asShown = (value) => (t.unitSystem === 'imperial' ? Number(value) || 0 : roundTo(value ?? 0, 1));
  const speedKmh = asShown(c.speedKmh);
  let effort;
  if (c.sport === 'running') effort = t('ui-setup-sweat.conditions.running', { speedKmh });
  else if (c.sport === 'cycling' && (c.powerW ?? 0) > 0) {
    effort = t('ui-setup-sweat.conditions.cyclingPower', { powerW: roundTo(c.powerW, 0) });
  } else if (c.sport === 'cycling') {
    effort =
      typeof derivedPowerW === 'number' && derivedPowerW > 0
        ? t('ui-setup-sweat.conditions.cyclingSpeedPower', { speedKmh, powerW: roundTo(derivedPowerW, 0) })
        : t('ui-setup-sweat.conditions.cyclingSpeed', { speedKmh });
  } else effort = t('ui-setup-sweat.conditions.other', { mets: roundTo(c.mets ?? 0, 1) });
  const parts = [
    effort,
    t(`ui-setup-sweat.conditions.setting.${c.setting}`),
    t('ui-setup-sweat.conditions.temp', { tempC: asShown(c.tempC) }),
    t('ui-setup-sweat.conditions.humidity', { humidity: roundTo(c.humidity ?? 0, 0) }),
  ];
  if (c.setting === 'outdoor') parts.push(t(`ui-setup-sweat.conditions.sun.${c.sun}`));
  return parts.join(', ');
}
