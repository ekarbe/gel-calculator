import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GuidedFlow from './GuidedFlow';
import { DOCK_STATIC_QUERY } from './GuidedDock';
import { GUIDED_STEPS } from './guidedSteps';
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
  screenHeading,
  screenRegion,
} from './testUtils';
import { useUi } from '../../state/UiProvider';
import { MESSAGES } from '../../i18n';
import { createFormat } from '../../i18n/formatters';
import uiGuided from '../../i18n/en/ui-guided';
import guidedFlowSource from './GuidedFlow.jsx?raw';
import guidedDockSource from './GuidedDock.jsx?raw';
import guidedPantrySource from './GuidedPantry.jsx?raw';
import guidedProgressSource from './GuidedProgress.jsx?raw';
import guidedScreenSource from './GuidedScreen.jsx?raw';
import guidedScreensSource from './GuidedScreens.jsx?raw';

/** A plan without any warning: a 2 h run with a drink. */
const NO_WARNINGS = { format: { type: 'drink' }, event: { durationMin: 120, sport: 'running', speedKmh: 12 } };

/** The screens in order, with their headings and their steps (0–3). */
const ORDER = [
  { screen: 'event', heading: 'Your event', step: 0 },
  { screen: 'conditions', heading: 'Body & weather', step: 1 },
  { screen: 'sweat', heading: 'Sweat', step: 1 },
  { screen: 'pantry', heading: 'Your pantry', step: 2 },
  { screen: 'board', heading: 'Your plan', step: 3 },
];

const progress = () => screen.getByRole('navigation', { name: 'Guided setup' });
const stepButtons = () => within(progress()).getAllByRole('button');
const dockStats = () => screen.queryByRole('region', { name: 'Your plan so far' });
const dockValue = (name) => screen.getByTestId(`guided-dock-${name}-value`).textContent;
const fills = () => [...progress().querySelectorAll('[data-testid="guided-step-fill"]')].map((el) => el.style.width);

/** Shows the guided flow in guided mode only, like the shell. */
function ModeSwitch() {
  const { mode } = useUi();
  return mode === 'guided' ? <GuidedFlow /> : <p data-testid="expert-layout">Expert</p>;
}

let warnSpy;

beforeEach(() => {
  resetLatest();
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  // No key may be unknown (a typo shows the raw key). A German fallback to English is fine until the
  // German catalogs exist.
  const unknown = warnSpy.mock.calls.filter(([msg]) => String(msg).startsWith('[i18n] Missing message'));
  expect(unknown).toEqual([]);
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.style.removeProperty('--pinned-bottom');
});

describe('GuidedFlow: layout', () => {
  it('starts on the event screen with the step list, the reason, Why, the dock and Next only', () => {
    renderGuided();
    expect(currentScreen()).toBe('event');
    // Named "Step n: name" (the visible number is decorative; the name shows when there is room).
    ['Step 1: Event', 'Step 2: Body & weather', 'Step 3: Ingredients', 'Step 4: Recipe & plan'].forEach((name, i) => {
      expect(stepButtons()[i]).toHaveAccessibleName(name);
    });
    expect(stepButtons().map((b) => b.getAttribute('aria-current'))).toEqual(['step', null, null, null]);
    expect(within(progress()).getByRole('list')).toBeInTheDocument();

    const region = screen.getByRole('region', { name: 'Your event' });
    expect(region).toBe(screenRegion());
    expect(screenHeading()).toHaveTextContent('Your event');
    expect(screenHeading()).toHaveAttribute('tabindex', '-1');
    expect(within(region).getByTestId('guided-caption')).toHaveTextContent('Step 1 of 4 · Event');
    expect(within(region).getByTestId('guided-reason')).toHaveTextContent(uiGuided['ui-guided.event.reason']);
    expect(within(region).getByRole('button', { name: 'Why?' })).toHaveAttribute('aria-expanded', 'false');

    expect(backButton()).toBeNull();
    expect(nextButton()).toHaveAccessibleName('Next (Body & weather)');
    expect(screen.getByRole('group', { name: 'Step navigation' })).toContainElement(nextButton());
    expect(dockStats()).toBeInTheDocument();

    const expert = screen.getByRole('button', { name: 'Switch to expert' });
    expect(description(expert)).toBe('Expert mode keeps everything you entered.');
  });

  it('gives the step list a row of its own on narrow screens, with 44 × 44 px steps', () => {
    renderGuided();
    // "Switch to expert" goes under the list until the flow is 28 rem wide (a container query).
    const row = screen.getByTestId('guided-top');
    expect(row.parentElement).toHaveClass('@container');
    expect(row).toHaveClass('flex-col', '@md:flex-row');
    expect(row.firstElementChild).toBe(progress());
    expect(progress()).toHaveClass('w-full', '@md:flex-1');
    for (const button of stepButtons()) expect(button).toHaveClass('min-h-11', 'min-w-11');
    // The step numbers use tabular figures.
    for (const marker of progress().querySelectorAll('[data-testid="guided-step-marker"]')) expect(marker).toHaveClass('num');
    expect(screenRegion()).toHaveClass('num');
  });

  it('has one level-2 heading per screen, under the page heading', () => {
    renderGuided();
    for (const { heading } of ORDER.slice(0, -1)) {
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([heading]);
      fireEvent.click(nextButton());
    }
    // The board screen: the board's heading one level below, and the full schedule a section of its own.
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Your plan', 'Schedule']);
    expect(screen.getByRole('heading', { level: 3, name: 'Race board' })).toBeInTheDocument();
    expect(screenRegion()).toContainElement(screen.getByTestId('race-board'));
    expect(screenRegion()).not.toContainElement(screen.getByTestId('schedule'));
  });

  it('gives every element a unique id on every screen, with the visited screens kept', () => {
    renderGuided();
    for (let i = 0; i < ORDER.length; i += 1) {
      const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
      expect(new Set(ids).size, currentScreen()).toBe(ids.length);
      if (nextButton()) fireEvent.click(nextButton());
    }
    expect(mountedScreens().map((slot) => slot.id)).toEqual(['event', 'conditions', 'sweat', 'pantry', 'board']);
  });

  it('uses the design tokens only', () => {
    for (const source of [
      guidedFlowSource,
      guidedDockSource,
      guidedPantrySource,
      guidedProgressSource,
      guidedScreenSource,
      guidedScreensSource,
    ]) {
      expect(source).not.toMatch(/apple-|glass-card|#[0-9a-f]{3,6}\b|text-text-|bg-bg-primary|bg-card/i);
    }
  });
});

describe('GuidedFlow: moving between screens', () => {
  it('goes through every screen with Next and back with Back, focusing each heading', async () => {
    const user = userEvent.setup();
    renderGuided();
    for (let i = 0; i < ORDER.length; i += 1) {
      const { screen: id, heading, step } = ORDER[i];
      expect(currentScreen()).toBe(id);
      expect(latest.ui.guidedStep).toBe(step);
      expect(stepButtons()[step]).toHaveAttribute('aria-current', 'step');
      if (i > 0) expect(screenHeading()).toHaveFocus();
      if (i < ORDER.length - 1) {
        expect(nextButton()).toHaveAccessibleName(`Next (${ORDER[i + 1].heading})`);
        await user.click(nextButton());
      }
    }
    // The board: Back only (its primary action is Start mixing).
    expect(nextButton()).toBeNull();
    expect(backButton()).toHaveAccessibleName('Back (Your pantry)');
    for (let i = ORDER.length - 1; i > 0; i -= 1) {
      expect(currentScreen()).toBe(ORDER[i].screen);
      expect(backButton()).toHaveAccessibleName(`Back (${ORDER[i - 1].heading})`);
      await user.click(backButton());
      expect(currentScreen()).toBe(ORDER[i - 1].screen);
      expect(screenHeading()).toHaveFocus();
    }
    expect(backButton()).toBeNull();
  });

  it('works with the keyboard: Enter on Next, then the focus is on the new heading', async () => {
    const user = userEvent.setup();
    renderGuided();
    nextButton().focus();
    await user.keyboard('{Enter}');
    expect(currentScreen()).toBe('conditions');
    expect(screenHeading()).toHaveFocus();
    // Tab from the heading reaches the screen's first control.
    await user.tab();
    expect(screenRegion()).toContainElement(document.activeElement);
  });

  it('fills the progress bar by step, and the current step by its screens', () => {
    renderGuided();
    expect(fills()).toEqual(['100%', '0%', '0%', '0%']);
    fireEvent.click(nextButton());
    expect(fills()).toEqual(['100%', '50%', '0%', '0%']);
    fireEvent.click(nextButton());
    expect(fills()).toEqual(['100%', '100%', '0%', '0%']);
    fireEvent.click(nextButton());
    fireEvent.click(nextButton());
    expect(fills()).toEqual(['100%', '100%', '100%', '100%']);
    // Markers differ by shape: filled up to the current step, ringed on it, outlined after it.
    const markers = () => [...progress().querySelectorAll('[data-testid="guided-step-marker"]')];
    expect(markers().map((m) => m.dataset.state)).toEqual(['before', 'before', 'before', 'current']);
    expect(markers()[3]).toHaveClass('ring-2');
    fireEvent.click(stepButtons()[1]);
    expect(markers().map((m) => m.dataset.state)).toEqual(['before', 'current', 'after', 'after']);
    expect(markers().map((m) => m.textContent)).toEqual(['1', '2', '3', '4']);
  });

  it('jumps to a step from the list, to its first screen, and focuses the heading', async () => {
    const user = userEvent.setup();
    renderGuided();
    await user.click(stepButtons()[3]);
    expect(currentScreen()).toBe('board');
    expect(screenHeading()).toHaveFocus();
    await user.click(stepButtons()[1]);
    expect(currentScreen()).toBe('conditions');
    expect(screenHeading()).toHaveFocus();
    // The current step again: stays, and the focus goes to the heading.
    await user.click(stepButtons()[1]);
    expect(currentScreen()).toBe('conditions');
    expect(screenHeading()).toHaveFocus();
  });

  it('remembers the screen of the step it left by Back, and starts other steps at their first screen', () => {
    renderGuided();
    fireEvent.click(nextButton()); // conditions
    fireEvent.click(nextButton()); // sweat
    fireEvent.click(nextButton()); // pantry
    fireEvent.click(backButton());
    expect(currentScreen()).toBe('sweat');
    // A step chosen elsewhere (the shell, a test) starts at its first screen.
    act(() => latest.ui.setGuidedStep(1));
    expect(currentScreen()).toBe('sweat');
    act(() => latest.ui.setGuidedStep(0));
    act(() => latest.ui.setGuidedStep(1));
    expect(currentScreen()).toBe('conditions');
  });

  it('moves nothing on the first render or when the step changes elsewhere', () => {
    renderGuided();
    expect(document.body).toHaveFocus();
    act(() => latest.ui.setGuidedStep(2));
    expect(currentScreen()).toBe('pantry');
    expect(document.body).toHaveFocus();
  });

  it('scrolls the flow to the top, below the sticky header, after each move', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      renderGuided(undefined, {
        children: (
          <>
            <header style={{ position: 'sticky' }}>Header</header>
            <GuidedFlow />
          </>
        ),
      });
      expect(scrollIntoView).not.toHaveBeenCalled();
      fireEvent.click(nextButton());
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
      expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByTestId('guided-flow'));
      // The margin is set for the scroll only.
      expect(screen.getByTestId('guided-flow').style.scrollMarginTop).toBe('');
    } finally {
      delete Element.prototype.scrollIntoView;
    }
  });
});

describe('GuidedFlow: switch to expert', () => {
  it('sets expert mode, keeps every input and moves the focus to main', async () => {
    const user = userEvent.setup();
    renderGuided(undefined, { children: <ModeSwitch /> });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Hours' }), { target: { value: '4' } });
    fireEvent.blur(screen.getByRole('spinbutton', { name: 'Hours' }));
    expect(latest.inputs.event.durationMin).toBe(240);
    await user.click(screen.getByRole('button', { name: 'Switch to expert' }));
    expect(latest.ui.mode).toBe('expert');
    expect(screen.getByTestId('expert-layout')).toBeInTheDocument();
    expect(screen.queryByTestId('guided-flow')).toBeNull();
    expect(latest.inputs.event.durationMin).toBe(240);
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('is on every screen', () => {
    renderGuided();
    for (let i = 0; i < ORDER.length; i += 1) {
      expect(screen.getByRole('button', { name: 'Switch to expert' })).toBeInTheDocument();
      if (nextButton()) fireEvent.click(nextButton());
    }
  });

  const note = () => screen.getByTestId('guided-leave-note');
  const NOTE_TEXT = 'This form is not saved yet. Save or cancel it first, or select Switch to expert again to leave without it.';

  /** Goes to the sweat screen, answers Yes and opens the test form with a name typed in. */
  async function openSweatForm(user) {
    act(() => latest.ui.setGuidedStep(1));
    await user.click(nextButton());
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Add a sweat test' }));
    await user.type(screen.getByRole('textbox', { name: 'Name (optional)' }), 'Hot run');
    return screen.getByRole('form', { name: 'Add a sweat test' });
  }

  it('does not drop an open form: it moves to it and says so, and a second press leaves', async () => {
    const user = userEvent.setup();
    renderGuided(undefined, { children: <ModeSwitch /> });
    expect(note()).toHaveAttribute('role', 'alert');
    expect(note()).toBeEmptyDOMElement();
    const form = await openSweatForm(user);
    await user.click(nextButton());
    expect(currentScreen()).toBe('pantry');

    await user.click(screen.getByRole('button', { name: 'Switch to expert' }));
    expect(latest.ui.mode).toBe('guided');
    // Back on the form's screen, the focus in the form, the note in the dock.
    expect(currentScreen()).toBe('sweat');
    expect(form).toBeVisible();
    expect(form).toContainElement(document.activeElement);
    expect(note()).toHaveTextContent(NOTE_TEXT);
    expect(screen.getByTestId('guided-dock')).toContainElement(note());

    await user.click(screen.getByRole('button', { name: 'Switch to expert' }));
    expect(latest.ui.mode).toBe('expert');
    expect(screen.getByTestId('expert-layout')).toBeInTheDocument();
    expect(latest.inputs.sweat.tests).toHaveLength(0);
  });

  it('drops the note when the form closes or the flow moves, and then leaves at once without a form', async () => {
    const user = userEvent.setup();
    renderGuided(undefined, { children: <ModeSwitch /> });
    const form = await openSweatForm(user);
    await user.click(screen.getByRole('button', { name: 'Switch to expert' }));
    expect(note()).toHaveTextContent(NOTE_TEXT);
    expect(form).toContainElement(document.activeElement);
    // A move clears it; the form is still open, so the next press warns again.
    await user.click(nextButton());
    expect(note()).toBeEmptyDOMElement();
    await user.click(screen.getByRole('button', { name: 'Switch to expert' }));
    expect(currentScreen()).toBe('sweat');
    expect(note()).toHaveTextContent(NOTE_TEXT);
    // Cancel closes the form: the note goes, and the switch leaves at once.
    await user.click(within(screen.getByRole('form', { name: 'Add a sweat test' })).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(note()).toBeEmptyDOMElement());
    await user.click(screen.getByRole('button', { name: 'Switch to expert' }));
    expect(latest.ui.mode).toBe('expert');
  });

  it('focuses the button of a closed disclosure that holds the open form', async () => {
    const user = userEvent.setup();
    renderGuided(undefined, { children: <ModeSwitch /> });
    act(() => latest.ui.setGuidedStep(2));
    const add = screen.getByRole('button', { name: 'Add your own from a label' });
    await user.click(add);
    await user.click(screen.getByRole('button', { name: 'New ingredient' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Rice syrup');
    await user.click(add);
    expect(add).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('button', { name: 'Switch to expert' }));
    expect(latest.ui.mode).toBe('guided');
    expect(add).toHaveFocus();
    expect(note()).toHaveTextContent(NOTE_TEXT);
  });
});

describe('GuidedFlow: dock', () => {
  it("shows the plan's carbs, sodium and fluid per hour, and follows every change", () => {
    renderGuided();
    const f = createFormat('en');
    const check = () => {
      expect(dockValue('carbs')).toBe(f.number(latest.plan.carbs.gPerHour));
      expect(dockValue('sodium')).toBe(f.number(latest.plan.sodium.mgPerHour));
      expect(dockValue('fluid')).toBe(f.volume(latest.plan.fluid.mlPerHour, { unit: false }));
    };
    check();
    expect(dockValue('carbs')).toBe('75');
    const stats = dockStats();
    // A short visible caption (hidden from screen readers) and the full name for them.
    expect(within(stats).getByTestId('guided-dock-carbs')).toHaveTextContent('CarbsCarbs75g/h');
    expect(within(stats).getByTestId('guided-dock-carbs-caption')).toHaveAttribute('aria-hidden', 'true');
    expect(within(stats).getByTestId('guided-dock-sodium')).toHaveTextContent('SodiumSodium300mg/h');
    expect(within(stats).getByTestId('guided-dock-fluid')).toHaveTextContent(/^FluidFluid\d+ml\/h$/);
    // Terms and values as a description list.
    expect(stats.querySelectorAll('dl > div > dt')).toHaveLength(3);
    act(() => latest.set('event.durationMin', 600));
    check();
    act(() => latest.set('environment.tempC', 32));
    check();
  });

  it('shows fluid in fl oz/h in imperial', () => {
    renderGuided(undefined, { prefs: { ...GUIDED_PREFS, unitSystem: 'imperial', currency: 'USD' } });
    const f = createFormat('en', { unitSystem: 'imperial' });
    expect(screen.getByTestId('guided-dock-fluid')).toHaveTextContent(`Fluid${f.volume(latest.plan.fluid.mlPerHour, { unit: false })}fl oz/h`);
    expect(screen.getByTestId('guided-dock-fluid-value')).toHaveTextContent(f.volume(latest.plan.fluid.mlPerHour, { unit: false }));
    // Nutrients stay in g and mg.
    expect(screen.getByTestId('guided-dock-carbs')).toHaveTextContent('g/h');
  });

  it('counts the warnings and lists every one of them on demand', async () => {
    const user = userEvent.setup();
    renderGuided({ carbs: { ingredients: [] } });
    const count = latest.plan.warnings.length;
    expect(count).toBeGreaterThan(1);
    const chip = screen.getByRole('button', { name: `${count} warnings` });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    expect(chip).toHaveAttribute('data-level', 'warning');
    const panel = document.getElementById(chip.getAttribute('aria-controls'));
    expect(panel).not.toBeVisible();
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toBeVisible();
    // A focusable group named by the chip (it scrolls when long), holding the plan's warnings.
    expect(panel).toHaveAttribute('tabindex', '0');
    expect(within(dockStats()).getByRole('group', { name: `${count} warnings` })).toBe(panel);
    const items = within(panel).getByRole('list', { name: 'Warnings' }).querySelectorAll(':scope > li');
    expect(items).toHaveLength(count);
    expect(items[0]).toHaveAttribute('data-level', 'warning');
    await user.click(chip);
    expect(panel).not.toBeVisible();
  });

  it('shows the count alone on narrow docks, the full text from 26 rem, and keeps the full name', async () => {
    const user = userEvent.setup();
    renderGuided({ carbs: { ingredients: [] } });
    const count = latest.plan.warnings.length;
    const chip = screen.getByTestId('guided-dock-warnings');
    expect(chip).toHaveAccessibleName(`${count} warnings`);
    const compact = within(chip).getByTestId('guided-dock-warnings-compact');
    const full = within(chip).getByTestId('guided-dock-warnings-full');
    expect(compact).toHaveTextContent(String(count));
    expect(compact).toHaveAttribute('aria-hidden', 'true');
    expect(compact).toHaveClass('@[26rem]:hidden');
    expect(full).toHaveTextContent(`${count} warnings`);
    expect(full).toHaveClass('sr-only', '@[26rem]:not-sr-only');
    // The stats are the container; the caption icons go below 26 rem and the short captions never wrap, so a
    // caption never breaks inside a word (e2e/layout.spec.js measures it in German at 320–414 px).
    expect(dockStats()).toHaveClass('@container');
    for (const stat of ['carbs', 'sodium', 'fluid']) {
      expect(screen.getByTestId(`guided-dock-${stat}`).querySelector('dt svg')).toHaveClass('@max-[26rem]:hidden');
      expect(screen.getByTestId(`guided-dock-${stat}-caption`)).toHaveClass('whitespace-nowrap');
    }
    // The panel the chip opens is still named by its full text.
    await user.click(chip);
    expect(within(dockStats()).getByRole('group', { name: `${count} warnings` })).toBeVisible();
    // Without warnings: a check and 0 on narrow docks, "No warnings" from 26 rem.
    act(() => latest.set('carbs.ingredients', [{ ref: 3, weight: 67 }, { ref: 11, weight: 33 }]));
    act(() => latest.set('format.type', 'drink'));
    act(() => latest.set('event', { ...latest.inputs.event, durationMin: 120, sport: 'running', speedKmh: 12 }));
    expect(latest.plan.warnings).toEqual([]);
    const none = screen.getByTestId('guided-dock-warnings');
    expect(within(none).getByTestId('guided-dock-warnings-compact')).toHaveTextContent('0');
    expect(within(none).getByTestId('guided-dock-warnings-full')).toHaveTextContent('No warnings');
  });

  it('says "1 warning" for one, and shows the worst level by its icon', () => {
    renderGuided({ ...NO_WARNINGS, event: { ...NO_WARNINGS.event, durationMin: 600 } });
    const { warnings } = latest.plan;
    const chip = screen.getByTestId('guided-dock-warnings');
    const worst = ['danger', 'warning', 'info'].find((level) => warnings.some((w) => w.level === level));
    expect(chip).toHaveAttribute('data-level', worst);
    expect(chip).toHaveTextContent(warnings.length === 1 ? '1 warning' : `${warnings.length} warnings`);
    act(() => latest.set('event.durationMin', 120));
    expect(screen.getByTestId('guided-dock-warnings')).toHaveTextContent('No warnings');
  });

  it('shows a static "No warnings" chip when the plan has none, and closes the list', async () => {
    const user = userEvent.setup();
    renderGuided({ ...NO_WARNINGS, carbs: { ingredients: [] } });
    await user.click(screen.getByTestId('guided-dock-warnings'));
    const panel = screen.getByTestId('guided-dock-warnings-panel');
    expect(panel).toBeVisible();
    act(() => latest.set('carbs.ingredients', [{ ref: 3, weight: 67 }, { ref: 11, weight: 33 }]));
    expect(latest.plan.warnings).toEqual([]);
    const chip = screen.getByTestId('guided-dock-warnings');
    expect(chip.tagName).toBe('SPAN');
    expect(chip).toHaveTextContent('No warnings');
    expect(chip).toHaveAttribute('data-level', 'none');
    expect(panel).not.toBeVisible();
    // Warnings that come back do not open the list by themselves.
    act(() => latest.set('carbs.ingredients', []));
    expect(screen.getByTestId('guided-dock-warnings')).toHaveAttribute('aria-expanded', 'false');
    expect(panel).not.toBeVisible();
  });

  it('hides the live numbers on the board, which shows them in its tiles, and keeps Back', () => {
    renderGuided();
    act(() => latest.ui.setGuidedStep(3));
    expect(dockStats()).toBeNull();
    expect(screen.getByTestId('board-kpis')).toBeInTheDocument();
    expect(screen.getByTestId('guided-dock')).toContainElement(backButton());
  });

  it('announces warning changes politely, with one announcer on every screen, both ways', () => {
    renderGuided();
    const check = () => {
      const regions = document.querySelectorAll('[data-testid="board-warnings-status"]');
      expect(regions, currentScreen()).toHaveLength(1);
      expect(regions[0]).toHaveAttribute('aria-live', 'polite');
    };
    for (let i = 0; i < ORDER.length; i += 1) {
      check();
      if (nextButton()) fireEvent.click(nextButton());
    }
    // Back from the board: the board (whose announcer is a portal) is not kept, so still one.
    while (backButton()) {
      fireEvent.click(backButton());
      check();
    }
  });

  it('is sticky at the bottom, safe-area aware, above the content, and static on short viewports', () => {
    renderGuided();
    expect(screen.getByTestId('guided-dock')).toHaveClass('sticky', 'bottom-0', 'pb-safe');
    // The class and the query the flow checks are the same media query.
    expect(DOCK_STATIC_QUERY).toBe('(max-height: 32rem)');
    expect(screen.getByTestId('guided-dock')).toHaveClass(`[@media${DOCK_STATIC_QUERY.replace(/\s/g, '')}]:static`);
    // The dock is the flow's last part, so it never covers the end of a screen.
    expect(screen.getByTestId('guided-flow').lastElementChild).toBe(screen.getByTestId('guided-dock'));
  });

  it('lets the shell lift the dock above a bar of its own', () => {
    renderGuided(undefined, { children: <GuidedFlow dockOffsetClassName="bottom-16" /> });
    expect(screen.getByTestId('guided-dock')).toHaveClass('sticky', 'bottom-16');
    expect(screen.getByTestId('guided-dock')).not.toHaveClass('bottom-0');
  });

  it('keeps focused fields clear of the dock with the page scroll padding', () => {
    const observers = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback) {
          this.callback = callback;
          this.observe = vi.fn();
          this.disconnect = vi.fn();
          observers.push(this);
        }
      },
    );
    let height = 120;
    let position = 'sticky';
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
      return this.dataset?.testid === 'guided-dock' ? { height, width: 0, top: 0, left: 0, bottom: 0, right: 0 } : { height: 0 };
    });
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(() => [{}]);
    const computed = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
      element.dataset?.testid === 'guided-dock' ? { position } : computed(element),
    );
    const root = document.documentElement;
    const view = renderGuided();
    const dockObserver = observers.find((observer) => observer.observe.mock.calls.some(([el]) => el === screen.getByTestId('guided-dock')));
    expect(dockObserver).toBeDefined();
    // globals.css turns this into scroll-padding-bottom.
    expect(root.style.getPropertyValue('--pinned-bottom')).toBe('120px');
    height = 200.4;
    dockObserver.callback();
    expect(root.style.getPropertyValue('--pinned-bottom')).toBe('201px');
    // Short viewport (DOCK_STATIC_QUERY): the dock does not stick, so no padding is reserved.
    position = 'static';
    window.dispatchEvent(new Event('resize'));
    expect(root.style.getPropertyValue('--pinned-bottom')).toBe('0px');
    view.unmount();
    expect(dockObserver.disconnect).toHaveBeenCalled();
    expect(root.style.getPropertyValue('--pinned-bottom')).toBe('');
  });
});

describe('ui-guided catalog', () => {
  it('is registered, and every key has the namespace', () => {
    for (const [key, text] of Object.entries(uiGuided)) {
      expect(key.startsWith('ui-guided.'), key).toBe(true);
      expect(MESSAGES[key], key).toBe(text);
    }
  });

  it('has a title for every screen and a name for every step', () => {
    for (const step of GUIDED_STEPS) {
      expect(uiGuided, step.id).toHaveProperty([`ui-guided.step.${step.id}`]);
      for (const id of step.screens) {
        expect(uiGuided, id).toHaveProperty([`ui-guided.${id}.title`]);
        expect(uiGuided, id).toHaveProperty([`ui-guided.${id}.reason`]);
      }
    }
  });

  it('uses every key it defines', () => {
    const sources = [guidedFlowSource, guidedDockSource, guidedPantrySource, guidedProgressSource, guidedScreensSource].join('\n');
    // Keys built from parts in the code (step names, screen texts, counts, salt options).
    const built = [
      /^ui-guided\.step\./,
      /^ui-guided\.(event|conditions|sweat|pantry|board)\.(title|reason)$/,
      /^ui-guided\.dock\.warnings\.(one|other)$/,
      /^ui-guided\.pantry\.salt\.(table|citrate|mix)$/,
      /^ui-guided\.pantry\.(powder|syrup)s$/,
    ];
    for (const key of Object.keys(uiGuided)) {
      if (built.some((pattern) => pattern.test(key))) continue;
      expect(sources.includes(`"${key}"`), key).toBe(true);
    }
  });

  it('writes no unit after an untyped number placeholder', () => {
    for (const [key, text] of Object.entries(uiGuided)) {
      expect(text, key).not.toMatch(/\{\w+\} ?(ml|L\b|kg|lb|%|°|km\/h|mph|cm|fl oz)/);
    }
  });
});

describe('GuidedFlow: German', () => {
  it('follows the UI language (English text until the German catalogs exist)', () => {
    renderGuided(undefined, { prefs: { ...GUIDED_PREFS, locale: 'de' } });
    expect(currentScreen()).toBe('event');
    // German numbers: no thousands separator issues for a 4-digit sodium, comma decimals.
    act(() => latest.set('event.durationMin', 600));
    expect(dockValue('sodium')).toBe(createFormat('de').number(latest.plan.sodium.mgPerHour));
  });
});
