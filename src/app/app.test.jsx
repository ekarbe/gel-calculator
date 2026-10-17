import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './app';
import { PlanProvider } from '../state/PlanProvider';
import { PREFS_KEY, UiProvider } from '../state/UiProvider';
import { listRecipes } from '../state/storage';

/*  The whole app with the real providers (autosave off, so no test sees
    another's inputs) and every real part: shell, setup, board, schedule,
    dialogs and print view. These tests cover the wiring between the parts;
    each part has its own tests. */

/** The app for a returning visitor in expert mode (unless `prefs` say otherwise). */
function renderApp({ initialInputs, prefs = { mode: 'expert' } } = {}) {
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  const user = userEvent.setup();
  const view = render(
    <PlanProvider initialInputs={initialInputs} persist={false}>
      <UiProvider>
        <App />
      </UiProvider>
    </PlanProvider>,
  );
  return { user, ...view };
}

const setup = () => screen.getByRole('region', { name: 'Setup' });
const scheduleList = () => within(screen.getByTestId('schedule')).getByRole('list', { name: 'Schedule' });
const scheduleTypes = () => within(scheduleList()).getAllByRole('listitem').map((li) => li.dataset.type);
const printedTypes = () =>
  within(screen.getByTestId('print-recipe'))
    .getAllByRole('row', { hidden: true })
    .filter((row) => row.dataset.type)
    .map((row) => row.dataset.type);
const pageToast = () => document.querySelector('[role="status"][data-toast-layer="page"]');

/** Sets the event duration in the Event section (hours and minutes). */
function setDuration(hours, minutes = 0) {
  const event = within(setup()).getByRole('region', { name: 'Event' });
  const h = within(event).getByRole('spinbutton', { name: 'Hours' });
  const m = within(event).getByRole('spinbutton', { name: 'Minutes' });
  fireEvent.change(h, { target: { value: String(hours) } });
  fireEvent.blur(h);
  fireEvent.change(m, { target: { value: String(minutes) } });
  fireEvent.blur(m);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  document.documentElement.lang = 'en';
});

describe('App', () => {
  it('renders the header, the setup, the race board, the schedule and the footer', () => {
    renderApp();
    expect(screen.getByRole('banner')).toHaveTextContent('Gel Calculator');
    expect(within(setup()).getAllByRole('heading', { level: 2 })).toHaveLength(8);
    expect(within(screen.getByRole('region', { name: 'Race board' })).getByRole('heading', { name: 'Race board' })).toBeInTheDocument();
    expect(screen.getByTestId('schedule')).toBeInTheDocument();
    expect(scheduleTypes().length).toBeGreaterThan(2);
    expect(screen.getByRole('contentinfo')).toHaveTextContent('By Eike Christian Karbe');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    // No dialog is open at first.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the four targets on the board, from the plan', () => {
    renderApp();
    const board = screen.getByRole('region', { name: 'Race board' });
    // [jeukendrup2014] 180 min at moderate intensity: middle of 60–90 g/h.
    expect(within(board).getByTestId('kpi-carbs-value')).toHaveTextContent(/^75$/);
    for (const id of ['kpi-carbs', 'kpi-sodium', 'kpi-fluid', 'kpi-caffeine']) {
      expect(within(board).getByTestId(id)).toBeInTheDocument();
    }
  });

  it('prints the print view instead of the app', () => {
    renderApp();
    const content = screen.getByTestId('app-shell');
    const print = screen.getByTestId('print-recipe');
    expect(content).toHaveClass('print:hidden');
    expect(screen.getByTestId('print-host')).toHaveClass('hidden', 'print:block');
    // The print view sits outside the hidden app content, and the app content holds the
    // header, the main area, the dialogs and the toast.
    expect(content).not.toContainElement(print);
    expect(content).toContainElement(screen.getByRole('banner'));
    expect(content).toContainElement(screen.getByRole('main'));
    expect(content).toContainElement(pageToast());
    expect(within(print).getByRole('heading', { level: 1, name: 'Race-day fuel plan', hidden: true })).toBeInTheDocument();
  });

  it('keeps the board, the schedule and the print view in step with the setup', () => {
    renderApp();
    const before = scheduleTypes();
    expect(printedTypes()).toEqual(before);
    setDuration(1, 0);
    // [jeukendrup2014] 45–75 min: 0–30 g/h or a mouth rinse; moderate is the middle.
    expect(screen.getByTestId('kpi-carbs-value')).toHaveTextContent(/^15$/);
    expect(scheduleTypes()).not.toEqual(before);
    expect(scheduleTypes()[0]).toBe('start');
    expect(scheduleTypes().at(-1)).toBe('finish');
    expect(printedTypes()).toEqual(scheduleTypes());
  });

  it('opens the gel templates through My recipes, and Share from the header', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: 'My recipes' }));
    await user.click(screen.getByRole('button', { name: 'Start from a gel template' }));
    expect(screen.getByRole('dialog', { name: 'Gel templates' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'My recipes' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Share' }));
    expect(screen.getByRole('dialog', { name: 'Share' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Gel templates' })).not.toBeInTheDocument();
  });

  it('opens the mixing steps from the board', async () => {
    const { user } = renderApp();
    await user.click(within(screen.getByRole('region', { name: 'Race board' })).getByRole('button', { name: 'Start mixing' }));
    expect(screen.getByRole('dialog', { name: 'Mixing steps' })).toBeInTheDocument();
  });

  it('saves the plan in My recipes and opens it again later', async () => {
    const { user } = renderApp();
    const threeHours = scheduleTypes();

    await user.click(screen.getByRole('button', { name: 'My recipes' }));
    const dialog = screen.getByRole('dialog', { name: 'My recipes' });
    await user.type(within(dialog).getByLabelText('Name'), 'Three hours{Enter}');
    expect(within(dialog).getByRole('status')).toHaveTextContent('Saved “Three hours”.');
    expect(listRecipes().map((recipe) => recipe.name)).toEqual(['Three hours']);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    setDuration(1, 0);
    expect(scheduleTypes()).not.toEqual(threeHours);

    await user.click(screen.getByRole('button', { name: 'My recipes' }));
    const reopened = screen.getByRole('dialog', { name: 'My recipes' });
    expect(within(reopened).getByTestId('recipes-current')).toHaveTextContent('15 g/h');
    const saved = within(reopened).getByRole('article', { name: 'Three hours' });
    expect(saved).toHaveTextContent('75 g/h');
    await user.click(within(saved).getByRole('button', { name: 'Open: Three hours' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pageToast()).toHaveTextContent('Opened “Three hours”.');
    expect(scheduleTypes()).toEqual(threeHours);
    expect(screen.getByTestId('kpi-carbs-value')).toHaveTextContent(/^75$/);
  });

  it('switches the phone tabs between the board, the setup and the schedule', async () => {
    const { user } = renderApp();
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    const tab = (name) => within(nav).getByRole('button', { name });
    expect(tab('Board')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('shell-board')).toHaveClass('block');
    expect(screen.getByTestId('shell-setup')).toHaveClass('hidden', 'lg:block');
    await user.click(tab('Setup'));
    expect(screen.getByTestId('shell-setup')).toHaveClass('block');
    expect(screen.getByTestId('shell-board')).toHaveClass('hidden', 'lg:block');
    await user.click(tab('Schedule'));
    expect(screen.getByTestId('shell-schedule')).toHaveClass('block');
    expect(screen.getByTestId('shell-setup')).toHaveClass('hidden', 'lg:block');
  });

  it('starts a first visit in the guided flow, and its board is the same plan', async () => {
    window.localStorage.removeItem(PREFS_KEY);
    const user = userEvent.setup();
    render(
      <PlanProvider persist={false}>
        <UiProvider>
          <App />
        </UiProvider>
      </PlanProvider>,
    );
    expect(screen.getByTestId('guided-flow')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Sections' })).not.toBeInTheDocument();
    await user.click(within(screen.getByRole('radiogroup', { name: 'Mode' })).getByRole('radio', { name: 'Expert' }));
    expect(screen.getByTestId('kpi-carbs-value')).toHaveTextContent(/^75$/);
  });

  it('sets <html lang> from the language pref', () => {
    // German catalogs come in the translation stage; until then each key falls back (with a warning).
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderApp({ prefs: { mode: 'expert', locale: 'de' } });
    expect(document.documentElement.lang).toBe('de');
  });

  it('says so when the page was opened with an old or damaged share link', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const v2 = btoa(JSON.stringify({ v: 2, d: 195 })).replace(/=+$/, '');
    window.history.replaceState({}, '', `/?s=${v2}`);
    renderApp();
    expect(pageToast()).toHaveTextContent(
      'This share link is from an older version or is damaged, so it could not be opened.',
    );
    // The unreadable link is removed from the address bar.
    expect(window.location.search).toBe('');
  });

  it('shows no notice without a share link', () => {
    renderApp();
    expect(pageToast()).toHaveTextContent('');
  });

  it('needs the providers', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<App />)).toThrow(/Provider/);
  });
});
