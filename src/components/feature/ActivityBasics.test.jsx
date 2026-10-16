import { describe, it, expect, afterEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActivityBasics from './ActivityBasics';
import { PlanProvider, usePlanInputs, usePlan } from '../../state/PlanProvider';
import { UiProvider } from '../../state/UiProvider';

/** Latest inputs and plan, captured by <Spy /> on every render. */
const latest = { inputs: null, plan: null };

function Spy() {
  const { inputs } = usePlanInputs();
  const plan = usePlan();
  useEffect(() => {
    latest.inputs = inputs;
    latest.plan = plan;
  }, [inputs, plan]);
  return null;
}

function renderActivity(initialInputs) {
  return render(
    <PlanProvider initialInputs={initialInputs}>
      <UiProvider>
        <ActivityBasics />
        <Spy />
      </UiProvider>
    </PlanProvider>,
  );
}

const region = (name) => screen.getByRole('region', { name });

/** Types into a number field like a user would: change, then leave the field. */
function enter(input, value) {
  fireEvent.change(input, { target: { value: String(value) } });
  fireEvent.blur(input);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  latest.inputs = null;
  latest.plan = null;
});

describe('ActivityBasics: activity inputs', () => {
  it('shows the default inputs', () => {
    renderActivity();
    expect(screen.getByLabelText('Hours')).toHaveValue(3);
    expect(screen.getByLabelText('Minutes')).toHaveValue(0);
    expect(screen.getByLabelText(/intensity/i)).toHaveValue('moderate');
    expect(screen.getByLabelText(/body mass/i)).toHaveValue(70);
    expect(screen.getByLabelText('Temperature')).toHaveValue('20');
    expect(screen.getByText('20 °C')).toBeInTheDocument();
    expect(screen.getByLabelText(/humidity/i)).toHaveValue(50);
  });

  it('sets the duration from hours and minutes', () => {
    renderActivity();
    enter(screen.getByLabelText('Hours'), 2);
    expect(latest.inputs.event.durationMin).toBe(120);
    enter(screen.getByLabelText('Minutes'), 45);
    expect(latest.inputs.event.durationMin).toBe(165);
    expect(screen.getByLabelText('Hours')).toHaveValue(2);
    expect(screen.getByLabelText('Minutes')).toHaveValue(45);
  });

  it('clamps the duration at 0 and carries extra minutes into hours', () => {
    renderActivity();
    enter(screen.getByLabelText('Hours'), -3);
    expect(latest.inputs.event.durationMin).toBe(0);
    expect(screen.getByLabelText('Hours')).toHaveValue(0);

    enter(screen.getByLabelText('Minutes'), -10);
    expect(latest.inputs.event.durationMin).toBe(0);

    enter(screen.getByLabelText('Minutes'), 90);
    expect(latest.inputs.event.durationMin).toBe(90);
    expect(screen.getByLabelText('Hours')).toHaveValue(1);
    expect(screen.getByLabelText('Minutes')).toHaveValue(30);
  });

  it('keeps an empty field while typing and restores the stored value on blur', () => {
    renderActivity();
    const hours = screen.getByLabelText('Hours');
    fireEvent.change(hours, { target: { value: '' } });
    expect(hours).toHaveValue(null);
    expect(latest.inputs.event.durationMin).toBe(180);
    fireEvent.blur(hours);
    expect(hours).toHaveValue(3);
  });

  it('offers the four intensities with zone hints and updates the target', () => {
    renderActivity();
    const select = screen.getByLabelText(/intensity/i);
    const options = within(select).getAllByRole('option');
    expect(options.map((o) => o.value)).toEqual(['easy', 'moderate', 'hard', 'race']);
    for (const option of options) expect(option.textContent).toMatch(/Zone/);

    fireEvent.change(select, { target: { value: 'easy' } });
    expect(latest.inputs.event.intensity).toBe('easy');
    // [jeukendrup2014] 180 min easy: 60 × 0.8 = 48 → 50 g/h
    expect(screen.getByTestId('carbs-target')).toHaveTextContent('50 g/h');
  });

  it('shows body mass in lb but stores kg', async () => {
    const user = userEvent.setup();
    renderActivity();
    const mass = screen.getByLabelText(/body mass/i);

    await user.click(screen.getByRole('button', { name: 'lb' }));
    expect(screen.getByRole('button', { name: 'lb' })).toHaveAttribute('aria-pressed', 'true');
    expect(mass).toHaveValue(154.3);
    expect(mass).toHaveAccessibleName('Body mass (lb)');
    expect(latest.inputs.athlete.massKg).toBe(70);

    // Typing passes through 1 and 17 lb, below the mass limit; they are not committed.
    await user.clear(mass);
    await user.type(mass, '176');
    expect(latest.inputs.athlete.massKg).toBeCloseTo(79.83, 2);
    await user.tab();
    expect(mass).toHaveValue(176);

    await user.click(screen.getByRole('button', { name: 'kg' }));
    expect(mass).toHaveValue(79.8);
    expect(latest.inputs.athlete.massKg).toBeCloseTo(79.83, 2);
  });

  it('clamps body mass to the input limits on blur', () => {
    renderActivity();
    const mass = screen.getByLabelText(/body mass/i);
    fireEvent.change(mass, { target: { value: '7' } });
    expect(latest.inputs.athlete.massKg).toBe(70);
    fireEvent.blur(mass);
    expect(latest.inputs.athlete.massKg).toBe(30);
    expect(mass).toHaveValue(30);
  });

  it('shows temperature in °F but stores °C', () => {
    renderActivity();
    fireEvent.click(screen.getByRole('button', { name: '°F' }));
    const slider = screen.getByLabelText('Temperature');
    expect(slider).toHaveValue('68');
    expect(slider).toHaveAttribute('min', '-4');
    expect(slider).toHaveAttribute('max', '122');
    expect(screen.getByText('68 °F')).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: '86' } });
    expect(latest.inputs.environment.tempC).toBe(30);

    fireEvent.click(screen.getByRole('button', { name: '°C' }));
    expect(screen.getByLabelText('Temperature')).toHaveValue('30');
    expect(screen.getByText('30 °C')).toBeInTheDocument();
  });

  it('sets humidity, clamped to 0–100', () => {
    renderActivity();
    const humidity = screen.getByLabelText(/humidity/i);
    enter(humidity, 80);
    expect(latest.inputs.environment.humidity).toBe(80);
    enter(humidity, 150);
    expect(latest.inputs.environment.humidity).toBe(100);
  });

  it('no longer has the smart toggle, ultra mode, gender or caffeine habituation', () => {
    renderActivity({ caffeine: { enabled: true } });
    expect(screen.queryByText(/smart physiology/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ultra mode/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/gender/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tolerance profile/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/habituat/i)).not.toBeInTheDocument();
  });
});

describe('ActivityBasics: carbohydrate target', () => {
  it('shows the recommended value, range and band', () => {
    renderActivity();
    const carbs = region('Carbohydrate target');
    // [jeukendrup2014] >2.5 h moderate: midpoint of 60–90 g/h
    expect(within(carbs).getByTestId('carbs-target')).toHaveTextContent('75 g/h');
    expect(within(carbs).getByText('Recommended').nextSibling).toHaveTextContent('75 g/h');
    expect(within(carbs).getByText('60–90 g/h')).toBeInTheDocument();
    expect(within(carbs).getByText('Over 2.5 h')).toBeInTheDocument();
  });

  it('reveals the explanation and citations behind "Why?"', () => {
    renderActivity();
    const carbs = region('Carbohydrate target');
    const why = within(carbs).getByRole('button', { name: /why\?/i });
    fireEvent.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(carbs).getByText(
        'Over 2.5 h, the evidence range is 60–90 g/h of carbs from mixed glucose and fructose. Your target is 75 g/h.',
      ),
    ).toBeVisible();
    expect(within(carbs).getByRole('link', { name: 'Jeukendrup 2014' })).toHaveAttribute(
      'href',
      'https://doi.org/10.1007/s40279-014-0148-z',
    );
  });

  it('switches to a manual target seeded from the recommendation, with evidence warnings', () => {
    renderActivity();
    const carbs = region('Carbohydrate target');
    const auto = within(carbs).getByRole('button', { name: 'Auto' });
    const adjust = within(carbs).getByRole('button', { name: 'Adjust' });
    expect(auto).toHaveAttribute('aria-pressed', 'true');
    expect(within(carbs).queryByLabelText(/your target/i)).not.toBeInTheDocument();

    fireEvent.click(adjust);
    expect(adjust).toHaveAttribute('aria-pressed', 'true');
    expect(latest.inputs.carbs.mode).toBe('manual');
    const input = within(carbs).getByLabelText('Your target (g/h)');
    expect(input).toHaveValue(75);
    expect(latest.plan.carbs.gPerHour).toBe(75);

    // [podlogar2022] [hearris2022] above 120 g/h is beyond what was studied
    enter(input, 130);
    expect(latest.plan.carbs.gPerHour).toBe(130);
    const warnings = within(carbs).getByRole('list', { name: 'Warnings' });
    const danger = within(warnings)
      .getAllByRole('listitem')
      .find((li) => li.dataset.level === 'danger');
    expect(danger).toHaveTextContent('130 g/h is above 120 g/h, the highest intake studied. Gut problems become more likely.');
    // The recommendation stays visible as a reference.
    expect(within(carbs).getByText('Recommended').nextSibling).toHaveTextContent('75 g/h');

    fireEvent.click(auto);
    expect(latest.inputs.carbs.mode).toBe('auto');
    expect(latest.plan.carbs.gPerHour).toBe(75);
    expect(within(carbs).queryByLabelText(/your target/i)).not.toBeInTheDocument();
    expect(within(carbs).queryByRole('list', { name: 'Warnings' })).not.toBeInTheDocument();
  });

  it('shows the gut-trained opt-in only for events over 150 min', () => {
    renderActivity({ event: { durationMin: 150 } });
    expect(screen.queryByRole('switch', { name: /gut-trained/i })).not.toBeInTheDocument();
    enter(screen.getByLabelText('Minutes'), 31);
    expect(latest.inputs.event.durationMin).toBe(151);
    expect(screen.getByRole('switch', { name: /gut-trained/i })).not.toBeChecked();
  });

  it('raises the target with the gut-trained opt-in and warns about gut training', () => {
    renderActivity();
    const carbs = region('Carbohydrate target');
    fireEvent.click(within(carbs).getByRole('switch', { name: /gut-trained/i }));
    expect(latest.inputs.event.highCarb).toBe(true);
    // [podlogar2022] [hearris2022] gut-trained, >2.5 h, moderate: midpoint of 90–120 → 105 g/h
    expect(within(carbs).getByTestId('carbs-target')).toHaveTextContent('105 g/h');
    expect(within(carbs).getByText('Over 2.5 h, gut-trained')).toBeInTheDocument();
    // [jeukendrup2017] [cox2010]
    expect(
      within(carbs).getByText('Intakes above 90 g/h need 2–4 weeks of gut training. Extra benefit above 90 g/h is unproven.'),
    ).toBeInTheDocument();
  });

  it('keeps the gut-trained switch while it is on, so a shorter event can turn it off', () => {
    renderActivity();
    const carbs = region('Carbohydrate target');
    fireEvent.click(within(carbs).getByRole('switch', { name: /gut-trained/i }));
    enter(screen.getByLabelText('Hours'), 2);
    expect(latest.inputs.event).toMatchObject({ durationMin: 120, highCarb: true });
    // The note explains why it has no effect, and the switch next to it clears it.
    expect(
      within(carbs).getByText('Gut-trained mode only applies to events over 150 min. The standard range is used instead.'),
    ).toBeInTheDocument();
    const toggle = within(carbs).getByRole('switch', { name: /gut-trained/i });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(latest.inputs.event.highCarb).toBe(false);
    expect(within(carbs).queryByText(/Gut-trained mode only applies/)).not.toBeInTheDocument();
    expect(within(carbs).queryByRole('switch', { name: /gut-trained/i })).not.toBeInTheDocument();
  });

  it('shows the gut-trained switch for a short event restored with highCarb on', () => {
    renderActivity({ event: { durationMin: 120, highCarb: true } });
    expect(screen.getByRole('switch', { name: /gut-trained/i })).toBeChecked();
  });

  it('shows the caffeine dose in the dark amber text color', () => {
    renderActivity({ caffeine: { enabled: true } });
    expect(screen.getByText('3 mg/kg')).toHaveClass('text-apple-amber-ink');
  });

  it('shows the mouth rinse note only in the rinse band', () => {
    renderActivity({ event: { durationMin: 60 } });
    const carbs = region('Carbohydrate target');
    // [carter2004] [brietzke2019] 45–75 min: mouth rinse
    expect(within(carbs).getByText('45–75 min')).toBeInTheDocument();
    expect(within(carbs).getByText('Mouth rinse option')).toBeInTheDocument();
    expect(within(carbs).getByText(/Swish 25 ml of a 6–8% maltodextrin drink/)).toHaveTextContent(
      'Swish 25 ml of a 6–8% maltodextrin drink in your mouth for 5–10 s, then spit it out. Repeat every 5–10 min.',
    );
    expect(within(carbs).getByRole('link', { name: 'Carter et al. 2004' })).toBeInTheDocument();
    cleanup();

    renderActivity();
    expect(screen.queryByText('Mouth rinse option')).not.toBeInTheDocument();
  });

  it('shows a 0 g/h range for events under 45 min', () => {
    renderActivity({ event: { durationMin: 30 } });
    const carbs = region('Carbohydrate target');
    expect(within(carbs).getByTestId('carbs-target')).toHaveTextContent('0 g/h');
    expect(within(carbs).getByText('Evidence range').nextSibling).toHaveTextContent('0 g/h');
    expect(within(carbs).getByText('Under 45 min')).toBeInTheDocument();
  });

  it('leaves the source warning to the source list and recipe, but keeps target warnings', () => {
    // No fructose source: the default 1:0.5 ratio cannot be mixed. Manual
    // 130 g/h adds the evidence warnings for the target itself.
    renderActivity({ carbs: { mode: 'manual', manualGPerHour: 130, fructoseSources: [] } });
    const ids = latest.plan.carbs.warnings.map((w) => w.id);
    expect(ids).toContain('plan.carbSourcesInfeasible');
    expect(ids).toContain('carbs.aboveStudied');

    const warnings = within(region('Carbohydrate target')).getByRole('list', { name: 'Warnings' });
    // Direct children only: each warning also nests a list of citation links.
    const levels = [...warnings.querySelectorAll(':scope > li')].map((li) => li.dataset.level);
    expect(levels).toEqual(['danger', 'warning']);
    expect(warnings).toHaveTextContent(/120 g\/h/);
    expect(warnings).not.toHaveTextContent(/cannot make/i);
  });
});

describe('ActivityBasics: caffeine', () => {
  it('is off by default and hides its controls', () => {
    renderActivity();
    const caffeine = region('Caffeine');
    expect(within(caffeine).getByRole('switch', { name: 'Include caffeine' })).not.toBeChecked();
    expect(within(caffeine).queryByLabelText('Caffeine dose')).not.toBeInTheDocument();
    expect(within(caffeine).queryByRole('switch', { name: 'Add to gels as tablets' })).not.toBeInTheDocument();
    // The explanation is still available.
    fireEvent.click(within(caffeine).getByRole('button', { name: /why\?/i }));
    expect(
      within(caffeine).getByText('Caffeine is optional. Doses of 3–6 mg/kg improve endurance performance for most athletes.'),
    ).toBeVisible();
  });

  it('plans doses when enabled and follows the mg/kg slider', () => {
    renderActivity();
    const caffeine = region('Caffeine');
    fireEvent.click(within(caffeine).getByRole('switch', { name: 'Include caffeine' }));
    expect(latest.inputs.caffeine.enabled).toBe(true);

    const slider = within(caffeine).getByLabelText('Caffeine dose');
    expect(slider).toHaveAttribute('min', '1');
    expect(slider).toHaveAttribute('max', '6');
    expect(slider).toHaveAttribute('step', '0.5');
    expect(slider).toHaveValue('3');

    // [talanian2016] 70 kg, 3 mg/kg, 180 min: 140 mg 60 min before, 70 mg at 120 min
    const doses = within(within(caffeine).getByRole('list', { name: 'Planned caffeine doses' })).getAllByRole('listitem');
    expect(doses).toHaveLength(2);
    expect(doses[0]).toHaveTextContent('T−1hBefore the start140 mg');
    expect(doses[1]).toHaveTextContent('T+2hDuring the event70 mg');
    expect(within(caffeine).getByText(/^Total/)).toHaveTextContent('Total 210 mg (3 mg/kg)');

    // [efsa2015] [guest2021] always-on notes
    expect(within(caffeine).getByText(/Skip caffeine if you are pregnant/)).toBeInTheDocument();
    expect(within(caffeine).getByText(/Try your caffeine plan in training first/)).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: '4.5' } });
    expect(latest.inputs.caffeine.mgPerKg).toBe(4.5);
    expect(within(caffeine).getByText('4.5 mg/kg')).toBeInTheDocument();
    expect(within(caffeine).getByText(/^Total/)).toHaveTextContent(`Total ${latest.plan.caffeine.totalMg} mg`);
  });

  it('adds caffeine to gels as tablets with a tablet size choice', () => {
    renderActivity({ caffeine: { enabled: true } });
    const caffeine = region('Caffeine');
    expect(within(caffeine).queryByLabelText('Tablet size')).not.toBeInTheDocument();

    fireEvent.click(within(caffeine).getByRole('switch', { name: 'Add to gels as tablets' }));
    expect(latest.inputs.caffeine.asIngredient).toBe(true);
    const size = within(caffeine).getByLabelText('Tablet size');
    expect(size).toHaveValue('100');

    // 70 kg, 3 mg/kg, 180 min, 100 mg tablets: 150 mg (1.5) before, 50 mg (0.5) with the gel at 120 min
    const doses = within(within(caffeine).getByRole('list', { name: 'Planned caffeine doses' })).getAllByRole('listitem');
    expect(doses[0]).toHaveTextContent('Before the start150 mg(1.5 × 100 mg tablet)');
    expect(doses[1]).toHaveTextContent('T+2hWith gel 750 mg(0.5 × 100 mg tablet)');

    // Never pure caffeine powder.
    const danger = within(caffeine)
      .getAllByRole('listitem')
      .find((li) => li.dataset.level === 'danger');
    expect(danger).toHaveTextContent('Add caffeine as 100 mg tablets. Never use pure caffeine powder.');

    fireEvent.change(size, { target: { value: '200' } });
    expect(latest.inputs.caffeine.tabletMg).toBe(200);
    expect(within(caffeine).getByText(/Add caffeine as 200 mg tablets/)).toBeInTheDocument();
  });
});

describe('ActivityBasics: sodium bicarbonate', () => {
  it('hides bicarbonate behind a link for events over 90 min', () => {
    renderActivity();
    expect(screen.queryByRole('region', { name: 'Sodium bicarbonate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Include sodium bicarbonate' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show sodium bicarbonate (for efforts under ~60 min)' }));
    const bicarb = region('Sodium bicarbonate');
    const toggle = within(bicarb).getByRole('switch', { name: 'Include sodium bicarbonate' });
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveFocus();
    expect(screen.queryByRole('button', { name: /show sodium bicarbonate/i })).not.toBeInTheDocument();
  });

  it('shows the bicarbonate section without a link for events up to 90 min', () => {
    renderActivity({ event: { durationMin: 90 } });
    expect(screen.queryByRole('button', { name: /show sodium bicarbonate/i })).not.toBeInTheDocument();
    expect(within(region('Sodium bicarbonate')).getByRole('switch', { name: 'Include sodium bicarbonate' })).toBeInTheDocument();
  });

  it('shows the dose, sodium load, timing and warnings when enabled', () => {
    renderActivity({ event: { durationMin: 60 } });
    const bicarb = region('Sodium bicarbonate');
    expect(within(bicarb).queryByLabelText('Bicarbonate dose')).not.toBeInTheDocument();

    fireEvent.click(within(bicarb).getByRole('switch', { name: 'Include sodium bicarbonate' }));
    expect(latest.inputs.bicarb.enabled).toBe(true);

    const slider = within(bicarb).getByLabelText('Bicarbonate dose');
    expect(slider).toHaveAttribute('min', '0.2');
    expect(slider).toHaveAttribute('max', '0.3');
    expect(slider).toHaveValue('0.3');

    // [grgic2021] 0.3 g/kg × 70 kg = 21 g; sodium 21 g × 0.2737 = 5.7 g
    expect(within(bicarb).getByText('Dose').nextSibling).toHaveTextContent('21 g');
    expect(within(bicarb).getByText('Sodium load').nextSibling).toHaveTextContent('5.7 g');
    expect(within(bicarb).getByText('Take it').nextSibling).toHaveTextContent('T−1h 30m (window T−3h to T−1h)');
    expect(within(bicarb).getByText(/Stomach upset is common with bicarbonate/)).toBeInTheDocument();
    expect(within(bicarb).getByText('This dose contains about 5.7 g of sodium. That is a large salt load on top of your normal diet.')).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: '0.2' } });
    expect(latest.inputs.bicarb.gPerKg).toBe(0.2);
    expect(within(bicarb).getByText('Dose').nextSibling).toHaveTextContent('14 g');
  });

  it('keeps an enabled bicarbonate plan visible on a long event and warns about it', () => {
    renderActivity({ bicarb: { enabled: true } });
    const bicarb = region('Sodium bicarbonate');
    // [grgic2021] [deoliveira2022] no evidence for multi-hour events
    expect(
      within(bicarb).getByText(
        'There is no evidence that bicarbonate helps in events longer than about 90 min. Side effects may outweigh any gain.',
      ),
    ).toBeInTheDocument();

    // Turning it off keeps the section open instead of collapsing it under the switch.
    fireEvent.click(within(bicarb).getByRole('switch', { name: 'Include sodium bicarbonate' }));
    expect(latest.inputs.bicarb.enabled).toBe(false);
    expect(within(region('Sodium bicarbonate')).getByRole('switch', { name: 'Include sodium bicarbonate' })).not.toBeChecked();
  });
});

describe('ActivityBasics: accessibility', () => {
  it('gives every form control a unique id and an associated label', () => {
    const { container } = renderActivity({
      event: { durationMin: 180 },
      carbs: { mode: 'manual' },
      caffeine: { enabled: true, asIngredient: true },
      bicarb: { enabled: true },
    });
    const controls = [...container.querySelectorAll('input, select, textarea')];
    // duration ×2, intensity, mass, temperature, humidity, manual carbs, high-carb,
    // caffeine on, mg/kg, as tablets, tablet size, bicarb on, g/kg
    expect(controls).toHaveLength(14);
    const ids = controls.map((el) => el.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    for (const el of controls) {
      expect(el.labels.length, `#${el.id} has a label`).toBeGreaterThan(0);
      expect(el).toHaveAccessibleName();
    }
    // Ids are unique in the whole document too.
    const allIds = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('throws outside the providers', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ActivityBasics />)).toThrow(/must be used inside <PlanProvider>/);
  });
});
