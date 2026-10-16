import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ElectrolytesHydration from './ElectrolytesHydration';
import { PlanProvider, usePlanInputs } from '../../state/PlanProvider';
import { UiProvider, useUi } from '../../state/UiProvider';
import { encodeShareState } from '../../state/shareCodec';
import { INPUT_LIMITS, computePlan } from '../../domain/plan';

/** Shows the current inputs so tests can check what the card stored. */
function InputsProbe() {
  const { inputs } = usePlanInputs();
  return <pre data-testid="inputs">{JSON.stringify(inputs)}</pre>;
}

/** Lets a test switch the display units. */
function UnitButtons() {
  const { setTempUnit, setMassUnit } = useUi();
  return (
    <>
      <button type="button" onClick={() => setTempUnit('F')}>
        Use Fahrenheit
      </button>
      <button type="button" onClick={() => setMassUnit('lb')}>
        Use pounds
      </button>
    </>
  );
}

/**
 * Renders the card with the real providers. Autosave is off (`persist`), so
 * no test sees inputs another test saved.
 */
function renderCard(initialInputs) {
  return render(
    <UiProvider>
      <PlanProvider initialInputs={initialInputs} persist={false}>
        <div data-testid="card">
          <ElectrolytesHydration />
        </div>
        <InputsProbe />
        <UnitButtons />
      </PlanProvider>
    </UiProvider>,
  );
}

const readInputs = () => JSON.parse(screen.getByTestId('inputs').textContent);
const region = (name) => screen.getByRole('region', { name });
const pressed = (scope, name) => within(scope).getByRole('button', { name });
/** The value of a fact (`<dt>` term → `<dd>`) inside `scope`. */
const fact = (scope, term) => within(scope).getByText(term, { selector: 'dt' }).nextElementSibling;

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
});

describe('ElectrolytesHydration', () => {
  it('shows the default plan from the real domain (heat-balance estimate)', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'Electrolytes & Hydration' })).toBeInTheDocument();

    // Sweat: 30 km/h ride in 20 °C shade for 70 kg/175 cm → 0.15 L/h (final_model.py).
    const sweat = region('Sweat');
    expect(pressed(sweat, 'Estimate')).toHaveAttribute('aria-pressed', 'true');
    expect(pressed(sweat, 'Test')).toHaveAttribute('aria-pressed', 'false');
    expect(pressed(sweat, 'Presets')).toHaveAttribute('aria-pressed', 'false');
    const estimate = within(sweat).getByTestId('sweat-estimate-panel');
    expect(within(estimate).getByTestId('sweat-estimate')).toHaveTextContent('0.15 L/h ± 0.5 L/h');
    expect(fact(estimate, 'Heat production')).toHaveTextContent('631 W');
    expect(fact(estimate, 'Energy use')).toHaveTextContent('678 kcal/h');
    expect(fact(estimate, 'Heat to lose by sweating')).toHaveTextContent('101 W');
    expect(within(estimate).getByTestId('sweat-estimate-conditions')).toHaveTextContent(
      'Uses: Cycling at 30 km/h (about 158 W), outdoors, 20 °C, 50% humidity, shade or overcast. Change these in Activity Basics.',
    );
    expect(within(sweat).queryByLabelText('Sweat Rate')).not.toBeInTheDocument();
    const saltiness = within(sweat).getByLabelText('Sweat Saltiness');
    expect(saltiness).toHaveValue('2');
    expect(within(saltiness).getByRole('option', { name: 'Moderate salt content (920 mg/L)' })).toBeInTheDocument();
    const summary = within(sweat).getByTestId('sweat-summary');
    expect(summary).toHaveTextContent('Sweat rate used: 0.15 L/h (likely 0–0.65 L/h). Sweat sodium: 920 mg/L.');
    expect(summary).toHaveAttribute('data-source', 'estimate');
    expect(within(sweat).queryByRole('list', { name: 'Warnings' })).not.toBeInTheDocument();

    // Sodium: the 300 mg/h floor of 2–4 h events; little fluid makes it concentrated.
    const sodium = region('Sodium target');
    expect(within(sodium).getByTestId('sodium-value')).toHaveTextContent('300 mg/h');
    expect(within(sodium).getByText('300–600 mg/h')).toBeInTheDocument();
    expect(within(sodium).getByText('about 138 mg/h')).toBeInTheDocument();
    expect(within(sodium).getByText('900 mg in total')).toBeInTheDocument();
    const sodiumWarnings = within(sodium).getByRole('list', { name: 'Warnings' });
    expect(within(sodiumWarnings).getByText(/about 3,000 mg of sodium per litre/)).toBeInTheDocument();

    // Salts: auto, table salt for the whole activity, shown with formatAmount (2290 mg → 2.3 g).
    const salts = region('Salts');
    const list = within(salts).getByRole('list', { name: 'Salt amounts for the whole activity' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText('Sodium Chloride (Table Salt)')).toBeInTheDocument();
    expect(within(list).getByText('2.3 g')).toBeInTheDocument();
    const table = within(salts).getByRole('table', { name: 'Delivered vs target (whole activity)' });
    const sodiumRow = within(table).getByRole('row', { name: /sodium/i });
    expect(within(sodiumRow).getAllByText('900 mg')).toHaveLength(2);
    expect(within(sodiumRow).getByText('On target')).toHaveAttribute('data-status', 'met');

    // Fluid: 80% of 0.15 L/h, rounded to 100 ml/h.
    const fluid = region('Fluid');
    expect(within(fluid).getByTestId('fluid-value')).toHaveTextContent('100 ml/h');
    expect(within(fluid).getByText('400–800 ml/h')).toBeInTheDocument();
    expect(within(fluid).getByText('about 150 ml/h')).toBeInTheDocument();
    expect(within(fluid).getByText('0.3 L in total')).toBeInTheDocument();
    expect(within(fluid).queryByTestId('drink-to-thirst')).not.toBeInTheDocument();

    // Projected body mass: 0.15 L water deficit plus 0.2 g/kcal of 678 kcal/h over 3 h.
    const projection = within(fluid).getByRole('group', { name: 'Projected body-mass change' });
    expect(within(projection).getByTestId('body-mass-scale')).toHaveTextContent('−0.6 kg');
    expect(fact(projection, 'Water lost')).toHaveTextContent('0.15 L (0.2% of body mass)');
    const level = within(projection).getByTestId('body-mass-level');
    expect(level).toHaveTextContent('Up to 2% loss');
    expect(level).toHaveAttribute('data-level', 'ok');
    expect(within(fluid).queryByRole('list', { name: 'Warnings' })).not.toBeInTheDocument();
  });

  it('uses a sweat rate preset and recomputes the targets and the projection', () => {
    renderCard();
    const sweat = region('Sweat');
    fireEvent.click(pressed(sweat, 'Presets'));
    expect(readInputs().sweat.source).toBe('preset');
    expect(within(sweat).queryByTestId('sweat-estimate-panel')).not.toBeInTheDocument();

    const rate = within(sweat).getByLabelText('Sweat Rate');
    expect(rate).toHaveValue('2');
    expect(within(rate).getByRole('option', { name: 'Active sweating (1.25 L/h)' })).toBeInTheDocument();
    expect(
      within(sweat).getByText('Active sweating: Clothing shows distinct wet patches, sweat begins to drip occasionally'),
    ).toBeInTheDocument();
    expect(within(sweat).getByTestId('sweat-summary')).toHaveTextContent(
      'Sweat rate used: 1.25 L/h (likely 0.75–1.75 L/h). Sweat sodium: 920 mg/L.',
    );
    // 180 min, 1.25 L/h, 40 mmol/L → 570 mg/h; fluid 80% capped at 800 ml/h.
    expect(screen.getByTestId('sodium-value')).toHaveTextContent('570 mg/h');
    expect(screen.getByTestId('fluid-value')).toHaveTextContent('800 ml/h');
    // (1.25 − 0.8) × 3 = 1.35 L (1.9%); scale −1.35 − 0.41 = −1.8 kg.
    const fluid = region('Fluid');
    expect(within(fluid).getByTestId('body-mass-scale')).toHaveTextContent('−1.8 kg');
    expect(within(fluid).getByTestId('body-mass-water')).toHaveTextContent('1.35 L (1.9% of body mass)');
    expect(within(fluid).getByTestId('body-mass-level')).toHaveAttribute('data-level', 'ok');

    // 2.25 L/h: (2.25 − 0.8) × 3 = 4.35 L, 6.2% of 70 kg.
    fireEvent.change(rate, { target: { value: '4' } });
    expect(readInputs().sweat.rateIndex).toBe(4);
    expect(within(fluid).getByTestId('body-mass-level')).toHaveTextContent('Over 3% loss');
    expect(within(fluid).getByTestId('body-mass-level')).toHaveAttribute('data-level', 'high');
    const warning = within(within(fluid).getByRole('list', { name: 'Warnings' })).getByText(
      /lose about 4\.4 L of water, 6\.2% of your body mass/,
    );
    expect(warning.closest('li')).toHaveAttribute('data-level', 'warning');

    // 0.25 L/h: half the loss is below the 300 mg/h floor; fluid 200 ml/h.
    fireEvent.change(rate, { target: { value: '0' } });
    expect(screen.getByTestId('sodium-value')).toHaveTextContent('300 mg/h');
    expect(screen.getByTestId('fluid-value')).toHaveTextContent('200 ml/h');
    expect(screen.getByText('Light sweating: Skin feels slightly damp')).toBeInTheDocument();

    // 70 mmol/L is salty sweat: range 300–1000, half of 2012 mg/h → 1000 mg/h.
    fireEvent.change(rate, { target: { value: '2' } });
    fireEvent.change(within(sweat).getByLabelText('Sweat Saltiness'), { target: { value: '4' } });
    expect(readInputs().sweat.saltinessIndex).toBe(4);
    expect(screen.getByTestId('sodium-value')).toHaveTextContent('1,000 mg/h');
    expect(within(region('Sodium target')).getByText('300–1,000 mg/h')).toBeInTheDocument();
  });

  it('warns about uncompensable heat and shows the conditions in the display unit', () => {
    // Running 12 km/h in 35 °C, 80% humidity and full sun: wettedness about 2.
    renderCard({ event: { sport: 'running', speedKmh: 12 }, environment: { tempC: 35, humidity: 80, sun: 'full' } });
    const sweat = region('Sweat');
    const estimate = within(sweat).getByTestId('sweat-estimate-panel');
    expect(within(estimate).getByTestId('sweat-estimate')).toHaveTextContent('2.77 L/h ± 0.5 L/h');
    expect(within(estimate).getByText('This is the most the model allows for your body size (2.77 L/h).')).toBeInTheDocument();
    expect(within(estimate).getByTestId('sweat-estimate-conditions')).toHaveTextContent(
      'Uses: Running at 12 km/h, outdoors, 35 °C, 80% humidity, full sun.',
    );
    const danger = within(within(sweat).getByRole('list', { name: 'Warnings' })).getByText(
      /your body cannot lose all the heat it makes/,
    );
    expect(danger.closest('li')).toHaveAttribute('data-level', 'danger');

    fireEvent.click(screen.getByRole('button', { name: 'Use Fahrenheit' }));
    expect(within(estimate).getByTestId('sweat-estimate-conditions')).toHaveTextContent('95 °F');

    // Heat stress does not depend on how the sweat rate was found.
    fireEvent.click(pressed(sweat, 'Presets'));
    expect(within(sweat).getByText(/your body cannot lose all the heat it makes/)).toBeInTheDocument();
  });

  it('explains the sweat, sodium and fluid targets with citations', () => {
    renderCard({ sweat: { source: 'preset' } });
    const sodium = region('Sodium target');
    const why = within(sodium).getByRole('button', { name: /why/i });
    expect(why).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(sodium).getByText(
        'For 2–4 h, take 300–600 mg/h of sodium. You lose about 1,150 mg/h in sweat. The plan starts from half of that and keeps it in the range. Your target is 570 mg/h.',
      ),
    ).toBeVisible();
    expect(within(sodium).getByRole('link', { name: /McCubbin/ })).toHaveAttribute(
      'href',
      expect.stringContaining('https://doi.org/'),
    );

    const fluid = region('Fluid');
    fireEvent.click(within(fluid).getByRole('button', { name: /why/i }));
    expect(within(fluid).getByText(/Drink about 800 ml\/h\. This replaces roughly 80% of your sweat loss of 1,250 ml\/h/)).toBeVisible();

    const sweat = region('Sweat');
    fireEvent.click(within(sweat).getByRole('button', { name: /why/i }));
    expect(within(sweat).getByText(/You picked a sweat rate of 1.25 L\/h/)).toBeVisible();

    fireEvent.click(pressed(sweat, 'Estimate'));
    expect(within(sweat).getByText(/Your estimated sweat rate is 0.15 L\/h/)).toBeInTheDocument();
    expect(within(sweat).getByRole('link', { name: /Gagnon/ })).toBeInTheDocument();
  });

  it('adds a sweat test with the form and uses it, scaled to the event', () => {
    renderCard();
    const sweat = region('Sweat');
    fireEvent.click(pressed(sweat, 'Test'));
    expect(readInputs().sweat.source).toBe('test');
    const panel = within(sweat).getByTestId('sweat-test-panel');
    expect(within(panel).getByText('No sweat tests yet.')).toBeInTheDocument();
    // No test yet: the plan uses the estimate and says so.
    expect(within(sweat).getByText(/You have no sweat test yet/)).toBeInTheDocument();
    expect(within(sweat).getByTestId('sweat-summary')).toHaveAttribute('data-source', 'estimate');

    fireEvent.click(within(panel).getByRole('button', { name: 'Add a sweat test' }));
    const form = within(panel).getByRole('form', { name: 'Add a sweat test' });
    expect(within(form).getByText(/Empty your bladder\. Weigh yourself in little or no clothing\./)).toBeInTheDocument();
    const date = within(form).getByLabelText('Date');
    expect(date).toHaveFocus();
    expect(date.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Conditions start from the current inputs.
    expect(within(form).getByLabelText('Sport')).toHaveValue('cycling');
    expect(within(form).getByLabelText('Speed (km/h)')).toHaveValue(30);
    expect(within(form).getByLabelText('Power (W)')).toHaveValue(0);
    expect(within(form).getByLabelText('Setting')).toHaveValue('outdoor');
    expect(within(form).getByLabelText('Temperature (°C)')).toHaveValue(20);
    expect(within(form).getByLabelText('Humidity (%)')).toHaveValue(50);
    expect(within(form).getByLabelText('Sun')).toHaveValue('none');
    expect(within(form).getByLabelText('Duration (min)')).toHaveValue(60);
    expect(within(form).getByTestId('sweat-test-preview')).toHaveTextContent(
      'Enter your body mass before and after the session.',
    );

    fireEvent.change(date, { target: { value: '2026-10-01' } });
    fireEvent.change(within(form).getByLabelText('Name (optional)'), { target: { value: 'Hot ride ' } });
    fireEvent.change(within(form).getByLabelText('Body mass before (kg)'), { target: { value: '70' } });
    fireEvent.change(within(form).getByLabelText('Body mass after (kg)'), { target: { value: '69' } });
    fireEvent.change(within(form).getByLabelText('Fluid drunk (L)'), { target: { value: '0.5' } });
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
    const item = within(panel).getByTestId('sweat-test-t1');
    expect(within(item).getByText('In use')).toBeInTheDocument();
    expect(within(item).getByTestId('sweat-test-result')).toHaveTextContent('Measured 1.36 L/h');
    expect(item).toHaveTextContent('2026-10-01 · 60 min · Cycling at 30 km/h, outdoors, 20 °C, 50% humidity');

    // [baker2017] The test was done in the event's own conditions (the form's default), so scaling
    // to the event keeps the measured 1.36 L/h, although the model predicts only 0.15 L/h.
    const summary = within(sweat).getByTestId('sweat-summary');
    expect(summary).toHaveAttribute('data-source', 'test');
    expect(summary).toHaveTextContent('Sweat rate used: 1.36 L/h (likely 1.21–1.51 L/h).');
    expect(within(sweat).queryByRole('list', { name: 'Warnings' })).not.toBeInTheDocument();
    expect(within(panel).getByTestId('sweat-calibration')).toHaveTextContent(
      'Measured 1.36 L/h. Scaled to this event: 1.36 L/h (factor 1).',
    );

    // Without scaling the plan uses the measured rate as it is.
    const calibrate = within(panel).getByRole('switch', { name: 'Scale the test to this event' });
    expect(calibrate).toBeChecked();
    expect(calibrate).toHaveAccessibleDescription(/Scale the test to the event conditions/);
    fireEvent.click(calibrate);
    expect(readInputs().sweat.calibrate).toBe(false);
    expect(summary).toHaveTextContent('Sweat rate used: 1.36 L/h (likely 1.21–1.51 L/h).');
    expect(within(panel).getByTestId('sweat-calibration')).toHaveTextContent('Measured 1.36 L/h, used as it is.');
    // (1.36 − 0.8) × 3 h = 1.69 L, 2.4% of 70 kg.
    const fluid = region('Fluid');
    expect(within(fluid).getByTestId('body-mass-level')).toHaveTextContent('2–3% loss');
    expect(within(fluid).getByText(/lose about 1\.7 L of water, 2\.4% of your body mass/)).toBeInTheDocument();
  });

  it('warns when the event conditions are too far from the test to scale it fully', () => {
    // Test at 20 °C shade, event at 32 °C in full sun: the model says more than twice the sweat.
    renderCard({ sweat: { source: 'test', tests: [HOT_RIDE] }, environment: { tempC: 32, sun: 'full' } });
    const sweat = region('Sweat');
    const warnings = within(sweat).getByRole('list', { name: 'Warnings' });
    expect(warnings).toHaveTextContent('Your sweat test was done in very different conditions from this event.');
    // 1.36 L/h × 2 = 2.73 L/h, now as rough as the model (±0.5 L/h).
    expect(within(sweat).getByTestId('sweat-summary')).toHaveTextContent('Sweat rate used: 2.73 L/h (likely 2.23–3.23 L/h).');
    expect(within(sweat).getByTestId('sweat-calibration')).toHaveTextContent('factor 2, at its limit');
  });

  it('edits a sweat test, and Cancel keeps it unchanged', () => {
    renderCard({ sweat: { source: 'test', tests: [HOT_RIDE], calibrate: false } });
    const panel = screen.getByTestId('sweat-test-panel');
    const edit = within(panel).getByRole('button', { name: 'Edit Hot ride' });

    fireEvent.click(edit);
    let form = within(panel).getByRole('form', { name: 'Edit sweat test' });
    expect(within(form).getByLabelText('Name (optional)')).toHaveValue('Hot ride');
    expect(within(form).getByLabelText('Body mass before (kg)')).toHaveValue(70);
    expect(within(form).getByLabelText('Body mass after (kg)')).toHaveValue(69);
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

    fireEvent.click(within(panel).getByRole('button', { name: 'Edit Hot ride' }));
    form = within(panel).getByRole('form', { name: 'Edit sweat test' });
    fireEvent.change(within(form).getByLabelText('Name (optional)'), { target: { value: 'Long ride' } });
    fireEvent.change(within(form).getByLabelText('Body mass after (kg)'), { target: { value: '68.5' } });
    fireEvent.change(within(form).getByLabelText('Sport'), { target: { value: 'running' } });
    expect(within(form).queryByLabelText('Power (W)')).not.toBeInTheDocument();
    fireEvent.click(within(form).getByRole('button', { name: 'Save test' }));

    const [saved] = readInputs().sweat.tests;
    expect(saved).toEqual({
      ...HOT_RIDE,
      label: 'Long ride',
      postKg: 68.5,
      // A 30 km/h ride as a run would be 2:00 min/km: the form takes a typical running speed.
      conditions: { ...CONDITIONS, sport: 'running', speedKmh: 11 },
    });
    expect(within(panel).getByRole('button', { name: 'Edit Long ride' })).toHaveFocus();
    expect(within(panel).getByRole('radio', { name: 'Long ride' })).toBeChecked();
    // The plan uses the edited test (running conditions change the fuel correction).
    const rate = computePlan(readInputs()).sweat.rateLph;
    expect(rate).not.toBeCloseTo(computePlan({ sweat: { source: 'test', tests: [HOT_RIDE], calibrate: false } }).sweat.rateLph);
    expect(screen.getByTestId('sweat-summary')).toHaveTextContent(
      `Sweat rate used: ${rate.toLocaleString('en-US', { maximumFractionDigits: 2 })} L/h`,
    );
    expect(screen.getByTestId('sweat-summary')).toHaveAttribute('data-source', 'test');
  });

  it('deletes a sweat test only after an in-page confirmation', () => {
    renderCard({ sweat: { source: 'test', tests: [HOT_RIDE, COOL_RIDE], selectedTestId: 't1' } });
    const panel = screen.getByTestId('sweat-test-panel');
    const remove = within(panel).getByRole('button', { name: 'Delete Hot ride' });

    fireEvent.click(remove);
    expect(remove).toHaveAttribute('aria-expanded', 'true');
    let confirm = within(panel).getByRole('group', { name: 'Delete Hot ride? You cannot undo this.' });
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(readInputs().sweat.tests).toHaveLength(2);

    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(within(panel).queryByRole('group', { name: /Delete Hot ride/ })).not.toBeInTheDocument();
    expect(remove).toHaveFocus();
    expect(readInputs().sweat.tests).toHaveLength(2);

    // Escape cancels.
    fireEvent.click(remove);
    fireEvent.keyDown(within(panel).getByRole('button', { name: 'Yes, delete' }), { key: 'Escape' });
    expect(within(panel).queryByRole('button', { name: 'Yes, delete' })).not.toBeInTheDocument();

    fireEvent.click(remove);
    confirm = within(panel).getByRole('group', { name: 'Delete Hot ride? You cannot undo this.' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Yes, delete' }));
    expect(readInputs().sweat.tests).toEqual([COOL_RIDE]);
    // The deleted test was selected: the plan now uses the last test.
    expect(readInputs().sweat.selectedTestId).toBeNull();
    expect(within(panel).queryByText('Hot ride')).not.toBeInTheDocument();
    expect(within(panel).getByRole('radio', { name: 'Cool ride' })).toBeChecked();
    expect(within(panel).getByRole('button', { name: 'Add a sweat test' })).toHaveFocus();
  });

  it('selects which sweat test the plan uses', () => {
    renderCard({ sweat: { source: 'test', tests: [HOT_RIDE, COOL_RIDE], calibrate: false } });
    const panel = screen.getByTestId('sweat-test-panel');
    // No selection means the last test.
    expect(within(panel).getByRole('radio', { name: 'Cool ride' })).toBeChecked();
    expect(within(panel).getByRole('radio', { name: 'Hot ride' })).not.toBeChecked();
    expect(within(within(panel).getByTestId('sweat-test-t2')).getByText('In use')).toBeInTheDocument();
    expect(screen.getByTestId('sweat-summary')).toHaveTextContent('Sweat rate used: 0.86 L/h');

    fireEvent.click(within(panel).getByRole('radio', { name: 'Hot ride' }));
    expect(readInputs().sweat.selectedTestId).toBe('t1');
    expect(within(panel).getByRole('radio', { name: 'Hot ride' })).toBeChecked();
    expect(within(within(panel).getByTestId('sweat-test-t1')).getByText('In use')).toBeInTheDocument();
    expect(screen.getByTestId('sweat-summary')).toHaveTextContent('Sweat rate used: 1.36 L/h');
  });

  it('shows what is wrong with a test and falls back to the estimate', () => {
    const unfinished = { ...HOT_RIDE, label: '', postKg: 0 };
    renderCard({ sweat: { source: 'test', tests: [unfinished] } });
    const panel = screen.getByTestId('sweat-test-panel');
    // A test without a label gets a name from its position.
    const item = within(panel).getByTestId('sweat-test-t1');
    expect(within(panel).getByRole('radio', { name: 'Sweat test 1' })).toBeChecked();
    expect(within(item).getByTestId('sweat-test-result')).toHaveTextContent(
      'Cannot be used: Enter your body mass before and after the session.',
    );
    expect(within(item).queryByText('In use')).not.toBeInTheDocument();
    const sweat = region('Sweat');
    const warning = within(sweat).getByText(/Your selected sweat test cannot be used/);
    expect(warning.closest('li')).toHaveAttribute('data-level', 'warning');
    expect(within(sweat).getByTestId('sweat-summary')).toHaveAttribute('data-source', 'estimate');
    expect(within(panel).queryByTestId('sweat-calibration')).not.toBeInTheDocument();
  });

  it('enters a sweat test in pounds and °F and stores kg and °C', () => {
    renderCard({ sweat: { source: 'test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use pounds' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use Fahrenheit' }));
    const panel = screen.getByTestId('sweat-test-panel');
    fireEvent.click(within(panel).getByRole('button', { name: 'Add a sweat test' }));
    const form = within(panel).getByRole('form');
    expect(within(form).getByLabelText('Temperature (°F)')).toHaveValue(68);
    fireEvent.change(within(form).getByLabelText('Body mass before (lb)'), { target: { value: '154.3' } });
    fireEvent.change(within(form).getByLabelText('Body mass after (lb)'), { target: { value: '152.1' } });
    fireEvent.change(within(form).getByLabelText('Temperature (°F)'), { target: { value: '77' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save test' }));

    const [test] = readInputs().sweat.tests;
    expect(test.preKg).toBe(69.989);
    expect(test.postKg).toBe(68.991);
    expect(test.conditions.tempC).toBe(25);
    expect(within(panel).getByTestId('sweat-test-t1')).toHaveTextContent('77 °F');
    expect(within(panel).getByTestId('sweat-test-result')).toHaveTextContent('Measured 0.86 L/h');

    // The projection follows the mass unit too.
    expect(within(region('Fluid')).getByTestId('body-mass-scale')).toHaveTextContent(/ lb$/);
  });

  it('shows the projected scale change in pounds', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Use pounds' }));
    // −0.558 kg = −1.23 lb.
    expect(within(region('Fluid')).getByTestId('body-mass-scale')).toHaveTextContent('−1.2 lb');
  });

  it('keeps at most 20 sweat tests', () => {
    const tests = Array.from({ length: 20 }, (_, i) => ({ ...HOT_RIDE, id: `t${i + 1}`, label: `Test ${i + 1}` }));
    renderCard({ sweat: { source: 'test', tests } });
    const panel = screen.getByTestId('sweat-test-panel');
    expect(within(panel).getAllByRole('radio')).toHaveLength(20);
    expect(within(panel).getByRole('button', { name: 'Add a sweat test' })).toBeDisabled();
    expect(within(panel).getByText('You can keep up to 20 tests. Delete one to add another.')).toBeInTheDocument();
  });

  it('switches sodium to Adjust, starting from the recommendation, and warns on high values', () => {
    renderCard({ sweat: { source: 'preset' } });
    const sodium = region('Sodium target');
    fireEvent.click(pressed(sodium, 'Adjust'));

    expect(readInputs().sodium).toEqual({ mode: 'manual', manualMgPerHour: 570 });
    expect(pressed(sodium, 'Adjust')).toHaveAttribute('aria-pressed', 'true');
    const input = within(sodium).getByLabelText('Your sodium target (mg/h)');
    expect(input).toHaveValue(570);

    fireEvent.change(input, { target: { value: '2000' } });
    expect(readInputs().sodium.manualMgPerHour).toBe(2000);
    expect(within(sodium).getByTestId('sodium-value')).toHaveTextContent('2,000 mg/h');
    // The recommendation stays visible next to the manual value.
    expect(within(sodium).getByText('570 mg/h')).toBeInTheDocument();
    const warnings = within(sodium).getByRole('list', { name: 'Warnings' });
    const danger = within(warnings).getByText(/You plan 2,000 mg\/h of sodium\. That is far above any guideline\./);
    expect(danger.closest('li')).toHaveAttribute('data-level', 'danger');

    // Clearing the field while typing keeps the last value; blur shows it again.
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue(null);
    expect(readInputs().sodium.manualMgPerHour).toBe(2000);
    fireEvent.blur(input);
    expect(input).toHaveValue(2000);

    fireEvent.click(pressed(sodium, 'Auto'));
    expect(readInputs().sodium).toEqual({ mode: 'auto', manualMgPerHour: 2000 });
    expect(within(sodium).getByTestId('sodium-value')).toHaveTextContent('570 mg/h');
    expect(within(sodium).queryByLabelText('Your sodium target (mg/h)')).not.toBeInTheDocument();
    expect(within(sodium).queryByRole('list', { name: 'Warnings' })).not.toBeInTheDocument();
  });

  it('marks sodium optional and suggests drinking to thirst for short events', () => {
    renderCard({ event: { durationMin: 60 } });
    const sodium = region('Sodium target');
    expect(within(sodium).getByText('Optional')).toBeInTheDocument();
    expect(within(sodium).getByText('0–300 mg/h')).toBeInTheDocument();
    expect(within(sodium).getByTestId('sodium-value')).toHaveTextContent('70 mg/h');
    expect(within(region('Fluid')).getByTestId('drink-to-thirst')).toHaveTextContent(/Drinking to thirst works well/);
  });

  it('suggests drinking to thirst in cool weather', () => {
    renderCard({ environment: { tempC: 10 } });
    expect(within(region('Fluid')).getByTestId('drink-to-thirst')).toBeInTheDocument();
  });

  it('turns on potassium, magnesium and calcium under Advanced', () => {
    renderCard({ sweat: { source: 'preset' } });
    const toggle = screen.getByRole('button', { name: 'Advanced: potassium, magnesium, calcium' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('Potassium')).not.toBeVisible();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Potassium')).toBeVisible();
    expect(screen.getByTestId('extra-potassium')).toHaveTextContent('Off');

    fireEvent.click(screen.getByLabelText('Potassium'));
    fireEvent.click(screen.getByLabelText('Magnesium'));
    fireEvent.click(screen.getByLabelText('Calcium'));
    expect(readInputs().extras).toEqual({ potassium: true, magnesium: true, calcium: true });
    // Half of a typical loss at 1.25 L/h: K 110, Mg 1, Ca 13 mg/h.
    expect(screen.getByTestId('extra-potassium')).toHaveTextContent('110 mg/h');
    expect(screen.getByTestId('extra-magnesium')).toHaveTextContent('1 mg/h');
    expect(screen.getByTestId('extra-calcium')).toHaveTextContent('13 mg/h');

    const salts = region('Salts');
    const list = within(salts).getByRole('list', { name: 'Salt amounts for the whole activity' });
    const potassium = within(list).getByText('Potassium Citrate (monohydrate)').closest('li');
    expect(potassium).toHaveTextContent('0.91 g');
    expect(within(list).getByText('Magnesium Citrate (anhydrous)').closest('li')).toHaveTextContent('19 mg');
    const table = within(salts).getByRole('table');
    for (const ion of ['Sodium', 'Potassium', 'Magnesium', 'Calcium']) {
      expect(within(within(table).getByRole('row', { name: new RegExp(ion) })).getByText('On target')).toBeInTheDocument();
    }

    fireEvent.click(screen.getByLabelText('Potassium'));
    expect(screen.getByTestId('extra-potassium')).toHaveTextContent('Off');
    expect(within(table).queryByRole('row', { name: /Potassium/ })).not.toBeInTheDocument();
  });

  it('opens Advanced when an extra is already on', () => {
    renderCard({ extras: { magnesium: true } });
    expect(screen.getByRole('button', { name: /^Advanced/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Magnesium')).toBeChecked();
  });

  it('opens Advanced when a share link turns an extra on after the first render', () => {
    // PlanProvider restores ?s= in an effect, after this card first rendered with the defaults.
    window.history.replaceState(null, '', `/?s=${encodeShareState({ extras: { potassium: true } })}`);
    renderCard();
    expect(readInputs().extras.potassium).toBe(true);
    const toggle = screen.getByRole('button', { name: /^Advanced/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Potassium')).toBeVisible();
    // Turning the last extra off keeps the panel (and the focused checkbox) open.
    fireEvent.click(screen.getByLabelText('Potassium'));
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // The user can still close it.
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps a manual salt row and its focus when its salt changes', () => {
    renderCard({ salts: { mode: 'manual', manual: [{ ref: 31, amountMg: 100 }, { ref: 33, amountMg: 200 }] } });
    const salts = region('Salts');
    const select = within(salts).getByLabelText('Salt 1');
    select.focus();
    fireEvent.change(select, { target: { value: '32' } });
    expect(readInputs().salts.manual[0]).toEqual({ ref: 32, amountMg: 100 });
    expect(within(salts).getByLabelText('Salt 1')).toBe(select);
    expect(select.isConnected).toBe(true);
    expect(document.activeElement).toBe(select);
  });

  it('starts manual salts from the auto amounts, even the largest ones', () => {
    // 48 h at 5000 mg/h sodium from sodium citrate needs about 1,023 g of citrate.
    const extreme = {
      event: { durationMin: 2880 },
      sodium: { mode: 'manual', manualMgPerHour: 5000 },
      salts: { sodiumSalt: 'citrate' },
    };
    const autoItems = computePlan(extreme).salts.items;
    renderCard(extreme);
    fireEvent.click(pressed(region('Salts'), 'Manual'));
    expect(readInputs().salts.manual).toEqual(autoItems);
    const amount = within(region('Salts')).getByLabelText('Sodium Citrate (dihydrate) amount in g for the whole activity');
    expect(amount).toHaveAttribute('max', String(INPUT_LIMITS.saltAmountMg[1] / 1000));
    expect(amount).toHaveValue(autoItems[0].amountMg / 1000);
    expect(within(region('Salts')).getByRole('table')).toHaveTextContent('On target');
  });

  it('picks the sodium salt in auto mode', () => {
    renderCard({ sweat: { source: 'preset' } });
    const salts = region('Salts');
    const select = within(salts).getByLabelText('Sodium salt');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Table salt',
      'Sodium citrate',
      '50:50 mix',
    ]);
    expect(within(salts).getByText('4.4 g')).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'citrate' } });
    expect(readInputs().salts.sodiumSalt).toBe('citrate');
    let list = within(salts).getByRole('list', { name: 'Salt amounts for the whole activity' });
    expect(within(list).getByText('Sodium Citrate (dihydrate)')).toBeInTheDocument();
    expect(within(list).getByText('7.3 g')).toBeInTheDocument();
    expect(within(list).queryByText('Sodium Chloride (Table Salt)')).not.toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'mix' } });
    list = within(salts).getByRole('list', { name: 'Salt amounts for the whole activity' });
    expect(within(list).getByText('2.2 g')).toBeInTheDocument();
    expect(within(list).getByText('3.6 g')).toBeInTheDocument();
  });

  it('edits manual salt amounts in grams and compares delivered sodium with the target', () => {
    renderCard({ sweat: { source: 'preset' } });
    const salts = region('Salts');
    fireEvent.click(pressed(salts, 'Manual'));

    // Manual starts from the auto amounts.
    expect(readInputs().salts).toEqual({
      mode: 'manual',
      sodiumSalt: 'table',
      manual: [{ ref: 31, amountMg: 4351 }],
      custom: [],
    });
    const first = within(salts).getByLabelText('Salt 1');
    expect(first).toHaveValue('31');
    const amount = within(salts).getByLabelText('Sodium Chloride (Table Salt) amount in g for the whole activity');
    expect(amount).toHaveValue(4.351);
    const table = within(salts).getByRole('table');
    expect(within(table).getByText('On target')).toBeInTheDocument();
    // Dark green text in the light theme (the bright green is about 2:1 on white).
    expect(within(table).getByText('On target')).toHaveClass('text-apple-green-ink');

    fireEvent.change(amount, { target: { value: '2' } });
    expect(readInputs().salts.manual[0].amountMg).toBe(2000);
    expect(within(table).getByText('Short by 924 mg')).toHaveAttribute('data-status', 'short');

    fireEvent.change(amount, { target: { value: '20' } });
    expect(within(table).getByText('Over by 6,150 mg')).toHaveAttribute('data-status', 'over');
    const warnings = within(salts).getByRole('list', { name: 'Warnings' });
    expect(within(warnings).getByText(/far above any guideline/)).toBeInTheDocument();

    fireEvent.click(within(salts).getByRole('button', { name: 'Add salt' }));
    const second = within(salts).getByLabelText('Salt 2');
    expect(second).toHaveValue('32'); // first salt not in the list yet
    expect(second).toHaveFocus();
    expect(within(first).getByRole('option', { name: 'Potassium Chloride' })).toBeDisabled();
    expect(readInputs().salts.manual).toEqual([
      { ref: 31, amountMg: 20000 },
      { ref: 32, amountMg: 0 },
    ]);

    fireEvent.change(second, { target: { value: '39' } });
    fireEvent.change(within(salts).getByLabelText('Potassium Citrate (monohydrate) amount in g for the whole activity'), {
      target: { value: '0.5' },
    });
    expect(readInputs().salts.manual[1]).toEqual({ ref: 39, amountMg: 500 });
    // Potassium has no target, so it shows as over.
    expect(within(within(table).getByRole('row', { name: /Potassium/ })).getByText('Over by 181 mg')).toBeInTheDocument();

    fireEvent.click(within(salts).getByRole('button', { name: 'Remove Potassium Citrate (monohydrate)' }));
    expect(within(salts).queryByLabelText('Salt 2')).not.toBeInTheDocument();
    expect(readInputs().salts.manual).toEqual([{ ref: 31, amountMg: 20000 }]);

    // Back to auto and to manual again keeps the manual list.
    fireEvent.click(pressed(salts, 'Auto'));
    expect(within(salts).getByText('4.4 g')).toBeInTheDocument();
    fireEvent.click(pressed(salts, 'Manual'));
    expect(within(salts).getByLabelText('Sodium Chloride (Table Salt) amount in g for the whole activity')).toHaveValue(20);
  });

  it('disables Add salt when every salt is in the list', () => {
    const manual = [31, 32, 33, 34, 35, 36, 37, 38, 39, 40].map((ref) => ({ ref, amountMg: 0 }));
    renderCard({ salts: { mode: 'manual', manual } });
    expect(screen.getByRole('button', { name: 'Add salt' })).toBeDisabled();
  });

  it('adds a salt from a label in Manual mode and uses its elements', () => {
    renderCard({ salts: { mode: 'manual', manual: [] } });
    const salts = region('Salts');
    expect(within(salts).queryByRole('list', { name: 'Salts from a label' })).not.toBeInTheDocument();

    fireEvent.click(within(salts).getByRole('button', { name: 'Add a salt from a label' }));
    expect(readInputs().salts.custom).toEqual([
      { key: 's1', name: '', sodiumPct: 0, potassiumPct: 0, magnesiumPct: 0, calciumPct: 0, chloridePct: 0 },
    ]);
    expect(readInputs().salts.manual).toEqual([{ ref: 's1', amountMg: 0 }]);
    const editor = within(salts).getByRole('list', { name: 'Salts from a label' });
    const name = within(editor).getByLabelText('Salt name');
    expect(name).toHaveFocus();
    expect(within(editor).getByText('Enter at least one value from the label.')).toBeInTheDocument();
    // The new salt is in the manual list under a default name.
    expect(within(salts).getByLabelText('Salt 1')).toHaveValue('s1');
    expect(within(within(salts).getByLabelText('Salt 1')).getByRole('option', { name: 'Custom salt 1' })).toBeInTheDocument();

    fireEvent.change(name, { target: { value: 'Drink mix' } });
    fireEvent.change(within(editor).getByLabelText('Sodium (Na) %'), { target: { value: '20' } });
    expect(readInputs().salts.custom[0]).toMatchObject({ name: 'Drink mix', sodiumPct: 20 });
    expect(within(salts).getByRole('option', { name: 'Drink mix' })).toBeInTheDocument();

    // 1 g with 20% sodium delivers 200 mg of the 900 mg target.
    fireEvent.change(within(salts).getByLabelText('Drink mix amount in g for the whole activity'), {
      target: { value: '1' },
    });
    expect(readInputs().salts.manual).toEqual([{ ref: 's1', amountMg: 1000 }]);
    const table = within(salts).getByRole('table');
    expect(within(within(table).getByRole('row', { name: /Sodium/ })).getByText('Short by 700 mg')).toBeInTheDocument();

    // Values above 100% in total are flagged.
    fireEvent.change(within(editor).getByLabelText('Chloride (Cl) %'), { target: { value: '90' } });
    expect(within(editor).getByText(/These values add up to 110%/)).toBeInTheDocument();

    // A second row can use a built-in salt; the custom salt is taken.
    fireEvent.click(within(salts).getByRole('button', { name: 'Add salt' }));
    const second = within(salts).getByLabelText('Salt 2');
    expect(second).toHaveValue('31');
    expect(within(second).getByRole('option', { name: 'Drink mix' })).toBeDisabled();

    // Deleting the custom salt removes its row too.
    fireEvent.click(within(editor).getByRole('button', { name: 'Delete Drink mix from your salts' }));
    expect(readInputs().salts.custom).toEqual([]);
    expect(readInputs().salts.manual).toEqual([{ ref: 31, amountMg: 0 }]);
    expect(within(salts).queryByRole('list', { name: 'Salts from a label' })).not.toBeInTheDocument();
    expect(within(salts).getByRole('button', { name: 'Add a salt from a label' })).toHaveFocus();
  });

  it('keeps at most 10 salts from a label', () => {
    const custom = Array.from({ length: 10 }, (_, i) => ({
      key: `s${i + 1}`,
      name: `Mix ${i + 1}`,
      sodiumPct: 10,
      potassiumPct: 0,
      magnesiumPct: 0,
      calciumPct: 0,
      chloridePct: 0,
    }));
    renderCard({ salts: { mode: 'manual', custom } });
    expect(screen.getByRole('button', { name: 'Add a salt from a label' })).toBeDisabled();
  });

  it('switches fluid to Adjust and warns once when drinking more than sweat loss', () => {
    renderCard({ sweat: { source: 'preset' } });
    const fluid = region('Fluid');
    fireEvent.click(pressed(fluid, 'Adjust'));
    expect(readInputs().fluid).toEqual({ mode: 'manual', manualMlPerHour: 800 });
    const input = within(fluid).getByLabelText('Your fluid target (ml/h)');
    expect(input).toHaveValue(800);

    fireEvent.change(input, { target: { value: '1500' } });
    expect(within(fluid).getByTestId('fluid-value')).toHaveTextContent('1,500 ml/h');
    const warnings = within(fluid).getByRole('list', { name: 'Warnings' });
    const danger = within(warnings).getByText(/You plan to drink 1,500 ml\/h\. That is more than you sweat \(1,250 ml\/h\)\./);
    expect(danger.closest('li')).toHaveAttribute('data-level', 'danger');
    // The projected gain says the same, so it is not repeated.
    expect(warnings.querySelectorAll(':scope > li')).toHaveLength(1);
    expect(within(warnings).queryByText(/would drink about 0\.75 L more than you sweat/)).not.toBeInTheDocument();
    // (1.25 − 1.5) × 3 = −0.75 L; the scale rises by 0.75 − 0.41 = 0.3 kg.
    const level = within(fluid).getByTestId('body-mass-level');
    expect(level).toHaveTextContent('Weight gain');
    expect(level).toHaveAttribute('data-level', 'gain');
    expect(within(fluid).getByTestId('body-mass-scale')).toHaveTextContent('+0.3 kg');
    expect(fact(fluid, 'Water gained')).toHaveTextContent('0.75 L (1.1% of body mass)');

    fireEvent.click(pressed(fluid, 'Auto'));
    expect(within(fluid).getByTestId('fluid-value')).toHaveTextContent('800 ml/h');
    expect(within(fluid).queryByRole('list', { name: 'Warnings' })).not.toBeInTheDocument();
  });

  it('gives every form control a unique id and a label', () => {
    const check = () => {
      const card = screen.getByTestId('card');
      const controls = card.querySelectorAll('input, select, textarea');
      expect(controls.length).toBeGreaterThan(0);
      for (const control of controls) {
        expect(control.id, control.outerHTML).not.toBe('');
        expect(control.labels.length, control.outerHTML).toBeGreaterThan(0);
        expect(control.labels[0].textContent.trim(), control.outerHTML).not.toBe('');
      }
      const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
      expect(new Set(ids).size).toBe(ids.length);
    };

    let view = renderCard();
    check();
    view.unmount();

    view = renderCard({
      sweat: { source: 'preset' },
      sodium: { mode: 'manual' },
      fluid: { mode: 'manual' },
      extras: { potassium: true },
      salts: {
        mode: 'manual',
        manual: [
          { ref: 31, amountMg: 100 },
          { ref: 's1', amountMg: 200 },
        ],
        custom: [{ key: 's1', name: 'Mix', sodiumPct: 20, potassiumPct: 0, magnesiumPct: 0, calciumPct: 0, chloridePct: 0 }],
      },
    });
    check();
    view.unmount();

    renderCard({ sweat: { source: 'test', tests: [HOT_RIDE, COOL_RIDE] } });
    const panel = screen.getByTestId('sweat-test-panel');
    fireEvent.click(within(panel).getByRole('button', { name: 'Delete Cool ride' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Edit Hot ride' }));
    expect(within(panel).getByRole('form')).toBeInTheDocument();
    check();
    // Every condition field of the other sports too.
    fireEvent.change(within(panel).getByLabelText('Sport'), { target: { value: 'other' } });
    fireEvent.change(within(panel).getByLabelText('Setting'), { target: { value: 'indoorFan' } });
    expect(within(panel).getByLabelText('Effort (METs)')).toBeInTheDocument();
    expect(within(panel).queryByLabelText('Sun')).not.toBeInTheDocument();
    check();
  });
});
