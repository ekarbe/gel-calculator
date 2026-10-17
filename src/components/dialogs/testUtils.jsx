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
 * Test helpers for the dialogs: the real providers, an opener button, and a
 * probe that shows the UI state the dialogs change. Not part of the app.
 */

import { useEffect } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { PlanProvider, usePlan, usePlanInputs } from '../../state/PlanProvider';
import { PREFS_KEY, UiProvider, useUi } from '../../state/UiProvider';

/** Latest plan inputs and UI state, captured after every render of the probe. */
export const latest = { inputs: null, ui: null, plan: null };

/**
 * An opener button for `modal`, the open modal's name, the toast and a way to
 * change the inputs from outside the dialog.
 * @param {{ modal: string, openLabel: string }} props
 */
function Probe({ modal, openLabel }) {
  const ui = useUi();
  const { inputs, set } = usePlanInputs();
  const plan = usePlan();
  useEffect(() => {
    latest.inputs = inputs;
    latest.ui = ui;
    latest.plan = plan;
  });
  return (
    <div>
      <button type="button" onClick={() => ui.openModal(modal)}>
        {openLabel}
      </button>
      <button type="button" onClick={() => set('event.durationMin', 240)}>
        Make it 4 h
      </button>
      <button type="button" onClick={() => set('event.durationMin', 120)}>
        Set 120 min
      </button>
      <span data-testid="modal">{ui.modal ?? 'none'}</span>
      <span data-testid="toast" data-tone={ui.toastTone}>
        {ui.toastMessage}
      </span>
      <span data-testid="duration">{plan.durationMin}</span>
      <span data-testid="format">{plan.format.type}</span>
    </div>
  );
}

/**
 * Renders `children` (the dialog under test) with the real providers
 * (autosave off) and a probe. `prefs` are stored first, as a returning
 * visitor's (`{ unitSystem: 'imperial' }`, `{ locale: 'de' }`).
 * @param {import('react').ReactNode} children
 * @param {{ modal: string, openLabel?: string, initialInputs?: object, prefs?: object, open?: boolean }} options
 */
export function renderDialog(children, { modal, openLabel = 'Open dialog', initialInputs, prefs, open = true }) {
  if (prefs) window.localStorage.setItem(PREFS_KEY, JSON.stringify({ mode: 'expert', ...prefs }));
  const view = render(
    <PlanProvider initialInputs={initialInputs} persist={false}>
      <UiProvider>
        <Probe modal={modal} openLabel={openLabel} />
        {children}
      </UiProvider>
    </PlanProvider>,
  );
  if (open) fireEvent.click(screen.getByRole('button', { name: openLabel }));
  return view;
}

/**
 * `[name, amount]` of every lane in a list (the lanes mark their parts with
 * `data-testid="line-name"` / `"line-amount"`).
 * @param {HTMLElement} list
 * @returns {Array<[string, string]>}
 */
export function laneTexts(list) {
  return within(list)
    .getAllByRole('listitem')
    .map((li) => [
      li.querySelector('[data-testid="line-name"]')?.textContent ?? '',
      li.querySelector('[data-testid="line-amount"]')?.textContent ?? '',
    ]);
}

/** Resets {@link latest}. */
export function resetLatest() {
  latest.inputs = null;
  latest.ui = null;
  latest.plan = null;
}
