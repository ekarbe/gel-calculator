import { describe, it, expect, afterEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BodyWeatherSection from './BodyWeatherSection';
import BodyWeatherFields, { BodyWeatherMassField, BodyWeatherUnitsField } from './BodyWeatherFields';
import EventSection from './EventSection';
import { PlanProvider, usePlanInputs, usePlan } from '../../state/PlanProvider';
import { UiProvider, PREFS_KEY, useUi } from '../../state/UiProvider';

/** Latest inputs, plan and unit system, captured by <Spy /> on every render. */
const latest = { inputs: null, plan: null, unitSystem: null };

function Spy() {
  const { inputs } = usePlanInputs();
  const plan = usePlan();
  const { unitSystem } = useUi();
  useEffect(() => {
    latest.inputs = inputs;
    latest.plan = plan;
    latest.unitSystem = unitSystem;
  }, [inputs, plan, unitSystem]);
  return null;
}

/**
 * Renders the section with the real providers. Autosave is off, so no test
 * reads inputs that an earlier test left in localStorage. `prefs` are stored
 * before the render, as a returning visitor's.
 */
function renderBody(initialInputs, { prefs, children = <BodyWeatherSection /> } = {}) {
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

const spin = (name) => screen.getByRole('spinbutton', { name });
const mass = () => spin('Body mass');
const height = () => spin('Height');
const temperature = () => spin('Temperature');
const humidity = () => spin('Humidity');
const UNITS = 'Units (whole app)';
const unitRadio = (name) => within(screen.getByRole('radiogroup', { name: UNITS })).getByRole('radio', { name });

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
  latest.unitSystem = null;
});

describe('BodyWeatherSection: layout', () => {
  it('is a region named "Body & weather" with groups for body and weather', () => {
    renderBody();
    const region = screen.getByRole('region', { name: 'Body & weather' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Body & weather' })).toBeInTheDocument();
    const body = within(region).getByRole('group', { name: 'Body' });
    expect(within(body).getByRole('spinbutton', { name: 'Body mass' })).toBeInTheDocument();
    expect(within(body).getByRole('spinbutton', { name: 'Height' })).toBeInTheDocument();
    expect(within(body).getByRole('switch', { name: 'Heat acclimatised' })).toBeInTheDocument();
    const weather = within(region).getByRole('group', { name: 'Weather' });
    expect(within(weather).getByRole('spinbutton', { name: 'Temperature' })).toBeInTheDocument();
    expect(within(weather).getByRole('spinbutton', { name: 'Humidity' })).toBeInTheDocument();
    expect(within(weather).getByLabelText('Sun')).toBeInTheDocument();
  });

  it('puts the app-wide unit switch above the groups, named and described as app-wide', () => {
    renderBody();
    const region = screen.getByRole('region', { name: 'Body & weather' });
    const units = within(region).getByRole('radiogroup', { name: UNITS });
    // Not inside "Body" (it is not a body-mass-only kg/lb toggle) or "Weather".
    expect(within(region).getByRole('group', { name: 'Body' })).not.toContainElement(units);
    expect(within(region).getByRole('group', { name: 'Weather' })).not.toContainElement(units);
    // Not in the body mass label row: the field has no control next to its label.
    expect(mass().closest('div.min-w-0').querySelector('[role="radiogroup"]')).toBeNull();
    // First control of the panel, before body mass.
    const order = units.compareDocumentPosition(mass());
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The visible caption is its name, and the hint says what else it changes.
    expect(screen.getByText(UNITS)).toBeVisible();
    expect(description(units)).toBe('Also changes speed and fluid everywhere. Nutrients stay in g and mg.');
  });

  it('shows the default inputs', () => {
    renderBody();
    expect(mass()).toHaveValue('70');
    expect(mass()).toHaveAttribute('aria-valuetext', '70 kg');
    expect(height()).toHaveValue('175');
    expect(temperature()).toHaveValue('20');
    expect(temperature()).toHaveAttribute('aria-valuetext', '20 °C');
    expect(description(temperature())).toBe('Air temperature in the shade.');
    expect(humidity()).toHaveValue('50');
    expect(humidity()).toHaveAttribute('aria-valuetext', '50 %');
    expect(screen.getByRole('switch', { name: 'Heat acclimatised' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByLabelText('Sun')).toHaveValue('none');
  });

  it('collapses to a one-line summary in the chosen units', async () => {
    const user = userEvent.setup();
    renderBody({ environment: { tempC: 25, humidity: 60 } });
    const toggle = screen.getByRole('button', { name: 'Body & weather' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('70 kg · 25 °C · 60%')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Body mass' })).not.toBeInTheDocument();
    cleanup();

    renderBody({ environment: { tempC: 25, humidity: 60 } }, { prefs: { unitSystem: 'imperial' } });
    await user.click(screen.getByRole('button', { name: 'Body & weather' }));
    // 70 kg = 154.3 lb, 25 °C = 77 °F
    expect(screen.getByText('154.3 lb · 77 °F · 60%')).toBeInTheDocument();
    cleanup();

    // Values typed in imperial are stored with many decimals; the summary rounds them.
    renderBody(
      { athlete: { massKg: 176 * 0.45359237 }, environment: { tempC: (87 - 32) / 1.8, humidity: 55 } },
      { prefs: { unitSystem: 'metric' } },
    );
    await user.click(screen.getByRole('button', { name: 'Body & weather' }));
    expect(screen.getByText('79.8 kg · 30.6 °C · 55%')).toBeInTheDocument();
  });

  it('exports the field groups for the guided flow (no panel around them)', () => {
    renderBody(undefined, { children: <BodyWeatherFields /> });
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(mass()).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: UNITS })).toBeInTheDocument();
    cleanup();

    renderBody(undefined, { children: <BodyWeatherFields unitSwitch={false} /> });
    expect(mass()).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    cleanup();

    // The single fields come without the switch; it is its own export.
    renderBody(undefined, { children: <BodyWeatherMassField /> });
    expect(mass()).toHaveValue('70');
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    cleanup();

    renderBody(undefined, { children: <BodyWeatherUnitsField /> });
    expect(screen.getByRole('radiogroup', { name: UNITS })).toBeInTheDocument();
  });

  it('works without a UiProvider: English, metric and no unit switch', () => {
    render(
      <PlanProvider persist={false}>
        <BodyWeatherSection />
      </PlanProvider>,
    );
    expect(mass()).toHaveAttribute('aria-valuetext', '70 kg');
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('throws outside the providers', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<BodyWeatherSection />)).toThrow(/must be used inside <PlanProvider>/);
  });
});

describe('BodyWeatherSection: body', () => {
  it('shows body mass in lb but stores kg, through the unit switch', async () => {
    const user = userEvent.setup();
    renderBody();
    expect(unitRadio('Metric')).toHaveAttribute('aria-checked', 'true');

    await user.click(unitRadio('Imperial'));
    expect(latest.unitSystem).toBe('imperial');
    expect(unitRadio('Imperial')).toHaveAttribute('aria-checked', 'true');
    expect(mass()).toHaveValue('154.3');
    expect(mass()).toHaveAttribute('aria-valuetext', '154.3 lb');
    expect(latest.inputs.athlete.massKg).toBe(70);
    // The unit system is a UI pref: it is saved for the next visit.
    expect(JSON.parse(window.localStorage.getItem(PREFS_KEY)).unitSystem).toBe('imperial');

    // Typing passes through 1 and 17 lb, below the mass limit; they are not committed.
    await user.clear(mass());
    await user.type(mass(), '176');
    expect(latest.inputs.athlete.massKg).toBeCloseTo(79.83, 2);
    await user.tab();
    expect(mass()).toHaveValue('176');

    await user.click(unitRadio('Metric'));
    expect(mass()).toHaveValue('79.8');
    expect(latest.inputs.athlete.massKg).toBeCloseTo(79.83, 2);
  });

  it('clamps body mass to the input limits on blur', () => {
    renderBody();
    fireEvent.change(mass(), { target: { value: '7' } });
    expect(latest.inputs.athlete.massKg).toBe(70);
    fireEvent.blur(mass());
    expect(latest.inputs.athlete.massKg).toBe(30);
    expect(mass()).toHaveValue('30');
    enter(mass(), 250);
    expect(latest.inputs.athlete.massKg).toBe(200);
  });

  it('sets the height in cm, clamped to the input limits', () => {
    renderBody();
    const field = height();
    expect(field).toHaveValue('175');
    expect(field).toHaveAttribute('aria-valuemin', '120');
    expect(field).toHaveAttribute('aria-valuemax', '220');
    expect(field).not.toHaveAttribute('aria-describedby');
    enter(field, 182);
    expect(latest.inputs.athlete.heightCm).toBe(182);
    enter(field, 300);
    expect(latest.inputs.athlete.heightCm).toBe(220);
    expect(field).toHaveValue('220');
  });

  it('shows the height in inches (and feet and inches) in imperial, but stores cm', async () => {
    const user = userEvent.setup();
    renderBody(undefined, { prefs: { unitSystem: 'imperial' } });
    const field = height();
    // 175 cm ÷ 2.54 = 68.9 in; limits 120–220 cm → 47.2–86.6 in
    expect(field).toHaveValue('68.9');
    expect(field).toHaveAttribute('aria-valuetext', '68.9 in');
    expect(field).toHaveAttribute('aria-valuemin', '47.2');
    expect(field).toHaveAttribute('aria-valuemax', '86.6');
    expect(description(field)).toBe('5 ft 9 in');
    expect(latest.inputs.athlete.heightCm).toBe(175);

    await user.clear(field);
    await user.type(field, '70');
    await user.tab();
    // 70 in × 2.54 = 177.8 cm
    expect(latest.inputs.athlete.heightCm).toBeCloseTo(177.8, 6);
    expect(field).toHaveValue('70');
    expect(description(field)).toBe('5 ft 10 in');

    await user.click(unitRadio('Metric'));
    expect(height()).toHaveValue('177.8');
  });

  it('marks heat acclimatisation with a switch that raises the heat strain limit', async () => {
    const user = userEvent.setup();
    // Cycling at 30 km/h indoors without a fan, 21 °C and 40 %: skin wettedness
    // about 0.93, above the 0.85 limit but below 1.0 when acclimatised (ISO 7933).
    renderBody({ event: { setting: 'indoorNoFan' }, environment: { tempC: 21, humidity: 40 } });
    const estimate = latest.plan.sweat.estimate;
    expect(estimate.wettedness).toBeGreaterThan(0.85);
    expect(estimate.wettedness).toBeLessThanOrEqual(1);
    expect(estimate.uncompensable).toBe(true);

    const toggle = screen.getByRole('switch', { name: 'Heat acclimatised' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(description(toggle)).toMatch(/trained in similar heat for 1–2 weeks/);
    await user.click(toggle);
    expect(latest.inputs.athlete.acclimatised).toBe(true);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(latest.plan.sweat.estimate.uncompensable).toBe(false);
    // The sweat estimate itself does not change.
    expect(latest.plan.sweat.estimate.rateLph).toBe(estimate.rateLph);

    await user.keyboard('{Enter}');
    expect(latest.inputs.athlete.acclimatised).toBe(false);
  });
});

describe('BodyWeatherSection: weather', () => {
  it('shows temperature in °F but stores °C', () => {
    renderBody(undefined, { prefs: { unitSystem: 'imperial' } });
    const field = temperature();
    expect(field).toHaveValue('68');
    expect(field).toHaveAttribute('aria-valuetext', '68 °F');
    expect(field).toHaveAttribute('aria-valuemin', '-4');
    expect(field).toHaveAttribute('aria-valuemax', '122');

    enter(field, 86);
    expect(latest.inputs.environment.tempC).toBe(30);

    fireEvent.click(unitRadio('Metric'));
    expect(temperature()).toHaveValue('30');
    expect(temperature()).toHaveAttribute('aria-valuetext', '30 °C');
  });

  it('takes temperatures below zero and clamps to the limits', () => {
    renderBody();
    enter(temperature(), '-5');
    expect(latest.inputs.environment.tempC).toBe(-5);
    // A real minus sign works too.
    enter(temperature(), '−8');
    expect(latest.inputs.environment.tempC).toBe(-8);
    enter(temperature(), 60);
    expect(latest.inputs.environment.tempC).toBe(50);
  });

  it('asks phones for a keyboard with a minus key for the temperature only', async () => {
    const user = userEvent.setup();
    renderBody(undefined, { prefs: { unitSystem: 'imperial' } });
    // The decimal keypad (iOS) has no minus key; −20 °C is in range.
    expect(temperature()).toHaveAttribute('inputmode', 'text');
    expect(temperature()).not.toHaveAttribute('inputmode', 'decimal');
    // The fields that cannot go below zero keep the decimal keypad.
    for (const field of [mass(), height(), humidity()]) expect(field).toHaveAttribute('inputmode', 'decimal');

    // Typed key by key, a sub-zero temperature reaches the plan: −4 °F = −20 °C.
    await user.clear(temperature());
    await user.type(temperature(), '-4');
    await user.tab();
    expect(latest.inputs.environment.tempC).toBeCloseTo(-20, 6);
    expect(temperature()).toHaveValue('-4');
  });

  it('sets humidity, clamped to 0–100', () => {
    renderBody();
    enter(humidity(), 80);
    expect(latest.inputs.environment.humidity).toBe(80);
    enter(humidity(), 150);
    expect(latest.inputs.environment.humidity).toBe(100);
  });

  it('shows the humidity that is stored and used (fractions kept to 0.1 %)', async () => {
    const user = userEvent.setup();
    renderBody();
    enter(humidity(), 55.5);
    expect(latest.inputs.environment.humidity).toBe(55.5);
    expect(humidity()).toHaveValue('55.5');
    expect(humidity()).toHaveAttribute('aria-valuetext', '55.5 %');

    // More decimals than the field shows are rounded when typed, so field and plan agree.
    enter(humidity(), '55.55');
    expect(latest.inputs.environment.humidity).toBe(55.6);
    expect(humidity()).toHaveValue('55.6');

    // The collapsed summary names the same number.
    await user.click(screen.getByRole('button', { name: 'Body & weather' }));
    expect(screen.getByText('70 kg · 20 °C · 55.6%')).toBeInTheDocument();
    cleanup();

    // A value from a link or autosave is shown as stored.
    renderBody({ environment: { humidity: 62.5 } });
    expect(humidity()).toHaveValue('62.5');
    expect(humidity()).toHaveAttribute('aria-valuetext', '62.5 %');
    expect(latest.inputs.environment.humidity).toBe(62.5);
  });

  it('raises the sweat estimate with the temperature', () => {
    renderBody({ event: { sport: 'running', speedKmh: 12 } });
    const before = latest.plan.sweat.estimate.rateLph;
    enter(temperature(), 30);
    enter(humidity(), 60);
    // [jay2024] research notes: run 12 km/h at 30 °C/60 % in the shade → 1.59 L/h
    expect(latest.plan.sweat.estimate.rateLph).toBeGreaterThan(before);
    expect(Math.abs(latest.plan.sweat.estimate.rateLph - 1.59)).toBeLessThanOrEqual(0.03);
  });

  it('offers the sun levels', () => {
    renderBody();
    const sun = screen.getByLabelText('Sun');
    expect(within(sun).getAllByRole('option').map((o) => [o.value, o.textContent])).toEqual([
      ['none', 'Shade or overcast'],
      ['partly', 'Partly sunny'],
      ['full', 'Full sun'],
    ]);
    expect(sun).not.toHaveAttribute('aria-describedby');
  });

  it('matches the running reference in full sun: 12 km/h, 20 °C, 50 % → 1.27 L/h', () => {
    // [jay2024] [gagnon2013] research notes scenario table (final_model.py)
    renderBody({ event: { sport: 'running', speedKmh: 12 } });
    fireEvent.change(screen.getByLabelText('Sun'), { target: { value: 'full' } });
    expect(latest.inputs.environment.sun).toBe('full');
    expect(Math.abs(latest.plan.sweat.estimate.rateLph - 1.27)).toBeLessThanOrEqual(0.03);
  });

  it('adds the sun load outdoors only and says so indoors (setting in the Event section)', () => {
    renderBody(undefined, {
      children: (
        <>
          <EventSection />
          <BodyWeatherSection />
        </>
      ),
    });
    expect(latest.plan.sweat.estimate.solarGainW).toBe(0);
    fireEvent.change(screen.getByLabelText('Sun'), { target: { value: 'partly' } });
    expect(latest.inputs.environment.sun).toBe('partly');
    const partly = latest.plan.sweat.estimate.solarGainW;
    expect(partly).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Sun'), { target: { value: 'full' } });
    // Research notes (solar_density.py): full sun 150 W/m², partly sunny 75 W/m²: twice the gain
    expect(latest.plan.sweat.estimate.solarGainW).toBeCloseTo(2 * partly, 6);

    fireEvent.change(screen.getByLabelText('Setting'), { target: { value: 'indoorFan' } });
    expect(latest.plan.sweat.estimate.solarGainW).toBe(0);
    // The sun choice is kept for when the session moves outdoors again.
    expect(screen.getByLabelText('Sun')).toHaveValue('full');
    expect(description(screen.getByLabelText('Sun'))).toBe('Sun only counts outdoors.');

    fireEvent.change(screen.getByLabelText('Setting'), { target: { value: 'outdoor' } });
    expect(screen.queryByText('Sun only counts outdoors.')).not.toBeInTheDocument();
  });
});

describe('BodyWeatherSection: language', () => {
  it('reads and writes numbers in German', async () => {
    const user = userEvent.setup();
    renderBody(undefined, { prefs: { locale: 'de' } });
    const massDe = () => spin('Körpergewicht');
    await user.clear(massDe());
    await user.type(massDe(), '72,5');
    await user.tab();
    expect(latest.inputs.athlete.massKg).toBe(72.5);
    expect(massDe()).toHaveValue('72,5');
    expect(massDe()).toHaveAttribute('aria-valuetext', '72,5 kg');
  });
});

describe('BodyWeatherSection: accessibility', () => {
  it('gives every control a unique id, a label and existing description targets', () => {
    const { container } = renderBody({ event: { setting: 'indoorFan' } }, { prefs: { unitSystem: 'imperial' } });
    // mass, height, temperature, humidity, sun
    const controls = [...container.querySelectorAll('input, select, textarea')];
    expect(controls).toHaveLength(5);
    const ids = controls.map((el) => el.id);
    expect(ids.every(Boolean)).toBe(true);
    for (const el of controls) {
      expect(el.labels.length, `#${el.id} has a label`).toBeGreaterThan(0);
      expect(el).toHaveAccessibleName();
      expect(description(el), `#${el.id} description targets exist`).not.toMatch(/missing/);
    }
    const allIds = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(allIds).size).toBe(allIds.length);
    for (const button of container.querySelectorAll('button')) expect(button).toHaveAccessibleName();
  });

  it('keeps the unit switch to one tab stop with arrow keys', async () => {
    const user = userEvent.setup();
    renderBody();
    unitRadio('Metric').focus();
    await user.keyboard('{ArrowRight}');
    expect(unitRadio('Imperial')).toHaveFocus();
    expect(latest.unitSystem).toBe('imperial');
    expect(mass()).toHaveAttribute('aria-valuetext', '154.3 lb');
  });
});
