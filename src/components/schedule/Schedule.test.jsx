import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import Schedule from './Schedule';
import { PlanProvider, usePlanInputs } from '../../state/PlanProvider';
import { UiProvider, PREFS_KEY } from '../../state/UiProvider';
import { computePlan } from '../../domain/plan';
import { formatElapsed } from '../../domain/schedule';
import { t } from '../../i18n';

/**
 * A preset sweat rate of 1.25 L/h (rate index 2), so the plan drinks the
 * 800 ml/h cap: 266.7 ml per 20 min, listed as 260, 270, 270, … ml.
 */
const PRESET_SWEAT = { sweat: { source: 'preset' } };

/** Buttons that change the inputs, so tests can check the schedule follows the plan. */
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

/**
 * The schedule with the real providers (autosave off, so no test sees
 * another's inputs). `prefs` are stored before the UI provider reads them.
 */
function renderSchedule(initialInputs, { prefs } = {}) {
  if (prefs) window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  return render(
    <PlanProvider initialInputs={initialInputs} persist={false}>
      <UiProvider>
        <Schedule />
        <Controls />
      </UiProvider>
    </PlanProvider>,
  );
}

const panel = () => screen.getByRole('region', { name: 'Schedule' });
const scheduleItems = () => within(screen.getByRole('list', { name: 'Schedule' })).getAllByRole('listitem');
const types = () => scheduleItems().map((li) => li.dataset.type);
const viewRadio = (name) => within(screen.getByRole('radiogroup', { name: 'Schedule view' })).getByRole('radio', { name });

let warnSpy;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  // No key of this area may be missing from the catalogs.
  const unknown = warnSpy.mock.calls.filter(([msg]) => String(msg).startsWith('[i18n] Missing message'));
  expect(unknown).toEqual([]);
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Schedule: panel', () => {
  it('is a named region with its heading, description and view switch', () => {
    renderSchedule();
    expect(within(panel()).getByRole('heading', { level: 2, name: 'Schedule' })).toBeInTheDocument();
    expect(panel()).toHaveTextContent('Every gel, sip and dose by time from the start.');
    expect(viewRadio('List')).toHaveAttribute('aria-checked', 'true');
    expect(viewRadio('Table')).toHaveAttribute('aria-checked', 'false');
  });

  it('works without the UI provider, in English and metric', () => {
    render(
      <PlanProvider initialInputs={PRESET_SWEAT} persist={false}>
        <Schedule />
      </PlanProvider>,
    );
    expect(scheduleItems()[0]).toHaveTextContent('Start your activity and take gel 1 with about 260 ml fluid.');
  });

  it('shows each time in words for screen readers, and the short time on screen', () => {
    renderSchedule({ event: { durationMin: 60 }, caffeine: { enabled: true }, bicarb: { enabled: true } });
    const [bicarb, caffeine, start] = scheduleItems();
    expect(within(bicarb).getByText('T−1h 30m')).toHaveAttribute('aria-hidden', 'true');
    expect(within(bicarb).getByText('1 hour 30 minutes before the start: Bicarbonate')).toHaveClass('sr-only');
    expect(caffeine).toHaveTextContent('1 hour before the start');
    expect(start).toHaveTextContent('At the start');
    expect(scheduleItems()[3]).toHaveTextContent('20 minutes after the start');
    // Units are written out, never abbreviated ("h", "min"), so screen readers do not spell them.
    for (const li of scheduleItems()) {
      expect(li.querySelector('.sr-only').textContent).not.toMatch(/\b(h|min)\b/);
    }
  });

  it('names each event heading with its time, so moving by heading says when it happens', () => {
    renderSchedule({ event: { durationMin: 60 }, caffeine: { enabled: true }, bicarb: { enabled: true } });
    const headings = within(screen.getByRole('list', { name: 'Schedule' })).getAllByRole('heading', { level: 3 });
    expect(headings).toHaveLength(scheduleItems().length);
    expect(headings[0]).toHaveAccessibleName('1 hour 30 minutes before the start: Bicarbonate');
    expect(headings[1]).toHaveAccessibleName('1 hour before the start: Caffeine');
    expect(headings[2]).toHaveAccessibleName('At the start: Start');
    expect(headings[3]).toHaveAccessibleName('20 minutes after the start: Fuel');
    expect(headings[4]).toHaveAccessibleName('40 minutes after the start: Fuel');
    expect(headings.at(-1)).toHaveAccessibleName('1 hour after the start: Finish');
    // The headings can be told apart, and the time is not read twice: the short time is hidden.
    const names = headings.map((heading) => heading.textContent);
    expect(new Set(names).size).toBe(names.length);
    for (const li of scheduleItems()) {
      const visibleTime = li.querySelector('.font-mono');
      expect(visibleTime).toHaveAttribute('aria-hidden', 'true');
      expect(li.querySelectorAll('.sr-only')).toHaveLength(1);
    }
  });

  it('gives each event type its substance colour and its own badge', () => {
    renderSchedule({ ...PRESET_SWEAT, event: { durationMin: 60 }, caffeine: { enabled: true }, bicarb: { enabled: true } });
    const tones = Object.fromEntries(
      scheduleItems().map((li) => [li.dataset.type, li.querySelector('[data-tone]').dataset.tone]),
    );
    expect(tones).toEqual({ bicarb: 'sodium', caffeine: 'caffeine', start: 'neutral', fuel: 'glucose', finish: 'neutral' });
    // Badges are decorative; the title names the event.
    for (const li of scheduleItems()) expect(li.querySelector('[data-tone]')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Schedule: gel schedule', () => {
  it('renders the default plan: start with gel 1, gels 2–9 every 20 min, finish at 3 h', () => {
    renderSchedule();
    expect(types()).toEqual(['start', ...Array(8).fill('fuel'), 'finish']);

    const items = scheduleItems();
    // Default plan: the heat-balance estimate gives 0.33 L/h sweat, so 250 ml/h fluid.
    // 83.3 ml per gel, rounded on the running total: 80, 80, 90, 80, ….
    expect(items[0]).toHaveTextContent('T+0m');
    expect(within(items[0]).getByRole('heading', { name: 'At the start: Start' })).toBeInTheDocument();
    expect(items[0]).toHaveTextContent('Start your activity and take gel 1 with about 80 ml fluid.');
    expect(items[2]).toHaveTextContent('T+40m');
    expect(items[2]).toHaveTextContent('Take gel 3 with about 90 ml fluid.');
    expect(items[9]).toHaveTextContent('T+3h');
    expect(within(items[9]).getByRole('heading', { name: '3 hours after the start: Finish' })).toBeInTheDocument();
    expect(items[9]).toHaveTextContent('Finish. Begin your recovery.');
    // Gels carry the fluid, so there is no bottle note.
    expect(screen.queryByTestId('bottle-note')).not.toBeInTheDocument();
  });

  it('lists the fluid with each gel at a higher sweat rate', () => {
    renderSchedule(PRESET_SWEAT);
    const items = scheduleItems();
    expect(items[0]).toHaveTextContent('Start your activity and take gel 1 with about 260 ml fluid.');
    expect(items[1]).toHaveTextContent('T+20m');
    expect(items[1]).toHaveTextContent('Take gel 2 with about 270 ml fluid.');
    expect(items[8]).toHaveTextContent('T+2h 40m');
    expect(items[8]).toHaveTextContent('Take gel 9 with about 270 ml fluid.');
  });

  it('renders every event of plan.schedule with its time, title and text', () => {
    const inputs = {
      event: { durationMin: 200 },
      caffeine: { enabled: true, asIngredient: true },
      bicarb: { enabled: true },
    };
    renderSchedule(inputs);
    const { schedule } = computePlan(inputs);
    const items = scheduleItems();
    expect(items).toHaveLength(schedule.length);
    schedule.forEach((event, i) => {
      expect(items[i].dataset.type).toBe(event.type);
      expect(items[i]).toHaveTextContent(formatElapsed(event.timeMin));
      expect(within(items[i]).getByRole('heading', { level: 3 })).toHaveAccessibleName(
        new RegExp(`: ${t(`schedule.title.${event.type}`)}$`),
      );
      expect(items[i]).toHaveTextContent(t(event.message));
    });
    // No raw message keys leak into the UI.
    expect(screen.getByRole('list', { name: 'Schedule' })).not.toHaveTextContent('schedule.');
  });

  it('shows pre-race bicarbonate and caffeine before the start', () => {
    // 70 kg: 0.3 g/kg bicarbonate = 21 g (5.7 g sodium) at −90 min; 3 mg/kg caffeine = 210 mg at −60 min.
    renderSchedule({ event: { durationMin: 60 }, caffeine: { enabled: true }, bicarb: { enabled: true } });
    expect(types().slice(0, 3)).toEqual(['bicarb', 'caffeine', 'start']);
    const [bicarb, caffeine] = scheduleItems();
    expect(bicarb).toHaveTextContent('T−1h 30m');
    expect(within(bicarb).getByRole('heading', { name: '1 hour 30 minutes before the start: Bicarbonate' })).toBeInTheDocument();
    expect(bicarb).toHaveTextContent('Take 21 g sodium bicarbonate. It adds 5.7 g sodium.');
    // Bicarbonate has the "Na" badge (lucide has no sodium icon); the others have their own icon.
    expect(bicarb.querySelector('[data-tone]')).toHaveTextContent('Na');
    expect(bicarb.querySelector('svg')).toBeNull();
    expect(caffeine).toHaveTextContent('T−1h');
    expect(within(caffeine).getByRole('heading', { name: '1 hour before the start: Caffeine' })).toBeInTheDocument();
    expect(caffeine).toHaveTextContent('Take 210 mg caffeine.');
    expect(caffeine.querySelector('svg')).not.toBeNull();
  });

  it('puts caffeine tablets into the gel that carries them', () => {
    // 70 kg, 3 mg/kg, 180 min, as tablets of 100 mg: 150 mg (1.5 tablets) before the start,
    // 50 mg in the gel at 120 min (gel 7 at 3 gels/h).
    renderSchedule({ ...PRESET_SWEAT, caffeine: { enabled: true, asIngredient: true, tabletMg: 100 } });
    const items = scheduleItems();
    expect(items[0]).toHaveTextContent('Take 150 mg caffeine. Tablets: 1.5.');
    const gel7 = items.find((li) => li.textContent.includes('Take gel 7'));
    expect(gel7).toHaveTextContent('T+2h');
    expect(gel7).toHaveTextContent('Take gel 7 with about 260 ml fluid. It contains 50 mg caffeine.');
  });

  it('lists drink sips from the bottles when a gel plan has no gels', () => {
    // 0 gels per hour: the carbs and salts go into the drink, drunk from 4 bottles of 600 ml.
    renderSchedule({ ...PRESET_SWEAT, format: { gelsPerHour: 0 } });
    expect(types().filter((type) => type !== 'drink')).toEqual(['start', 'finish']);
    expect(types().filter((type) => type === 'drink')).toHaveLength(9);
    expect(screen.getByTestId('bottle-note')).toHaveTextContent(
      /Drink from 4 bottles, 600 ml each \(750 ml bottle\), one after the other/,
    );
  });

  it('shows a hydration event when there is nothing to mix', () => {
    // 30 min without carbs or sodium: plain fluid, no gels, no bottles to mix.
    renderSchedule({ ...PRESET_SWEAT, event: { durationMin: 30 }, sodium: { mode: 'manual', manualMgPerHour: 0 } });
    expect(types()).toEqual(['start', 'hydration', 'finish']);
    const hydration = scheduleItems()[1];
    expect(within(hydration).getByRole('heading', { name: /: Hydration$/ })).toBeInTheDocument();
    expect(hydration).toHaveTextContent('Drink about 800 ml/h throughout.');
    expect(hydration.querySelector('[data-tone]').dataset.tone).toBe('fluid');
    expect(scheduleItems()[0]).toHaveTextContent('Start your activity.');
  });

  it('follows the plan when the inputs change', () => {
    renderSchedule();
    expect(scheduleItems()).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Set 60 min' }));
    expect(types()).toEqual(['start', 'fuel', 'fuel', 'finish']);
    expect(scheduleItems()[3]).toHaveTextContent('T+1h');
  });
});

describe('Schedule: drink schedule', () => {
  it('lists a drink sip every 20 min with the bottle it comes from', () => {
    // 800 ml/h for 3 h = 2,400 ml in 750 ml bottles → 4 bottles filled to 600 ml.
    renderSchedule({ ...PRESET_SWEAT, format: { type: 'drink' } });
    expect(types()).toEqual(['start', ...Array(9).fill('drink'), 'finish']);
    const items = scheduleItems();
    expect(items[0]).toHaveTextContent('Start your activity.');
    expect(items[1]).toHaveTextContent('T+0m');
    expect(within(items[1]).getByRole('heading', { name: 'At the start: Drink' })).toBeInTheDocument();
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
    renderSchedule(inputs);
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
    const { unmount } = renderSchedule({ ...PRESET_SWEAT, format: { type: 'drink', bottleMl: 950 } });
    expect(screen.getByTestId('bottle-note')).toHaveTextContent(
      'Drink from 3 bottles, 800 ml each (950 ml bottle), one after the other.',
    );
    expect(scheduleItems()[4]).toHaveTextContent('Drink about 260 ml from bottle 2.');
    unmount();

    // 2,400 ml in 800 ml bottles → 3 full bottles.
    renderSchedule({ ...PRESET_SWEAT, format: { type: 'drink', bottleMl: 800 } });
    expect(screen.getByTestId('bottle-note')).toHaveTextContent('Drink from 3 bottles of 800 ml, one after the other.');
  });

  it('switches to drink sips when the format changes', () => {
    renderSchedule(PRESET_SWEAT);
    expect(types()).not.toContain('drink');
    fireEvent.click(screen.getByRole('button', { name: 'Switch to drink' }));
    expect(types().filter((type) => type === 'drink')).toHaveLength(9);
    expect(types()).not.toContain('fuel');
  });

  it('keeps the fluid with the gels in "both" mode, and uses drink sips without gels', () => {
    const { unmount } = renderSchedule({ ...PRESET_SWEAT, format: { type: 'both' } });
    expect(types()).toEqual(['start', ...Array(8).fill('fuel'), 'finish']);
    expect(scheduleItems()[0]).toHaveTextContent('take gel 1 with about 260 ml fluid.');
    expect(screen.queryByTestId('bottle-note')).not.toBeInTheDocument();
    unmount();

    renderSchedule({ ...PRESET_SWEAT, format: { type: 'both', gelsPerHour: 0 } });
    expect(types()).toEqual(['start', ...Array(9).fill('drink'), 'finish']);
    expect(screen.getByTestId('bottle-note')).toHaveTextContent('Drink from 4 bottles, 600 ml each');
  });

  it('shows no bottle note when the drink has no fluid', () => {
    renderSchedule({ format: { type: 'drink' }, fluid: { mode: 'manual', manualMlPerHour: 0 } });
    expect(types()).toEqual(['start', 'finish']);
    expect(screen.queryByTestId('bottle-note')).not.toBeInTheDocument();
  });
});

describe('Schedule: table view', () => {
  it('switches between the list and the table view', () => {
    renderSchedule(PRESET_SWEAT);
    fireEvent.click(viewRadio('Table'));
    expect(viewRadio('Table')).toHaveAttribute('aria-checked', 'true');
    expect(viewRadio('List')).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByRole('list', { name: 'Schedule' })).not.toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Schedule' });
    const headers = within(table).getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual(['Time', 'Action', 'Details']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(10);
    expect(rows[0]).toHaveTextContent('T+0m');
    expect(rows[0]).toHaveTextContent('Start your activity and take gel 1 with about 260 ml fluid.');
    expect(rows[9]).toHaveTextContent('Finish. Begin your recovery.');

    fireEvent.click(viewRadio('List'));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(scheduleItems()).toHaveLength(10);
  });

  it('switches with the arrow keys (one tab stop)', () => {
    renderSchedule(PRESET_SWEAT);
    expect(viewRadio('List')).toHaveAttribute('tabindex', '0');
    expect(viewRadio('Table')).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(viewRadio('List'), { key: 'ArrowRight' });
    expect(screen.getByRole('table', { name: 'Schedule' })).toBeInTheDocument();
    expect(viewRadio('Table')).toHaveFocus();
  });

  it('shows drink sips in the table', () => {
    renderSchedule({ ...PRESET_SWEAT, format: { type: 'drink' } });
    fireEvent.click(viewRadio('Table'));
    const rows = within(screen.getByRole('table', { name: 'Schedule' })).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.dataset.type)).toEqual(['start', ...Array(9).fill('drink'), 'finish']);
    expect(rows[1]).toHaveTextContent('Drink');
    expect(rows[1]).toHaveTextContent('Drink about 260 ml from bottle 1.');
  });

  it('renders every event of plan.schedule as a row: time, title, details', () => {
    const inputs = { event: { durationMin: 75 }, caffeine: { enabled: true }, bicarb: { enabled: true } };
    renderSchedule(inputs);
    fireEvent.click(viewRadio('Table'));
    const { schedule } = computePlan(inputs);
    const rows = within(screen.getByRole('table', { name: 'Schedule' })).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(schedule.length);
    schedule.forEach((event, i) => {
      // The time is the row header; the action and the details are its cells.
      expect(within(rows[i]).getByRole('rowheader')).toHaveTextContent(formatElapsed(event.timeMin));
      const cells = within(rows[i]).getAllByRole('cell');
      expect(cells).toHaveLength(2);
      expect(cells[0]).toHaveTextContent(t(`schedule.title.${event.type}`));
      expect(cells[1]).toHaveTextContent(t(event.message));
    });
  });

  it('makes each time the header of its row, named with the time in words', () => {
    renderSchedule({ event: { durationMin: 60 }, caffeine: { enabled: true }, bicarb: { enabled: true } });
    fireEvent.click(viewRadio('Table'));
    const table = screen.getByRole('table', { name: 'Schedule' });
    const headers = within(table).getAllByRole('rowheader');
    expect(headers).toHaveLength(within(table).getAllByRole('row').length - 1);
    expect(headers[0]).toHaveAttribute('scope', 'row');
    expect(headers.slice(0, 4).map((th) => th.querySelector('.sr-only').textContent)).toEqual([
      '1 hour 30 minutes before the start',
      '1 hour before the start',
      'At the start',
      '20 minutes after the start',
    ]);
    expect(within(headers[0]).getByText('T−1h 30m')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Schedule: fluid advice', () => {
  const advice = () => screen.getByRole('region', { name: 'Fluid advice' });

  it('explains the recommended fluid plan with citations', () => {
    renderSchedule(PRESET_SWEAT);
    const plan = computePlan(PRESET_SWEAT);
    expect(within(advice()).getByRole('heading', { level: 3, name: 'Fluid advice' })).toBeInTheDocument();
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
    renderSchedule();
    const plan = computePlan({});
    expect(advice()).toHaveTextContent(t(plan.fluid.recommended.why.summary));
    expect(advice()).toHaveTextContent('Drink about 250 ml/h.');
  });

  it('adds the drink-to-thirst hint for short events', () => {
    renderSchedule({ event: { durationMin: 60 } });
    expect(advice()).toHaveTextContent(t('fluid.why.thirst'));
  });

  it('shows a manual target and the danger warning when it is above the sweat rate', () => {
    renderSchedule({ ...PRESET_SWEAT, fluid: { mode: 'manual', manualMlPerHour: 1500 } });
    expect(advice()).toHaveTextContent('You set your own fluid target of 1,500 ml/h. The recommendation is 800 ml/h.');
    const warnings = within(advice()).getByRole('list', { name: 'Warnings' });
    // Each warning is one item with a level; its citation links are nested items without one.
    const levelled = within(warnings).getAllByRole('listitem').filter((li) => li.dataset.level);
    expect(levelled).toHaveLength(1);
    const [item] = levelled;
    expect(item).toHaveAttribute('data-level', 'danger');
    expect(item).toHaveTextContent('Danger:');
    expect(item).toHaveTextContent('That is more than you sweat (1,250 ml/h).');
  });

  it('is hidden when no fluid is planned', () => {
    renderSchedule({ fluid: { mode: 'manual', manualMlPerHour: 0 } });
    expect(screen.queryByRole('region', { name: 'Fluid advice' })).not.toBeInTheDocument();
    expect(types()).not.toContain('hydration');
  });
});

describe('Schedule: language and units', () => {
  it('shows fluid in US fl oz in imperial units', () => {
    // 800 ml/h for 3 h in 750 ml bottles: 4 bottles of 600 ml (20.3 fl oz) in a 25.4 fl oz bottle.
    renderSchedule({ ...PRESET_SWEAT, format: { type: 'drink' } }, { prefs: { unitSystem: 'imperial', mode: 'expert' } });
    const items = scheduleItems();
    expect(items[1]).toHaveTextContent('Drink about 8.8 fl oz from bottle 1.');
    expect(screen.getByTestId('bottle-note')).toHaveTextContent(
      'Drink from 4 bottles, 20 fl oz each (25 fl oz bottle), one after the other.',
    );
    expect(screen.getByRole('region', { name: 'Fluid advice' })).toHaveTextContent('Drink about 27 fl oz/h.');
    expect(screen.getByRole('region', { name: 'Fluid advice' })).not.toHaveTextContent(/\bml\b/);
  });

  it('names the bottle size only when it reads differently from the fill in fl oz', () => {
    // 740 ml/h for 3 h in 750 ml bottles: 3 bottles of 740 ml. In fl oz both read 25, so the
    // bottles are "of 25 fl oz", never "25 fl oz each (25 fl oz bottle)".
    renderSchedule(
      { format: { type: 'drink' }, fluid: { mode: 'manual', manualMlPerHour: 740 } },
      { prefs: { unitSystem: 'imperial', mode: 'expert' } },
    );
    expect(screen.getByTestId('bottle-note')).toHaveTextContent('Drink from 3 bottles of 25 fl oz, one after the other.');
  });

  it('converts a manual fluid target to fl oz', () => {
    renderSchedule(
      { ...PRESET_SWEAT, fluid: { mode: 'manual', manualMlPerHour: 1500 } },
      { prefs: { unitSystem: 'imperial', mode: 'expert' } },
    );
    expect(screen.getByRole('region', { name: 'Fluid advice' })).toHaveTextContent(
      'You set your own fluid target of 51 fl oz/h. The recommendation is 27 fl oz/h.',
    );
  });

  it('uses German number formats in the German UI', () => {
    renderSchedule(
      { ...PRESET_SWEAT, fluid: { mode: 'manual', manualMlPerHour: 1500 }, event: { durationMin: 60 }, bicarb: { enabled: true } },
      { prefs: { locale: 'de', unitSystem: 'metric', mode: 'expert' } },
    );
    const [bicarb] = within(screen.getByRole('list', { name: 'Zeitplan' })).getAllByRole('listitem');
    expect(bicarb).toHaveTextContent('T−1h 30m');
    expect(bicarb).toHaveTextContent('5,7 g');
    expect(bicarb).toHaveTextContent('Natron');
    expect(screen.getByRole('region', { name: 'Trinkempfehlung' })).toHaveTextContent('1.500 ml/h');
  });
});
