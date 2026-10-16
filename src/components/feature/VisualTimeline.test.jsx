import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import VisualTimeline from './VisualTimeline';
import { PlanProvider, usePlanInputs } from '../../state/PlanProvider';
import { computePlan } from '../../domain/plan';
import { formatElapsed } from '../../domain/schedule';
import { t } from '../../i18n';

/** Buttons that change the inputs, so tests can check the timeline follows the plan. */
function Controls() {
  const { set } = usePlanInputs();
  return (
    <button type="button" onClick={() => set('event.durationMin', 60)}>
      Set 60 min
    </button>
  );
}

function renderTimeline(initialInputs) {
  return render(
    <PlanProvider initialInputs={initialInputs}>
      <VisualTimeline />
      <Controls />
    </PlanProvider>,
  );
}

const scheduleItems = () => within(screen.getByRole('list', { name: 'Schedule' })).getAllByRole('listitem');
const types = () => scheduleItems().map((li) => li.dataset.type);

describe('VisualTimeline: schedule', () => {
  it('renders the default plan: start with gel 1, gels 2–9 every 20 min, finish at 3 h', () => {
    renderTimeline();
    expect(screen.getByRole('heading', { name: 'Execution Schedule' })).toBeInTheDocument();
    expect(types()).toEqual(['start', ...Array(8).fill('fuel'), 'finish']);

    const items = scheduleItems();
    // 800 ml/h fluid, one gel every 20 min → 266.7 ml per gel, rounded on the running total
    // (260, 270, 270, 260, …) so the gels add up to the plan's 2,400 ml.
    expect(items[0]).toHaveTextContent('T+0m');
    expect(within(items[0]).getByRole('heading', { name: 'Start' })).toBeInTheDocument();
    expect(items[0]).toHaveTextContent('Start your activity and take gel 1 with about 260 ml fluid.');
    expect(items[1]).toHaveTextContent('T+20m');
    expect(items[1]).toHaveTextContent('Take gel 2 with about 270 ml fluid.');
    expect(items[8]).toHaveTextContent('T+2h 40m');
    expect(items[8]).toHaveTextContent('Take gel 9 with about 270 ml fluid.');
    expect(items[9]).toHaveTextContent('T+3h');
    expect(within(items[9]).getByRole('heading', { name: 'Finish' })).toBeInTheDocument();
    expect(items[9]).toHaveTextContent('Finish. Begin your recovery.');
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
    renderTimeline({ caffeine: { enabled: true, asIngredient: true, tabletMg: 100 } });
    const items = scheduleItems();
    expect(items[0]).toHaveTextContent('Take 150 mg caffeine. Tablets: 1.5.');
    const gel7 = items.find((li) => li.textContent.includes('Take gel 7'));
    expect(gel7).toHaveTextContent('T+2h');
    expect(gel7).toHaveTextContent('Take gel 7 with about 260 ml fluid. It contains 50 mg caffeine.');
  });

  it('shows a hydration event when there are no gels', () => {
    renderTimeline({ format: { gelsPerHour: 0 } });
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

  it('switches between the timeline and the table view', () => {
    renderTimeline();
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
});

describe('VisualTimeline: fluid advice', () => {
  const advice = () => screen.getByRole('region', { name: 'Fluid advice' });

  it('explains the recommended fluid plan with citations', () => {
    renderTimeline();
    const plan = computePlan({});
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

  it('adds the drink-to-thirst hint for short events', () => {
    renderTimeline({ event: { durationMin: 60 } });
    expect(advice()).toHaveTextContent(t('fluid.why.thirst'));
  });

  it('shows a manual target and the danger warning when it is above the sweat rate', () => {
    renderTimeline({ fluid: { mode: 'manual', manualMlPerHour: 1500 } });
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
