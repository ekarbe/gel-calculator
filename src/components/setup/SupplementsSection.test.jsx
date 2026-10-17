import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, within, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SupplementsSection, {
  SupplementsBicarb,
  SupplementsCaffeine,
  SupplementsFields,
  useSupplementsSummary,
} from './SupplementsSection';
import { PlanProvider, usePlanInputs, usePlan } from '../../state/PlanProvider';
import { UiProvider, PREFS_KEY } from '../../state/UiProvider';
import { lbToKg } from '../../domain/units';

/** Latest inputs, plan and setter, captured by <Spy /> on every render. */
const latest = { inputs: null, plan: null, set: null };

function Spy() {
  const { inputs, set } = usePlanInputs();
  const plan = usePlan();
  useEffect(() => {
    latest.inputs = inputs;
    latest.plan = plan;
    latest.set = set;
  }, [inputs, plan, set]);
  return null;
}

/**
 * Renders the section with the real providers. Autosave is off, so no test
 * reads inputs that an earlier test left in localStorage. `prefs` are stored
 * before the render, as a returning visitor's.
 */
function renderSupplements(initialInputs, { prefs, children = <SupplementsSection /> } = {}) {
  if (prefs) window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  return render(
    <PlanProvider initialInputs={initialInputs} persist={false}>
      <UiProvider>
        {children}
        <Spy />
      </UiProvider>
    </PlanProvider>,
  );
}

const caffeineBlock = () => screen.getByRole('group', { name: 'Caffeine' });
const bicarbBlock = () => screen.getByRole('group', { name: 'Sodium bicarbonate' });
/** The value of a fact (`<dt>` term → `<dd>`) inside `scope`. */
const fact = (scope, term) => within(scope).getByText(term, { selector: 'dt' }).nextElementSibling;
const warningsIn = (scope) => within(scope).queryByRole('list', { name: 'Warnings' });
const doses = () =>
  within(within(caffeineBlock()).getByRole('list', { name: 'Planned caffeine doses' })).getAllByRole('listitem');
/**
 * Checks one planned dose row: its time on screen (hidden from screen
 * readers) and in words (screen readers only), when, the amount and the
 * tablets line (or none).
 */
function expectDose(row, { time, spoken, when, mg, tablets = null }) {
  const shown = row.querySelector('[aria-hidden="true"].font-mono');
  expect(shown).toHaveTextContent(new RegExp(`^${time}$`));
  const sr = shown.nextElementSibling;
  expect(sr).toHaveClass('sr-only');
  expect(sr).toHaveTextContent(new RegExp(`^${spoken}$`));
  expect(row).toHaveTextContent(new RegExp(`^${time}${spoken} ${when}`));
  expect(within(row).getByText(mg)).toBeInTheDocument();
  if (tablets) expect(within(row).getByText(tablets)).toBeInTheDocument();
  else expect(row).not.toHaveTextContent(/tablet/);
}

/** Types into a number field like a user would: change, then leave the field. */
function enter(input, value) {
  fireEvent.change(input, { target: { value: String(value) } });
  fireEvent.blur(input);
}

/** The `aria-describedby` targets of a control, joined. */
const description = (el) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? `#${id} missing`)
    .join(' ');

let warnSpy;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  // No English message may fall back to its raw key.
  const missing = warnSpy.mock.calls.filter(([msg]) => String(msg).startsWith('[i18n] Missing message'));
  expect(missing).toEqual([]);
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  latest.inputs = null;
  latest.plan = null;
  latest.set = null;
});

describe('SupplementsSection: layout', () => {
  it('is a region named "Caffeine & bicarbonate" with a level-2 heading', () => {
    renderSupplements({ event: { durationMin: 60 } });
    const region = screen.getByRole('region', { name: 'Caffeine & bicarbonate' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Caffeine & bicarbonate' })).toBeInTheDocument();
    expect(within(region).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Caffeine',
      'Sodium bicarbonate',
    ]);
  });

  it('collapses to a one-line summary and opens again', async () => {
    const user = userEvent.setup();
    renderSupplements({ caffeine: { enabled: true } });
    const toggle = screen.getByRole('button', { name: 'Caffeine & bicarbonate' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const body = document.getElementById(toggle.getAttribute('aria-controls'));

    await user.click(toggle);
    expect(body).not.toBeVisible();
    // 70 kg, 3 mg/kg, 180 min: 140 + 70 mg.
    expect(screen.getByTestId('supplements-summary')).toHaveTextContent('Caffeine 210 mg · Bicarbonate off');
    act(() => latest.set('bicarb.enabled', true));
    // 0.3 g/kg × 70 kg
    expect(screen.getByTestId('supplements-summary')).toHaveTextContent('Caffeine 210 mg · Bicarbonate 21 g');

    await user.click(toggle);
    expect(body).toBeVisible();
    expect(screen.queryByTestId('supplements-summary')).not.toBeInTheDocument();
  });

  it('can render without the collapse button at another heading level', () => {
    renderSupplements(undefined, { children: <SupplementsSection headingLevel={3} collapsible={false} /> });
    expect(screen.getByRole('heading', { level: 3, name: 'Caffeine & bicarbonate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Caffeine & bicarbonate' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Caffeine' })).toBeInTheDocument();
  });

  it('exports the blocks and the summary for the guided flow', () => {
    function Summary() {
      return <p data-testid="summary">{useSupplementsSummary()}</p>;
    }
    renderSupplements(undefined, {
      children: (
        <>
          <SupplementsCaffeine headingLevel={2} />
          <SupplementsBicarb />
          <SupplementsFields />
          <Summary />
        </>
      ),
    });
    expect(screen.getByRole('heading', { level: 2, name: 'Caffeine' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3, name: 'Caffeine' })).toHaveLength(1);
    expect(screen.getByTestId('summary')).toHaveTextContent('Caffeine off · Bicarbonate off');
  });
});

describe('SupplementsSection: caffeine', () => {
  it('is off by default and hides its controls', () => {
    renderSupplements();
    const caffeine = caffeineBlock();
    expect(within(caffeine).getByRole('switch', { name: 'Include caffeine' })).toHaveAttribute('aria-checked', 'false');
    expect(within(caffeine).queryByRole('spinbutton', { name: 'Caffeine dose' })).not.toBeInTheDocument();
    expect(within(caffeine).queryByRole('switch', { name: 'Add to gels as tablets' })).not.toBeInTheDocument();
    // The explanation is still available.
    fireEvent.click(within(caffeine).getByRole('button', { name: /why\?/i }));
    expect(
      within(caffeine).getByText('Caffeine is optional. Doses of 3–6 mg/kg improve endurance performance for most athletes.'),
    ).toBeVisible();
  });

  it('plans doses when enabled and follows the mg/kg field', async () => {
    const user = userEvent.setup();
    renderSupplements();
    fireEvent.click(within(caffeineBlock()).getByRole('switch', { name: 'Include caffeine' }));
    expect(latest.inputs.caffeine.enabled).toBe(true);

    const dose = within(caffeineBlock()).getByRole('spinbutton', { name: 'Caffeine dose' });
    expect(dose).toHaveAttribute('aria-valuemin', '1');
    expect(dose).toHaveAttribute('aria-valuemax', '6');
    expect(dose).toHaveValue('3');
    expect(dose).toHaveAttribute('aria-valuetext', '3 mg/kg');
    // The rule and the body mass only: the planned mg come from the plan (doses, total).
    expect(description(dose)).toBe('Per kg of body mass (70 kg).');

    // [talanian2016] 70 kg, 3 mg/kg, 180 min: 140 mg 60 min before, 70 mg at 120 min
    expect(doses()).toHaveLength(2);
    expectDose(doses()[0], { time: 'T−1h', spoken: '1 hour before the start', when: 'Before the start', mg: '140 mg' });
    expectDose(doses()[1], { time: 'T\\+2h', spoken: '2 hours after the start', when: 'During the event', mg: '70 mg' });
    expect(within(caffeineBlock()).getByTestId('caffeine-total')).toHaveTextContent('Total 210 mg (3 mg/kg)');

    // [efsa2015] [guest2021] always-on notes
    expect(within(caffeineBlock()).getByText(/Skip caffeine if you are pregnant/)).toBeInTheDocument();
    expect(within(caffeineBlock()).getByText(/Try your caffeine plan in training first/)).toBeInTheDocument();

    enter(dose, '4.5');
    expect(latest.inputs.caffeine.mgPerKg).toBe(4.5);
    expect(dose).toHaveAttribute('aria-valuetext', '4.5 mg/kg');
    expect(within(caffeineBlock()).getByTestId('caffeine-total')).toHaveTextContent(`Total ${latest.plan.caffeine.totalMg} mg`);

    // Steps of 0.5 mg/kg, clamped to 1–6.
    dose.focus();
    await user.keyboard('{ArrowUp}');
    expect(latest.inputs.caffeine.mgPerKg).toBe(5);
    enter(dose, '9');
    expect(latest.inputs.caffeine.mgPerKg).toBe(6);
  });

  it('shows the dose the plan uses, to two decimals, and commits at that precision', () => {
    renderSupplements({ caffeine: { enabled: true } });
    const dose = within(caffeineBlock()).getByRole('spinbutton', { name: 'Caffeine dose' });
    enter(dose, '3.25');
    expect(latest.inputs.caffeine.mgPerKg).toBe(3.25);
    expect(dose).toHaveValue('3.25');
    expect(dose).toHaveAttribute('aria-valuetext', '3.25 mg/kg');
    // 3.25 mg/kg × 70 kg = 227.5 mg target; the planned doses are rounded to 5 mg.
    expect(within(caffeineBlock()).getByTestId('caffeine-total')).toHaveTextContent(`Total ${latest.plan.caffeine.totalMg} mg`);
    enter(dose, '3.255');
    expect(latest.inputs.caffeine.mgPerKg).toBe(3.26);
    expect(dose).toHaveValue('3.26');
  });

  it('adds caffeine to gels as tablets with a tablet size choice', () => {
    renderSupplements({ caffeine: { enabled: true } });
    expect(within(caffeineBlock()).queryByRole('radiogroup', { name: 'Tablet size' })).not.toBeInTheDocument();

    const asTablets = within(caffeineBlock()).getByRole('switch', { name: 'Add to gels as tablets' });
    expect(description(asTablets)).toBe('Crush caffeine tablets into the gels taken during the event.');
    fireEvent.click(asTablets);
    expect(latest.inputs.caffeine.asIngredient).toBe(true);
    const size = within(caffeineBlock()).getByRole('radiogroup', { name: 'Tablet size' });
    expect(within(size).getByRole('radio', { name: '100 mg' })).toHaveAttribute('aria-checked', 'true');

    // 70 kg, 3 mg/kg, 180 min, 100 mg tablets: 150 mg (1.5) before, 50 mg (0.5) with the gel at 120 min
    const before = { time: 'T−1h', spoken: '1 hour before the start', when: 'Before the start' };
    expectDose(doses()[0], { ...before, mg: '150 mg', tablets: '(1.5 × 100 mg tablet)' });
    expectDose(doses()[1], {
      time: 'T\\+2h',
      spoken: '2 hours after the start',
      when: 'With gel 7',
      mg: '50 mg',
      tablets: '(0.5 × 100 mg tablet)',
    });

    // Never pure caffeine powder: added to the list that held the notes before (not live; the board announces the count).
    const live = within(caffeineBlock()).getByTestId('block-warnings');
    expect(live).not.toHaveAttribute('aria-live');
    expect(live).toContainElement(warningsIn(caffeineBlock()));
    const danger = [...warningsIn(caffeineBlock()).querySelectorAll(':scope > li')].find((li) => li.dataset.level === 'danger');
    expect(danger).toHaveTextContent('Add caffeine as 100 mg tablets. Never use pure caffeine powder.');

    fireEvent.click(within(size).getByRole('radio', { name: '200 mg' }));
    expect(latest.inputs.caffeine.tabletMg).toBe(200);
    expect(within(caffeineBlock()).getByText(/Add caffeine as 200 mg tablets/)).toBeInTheDocument();
    // Whole half tablets of 200 mg: 100 mg before the start.
    expectDose(doses()[0], { ...before, mg: '100 mg', tablets: '(0.5 × 200 mg tablet)' });
  });

  it('shows the body mass of the dose hint in pounds in imperial units', () => {
    renderSupplements({ caffeine: { enabled: true } }, { prefs: { unitSystem: 'imperial' } });
    const dose = within(caffeineBlock()).getByRole('spinbutton', { name: 'Caffeine dose' });
    expect(description(dose)).toBe('Per kg of body mass (154.3 lb).');
  });

  it('names a mass typed in pounds as the mass field shows it, in both unit systems', () => {
    // 160 lb is stored as 72.5747… kg: metric reads "72.6 kg" (not "72.575 kg"), imperial "160 lb".
    const massKg = lbToKg(160);
    renderSupplements({ athlete: { massKg }, caffeine: { enabled: true }, bicarb: { enabled: true } }, { prefs: { unitSystem: 'metric' } });
    expect(description(within(caffeineBlock()).getByRole('spinbutton', { name: 'Caffeine dose' }))).toBe('Per kg of body mass (72.6 kg).');
    cleanup();
    localStorage.clear();
    renderSupplements({ athlete: { massKg }, caffeine: { enabled: true } }, { prefs: { unitSystem: 'imperial' } });
    expect(description(within(caffeineBlock()).getByRole('spinbutton', { name: 'Caffeine dose' }))).toBe('Per kg of body mass (160 lb).');
  });
});

describe('SupplementsSection: sodium bicarbonate', () => {
  it('hides bicarbonate behind a button for events over 90 min, which moves focus to the switch', async () => {
    const user = userEvent.setup();
    renderSupplements();
    expect(screen.queryByRole('group', { name: 'Sodium bicarbonate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Include sodium bicarbonate' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show sodium bicarbonate (for efforts under ~60 min)' }));
    const toggle = within(bicarbBlock()).getByRole('switch', { name: 'Include sodium bicarbonate' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveFocus();
    expect(description(toggle)).toBe('A pre-race buffer for hard efforts of up to about 60 min.');
    expect(screen.queryByRole('button', { name: /show sodium bicarbonate/i })).not.toBeInTheDocument();
  });

  it('shows the bicarbonate block without a button for events up to 90 min', () => {
    renderSupplements({ event: { durationMin: 90 } });
    expect(screen.queryByRole('button', { name: /show sodium bicarbonate/i })).not.toBeInTheDocument();
    const toggle = within(bicarbBlock()).getByRole('switch', { name: 'Include sodium bicarbonate' });
    expect(toggle).toBeInTheDocument();
    // Nothing moves focus on its own.
    expect(toggle).not.toHaveFocus();
  });

  it('shows the dose, sodium load, timing and warnings when enabled', () => {
    renderSupplements({ event: { durationMin: 60 } });
    expect(within(bicarbBlock()).queryByRole('spinbutton', { name: 'Bicarbonate dose' })).not.toBeInTheDocument();

    fireEvent.click(within(bicarbBlock()).getByRole('switch', { name: 'Include sodium bicarbonate' }));
    expect(latest.inputs.bicarb.enabled).toBe(true);

    const dose = within(bicarbBlock()).getByRole('spinbutton', { name: 'Bicarbonate dose' });
    expect(dose).toHaveAttribute('aria-valuemin', '0.2');
    expect(dose).toHaveAttribute('aria-valuemax', '0.3');
    expect(dose).toHaveValue('0.3');
    expect(dose).toHaveAttribute('aria-valuetext', '0.3 g/kg');

    // [grgic2021] 0.3 g/kg × 70 kg = 21 g; sodium 21 g × 0.2737 = 5.7 g
    const bicarb = bicarbBlock();
    expect(fact(bicarb, 'Dose')).toHaveTextContent('21 g');
    expect(fact(bicarb, 'Sodium load')).toHaveTextContent('5.7 g');
    // On screen as the schedule writes times, in words for screen readers.
    const timing = fact(bicarb, 'Take it');
    const [shown, spoken] = timing.children;
    expect(shown).toHaveAttribute('aria-hidden', 'true');
    expect(shown).toHaveTextContent(/^T−1h 30m \(window T−3h to T−1h\)$/);
    expect(spoken).toHaveClass('sr-only');
    expect(spoken).toHaveTextContent(
      /^1 hour 30 minutes before the start, in a window from 3 hours before the start to 1 hour before the start$/,
    );
    expect(within(bicarb).getByText(/Stomach upset is common with bicarbonate/)).toBeInTheDocument();
    expect(
      within(bicarb).getByText('This dose contains about 5.7 g of sodium. That is a large salt load on top of your normal diet.'),
    ).toBeInTheDocument();

    enter(dose, '0.2');
    expect(latest.inputs.bicarb.gPerKg).toBe(0.2);
    expect(fact(bicarbBlock(), 'Dose')).toHaveTextContent('14 g');
  });

  it('keeps an enabled bicarbonate plan visible on a long event and warns about it', () => {
    renderSupplements({ bicarb: { enabled: true } });
    // [grgic2021] [deoliveira2022] no evidence for multi-hour events
    expect(
      within(bicarbBlock()).getByText(
        'There is no evidence that bicarbonate helps in events longer than about 90 min. Side effects may outweigh any gain.',
      ),
    ).toBeInTheDocument();

    // Turning it off keeps the block open instead of collapsing it under the switch.
    fireEvent.click(within(bicarbBlock()).getByRole('switch', { name: 'Include sodium bicarbonate' }));
    expect(latest.inputs.bicarb.enabled).toBe(false);
    expect(within(bicarbBlock()).getByRole('switch', { name: 'Include sodium bicarbonate' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('explains bicarbonate with citations', () => {
    renderSupplements({ event: { durationMin: 30 } });
    fireEvent.click(within(bicarbBlock()).getByRole('button', { name: /why\?/i }));
    expect(within(bicarbBlock()).getByRole('link', { name: /^Grgic et al\. 2021/ })).toBeInTheDocument();
  });

  it('starts with an empty warnings list and fills it when bicarbonate turns on', () => {
    renderSupplements({ event: { durationMin: 60 } });
    const live = within(bicarbBlock()).getByTestId('block-warnings');
    expect(live).not.toHaveAttribute('aria-live');
    expect(live).toBeEmptyDOMElement();
    fireEvent.click(within(bicarbBlock()).getByRole('switch', { name: 'Include sodium bicarbonate' }));
    expect(within(bicarbBlock()).getByTestId('block-warnings')).toBe(live);
    expect(live).toContainElement(warningsIn(bicarbBlock()));
  });

  it('formats the amounts in German', () => {
    renderSupplements({ event: { durationMin: 60 }, bicarb: { enabled: true } }, { prefs: { locale: 'de' } });
    const bicarb = screen.getByTestId('supplements-bicarb');
    expect(within(bicarb).getByTestId('bicarb-sodium')).toHaveTextContent('5,7 g');
    expect(within(bicarb).getByRole('spinbutton')).toHaveValue('0,3');
  });
});

describe('SupplementsSection: accessibility', () => {
  /**
   * Every form control has a unique id, a label and an accessible name; every
   * `aria-describedby` target exists; every button has a name; ids are unique.
   */
  function expectLabelledControls(container, count) {
    const controls = [...container.querySelectorAll('input, select, textarea')];
    expect(controls).toHaveLength(count);
    for (const el of controls) {
      expect(el.id, el.outerHTML).not.toBe('');
      expect(el.labels.length, `#${el.id} has a label`).toBeGreaterThan(0);
      expect(el).toHaveAccessibleName();
      expect(description(el), `#${el.id} description targets exist`).not.toMatch(/missing/);
    }
    for (const button of container.querySelectorAll('button')) {
      expect(button, button.outerHTML).toHaveAccessibleName();
      expect(description(button)).not.toMatch(/missing/);
    }
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  }

  it('labels every control (off)', () => {
    const { container } = renderSupplements();
    expectLabelledControls(container, 0);
  });

  it('labels every control (everything on)', () => {
    const { container } = renderSupplements({
      caffeine: { enabled: true, asIngredient: true },
      bicarb: { enabled: true },
    });
    // caffeine mg/kg, bicarbonate g/kg
    expectLabelledControls(container, 2);
    expect(screen.getAllByRole('switch')).toHaveLength(3);
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('throws outside the providers', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<SupplementsSection />)).toThrow(/must be used inside <PlanProvider>/);
  });
});
