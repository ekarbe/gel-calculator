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

/*
 * Test helpers for the guided flow: the real providers (autosave off), a
 * probe that hands the latest inputs, plan and UI state to the test, and
 * small queries. Not part of the app.
 */

import { useEffect } from 'react';
import { render, screen, within } from '@testing-library/react';
import { PlanProvider, usePlan, usePlanInputs } from '../../state/PlanProvider';
import { PREFS_KEY, UiProvider, useUi } from '../../state/UiProvider';
import GuidedFlow from './GuidedFlow';

/** Latest inputs, plan, UI state and the inputs setter, captured after every render of the probe. */
export const latest = { inputs: null, plan: null, ui: null, set: null };

function Probe() {
  const { inputs, set } = usePlanInputs();
  const plan = usePlan();
  const ui = useUi();
  useEffect(() => {
    latest.inputs = inputs;
    latest.plan = plan;
    latest.ui = ui;
    latest.set = set;
  });
  return null;
}

/** A returning visitor in guided mode: English, metric, EUR. */
export const GUIDED_PREFS = Object.freeze({ locale: 'en', unitSystem: 'metric', currency: 'EUR', mode: 'guided' });

/**
 * Renders `children` (default the guided flow) inside a focusable `<main>`
 * like the shell's, with the real providers. `prefs` are stored first (as
 * a returning visitor's).
 * @param {object} [initialInputs]
 * @param {{ prefs?: object, children?: import('react').ReactNode }} [options]
 */
export function renderGuided(initialInputs, { prefs = GUIDED_PREFS, children } = {}) {
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  return render(
    <PlanProvider initialInputs={initialInputs} persist={false}>
      <UiProvider>
        <main id="main" tabIndex={-1}>
          {children ?? <GuidedFlow />}
        </main>
        <Probe />
      </UiProvider>
    </PlanProvider>,
  );
}

/** Resets what the probe captured. */
export function resetLatest() {
  latest.inputs = null;
  latest.plan = null;
  latest.ui = null;
  latest.set = null;
}

/** The current screen id (`data-screen` of the flow). */
export const currentScreen = () => screen.getByTestId('guided-flow').dataset.screen;

/**
 * The current screen's region (named by its heading). Visited question
 * screens stay mounted in hidden slots, so this is the one not hidden.
 */
export const screenRegion = () => {
  const shown = screen.getAllByTestId('guided-screen').filter((el) => !el.closest('[hidden]'));
  if (shown.length !== 1) throw new Error(`Expected one shown guided screen, found ${shown.length}`);
  return shown[0];
};

/** The slots of the mounted screens: `{ id, hidden }` in order. */
export const mountedScreens = () =>
  [...document.querySelectorAll('[data-guided-slot]')].map((el) => ({ id: el.dataset.guidedSlot, hidden: el.hidden }));

/** The current screen's level-2 heading. */
export const screenHeading = () => within(screenRegion()).getByRole('heading', { level: 2 });

/** The Next and Back buttons (or null). */
export const nextButton = () => screen.queryByTestId('guided-next');
export const backButton = () => screen.queryByTestId('guided-back');

/** The `aria-describedby` targets of an element, joined. */
export const description = (el) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? `#${id} missing`)
    .join(' ');

/** Ingredient refs in the inputs, in order. */
export const ingredientRefs = () => latest.inputs.carbs.ingredients.map((entry) => entry.ref);
