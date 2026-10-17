import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { screen, fireEvent, within, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  GUIDED_PREFS,
  backButton,
  currentScreen,
  description,
  latest,
  mountedScreens,
  nextButton,
  renderGuided,
  resetLatest,
  screenRegion,
} from './testUtils';
import { t } from '../../i18n';
import { createFormat } from '../../i18n/formatters';

let warnSpy;

beforeEach(() => {
  resetLatest();
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  const unknown = warnSpy.mock.calls.filter(([msg]) => String(msg).startsWith('[i18n] Missing message'));
  expect(unknown).toEqual([]);
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

/** Renders the flow on a step (0–3), then moves to the screen `part` of it with Next. */
function renderAt(step, initialInputs, { part = 0, prefs } = {}) {
  renderGuided(initialInputs, prefs ? { prefs } : undefined);
  act(() => latest.ui.setGuidedStep(step));
  for (let i = 0; i < part; i += 1) fireEvent.click(screen.getByTestId('guided-next'));
}

/** Opens the screen's "Why?" and returns its panel's text. */
async function whyText(user) {
  const button = within(screenRegion()).getAllByRole('button', { name: 'Why?' })[0];
  await user.click(button);
  return document.getElementById(button.getAttribute('aria-controls')).textContent;
}

/** Types into a number field like a user would: change, then leave the field. */
function enter(input, value) {
  fireEvent.change(input, { target: { value: String(value) } });
  fireEvent.blur(input);
}

describe('Guided step 1: the event', () => {
  it('asks for sport, duration, intensity and speed with power, not the setting', () => {
    renderAt(0);
    const region = screenRegion();
    expect(within(region).getByRole('radiogroup', { name: 'Sport' })).toBeInTheDocument();
    expect(within(region).getByRole('group', { name: 'Duration' })).toBeInTheDocument();
    expect(within(region).getByRole('spinbutton', { name: 'Hours' })).toHaveValue('3');
    expect(within(region).getByRole('combobox', { name: 'Intensity' })).toBeInTheDocument();
    expect(within(region).getByRole('spinbutton', { name: 'Speed' })).toBeInTheDocument();
    expect(within(region).getByRole('spinbutton', { name: 'Power' })).toBeInTheDocument();
    // The setting is a weather question (step 2).
    expect(within(region).queryByRole('combobox', { name: 'Setting' })).toBeNull();
  });

  it('writes the event inputs, which the dock follows at once', async () => {
    const user = userEvent.setup();
    renderAt(0);
    enter(screen.getByRole('spinbutton', { name: 'Hours' }), 1);
    expect(latest.inputs.event.durationMin).toBe(60);
    expect(screen.getByTestId('guided-dock-carbs-value')).toHaveTextContent(String(latest.plan.carbs.gPerHour));
    await user.click(screen.getByRole('radio', { name: 'Running' }));
    expect(latest.inputs.event.sport).toBe('running');
    expect(within(screenRegion()).queryByRole('spinbutton', { name: 'Power' })).toBeNull();
    await user.click(screen.getByRole('radio', { name: 'Other sport' }));
    expect(within(screenRegion()).getByRole('spinbutton', { name: 'Effort' })).toBeInTheDocument();
  });

  it("explains the carb target in its Why", async () => {
    const user = userEvent.setup();
    renderAt(0);
    expect(await whyText(user)).toContain(t(latest.plan.carbs.recommended.why.summary));
  });
});

describe('Guided step 2: body and weather', () => {
  it('asks for the units, body, weather and the setting', () => {
    renderAt(1);
    expect(currentScreen()).toBe('conditions');
    const region = screenRegion();
    expect(within(region).getByRole('radiogroup', { name: 'Units (whole app)' })).toBeInTheDocument();
    const body = within(region).getByRole('group', { name: 'Body' });
    expect(within(body).getByRole('spinbutton', { name: 'Body mass' })).toBeInTheDocument();
    expect(within(body).getByRole('spinbutton', { name: 'Height' })).toBeInTheDocument();
    const weather = within(region).getByRole('group', { name: 'Weather' });
    expect(within(weather).getByRole('spinbutton', { name: 'Temperature' })).toBeInTheDocument();
    expect(within(weather).getByRole('spinbutton', { name: 'Humidity' })).toBeInTheDocument();
    expect(within(weather).getByRole('combobox', { name: 'Sun' })).toBeInTheDocument();
    expect(within(region).getByRole('combobox', { name: 'Setting' })).toBeInTheDocument();
  });

  it('writes metric inputs from imperial fields', () => {
    renderAt(1, undefined, { prefs: { ...GUIDED_PREFS, unitSystem: 'imperial', currency: 'USD' } });
    enter(screen.getByRole('spinbutton', { name: 'Temperature' }), 86);
    expect(latest.inputs.environment.tempC).toBeCloseTo(30, 5);
    fireEvent.change(screen.getByRole('combobox', { name: 'Setting' }), { target: { value: 'indoorFan' } });
    expect(latest.inputs.event.setting).toBe('indoorFan');
  });

  it('explains the sweat rate these drive in its Why', async () => {
    const user = userEvent.setup();
    renderAt(1);
    expect(await whyText(user)).toContain(t(latest.plan.sweat.why.summary));
  });
});

describe('Guided step 2: sweat', () => {
  const answer = () => screen.getByRole('radiogroup', { name: 'Have you done a sweat test?' });

  it('answers No for the estimate and shows the estimate, the saltiness and its warnings', () => {
    renderAt(1, undefined, { part: 1 });
    expect(currentScreen()).toBe('sweat');
    expect(within(answer()).getByRole('radio', { name: 'No' })).toHaveAttribute('aria-checked', 'true');
    expect(description(answer())).toMatch(/estimates your sweat rate/);
    expect(screen.getByTestId('sweat-estimate-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('sweat-test-panel')).toBeNull();
    expect(within(screenRegion()).getByRole('combobox', { name: 'Sweat saltiness' })).toBeInTheDocument();
  });

  it('switches the sweat source with Yes and No, and shows the sweat test list and form', async () => {
    const user = userEvent.setup();
    renderAt(1, undefined, { part: 1 });
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    expect(latest.inputs.sweat.source).toBe('test');
    expect(description(answer())).toMatch(/Add your test below/);
    expect(screen.getByTestId('sweat-test-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('sweat-estimate-panel')).toBeNull();
    // Without a usable test the plan uses the estimate, and says so on this screen.
    const warning = latest.plan.sweat.warnings.find((w) => w.id === 'sweat.testUnusable');
    expect(warning).toBeDefined();
    const sweatWarnings = screenRegion().querySelector(':scope > ul[aria-label="Warnings"]');
    expect(sweatWarnings).toHaveTextContent(t(warning.message));
    await user.click(screen.getByRole('button', { name: 'Add a sweat test' }));
    expect(screen.getByRole('form', { name: /sweat test/i })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'No' }));
    expect(latest.inputs.sweat.source).toBe('estimate');
  });

  it('uses a test the athlete adds here', async () => {
    const user = userEvent.setup();
    renderAt(
      1,
      {
        sweat: {
          source: 'test',
          tests: [
            {
              id: 't1',
              date: '2026-06-01',
              label: 'Long ride',
              preKg: 70,
              postKg: 69,
              fluidL: 0.5,
              urineL: 0,
              durationMin: 60,
            },
          ],
        },
      },
      { part: 1 },
    );
    expect(within(answer()).getByRole('radio', { name: 'Yes' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Long ride' })).toBeChecked();
    expect(latest.plan.sweat.source).toBe('test');
    await user.click(screen.getByRole('radio', { name: 'No' }));
    expect(latest.plan.sweat.source).toBe('estimate');
    // The test stays for later.
    expect(latest.inputs.sweat.tests).toHaveLength(1);
  });

  it('shows a preset chosen in expert mode as No, and offers the estimate instead', async () => {
    const user = userEvent.setup();
    renderAt(1, { sweat: { source: 'preset', rateIndex: 3 } }, { part: 1 });
    expect(within(answer()).getByRole('radio', { name: 'No' })).toHaveAttribute('aria-checked', 'true');
    expect(description(answer())).toMatch(/picked a sweat rate yourself/);
    expect(screen.getByTestId('sweat-preset-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('sweat-estimate-panel')).toBeNull();
    expect(latest.plan.sweat.source).toBe('preset');
    await user.click(screen.getByRole('button', { name: 'Use the estimate instead' }));
    expect(latest.inputs.sweat.source).toBe('estimate');
    expect(screen.getByTestId('sweat-estimate-panel')).toBeInTheDocument();
    // The button went away: the focus is on the answer it led to.
    expect(within(answer()).getByRole('radio', { name: 'No' })).toHaveFocus();
  });

  it('keeps an open sweat test form, with what was typed, across Next, Back and the step list', async () => {
    const user = userEvent.setup();
    renderAt(1, undefined, { part: 1 });
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Add a sweat test' }));
    const name = () => within(screen.getByRole('form', { name: 'Add a sweat test' })).getByRole('textbox', { name: 'Name (optional)' });
    await user.type(name(), 'Hot long run');
    await user.click(nextButton());
    expect(currentScreen()).toBe('pantry');
    // The sweat screen is hidden, not gone: nothing of it can be reached.
    expect(mountedScreens()).toEqual([
      { id: 'event', hidden: true },
      { id: 'conditions', hidden: true },
      { id: 'sweat', hidden: true },
      { id: 'pantry', hidden: false },
    ]);
    expect(screen.queryByRole('form', { name: 'Add a sweat test' })).toBeNull();
    await user.click(backButton());
    expect(currentScreen()).toBe('sweat');
    expect(name()).toHaveValue('Hot long run');
    expect(latest.inputs.sweat.tests).toHaveLength(0);
    // Through the step list and back to the step's second screen: still there.
    await user.click(screen.getByTestId('guided-step-plan'));
    expect(currentScreen()).toBe('board');
    await user.click(screen.getByTestId('guided-step-bodyWeather'));
    await user.click(nextButton());
    expect(currentScreen()).toBe('sweat');
    expect(name()).toHaveValue('Hot long run');
  });

  it('sets the sweat saltiness, which drives the sodium in the dock', () => {
    renderAt(1, undefined, { part: 1 });
    const before = latest.plan.sodium.mgPerHour;
    fireEvent.change(screen.getByRole('combobox', { name: 'Sweat saltiness' }), { target: { value: '5' } });
    expect(latest.inputs.sweat.saltinessIndex).toBe(5);
    expect(latest.plan.sodium.mgPerHour).toBeGreaterThanOrEqual(before);
    expect(screen.getByTestId('guided-dock-sodium-value')).toHaveTextContent(createFormat('en').number(latest.plan.sodium.mgPerHour));
  });

  it('explains the fluid target the sweat rate drives in its Why', async () => {
    const user = userEvent.setup();
    renderAt(1, undefined, { part: 1 });
    expect(await whyText(user)).toContain(t(latest.plan.fluid.recommended.why.summary));
  });
});

describe('Guided screens: kept while hidden', () => {
  it('keeps every visited question screen mounted and hidden, and the board only while shown', () => {
    renderAt(0);
    expect(mountedScreens()).toEqual([{ id: 'event', hidden: false }]);
    act(() => latest.ui.setGuidedStep(3));
    expect(mountedScreens()).toEqual([
      { id: 'event', hidden: true },
      { id: 'board', hidden: false },
    ]);
    act(() => latest.ui.setGuidedStep(2));
    expect(mountedScreens()).toEqual([
      { id: 'event', hidden: true },
      { id: 'pantry', hidden: false },
    ]);
    expect(screen.queryByTestId('race-board')).toBeNull();
    // Only the shown screen's heading is in the accessibility tree.
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Your pantry']);
  });

  it('keeps a custom ingredient being typed in across a move', async () => {
    const user = userEvent.setup();
    renderAt(2);
    await user.click(screen.getByRole('button', { name: 'Add your own from a label' }));
    await user.click(screen.getByRole('button', { name: 'New ingredient' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Rice syrup');
    await user.click(backButton());
    expect(currentScreen()).toBe('sweat');
    await user.click(nextButton());
    expect(currentScreen()).toBe('pantry');
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Rice syrup');
    expect(latest.inputs.carbs.custom).toEqual([]);
  });
});

describe('Guided step 4: recipe and plan', () => {
  it('shows the race board and the full schedule', () => {
    renderAt(3);
    expect(currentScreen()).toBe('board');
    expect(screen.getByTestId('race-board')).toBeInTheDocument();
    for (const name of ['Carbs', 'Sodium', 'Fluid', 'Caffeine']) {
      expect(within(screen.getByTestId('board-kpis')).getByRole('group', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Start mixing' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Schedule' })).toBeInTheDocument();
    // A reason, but no Why of its own (every number on the board has one).
    const intro = within(screenRegion()).getByTestId('guided-reason').parentElement;
    expect(within(intro).queryByRole('button', { name: 'Why?' })).toBeNull();
  });

  it('moves the focus to the full schedule from "Full schedule"', async () => {
    const user = userEvent.setup();
    renderAt(3);
    await user.click(screen.getByRole('button', { name: 'Full schedule' }));
    expect(screen.getByRole('heading', { name: 'Schedule' })).toHaveFocus();
  });
});
