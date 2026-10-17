import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, within, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RaceBoard from './RaceBoard';
import BoardKpis from './BoardKpis';
import { WARNINGS_ANNOUNCE_DELAY_MS } from './BoardAnnouncer';
import Schedule from '../schedule/Schedule';
import { eventLook } from '../schedule/ScheduleEventIcon';
import { PlanProvider, usePlanInputs, usePlan } from '../../state/PlanProvider';
import { UiProvider, useUi, PREFS_KEY } from '../../state/UiProvider';
import { computePlan } from '../../domain/plan';
import { formatAmount as domainFormatAmount } from '../../domain/recipe';
import { t } from '../../i18n';
import raceBoardSource from './RaceBoard.jsx?raw';
import boardRecipeSource from './BoardRecipe.jsx?raw';
import boardKpisSource from './BoardKpis.jsx?raw';
import boardNextUpSource from './BoardNextUp.jsx?raw';

/** Latest inputs, plan, UI state and the inputs setter, captured by <Spy /> on every render. */
const latest = { inputs: null, plan: null, ui: null, set: null };

function Spy() {
  const { inputs, set } = usePlanInputs();
  const plan = usePlan();
  const ui = useUi();
  useEffect(() => {
    latest.inputs = inputs;
    latest.plan = plan;
    latest.ui = ui;
    latest.set = set;
  });
  return null;
}

/** The phone layout of the shell: one tab view at a time (`hidden` = display: none). */
function PhoneShell() {
  const { boardTab } = useUi();
  return (
    <>
      <section hidden={boardTab !== 'board'}>
        <RaceBoard />
      </section>
      <div hidden={boardTab !== 'schedule'}>
        <Schedule />
      </div>
    </>
  );
}

/**
 * Renders the board with the real providers (autosave off). `prefs` are
 * stored first, as a returning visitor's (mode, language, units, currency).
 */
function renderBoard(initialInputs, { prefs, props = {}, children } = {}) {
  if (prefs) window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  return render(
    <PlanProvider initialInputs={initialInputs} persist={false}>
      <UiProvider>
        {children ?? <RaceBoard {...props} />}
        <Spy />
      </UiProvider>
    </PlanProvider>,
  );
}

const board = () => screen.getByTestId('race-board');
const tile = (name) => screen.getByRole('group', { name });
const value = (id) => screen.getByTestId(`kpi-${id}-value`).textContent;
const sub = (name) => tile(name).querySelectorAll('p')[2].textContent;
const section = (kind) => screen.getByTestId(`recipe-section-${kind}`);
/** A section's per-serving facts and osmolality (after the recipe actions). */
const facts = (kind) => screen.getByTestId(`recipe-facts-${kind}`);
const recipe = () => screen.getByRole('region', { name: 'Recipe' });
const warningsPanel = () => screen.getByTestId('board-warnings');
/** The direct warning items of the warnings panel (each also nests a list of sources). */
const warningItems = () => [...warningsPanel().querySelectorAll('ul[aria-label="Warnings"] > li')];
/** [label, amount] of every lane of a section. */
const rows = (kind) =>
  within(section(kind))
    .getAllByRole('listitem')
    .filter((li) => li.hasAttribute('data-kind'))
    .map((li) => [within(li).getByTestId('item-label').textContent, within(li).getByTestId('item-amount').textContent]);
/** The lanes the board should show for a section, straight from the domain (English, metric). */
const expectedRows = (inputs, kind, view = 'total') =>
  computePlan(inputs)
    .recipe.sections.find((s) => s.kind === kind)
    .items.map((item) => [typeof item.label === 'string' ? item.label : t(item.label), view === 'perServing' ? item.perServingDisplay : item.display]);
/** The value of a per-serving fact (`<dt>` term → `<dd>`). */
const fact = (kind, term) => within(facts(kind)).getByText(term, { selector: 'dt' }).nextElementSibling.textContent;
/** Opens a tile's "Why?" and returns its explanation panel (a sibling of the tile, not inside it). */
const openWhy = (name) => {
  const button = within(tile(name)).getByRole('button', { name: `Why? (${name})` });
  if (button.getAttribute('aria-expanded') !== 'true') fireEvent.click(button);
  return document.getElementById(button.getAttribute('aria-controls'));
};
const viewRadio = (name) => within(screen.getByRole('radiogroup', { name: 'Recipe view' })).getByRole('radio', { name });

/** A 60 min sweat test: 1 kg lost with 0.5 L drunk (1.36 L/h after the metabolic correction). */
const TEST = { id: 't1', date: '2026-09-01', label: 'Long ride', preKg: 70, postKg: 69, fluidL: 0.5, urineL: 0, durationMin: 60 };

let warnSpy;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  // No message may fall back to its raw key (a missing German text falls back to English, which is fine).
  const missing = warnSpy.mock.calls.filter(([msg]) => String(msg).startsWith('[i18n] Missing message'));
  expect(missing).toEqual([]);
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  latest.inputs = null;
  latest.plan = null;
  latest.ui = null;
  latest.set = null;
});

describe('RaceBoard: layout and landmarks', () => {
  it('is not a landmark itself; its panels are regions named by their titles', () => {
    renderBoard();
    expect(board().tagName).toBe('DIV');
    expect(board()).not.toHaveAttribute('role');
    const regions = screen.getAllByRole('region');
    expect(regions).toHaveLength(3);
    expect(regions[0]).toBe(screen.getByRole('region', { name: 'Recipe' }));
    expect(regions[1]).toBe(screen.getByRole('region', { name: 'Next up' }));
    expect(regions[2]).toBe(screen.getByRole('region', { name: 'Warnings (1)' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Race board' })).not.toBeInTheDocument();
  });

  it('uses one heading order: "Race board" h2, panels h3, recipe sections h4', () => {
    renderBoard({ sweat: { source: 'preset' }, format: { type: 'both' } });
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/^Race board$/);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Recipe', 'Next up', 'Warnings (1)']);
    expect(screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)).toEqual(['Gels ×9', 'Bottles ×4']);
  });

  it('shifts every heading for another heading level (the guided flow)', () => {
    renderBoard(undefined, { props: { headingLevel: 3 } });
    expect(screen.getByRole('heading', { level: 3, name: 'Race board' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Recipe' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 5, name: 'Gels ×9' })).toBeInTheDocument();
  });

  it.each([5, 6, 9])('never goes past h6: heading level %s is clamped to 4', (headingLevel) => {
    renderBoard({ sweat: { source: 'preset' }, format: { type: 'both' } }, { props: { headingLevel } });
    expect(screen.getByRole('heading', { level: 4, name: 'Race board' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 5 }).map((h) => h.textContent)).toEqual(['Recipe', 'Next up', 'Warnings (1)']);
    expect(screen.getAllByRole('heading', { level: 6 }).map((h) => h.textContent)).toEqual(['Gels ×9', 'Bottles ×4']);
  });

  it('lays out by its own width and uses only design tokens', () => {
    renderBoard();
    expect(board()).toHaveClass('@container');
    expect(screen.getByTestId('board-kpis').firstElementChild).toHaveClass('grid-cols-2', '@2xl:grid-cols-4', 'grid-flow-row-dense');
    for (const source of [raceBoardSource, boardRecipeSource, boardKpisSource, boardNextUpSource]) {
      expect(source).not.toMatch(/apple-|glass-card|#[0-9a-f]{3,6}\b|text-text-|bg-bg-primary/i);
    }
  });

  it('uses tabular figures for every number, the display headings included', () => {
    renderBoard({ sweat: { source: 'preset' }, format: { type: 'both' } });
    // `num` (tabular-nums) is inherited; the display utilities only set the font family.
    expect(board()).toHaveClass('num');
    expect(screen.getByTestId('board-kpis')).toHaveClass('num');
    expect(board()).toContainElement(screen.getByTestId('board-summary'));
    expect(board()).toContainElement(screen.getByRole('heading', { name: 'Gels ×9' }));
  });

  it('draws each recipe section flat on the recipe panel, its facts after the actions', () => {
    renderBoard({ sweat: { source: 'preset' }, format: { type: 'both' } });
    const gel = section('gel');
    expect(gel.tagName).toBe('DIV');
    // No panel in a panel: no border, surface or padding of its own (the lanes start one row higher).
    expect(gel.className).not.toMatch(/rounded-panel|\bborder\b|\bp-4\b|bg-surface/);
    // Two sections: a hairline between them while they are stacked.
    expect(gel.parentElement.className).toContain('@max-3xl:[&>*+*]:border-t');
    // START MIXING comes before the per-serving facts of every section.
    const mix = screen.getByRole('button', { name: 'Start mixing' });
    for (const kind of ['gel', 'drink']) {
      expect(section(kind).compareDocumentPosition(mix) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(mix.compareDocumentPosition(facts(kind)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    // With two sections, each block of facts says which section it is.
    expect(facts('drink')).toHaveTextContent(/^Bottles ×4/);
  });
});

describe('RaceBoard: title row', () => {
  it('summarises the event and the sweat rate', () => {
    renderBoard();
    expect(screen.getByTestId('board-summary')).toHaveTextContent('3:00 h · Cycling · Moderate');
    expect(screen.getByTestId('board-summary')).toHaveClass('display-section');
    // Heat-balance estimate for 30 km/h at 20 °C in the shade: 0.33 L/h ± 0.5 L/h.
    expect(screen.getByTestId('board-sweat-chip')).toHaveTextContent(/^Sweat 0\.33 L\/h ±0\.5$/);
    expect(screen.getByTestId('board-sweat')).toHaveTextContent('Sweat 0.33 L/h ±0.5 Estimate');
    expect(screen.getByTestId('board-sweat')).toHaveAttribute('data-source', 'estimate');
  });

  it.each([
    [{ sweat: { source: 'preset' } }, 'Sweat 1.25 L/h ±0.5', 'Self-assessed'],
    [{ sweat: { source: 'test' } }, 'Sweat 0.33 L/h ±0.5', 'Estimate (no usable sweat test)'],
    // [baker2017] [cheuvront2017] a sweat test is accurate to about ±0.15 L/h
    [{ sweat: { source: 'test', tests: [TEST] } }, 'Sweat 1.36 L/h ±0.15', 'Sweat test, scaled to this event'],
    [{ sweat: { source: 'test', tests: [TEST], calibrate: false } }, 'Sweat 1.36 L/h ±0.15', 'Sweat test'],
    [{ event: { durationMin: 95, sport: 'running', intensity: 'race', speedKmh: 12 } }, null, null],
  ])('names the sweat source (%j)', (inputs, chip, source) => {
    renderBoard(inputs);
    if (chip) {
      expect(screen.getByTestId('board-sweat-chip')).toHaveTextContent(chip);
      expect(screen.getByTestId('board-sweat-source')).toHaveTextContent(source);
    } else {
      expect(screen.getByTestId('board-summary')).toHaveTextContent('1:35 h · Running · Race');
    }
  });

  it('keeps the sweat source out of the truncating chip, as wrapping text', () => {
    renderBoard({ sweat: { source: 'test', tests: [TEST] } });
    const chip = screen.getByTestId('board-sweat-chip');
    const source = screen.getByTestId('board-sweat-source');
    // The chip holds the rate only; the qualifier is wrapping text next to it, never cut off.
    expect(chip).toHaveTextContent(/^Sweat 1\.36 L\/h ±0\.15$/);
    expect(chip.querySelector('.truncate')).toBeNull();
    expect(chip).not.toContainElement(source);
    expect(source).toHaveTextContent('Sweat test, scaled to this event');
    expect(source.className).not.toMatch(/truncate|whitespace-nowrap|line-clamp/);
  });

  it('counts the warnings in a chip that opens the panel and moves the focus there', async () => {
    const user = userEvent.setup();
    renderBoard({ caffeine: { enabled: true, asIngredient: true } });
    const chip = screen.getByRole('button', { name: '4 warnings: show the list' });
    expect(chip).toHaveAttribute('data-level', 'danger');
    expect(chip.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    // Drawn as tall as the static sweat chip; a phone board shows the icon and the count (the name says it in full).
    expect(chip).toHaveClass('min-h-7');
    expect(screen.getByTestId('board-sweat-chip')).toHaveClass('min-h-7');
    expect(within(chip).getByTestId('board-warnings-chip-compact')).toHaveTextContent(/^4$/);
    expect(within(chip).getByTestId('board-warnings-chip-compact')).toHaveClass('@md:hidden');
    const toggle = within(warningsPanel()).getByRole('button', { name: 'Warnings (4)' });
    expect(chip).toHaveAttribute('aria-controls', toggle.getAttribute('aria-controls'));

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(chip);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveFocus();
    expect(warningItems()).toHaveLength(4);

    // Already open: the chip only moves the focus.
    chip.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows a calm chip without warnings', () => {
    renderBoard({ event: { durationMin: 30 }, sodium: { mode: 'manual', manualMgPerHour: 0 } });
    const chip = screen.getByTestId('board-warnings-chip');
    expect(chip.tagName).toBe('SPAN');
    expect(chip).toHaveTextContent('No warnings');
    expect(within(warningsPanel()).getByText('No warnings for this plan.')).toBeInTheDocument();
  });

  it('uses the tone of the worst level', () => {
    renderBoard({ sweat: { source: 'preset' }, format: { type: 'drink' } });
    // One note only (a 9.4 % drink).
    expect(screen.getByRole('button', { name: '1 warning: show the list' })).toHaveAttribute('data-level', 'info');
  });
});

describe('RaceBoard: KPI tiles', () => {
  it('shows the four targets of the default plan', () => {
    renderBoard();
    expect(screen.getAllByRole('group').filter((g) => g.dataset.testid?.startsWith('kpi-')).map((g) => g.dataset.testid)).toEqual([
      'kpi-carbs',
      'kpi-sodium',
      'kpi-fluid',
      'kpi-caffeine',
    ]);
    // Carbs: 180 min at 75 g/h, 1:0.5 delivered, 225 g in total.
    expect(value('carbs')).toBe('75');
    expect(tile('Carbs')).toHaveTextContent('g/h');
    expect(sub('Carbs')).toBe('1:0.5 · 225 g total');
    expect(within(tile('Carbs')).queryByTestId('kpi-carbs-status')).not.toBeInTheDocument();
    // Sodium: 300 mg/h × 3 h = 900 mg; the table salt delivers it.
    expect(value('sodium')).toBe('300');
    expect(sub('Sodium')).toBe('900 mg total');
    expect(within(tile('Sodium')).queryByTestId('kpi-sodium-status')).not.toBeInTheDocument();
    // Fluid: 250 ml/h for 3 h; 0.23 L water lost of 70 kg = 0.3 %.
    expect(value('fluid')).toBe('250');
    expect(tile('Fluid')).toHaveTextContent('ml/h');
    expect(sub('Fluid')).toBe('750 ml total · 0.3% loss');
    // Caffeine is off.
    expect(value('caffeine')).toBe('Off');
    expect(sub('Caffeine')).toBe('Not in this plan');
    expect(screen.getByTestId('kpi-caffeine')).toHaveAttribute('data-enabled', 'false');
    // The colour bar per substance.
    expect(tile('Carbs').firstElementChild).toHaveClass('bg-glucose');
    expect(tile('Sodium').firstElementChild).toHaveClass('bg-sodium');
    expect(tile('Fluid').firstElementChild).toHaveClass('bg-fluid');
    expect(tile('Caffeine').firstElementChild).toHaveClass('bg-caffeine');
    expect(screen.getByTestId('kpi-carbs-value')).toHaveClass('kpi-value');
  });

  it.each([
    // Auto 1:0.5 of 75 g/h.
    [{}, 'Your recipe delivers glucose 50 g/h and fructose 25 g/h.'],
    // Adjusted 1:0.8: 0.8 / 1.8 = 44.4 % fructose.
    [{ carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 0.8 } } }, 'Your recipe delivers glucose 42 g/h and fructose 33 g/h.'],
    // Maltodextrin alone is all glucose.
    [
      { carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 1 }, ingredients: [{ ref: 3, weight: 100 }] } },
      'Your recipe delivers glucose 75 g/h and fructose 0 g/h.',
    ],
    // Nothing delivered.
    [{ carbs: { ingredients: [] } }, 'Your recipe delivers glucose 0 g/h and fructose 0 g/h.'],
  ])('gives the g/h on each pathway the recipe delivers in the carbs Why (%j)', (inputs, text) => {
    renderBoard(inputs);
    expect(within(tile('Carbs')).queryByText(/Your recipe delivers/)).not.toBeInTheDocument();
    expect(openWhy('Carbs')).toHaveTextContent(text);
  });

  it('has no pathway line without a carb target', () => {
    renderBoard({ event: { durationMin: 30 } });
    expect(openWhy('Carbs')).not.toHaveTextContent(/Your recipe delivers/);
  });

  it('keeps each tile to its number, sub-info and Why button: no pathway bar, no energy line', () => {
    renderBoard();
    expect(tile('Carbs').querySelector('[style]')).toBeNull();
    expect(screen.queryByTestId('board-energy')).not.toBeInTheDocument();
    for (const name of ['Carbs', 'Sodium', 'Fluid', 'Caffeine']) expect(tile(name)).not.toHaveTextContent(/kcal|Glucose/);
    // The energy is one tap away, in the carbs Why (closed by default).
    expect(screen.getByText(/^Energy: 900 kcal/)).not.toBeVisible();
  });

  it('reveals the carb explanation and its citations through Why, full width under the tile row', () => {
    renderBoard();
    const why = within(tile('Carbs')).getByRole('button', { name: 'Why? (Carbs)' });
    expect(why).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById(why.getAttribute('aria-controls'));
    expect(panel).not.toBeVisible();
    fireEvent.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'true');
    // carbs.why.long: 180 min is in the 60–90 g/h band.
    expect(
      within(panel).getByText(
        'Over 2.5 h, the evidence range is 60–90 g/h of carbs from mixed glucose and fructose. Your target is 75 g/h.',
      ),
    ).toBeVisible();
    expect(within(panel).getByRole('link', { name: /^Jeukendrup 2014/ })).toHaveAttribute(
      'href',
      'https://doi.org/10.1007/s40279-014-0148-z',
    );
    // Not inside the narrow tile: a grid item of its own across every column, right after its tile.
    expect(tile('Carbs')).not.toContainElement(panel);
    expect(panel).toHaveClass('col-span-full');
    expect(panel.parentElement).toBe(screen.getByTestId('board-kpis').firstElementChild);
    expect(panel.previousElementSibling).toBe(tile('Carbs'));
  });

  it('has a Why for sodium, fluid and caffeine with distinct names', () => {
    renderBoard();
    for (const name of ['Sodium', 'Fluid', 'Caffeine']) {
      expect(within(tile(name)).getByRole('button', { name: `Why? (${name})` })).toBeInTheDocument();
    }
    const panel = openWhy('Caffeine');
    expect(within(panel).getByText(/Caffeine is optional/)).toBeVisible();
    expect(tile('Caffeine')).not.toContainElement(panel);
    expect(panel.previousElementSibling).toBe(tile('Caffeine'));
  });

  it('says how many carbs are missing when there is no carb ingredient', () => {
    renderBoard({ carbs: { ingredients: [] } });
    expect(value('carbs')).toBe('75');
    // Nothing is delivered, so there is no ratio to show.
    expect(sub('Carbs')).toBe('0:0 · 225 g total');
    const status = screen.getByTestId('kpi-carbs-status');
    expect(status).toHaveTextContent('225 g short: the recipe gives 0 g');
    expect(status).toHaveAttribute('data-tone', 'warn');
    expect(status.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    // Energy: 0 of the 900 planned kcal.
    expect(openWhy('Carbs')).toHaveTextContent('Energy: 0 of 900 kcal from carbs · you burn about 2,040 kcal.');
  });

  it('has no carb target for a short event', () => {
    renderBoard({ event: { durationMin: 30 } });
    expect(value('carbs')).toBe('0');
    expect(sub('Carbs')).toBe('No carb target');
    expect(screen.queryByTestId('kpi-carbs-status')).not.toBeInTheDocument();
    expect(openWhy('Carbs')).toHaveTextContent('Energy: 0 kcal from carbs · you burn about 340 kcal.');
  });

  it('gives the energy from carbs and the energy the event burns in the carbs Why', () => {
    renderBoard();
    // 225 g × 4 kcal = 900 kcal; the ride burns about 2,035 kcal (rounded to 10).
    expect(openWhy('Carbs')).toHaveTextContent('Energy: 900 kcal from carbs · you burn about 2,040 kcal.');
  });

  it('says when the manual salts deliver too little sodium', () => {
    renderBoard({ salts: { mode: 'manual', manual: [{ ref: 31, amountMg: 1000 }] } });
    // 1,000 mg table salt → 393 mg sodium of 900 mg.
    expect(value('sodium')).toBe('300');
    expect(screen.getByTestId('kpi-sodium-status')).toHaveTextContent('507 mg short: the salts give 393 mg');
  });

  it('says when the manual salts deliver more sodium than the target', () => {
    renderBoard({ salts: { mode: 'manual', manual: [{ ref: 31, amountMg: 3000 }] } });
    // 3,000 mg table salt → 1,179 mg sodium: 279 mg over 900 mg.
    expect(screen.getByTestId('kpi-sodium-status')).toHaveTextContent('279 mg over: the salts give 1,179 mg');
  });

  it('says a manual sodium target below the evidence range is below range', () => {
    renderBoard({ sodium: { mode: 'manual', manualMgPerHour: 60 } });
    expect(value('sodium')).toBe('60');
    expect(sub('Sodium')).toBe('180 mg total');
    const status = screen.getByTestId('kpi-sodium-status');
    expect(status).toHaveTextContent('Below the evidence range');
    expect(status).toHaveAttribute('data-tone', 'neutral');
  });

  it('has no sodium target when it is set to zero', () => {
    renderBoard({ sodium: { mode: 'manual', manualMgPerHour: 0 } });
    expect(value('sodium')).toBe('0');
    expect(sub('Sodium')).toBe('No sodium target');
  });

  it('shows the fluid of a preset sweat rate', () => {
    renderBoard({ sweat: { source: 'preset' } });
    // 1.25 L/h sweat, 800 ml/h drunk for 3 h: 1.35 L (1.9 %) lost, up to 2 %: no status line.
    expect(value('fluid')).toBe('800');
    expect(sub('Fluid')).toBe('2,400 ml total · 1.9% loss');
    expect(screen.queryByTestId('kpi-fluid-status')).not.toBeInTheDocument();
  });

  // [hewbutler2015] drinking more than you sweat means weight gain
  it('flags a projected weight gain with text and an icon, not only colour', () => {
    // 2.4 L drunk against 0.98 L sweated: 1.42 L gained, 2.0 % of 70 kg.
    renderBoard({ fluid: { mode: 'manual', manualMlPerHour: 800 } });
    expect(sub('Fluid')).toBe('2,400 ml total · 2% gain');
    const status = screen.getByTestId('kpi-fluid-status');
    expect(status).toHaveTextContent('Weight gain');
    expect(status).toHaveAttribute('data-tone', 'danger');
    expect(status.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  // [sawka2007] losses above 3 % of body mass hurt performance
  it('flags a large water deficit, and a mild one', () => {
    const { unmount } = renderBoard({ sweat: { source: 'preset', rateIndex: 5 }, fluid: { mode: 'manual', manualMlPerHour: 0 } });
    expect(value('fluid')).toBe('0');
    expect(sub('Fluid')).toBe('No fluid planned');
    expect(screen.getByTestId('kpi-fluid-status')).toHaveTextContent('Over 3% loss');
    expect(screen.getByTestId('kpi-fluid-status')).toHaveAttribute('data-tone', 'warn');
    unmount();

    // 1.36 L/h sweat, 0.8 L/h drunk: 1.69 L lost (2.4 %).
    renderBoard({ sweat: { source: 'test', tests: [TEST], calibrate: false } });
    expect(sub('Fluid')).toBe('2,400 ml total · 2.4% loss');
    expect(screen.getByTestId('kpi-fluid-status')).toHaveTextContent('2–3% loss');
  });

  it('shows the planned caffeine total', () => {
    renderBoard({ caffeine: { enabled: true } });
    // 70 kg × 3 mg/kg = 210 mg: 140 mg an hour before the start and 70 mg at 2 h.
    expect(value('caffeine')).toBe('210');
    expect(tile('Caffeine')).toHaveTextContent('mg');
    expect(sub('Caffeine')).toBe('3 mg/kg · 2 doses');
    expect(screen.getByTestId('kpi-caffeine')).toHaveAttribute('data-enabled', 'true');
  });

  it('renders on its own for the guided flow', () => {
    renderBoard(undefined, { children: <BoardKpis /> });
    expect(screen.getAllByRole('group')).toHaveLength(4);
    expect(value('carbs')).toBe('75');
  });
});

describe('RaceBoard: recipe lanes', () => {
  it('shows the default gel batch from the plan recipe sections', () => {
    renderBoard();
    expect(screen.queryByTestId('recipe-section-drink')).not.toBeInTheDocument();

    // 180 min at 75 g/h, 1:0.5: 150 g glucose (158 g maltodextrin) + 75 g fructose; 300 mg/h sodium
    // (900 mg) as 2,290 mg table salt; a 60 % gel of 375 g needs 140 ml added water.
    expect(rows('gel')).toEqual([
      ['Maltodextrin', '158 g'],
      ['Crystalline Fructose', '75 g'],
      ['Sodium Chloride (Table Salt)', '2.3 g'],
      ['Warm water', '140 ml'],
    ]);
    expect(rows('gel')).toEqual(expectedRows({}, 'gel'));
    const gel = screen.getByRole('group', { name: 'Gels ×9' });
    expect(gel).toBe(section('gel'));
    expect(within(gel).getByRole('list', { name: 'Ingredients' })).toBeInTheDocument();
    expect(within(gel).queryByTestId('section-servings')).not.toBeInTheDocument();
    expect(within(gel).getByTestId('amounts-caption')).toHaveTextContent('Whole batch');

    // One gel: 375 g / 9 = 42 g, 25 g carbs, 60 % w/w, about 32 ml.
    expect(facts('gel').querySelector('dl')).toHaveAccessibleName('Per gel facts');
    expect(fact('gel', 'Gel mass')).toBe('42 g');
    expect(fact('gel', 'Gel volume')).toBe('≈ 32 ml');
    expect(fact('gel', 'Carbs per gel')).toBe('25 g');
    expect(fact('gel', 'Carbohydrate')).toBe('60% w/w');

    // About 4,327 mOsm/kg: rounded to 100 and marked as likely higher, with a chip that names the band.
    const osmo = within(facts('gel')).getByTestId('osmolality');
    expect(osmo).toHaveTextContent('Osmolality≈ 4,300 mOsm/kg, likely higher');
    const chip = within(osmo).getByTestId('tonicity-chip');
    expect(chip).toHaveTextContent('Hypertonic');
    expect(chip).toHaveAttribute('data-tonicity', 'hypertonic');
    expect(chip.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws a bar per carb ingredient from its share of the section carbs, and plain rows for the rest', () => {
    renderBoard();
    const lanes = within(section('gel')).getAllByRole('listitem').filter((li) => li.hasAttribute('data-kind'));
    const [malto, fructose, salt, water] = lanes;
    // 150 g of 225 g carbs = 67 %; 75 g = 33 %.
    expect(malto).toHaveAttribute('data-tone', 'glucose');
    expect(parseFloat(malto.querySelector('[style]').style.width)).toBeCloseTo(66.667, 2);
    expect(malto).toHaveTextContent('67% of the carbs in this part');
    expect(within(malto).getByTestId('item-detail')).toHaveTextContent('150 g carbs · glucose 150 g · fructose 0 g');
    expect(fructose).toHaveAttribute('data-tone', 'fructose');
    expect(parseFloat(fructose.querySelector('[style]').style.width)).toBeCloseTo(33.333, 2);
    expect(within(fructose).getByTestId('item-detail')).toHaveTextContent('75 g carbs · glucose 0 g · fructose 75 g');
    // Salts and water: a colour dot, no bar.
    expect(salt).toHaveAttribute('data-tone', 'sodium');
    expect(salt.querySelector('[style]')).toBeNull();
    expect(water).toHaveAttribute('data-tone', 'fluid');
    expect(water.querySelector('[style]')).toBeNull();
    expect(water.querySelector('.bg-fluid')).toHaveAttribute('aria-hidden', 'true');
  });

  it('switches format.view to per serving and shows the amounts for one gel', async () => {
    const user = userEvent.setup();
    renderBoard();
    expect(viewRadio('Total')).toHaveAttribute('aria-checked', 'true');
    await user.click(viewRadio('Per serving'));
    expect(latest.inputs.format.view).toBe('perServing');
    expect(viewRadio('Per serving')).toHaveAttribute('aria-checked', 'true');
    expect(within(section('gel')).getByTestId('amounts-caption')).toHaveTextContent('Per gel');
    // 9 gels: 158/9, 75/9, 2,290/9 mg, 140/9 ml.
    expect(rows('gel')).toEqual([
      ['Maltodextrin', '18 g'],
      ['Crystalline Fructose', '8.3 g'],
      ['Sodium Chloride (Table Salt)', '0.25 g'],
      ['Warm water', '16 ml'],
    ]);
    expect(rows('gel')).toEqual(expectedRows({ format: { view: 'perServing' } }, 'gel', 'perServing'));
    // The carb detail follows the view; the share does not change.
    expect(within(section('gel')).getAllByTestId('item-detail')[0]).toHaveTextContent('17 g carbs · glucose 17 g · fructose 0 g');
    expect(section('gel')).toHaveTextContent('67% of the carbs in this part');

    // Keyboard: the radio group moves and selects with the arrow keys.
    viewRadio('Per serving').focus();
    await user.keyboard('{ArrowLeft}');
    expect(latest.inputs.format.view).toBe('total');
    expect(viewRadio('Total')).toHaveFocus();
  });

  it('shows the bottles of a drink', async () => {
    const user = userEvent.setup();
    const inputs = { sweat: { source: 'preset' }, format: { type: 'drink' } };
    renderBoard(inputs);
    expect(screen.queryByTestId('recipe-section-gel')).not.toBeInTheDocument();
    // 800 ml/h for 3 h = 2,400 ml in four 750 ml bottles, each filled to 600 ml.
    expect(screen.getByRole('heading', { name: 'Bottles ×4' })).toBeInTheDocument();
    expect(within(section('drink')).getByTestId('section-servings')).toHaveTextContent('600 ml each (750 ml bottle)');
    expect(within(section('drink')).getByTestId('amounts-caption')).toHaveTextContent('All bottles');
    expect(rows('drink')).toEqual([
      ['Maltodextrin', '158 g'],
      ['Crystalline Fructose', '75 g'],
      ['Sodium Chloride (Table Salt)', '4.4 g'],
      ['Water, to fill each bottle to 600 ml', '2,249 ml'],
    ]);
    expect(rows('drink')).toEqual(expectedRows(inputs, 'drink'));
    expect(fact('drink', 'Fill each bottle to')).toBe('600 ml');
    expect(fact('drink', 'Carbs per bottle')).toBe('56 g (9.4% w/v)');
    expect(fact('drink', 'Sodium per bottle')).toBe('0.43 g (712 mg/L)');
    const osmo = within(facts('drink')).getByTestId('osmolality');
    expect(osmo).toHaveTextContent('≈ 312 mOsm/kg');
    expect(osmo).not.toHaveTextContent('likely higher');
    expect(within(osmo).getByTestId('tonicity-chip')).toHaveTextContent('Isotonic');
    // The drink's own warning is in the warnings panel.
    expect(warningsPanel()).toHaveTextContent('Each bottle is 9.4% carbohydrate.');

    await user.click(viewRadio('Per serving'));
    expect(within(section('drink')).getByTestId('amounts-caption')).toHaveTextContent('Per bottle');
    expect(rows('drink')).toEqual([
      ['Maltodextrin', '39 g'],
      ['Crystalline Fructose', '19 g'],
      ['Sodium Chloride (Table Salt)', '1.1 g'],
      ['Water, to fill each bottle to 600 ml', '562 ml'],
    ]);
  });

  it('splits the carbs between gels and a drink in both mode', async () => {
    const user = userEvent.setup();
    const inputs = { sweat: { source: 'preset' }, format: { type: 'both' } };
    renderBoard(inputs);
    // Half the carbs in gels; the other half and all salts in the drink.
    expect(rows('gel')).toEqual(expectedRows(inputs, 'gel'));
    expect(rows('gel')[0]).toEqual(['Maltodextrin', '79 g']);
    expect(rows('gel').some(([label]) => label.startsWith('Sodium'))).toBe(false);
    expect(rows('drink')).toEqual(expectedRows(inputs, 'drink'));
    expect(rows('drink')[2]).toEqual(['Sodium Chloride (Table Salt)', '4.4 g']);
    // Each section's bars are shares of its own carbs.
    expect(section('drink')).toHaveTextContent('67% of the carbs in this part');
    // A 4.7 % drink is hypotonic (181 mOsm/kg).
    const drinkOsmo = within(facts('drink')).getByTestId('osmolality');
    expect(drinkOsmo).toHaveTextContent('≈ 181 mOsm/kg');
    expect(within(drinkOsmo).getByTestId('tonicity-chip')).toHaveTextContent('Hypotonic');
    await user.click(viewRadio('Per serving'));
    expect(within(section('gel')).getByTestId('amounts-caption')).toHaveTextContent('Per gel');
    expect(within(section('drink')).getByTestId('amounts-caption')).toHaveTextContent('Per bottle');
  });

  it('puts the whole recipe into a checked drink when no gels are planned', () => {
    renderBoard({ sweat: { source: 'preset' }, format: { type: 'both', gelsPerHour: 0 } });
    // No gels: everything is one drink, so its strength covers all 225 g of carbs (9.4 % w/v, not 4.7 %).
    expect(screen.queryByTestId('recipe-section-gel')).not.toBeInTheDocument();
    expect(rows('drink')).toEqual([
      ['Maltodextrin', '158 g'],
      ['Crystalline Fructose', '75 g'],
      ['Sodium Chloride (Table Salt)', '4.4 g'],
      ['Water, to fill each bottle to 600 ml', '2,249 ml'],
    ]);
    expect(fact('drink', 'Carbs per bottle')).toBe('56 g (9.4% w/v)');
    expect(warningsPanel()).toHaveTextContent('No gels are planned, so the recipe puts all the carbs in your drink.');
    expect(warningsPanel()).not.toHaveTextContent(/Take each gel with/);
  });

  // [thomas2016] no carbs under 45 min: no gels; the salts go into a drink
  it('puts the salts in a drink when the plan has no carbs', () => {
    renderBoard({ event: { durationMin: 30 } });
    expect(screen.queryByTestId('recipe-section-gel')).not.toBeInTheDocument();
    expect(rows('drink')).toEqual(expectedRows({ event: { durationMin: 30 } }, 'drink'));
    // 150 mg/h sodium for 30 min = 75 mg, from 191 mg of table salt.
    expect(rows('drink')[0]).toEqual(['Sodium Chloride (Table Salt)', '0.19 g']);
    expect(warningsPanel()).toHaveTextContent('There are no carbs to put in gels, so the recipe puts the salts in your drink.');
  });

  it('explains a recipe without carbs when the ratio is 0:0', () => {
    renderBoard({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } });
    expect(screen.queryByTestId('recipe-section-gel')).not.toBeInTheDocument();
    expect(rows('drink').some(([label]) => label === 'Maltodextrin')).toBe(false);
    const [first] = warningItems();
    expect(first).toHaveAttribute('data-level', 'danger');
    expect(first).toHaveTextContent(/Set at least one ratio part above zero/);
    expect(warningsPanel()).toHaveTextContent('There are no carbs to put in gels, so the recipe puts the salts in your drink.');
  });

  it('explains a recipe without carb ingredients', () => {
    renderBoard({ carbs: { ingredients: [] } });
    expect(screen.queryByTestId('recipe-section-gel')).not.toBeInTheDocument();
    expect(rows('drink')[0]).toEqual(['Sodium Chloride (Table Salt)', '2.3 g']);
    expect(warningsPanel()).toHaveTextContent('Add at least one carb ingredient. Without one, the recipe has no carbs.');
  });

  it('says when the ingredients cannot make the ratio and shows what the recipe uses', () => {
    renderBoard({
      carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 1 }, ingredients: [{ ref: 3, weight: 100 }] },
    });
    // Maltodextrin alone: 225 g carbs at 0.95 g per g = 237 g, a 1:0 mix; one lane with the whole bar.
    expect(rows('gel')[0]).toEqual(['Maltodextrin', '237 g']);
    expect(sub('Carbs')).toBe('1:0 · 225 g total');
    expect(warningsPanel()).toHaveTextContent(
      'Your ingredients cannot make 1:1 glucose to fructose. The recipe uses 1:0, the closest they can make.',
    );
    const lane = within(section('gel')).getAllByRole('listitem')[0];
    expect(lane.querySelector('[style]').style.width).toBe('100%');
  });

  it('lists caffeine tablet lines in the gels, with the no-powder danger first in the warnings', () => {
    renderBoard({ caffeine: { enabled: true, asIngredient: true } });
    // 70 kg, 3 mg/kg, 180 min: intra 50 mg (0.5 × 100 mg) in the gel at 120 min (gel 7).
    expect(rows('gel').at(-1)).toEqual(['Caffeine for gel 7 (100 mg tablets)', '0.5 tablets']);
    expect(rows('gel')).toEqual(expectedRows({ caffeine: { enabled: true, asIngredient: true } }, 'gel'));
    const lane = within(section('gel')).getAllByRole('listitem').filter((li) => li.dataset.kind === 'caffeine')[0];
    expect(lane).toHaveAttribute('data-tone', 'caffeine');
    const [first] = warningItems();
    expect(first).toHaveAttribute('data-level', 'danger');
    expect(within(first).getByText(/Never use pure caffeine powder/)).toBeInTheDocument();
  });

  it('shows an empty state when there is nothing to mix', () => {
    renderBoard({ event: { durationMin: 30 }, sodium: { mode: 'manual', manualMgPerHour: 0 } });
    expect(screen.queryByTestId('recipe-section-gel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('recipe-section-drink')).not.toBeInTheDocument();
    expect(within(recipe()).getByText('Nothing to mix for this plan.')).toBeInTheDocument();
    expect(screen.getByTestId('cost-diy')).toHaveTextContent('€0.00');
  });

  it('says why a drink has no bottles when the plan has no fluid', () => {
    renderBoard({ format: { type: 'drink' }, fluid: { mode: 'manual', manualMlPerHour: 0 } });
    expect(screen.getByRole('heading', { name: 'Drink' })).toBeInTheDocument();
    expect(within(section('drink')).getByTestId('section-servings')).toHaveTextContent('No bottles: no fluid planned');
    expect(within(section('drink')).getByTestId('amounts-caption')).toHaveTextContent('Whole activity');
    expect(screen.queryByTestId('recipe-facts-drink')).not.toBeInTheDocument();
    expect(warningsPanel()).toHaveTextContent('Your plan has no fluid, so there is no drink to mix.');
  });

  it('formats the lanes like the domain for every format and view', () => {
    for (const inputs of [
      {},
      { format: { view: 'perServing' } },
      { sweat: { source: 'preset' }, format: { type: 'both', view: 'perServing' } },
      { event: { durationMin: 60 }, caffeine: { enabled: true, asIngredient: true } },
    ]) {
      const { unmount } = renderBoard(inputs);
      const plan = computePlan(inputs);
      for (const s of plan.recipe.sections) {
        expect(rows(s.kind)).toEqual(
          s.items.map((item) => [
            typeof item.label === 'string' ? item.label : t(item.label),
            domainFormatAmount(plan.inputs.format.view === 'perServing' ? item.perServing : item.amount, item.unit),
          ]),
        );
      }
      unmount();
    }
  });
});

describe('RaceBoard: cost and actions', () => {
  it('shows the rough cost in the chosen currency, marked approximate', () => {
    const { unmount } = renderBoard();
    // 225 g carbs: EUR 0.014/g DIY = €3.15, commercial €20.25, savings €17.10.
    expect(screen.getByTestId('cost-diy')).toHaveTextContent('€3.15');
    expect(screen.getByTestId('cost-savings')).toHaveTextContent('€17.10 vs commercial gels');
    expect(screen.getByTestId('board-cost')).toHaveTextContent('approximate');
    // A price comparison, not a status: ink like the DIY cost, no status colour without its icon.
    expect(screen.getByTestId('cost-savings')).toHaveClass('text-ink');
    expect(screen.getByTestId('board-cost').querySelector('[class*="text-ok"]')).toBeNull();
    unmount();

    renderBoard(undefined, { prefs: { currency: 'USD' } });
    // USD 0.015/g: $3.375 → $3.38; commercial $22.50; savings $19.125 → $19.13.
    expect(screen.getByTestId('cost-diy')).toHaveTextContent('$3.38');
    expect(screen.getByTestId('cost-savings')).toHaveTextContent('$19.13 vs commercial gels');
  });

  it('puts START MIXING right after the lanes and the cost estimate after the actions', () => {
    renderBoard();
    const mix = screen.getByRole('button', { name: 'Start mixing' });
    const cost = screen.getByTestId('board-cost');
    expect(section('gel').compareDocumentPosition(mix) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mix.compareDocumentPosition(cost) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId('recipe-view-description')).not.toBeInTheDocument();
  });

  it('opens the mixing steps from START MIXING, the one accent button', async () => {
    const user = userEvent.setup();
    renderBoard();
    const mix = screen.getByRole('button', { name: 'Start mixing' });
    expect(mix).toHaveClass('bg-accent');
    expect(mix).toHaveAttribute('aria-haspopup', 'dialog');
    expect(board().querySelectorAll('.bg-accent')).toHaveLength(1);
    expect(latest.ui.modal).toBeNull();
    await user.click(mix);
    expect(latest.ui.modal).toBe('mixing');
  });

  it('opens the share dialog', async () => {
    const user = userEvent.setup();
    renderBoard();
    expect(within(recipe()).getByRole('button', { name: 'Share plan' })).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(within(recipe()).getByRole('button', { name: 'Share plan' }));
    expect(latest.ui.modal).toBe('share');
    expect(latest.ui.shareView).toBe('menu');
  });

  it('opens the print dialog', async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderBoard();
    await user.click(screen.getByRole('button', { name: 'Print plan' }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(boardRecipeSource).not.toMatch(/jspdf/i);
  });
});

describe('RaceBoard: next up', () => {
  const nextUp = () => screen.getByRole('region', { name: 'Next up' });
  /** The short time shown on screen (hidden from screen readers). */
  const shownTime = (li) => within(li).getByTestId('next-time').querySelector('[aria-hidden="true"]').textContent;
  const items = () =>
    within(within(nextUp()).getByRole('list')).getAllByRole('listitem').map((li) => [
      shownTime(li),
      within(li).getByTestId('next-title').textContent,
      within(li).getByTestId('next-text').textContent,
    ]);

  it('lists the first four schedule events with times', () => {
    renderBoard();
    expect(items()).toEqual([
      ['T+0m', 'Start', 'Start your activity and take gel 1 with about 80 ml fluid.'],
      ['T+20m', 'Fuel', 'Take gel 2 with about 80 ml fluid.'],
      ['T+40m', 'Fuel', 'Take gel 3 with about 90 ml fluid.'],
      ['T+1h', 'Fuel', 'Take gel 4 with about 80 ml fluid.'],
    ]);
    // 10 events in all.
    expect(within(nextUp()).getByTestId('next-more')).toHaveTextContent('6 more events in the full schedule');
    expect(within(nextUp()).getByRole('list')).toHaveAccessibleName('Next up');
  });

  it('draws each event with the full schedule badge, so both views match', () => {
    renderBoard({ caffeine: { enabled: true }, bicarb: { enabled: true } });
    const lis = within(within(nextUp()).getByRole('list')).getAllByRole('listitem');
    expect(lis.map((li) => li.dataset.type)).toEqual(['bicarb', 'caffeine', 'start', 'fuel']);
    for (const li of lis) {
      const badge = li.querySelector('[data-tone]');
      expect(badge).toHaveAttribute('aria-hidden', 'true');
      expect(badge).toHaveAttribute('data-tone', eventLook(li.dataset.type).tone);
    }
    // Bicarbonate is the schedule's "Na" badge; the start is not a status mark.
    expect(lis[0].querySelector('[data-tone="sodium"]')).toHaveTextContent('Na');
    expect(boardNextUpSource).not.toMatch(/CircleCheck|FlagTriangleRight|EVENT_LOOKS = /);
  });

  it('gives each time in words for screen readers, as the full schedule does', () => {
    renderBoard({ caffeine: { enabled: true } });
    const lis = within(within(nextUp()).getByRole('list')).getAllByRole('listitem');
    const spoken = (li) => within(li).getByTestId('next-time').querySelector('.sr-only').textContent;
    // 140 mg an hour before the start, then the start.
    expect(shownTime(lis[0])).toBe('T−1h');
    expect(spoken(lis[0])).toBe('1 hour before the start');
    expect(spoken(lis[1])).toBe('At the start');
    expect(shownTime(lis[2])).toBe('T+20m');
    expect(spoken(lis[2])).toBe('20 minutes after the start');
  });

  it('starts with the events before the start', () => {
    renderBoard({ caffeine: { enabled: true, asIngredient: true } });
    expect(items()[0]).toEqual(['T−1h', 'Caffeine', 'Take 150 mg caffeine. Tablets: 1.5.']);
  });

  it('shows every event of a short plan without a "more" line', () => {
    renderBoard({ event: { durationMin: 30 }, sodium: { mode: 'manual', manualMgPerHour: 0 } });
    expect(items().map(([time, title]) => `${time} ${title}`)).toEqual(['T+0m Start', 'T+0m Hydration', 'T+30m Finish']);
    expect(within(nextUp()).queryByTestId('next-more')).not.toBeInTheDocument();
  });

  it('switches the phone tab to the full schedule in expert mode', async () => {
    const user = userEvent.setup();
    renderBoard(undefined, { prefs: { mode: 'expert' } });
    const full = within(nextUp()).getByRole('button', { name: 'Full schedule' });
    // Shown at every width: on a desktop the schedule is far below the setup column.
    expect(full).not.toHaveClass('lg:hidden');
    expect(latest.ui.boardTab).toBe('board');
    await user.click(full);
    expect(latest.ui.boardTab).toBe('schedule');
  });

  it('scrolls to the schedule that is already on screen (a desktop) without switching the tab', async () => {
    const user = userEvent.setup();
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    try {
      // A desktop: the board and, under the columns, the schedule, both on screen.
      const desktop = (
        <>
          <RaceBoard />
          <Schedule />
        </>
      );
      renderBoard(undefined, { prefs: { mode: 'expert' }, children: desktop });
      const schedule = screen.getByTestId('schedule');
      vi.spyOn(schedule, 'getClientRects').mockReturnValue(/** @type {any} */ ([{ width: 900, height: 600 }]));
      await user.click(within(nextUp()).getByRole('button', { name: 'Full schedule' }));
      expect(latest.ui.boardTab).toBe('board');
      expect(screen.getByRole('heading', { name: 'Schedule' })).toHaveFocus();
      expect(scrolled.mock.contexts[0]).toBe(schedule);
    } finally {
      delete Element.prototype.scrollIntoView;
    }
  });

  it('moves the focus to the schedule heading when "Full schedule" hides the board', async () => {
    const user = userEvent.setup();
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    try {
      renderBoard(undefined, { prefs: { mode: 'expert' }, children: <PhoneShell /> });
      const full = within(nextUp()).getByRole('button', { name: 'Full schedule' });
      full.focus();
      await user.keyboard('{Enter}');
      expect(latest.ui.boardTab).toBe('schedule');
      // The board (with the button) is display: none now; the focus is on the schedule, not <body>.
      expect(board().closest('section')).not.toBeVisible();
      const heading = screen.getByRole('heading', { name: 'Schedule' });
      expect(heading).toHaveFocus();
      expect(heading).toHaveAttribute('tabindex', '-1');
      expect(scrolled).toHaveBeenCalledWith({ block: 'start' });
      expect(scrolled.mock.contexts[0]).toBe(screen.getByTestId('schedule'));
      // The temporary tabindex goes when the focus leaves.
      await user.tab();
      expect(heading).not.toHaveAttribute('tabindex');

      // Back on the board tab, the button only switches again.
      act(() => latest.ui.setBoardTab('board'));
      await user.click(within(nextUp()).getByRole('button', { name: 'Full schedule' }));
      expect(heading).toHaveFocus();
    } finally {
      delete Element.prototype.scrollIntoView;
    }
  });

  it('does not steal the focus later when the tab bar opens the schedule', async () => {
    renderBoard(undefined, { prefs: { mode: 'expert' }, children: <PhoneShell /> });
    const before = document.activeElement;
    act(() => latest.ui.setBoardTab('schedule'));
    expect(document.activeElement).toBe(before);
    expect(screen.getByRole('heading', { name: 'Schedule' })).not.toHaveAttribute('tabindex');
  });

  it('has no schedule button in guided mode unless the flow passes one', async () => {
    const user = userEvent.setup();
    const { unmount } = renderBoard(undefined, { prefs: { mode: 'guided' } });
    expect(within(nextUp()).queryByRole('button', { name: 'Full schedule' })).not.toBeInTheDocument();
    unmount();

    const onShowSchedule = vi.fn();
    renderBoard(undefined, { prefs: { mode: 'guided' }, props: { onShowSchedule } });
    const full = within(nextUp()).getByRole('button', { name: 'Full schedule' });
    expect(full).not.toHaveClass('lg:hidden');
    await user.click(full);
    expect(onShowSchedule).toHaveBeenCalledTimes(1);
    expect(latest.ui.boardTab).toBe('board');
  });
});

describe('RaceBoard: warnings panel', () => {
  it('lists every plan warning, danger first, open by default and collapsible', async () => {
    const user = userEvent.setup();
    // 100 ml/h of fluid keeps a warning between the danger and the notes: 900 mg sodium in 300 ml.
    const inputs = { caffeine: { enabled: true, asIngredient: true }, fluid: { mode: 'manual', manualMlPerHour: 100 } };
    renderBoard(inputs);
    const plan = computePlan(inputs);
    expect(warningItems().map((li) => li.dataset.level)).toEqual(['danger', 'warning', 'info', 'info', 'info']);
    expect(warningItems()).toHaveLength(plan.warnings.length);
    expect(warningItems()[0]).toHaveTextContent(/^Danger: Add caffeine as 100 mg tablets/);
    // Sources stay with each warning.
    expect(within(warningItems()[1]).getByRole('link', { name: /EFSA/ })).toBeInTheDocument();

    const toggle = within(warningsPanel()).getByRole('button', { name: 'Warnings (5)' });
    const body = document.getElementById(toggle.getAttribute('aria-controls'));
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(body).toBeVisible();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(body).not.toBeVisible();
    // Still mounted, so aria-controls always points at it.
    expect(within(body).getAllByRole('listitem', { hidden: true }).length).toBeGreaterThan(0);
  });

  it('follows plan changes', () => {
    renderBoard();
    expect(warningItems().map((li) => li.dataset.level)).toEqual(['info']);
    expect(warningItems()[0]).toHaveTextContent('Take each gel with about 210 ml of water.');
  });
});

describe('RaceBoard: warnings announcement', () => {
  const status = () => screen.getByTestId('board-warnings-status');

  it('has a polite, atomic, visually hidden live region that says nothing on load', () => {
    renderBoard({ caffeine: { enabled: true, asIngredient: true } });
    // A plain live region: the toast is the page's one role="status".
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(status()).toHaveAttribute('aria-live', 'polite');
    expect(status()).toHaveAttribute('aria-atomic', 'true');
    expect(status()).toHaveClass('sr-only');
    expect(status()).toHaveTextContent(/^$/);
    // Outside the board, so it still speaks while the board is hidden (the Setup tab on phones).
    expect(board()).not.toContainElement(status());
    // The list itself is not live.
    expect(warningsPanel().querySelector('[aria-live]')).toBeNull();
  });

  it('announces a changed number of warnings or dangers once it settles', () => {
    vi.useFakeTimers();
    try {
      renderBoard();
      expect(warningItems()).toHaveLength(1);
      // Caffeine as an ingredient adds the "tablets, never powder" danger and more.
      act(() => latest.set('caffeine', { ...latest.inputs.caffeine, enabled: true, asIngredient: true }));
      expect(status()).toHaveTextContent(/^$/);
      act(() => vi.advanceTimersByTime(WARNINGS_ANNOUNCE_DELAY_MS - 1));
      expect(status()).toHaveTextContent(/^$/);
      act(() => vi.advanceTimersByTime(1));
      expect(status()).toHaveTextContent(/^4 warnings, 1 danger$/);

      // A change that is undone before it settles is not announced.
      act(() => latest.set('caffeine.asIngredient', false));
      act(() => vi.advanceTimersByTime(WARNINGS_ANNOUNCE_DELAY_MS / 2));
      act(() => latest.set('caffeine.asIngredient', true));
      act(() => vi.advanceTimersByTime(WARNINGS_ANNOUNCE_DELAY_MS * 2));
      expect(status()).toHaveTextContent(/^4 warnings, 1 danger$/);

      // Back to no caffeine: one warning, no danger.
      act(() => latest.set('caffeine.enabled', false));
      act(() => vi.advanceTimersByTime(WARNINGS_ANNOUNCE_DELAY_MS));
      expect(status()).toHaveTextContent(/^1 warning$/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('says when every warning is gone', () => {
    vi.useFakeTimers();
    try {
      renderBoard({ event: { durationMin: 30 } });
      act(() => latest.set('sodium', { ...latest.inputs.sodium, mode: 'manual', manualMgPerHour: 0 }));
      act(() => vi.advanceTimersByTime(WARNINGS_ANNOUNCE_DELAY_MS));
      expect(screen.getByTestId('board-warnings-chip')).toHaveTextContent('No warnings');
      expect(status()).toHaveTextContent(/^No warnings$/);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('RaceBoard: units, language and currency', () => {
  it('shows fluid in US fl oz and keeps nutrients in g and mg', () => {
    renderBoard({ sweat: { source: 'preset' }, format: { type: 'drink' } }, { prefs: { unitSystem: 'imperial' } });
    // 800 ml/h = 27.05 fl oz/h; 2,400 ml = 81.2 fl oz.
    expect(value('fluid')).toBe('27');
    expect(tile('Fluid')).toHaveTextContent('fl oz/h');
    expect(sub('Fluid')).toBe('81 fl oz total · 1.9% loss');
    expect(screen.getByTestId('board-sweat-chip')).toHaveTextContent('Sweat 42 fl oz/h ±17');
    expect(screen.getByTestId('board-sweat-source')).toHaveTextContent('Self-assessed');
    // Bottles of 750 ml (25.4 fl oz) filled to 600 ml (20.3 fl oz).
    expect(within(section('drink')).getByTestId('section-servings')).toHaveTextContent('20 fl oz each (25 fl oz bottle)');
    expect(rows('drink')).toEqual([
      ['Maltodextrin', '158 g'],
      ['Crystalline Fructose', '75 g'],
      ['Sodium Chloride (Table Salt)', '4.4 g'],
      ['Water, to fill each bottle to 20 fl oz', '76 fl oz'],
    ]);
    expect(fact('drink', 'Fill each bottle to')).toBe('20 fl oz');
    expect(value('sodium')).toBe('570');
    expect(screen.getByRole('region', { name: 'Next up' })).toHaveTextContent('Drink about 8.8 fl oz from bottle 1.');
    expect(board()).not.toHaveTextContent(/\d ml\b/);
  });

  it('shows the gel water and volume in fl oz', () => {
    renderBoard(undefined, { prefs: { unitSystem: 'imperial' } });
    // 140 ml = 4.7 fl oz; one gel ≈ 32 ml = 1.1 fl oz; 250 ml/h = 8.5 fl oz/h; 0.33 L/h = 11 fl oz/h.
    expect(rows('gel').at(-1)).toEqual(['Warm water', '4.7 fl oz']);
    expect(fact('gel', 'Gel volume')).toBe('≈ 1.1 fl oz');
    expect(fact('gel', 'Gel mass')).toBe('42 g');
    expect(value('fluid')).toBe('8.5');
    expect(screen.getByTestId('board-sweat-chip')).toHaveTextContent('Sweat 11 fl oz/h ±17');
  });

  it.each([730, 740, 745])('never names two equal volumes for a %s ml fill of a 750 ml bottle in fl oz', (ml) => {
    const inputs = { format: { type: 'drink' }, fluid: { mode: 'manual', manualMlPerHour: ml } };
    // Metric says the bottles are not full.
    const { unmount } = renderBoard(inputs);
    expect(within(section('drink')).getByTestId('section-servings')).toHaveTextContent(`${ml} ml each (750 ml bottle)`);
    unmount();
    // In fl oz both volumes read 25 fl oz, so the bottle size is left out.
    renderBoard(inputs, { prefs: { unitSystem: 'imperial' } });
    expect(within(section('drink')).getByTestId('section-servings')).toHaveTextContent(/^25 fl oz each$/);
    expect(fact('drink', 'Fill each bottle to')).toBe('25 fl oz');
  });

  it('formats numbers, ratios and money in German', () => {
    renderBoard({ sweat: { source: 'preset' }, format: { type: 'both' } }, { prefs: { locale: 'de', currency: 'EUR' } });
    expect(sub('Kohlenhydrate')).toBe('1:0,5 · 225 g gesamt');
    expect(sub('Natrium')).toBe('1.710 mg gesamt');
    expect(sub('Trinkmenge')).toMatch(/^2\.400 ml gesamt · 1,9\s% Verlust$/);
    expect(screen.getByTestId('board-sweat-chip')).toHaveTextContent('Schweiß 1,25 L/h ±0,5');
    expect(rows('drink')[2]).toEqual(['Natriumchlorid (Kochsalz)', '4,4 g']);
    expect(screen.getByTestId('board-summary')).toHaveTextContent('3:00 h · Radfahren · Moderat');
    expect(within(facts('drink')).getByTestId('osmolality')).toHaveTextContent('≈ 181 mOsm/kg');
    expect(within(facts('gel')).getByTestId('osmolality')).toHaveTextContent('≈ 3.800 mOsm/kg');
    expect(screen.getByTestId('cost-diy').textContent).toMatch(/^3,15\s€$/);
  });

  it('follows a change of the unit system while open', () => {
    renderBoard();
    expect(value('fluid')).toBe('250');
    act(() => latest.ui.setUnitSystem('imperial'));
    expect(value('fluid')).toBe('8.5');
    act(() => latest.ui.setCurrency('GBP'));
    // GBP 0.012/g × 225 g = £2.70.
    expect(screen.getByTestId('cost-diy')).toHaveTextContent('£2.70');
  });
});

describe('RaceBoard: accessibility', () => {
  it.each([
    ['gel', {}],
    ['drink', { sweat: { source: 'preset' }, format: { type: 'drink' } }],
    ['both with caffeine', { format: { type: 'both' }, caffeine: { enabled: true, asIngredient: true } }],
    ['nothing to mix', { event: { durationMin: 30 }, sodium: { mode: 'manual', manualMgPerHour: 0 } }],
  ])('names every control and keeps ids unique (%s)', (_, inputs) => {
    const { container } = renderBoard(inputs, { prefs: { mode: 'expert' } });
    expect(container.querySelectorAll('input, select, textarea')).toHaveLength(0);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(8);
    for (const button of buttons) {
      expect(button, button.outerHTML).toHaveAccessibleName();
      const controls = button.getAttribute('aria-controls');
      if (controls) expect(document.getElementById(controls), controls).not.toBeNull();
    }
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const el of container.querySelectorAll('[aria-labelledby]')) {
      for (const id of el.getAttribute('aria-labelledby').split(' ')) expect(document.getElementById(id), id).not.toBeNull();
    }
  });

  it('keeps every button at least 44 px on touch screens or by size', () => {
    renderBoard(undefined, { prefs: { mode: 'expert' } });
    for (const button of board().querySelectorAll('button')) {
      // Drawn at 44 px on touch, or drawn smaller with a hit area that is (the compact "Why?" buttons and the chip).
      expect(button.className, button.textContent).toMatch(/min-h-(11|12)|pointer-coarse:min-h-11|size-11|pointer-coarse:before:h-11|pointer-coarse:before:min-h-11/);
    }
  });
});
