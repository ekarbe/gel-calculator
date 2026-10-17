import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, within, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TargetsSection, { TargetsCarbs, TargetsFields, TargetsFluid, useTargetsSummary } from './TargetsSection';
import { PlanProvider, usePlanInputs, usePlan } from '../../state/PlanProvider';
import { UiProvider, PREFS_KEY } from '../../state/UiProvider';
import { encodeShareState } from '../../state/shareCodec';
import { MESSAGES, PLACEHOLDER_TYPES, placeholdersOf, t } from '../../i18n';
import uiSetupTargets from '../../i18n/en/ui-setup-targets';

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
function renderTargets(initialInputs, { prefs, children = <TargetsSection /> } = {}) {
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

/** Changes a plan input from outside the section (as the Event or Sweat section would). */
const setInput = (path, value) => act(() => latest.set(path, value));

const block = (name) => screen.getByRole('group', { name });
const carbsBlock = () => block('Carbohydrates');
const ratioBlock = () => block('Glucose:fructose ratio');
const sodiumBlock = () => block('Sodium');
const fluidBlock = () => block('Fluid');
const radio = (scope, name) => within(scope).getByRole('radio', { name });
const modeGroup = (scope, name) => within(scope).getByRole('radiogroup', { name });
/** The value of a fact (`<dt>` term → `<dd>`) inside `scope`. */
const fact = (scope, term) => within(scope).getByText(term, { selector: 'dt' }).nextElementSibling;
const warningsIn = (scope) => within(scope).queryByRole('list', { name: 'Warnings' });
/** Direct warning items of a warnings list (each also nests a list of citation links). */
const items = (list) => [...list.querySelectorAll(':scope > li')];

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
  window.history.replaceState(null, '', '/');
  latest.inputs = null;
  latest.plan = null;
  latest.set = null;
});

describe('TargetsSection: layout', () => {
  it('is a region named "Targets" with a level-2 heading and level-3 blocks', () => {
    renderTargets();
    const region = screen.getByRole('region', { name: 'Targets' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Targets' })).toBeInTheDocument();
    expect(within(region).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Carbohydrates',
      'Glucose:fructose ratio',
      'Sodium',
      'Fluid',
      'Advanced: potassium, magnesium, calcium',
    ]);
  });

  it('collapses to a one-line summary and opens again, keeping the blocks mounted', async () => {
    const user = userEvent.setup();
    renderTargets();
    const toggle = screen.getByRole('button', { name: 'Targets' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByTestId('targets-summary')).not.toBeInTheDocument();
    const body = document.getElementById(toggle.getAttribute('aria-controls'));
    expect(body).toBeVisible();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(body).not.toBeVisible();
    expect(within(body).getByTestId('carbs-target')).toBeInTheDocument();
    expect(screen.getByTestId('targets-summary')).toHaveTextContent('Carbs 75 g/h · 1:0.5 · Sodium 300 mg/h · Fluid 100 ml/h');

    await user.click(toggle);
    expect(body).toBeVisible();
    expect(screen.queryByTestId('targets-summary')).not.toBeInTheDocument();
  });

  it('styles every block heading, Advanced included, as a display title and names each block by it', () => {
    renderTargets();
    const region = screen.getByRole('region', { name: 'Targets' });
    const headings = within(region).getAllByRole('heading', { level: 3 });
    expect(headings).toHaveLength(5);
    for (const heading of headings) {
      expect(heading.className, heading.textContent).toContain('display-title');
      expect(screen.getByRole('group', { name: heading.textContent })).toBeInTheDocument();
    }
  });

  it('can render without the collapse button at another heading level', () => {
    renderTargets(undefined, { children: <TargetsSection headingLevel={3} collapsible={false} /> });
    expect(screen.getByRole('heading', { level: 3, name: 'Targets' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Targets' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Carbohydrates' })).toBeInTheDocument();
  });

  it('exports the blocks and the summary for the guided flow', () => {
    function Summary() {
      return <p data-testid="summary">{useTargetsSummary()}</p>;
    }
    renderTargets(undefined, {
      children: (
        <>
          <TargetsCarbs headingLevel={2} />
          <Summary />
        </>
      ),
    });
    expect(screen.getByRole('heading', { level: 2, name: 'Carbohydrates' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Sodium' })).not.toBeInTheDocument();
    expect(screen.getByTestId('summary')).toHaveTextContent('Carbs 75 g/h · 1:0.5 · Sodium 300 mg/h · Fluid 100 ml/h');
  });
});

describe('TargetsSection: carbohydrate target', () => {
  it('shows the recommended value, range and band', () => {
    renderTargets();
    const carbs = carbsBlock();
    // [jeukendrup2014] >2.5 h moderate: midpoint of 60–90 g/h
    expect(within(carbs).getByTestId('carbs-target')).toHaveTextContent('75 g/h');
    expect(within(carbs).getByTestId('carbs-total')).toHaveTextContent('225 g in total');
    expect(fact(carbs, 'Recommended')).toHaveTextContent('75 g/h');
    expect(fact(carbs, 'Evidence range')).toHaveTextContent('60–90 g/h');
    expect(within(carbs).getByTestId('carbs-band')).toHaveTextContent('Over 2.5 h');
  });

  it('reveals the explanation and citations behind "Why?"', () => {
    renderTargets();
    const carbs = carbsBlock();
    const why = within(carbs).getByRole('button', { name: /why\?/i });
    expect(why).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(carbs).getByText(
        'Over 2.5 h, the evidence range is 60–90 g/h of carbs from mixed glucose and fructose. Your target is 75 g/h.',
      ),
    ).toBeVisible();
    expect(within(carbs).getByRole('link', { name: /^Jeukendrup 2014/ })).toHaveAttribute(
      'href',
      'https://doi.org/10.1007/s40279-014-0148-z',
    );
  });

  it('switches to a manual target seeded from the recommendation, with evidence warnings', () => {
    renderTargets();
    const carbs = carbsBlock();
    const auto = radio(modeGroup(carbs, 'Carb target mode'), 'Auto');
    const adjust = radio(modeGroup(carbs, 'Carb target mode'), 'Adjust');
    expect(auto).toHaveAttribute('aria-checked', 'true');
    expect(within(carbs).queryByRole('spinbutton', { name: /your target/i })).not.toBeInTheDocument();

    fireEvent.click(adjust);
    expect(adjust).toHaveAttribute('aria-checked', 'true');
    expect(latest.inputs.carbs.mode).toBe('manual');
    const input = within(carbs).getByRole('spinbutton', { name: 'Your target' });
    expect(input).toHaveValue('75');
    expect(input).toHaveAttribute('aria-valuetext', '75 g/h');
    expect(latest.plan.carbs.gPerHour).toBe(75);

    // [podlogar2022] [hearris2022] above 120 g/h is beyond what was studied
    enter(input, 130);
    expect(latest.plan.carbs.gPerHour).toBe(130);
    expect(within(carbs).getByTestId('carbs-total')).toHaveTextContent('390 g in total');
    const danger = items(warningsIn(carbs)).find((li) => li.dataset.level === 'danger');
    expect(danger).toHaveTextContent('130 g/h is above 120 g/h, the highest intake studied. Gut problems become more likely.');
    // The recommendation stays visible as a reference.
    expect(fact(carbs, 'Recommended')).toHaveTextContent('75 g/h');

    fireEvent.click(auto);
    expect(latest.inputs.carbs.mode).toBe('auto');
    expect(latest.plan.carbs.gPerHour).toBe(75);
    expect(within(carbs).queryByRole('spinbutton', { name: /your target/i })).not.toBeInTheDocument();
    expect(warningsIn(carbs)).not.toBeInTheDocument();
  });

  it('steps the manual target with the keyboard and clamps it to the input limits', async () => {
    const user = userEvent.setup();
    renderTargets({ carbs: { mode: 'manual', manualGPerHour: 60 } });
    const input = within(carbsBlock()).getByRole('spinbutton', { name: 'Your target' });
    input.focus();
    await user.keyboard('{ArrowUp}');
    expect(latest.inputs.carbs.manualGPerHour).toBe(65);
    enter(input, 500);
    expect(latest.inputs.carbs.manualGPerHour).toBe(200);
  });

  it('keeps a typed target off the 5 g/h step grid; the arrows then step to the grid', async () => {
    const user = userEvent.setup();
    renderTargets({ carbs: { mode: 'manual', manualGPerHour: 60 } });
    const input = within(carbsBlock()).getByRole('spinbutton', { name: 'Your target' });
    enter(input, 62);
    expect(latest.inputs.carbs.manualGPerHour).toBe(62);
    expect(input).toHaveValue('62');
    input.focus();
    await user.keyboard('{ArrowUp}');
    expect(latest.inputs.carbs.manualGPerHour).toBe(65);
  });

  it('shows the target the plan uses, to two decimals, and commits at that precision', () => {
    renderTargets({ carbs: { mode: 'manual', manualGPerHour: 62.25 } });
    const input = within(carbsBlock()).getByRole('spinbutton', { name: 'Your target' });
    expect(latest.plan.carbs.gPerHour).toBe(62.25);
    expect(input).toHaveValue('62.25');
    expect(input).toHaveAttribute('aria-valuetext', '62.25 g/h');
    enter(input, '70.125');
    expect(latest.inputs.carbs.manualGPerHour).toBe(70.13);
    expect(input).toHaveValue('70.13');
  });

  it('shows the gut-trained opt-in only for events over 150 min', () => {
    renderTargets({ event: { durationMin: 150 } });
    expect(screen.queryByRole('switch', { name: /gut-trained/i })).not.toBeInTheDocument();
    setInput('event.durationMin', 151);
    const toggle = screen.getByRole('switch', { name: /gut-trained/i });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(description(toggle)).toBe('Only if you have trained your gut with high intakes for 2–4 weeks.');
  });

  it('raises the target with the gut-trained opt-in and warns about gut training', () => {
    renderTargets();
    const carbs = carbsBlock();
    fireEvent.click(within(carbs).getByRole('switch', { name: /gut-trained/i }));
    expect(latest.inputs.event.highCarb).toBe(true);
    // [podlogar2022] [hearris2022] gut-trained, >2.5 h, moderate: midpoint of 90–120 → 105 g/h
    expect(within(carbs).getByTestId('carbs-target')).toHaveTextContent('105 g/h');
    expect(within(carbs).getByTestId('carbs-band')).toHaveTextContent('Over 2.5 h, gut-trained');
    // [jeukendrup2017] [cox2010]
    expect(
      within(carbs).getByText('Intakes above 90 g/h need 2–4 weeks of gut training. Extra benefit above 90 g/h is unproven.'),
    ).toBeInTheDocument();
  });

  it('keeps the gut-trained switch while it is on, so a shorter event can turn it off', () => {
    renderTargets();
    fireEvent.click(within(carbsBlock()).getByRole('switch', { name: /gut-trained/i }));
    setInput('event.durationMin', 120);
    expect(latest.inputs.event).toMatchObject({ durationMin: 120, highCarb: true });
    const carbs = carbsBlock();
    // The note explains why it has no effect, and the switch next to it clears it.
    expect(
      within(carbs).getByText('Gut-trained mode only applies to events over 150 min. The standard range is used instead.'),
    ).toBeInTheDocument();
    const toggle = within(carbs).getByRole('switch', { name: /gut-trained/i });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(latest.inputs.event.highCarb).toBe(false);
    expect(within(carbs).queryByText(/Gut-trained mode only applies/)).not.toBeInTheDocument();
    // The switch just pressed stays (off) until the duration changes.
    expect(within(carbs).getByRole('switch', { name: /gut-trained/i })).toHaveAttribute('aria-checked', 'false');
    setInput('event.durationMin', 100);
    expect(within(carbsBlock()).queryByRole('switch', { name: /gut-trained/i })).not.toBeInTheDocument();
  });

  it('keeps keyboard focus on the gut-trained switch when it is turned off on a short event', async () => {
    const user = userEvent.setup();
    renderTargets({ event: { durationMin: 120, highCarb: true } });
    const toggle = within(carbsBlock()).getByRole('switch', { name: /gut-trained/i });
    toggle.focus();
    await user.keyboard(' ');
    expect(latest.inputs.event.highCarb).toBe(false);
    const after = within(carbsBlock()).getByRole('switch', { name: /gut-trained/i });
    expect(after).toBe(toggle);
    expect(after).toHaveFocus();
    expect(after).toHaveAttribute('aria-checked', 'false');
    // It can be turned on again from the keyboard.
    await user.keyboard(' ');
    expect(latest.inputs.event.highCarb).toBe(true);
  });

  it('shows the gut-trained switch for a short event restored with highCarb on', () => {
    renderTargets({ event: { durationMin: 120, highCarb: true } });
    expect(screen.getByRole('switch', { name: /gut-trained/i })).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the mouth rinse note only in the rinse band', () => {
    renderTargets({ event: { durationMin: 60 } });
    const carbs = carbsBlock();
    // [carter2004] [brietzke2019] 45–75 min: mouth rinse
    expect(within(carbs).getByTestId('carbs-band')).toHaveTextContent('45–75 min');
    const note = within(carbs).getByTestId('mouth-rinse-note');
    expect(within(note).getByText('Mouth rinse option')).toBeInTheDocument();
    expect(within(note).getByText(/Swish 25 ml of a 6–8% maltodextrin drink/)).toHaveTextContent(
      'Swish 25 ml of a 6–8% maltodextrin drink in your mouth for 5–10 s, then spit it out. Repeat every 5–10 min.',
    );
    expect(within(note).getByRole('link', { name: /^Carter et al\. 2004/ })).toBeInTheDocument();
    cleanup();

    renderTargets();
    expect(screen.queryByTestId('mouth-rinse-note')).not.toBeInTheDocument();
    expect(screen.queryByText('Mouth rinse option')).not.toBeInTheDocument();
  });

  it('shows a 0 g/h range for events under 45 min', () => {
    renderTargets({ event: { durationMin: 30 } });
    const carbs = carbsBlock();
    expect(within(carbs).getByTestId('carbs-target')).toHaveTextContent('0 g/h');
    expect(fact(carbs, 'Evidence range')).toHaveTextContent(/^0 g\/h$/);
    expect(within(carbs).getByTestId('carbs-band')).toHaveTextContent('Under 45 min');
  });

  it('leaves the ingredient warnings to the ingredient list and recipe, but keeps target warnings', () => {
    // No ingredient at all. Manual 130 g/h adds the evidence warnings for the target itself.
    renderTargets({ carbs: { mode: 'manual', manualGPerHour: 130, ingredients: [] } });
    const ids = latest.plan.carbs.warnings.map((w) => w.id);
    expect(ids).toContain('carbs.noIngredients');
    expect(ids).toContain('carbs.aboveStudied');

    const shown = items(warningsIn(carbsBlock()));
    expect(shown).toHaveLength(ids.length - 1);
    expect(shown.map((li) => li.dataset.level)).toEqual(['danger', 'warning']);
    expect(warningsIn(carbsBlock())).toHaveTextContent(/120 g\/h/);
    expect(warningsIn(carbsBlock())).not.toHaveTextContent(/carb ingredient/i);
  });

  it('leaves the unreachable-ratio warning to the ingredient list', () => {
    // Maltodextrin alone (no fructose) cannot make the 1:0.8 ratio asked for.
    renderTargets({
      carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 0.8 }, ingredients: [{ ref: 3, weight: 100 }] },
    });
    expect(latest.plan.carbs.warnings.map((w) => w.id)).toContain('carbs.ratioNotReachable');
    expect(within(carbsBlock()).queryByText(/cannot make/i)).not.toBeInTheDocument();
    expect(within(ratioBlock()).queryByText(/cannot make/i)).not.toBeInTheDocument();
  });
});

describe('TargetsSection: ratio in Auto mode', () => {
  it('shows the recommended ratio, its allowed range and the fructose share for the default plan', () => {
    renderTargets();
    const ratio = ratioBlock();
    const mode = modeGroup(ratio, 'Ratio mode');
    expect(radio(mode, 'Auto')).toHaveAttribute('aria-checked', 'true');
    expect(radio(mode, 'Adjust')).toHaveAttribute('aria-checked', 'false');

    // Default plan: 180 min moderate → 75 g/h → 2:1 (1:0.5), allowed 1:0.5–1:1.
    expect(within(ratio).getByText('Recommended ratio')).toBeInTheDocument();
    expect(within(ratio).getByTestId('carb-ratio-value')).toHaveTextContent('1:0.5');
    expect(within(ratio).getByText(/at your 75 g\/h target/)).toBeInTheDocument();
    expect(fact(ratio, 'Allowed range')).toHaveTextContent('1:0.5–1:1');
    expect(fact(ratio, 'Fructose share')).toHaveTextContent('33% (allowed 33–50%)');
    expect(within(ratio).queryByText('Recommended', { selector: 'dt' })).not.toBeInTheDocument();

    // A decorative split bar: glucose 2/3, fructose 1/3.
    const split = within(ratio).getByTestId('ratio-split');
    expect(split).toHaveAttribute('aria-hidden', 'true');
    expect(split.children[0].style.width).toMatch(/^66\.66/);
    expect(split.children[1].style.width).toMatch(/^33\.33/);

    // No part fields and no warnings in Auto mode.
    expect(screen.queryByRole('spinbutton', { name: 'Glucose parts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Fructose parts' })).not.toBeInTheDocument();
    expect(warningsIn(ratio)).not.toBeInTheDocument();
  });

  it('follows the carb target: 1:0.8 at 120 g/h', () => {
    renderTargets({ carbs: { mode: 'manual', manualGPerHour: 120 } });
    const ratio = ratioBlock();
    expect(within(ratio).getByTestId('carb-ratio-value')).toHaveTextContent('1:0.8');
    expect(fact(ratio, 'Allowed range')).toHaveTextContent('1:0.8–1:1');
    expect(fact(ratio, 'Fructose share')).toHaveTextContent('44% (allowed 44–50%)');
    expect(latest.plan.carbs.ratio.value).toEqual({ glucose: 1, fructose: 0.8 });
  });

  it('keeps the allowed share range on one line, full width', () => {
    renderTargets({ carbs: { mode: 'manual', manualGPerHour: 120, ratioMode: 'manual' } });
    const share = fact(ratioBlock(), 'Fructose share');
    expect(share.parentElement).toHaveClass('col-span-2');
    expect(within(share).getByText('(allowed 44–50%)')).toHaveClass('whitespace-nowrap');
  });

  it('allows glucose alone at low intakes (1:0–1:1 at 15 g/h)', () => {
    renderTargets({ event: { durationMin: 60 } });
    const ratio = ratioBlock();
    expect(within(ratio).getByText(/at your 15 g\/h target/)).toBeInTheDocument();
    expect(fact(ratio, 'Allowed range')).toHaveTextContent('1:0–1:1');
  });

  it('reveals the explanation and citation links behind "Why?"', () => {
    renderTargets();
    const ratio = ratioBlock();
    const why = within(ratio).getByRole('button', { name: /Why\?/ });
    expect(why).toHaveAttribute('aria-expanded', 'false');
    const summary = t(latest.plan.carbs.ratio.recommended.why.summary);
    expect(summary).toMatch(/Use 1:0.5 glucose to fructose/);
    expect(within(ratio).getByText(summary)).not.toBeVisible();

    fireEvent.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'true');
    expect(within(ratio).getByText(summary)).toBeVisible();
    const sources = within(ratio).getByRole('list', { name: 'Sources' });
    expect(within(sources).getByRole('link', { name: /^Jeukendrup 2014/ })).toHaveAttribute(
      'href',
      'https://doi.org/10.1007/s40279-014-0148-z',
    );
    expect(within(sources).getByRole('link', { name: /^Rowlands et al\. 2015/ })).toBeInTheDocument();
  });
});

describe('TargetsSection: ratio in Adjust mode', () => {
  const glucose = () => within(ratioBlock()).getByRole('spinbutton', { name: 'Glucose parts' });
  const fructose = () => within(ratioBlock()).getByRole('spinbutton', { name: 'Fructose parts' });
  const stepper = (name) => within(ratioBlock()).getByRole('button', { name });

  it('starts from the ratio in use and shows the part fields', () => {
    renderTargets();
    fireEvent.click(radio(modeGroup(ratioBlock(), 'Ratio mode'), 'Adjust'));

    expect(radio(modeGroup(ratioBlock(), 'Ratio mode'), 'Adjust')).toHaveAttribute('aria-checked', 'true');
    expect(latest.inputs.carbs.ratioMode).toBe('manual');
    // The recommended 1:0.5, not the stored default 1:0.8, so nothing jumps.
    expect(latest.inputs.carbs.manualRatio).toEqual({ glucose: 1, fructose: 0.5 });
    const ratio = ratioBlock();
    expect(within(ratio).getByText('Your ratio')).toBeInTheDocument();
    expect(within(ratio).getByTestId('carb-ratio-value')).toHaveTextContent('1:0.5');
    expect(fact(ratio, 'Recommended')).toHaveTextContent('1:0.5');

    expect(glucose()).toHaveValue('1');
    expect(fructose()).toHaveValue('0.5');
    expect(warningsIn(ratio)).not.toBeInTheDocument();
    // Each part field explains which side of the ratio it is.
    expect(description(glucose())).toBe('The glucose side of the ratio, such as 1 in 1:0.5.');
    expect(description(fructose())).toBe('The fructose side of the ratio, such as 0.5 in 1:0.5.');
  });

  it('commits typed parts at two decimals, as the fields show them', () => {
    renderTargets({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 0.8 } } });
    enter(fructose(), '0.333');
    expect(latest.inputs.carbs.manualRatio.fructose).toBe(0.33);
    expect(fructose()).toHaveValue('0.33');
  });

  it('changes the manual ratio with the −/+ buttons, the arrow keys and typing', async () => {
    const user = userEvent.setup();
    renderTargets({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 0.8 } } });

    fireEvent.click(stepper('Increase Fructose parts'));
    expect(latest.inputs.carbs.manualRatio.fructose).toBe(0.85);
    fireEvent.click(stepper('Decrease Glucose parts'));
    expect(latest.inputs.carbs.manualRatio.glucose).toBe(0.95);
    // Shown normalized to glucose 1, like every other view (0.85 / 0.95 = 0.89).
    expect(within(ratioBlock()).getByTestId('carb-ratio-value')).toHaveTextContent('1:0.89');

    enter(fructose(), '0.6');
    expect(latest.inputs.carbs.manualRatio.fructose).toBe(0.6);
    expect(latest.plan.carbs.ratio.value).toEqual({ glucose: 0.95, fructose: 0.6 });

    fructose().focus();
    await user.keyboard('{ArrowDown}');
    expect(latest.inputs.carbs.manualRatio.fructose).toBe(0.55);
  });

  it('stops the buttons at 0 and at the input limit of 5 parts', () => {
    renderTargets({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 5, fructose: 0 } } });
    expect(stepper('Increase Glucose parts')).toBeDisabled();
    expect(stepper('Decrease Fructose parts')).toBeDisabled();
    expect(stepper('Decrease Glucose parts')).toBeEnabled();
    expect(stepper('Increase Fructose parts')).toBeEnabled();
  });

  it('shows a large part from a share link as it is and steps it down', () => {
    renderTargets({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 3, fructose: 1 } } });
    expect(glucose()).toHaveValue('3');
    expect(glucose()).toHaveAttribute('aria-valuemax', '5');
    fireEvent.click(stepper('Decrease Glucose parts'));
    expect(latest.inputs.carbs.manualRatio.glucose).toBe(2.95);
  });

  it('warns when the ratio has too little fructose for the carb target', () => {
    renderTargets({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 0.5 } } });
    enter(fructose(), '0');

    const list = warningsIn(ratioBlock());
    expect(list).toBeInTheDocument();
    const item = within(list).getByText(/At 75 g\/h, use at least 1:0.5 glucose to fructose/).closest('li');
    expect(item).toHaveAttribute('data-level', 'warning');
    expect(latest.plan.carbs.ratio.warnings.map((w) => w.id)).toEqual(['carbs.tooLittleFructose']);
  });

  it('warns when there is more fructose than glucose', () => {
    renderTargets({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0.5, fructose: 1 } } });
    expect(within(warningsIn(ratioBlock())).getByText(/Use no more fructose than glucose/)).toBeInTheDocument();
  });

  it('flags a 0:0 ratio as danger, without a split bar', () => {
    renderTargets({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } });
    const ratio = ratioBlock();
    const shown = items(warningsIn(ratio));
    expect(shown).toHaveLength(1);
    expect(shown[0]).toHaveAttribute('data-level', 'danger');
    expect(shown[0]).toHaveTextContent(/Set at least one ratio part above zero/);
    expect(within(ratio).getByTestId('carb-ratio-value')).toHaveTextContent('0:0');
    expect(fact(ratio, 'Fructose share')).toHaveTextContent(/^0%/);
    expect(within(ratio).queryByTestId('ratio-split')).not.toBeInTheDocument();
  });

  it('returns to the recommendation in Auto mode', () => {
    renderTargets({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 0 } } });
    expect(warningsIn(ratioBlock())).toBeInTheDocument();

    fireEvent.click(radio(modeGroup(ratioBlock(), 'Ratio mode'), 'Auto'));
    expect(latest.inputs.carbs.ratioMode).toBe('auto');
    expect(within(ratioBlock()).getByTestId('carb-ratio-value')).toHaveTextContent('1:0.5');
    expect(screen.queryByRole('spinbutton', { name: 'Glucose parts' })).not.toBeInTheDocument();
    expect(warningsIn(ratioBlock())).not.toBeInTheDocument();
  });
});

describe('TargetsSection: sodium', () => {
  it('shows the default target from the real plan, with the concentration warning', () => {
    renderTargets();
    const sodium = sodiumBlock();
    // The 300 mg/h floor of 2–4 h events; little fluid makes it concentrated.
    expect(within(sodium).getByTestId('sodium-value')).toHaveTextContent('300 mg/h');
    expect(within(sodium).getByTestId('sodium-total')).toHaveTextContent('900 mg in total');
    expect(fact(sodium, 'Recommended')).toHaveTextContent('300 mg/h');
    expect(fact(sodium, 'Range')).toHaveTextContent('300–600 mg/h');
    expect(fact(sodium, 'Estimated sweat loss')).toHaveTextContent('about 138 mg/h');
    expect(within(sodium).queryByText('Optional')).not.toBeInTheDocument();
    // [efsa2011] 900 mg in 300 ml of fluid
    expect(within(warningsIn(sodium)).getByText(/about 3,000 mg of sodium per litre/)).toBeInTheDocument();
  });

  it('follows the sweat rate and saltiness: 570 mg/h at 1.25 L/h, 1,000 mg/h for salty sweat', () => {
    renderTargets({ sweat: { source: 'preset' } });
    // 180 min, 1.25 L/h, 40 mmol/L → 570 mg/h
    expect(within(sodiumBlock()).getByTestId('sodium-value')).toHaveTextContent('570 mg/h');
    // 0.25 L/h: half the loss is below the 300 mg/h floor.
    setInput('sweat.rateIndex', 0);
    expect(within(sodiumBlock()).getByTestId('sodium-value')).toHaveTextContent('300 mg/h');
    // 70 mmol/L is salty sweat: range 300–1000, half of 2012 mg/h → 1000 mg/h.
    setInput('sweat.rateIndex', 2);
    setInput('sweat.saltinessIndex', 4);
    expect(within(sodiumBlock()).getByTestId('sodium-value')).toHaveTextContent('1,000 mg/h');
    expect(fact(sodiumBlock(), 'Range')).toHaveTextContent('300–1,000 mg/h');
  });

  it('explains the target with citations', () => {
    renderTargets({ sweat: { source: 'preset' } });
    const sodium = sodiumBlock();
    const why = within(sodium).getByRole('button', { name: /why/i });
    expect(why).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(sodium).getByText(
        'For 2–4 h, take 300–600 mg/h of sodium. You lose about 1,150 mg/h in sweat. The plan starts from half of that and keeps it in the range. Your target is 570 mg/h.',
      ),
    ).toBeVisible();
    expect(within(sodium).getByRole('link', { name: /McCubbin/ })).toHaveAttribute('href', expect.stringContaining('https://doi.org/'));
  });

  it('switches to Adjust, starting from the recommendation, and warns on high values', () => {
    renderTargets({ sweat: { source: 'preset' } });
    const mode = modeGroup(sodiumBlock(), 'Sodium target mode');
    fireEvent.click(radio(mode, 'Adjust'));

    expect(latest.inputs.sodium).toEqual({ mode: 'manual', manualMgPerHour: 570 });
    expect(radio(mode, 'Adjust')).toHaveAttribute('aria-checked', 'true');
    const input = within(sodiumBlock()).getByRole('spinbutton', { name: 'Your sodium target' });
    expect(input).toHaveValue('570');

    fireEvent.change(input, { target: { value: '2000' } });
    expect(latest.inputs.sodium.manualMgPerHour).toBe(2000);
    expect(latest.plan.sodium.mgPerHour).toBe(2000);
    expect(within(sodiumBlock()).getByTestId('sodium-total')).toHaveTextContent('6,000 mg in total');
    // The recommendation stays visible next to the manual value.
    expect(fact(sodiumBlock(), 'Recommended')).toHaveTextContent('570 mg/h');
    const danger = within(warningsIn(sodiumBlock())).getByText(/You plan 2,000 mg\/h of sodium\. That is far above any guideline\./);
    expect(danger.closest('li')).toHaveAttribute('data-level', 'danger');

    // The list is not live: typing "2000" must not read four warnings with their sources (the board announces the count).
    expect(warningsIn(sodiumBlock()).closest('[aria-live]')).toBeNull();

    // Clearing the field while typing keeps the last value; blur shows it again.
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue('');
    expect(latest.inputs.sodium.manualMgPerHour).toBe(2000);
    fireEvent.blur(input);
    expect(input).toHaveValue('2000');

    fireEvent.click(radio(mode, 'Auto'));
    expect(latest.inputs.sodium).toEqual({ mode: 'auto', manualMgPerHour: 2000 });
    expect(within(sodiumBlock()).getByTestId('sodium-value')).toHaveTextContent('570 mg/h');
    expect(within(sodiumBlock()).queryByRole('spinbutton', { name: 'Your sodium target' })).not.toBeInTheDocument();
    expect(warningsIn(sodiumBlock())).not.toBeInTheDocument();
  });

  it('shows a warning that appears after an edit in the same list, without reading each keystroke', async () => {
    const user = userEvent.setup();
    renderTargets({ sodium: { mode: 'manual', manualMgPerHour: 1490 }, sweat: { source: 'preset' } });
    const live = within(sodiumBlock()).getByTestId('block-warnings');
    expect(live).not.toHaveAttribute('aria-live');
    const before = live.querySelectorAll('li[data-level="danger"]').length;
    const input = within(sodiumBlock()).getByRole('spinbutton', { name: 'Your sodium target' });
    input.focus();
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(latest.inputs.sodium.manualMgPerHour).toBe(1510);
    // Same region element, now with a new danger in it.
    expect(within(sodiumBlock()).getByTestId('block-warnings')).toBe(live);
    expect(live.querySelectorAll('li[data-level="danger"]').length).toBeGreaterThan(before);
  });

  it('shows a stored target with decimals as the plan uses it', () => {
    renderTargets({ sodium: { mode: 'manual', manualMgPerHour: 512.5 } });
    const input = within(sodiumBlock()).getByRole('spinbutton', { name: 'Your sodium target' });
    expect(latest.plan.sodium.mgPerHour).toBe(512.5);
    expect(input).toHaveValue('512.5');
    expect(input).toHaveAttribute('aria-valuetext', '512.5 mg/h');
  });

  it('marks sodium optional for events under 2 h', () => {
    renderTargets({ event: { durationMin: 60 } });
    const sodium = sodiumBlock();
    expect(within(sodium).getByText('Optional')).toBeInTheDocument();
    expect(fact(sodium, 'Range')).toHaveTextContent('0–300 mg/h');
    expect(within(sodium).getByTestId('sodium-value')).toHaveTextContent('70 mg/h');
    // The badge is not part of the block's name.
    expect(within(sodium).getByRole('heading', { name: 'Sodium' })).toBeInTheDocument();
  });
});

describe('TargetsSection: fluid', () => {
  it('shows the default target from the real plan, with the projected scale change', () => {
    renderTargets();
    const fluid = fluidBlock();
    // 80% of 0.15 L/h, rounded to 100 ml/h.
    expect(within(fluid).getByTestId('fluid-value')).toHaveTextContent('100 ml/h');
    expect(within(fluid).getByTestId('fluid-total')).toHaveTextContent('300 ml in total');
    expect(fact(fluid, 'Recommended')).toHaveTextContent('100 ml/h');
    expect(fact(fluid, 'Guideline range')).toHaveTextContent('400–800 ml/h');
    expect(fact(fluid, 'Sweat loss')).toHaveTextContent('about 150 ml/h');
    expect(within(fluid).queryByTestId('drink-to-thirst')).not.toBeInTheDocument();
    // 0.15 L water deficit plus 0.2 g/kcal of 678 kcal/h over 3 h.
    expect(within(fluid).getByTestId('fluid-body-mass')).toHaveTextContent('−0.6 kg');
    const level = within(fluid).getByTestId('fluid-body-mass-level');
    expect(level).toHaveTextContent('Up to 2% loss');
    expect(level).toHaveAttribute('data-level', 'ok');
    expect(warningsIn(fluid)).not.toBeInTheDocument();
  });

  it('recomputes with the sweat rate and shows the body-mass warning', () => {
    renderTargets({ sweat: { source: 'preset' } });
    // 1.25 L/h: fluid 80% capped at 800 ml/h; (1.25 − 0.8) × 3 = 1.35 L (1.9%); scale −1.8 kg.
    expect(within(fluidBlock()).getByTestId('fluid-value')).toHaveTextContent('800 ml/h');
    expect(within(fluidBlock()).getByTestId('fluid-total')).toHaveTextContent('2,400 ml in total');
    expect(within(fluidBlock()).getByTestId('fluid-body-mass')).toHaveTextContent('−1.8 kg');

    // 2.25 L/h: (2.25 − 0.8) × 3 = 4.35 L, 6.2% of 70 kg.
    setInput('sweat.rateIndex', 4);
    const level = within(fluidBlock()).getByTestId('fluid-body-mass-level');
    expect(level).toHaveTextContent('Over 3% loss');
    expect(level).toHaveAttribute('data-level', 'high');
    const warning = within(warningsIn(fluidBlock())).getByText(/lose about 4\.4 L of water, 6\.2% of your body mass/);
    expect(warning.closest('li')).toHaveAttribute('data-level', 'warning');

    // 0.25 L/h → 200 ml/h.
    setInput('sweat.rateIndex', 0);
    expect(within(fluidBlock()).getByTestId('fluid-value')).toHaveTextContent('200 ml/h');
  });

  it('explains the target with citations', () => {
    renderTargets({ sweat: { source: 'preset' } });
    const fluid = fluidBlock();
    fireEvent.click(within(fluid).getByRole('button', { name: /why/i }));
    expect(within(fluid).getByText(/Drink about 800 ml\/h\. This replaces roughly 80% of your sweat loss of 1,250 ml\/h/)).toBeVisible();
    expect(within(fluid).getByRole('list', { name: 'Sources' })).toBeInTheDocument();
  });

  it('suggests drinking to thirst for short events and in cool weather', () => {
    renderTargets({ event: { durationMin: 60 } });
    expect(within(fluidBlock()).getByTestId('drink-to-thirst')).toHaveTextContent(/Drinking to thirst works well/);
    cleanup();
    renderTargets({ environment: { tempC: 10 } });
    expect(within(fluidBlock()).getByTestId('drink-to-thirst')).toBeInTheDocument();
  });

  it('switches to Adjust and warns once when drinking more than sweat loss', () => {
    renderTargets({ sweat: { source: 'preset' } });
    const mode = modeGroup(fluidBlock(), 'Fluid target mode');
    fireEvent.click(radio(mode, 'Adjust'));
    expect(latest.inputs.fluid).toEqual({ mode: 'manual', manualMlPerHour: 800 });
    const input = within(fluidBlock()).getByRole('spinbutton', { name: 'Your fluid target' });
    expect(input).toHaveValue('800');
    expect(input).toHaveAttribute('aria-valuetext', '800 ml/h');

    fireEvent.change(input, { target: { value: '1500' } });
    expect(latest.plan.fluid.mlPerHour).toBe(1500);
    expect(within(fluidBlock()).getByTestId('fluid-total')).toHaveTextContent('4,500 ml in total');
    const warnings = warningsIn(fluidBlock());
    const danger = within(warnings).getByText(/You plan to drink 1,500 ml\/h\. That is more than you sweat \(1,250 ml\/h\)\./);
    expect(danger.closest('li')).toHaveAttribute('data-level', 'danger');
    // The projected gain says the same, so it is not repeated.
    expect(items(warnings)).toHaveLength(1);
    expect(within(warnings).queryByText(/would drink about 0\.75 L more than you sweat/)).not.toBeInTheDocument();
    // (1.25 − 1.5) × 3 = −0.75 L; the scale rises by 0.75 − 0.41 = 0.3 kg.
    const level = within(fluidBlock()).getByTestId('fluid-body-mass-level');
    expect(level).toHaveTextContent('Weight gain');
    expect(level).toHaveAttribute('data-level', 'gain');
    expect(within(fluidBlock()).getByTestId('fluid-body-mass')).toHaveTextContent('+0.3 kg');

    fireEvent.click(radio(mode, 'Auto'));
    expect(within(fluidBlock()).getByTestId('fluid-value')).toHaveTextContent('800 ml/h');
    expect(warningsIn(fluidBlock())).not.toBeInTheDocument();
    // The empty list stays in place for the next warning.
    expect(within(fluidBlock()).getByTestId('block-warnings')).toBeEmptyDOMElement();
  });
});

describe('TargetsSection: advanced ions', () => {
  const advanced = () => screen.getByRole('button', { name: 'Advanced: potassium, magnesium, calcium' });
  const ion = (name) => screen.getByRole('switch', { name, hidden: true });

  it('turns on potassium, magnesium and calcium under Advanced', () => {
    renderTargets({ sweat: { source: 'preset' } });
    expect(screen.getByRole('heading', { level: 3, name: 'Advanced: potassium, magnesium, calcium' })).toContainElement(advanced());
    // A block like the others: a group named by its heading.
    expect(screen.getByRole('group', { name: 'Advanced: potassium, magnesium, calcium' })).toContainElement(advanced());
    expect(advanced()).toHaveAttribute('aria-expanded', 'false');
    expect(ion('Potassium')).not.toBeVisible();

    fireEvent.click(advanced());
    expect(advanced()).toHaveAttribute('aria-expanded', 'true');
    expect(ion('Potassium')).toBeVisible();
    expect(screen.getByTestId('extra-potassium')).toHaveTextContent('Off');

    fireEvent.click(ion('Potassium'));
    fireEvent.click(ion('Magnesium'));
    fireEvent.click(ion('Calcium'));
    expect(latest.inputs.extras).toEqual({ potassium: true, magnesium: true, calcium: true });
    // [baker2017] half of a typical loss at 1.25 L/h: K 110, Mg 1, Ca 13 mg/h.
    expect(screen.getByTestId('extra-potassium')).toHaveTextContent('110 mg/h');
    expect(screen.getByTestId('extra-magnesium')).toHaveTextContent('1 mg/h');
    expect(screen.getByTestId('extra-calcium')).toHaveTextContent('13 mg/h');
    expect(ion('Potassium')).toHaveAttribute('aria-checked', 'true');
    expect(description(ion('Potassium'))).toBe('110 mg/h');

    fireEvent.click(ion('Potassium'));
    expect(screen.getByTestId('extra-potassium')).toHaveTextContent('Off');
    expect(latest.inputs.extras.potassium).toBe(false);
  });

  it('explains that the extra ions are optional', () => {
    renderTargets({ extras: { potassium: true } });
    const panel = document.getElementById(advanced().getAttribute('aria-controls'));
    fireEvent.click(within(panel).getByRole('button', { name: /why/i }));
    expect(within(panel).getByRole('link', { name: /^Baker 2017/ })).toBeInTheDocument();
  });

  it('opens Advanced when an extra is already on', () => {
    renderTargets({ extras: { magnesium: true } });
    expect(advanced()).toHaveAttribute('aria-expanded', 'true');
    expect(ion('Magnesium')).toHaveAttribute('aria-checked', 'true');
  });

  it('opens Advanced when a share link turns an extra on after the first render', () => {
    // PlanProvider restores ?s= in an effect, after the section first rendered with the defaults.
    window.history.replaceState(null, '', `/?s=${encodeShareState({ extras: { potassium: true } })}`);
    render(
      <PlanProvider>
        <UiProvider>
          <TargetsSection />
          <Spy />
        </UiProvider>
      </PlanProvider>,
    );
    expect(latest.inputs.extras.potassium).toBe(true);
    expect(advanced()).toHaveAttribute('aria-expanded', 'true');
    expect(ion('Potassium')).toBeVisible();
    // Turning the last extra off keeps the panel (and the focused switch) open.
    fireEvent.click(ion('Potassium'));
    expect(advanced()).toHaveAttribute('aria-expanded', 'true');
    // The user can still close it.
    fireEvent.click(advanced());
    expect(advanced()).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('TargetsSection: units and language', () => {
  it('shows fluid in US fl oz and stores ml', () => {
    renderTargets({ sweat: { source: 'preset' } }, { prefs: { unitSystem: 'imperial' } });
    const fluid = fluidBlock();
    // 800 ml = 27.05 fl oz; 400 ml = 13.5; 1,250 ml = 42.3; 2.4 L = 81.2.
    expect(within(fluid).getByTestId('fluid-value')).toHaveTextContent('27 fl oz/h');
    expect(within(fluid).getByTestId('fluid-total')).toHaveTextContent('81 fl oz in total');
    expect(fact(fluid, 'Guideline range')).toHaveTextContent('14–27 fl oz/h');
    expect(fact(fluid, 'Sweat loss')).toHaveTextContent('about 42 fl oz/h');
    expect(within(fluid).getByTestId('fluid-body-mass')).toHaveTextContent(/^−3\.9 lb$/);
    // Nutrients stay in g and mg.
    expect(within(sodiumBlock()).getByTestId('sodium-value')).toHaveTextContent('570 mg/h');
    expect(screen.getByRole('region', { name: 'Targets' })).not.toHaveTextContent(/\bml\b/);

    fireEvent.click(radio(modeGroup(fluid, 'Fluid target mode'), 'Adjust'));
    const input = within(fluidBlock()).getByRole('spinbutton', { name: 'Your fluid target' });
    expect(input).toHaveValue('27.1');
    expect(input).toHaveAttribute('aria-valuetext', '27.1 fl oz/h');
    expect(input).toHaveAttribute('aria-valuemax', '101.4');
    enter(input, 20);
    // 20 US fl oz = 591.47 ml.
    expect(latest.inputs.fluid.manualMlPerHour).toBeCloseTo(591.47, 2);
    expect(input).toHaveValue('20');
  });

  it('shows the stored ml in metric (the plan keeps 0.01 ml)', () => {
    renderTargets({ fluid: { mode: 'manual', manualMlPerHour: 591.47 } });
    const input = within(fluidBlock()).getByRole('spinbutton', { name: 'Your fluid target' });
    expect(latest.plan.fluid.mlPerHour).toBe(591.47);
    expect(input).toHaveValue('591.47');
    expect(input).toHaveAttribute('aria-valuetext', '591.47 ml/h');
  });

  it('writes the total as the board does, from the exact ml', () => {
    // 655 ml/h for 3 h = 1,965 ml = 66.4 fl oz (1.97 L would read 67 fl oz).
    renderTargets({ fluid: { mode: 'manual', manualMlPerHour: 655 } }, { prefs: { unitSystem: 'imperial' } });
    expect(within(fluidBlock()).getByTestId('fluid-total')).toHaveTextContent(/^66 fl oz in total$/);
    cleanup();
    renderTargets({ fluid: { mode: 'manual', manualMlPerHour: 655 } }, { prefs: { unitSystem: 'metric' } });
    expect(within(fluidBlock()).getByTestId('fluid-total')).toHaveTextContent(/^1,965 ml in total$/);
  });

  it('formats numbers and ratios in German', () => {
    renderTargets({ sweat: { source: 'preset', saltinessIndex: 4 } }, { prefs: { locale: 'de' } });
    expect(within(screen.getByTestId('targets-sodium')).getByTestId('sodium-value')).toHaveTextContent('1.000');
    expect(within(screen.getByTestId('targets-ratio')).getByTestId('carb-ratio-value')).toHaveTextContent('1:0,5');
    expect(within(screen.getByTestId('targets-fluid')).getByTestId('fluid-total')).toHaveTextContent('2.400 ml insgesamt');
  });

  it('formats the ratio part hints in German numbers', () => {
    renderTargets({ carbs: { ratioMode: 'manual' } }, { prefs: { locale: 'de' } });
    const fructose = within(screen.getByTestId('targets-ratio')).getAllByRole('spinbutton')[1];
    expect(description(fructose)).toMatch(/0,5 .*1:0,5/);
  });
});

describe('TargetsSection: accessibility', () => {
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

  it('labels every control (auto)', () => {
    const { container } = renderTargets();
    expectLabelledControls(container, 0);
  });

  it('labels every control (everything adjusted, gut-trained on, every ion on)', () => {
    const { container } = renderTargets({
      event: { highCarb: true },
      carbs: { mode: 'manual', ratioMode: 'manual' },
      sodium: { mode: 'manual' },
      fluid: { mode: 'manual' },
      extras: { potassium: true, magnesium: true, calcium: true },
    });
    // carbs, glucose parts, fructose parts, sodium, fluid
    expectLabelledControls(container, 5);
    expect(screen.getAllByRole('switch')).toHaveLength(4);
  });

  it('renders the full field list on its own', () => {
    renderTargets(undefined, { children: <TargetsFields /> });
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(5);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('renders a single block on its own', () => {
    renderTargets(undefined, { children: <TargetsFluid /> });
    expect(screen.getByRole('group', { name: 'Fluid' })).toBeInTheDocument();
  });

  it('throws outside the providers', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TargetsSection />)).toThrow(/must be used inside <PlanProvider>/);
  });
});

describe('ui-setup-targets catalog', () => {
  it('keeps its keys in its namespace and types every placeholder', () => {
    for (const [key, text] of Object.entries(uiSetupTargets)) {
      expect(key.startsWith('ui-setup-targets.'), key).toBe(true);
      expect(MESSAGES[key], key).toBe(text);
      for (const token of placeholdersOf(text)) {
        const [, type, ...flags] = token.split(':');
        if (type !== undefined) expect(PLACEHOLDER_TYPES, `${key}: ${token}`).toContain(type);
        for (const flag of flags) expect(flag).toBe('nounit');
      }
      // Every ml, L, kg, % or °C right after a placeholder must come from a typed one.
      expect(text, key).not.toMatch(/\{\w+\} ?(ml|L\b|kg|%|°|km\/h|cm)/);
    }
  });
});
