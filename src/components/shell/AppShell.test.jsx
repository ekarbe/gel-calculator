import { describe, it, expect, afterEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, within, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppShell, { SETUP_SECTIONS, DIALOGS, SHARE_LINK_NOTICE_MS, UNSAVED_NOTICE_MS } from './AppShell';
import { SHORT_VIEWPORT_QUERY } from './ShellHeader';
import { PlanProvider, usePlanInputs } from '../../state/PlanProvider';
import { UiProvider, UiContext, PREFS_KEY, useUi } from '../../state/UiProvider';
import { createT } from '../../i18n';

/** The latest `useUi()` and plan inputs, captured after every render. */
const latest = { ui: null, inputs: null };

/** Hands the latest `useUi()` and plan inputs to the test (`latest.ui`, `latest.inputs`). */
function Capture() {
  const ui = useUi();
  const { inputs } = usePlanInputs();
  useEffect(() => {
    latest.ui = ui;
    latest.inputs = inputs;
  });
  return null;
}

function renderShell({ prefs = { mode: 'expert' } } = {}) {
  if (prefs) window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  else window.localStorage.removeItem(PREFS_KEY);
  return render(
    <PlanProvider persist={false}>
      <UiProvider>
        <Capture />
        <AppShell />
      </UiProvider>
    </PlanProvider>,
  );
}

/** Like the real provider, but the prefs are still unresolved (the first render of the static page). */
function PrefsPending({ children }) {
  const api = useUi();
  return <UiContext.Provider value={{ ...api, prefsReady: false }}>{children}</UiContext.Provider>;
}

const SHARE_LINK_TEXT = 'This share link is from an older version or is damaged, so it could not be opened.';
const pageToast = () => document.querySelector('[role="status"][data-toast-layer="page"]');
const modeRadio = (name) => within(screen.getByRole('radiogroup', { name: 'Mode' })).getByRole('radio', { name });
const tabBar = () => screen.queryByRole('navigation', { name: 'Sections' });
const shellOf = () => screen.getByTestId('app-shell');

/** jsdom's own `window.scrollY` (always 0), put back after each test. */
const ORIGINAL_SCROLL_Y = Object.getOwnPropertyDescriptor(window, 'scrollY');

/** Makes `window.scrollY` settable and `window.scrollTo` move it; returns the spy. */
function fakeWindowScroll(start = 0) {
  let y = start;
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => y });
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation((options) => {
    y = typeof options === 'object' ? options.top : options;
  });
  return {
    scrollTo,
    setY(value) {
      y = value;
    },
  };
}

afterEach(() => {
  window.history.replaceState({}, '', '/');
  window.localStorage.clear();
  document.documentElement.lang = 'en';
  document.title = '';
  if (ORIGINAL_SCROLL_Y) Object.defineProperty(window, 'scrollY', ORIGINAL_SCROLL_Y);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('AppShell: frame and landmarks', () => {
  it('has the landmarks, a skip link and one h1', () => {
    renderShell();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#main');
    // One h1 on screen (the print view has its own, and is hidden on screen).
    expect(within(shellOf()).getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(within(shellOf()).getByRole('heading', { level: 1, name: 'Gel Calculator' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Setup' })).toBeInTheDocument();
    // A named region in main, not a complementary landmark (it is the main content on phones,
    // and a complementary nested in main fails axe's landmark-complementary-is-top-level).
    expect(screen.getByRole('region', { name: 'Race board' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('region', { name: 'Race board' }));
    expect(tabBar()).toBeInTheDocument();
    // Header buttons are not a navigation landmark: the tab bar is the only one.
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(pageToast()).toBeInTheDocument();
    // The skip link comes first, before the header.
    const shell = screen.getByTestId('app-shell');
    expect(shell.firstElementChild).toBe(screen.getByRole('link', { name: 'Skip to main content' }));
  });

  it('renders every setup section, the board, the schedule, the dialogs host and the print host', () => {
    renderShell();
    expect(SETUP_SECTIONS).toHaveLength(8);
    expect(DIALOGS).toHaveLength(5);
    const setup = screen.getByRole('region', { name: 'Setup' });
    expect(within(setup).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Event',
      'Body & weather',
      'Sweat',
      'Targets',
      'Ingredients',
      'Salts',
      'Format',
      'Caffeine & bicarbonate',
    ]);
    expect(within(screen.getByRole('region', { name: 'Race board' })).getByRole('heading', { name: 'Race board' })).toBeInTheDocument();
    expect(within(screen.getByTestId('shell-schedule')).getByRole('heading', { name: 'Schedule' })).toBeInTheDocument();
    expect(within(screen.getByTestId('print-host')).getByRole('heading', { name: 'Race-day fuel plan', hidden: true })).toBeInTheDocument();
    expect(screen.getByTestId('print-host')).toHaveClass('hidden', 'print:block');
    expect(screen.getByTestId('app-shell')).toHaveClass('print:hidden');
    expect(screen.getByTestId('app-shell')).not.toContainElement(screen.getByTestId('print-host'));
    // No dialog is open at first.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the race board in view on desktop while the setup column scrolls with the page', () => {
    renderShell();
    const board = screen.getByTestId('shell-board').className.split(' ');
    // Sticky under the header's measured height, and never taller than the screen below it (globals.css).
    expect(board).toEqual(expect.arrayContaining(['lg:sticky-below-header', 'lg:self-start', 'lg:overflow-y-auto']));
    const setup = screen.getByTestId('shell-setup').className;
    expect(setup).not.toMatch(/sticky|overflow-y-auto|max-h-/);
    // The full schedule follows the two-column grid (not a row of it): the sticky board's containing
    // block ends with the columns, so the board never covers the schedule.
    const schedule = screen.getByTestId('shell-schedule');
    const columns = screen.getByTestId('shell-columns');
    expect(columns).toContainElement(screen.getByTestId('shell-board'));
    expect(columns).not.toContainElement(schedule);
    expect(columns.nextElementSibling).toBe(schedule);
  });

  it('leaves room for the fixed tab bar on phones (expert mode only)', () => {
    renderShell();
    const shell = screen.getByTestId('app-shell');
    expect(shell.className).toMatch(/pb-\[calc\(3\.5rem\+1px\+env\(safe-area-inset-bottom\)\)\]/);
    expect(shell).toHaveClass('lg:pb-0', 'px-safe');
    const bar = screen.getByTestId('shell-tabbar');
    expect(bar).toHaveClass('fixed', 'bottom-0', 'pb-safe', 'px-safe', 'lg:hidden');
    // Short viewports (a landscape phone, 400 % zoom): neither bar is pinned, and no room is kept.
    expect(SHORT_VIEWPORT_QUERY).toBe('(max-height: 32rem)');
    const shortStatic = `[@media${SHORT_VIEWPORT_QUERY.replace(/\s/g, '')}]:static`;
    expect(bar).toHaveClass(shortStatic);
    expect(screen.getByTestId('shell-header')).toHaveClass('sticky', shortStatic);
    expect(shell).toHaveClass('[@media(max-height:32rem)]:pb-0');
  });

  it('shows no layout until the prefs are resolved (no flash of the expert layout)', () => {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ mode: 'guided' }));
    render(
      <PlanProvider persist={false}>
        <UiProvider>
          <PrefsPending>
            <AppShell />
          </PrefsPending>
        </UiProvider>
      </PlanProvider>,
    );
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-busy', 'true');
    expect(main).toBeEmptyDOMElement();
    expect(screen.queryByTestId('shell-setup')).toBeNull();
    expect(screen.queryByTestId('guided-flow')).toBeNull();
    expect(tabBar()).toBeNull();
    // The header, the footer and the toast region are there from the start.
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(pageToast()).toBeInTheDocument();
  });

  it('shows the guided flow at once for a first visit once the prefs resolve', () => {
    renderShell({ prefs: null });
    expect(screen.getByRole('main')).not.toHaveAttribute('aria-busy');
    expect(screen.getByRole('main')).toContainElement(screen.getByTestId('guided-flow'));
    expect(screen.queryByTestId('shell-setup')).toBeNull();
    // No tab bar in guided mode: the step list and the dock are its navigation.
    expect(tabBar()).toBeNull();
    expect(screen.getByTestId('app-shell').className).not.toMatch(/pb-\[calc/);
    expect(modeRadio('Guided')).toBeChecked();
  });

  it('sets the document language and title from the UI locale, and follows it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderShell({ prefs: { locale: 'de', mode: 'expert' } });
    expect(document.documentElement.lang).toBe('de');
    expect(document.title).toBe(createT('de')('ui-shell.meta.title'));
    expect(document.title).toMatch(/^Rechner für DIY-Energiegels/);
    act(() => latest.ui.setLocale('en'));
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe('DIY Energy Gel & Sports Drink Calculator | Optimize Your Fuel');
    // Every shell key has a German twin: nothing falls back to English.
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('AppShell: header', () => {
  it('opens the dialogs from the header and returns focus on Escape', async () => {
    const user = userEvent.setup();
    renderShell();
    const settings = screen.getByRole('button', { name: 'Settings' });
    expect(settings).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(settings);
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(settings).toHaveFocus();

    const recipes = screen.getByRole('button', { name: 'My recipes' });
    expect(recipes).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(recipes);
    expect(screen.getByRole('dialog', { name: 'My recipes' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(recipes).toHaveFocus();

    const share = within(screen.getByRole('banner')).getByRole('button', { name: 'Share' });
    expect(share).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(share);
    expect(screen.getByRole('dialog', { name: 'Share' })).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog', { name: 'Share' })).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(share).toHaveFocus();
  });

  it('reaches the templates through My recipes', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'My recipes' }));
    await user.click(within(screen.getByRole('dialog', { name: 'My recipes' })).getByRole('button', { name: 'Start from a gel template' }));
    expect(screen.getByRole('dialog', { name: 'Gel templates' })).toBeInTheDocument();
  });

  it('keeps the names on phones while showing only the logo and icons', () => {
    renderShell();
    const banner = screen.getByRole('banner');
    // The wordmark stays the h1's text; below 640 px it is visually hidden.
    expect(within(banner).getByRole('heading', { level: 1 })).toHaveClass('max-sm:sr-only');
    for (const name of ['My recipes', 'Share']) {
      const button = within(banner).getByRole('button', { name });
      expect(button.className).toMatch(/max-sm:size-9/);
      expect(within(button).getByText(name)).toHaveClass('max-sm:sr-only');
      expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
    // The logo is decorative.
    expect(banner.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('AppShell: phone tab bar', () => {
  it('switches the views', async () => {
    const user = userEvent.setup();
    renderShell();
    const tabs = tabBar();
    const tab = (name) => within(tabs).getByRole('button', { name });
    expect(within(tabs).getAllByRole('button').map((b) => b.textContent)).toEqual(['Board', 'Setup', 'Schedule']);
    expect(tab('Board')).toHaveAttribute('aria-pressed', 'true');
    expect(tab('Setup')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('shell-board')).toHaveClass('block');
    expect(screen.getByTestId('shell-setup')).toHaveClass('hidden', 'lg:block');
    expect(screen.getByTestId('shell-schedule')).toHaveClass('hidden', 'lg:block');

    await user.click(tab('Setup'));
    expect(tab('Setup')).toHaveAttribute('aria-pressed', 'true');
    expect(tab('Board')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('shell-setup')).toHaveClass('block');
    expect(screen.getByTestId('shell-setup')).not.toHaveClass('hidden');
    expect(screen.getByTestId('shell-board')).toHaveClass('hidden', 'lg:block');

    await user.click(tab('Schedule'));
    expect(screen.getByTestId('shell-schedule')).toHaveClass('block');
    expect(tab('Schedule')).toHaveAttribute('aria-pressed', 'true');
    // The pressed tab keeps the focus.
    expect(tab('Schedule')).toHaveFocus();
  });

  it('marks the current tab by more than colour', async () => {
    const user = userEvent.setup();
    renderShell();
    const tab = (name) => within(tabBar()).getByRole('button', { name });
    expect(tab('Board')).toHaveClass('border-ink', 'font-semibold');
    expect(tab('Setup')).toHaveClass('border-transparent');
    await user.click(tab('Setup'));
    expect(tab('Setup')).toHaveClass('border-ink', 'font-semibold');
    expect(tab('Board')).not.toHaveClass('font-semibold');
  });

  it('keeps the scroll position of each view', () => {
    const scroll = fakeWindowScroll();
    renderShell();
    const tab = (name) => within(tabBar()).getByRole('button', { name });
    // Board scrolled down, then Setup: the new view starts at the top.
    scroll.setY(400);
    fireEvent.click(tab('Setup'));
    expect(window.scrollY).toBe(0);
    // Setup scrolled further, then Board: back where the board was.
    scroll.setY(1200);
    fireEvent.click(tab('Board'));
    expect(window.scrollY).toBe(400);
    fireEvent.click(tab('Setup'));
    expect(window.scrollY).toBe(1200);
    // Pressing the current tab does nothing.
    scroll.scrollTo.mockClear();
    fireEvent.click(tab('Setup'));
    expect(scroll.scrollTo).not.toHaveBeenCalled();
  });

  it('lets the board switch to the schedule without moving the page back', () => {
    const scroll = fakeWindowScroll();
    renderShell();
    scroll.setY(300);
    scroll.scrollTo.mockClear();
    // A switch from elsewhere (the board's "Full schedule") scrolls itself; the shell keeps out.
    act(() => latest.ui.setBoardTab('schedule'));
    expect(scroll.scrollTo).not.toHaveBeenCalled();
    expect(within(tabBar()).getByRole('button', { name: 'Schedule' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('AppShell: mode switch', () => {
  it('switches to guided and back, keeping the focus on the switch', async () => {
    const user = userEvent.setup();
    renderShell();
    expect(modeRadio('Expert')).toBeChecked();
    await user.click(modeRadio('Guided'));
    expect(screen.getByTestId('guided-flow')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Setup' })).toBeNull();
    expect(tabBar()).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(PREFS_KEY)).mode).toBe('guided');
    expect(modeRadio('Guided')).toHaveFocus();

    await user.click(modeRadio('Expert'));
    expect(latest.ui.mode).toBe('expert');
    expect(screen.queryByTestId('guided-flow')).toBeNull();
    expect(screen.getByRole('region', { name: 'Setup' })).toBeInTheDocument();
    expect(modeRadio('Expert')).toHaveFocus();
    expect(JSON.parse(window.localStorage.getItem(PREFS_KEY)).mode).toBe('expert');
  });

  it('works with the arrow keys (a radio group)', async () => {
    const user = userEvent.setup();
    renderShell();
    modeRadio('Expert').focus();
    await user.keyboard('{ArrowLeft}');
    expect(latest.ui.mode).toBe('guided');
    expect(modeRadio('Guided')).toHaveFocus();
  });

  it('keeps every input across the switch', async () => {
    const user = userEvent.setup();
    renderShell();
    act(() => latest.ui.setBoardTab('setup'));
    const hours = within(screen.getByRole('region', { name: 'Setup' })).getByRole('spinbutton', { name: 'Hours' });
    fireEvent.change(hours, { target: { value: '4' } });
    fireEvent.blur(hours);
    expect(latest.inputs.event.durationMin).toBe(240);
    await user.click(modeRadio('Guided'));
    expect(within(screen.getByTestId('guided-flow')).getByRole('spinbutton', { name: 'Hours' })).toHaveValue('4');
    await user.click(modeRadio('Expert'));
    expect(latest.inputs.event.durationMin).toBe(240);
  });

  it('scrolls to the top when the layout changes', async () => {
    const user = userEvent.setup();
    const scroll = fakeWindowScroll();
    renderShell();
    scroll.setY(900);
    await user.click(modeRadio('Guided'));
    expect(window.scrollY).toBe(0);
  });

  it('does not drop an open setup form: it shows it, says so, and a second press leaves', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(within(screen.getByRole('region', { name: 'Setup' })).getByRole('button', { name: 'New ingredient' }));
    const form = screen.getByRole('form', { name: 'New ingredient' });
    await user.type(within(form).getByRole('textbox', { name: 'Name' }), 'Rice syrup');
    expect(latest.ui.boardTab).toBe('board');

    await user.click(modeRadio('Guided'));
    expect(latest.ui.mode).toBe('expert');
    expect(modeRadio('Expert')).toBeChecked();
    // The Setup view (with the form) is shown on phones, and the focus is in the form.
    expect(latest.ui.boardTab).toBe('setup');
    expect(form).toContainElement(document.activeElement);
    expect(pageToast()).toHaveTextContent(
      'This form is not saved yet. Save or cancel it first, or select Guided again to leave without it.',
    );
    expect(pageToast().querySelector('svg').getAttribute('class')).toContain('text-warn');

    await user.click(modeRadio('Guided'));
    expect(latest.ui.mode).toBe('guided');
    expect(screen.getByTestId('guided-flow')).toBeInTheDocument();
  });

  it('warns again about a new form, and leaves at once when no form is open', async () => {
    const user = userEvent.setup();
    renderShell();
    const setup = () => screen.getByRole('region', { name: 'Setup' });
    await user.click(within(setup()).getByRole('button', { name: 'New ingredient' }));
    await user.click(modeRadio('Guided'));
    expect(latest.ui.mode).toBe('expert');
    // Cancel, then a new form: a new warning.
    await user.click(within(screen.getByRole('form', { name: 'New ingredient' })).getByRole('button', { name: 'Cancel' }));
    await user.click(within(setup()).getByRole('button', { name: 'New ingredient' }));
    act(() => latest.ui.hideToast());
    await user.click(modeRadio('Guided'));
    expect(latest.ui.mode).toBe('expert');
    expect(pageToast()).toHaveTextContent('This form is not saved yet.');
    // No form: the switch leaves at once.
    await user.click(within(screen.getByRole('form', { name: 'New ingredient' })).getByRole('button', { name: 'Cancel' }));
    await user.click(modeRadio('Guided'));
    expect(latest.ui.mode).toBe('guided');
  });

  it('keeps the warning up for a while', async () => {
    vi.useFakeTimers();
    renderShell();
    fireEvent.click(within(screen.getByRole('region', { name: 'Setup' })).getByRole('button', { name: 'New ingredient' }));
    fireEvent.click(modeRadio('Guided'));
    act(() => vi.advanceTimersByTime(UNSAVED_NOTICE_MS - 100));
    expect(pageToast()).toHaveTextContent('This form is not saved yet.');
    act(() => vi.advanceTimersByTime(200));
    expect(pageToast()).toBeEmptyDOMElement();
  });

  it("uses the guided flow's check when leaving guided mode, naming the header's button", async () => {
    const user = userEvent.setup();
    renderShell({ prefs: { mode: 'guided' } });
    act(() => latest.ui.setGuidedStep(1));
    await user.click(screen.getByTestId('guided-next'));
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Add a sweat test' }));
    const form = screen.getByRole('form', { name: 'Add a sweat test' });
    await user.click(screen.getByTestId('guided-next'));
    expect(form).not.toBeVisible();

    await user.click(modeRadio('Expert'));
    expect(latest.ui.mode).toBe('guided');
    expect(form).toBeVisible();
    expect(form).toContainElement(document.activeElement);
    expect(screen.getByTestId('guided-leave-note')).toHaveTextContent(
      'This form is not saved yet. Save or cancel it first, or select Expert again to leave without it.',
    );

    await user.click(modeRadio('Expert'));
    expect(latest.ui.mode).toBe('expert');
    expect(screen.queryByTestId('guided-flow')).toBeNull();
    expect(modeRadio('Expert')).toHaveFocus();
  });
});

describe('AppShell: notices', () => {
  it('says so, once and as a warning, when a share link could not be opened', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();
    window.history.replaceState({}, '', `/?s=${btoa(JSON.stringify({ v: 2 }))}`);
    renderShell();
    expect(pageToast()).toHaveTextContent(SHARE_LINK_TEXT);
    // A warning icon, not the success check.
    expect(pageToast().querySelector('svg').getAttribute('class')).toContain('text-warn');
    // The unreadable link is removed from the address bar.
    expect(window.location.search).toBe('');
    act(() => vi.advanceTimersByTime(SHARE_LINK_NOTICE_MS));
    expect(pageToast()).toBeEmptyDOMElement();
    // A new translate function (other units, language or currency) does not show it again.
    act(() => latest.ui.setUnitSystem('imperial'));
    act(() => latest.ui.setLocale('de'));
    act(() => latest.ui.setCurrency('GBP'));
    expect(pageToast()).toBeEmptyDOMElement();
  });

  it('shows no notice without a share link', () => {
    renderShell();
    expect(pageToast()).toBeEmptyDOMElement();
  });

  it('shows a toast inside an open dialog and hides the page toast under it', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Share' }));
    const dialog = screen.getByRole('dialog', { name: 'Share' });
    act(() => latest.ui.showToast('Recipe link copied!', { tone: 'ok' }));
    expect(within(dialog).getByRole('status')).toHaveTextContent('Recipe link copied!');
    // The page toast is inert under the modal dialog; CSS hides it while a modal dialog is open.
    expect(pageToast().className).toContain('[body:has(dialog:modal)_&]:hidden');
  });
});

describe('AppShell: footer', () => {
  it('names the author and links to the profiles in a new tab', () => {
    renderShell();
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent('By Eike Christian Karbe');
    const links = within(within(footer).getByRole('list', { name: 'Links' })).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://www.strava.com/athletes/58442765',
      'https://github.com/ekarbe',
    ]);
    expect(within(footer).getByRole('link', { name: 'Strava (opens in a new tab)' })).toBeInTheDocument();
    expect(within(footer).getByRole('link', { name: 'GitHub (opens in a new tab)' })).toBeInTheDocument();
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
      expect(link).toHaveClass('size-11');
      expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
  });
});

describe('AppShell: design tokens only', () => {
  it('uses no hex colours, Apple palette or legacy classes', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = join(process.cwd(), 'src/components/shell');
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.jsx') && !name.endsWith('.test.jsx'))) {
      const source = readFileSync(join(dir, file), 'utf8');
      expect(source, file).not.toMatch(/apple-|glass-card|#[0-9a-f]{3,6}\b|text-text-|bg-bg-primary|bg-card/i);
    }
  });
});
