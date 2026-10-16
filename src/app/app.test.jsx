import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './app';
import { PlanProvider, usePlanInputs } from '../state/PlanProvider';
import { UiProvider } from '../state/UiProvider';
import { listRecipes } from '../state/storage';

// Cards and modals owned by other parts of the app are replaced by markers so
// this test covers the layout and the shell wiring. Header, VisualTimeline,
// RecipesModal, PrintRecipe and Toast stay real, as do both providers.
vi.mock('../components/feature/ActivityBasics', () => ({ default: () => <div data-testid="activity-basics" /> }));
vi.mock('../components/feature/CarbMatrix', () => ({ default: () => <div data-testid="carb-matrix" /> }));
vi.mock('../components/feature/ElectrolytesHydration', () => ({ default: () => <div data-testid="electrolytes-hydration" /> }));
vi.mock('../components/feature/BalanceAnalysis', () => ({ default: () => <div data-testid="balance-analysis" /> }));
vi.mock('../components/feature/FinalRecipe', () => ({ default: () => <div data-testid="final-recipe" /> }));
vi.mock('../components/shared/Footer', () => ({ default: () => <div data-testid="footer" /> }));
vi.mock('../components/modal/MixingModal', async () => {
  const { useUi } = await import('../state/UiProvider');
  return {
    default: function MixingModalMock() {
      return useUi().isModalOpen('mixing') ? <div role="dialog" aria-label="Mixing" /> : null;
    },
  };
});
vi.mock('../components/modal/ShareModal', async () => {
  const { useUi } = await import('../state/UiProvider');
  return {
    default: function ShareModalMock() {
      return useUi().isModalOpen('share') ? <div role="dialog" aria-label="Share" /> : null;
    },
  };
});
vi.mock('../components/modal/TemplateModal', async () => {
  const { useUi } = await import('../state/UiProvider');
  return {
    default: function TemplateModalMock() {
      return useUi().isModalOpen('templates') ? <div role="dialog" aria-label="Pre-Mix Templates" /> : null;
    },
  };
});

/** Stands in for the input cards: changes the duration. */
function DurationControl() {
  const { set } = usePlanInputs();
  return (
    <button type="button" onClick={() => set('event.durationMin', 60)}>
      Set 60 min
    </button>
  );
}

/** The app with the real providers (autosave off, so no test sees another's inputs). */
function renderApp(initialInputs) {
  const user = userEvent.setup();
  const view = render(
    <PlanProvider initialInputs={initialInputs} persist={false}>
      <UiProvider>
        <App />
        <DurationControl />
      </UiProvider>
    </PlanProvider>,
  );
  return { user, ...view };
}

/** The layout column that holds a card (the element that is shown or hidden per phone tab). */
const columnOf = (testId) => screen.getByTestId(testId).parentElement;
const schedule = () => screen.getByRole('list', { name: 'Schedule' });
const scheduleTypes = () => within(schedule()).getAllByRole('listitem').map((li) => li.dataset.type);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('App', () => {
  it('renders the header, every card, the footer and the schedule', () => {
    renderApp();
    expect(screen.getByRole('banner')).toHaveTextContent('Gel-Calculator');
    for (const id of ['activity-basics', 'electrolytes-hydration', 'carb-matrix', 'final-recipe', 'balance-analysis', 'footer']) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    expect(screen.getByRole('heading', { name: 'Execution Schedule' })).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    // No modal is open at first.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('prints the print view instead of the app', () => {
    renderApp();
    const content = screen.getByTestId('app-content');
    const print = screen.getByTestId('print-recipe');
    expect(content).toHaveClass('print:hidden');
    expect(print).toHaveClass('hidden', 'print:block');
    // The print view sits outside the hidden app content, and the app content holds the
    // header, the main area, the modals and the toast.
    expect(content).not.toContainElement(print);
    expect(content).toContainElement(screen.getByRole('banner'));
    expect(content).toContainElement(screen.getByRole('main'));
    expect(content).toContainElement(screen.getByRole('status'));
    expect(within(print).getByRole('heading', { level: 1, name: 'Gel-Calculator fuel plan' })).toBeInTheDocument();
  });

  it('keeps the print view in step with the plan', () => {
    renderApp();
    const printedRows = () =>
      within(within(screen.getByTestId('print-recipe')).getByRole('table', { name: 'Race-day schedule' }))
        .getAllByRole('row')
        .slice(1);
    expect(printedRows().map((row) => row.dataset.type)).toEqual(scheduleTypes());
    fireEvent.click(screen.getByRole('button', { name: 'Set 60 min' }));
    expect(scheduleTypes()).toEqual(['start', 'fuel', 'fuel', 'finish']);
    expect(printedRows().map((row) => row.dataset.type)).toEqual(scheduleTypes());
  });

  it('opens the templates and share modals from the header', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
    expect(screen.getByRole('dialog', { name: 'Pre-Mix Templates' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Share Link' }));
    expect(screen.getByRole('dialog', { name: 'Share' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Pre-Mix Templates' })).not.toBeInTheDocument();
  });

  it('saves the plan in My recipes and opens it again later', async () => {
    const { user } = renderApp();
    expect(scheduleTypes()).toHaveLength(10);

    await user.click(screen.getByRole('button', { name: 'My recipes' }));
    const dialog = screen.getByRole('dialog', { name: 'My recipes' });
    await user.type(within(dialog).getByLabelText('Name'), 'Three hours{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('Saved "Three hours".');
    expect(listRecipes().map((recipe) => recipe.name)).toEqual(['Three hours']);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Set 60 min' }));
    expect(scheduleTypes()).toEqual(['start', 'fuel', 'fuel', 'finish']);

    await user.click(screen.getByRole('button', { name: 'My recipes' }));
    const reopened = screen.getByRole('dialog', { name: 'My recipes' });
    expect(within(reopened).getByTestId('recipes-current')).toHaveTextContent('1 h · 15 g/h · Gel');
    const saved = within(reopened).getByRole('article', { name: 'Three hours' });
    expect(saved).toHaveTextContent('3 h · 75 g/h · Gel');
    await user.click(within(saved).getByRole('button', { name: 'Open: Three hours' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Opened "Three hours".');
    expect(scheduleTypes()).toHaveLength(10);
    expect(within(schedule()).getAllByRole('listitem').at(-1)).toHaveTextContent('T+3h');
  });

  it('switches the phone tabs between setup, recipe and analysis', () => {
    renderApp();
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    const tab = (name) => within(nav).getByRole('button', { name });

    expect(tab('Setup')).toHaveAttribute('id', 'mobile-tab-inputs');
    expect(tab('Recipe')).toHaveAttribute('id', 'mobile-tab-recipe');
    expect(tab('Analysis')).toHaveAttribute('id', 'mobile-tab-analysis');

    expect(tab('Setup')).toHaveAttribute('aria-pressed', 'true');
    expect(columnOf('activity-basics')).toHaveClass('block');
    expect(columnOf('final-recipe')).toHaveClass('hidden', 'md:block');
    expect(columnOf('balance-analysis')).toHaveClass('hidden', 'md:block');

    fireEvent.click(tab('Recipe'));
    expect(tab('Recipe')).toHaveAttribute('aria-pressed', 'true');
    expect(tab('Setup')).toHaveAttribute('aria-pressed', 'false');
    expect(columnOf('final-recipe')).toHaveClass('block');
    expect(columnOf('final-recipe')).not.toHaveClass('hidden');
    expect(columnOf('activity-basics')).toHaveClass('hidden', 'md:block');

    fireEvent.click(tab('Analysis'));
    expect(columnOf('balance-analysis')).toHaveClass('block');
    expect(columnOf('balance-analysis')).not.toHaveClass('hidden');
    const timelineColumn = screen.getByRole('heading', { name: 'Execution Schedule' }).closest('.glass-card').parentElement;
    expect(timelineColumn).toHaveClass('block');
    expect(timelineColumn).not.toHaveClass('hidden');
    expect(columnOf('final-recipe')).toHaveClass('hidden', 'md:block');
  });

  it('says so when the page was opened with an old or damaged share link', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const v2 = btoa(JSON.stringify({ v: 2, d: 195 })).replace(/=+$/, '');
    window.history.replaceState({}, '', `/?s=${v2}`);
    renderApp();
    expect(screen.getByRole('status')).toHaveTextContent(
      'This share link is from an older version or is damaged, so it could not be opened.',
    );
    // The unreadable link is removed from the address bar.
    expect(window.location.search).toBe('');
  });

  it('shows no notice without a share link', () => {
    renderApp();
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('needs the providers', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<App />)).toThrow(/Provider/);
  });
});
