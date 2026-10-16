import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import VisualTimeline from './VisualTimeline';
import { PlanProvider, usePlanInputs } from '../../state/PlanProvider';
import { computePlan } from '../../domain/plan';
import { formatElapsed } from '../../domain/schedule';
import { t } from '../../i18n';

/**
 * A preset sweat rate of 1.25 L/h (rate index 2), so the plan drinks the
 * 800 ml/h cap: 266.7 ml per 20 min, listed as 260, 270, 270, … ml.
 */
const PRESET_SWEAT = { sweat: { source: 'preset' } };

/** Buttons that change the inputs, so tests can check the timeline follows the plan. */
function Controls() {
  const { set } = usePlanInputs();
  return (
    <>
      <button type="button" onClick={() => set('event.durationMin', 60)}>
        Set 60 min
      </button>
      <button type="button" onClick={() => set('format.type', 'drink')}>
        Switch to drink
      </button>
    </>
  );
}

/** The timeline with the real provider (autosave off, so no test sees another's inputs). */
function renderTimeline(initialInputs) {
  return render(
    <PlanProvider initialInputs={initialInputs} persist={false}>
      <VisualTimeline />
      <Controls />
    </PlanProvider>,
  );
}

const scheduleItems = () => within(screen.getByRole('list', { name: 'Schedule' })).getAllByRole('listitem');
const types = () => scheduleItems().map((li) => li.dataset.type);

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('VisualTimeline: gel schedule', () => {
  it('renders the default plan: start with gel 1, gels 2–9 every 20 min, finish at 3 h', () => {
    renderTimeline();
    expect(screen.getByRole('heading', { name: 'Execution Schedule' })).toBeInTheDocument();
    expect(types()).toEqual(['start', ...Array(8).fill('fuel'), 'finish']);

    const items = scheduleItems();
    // Default plan: the heat-balance estimate gives 0.15 L/h sweat, so 100 ml/h fluid.
    // 33.3 ml per gel, rounded on the running total: 30, 30, 40, 30, ….
    expect(items[0]).toHaveTextContent('T+0m');
    expect(within(items[0]).getByRole('heading', { name: 'Start' })).toBeInTheDocument();
    expect(items[0]).toHaveTextContent('Start your activity and take gel 1 with about 30 ml fluid.');
    expect(items[2]).toHaveTextContent('T+40m');
    expect(items[2]).toHaveTextContent('Take gel 3 with about 40 ml fluid.');
    expect(items[9]).toHaveTextContent('T+3h');
    expect(within(items[9]).getByRole('heading', { name: 'Finish' })).toBeInTheDocument();
    expect(items[9]).toHaveTextContent('Finish. Begin your recovery.');
    // Gels carry the fluid, so there is no bottle note.
    expect(screen.queryByTestId('bottle-note')).not.toBeInTheDocument();
  });

  it('lists the fluid with each gel at a higher sweat rate', () => {
    renderTimeline(PRESET_SWEAT);
    const items = scheduleItems();
    expect(items[0]).toHaveTextContent('Start your activity and take gel 1 with about 260 ml fluid.');
    expect(items[1]).toHaveTextContent('T+20m');
    expect(items[1]).toHaveTextContent('Take gel 2 with about 270 ml fluid.');
    expect(items[8]).toHaveTextContent('T+2h 40m');
    expect(items[8]).toHaveTextContent('Take gel 9 with about 270 ml fluid.');
  });

  it('renders every event of plan.schedule with formatElapsed and t()', () => {
    const inputs = {
      event: { durationMin: 200 },
      caffeine: { enabled: true, asIngredient: true },
      bicarb: { enabled: true },
    };
    renderTimeline(inputs);
    const { schedule } = computePlan(inputs);
    const items = scheduleItems();
    expect(items).toHaveLength(schedule.length);
    schedule.forEach((event, i) => {
      expect(items[i].dataset.type).toBe(event.type);
      expect(items[i]).toHaveTextContent(formatElapsed(event.timeMin));
      expect(items[i]).toHaveTextContent(t(`schedule.title.${event.type}`));
      expect(items[i]).toHaveTextContent(t(event.message));
    });
    // No raw message keys leak into the UI.
    expect(screen.getByRole('list', { name: 'Schedule' })).not.toHaveTextContent('schedule.');
  });

  it('shows pre-race bicarbonate and caffeine before the start', () => {
    // 70 kg: 0.3 g/kg bicarbonate = 21 g (5.7 g sodium) at −90 min; 3 mg/kg caffeine = 210 mg at −60 min.
    renderTimeline({ event: { durationMin: 60 }, caffeine: { enabled: true }, bicarb: { enabled: true } });
    expect(types().slice(0, 3)).toEqual(['bicarb', 'caffeine', 'start']);
    const [bicarb, caffeine] = scheduleItems();
    expect(bicarb).toHaveTextContent('T−1h 30m');
    expect(within(bicarb).getByRole('heading', { name: 'Bicarbonate' })).toBeInTheDocument();
    expect(bicarb).toHaveTextContent('Take 21 g sodium bicarbonate. It adds 5.7 g sodium.');
    expect(bicarb).toHaveTextContent('Na');
    expect(caffeine).toHaveTextContent('T−1h');
    expect(within(caffeine).getByRole('heading', { name: 'Caffeine' })).toBeInTheDocument();
    expect(caffeine).toHaveTextContent('Take 210 mg caffeine.');
  });

  it('puts caffeine tablets into the gel that carries them', () => {
    // 70 kg, 3 mg/kg, 180 min, as tablets of 100 mg: 150 mg (1.5 tablets) before the start,
    // 50 mg in the gel at 120 min (gel 7 at 3 gels/h).
    renderTimeline({ ...PRESET_SWEAT, caffeine: { enabled: true, asIngredient: true, tabletMg: 100 } });
    const items = scheduleItems();
    expect(items[0]).toHaveTextContent('Take 150 mg caffeine. Tablets: 1.5.');
    const gel7 = items.find((li) => li.textContent.includes('Take gel 7'));
    expect(gel7).toHaveTextContent('T+2h');
    expect(gel7).toHaveTextContent('Take gel 7 with about 260 ml fluid. It contains 50 mg caffeine.');
  });

  it('lists drink sips from the bottles when a gel plan has no gels', () => {
    // 0 gels per hour: the carbs and salts go into the drink, drunk from 4 bottles of 600 ml.
    renderTimeline({ ...PRESET_SWEAT, format: { gelsPerHour: 0 } });
    expect(types().filter((type) => type !== 'drink')).toEqual(['start', 'finish']);
    expect(types().filter((type) => type === 'drink')).toHaveLength(9);
    expect(screen.getByText(/Drink from 4 bottles, 600 ml each \(750 ml bottle\), one after the other/)).toBeInTheDocument();
  });

  it('shows a hydration event when there is nothing to mix', () => {
    // 30 min without carbs or sodium: plain fluid, no gels, no bottles to mix.
    renderTimeline({ ...PRESET_SWEAT, event: { durationMin: 30 }, sodium: { mode: 'manual', manualMgPerHour: 0 } });
    expect(types()).toEqual(['start', 'hydration', 'finish']);
    const hydration = scheduleItems()[1];
    expect(within(hydration).getByRole('heading', { name: 'Hydration' })).toBeInTheDocument();
    expect(hydration).toHaveTextContent('Drink about 800 ml/h throughout.');
    expect(scheduleItems()[0]).toHaveTextContent('Start your activity.');
  });

  it('follows the plan when the inputs change', () => {
    renderTimeline();
    expect(scheduleItems()).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Set 60 min' }));
    expect(types()).toEqual(['start', 'fuel', 'fuel', 'finish']);
    expect(scheduleItems()[3]).toHaveTextContent('T+1h');
  });
});

describe('VisualTimeline: drink schedule', () => {
  it('lists a drink sip every 20 min with the bottle it comes from', () => {
    // 800 ml/h for 3 h = 2,400 ml in 750 ml bottles → 4 bottles filled to 600 ml.
    renderTimeline({ ...PRESET_SWEAT, format: { type: 'drink' } });
    expect(types()).toEqual(['start', ...Array(9).fill('drink'), 'finish']);
    const items = scheduleItems();
    expect(items[0]).toHaveTextContent('Start your activity.');
    expect(items[1]).toHaveTextContent('T+0m');
    expect(within(items[1]).getByRole('heading', { name: 'Drink' })).toBeInTheDocument();
    expect(items[1]).toHaveTextContent('Drink about 260 ml from bottle 1.');
    // The drink row has its own icon (not the "Na" badge) next to its title.
    expect(items[1].querySelector('svg')).not.toBeNull();
    expect(items[3]).toHaveTextContent('T+40m');
    expect(items[3]).toHaveTextContent('Drink about 270 ml. Finish bottle 1, then go on with bottle 2.');
    expect(items[9]).toHaveTextContent('T+2h 40m');
    expect(items[9]).toHaveTextContent('Drink about 270 ml from bottle 4.');
    expect(screen.getByTestId('bottle-note')).toHaveTextContent(
      'Drink from 4 bottles, 600 ml each (750 ml bottle), one after the other. Each sip lists the bottle it comes from.',
    );
  });

  it('renders every drink event of plan.schedule', () => {
    const inputs = { ...PRESET_SWEAT, format: { type: 'drink', bottleMl: 500 }, event: { durationMin: 150 } };
    renderTimeline(inputs);
    const { schedule } = computePlan(inputs);
    const items = scheduleItems();
    expect(items).toHaveLength(schedule.length);
    schedule.forEach((event, i) => {
      expect(items[i].dataset.type).toBe(event.type);
      expect(items[i]).toHaveTextContent(formatElapsed(event.timeMin));
      expect(items[i]).toHaveTextContent(t(event.message));
    });
    expect(schedule.filter((event) => event.type === 'drink').length).toBeGreaterThan(0);
  });

  it('names the bottle size only when the bottles are not filled to the top', () => {
    // 2,400 ml in 950 ml bottles → 3 bottles of 800 ml.
    const { unmount } = renderTimeline({ ...PRESET_SWEAT, format: { type: 'drink', bottleMl: 950 } });
    expect(screen.getByTestId('bottle-note')).toHaveTextContent(
      'Drink from 3 bottles, 800 ml each (950 ml bottle), one after the other.',
    );
    expect(scheduleItems()[4]).toHaveTextContent('Drink about 260 ml from bottle 2.');
    unmount();

    // 2,400 ml in 800 ml bottles → 3 full bottles.
    renderTimeline({ ...PRESET_SWEAT, format: { type: 'drink', bottleMl: 800 } });
    expect(screen.getByTestId('bottle-note')).toHaveTextContent('Drink from 3 bottles of 800 ml, one after the other.');
  });

  it('switches to drink sips when the format changes', () => {
    renderTimeline(PRESET_SWEAT);
    expect(types()).not.toContain('drink');
    fireEvent.click(screen.getByRole('button', { name: 'Switch to drink' }));
    expect(types().filter((type) => type === 'drink')).toHaveLength(9);
    expect(types()).not.toContain('fuel');
  });

  it('keeps the fluid with the gels in "both" mode, and uses drink sips without gels', () => {
    const { unmount } = renderTimeline({ ...PRESET_SWEAT, format: { type: 'both' } });
    expect(types()).toEqual(['start', ...Array(8).fill('fuel'), 'finish']);
    expect(scheduleItems()[0]).toHaveTextContent('take gel 1 with about 260 ml fluid.');
    expect(screen.queryByTestId('bottle-note')).not.toBeInTheDocument();
    unmount();

    renderTimeline({ ...PRESET_SWEAT, format: { type: 'both', gelsPerHour: 0 } });
    expect(types()).toEqual(['start', ...Array(9).fill('drink'), 'finish']);
    expect(screen.getByTestId('bottle-note')).toHaveTextContent('Drink from 4 bottles, 600 ml each');
  });

  it('shows no bottle note when the drink has no fluid', () => {
    renderTimeline({ format: { type: 'drink' }, fluid: { mode: 'manual', manualMlPerHour: 0 } });
    expect(types()).toEqual(['start', 'finish']);
    expect(screen.queryByTestId('bottle-note')).not.toBeInTheDocument();
  });
});

describe('VisualTimeline: table view', () => {
  it('switches between the timeline and the table view', () => {
    renderTimeline(PRESET_SWEAT);
    const timelineBtn = screen.getByRole('button', { name: 'Timeline view' });
    const tableBtn = screen.getByRole('button', { name: 'Table view' });
    expect(timelineBtn).toHaveAttribute('aria-pressed', 'true');
    expect(tableBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(tableBtn);
    expect(tableBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('list', { name: 'Schedule' })).not.toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Schedule' });
    const headers = within(table).getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual(['Time', 'Action', 'Details']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(10);
    expect(rows[0]).toHaveTextContent('T+0m');
    expect(rows[0]).toHaveTextContent('Start your activity and take gel 1 with about 260 ml fluid.');
    expect(rows[9]).toHaveTextContent('Finish. Begin your recovery.');

    fireEvent.click(timelineBtn);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(scheduleItems()).toHaveLength(10);
  });

  it('shows drink sips in the table', () => {
    renderTimeline({ ...PRESET_SWEAT, format: { type: 'drink' } });
    fireEvent.click(screen.getByRole('button', { name: 'Table view' }));
    const rows = within(screen.getByRole('table', { name: 'Schedule' })).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.dataset.type)).toEqual(['start', ...Array(9).fill('drink'), 'finish']);
    expect(rows[1]).toHaveTextContent('Drink');
    expect(rows[1]).toHaveTextContent('Drink about 260 ml from bottle 1.');
  });
});

describe('VisualTimeline: fluid advice', () => {
  const advice = () => screen.getByRole('region', { name: 'Fluid advice' });

  it('explains the recommended fluid plan with citations', () => {
    renderTimeline(PRESET_SWEAT);
    const plan = computePlan(PRESET_SWEAT);
    expect(advice()).toHaveTextContent(t(plan.fluid.recommended.why.summary));
    expect(advice()).toHaveTextContent('Drink about 800 ml/h.');
    const sources = within(advice()).getByRole('list', { name: 'Sources' });
    const links = within(sources).getAllByRole('link');
    expect(links.length).toBe(plan.fluid.recommended.why.citations.length);
    links.forEach((link) => {
      expect(link.getAttribute('href')).toMatch(/^https:\/\/doi\.org\//);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    });
    // 3 h at 20 °C: no drink-to-thirst hint and no warning.
    expect(advice()).not.toHaveTextContent('drinking to thirst');
    expect(within(advice()).queryByRole('list', { name: 'Warnings' })).not.toBeInTheDocument();
  });

  it('explains the default plan from its sweat estimate', () => {
    renderTimeline();
    const plan = computePlan({});
    expect(advice()).toHaveTextContent(t(plan.fluid.recommended.why.summary));
    expect(advice()).toHaveTextContent('Drink about 100 ml/h.');
  });

  it('adds the drink-to-thirst hint for short events', () => {
    renderTimeline({ event: { durationMin: 60 } });
    expect(advice()).toHaveTextContent(t('fluid.why.thirst'));
  });

  it('shows a manual target and the danger warning when it is above the sweat rate', () => {
    renderTimeline({ ...PRESET_SWEAT, fluid: { mode: 'manual', manualMlPerHour: 1500 } });
    expect(advice()).toHaveTextContent('You set your own fluid target of 1,500 ml/h. The recommendation is 800 ml/h.');
    const warnings = within(advice()).getByRole('list', { name: 'Warnings' });
    // Each warning is one item with a level; its citation links are nested items without one.
    const levelled = within(warnings).getAllByRole('listitem').filter((li) => li.dataset.level);
    expect(levelled).toHaveLength(1);
    const [item] = levelled;
    expect(item).toHaveAttribute('data-level', 'danger');
    expect(item).toHaveTextContent('That is more than you sweat (1,250 ml/h).');
  });

  it('is hidden when no fluid is planned', () => {
    renderTimeline({ fluid: { mode: 'manual', manualMlPerHour: 0 } });
    expect(screen.queryByRole('region', { name: 'Fluid advice' })).not.toBeInTheDocument();
    expect(types()).not.toContain('hydration');
  });
});
