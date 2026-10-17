import { describe, it, expect, afterEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import SweatSection from './SweatSection';
import { PlanProvider, usePlan, usePlanInputs } from '../../state/PlanProvider';
import { UiProvider, PREFS_KEY, useUi } from '../../state/UiProvider';
import { computePlan } from '../../domain/plan';
import { roundTo } from '../../domain/units';
import { createFormat } from '../../i18n/formatters';

/** Shows the current inputs so tests can check what the section stored. */
function InputsProbe() {
  const { inputs } = usePlanInputs();
  return <pre data-testid="inputs">{JSON.stringify(inputs)}</pre>;
}

/** Shows the plan targets the sweat rate drives (they live in other sections). */
function PlanProbe() {
  const plan = usePlan();
  return <pre data-testid="plan">{JSON.stringify({ sodium: plan.sodium.mgPerHour, fluid: plan.fluid.mlPerHour })}</pre>;
}

/** Hands the latest `useUi()` to the test, to switch units and language. */
function Capture({ uiRef }) {
  const api = useUi();
  useEffect(() => {
    uiRef.current = api;
  });
  return null;
}

const METRIC = { locale: 'en', unitSystem: 'metric', currency: 'EUR', mode: 'expert' };
const IMPERIAL = { ...METRIC, unitSystem: 'imperial', currency: 'USD' };

/**
 * Renders the section with the real providers (the app's order). Autosave is
 * off, and the prefs are stored first: jsdom's `navigator.language` is en-US,
 * which would otherwise pick imperial units.
 */
function renderSection(initialInputs, { prefs = METRIC, props = {} } = {}) {
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  const ui = { current: null };
  const view = render(
    <PlanProvider initialInputs={initialInputs} persist={false}>
      <UiProvider>
        <div data-testid="section">
          <SweatSection {...props} />
        </div>
        <InputsProbe />
        <PlanProbe />
        <Capture uiRef={ui} />
      </UiProvider>
    </PlanProvider>,
  );
  return { ...view, ui };
}

const readInputs = () => JSON.parse(screen.getByTestId('inputs').textContent);
const readPlan = () => JSON.parse(screen.getByTestId('plan').textContent);
const sweat = () => screen.getByRole('region', { name: 'Sweat' });
const tab = (name) => within(sweat()).getByRole('tab', { name });
/** The value of a fact (`<dt>` term → `<dd>`) inside `scope`. */
const fact = (scope, term) => within(scope).getByText(term, { selector: 'dt' }).nextElementSibling;
const summary = () => screen.getByTestId('sweat-summary');
const projection = () => screen.getByRole('group', { name: 'Projected body-mass change' });

/** Default event conditions (30 km/h ride, outdoors, 20 °C, 50%, shade). */
const CONDITIONS = {
  sport: 'cycling',
  speedKmh: 30,
  powerW: 0,
  mets: 8,
  setting: 'outdoor',
  tempC: 20,
  humidity: 50,
  sun: 'none',
};

/** A sweat test: 1 kg lost and 0.5 L drunk in 60 min → 1.5 L/h raw, 1.36 L/h after the fuel correction. */
const HOT_RIDE = {
  id: 't1',
  date: '2026-09-01',
  label: 'Hot ride',
  preKg: 70,
  postKg: 69,
  fluidL: 0.5,
  urineL: 0,
  durationMin: 60,
  conditions: CONDITIONS,
};

/** 0.5 kg lost and 0.5 L drunk in 60 min → 0.86 L/h. */
const COOL_RIDE = { ...HOT_RIDE, id: 't2', date: '2026-09-08', label: 'Cool ride', postKg: 69.5 };

afterEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

describe('SweatSection', () => {
  it('shows the default plan from the real domain (heat-balance estimate)', () => {
    renderSection();
    const section = sweat();
    expect(within(section).getByRole('heading', { level: 2, name: 'Sweat' })).toBeInTheDocument();
    // One h2 (the shell lists the setup sections by their h2 text); every inner heading is h3.
    expect(within(section).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Sweat']);
    expect(within(section).getByTestId('sweat-header-rate')).toHaveTextContent('0.33 L/h');

    // Sweat: 30 km/h ride in 20 °C shade for 70 kg/175 cm → 0.33 L/h (dry heat loss at 3 m/s).
    expect(within(section).getByRole('tablist', { name: 'Sweat source' })).toBeInTheDocument();
    expect(tab('Estimate')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Test')).toHaveAttribute('aria-selected', 'false');
    expect(tab('Presets')).toHaveAttribute('aria-selected', 'false');
    const panel = within(section).getByRole('tabpanel', { name: 'Estimate' });
    const estimate = within(panel).getByTestId('sweat-estimate-panel');
    expect(within(estimate).getByTestId('sweat-estimate')).toHaveTextContent('0.33 L/h ± 0.5 L/h');
    expect(fact(estimate, 'Heat production')).toHaveTextContent('631 W');
    expect(fact(estimate, 'Energy use')).toHaveTextContent('678 kcal/h');
    expect(fact(estimate, 'Heat to lose by sweating')).toHaveTextContent('220 W');
    expect(within(estimate).getByTestId('sweat-estimate-conditions')).toHaveTextContent(
      'Uses: Cycling at 30 km/h (about 158 W), outdoors, 20 °C, 50% humidity, shade or overcast. Change these under Event and Body & weather.',
    );
    expect(within(estimate).queryByTestId('sweat-estimate-capped')).not.toBeInTheDocument();
    expect(within(section).queryByLabelText('Sweat rate')).not.toBeInTheDocument();

    // Saltiness: the level is named with its sodium; the hint describes it.
    const saltiness = within(section).getByLabelText('Sweat saltiness');
    expect(saltiness).toHaveValue('2');
    expect(within(saltiness).getByRole('option', { name: 'Moderate salt content (920 mg/L)' })).toBeInTheDocument();
    expect(within(saltiness).getAllByRole('option')).toHaveLength(6);
    expect(saltiness).toHaveAccessibleDescription('Clearly salty taste, visible white marks on dried clothing.');

    // What the plan uses.
    expect(summary()).toHaveAttribute('data-source', 'estimate');
    expect(within(summary()).getByTestId('sweat-rate-used')).toHaveTextContent('0.33 L/h');
    expect(within(summary()).getByTestId('sweat-rate-range')).toHaveTextContent('likely 0–0.83 L/h');
    expect(within(summary()).getByTestId('sweat-sodium')).toHaveTextContent('920 mg/L');
    expect(within(summary()).getByTestId('sweat-summary-source')).toHaveTextContent('From the estimate');
    expect(within(section).queryByRole('list', { name: 'Warnings' })).not.toBeInTheDocument();

    // Projected body mass: 0.23 L water deficit plus 0.2 g/kcal of 678 kcal/h over 3 h.
    expect(within(projection()).getByRole('heading', { level: 3 })).toHaveTextContent('Projected body-mass change');
    expect(within(projection()).getByTestId('body-mass-scale')).toHaveTextContent('−0.6 kg');
    expect(fact(projection(), 'Water lost')).toHaveTextContent('0.23 L (0.3% of body mass)');
    const level = within(projection()).getByTestId('body-mass-level');
    expect(level).toHaveTextContent('Up to 2% loss');
    expect(level).toHaveAttribute('data-level', 'ok');
  });

  it('collapses and expands, keeping the rate in the title row', () => {
    renderSection();
    const toggle = within(sweat()).getByRole('button', { name: 'Sweat' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const body = document.getElementById(toggle.getAttribute('aria-controls'));
    expect(body).toBeVisible();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(body).not.toBeVisible();
    expect(within(sweat()).queryByRole('tablist')).not.toBeInTheDocument();
    expect(within(sweat()).getByTestId('sweat-header-rate')).toBeVisible();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(sweat()).getByRole('tablist')).toBeInTheDocument();
  });

  it('can be rendered open and fixed at another heading level', () => {
    renderSection(undefined, { props: { collapsible: false, headingLevel: 3 } });
    const heading = within(sweat()).getByRole('heading', { level: 3, name: 'Sweat' });
    expect(within(heading).queryByRole('button')).not.toBeInTheDocument();
    expect(within(projection()).getByRole('heading', { level: 4 })).toBeInTheDocument();
  });

  it('switches the sweat source with the arrow keys (tabs)', () => {
    renderSection();
    tab('Estimate').focus();
    fireEvent.keyDown(tab('Estimate'), { key: 'ArrowRight' });
    expect(readInputs().sweat.source).toBe('preset');
    expect(tab('Presets')).toHaveFocus();
    expect(tab('Presets')).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(tab('Presets'), { key: 'ArrowRight' });
    expect(readInputs().sweat.source).toBe('test');
    expect(within(sweat()).getByRole('tabpanel', { name: 'Test' })).toContainElement(screen.getByTestId('sweat-test-panel'));
    fireEvent.keyDown(tab('Test'), { key: 'End' });
    expect(readInputs().sweat.source).toBe('preset');
    fireEvent.keyDown(tab('Presets'), { key: 'Home' });
    expect(readInputs().sweat.source).toBe('test');
  });

  it('uses a sweat rate preset and recomputes the targets and the projection', () => {
    renderSection();
    fireEvent.click(tab('Presets'));
    expect(readInputs().sweat.source).toBe('preset');
    expect(tab('Presets')).toHaveAttribute('aria-selected', 'true');
    expect(within(sweat()).queryByTestId('sweat-estimate-panel')).not.toBeInTheDocument();

    const rate = within(sweat()).getByLabelText('Sweat rate');
    expect(rate).toHaveValue('2');
    expect(within(rate).getByRole('option', { name: 'Active sweating (1.25 L/h)' })).toBeInTheDocument();
    expect(within(rate).getByRole('option', { name: 'Light sweating (0.25 L/h)' })).toBeInTheDocument();
    expect(rate).toHaveAccessibleDescription('Clothing shows distinct wet patches, sweat begins to drip occasionally.');
    expect(within(summary()).getByTestId('sweat-rate-used')).toHaveTextContent('1.25 L/h');
    expect(within(summary()).getByTestId('sweat-rate-range')).toHaveTextContent('likely 0.75–1.75 L/h');
    expect(within(summary()).getByTestId('sweat-summary-source')).toHaveTextContent('From your self-assessment');
    // 180 min, 1.25 L/h, 40 mmol/L → 570 mg/h; fluid 80% capped at 800 ml/h.
    expect(readPlan()).toEqual({ sodium: 570, fluid: 800 });
    // (1.25 − 0.8) × 3 = 1.35 L (1.9%); scale −1.35 − 0.41 = −1.8 kg.
    expect(within(projection()).getByTestId('body-mass-scale')).toHaveTextContent('−1.8 kg');
    expect(within(projection()).getByTestId('body-mass-water')).toHaveTextContent('1.35 L (1.9% of body mass)');
    expect(within(projection()).getByTestId('body-mass-level')).toHaveAttribute('data-level', 'ok');

    // 2.25 L/h: (2.25 − 0.8) × 3 = 4.35 L, 6.2% of 70 kg.
    fireEvent.change(rate, { target: { value: '4' } });
    expect(readInputs().sweat.rateIndex).toBe(4);
    expect(within(projection()).getByTestId('body-mass-level')).toHaveTextContent('Over 3% loss');
    expect(within(projection()).getByTestId('body-mass-level')).toHaveAttribute('data-level', 'high');
    expect(within(projection()).getByTestId('body-mass-water')).toHaveTextContent('4.35 L (6.2% of body mass)');

    // 0.25 L/h: half the loss is below the 300 mg/h floor; fluid 200 ml/h.
    fireEvent.change(rate, { target: { value: '0' } });
    expect(readPlan()).toEqual({ sodium: 300, fluid: 200 });
    expect(rate).toHaveAccessibleDescription('Skin feels slightly damp.');

    // 70 mmol/L is salty sweat: range 300–1000, half of 2012 mg/h → 1000 mg/h.
    fireEvent.change(rate, { target: { value: '2' } });
    fireEvent.change(within(sweat()).getByLabelText('Sweat saltiness'), { target: { value: '4' } });
    expect(readInputs().sweat.saltinessIndex).toBe(4);
    expect(readPlan().sodium).toBe(1000);
    expect(within(summary()).getByTestId('sweat-sodium')).toHaveTextContent('1,609 mg/L');
  });

  it('explains saltiness in a disclosure instead of a tooltip', () => {
    renderSection();
    const about = within(sweat()).getByRole('button', { name: 'About sweat saltiness' });
    expect(about).toHaveAttribute('aria-expanded', 'false');
    const text = within(sweat()).getByText(/Most athletes lose 0\.5–1\.5 g of sodium per litre/);
    expect(text).not.toBeVisible();
    fireEvent.click(about);
    expect(about).toHaveAttribute('aria-expanded', 'true');
    expect(text).toBeVisible();
  });

  it('warns about uncompensable heat and shows the conditions in the unit system', () => {
    // Running 12 km/h in 35 °C, 80% humidity and full sun: wettedness about 2.
    const { ui } = renderSection({
      event: { sport: 'running', speedKmh: 12 },
      environment: { tempC: 35, humidity: 80, sun: 'full' },
    });
    const estimate = screen.getByTestId('sweat-estimate-panel');
    expect(within(estimate).getByTestId('sweat-estimate')).toHaveTextContent('2.77 L/h ± 0.5 L/h');
    expect(within(estimate).getByTestId('sweat-estimate-capped')).toHaveTextContent(
      'This is the most the model allows for your body size (2.77 L/h).',
    );
    expect(within(estimate).getByTestId('sweat-estimate-conditions')).toHaveTextContent(
      'Uses: Running at 12 km/h, outdoors, 35 °C, 80% humidity, full sun.',
    );
    const warnings = within(sweat()).getByRole('list', { name: 'Warnings' });
    const danger = within(warnings).getByText(/your body cannot lose all the heat it makes/);
    expect(danger.closest('li')).toHaveAttribute('data-level', 'danger');

    act(() => ui.current.setUnitSystem('imperial'));
    expect(within(estimate).getByTestId('sweat-estimate-conditions')).toHaveTextContent(
      'Uses: Running at 7.5 mph, outdoors, 95 °F, 80% humidity, full sun.',
    );
    // 2.77 L = 93.7 US fl oz, 0.5 L = 16.9 fl oz.
    expect(within(estimate).getByTestId('sweat-estimate')).toHaveTextContent('94 fl oz/h ± 17 fl oz/h');
    expect(within(sweat()).getByTestId('sweat-header-rate')).toHaveTextContent('94 fl oz/h');

    // Heat stress does not depend on how the sweat rate was found.
    fireEvent.click(tab('Presets'));
    expect(within(sweat()).getByText(/your body cannot lose all the heat it makes/)).toBeInTheDocument();
  });

  it('shows the heat balance details behind a disclosure', () => {
    renderSection();
    const details = within(sweat()).getByRole('button', { name: 'Heat balance details' });
    expect(details).toHaveAttribute('aria-expanded', 'false');
    const air = screen.getByTestId('sweat-estimate-air');
    expect(air).not.toBeVisible();
    fireEvent.click(details);
    expect(air).toBeVisible();
    // Riding at 30 km/h outdoors: the air moves at the riding speed.
    expect(air).toHaveTextContent('30 km/h');
    // ... but heat lost to the air is counted at the ISO 7933 limit of 3 m/s, and the panel says so.
    expect(screen.getByTestId('sweat-estimate-dry-air')).toHaveTextContent(
      'Heat lost to the air and heat from the sun are counted at an air speed of at most 10.8 km/h, the limit of the ISO 7933 heat-stress standard. Evaporation of sweat uses the full air speed.',
    );
    for (const term of ['Skin temperature', 'Heat lost to the air', 'Heat lost by breathing', 'Heat from the sun']) {
      expect(fact(screen.getByTestId('sweat-estimate-panel'), term)).toBeVisible();
    }
    expect(fact(screen.getByTestId('sweat-estimate-panel'), 'Heat from the sun')).toHaveTextContent('0 W');
    // 20 °C air is cooler than the skin: the body loses heat to it.
    const lost = roundTo(computePlan().sweat.estimate.dryHeatLossW, 0);
    expect(lost).toBeGreaterThan(0);
    expect(screen.getByTestId('sweat-estimate-dry')).toHaveTextContent(`${lost} W`);
  });

  it('names the heat from air hotter than the skin a gain, without a negative number', () => {
    const hot = { event: { sport: 'running', speedKmh: 10 }, environment: { tempC: 40, sun: 'full' } };
    const dryW = roundTo(computePlan(hot).sweat.estimate.dryHeatLossW, 0);
    expect(dryW).toBeLessThan(0);
    renderSection(hot);
    fireEvent.click(within(sweat()).getByRole('button', { name: 'Heat balance details' }));
    const panel = screen.getByTestId('sweat-estimate-panel');
    expect(fact(panel, 'Heat gained from the air')).toHaveTextContent(new RegExp(`^${-dryW} W$`));
    expect(within(panel).queryByText('Heat lost to the air')).not.toBeInTheDocument();
    expect(screen.getByTestId('sweat-estimate-dry').textContent).not.toMatch(/[−-]/);
    // Running is not capped: no note about a lower air speed for the dry heat flow.
    expect(screen.queryByTestId('sweat-estimate-dry-air')).not.toBeInTheDocument();
  });

  it('explains the sweat rate with citations', () => {
    renderSection({ sweat: { source: 'preset' } });
    const why = within(summary()).getByRole('button', { name: /why/i });
    expect(why).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'true');
    expect(within(summary()).getByText(/You picked a sweat rate of 1.25 L\/h/)).toBeVisible();
    expect(within(summary()).getByRole('link', { name: /Baker/ })).toHaveAttribute('href', expect.stringContaining('https://doi.org/'));

    fireEvent.click(tab('Estimate'));
    expect(within(summary()).getByText(/Your estimated sweat rate is 0.33 L\/h/)).toBeVisible();
    expect(within(summary()).getByRole('link', { name: /Gagnon/ })).toBeInTheDocument();
  });

  it('adds a sweat test with the form and uses it, scaled to the event', () => {
    renderSection();
    fireEvent.click(tab('Test'));
    expect(readInputs().sweat.source).toBe('test');
    const panel = within(sweat()).getByTestId('sweat-test-panel');
    expect(within(panel).getByText('No sweat tests yet.')).toBeInTheDocument();
    // No test yet: the plan uses the estimate and says so.
    expect(within(sweat()).getByText(/You have no sweat test yet/)).toBeInTheDocument();
    expect(summary()).toHaveAttribute('data-source', 'estimate');
    expect(within(summary()).getByTestId('sweat-summary-source')).toHaveTextContent('From the estimate');

    fireEvent.click(within(panel).getByRole('button', { name: 'Add a sweat test' }));
    const form = within(panel).getByRole('form', { name: 'Add a sweat test' });
    // The heading takes the focus, not the date field (iOS would open its date picker at once).
    expect(within(form).getByRole('heading', { level: 3, name: 'Add a sweat test' })).toHaveFocus();
    expect(within(form).getByText(/Empty your bladder\. Weigh yourself in little or no clothing\./)).toBeInTheDocument();
    const date = within(form).getByLabelText('Date');
    expect(date).not.toHaveFocus();
    expect(date.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Conditions start from the current inputs.
    expect(within(form).getByLabelText('Sport')).toHaveValue('cycling');
    expect(within(form).getByLabelText('Speed')).toHaveValue('30');
    expect(within(form).getByLabelText('Speed')).toHaveAttribute('aria-valuetext', '30 km/h');
    expect(within(form).getByLabelText('Power')).toHaveValue('0');
    expect(within(form).getByLabelText('Power')).toHaveAccessibleDescription('0 = estimate from speed');
    expect(within(form).getByLabelText('Setting')).toHaveValue('outdoor');
    expect(within(form).getByLabelText('Temperature')).toHaveValue('20');
    // A test below 0 °C needs the minus key, which the phone decimal keypad lacks.
    expect(within(form).getByLabelText('Temperature')).toHaveAttribute('inputmode', 'text');
    expect(within(form).getByLabelText('Humidity')).toHaveValue('50');
    expect(within(form).getByLabelText('Sun')).toHaveValue('none');
    expect(within(form).getByLabelText('Duration')).toHaveValue('60');
    // The body masses start empty, so their unit is in the accessible name (the visible suffix is hidden from it).
    const preMass = within(form).getByRole('spinbutton', { name: 'Body mass before (kg)' });
    expect(preMass).toHaveValue('');
    expect(preMass).not.toHaveAttribute('aria-valuetext');
    expect(within(form).getByRole('spinbutton', { name: 'Body mass after (kg)' })).toHaveValue('');
    expect(within(form).getByText('Body mass before', { selector: 'label' })).toBeVisible();
    expect(within(form).getByRole('button', { name: 'Increase Body mass before' })).toBeInTheDocument();
    expect(within(form).getByTestId('sweat-test-preview')).toHaveTextContent('Enter your body mass before and after the session.');

    fireEvent.change(date, { target: { value: '2026-10-01' } });
    fireEvent.change(within(form).getByLabelText('Name (optional)'), { target: { value: 'Hot ride ' } });
    fireEvent.change(within(form).getByLabelText('Body mass before (kg)'), { target: { value: '70' } });
    fireEvent.change(within(form).getByLabelText('Body mass after (kg)'), { target: { value: '69' } });
    fireEvent.change(within(form).getByLabelText('Fluid drunk'), { target: { value: '0.5' } });
    // (70 − 69 + 0.5) / 1 h − 0.2 g/kcal × 678 kcal = 1.36 L/h.
    expect(within(form).getByTestId('sweat-test-preview')).toHaveTextContent('This test gives 1.36 L/h of sweat.');
    // The plan does not change before the test is saved.
    expect(readInputs().sweat.tests).toEqual([]);

    fireEvent.click(within(form).getByRole('button', { name: 'Save test' }));
    expect(within(panel).queryByRole('form')).not.toBeInTheDocument();
    expect(readInputs().sweat).toMatchObject({
      tests: [
        {
          id: 't1',
          date: '2026-10-01',
          label: 'Hot ride',
          preKg: 70,
          postKg: 69,
          fluidL: 0.5,
          urineL: 0,
          durationMin: 60,
          conditions: CONDITIONS,
        },
      ],
      selectedTestId: 't1',
      calibrate: true,
    });
    const radio = within(panel).getByRole('radio', { name: 'Hot ride' });
    expect(radio).toBeChecked();
    expect(radio).toHaveFocus();
    expect(within(panel).getByRole('group', { name: 'Test to use' })).toContainElement(radio);
    const item = within(panel).getByTestId('sweat-test-t1');
    expect(within(item).getByText('In use')).toBeInTheDocument();
    expect(within(item).getByTestId('sweat-test-result')).toHaveTextContent('Measured 1.36 L/h');
    expect(item).toHaveTextContent('Oct 1, 2026 · 60 min · Cycling at 30 km/h, outdoors, 20 °C, 50% humidity, shade or overcast');

    // [baker2017] The test was done in the event's own conditions (the form's default), so scaling
    // to the event keeps the measured 1.36 L/h, although the model predicts only 0.33 L/h.
    expect(summary()).toHaveAttribute('data-source', 'test');
    expect(within(summary()).getByTestId('sweat-rate-used')).toHaveTextContent('1.36 L/h');
    expect(within(summary()).getByTestId('sweat-rate-range')).toHaveTextContent('likely 1.21–1.51 L/h');
    expect(within(summary()).getByTestId('sweat-summary-source')).toHaveTextContent('From your sweat test');
    expect(within(sweat()).queryByRole('list', { name: 'Warnings' })).not.toBeInTheDocument();
    expect(within(panel).getByTestId('sweat-calibration')).toHaveTextContent(
      'Measured 1.36 L/h. Scaled to this event: 1.36 L/h (factor 1).',
    );

    // Without scaling the plan uses the measured rate as it is.
    const calibrate = within(panel).getByRole('switch', { name: 'Scale the test to this event' });
    expect(calibrate).toBeChecked();
    expect(calibrate).toHaveAccessibleDescription(/Scale the test to the event conditions/);
    fireEvent.click(calibrate);
    expect(readInputs().sweat.calibrate).toBe(false);
    expect(calibrate).not.toBeChecked();
    expect(within(summary()).getByTestId('sweat-rate-used')).toHaveTextContent('1.36 L/h');
    expect(within(panel).getByTestId('sweat-calibration')).toHaveTextContent('Measured 1.36 L/h, used as it is.');
    // (1.36 − 0.8) × 3 h = 1.69 L, 2.4% of 70 kg.
    expect(within(projection()).getByTestId('body-mass-level')).toHaveTextContent('2–3% loss');
    expect(within(projection()).getByTestId('body-mass-level')).toHaveAttribute('data-level', 'mild');
    expect(within(projection()).getByTestId('body-mass-water')).toHaveTextContent('1.69 L (2.4% of body mass)');
  });

  it('warns when the event conditions are too far from the test to scale it fully', () => {
    // Test at 20 °C shade, event at 32 °C in full sun: the model says more than twice the sweat.
    renderSection({ sweat: { source: 'test', tests: [HOT_RIDE] }, environment: { tempC: 32, sun: 'full' } });
    const warnings = within(sweat()).getByRole('list', { name: 'Warnings' });
    expect(warnings).toHaveTextContent('Your sweat test was done in very different conditions from this event.');
    // 1.36 L/h × 2 = 2.73 L/h, now as rough as the model (±0.5 L/h).
    expect(within(summary()).getByTestId('sweat-rate-used')).toHaveTextContent('2.73 L/h');
    expect(within(summary()).getByTestId('sweat-rate-range')).toHaveTextContent('likely 2.23–3.23 L/h');
    expect(screen.getByTestId('sweat-calibration')).toHaveTextContent(
      'Measured 1.36 L/h. Scaled to this event: 2.73 L/h (factor 2, at its limit).',
    );
  });

  it('edits a sweat test, and Cancel keeps it unchanged', () => {
    renderSection({ sweat: { source: 'test', tests: [HOT_RIDE], calibrate: false } });
    const panel = screen.getByTestId('sweat-test-panel');
    const edit = within(panel).getByRole('button', { name: 'Edit Hot ride' });

    fireEvent.click(edit);
    let form = within(panel).getByRole('form', { name: 'Edit sweat test' });
    expect(within(form).getByLabelText('Name (optional)')).toHaveValue('Hot ride');
    expect(within(form).getByLabelText('Body mass before (kg)')).toHaveValue('70');
    expect(within(form).getByLabelText('Body mass after (kg)')).toHaveValue('69');
    expect(within(form).getByLabelText('Fluid drunk')).toHaveValue('0.5');
    expect(within(form).getByLabelText('Date')).toHaveValue('2026-09-01');
    fireEvent.change(within(form).getByLabelText('Body mass after (kg)'), { target: { value: '68.5' } });
    expect(within(form).getByTestId('sweat-test-preview')).toHaveTextContent('1.86 L/h');
    fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }));
    expect(within(panel).queryByRole('form')).not.toBeInTheDocument();
    expect(readInputs().sweat.tests).toEqual([HOT_RIDE]);
    expect(within(panel).getByRole('button', { name: 'Edit Hot ride' })).toHaveFocus();

    // Escape cancels too.
    fireEvent.click(within(panel).getByRole('button', { name: 'Edit Hot ride' }));
    fireEvent.keyDown(within(panel).getByLabelText('Body mass after (kg)'), { key: 'Escape' });
    expect(within(panel).queryByRole('form')).not.toBeInTheDocument();
    expect(readInputs().sweat.tests).toEqual([HOT_RIDE]);

    fireEvent.click(within(panel).getByRole('button', { name: 'Edit Hot ride' }));
    form = within(panel).getByRole('form', { name: 'Edit sweat test' });
    fireEvent.change(within(form).getByLabelText('Name (optional)'), { target: { value: 'Long ride' } });
    fireEvent.change(within(form).getByLabelText('Body mass after (kg)'), { target: { value: '68.5' } });
    fireEvent.change(within(form).getByLabelText('Sport'), { target: { value: 'running' } });
    expect(within(form).queryByLabelText('Power')).not.toBeInTheDocument();
    // A 30 km/h ride as a run would be 2:00 min/km: the form takes a typical running speed.
    expect(within(form).getByLabelText('Speed')).toHaveValue('11');
    fireEvent.click(within(form).getByRole('button', { name: 'Save test' }));

    const [saved] = readInputs().sweat.tests;
    expect(saved).toEqual({
      ...HOT_RIDE,
      label: 'Long ride',
      postKg: 68.5,
      conditions: { ...CONDITIONS, sport: 'running', speedKmh: 11 },
    });
    expect(within(panel).getByRole('button', { name: 'Edit Long ride' })).toHaveFocus();
    expect(within(panel).getByRole('radio', { name: 'Long ride' })).toBeChecked();
    // The plan uses the edited test (running conditions change the fuel correction).
    const rate = computePlan(readInputs()).sweat.rateLph;
    const before = computePlan({ sweat: { source: 'test', tests: [HOT_RIDE], calibrate: false } }).sweat.rateLph;
    expect(rate).not.toBeCloseTo(before);
    expect(within(summary()).getByTestId('sweat-rate-used')).toHaveTextContent(
      `${roundTo(rate, 2).toLocaleString('en-US', { maximumFractionDigits: 2 })} L/h`,
    );
    expect(summary()).toHaveAttribute('data-source', 'test');
  });

  it('saves what a field shows when Enter submits the form without leaving the field', () => {
    renderSection({ sweat: { source: 'test' } });
    const panel = screen.getByTestId('sweat-test-panel');
    fireEvent.click(within(panel).getByRole('button', { name: 'Add a sweat test' }));
    const form = within(panel).getByRole('form');
    const pre = within(form).getByLabelText('Body mass before (kg)');
    const post = within(form).getByLabelText('Body mass after (kg)');
    fireEvent.change(post, { target: { value: '69' } });

    // In range: committed while typing, and Enter (a submit with the focus in the field) saves it.
    // Out of range (700 kg): the field clamps it to 300 kg when the form is submitted, and the form
    // stays open so the user sees the corrected value; the next Enter saves it.
    pre.focus();
    for (const value of ['7', '70', '700']) fireEvent.change(pre, { target: { value } });
    expect(pre).toHaveValue('700');
    fireEvent.submit(form);
    expect(within(panel).getByRole('form')).toBeInTheDocument();
    expect(readInputs().sweat.tests).toEqual([]);
    expect(pre).toHaveValue('300');
    expect(pre).toHaveFocus();

    // Duration 1500 min is above the 1440 min limit: the same.
    const duration = within(form).getByLabelText('Duration');
    duration.focus();
    for (const value of ['1', '15', '150', '1500']) fireEvent.change(duration, { target: { value } });
    fireEvent.submit(form);
    expect(readInputs().sweat.tests).toEqual([]);
    expect(duration).toHaveValue('1440');
    expect(duration).toHaveFocus();

    // Text that is no number: the field goes back to its value and the save waits too.
    const speed = within(form).getByLabelText('Speed');
    speed.focus();
    fireEvent.change(speed, { target: { value: '' } });
    fireEvent.submit(form);
    expect(speed).toHaveValue('30');
    expect(speed).toHaveFocus();
    expect(readInputs().sweat.tests).toEqual([]);

    // A number in range is saved at once, even when the field rewrites it ("69.50" → "69.5").
    post.focus();
    fireEvent.change(post, { target: { value: '69.50' } });
    fireEvent.submit(form);
    expect(within(panel).queryByRole('form')).not.toBeInTheDocument();
    expect(readInputs().sweat.tests).toMatchObject([
      { preKg: 300, postKg: 69.5, durationMin: 1440, conditions: { speedKmh: 30 } },
    ]);
  });

  it('saves a body mass typed with a lone comma as its decimal when the grouped number is out of range', () => {
    // An English page on an iPhone set to a comma region: the decimal keypad types "70,250" for 70.25 kg.
    renderSection({ sweat: { source: 'test' } });
    const panel = screen.getByTestId('sweat-test-panel');
    fireEvent.click(within(panel).getByRole('button', { name: 'Add a sweat test' }));
    const form = within(panel).getByRole('form');
    fireEvent.change(within(form).getByLabelText('Body mass after (kg)'), { target: { value: '69' } });
    const pre = within(form).getByLabelText('Body mass before (kg)');
    pre.focus();
    fireEvent.change(pre, { target: { value: '70,250' } });
    fireEvent.submit(form);
    expect(within(panel).queryByRole('form')).not.toBeInTheDocument();
    expect(readInputs().sweat.tests).toMatchObject([{ preKg: 70.25, postKg: 69 }]);
  });

  it('deletes a sweat test only after an in-page confirmation', () => {
    renderSection({ sweat: { source: 'test', tests: [HOT_RIDE, COOL_RIDE], selectedTestId: 't1' } });
    const panel = screen.getByTestId('sweat-test-panel');
    const remove = within(panel).getByRole('button', { name: 'Delete Hot ride' });
    // Not a disclosure: pressing it moves the focus into the confirmation, it does not toggle it.
    expect(remove).not.toHaveAttribute('aria-expanded');

    fireEvent.click(remove);
    expect(remove).not.toHaveAttribute('aria-expanded');
    let confirm = within(panel).getByRole('group', { name: 'Delete Hot ride? You cannot undo this.' });
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(readInputs().sweat.tests).toHaveLength(2);

    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(within(panel).queryByRole('group', { name: /Delete Hot ride/ })).not.toBeInTheDocument();
    expect(remove).toHaveFocus();
    expect(readInputs().sweat.tests).toHaveLength(2);

    // Escape cancels, and the handler marks the event as handled (a dialog around it stays open).
    fireEvent.click(remove);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => {
      within(panel).getByRole('button', { name: 'Yes, delete' }).dispatchEvent(escape);
    });
    expect(escape.defaultPrevented).toBe(true);
    expect(within(panel).queryByRole('button', { name: 'Yes, delete' })).not.toBeInTheDocument();
    expect(remove).toHaveFocus();

    fireEvent.click(remove);
    confirm = within(panel).getByRole('group', { name: 'Delete Hot ride? You cannot undo this.' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Yes, delete' }));
    expect(readInputs().sweat.tests).toEqual([COOL_RIDE]);
    // The deleted test was selected: the plan now uses the last test.
    expect(readInputs().sweat.selectedTestId).toBeNull();
    expect(within(panel).queryByText('Hot ride')).not.toBeInTheDocument();
    // Focus goes to the neighbouring test (the next one).
    expect(within(panel).getByRole('radio', { name: 'Cool ride' })).toBeChecked();
    expect(within(panel).getByRole('radio', { name: 'Cool ride' })).toHaveFocus();

    // With no test left, focus goes to Add.
    fireEvent.click(within(panel).getByRole('button', { name: 'Delete Cool ride' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Yes, delete' }));
    expect(readInputs().sweat.tests).toEqual([]);
    expect(within(panel).getByRole('button', { name: 'Add a sweat test' })).toHaveFocus();
  });

  it('moves the focus to the previous test when the last one is deleted', () => {
    renderSection({ sweat: { source: 'test', tests: [HOT_RIDE, COOL_RIDE] } });
    const panel = screen.getByTestId('sweat-test-panel');
    fireEvent.click(within(panel).getByRole('button', { name: 'Delete Cool ride' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Yes, delete' }));
    expect(readInputs().sweat.tests).toEqual([HOT_RIDE]);
    expect(within(panel).getByRole('radio', { name: 'Hot ride' })).toHaveFocus();
  });

  it('keeps the focus on the page when a test is deleted while the form is open', () => {
    // The Add form is open (it replaces the Add button).
    let view = renderSection({ sweat: { source: 'test', tests: [HOT_RIDE, COOL_RIDE] } });
    let panel = screen.getByTestId('sweat-test-panel');
    fireEvent.click(within(panel).getByRole('button', { name: 'Add a sweat test' }));
    expect(within(panel).queryByRole('button', { name: 'Add a sweat test' })).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Delete Cool ride' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Yes, delete' }));
    expect(readInputs().sweat.tests).toEqual([HOT_RIDE]);
    expect(within(panel).getByRole('form', { name: 'Add a sweat test' })).toBeInTheDocument();
    expect(within(panel).getByRole('radio', { name: 'Hot ride' })).toHaveFocus();
    // The only test goes too: the focus moves to the open form's heading.
    fireEvent.click(within(panel).getByRole('button', { name: 'Delete Hot ride' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Yes, delete' }));
    expect(readInputs().sweat.tests).toEqual([]);
    expect(within(panel).getByRole('heading', { level: 3, name: 'Add a sweat test' })).toHaveFocus();
    view.unmount();

    // Another test is being edited.
    view = renderSection({ sweat: { source: 'test', tests: [HOT_RIDE, COOL_RIDE] } });
    panel = screen.getByTestId('sweat-test-panel');
    fireEvent.click(within(panel).getByRole('button', { name: 'Edit Hot ride' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Delete Cool ride' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Yes, delete' }));
    expect(readInputs().sweat.tests).toEqual([HOT_RIDE]);
    expect(within(panel).getByRole('form', { name: 'Edit sweat test' })).toBeInTheDocument();
    expect(within(panel).getByRole('radio', { name: 'Hot ride' })).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it('closes the form when the test being edited is deleted', () => {
    renderSection({ sweat: { source: 'test', tests: [HOT_RIDE, COOL_RIDE] } });
    const panel = screen.getByTestId('sweat-test-panel');
    fireEvent.click(within(panel).getByRole('button', { name: 'Edit Hot ride' }));
    expect(within(panel).getByRole('form')).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Delete Hot ride' }));
    // Asking to delete closes nothing yet; the form stays until the delete is confirmed.
    fireEvent.click(within(panel).getByRole('button', { name: 'Yes, delete' }));
    expect(within(panel).queryByRole('form')).not.toBeInTheDocument();
    expect(readInputs().sweat.tests).toEqual([COOL_RIDE]);
    expect(within(panel).getByRole('radio', { name: 'Cool ride' })).toHaveFocus();
  });

  it('selects which sweat test the plan uses', () => {
    renderSection({ sweat: { source: 'test', tests: [HOT_RIDE, COOL_RIDE], calibrate: false } });
    const panel = screen.getByTestId('sweat-test-panel');
    // No selection means the last test.
    expect(within(panel).getByRole('radio', { name: 'Cool ride' })).toBeChecked();
    expect(within(panel).getByRole('radio', { name: 'Hot ride' })).not.toBeChecked();
    expect(within(within(panel).getByTestId('sweat-test-t2')).getByText('In use')).toBeInTheDocument();
    expect(within(within(panel).getByTestId('sweat-test-t1')).queryByText('In use')).not.toBeInTheDocument();
    expect(within(summary()).getByTestId('sweat-rate-used')).toHaveTextContent('0.86 L/h');
    // Arrowing through the tests tells them apart: each radio is described by its date, conditions and rate.
    const conditions = 'Cycling at 30 km/h, outdoors, 20 °C, 50% humidity, shade or overcast';
    expect(within(panel).getByRole('radio', { name: 'Cool ride' })).toHaveAccessibleDescription(
      `In use Sep 8, 2026 · 60 min · ${conditions} Measured 0.86 L/h`,
    );
    expect(within(panel).getByRole('radio', { name: 'Hot ride' })).toHaveAccessibleDescription(
      `Sep 1, 2026 · 60 min · ${conditions} Measured 1.36 L/h`,
    );

    fireEvent.click(within(panel).getByRole('radio', { name: 'Hot ride' }));
    expect(readInputs().sweat.selectedTestId).toBe('t1');
    expect(within(panel).getByRole('radio', { name: 'Hot ride' })).toBeChecked();
    expect(within(within(panel).getByTestId('sweat-test-t1')).getByText('In use')).toBeInTheDocument();
    expect(within(summary()).getByTestId('sweat-rate-used')).toHaveTextContent('1.36 L/h');
  });

  it('shows what is wrong with a test and falls back to the estimate', () => {
    const unfinished = { ...HOT_RIDE, label: '', date: '', postKg: 0 };
    renderSection({ sweat: { source: 'test', tests: [unfinished] } });
    const panel = screen.getByTestId('sweat-test-panel');
    // A test without a label gets a name from its position.
    const item = within(panel).getByTestId('sweat-test-t1');
    expect(within(panel).getByRole('radio', { name: 'Sweat test 1' })).toBeChecked();
    expect(item).toHaveTextContent('No date · 60 min');
    expect(within(item).getByTestId('sweat-test-result')).toHaveTextContent(
      'Cannot be used: Enter your body mass before and after the session.',
    );
    expect(within(item).queryByText('In use')).not.toBeInTheDocument();
    // A screen reader hears it on the radio too.
    expect(within(panel).getByRole('radio', { name: 'Sweat test 1' })).toHaveAccessibleDescription(
      /^No date · 60 min · .* Cannot be used: Enter your body mass before and after the session\.$/,
    );
    const warning = within(sweat()).getByText(/Your selected sweat test cannot be used/);
    expect(warning.closest('li')).toHaveAttribute('data-level', 'warning');
    expect(summary()).toHaveAttribute('data-source', 'estimate');
    expect(within(panel).queryByTestId('sweat-calibration')).not.toBeInTheDocument();
  });

  it('enters a sweat test in pounds, fl oz and °F and stores kg, L and °C', () => {
    renderSection({ sweat: { source: 'test' } }, { prefs: IMPERIAL });
    const panel = screen.getByTestId('sweat-test-panel');
    fireEvent.click(within(panel).getByRole('button', { name: 'Add a sweat test' }));
    const form = within(panel).getByRole('form');
    // The empty body masses name their unit.
    expect(within(form).getByRole('spinbutton', { name: 'Body mass before (lb)' })).toHaveValue('');
    expect(within(form).getByRole('spinbutton', { name: 'Body mass after (lb)' })).toHaveValue('');
    expect(within(form).getByLabelText('Temperature')).toHaveValue('68');
    expect(within(form).getByLabelText('Temperature')).toHaveAttribute('aria-valuetext', '68 °F');
    expect(within(form).getByLabelText('Speed')).toHaveValue('18.6');
    expect(within(form).getByLabelText('Speed')).toHaveAttribute('aria-valuetext', '18.6 mph');
    fireEvent.change(within(form).getByLabelText('Body mass before (lb)'), { target: { value: '154.3' } });
    fireEvent.change(within(form).getByLabelText('Body mass after (lb)'), { target: { value: '152.1' } });
    expect(within(form).getByLabelText('Body mass after (lb)')).toHaveAttribute('aria-valuetext', '152.1 lb');
    fireEvent.change(within(form).getByLabelText('Fluid drunk'), { target: { value: '16.9' } });
    fireEvent.change(within(form).getByLabelText('Temperature'), { target: { value: '77' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save test' }));

    const [test] = readInputs().sweat.tests;
    expect(test.preKg).toBe(69.989);
    expect(test.postKg).toBe(68.991);
    // 16.9 US fl oz = 499.8 ml, kept to the ml.
    expect(test.fluidL).toBe(0.5);
    expect(test.conditions.tempC).toBe(25);
    // A field the user did not touch keeps its metric value exactly.
    expect(test.conditions.speedKmh).toBe(30);
    expect(within(panel).getByTestId('sweat-test-t1')).toHaveTextContent('18.6 mph, outdoors, 77 °F, 50% humidity');
    const rate = roundTo(computePlan(readInputs()).sweat.tests[0].rateLph, 2);
    expect(within(panel).getByTestId('sweat-test-result')).toHaveTextContent(
      `Measured ${createFormat('en', { unitSystem: 'imperial' }).volumeL(rate)}/h`,
    );
    expect(within(panel).getByTestId('sweat-test-result')).toHaveTextContent(/fl oz\/h$/);

    // The projection follows the unit system too.
    expect(within(projection()).getByTestId('body-mass-scale')).toHaveTextContent(/ lb$/);
  });

  it('shows the projected scale change in pounds and the water in fl oz', () => {
    renderSection(undefined, { prefs: IMPERIAL });
    // −0.637 kg = −1.40 lb; 0.23 L = 7.8 fl oz; 0.83 L/h = 28 fl oz/h.
    expect(within(projection()).getByTestId('body-mass-scale')).toHaveTextContent('−1.4 lb');
    expect(within(projection()).getByTestId('body-mass-water')).toHaveTextContent('7.8 fl oz (0.3% of body mass)');
    expect(within(summary()).getByTestId('sweat-rate-range')).toHaveTextContent('likely 0–28 fl oz/h');
  });

  it('shows a projected weight gain without a negative loss', () => {
    renderSection({ sweat: { source: 'preset' }, fluid: { mode: 'manual', manualMlPerHour: 1500 } });
    // (1.25 − 1.5) × 3 = −0.75 L; the scale rises by 0.75 − 0.41 = 0.3 kg.
    const level = within(projection()).getByTestId('body-mass-level');
    expect(level).toHaveTextContent('Weight gain');
    expect(level).toHaveAttribute('data-level', 'gain');
    expect(within(projection()).getByTestId('body-mass-scale')).toHaveTextContent('+0.3 kg');
    expect(fact(projection(), 'Water gained')).toHaveTextContent('0.75 L (1.1% of body mass)');
    expect(within(projection()).queryByText('Water lost')).not.toBeInTheDocument();
  });

  it('keeps at most 20 sweat tests', () => {
    const tests = Array.from({ length: 20 }, (_, i) => ({ ...HOT_RIDE, id: `t${i + 1}`, label: `Test ${i + 1}` }));
    renderSection({ sweat: { source: 'test', tests } });
    const panel = screen.getByTestId('sweat-test-panel');
    expect(within(panel).getAllByRole('radio')).toHaveLength(20);
    expect(within(panel).getByRole('button', { name: 'Add a sweat test' })).toBeDisabled();
    expect(within(panel).getByText('You can keep up to 20 tests. Delete one to add another.')).toBeInTheDocument();
  });

  it('formats numbers and reads typed numbers in German', () => {
    // German text (every key has a German twin, so nothing falls back) and German numbers.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderSection({ sweat: { source: 'test' } }, { prefs: { ...METRIC, locale: 'de' } });
    expect(within(summary()).getByTestId('sweat-rate-used')).toHaveTextContent('0,33 L/h');
    expect(within(summary()).getByTestId('sweat-rate-range')).toHaveTextContent('0–0,83 L/h');
    const projectionDe = screen.getByRole('group', { name: 'Erwartete Gewichtsänderung' });
    expect(within(projectionDe).getByTestId('body-mass-water')).toHaveTextContent('0,23 L (0,3 % des Körpergewichts)');

    const panel = screen.getByTestId('sweat-test-panel');
    fireEvent.click(within(panel).getByRole('button', { name: 'Schweißtest hinzufügen' }));
    const form = within(panel).getByRole('form');
    fireEvent.change(within(form).getByLabelText('Körpergewicht vorher (kg)'), { target: { value: '70,5' } });
    fireEvent.change(within(form).getByLabelText('Körpergewicht nachher (kg)'), { target: { value: '69,5' } });
    fireEvent.change(within(form).getByLabelText('Getrunkene Flüssigkeit'), { target: { value: '0,5' } });
    expect(within(form).getByTestId('sweat-test-preview')).toHaveTextContent(/1,36 L\/h/);
    fireEvent.click(within(form).getByRole('button', { name: 'Test speichern' }));
    expect(readInputs().sweat.tests[0]).toMatchObject({ preKg: 70.5, postKg: 69.5, fluidL: 0.5 });
    expect(within(panel).getByTestId('sweat-test-result')).toHaveTextContent('1,36 L/h');
    expect(warn).not.toHaveBeenCalled();
  });

  it('gives every form control a unique id and a label', () => {
    const check = () => {
      const section = screen.getByTestId('section');
      const controls = section.querySelectorAll('input, select, textarea');
      expect(controls.length).toBeGreaterThan(0);
      for (const control of controls) {
        expect(control.id, control.outerHTML).not.toBe('');
        expect(control.labels.length, control.outerHTML).toBeGreaterThan(0);
        expect(control.labels[0].textContent.trim(), control.outerHTML).not.toBe('');
      }
      const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
      expect(new Set(ids).size).toBe(ids.length);
      // Every aria reference points at an element that exists.
      for (const el of section.querySelectorAll('[aria-controls], [aria-labelledby], [aria-describedby]')) {
        for (const attr of ['aria-controls', 'aria-labelledby', 'aria-describedby']) {
          for (const ref of (el.getAttribute(attr) ?? '').split(/\s+/).filter(Boolean)) {
            expect(document.getElementById(ref), `${attr}=${ref}`).not.toBeNull();
          }
        }
      }
    };

    let view = renderSection();
    check();
    view.unmount();

    view = renderSection({ sweat: { source: 'preset' } });
    check();
    view.unmount();

    renderSection({ sweat: { source: 'test', tests: [HOT_RIDE, COOL_RIDE] } });
    const panel = screen.getByTestId('sweat-test-panel');
    fireEvent.click(within(panel).getByRole('button', { name: 'Delete Cool ride' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Edit Hot ride' }));
    expect(within(panel).getByRole('form')).toBeInTheDocument();
    check();
    // Every condition field of the other sports too.
    fireEvent.change(within(panel).getByLabelText('Sport'), { target: { value: 'other' } });
    fireEvent.change(within(panel).getByLabelText('Setting'), { target: { value: 'indoorFan' } });
    expect(within(panel).getByLabelText('Effort')).toHaveAttribute('aria-valuetext', '8 METs');
    expect(within(panel).queryByLabelText('Sun')).not.toBeInTheDocument();
    expect(within(panel).queryByLabelText('Speed')).not.toBeInTheDocument();
    check();
  });

  it('keeps two sections on one page apart', () => {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(METRIC));
    render(
      <PlanProvider initialInputs={{ sweat: { source: 'test', tests: [HOT_RIDE] } }} persist={false}>
        <UiProvider>
          <SweatSection />
          <SweatSection />
        </UiProvider>
      </PlanProvider>,
    );
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(screen.getAllByRole('region', { name: 'Sweat' })).toHaveLength(2);
  });
});
