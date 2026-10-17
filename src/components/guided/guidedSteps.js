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
 * The guided flow's structure (design doc, "Guided mode"): four steps, each
 * made of one or more screens, one question group per screen. Step 2 (Body
 * & weather) has two: the body and weather fields, then the sweat test
 * question. A position is `{ step, part }`: the step index (the UI prefs'
 * `guidedStep`, 0–3) and the screen within it. No React.
 */

/** @typedef {'event'|'conditions'|'sweat'|'pantry'|'board'} GuidedScreenId */
/** @typedef {{ id: string, screens: ReadonlyArray<GuidedScreenId> }} GuidedStep */
/** @typedef {{ step: number, part: number }} GuidedPosition */

/**
 * The steps in order, with their screens. Step ids name the
 * `ui-guided.step.<id>` text; screen ids the `ui-guided.<screen>.*` texts.
 * As many steps as the prefs allow (`GUIDED_STEP_COUNT`; a test checks it).
 * @type {ReadonlyArray<GuidedStep>}
 */
export const GUIDED_STEPS = Object.freeze([
  Object.freeze({ id: 'event', screens: Object.freeze(/** @type {GuidedScreenId[]} */ (['event'])) }),
  Object.freeze({ id: 'bodyWeather', screens: Object.freeze(/** @type {GuidedScreenId[]} */ (['conditions', 'sweat'])) }),
  Object.freeze({ id: 'ingredients', screens: Object.freeze(/** @type {GuidedScreenId[]} */ (['pantry'])) }),
  Object.freeze({ id: 'plan', screens: Object.freeze(/** @type {GuidedScreenId[]} */ (['board'])) }),
]);

/** Every screen in order. */
export const GUIDED_SCREENS = Object.freeze(GUIDED_STEPS.flatMap((step) => step.screens));

/**
 * A step index clamped to the steps (non-finite → 0).
 * @param {unknown} step
 * @returns {number}
 */
export function clampStep(step) {
  const n = typeof step === 'number' && Number.isFinite(step) ? Math.round(step) : 0;
  return Math.min(GUIDED_STEPS.length - 1, Math.max(0, n));
}

/**
 * A position with both parts in range: the step clamped, the part clamped
 * to that step's screens (non-finite → 0).
 * @param {unknown} step
 * @param {unknown} [part]
 * @returns {GuidedPosition}
 */
export function clampPosition(step, part = 0) {
  const s = clampStep(step);
  const count = GUIDED_STEPS[s].screens.length;
  const p = typeof part === 'number' && Number.isFinite(part) ? Math.round(part) : 0;
  return { step: s, part: Math.min(count - 1, Math.max(0, p)) };
}

/**
 * The screen at a position.
 * @param {number} step
 * @param {number} [part]
 * @returns {GuidedScreenId}
 */
export function screenAt(step, part = 0) {
  const position = clampPosition(step, part);
  return GUIDED_STEPS[position.step].screens[position.part];
}

/**
 * The position of a screen by its id, or `null` for an unknown id.
 * @param {unknown} screen
 * @returns {GuidedPosition|null}
 */
export function positionOfScreen(screen) {
  for (let step = 0; step < GUIDED_STEPS.length; step += 1) {
    const part = GUIDED_STEPS[step].screens.indexOf(/** @type {GuidedScreenId} */ (screen));
    if (part >= 0) return { step, part };
  }
  return null;
}

/**
 * The index of a position among all screens (0 to `GUIDED_SCREENS.length − 1`).
 * @param {number} step
 * @param {number} [part]
 * @returns {number}
 */
export function screenIndex(step, part = 0) {
  const position = clampPosition(step, part);
  let index = 0;
  for (let s = 0; s < position.step; s += 1) index += GUIDED_STEPS[s].screens.length;
  return index + position.part;
}

/**
 * The position of a screen index (clamped to the screens).
 * @param {number} index
 * @returns {GuidedPosition}
 */
function positionOf(index) {
  let rest = Math.min(GUIDED_SCREENS.length - 1, Math.max(0, index));
  for (let step = 0; step < GUIDED_STEPS.length; step += 1) {
    const count = GUIDED_STEPS[step].screens.length;
    if (rest < count) return { step, part: rest };
    rest -= count;
  }
  return { step: GUIDED_STEPS.length - 1, part: 0 };
}

/**
 * The next screen's position, or `null` on the last screen.
 * @param {number} step
 * @param {number} [part]
 * @returns {GuidedPosition|null}
 */
export function nextPosition(step, part = 0) {
  const index = screenIndex(step, part);
  return index >= GUIDED_SCREENS.length - 1 ? null : positionOf(index + 1);
}

/**
 * The previous screen's position (the last screen of the step before when
 * this is a step's first screen), or `null` on the first screen.
 * @param {number} step
 * @param {number} [part]
 * @returns {GuidedPosition|null}
 */
export function previousPosition(step, part = 0) {
  const index = screenIndex(step, part);
  return index <= 0 ? null : positionOf(index - 1);
}

/**
 * How much of a step's progress-bar segment is filled at a position: steps
 * before it full, steps after it empty, the current step by the share of
 * its screens reached (step 2 is half full on its first screen).
 * @param {number} step  The current step.
 * @param {number} part  The current screen within it.
 * @param {number} segment  The step whose segment is drawn.
 * @returns {number}  0–1.
 */
export function segmentFill(step, part, segment) {
  const position = clampPosition(step, part);
  if (segment < position.step) return 1;
  if (segment > position.step) return 0;
  return (position.part + 1) / GUIDED_STEPS[position.step].screens.length;
}
