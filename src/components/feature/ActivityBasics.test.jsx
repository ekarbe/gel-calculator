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

/**
 * Renders the card with the real providers. Autosave is off, so no test
 * reads inputs that an earlier test left in localStorage.
 */
function renderActivity(initialInputs) {
  return render(
    <PlanProvider initialInputs={initialInputs} persist={false}>
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

/** The `aria-describedby` targets of a control, joined. */
const description = (el) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? `#${id} missing`)
    .join(' ');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
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

  it('no longer has the smart toggle, ultra mode, gender, sex or caffeine habituation', () => {
    renderActivity({ caffeine: { enabled: true } });
    expect(screen.queryByText(/smart physiology/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ultra mode/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/gender/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/\bsex\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bsex\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tolerance profile/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/habituat/i)).not.toBeInTheDocument();
  });
});

describe('ActivityBasics: sport and effort', () => {
  /** Tolerance of the heat-balance golden values, L/h (as in heatBalance.test.js). */
  const TOL = 0.03;

  it('defaults to cycling at 30 km/h with power estimated from the speed', () => {
    renderActivity();
    const sport = screen.getByLabelText('Sport');
    expect(sport).toHaveValue('cycling');
    expect(within(sport).getAllByRole('option').map((o) => [o.value, o.textContent])).toEqual([
      ['running', 'Running'],
      ['cycling', 'Cycling'],
      ['other', 'Other sport'],
    ]);
    expect(screen.getByLabelText('Speed (km/h)')).toHaveValue(30);
    const power = screen.getByLabelText('Power (W)');
    expect(power).toHaveValue(0);
    // P = 0.5 × 1.2 × 0.36 × v³ + 0.005 × (70 + 10) × 9.81 × v, v = 30/3.6 m/s → 157.7 W
    expect(description(power)).toBe('0 = estimate from speed. Estimated from your speed: about 158 W on flat ground.');
    expect(screen.queryByLabelText(/METs/)).not.toBeInTheDocument();
    expect(screen.queryByText(/min\/km/)).not.toBeInTheDocument();
  });

  it('uses a typed power, and estimates it again when the field is cleared', () => {
    renderActivity();
    const power = screen.getByLabelText('Power (W)');
    enter(power, 250);
    expect(latest.inputs.event.powerW).toBe(250);
    expect(latest.plan.sweat.estimate).toMatchObject({ powerW: 250, powerFromSpeed: false });
    expect(screen.queryByText(/Estimated from your speed/)).not.toBeInTheDocument();
    expect(description(power)).toBe('0 = estimate from speed.');

    // An empty field means 0: estimate from the speed.
    fireEvent.change(power, { target: { value: '' } });
    expect(latest.inputs.event.powerW).toBe(0);
    fireEvent.blur(power);
    expect(power).toHaveValue(0);

    // 36 km/h: 0.216 × 10³ + 3.924 × 10 = 255.2 W
    enter(screen.getByLabelText('Speed (km/h)'), 36);
    expect(latest.inputs.event.speedKmh).toBe(36);
    expect(screen.getByText(/Estimated from your speed/)).toHaveTextContent('about 255 W on flat ground');
  });

  it('clamps power and speed to the input limits', () => {
    renderActivity();
    enter(screen.getByLabelText('Power (W)'), 5000);
    expect(latest.inputs.event.powerW).toBe(2000);

    const speed = screen.getByLabelText('Speed (km/h)');
    // Typing passes through 1 km/h, below the limit; it is not committed while typing.
    fireEvent.change(speed, { target: { value: '1' } });
    expect(latest.inputs.event.speedKmh).toBe(30);
    fireEvent.blur(speed);
    expect(latest.inputs.event.speedKmh).toBe(3);
    enter(speed, 100);
    expect(latest.inputs.event.speedKmh).toBe(70);
    expect(speed).toHaveValue(70);
  });

  it('matches the cycling reference: 75 kg, 180 cm, 200 W at 30 km/h, 25 °C, 50 % → 0.60 L/h', () => {
    // [jay2024] [gagnon2013] research notes scenario table (final_model.py)
    renderActivity();
    enter(screen.getByLabelText(/body mass/i), 75);
    enter(screen.getByLabelText('Height (cm)'), 180);
    enter(screen.getByLabelText('Power (W)'), 200);
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '25' } });
    expect(latest.inputs).toMatchObject({
      event: { sport: 'cycling', speedKmh: 30, powerW: 200, setting: 'outdoor' },
      athlete: { massKg: 75, heightCm: 180 },
      environment: { tempC: 25, humidity: 50, sun: 'none' },
    });
    expect(Math.abs(latest.plan.sweat.estimate.rateLph - 0.6)).toBeLessThanOrEqual(TOL);
  });

  it('shows the running pace for the speed and drops the power field', () => {
    renderActivity();
    fireEvent.change(screen.getByLabelText('Sport'), { target: { value: 'running' } });
    expect(latest.inputs.event.sport).toBe('running');
    expect(screen.queryByLabelText('Power (W)')).not.toBeInTheDocument();

    const speed = screen.getByLabelText('Speed (km/h)');
    // The ride's 30 km/h would be a 2:00 min/km run: switching takes a typical 11 km/h instead.
    expect(latest.inputs.event.speedKmh).toBe(11);
    // 11 km/h → 3600/11 = 327 s per km
    expect(description(speed)).toBe('Pace 5:27 min/km');
    enter(speed, 12);
    expect(description(speed)).toBe('Pace 5:00 min/km');
    // 10.5 km/h → 342.9 s → 5:43
    enter(speed, 10.5);
    expect(latest.inputs.event.speedKmh).toBe(10.5);
    expect(screen.getByText('5:43 min/km')).toBeInTheDocument();
    enter(speed, 3);
    expect(screen.getByText('20:00 min/km')).toBeInTheDocument();
  });

  it('keeps a speed that fits the new sport, and flags an impossible running pace', () => {
    renderActivity({ event: { sport: 'cycling', speedKmh: 18 } });
    // 18 km/h is a plausible run (3:20 min/km): kept.
    fireEvent.change(screen.getByLabelText('Sport'), { target: { value: 'running' } });
    expect(latest.inputs.event).toMatchObject({ sport: 'running', speedKmh: 18 });
    // Back to cycling: 18 km/h fits a ride too.
    fireEvent.change(screen.getByLabelText('Sport'), { target: { value: 'cycling' } });
    expect(latest.inputs.event.speedKmh).toBe(18);
    // A slow run (8 km/h) is not a ride: cycling takes 30 km/h.
    fireEvent.change(screen.getByLabelText('Sport'), { target: { value: 'running' } });
    enter(screen.getByLabelText('Speed (km/h)'), 8);
    fireEvent.change(screen.getByLabelText('Sport'), { target: { value: 'cycling' } });
    expect(latest.inputs.event.speedKmh).toBe(30);
    // Other sports have no speed: it is kept for later.
    fireEvent.change(screen.getByLabelText('Sport'), { target: { value: 'other' } });
    expect(latest.inputs.event.speedKmh).toBe(30);

    // Typed in by hand, a world-record pace gets a visible note.
    fireEvent.change(screen.getByLabelText('Sport'), { target: { value: 'running' } });
    expect(screen.queryByTestId('pace-implausible')).not.toBeInTheDocument();
    enter(screen.getByLabelText('Speed (km/h)'), 30);
    expect(screen.getByTestId('pace-implausible')).toHaveTextContent('faster than the marathon world record');
  });

  it('matches the running reference: 70 kg, 175 cm, 12 km/h, 20 °C, 50 % → 0.95 L/h in the shade, 1.27 in full sun', () => {
    // [jay2024] [gagnon2013] research notes scenario table (final_model.py)
    renderActivity({ event: { sport: 'running', speedKmh: 12 } });
    expect(Math.abs(latest.plan.sweat.estimate.rateLph - 0.95)).toBeLessThanOrEqual(TOL);
    fireEvent.change(screen.getByLabelText('Sun'), { target: { value: 'full' } });
    expect(latest.inputs.environment.sun).toBe('full');
    expect(Math.abs(latest.plan.sweat.estimate.rateLph - 1.27)).toBeLessThanOrEqual(TOL);
  });

  it('asks for METs for other sports and keeps the speed for later', () => {
    renderActivity({ event: { speedKmh: 25 } });
    fireEvent.change(screen.getByLabelText('Sport'), { target: { value: 'other' } });
    expect(screen.queryByLabelText('Speed (km/h)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Power (W)')).not.toBeInTheDocument();

    const mets = screen.getByLabelText('Effort (METs)');
    expect(mets).toHaveValue(8);
    expect(mets).toHaveAttribute('min', '1');
    expect(mets).toHaveAttribute('max', '20');
    expect(description(mets)).toMatch(/^1 MET is sitting at rest\./);

    enter(mets, 10);
    expect(latest.inputs.event.mets).toBe(10);
    // Compendium METs: 1 MET = 1 kcal/kg/h = 1.163 W/kg, so M = 1.163 × METs × kg
    expect(latest.plan.sweat.estimate.metabolicW).toBeCloseTo(1.163 * 10 * 70, 6);
    enter(mets, 50);
    expect(latest.inputs.event.mets).toBe(20);

    fireEvent.change(screen.getByLabelText('Sport'), { target: { value: 'cycling' } });
    expect(screen.getByLabelText('Speed (km/h)')).toHaveValue(25);
    expect(latest.inputs.event.mets).toBe(20);
  });

  it('matches the other-sport reference: 8 METs, 70 kg, 175 cm, 25 °C, 50 % outdoors → 0.75 L/h', () => {
    // [jay2024] [gagnon2013] with 0.3 clo for other sports, as in heatBalance.test.js
    // (the research table's 0.70 L/h used 0.15 clo).
    renderActivity({ event: { sport: 'other' } });
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '25' } });
    expect(Math.abs(latest.plan.sweat.estimate.rateLph - 0.75)).toBeLessThanOrEqual(TOL);
  });
});

describe('ActivityBasics: you', () => {
  it('sets the height in cm, clamped to the input limits', () => {
    renderActivity();
    const height = screen.getByLabelText('Height (cm)');
    expect(height).toHaveValue(175);
    expect(height).toHaveAttribute('min', '120');
    expect(height).toHaveAttribute('max', '220');
    enter(height, 182);
    expect(latest.inputs.athlete.heightCm).toBe(182);
    enter(height, 300);
    expect(latest.inputs.athlete.heightCm).toBe(220);
    expect(height).toHaveValue(220);
  });

  it('shows the height in inches when mass is in lb, but stores cm', async () => {
    const user = userEvent.setup();
    renderActivity();
    await user.click(screen.getByRole('button', { name: 'lb' }));
    expect(screen.queryByLabelText('Height (cm)')).not.toBeInTheDocument();
    const height = screen.getByLabelText('Height (in)');
    // 175 cm ÷ 2.54 = 68.9 in; limits 120–220 cm → 47.3–86.6 in (rounded inwards)
    expect(height).toHaveValue(68.9);
    expect(height).toHaveAttribute('min', '47.3');
    expect(height).toHaveAttribute('max', '86.6');
    expect(latest.inputs.athlete.heightCm).toBe(175);

    await user.clear(height);
    await user.type(height, '70');
    await user.tab();
    // 70 in × 2.54 = 177.8 cm
    expect(latest.inputs.athlete.heightCm).toBe(177.8);
    expect(height).toHaveValue(70);

    await user.click(screen.getByRole('button', { name: 'kg' }));
    expect(screen.getByLabelText('Height (cm)')).toHaveValue(177.8);
  });

  it('marks heat acclimatisation with a checkbox that raises the heat strain limit', () => {
    // Cycling at 30 km/h indoors without a fan, 21 °C and 40 %: skin wettedness
    // about 0.93, above the 0.85 limit but below 1.0 when acclimatised (ISO 7933).
    renderActivity({ event: { setting: 'indoorNoFan' }, environment: { tempC: 21, humidity: 40 } });
    const estimate = latest.plan.sweat.estimate;
    expect(estimate.wettedness).toBeGreaterThan(0.85);
    expect(estimate.wettedness).toBeLessThanOrEqual(1);
    expect(estimate.uncompensable).toBe(true);

    const box = screen.getByRole('checkbox', { name: 'Heat acclimatised' });
    expect(box).not.toBeChecked();
    expect(description(box)).toMatch(/trained in similar heat for 1–2 weeks/);
    fireEvent.click(box);
    expect(latest.inputs.athlete.acclimatised).toBe(true);
    expect(box).toBeChecked();
    expect(latest.plan.sweat.estimate.uncompensable).toBe(false);
    // The sweat estimate itself does not change.
    expect(latest.plan.sweat.estimate.rateLph).toBe(estimate.rateLph);

    fireEvent.click(box);
    expect(latest.inputs.athlete.acclimatised).toBe(false);
  });
});

describe('ActivityBasics: conditions', () => {
  it('offers the settings and sun levels', () => {
    renderActivity();
    const setting = screen.getByLabelText('Setting');
    expect(setting).toHaveValue('outdoor');
    expect(within(setting).getAllByRole('option').map((o) => [o.value, o.textContent])).toEqual([
      ['outdoor', 'Outdoors'],
      ['indoorFan', 'Indoors with a fan'],
      ['indoorNoFan', 'Indoors without a fan'],
    ]);
    const sun = screen.getByLabelText('Sun');
    expect(sun).toHaveValue('none');
    expect(within(sun).getAllByRole('option').map((o) => [o.value, o.textContent])).toEqual([
      ['none', 'Shade or overcast'],
      ['partly', 'Partly sunny'],
      ['full', 'Full sun'],
    ]);
    expect(sun).not.toHaveAttribute('aria-describedby');
  });

  it('adds the sun load outdoors only and says so indoors', () => {
    renderActivity();
    expect(latest.plan.sweat.estimate.solarGainW).toBe(0);
    fireEvent.change(screen.getByLabelText('Sun'), { target: { value: 'partly' } });
    expect(latest.inputs.environment.sun).toBe('partly');
    const partly = latest.plan.sweat.estimate.solarGainW;
    expect(partly).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Sun'), { target: { value: 'full' } });
    // Research notes (solar_density.py): full sun 150 W/m², partly sunny 75 W/m²: twice the gain
    expect(latest.plan.sweat.estimate.solarGainW).toBeCloseTo(2 * partly, 6);

    fireEvent.change(screen.getByLabelText('Setting'), { target: { value: 'indoorFan' } });
    expect(latest.inputs.event.setting).toBe('indoorFan');
    expect(latest.plan.sweat.estimate.solarGainW).toBe(0);
    // The sun choice is kept for when the session moves outdoors again.
    expect(screen.getByLabelText('Sun')).toHaveValue('full');
    expect(description(screen.getByLabelText('Sun'))).toBe('Sun only counts outdoors.');
    // Spec section 2: indoors with a fan the air moves at 1.5 m/s
    expect(latest.plan.sweat.estimate.airSpeedMs).toBe(1.5);

    fireEvent.change(screen.getByLabelText('Setting'), { target: { value: 'outdoor' } });
    expect(screen.queryByText('Sun only counts outdoors.')).not.toBeInTheDocument();
  });

  it('raises the sweat estimate with the temperature', () => {
    renderActivity({ event: { sport: 'running', speedKmh: 12 } });
    const before = latest.plan.sweat.estimate.rateLph;
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '30' } });
    enter(screen.getByLabelText(/humidity/i), 60);
    // [jay2024] research notes: run 12 km/h at 30 °C/60 % in the shade → 1.59 L/h
    expect(latest.plan.sweat.estimate.rateLph).toBeGreaterThan(before);
    expect(Math.abs(latest.plan.sweat.estimate.rateLph - 1.59)).toBeLessThanOrEqual(0.03);
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

  it('leaves the ingredient warnings to the ingredient list and recipe, but keeps target warnings', () => {
    // No ingredient at all. Manual 130 g/h adds the evidence warnings for the target itself.
    renderActivity({ carbs: { mode: 'manual', manualGPerHour: 130, ingredients: [] } });
    const ids = latest.plan.carbs.warnings.map((w) => w.id);
    expect(ids).toContain('carbs.noIngredients');
    expect(ids).toContain('carbs.aboveStudied');

    const warnings = within(region('Carbohydrate target')).getByRole('list', { name: 'Warnings' });
    // Direct children only: each warning also nests a list of citation links.
    const shown = [...warnings.querySelectorAll(':scope > li')];
    expect(shown).toHaveLength(ids.length - 1);
    expect(shown.map((li) => li.dataset.level)).toEqual(['danger', 'warning']);
    expect(warnings).toHaveTextContent(/120 g\/h/);
    expect(warnings).not.toHaveTextContent(/carb ingredient/i);
  });

  it('leaves the unreachable-ratio warning to the ingredient list', () => {
    // Maltodextrin alone (no fructose) cannot make the 1:0.8 ratio asked for.
    renderActivity({
      carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 0.8 }, ingredients: [{ ref: 3, weight: 100 }] },
    });
    expect(latest.plan.carbs.warnings.map((w) => w.id)).toContain('carbs.ratioNotReachable');
    const carbs = region('Carbohydrate target');
    expect(within(carbs).queryByText(/cannot make/i)).not.toBeInTheDocument();
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
  /**
   * Every form control has a unique id, a label and an accessible name; every
   * `aria-describedby` target exists; ids are unique in the whole card.
   */
  function expectLabelledControls(container, count) {
    const controls = [...container.querySelectorAll('input, select, textarea')];
    expect(controls).toHaveLength(count);
    const ids = controls.map((el) => el.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    for (const el of controls) {
      expect(el.labels.length, `#${el.id} has a label`).toBeGreaterThan(0);
      expect(el).toHaveAccessibleName();
      expect(description(el), `#${el.id} description targets exist`).not.toMatch(/missing/);
    }
    const allIds = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  }

  const everythingOn = {
    carbs: { mode: 'manual' },
    caffeine: { enabled: true, asIngredient: true },
    bicarb: { enabled: true },
  };

  it('gives every form control a unique id and an associated label (cycling)', () => {
    const { container } = renderActivity({ ...everythingOn, event: { durationMin: 180, sport: 'cycling', setting: 'indoorFan' } });
    // duration ×2, intensity, sport, speed, power, mass, height, acclimatised,
    // temperature, humidity, setting, sun, manual carbs, high-carb,
    // caffeine on, mg/kg, as tablets, tablet size, bicarb on, g/kg
    expectLabelledControls(container, 21);
  });

  it('gives every form control a unique id and an associated label (running)', () => {
    const { container } = renderActivity({ ...everythingOn, event: { durationMin: 180, sport: 'running' } });
    // as cycling, without power
    expectLabelledControls(container, 20);
  });

  it('gives every form control a unique id and an associated label (other sport)', () => {
    const { container } = renderActivity({ ...everythingOn, event: { durationMin: 180, sport: 'other' } });
    // as cycling, with METs instead of speed and power
    expectLabelledControls(container, 20);
  });

  it('groups the activity inputs into session, you and conditions', () => {
    renderActivity();
    expect(within(screen.getByRole('group', { name: 'Session' })).getByLabelText('Sport')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'You' })).getByLabelText('Height (cm)')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Conditions' })).getByLabelText('Sun')).toBeInTheDocument();
  });

  it('throws outside the providers', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ActivityBasics />)).toThrow(/must be used inside <PlanProvider>/);
  });
});
