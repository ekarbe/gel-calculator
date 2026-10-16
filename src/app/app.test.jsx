import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from './app';
import { PlanProvider } from '../state/PlanProvider';
import { UiProvider } from '../state/UiProvider';

// Cards and modals owned by other parts of the app are replaced by markers so
// this test covers the layout and the shell wiring. Header, TemplateModal,
// VisualTimeline and Toast stay real.
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

function renderApp(initialInputs) {
  return render(
    <PlanProvider initialInputs={initialInputs}>
      <UiProvider>
        <App />
      </UiProvider>
    </PlanProvider>,
  );
}

/** The layout column that holds a card (the element that is shown or hidden per phone tab). */
const columnOf = (testId) => screen.getByTestId(testId).parentElement;

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

  it('opens the templates modal from the header, applies a template and shows the toast', () => {
    renderApp();
    const schedule = () => screen.getByRole('list', { name: 'Schedule' });
    expect(within(schedule()).getAllByRole('listitem').filter((li) => li.dataset.type === 'fuel')).toHaveLength(8);

    fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
    const dialog = screen.getByRole('dialog', { name: 'Pre-Mix Templates' });
    // SiS GO (22 g per gel) at 75 g/h → 3.5 gels/h → 11 gels in 3 h.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use template: SiS GO Isotonic Energy Gel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('SiS GO Isotonic Energy Gel template applied')).toBeInTheDocument();
    expect(within(schedule()).getAllByRole('listitem').filter((li) => li.dataset.type === 'fuel')).toHaveLength(10);
    expect(schedule()).toHaveTextContent('Take gel 11');
  });

  it('opens the share modal from the header', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Share Link' }));
    expect(screen.getByRole('dialog', { name: 'Share' })).toBeInTheDocument();
  });

  it('switches the phone tabs between setup, recipe and analysis', () => {
    renderApp();
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    const tab = (name) => within(nav).getByRole('button', { name });

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
    try {
      renderApp();
      expect(screen.getByRole('status')).toHaveTextContent(
        'This share link is from an older version or is damaged, so the default plan is shown.',
      );
    } finally {
      window.history.replaceState({}, '', '/');
      vi.restoreAllMocks();
    }
  });

  it('shows no notice without a share link', () => {
    renderApp();
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('needs the providers', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<App />)).toThrow(/Provider/);
    vi.restoreAllMocks();
  });
});
