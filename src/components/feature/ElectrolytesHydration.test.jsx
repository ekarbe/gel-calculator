import { describe, it, expect } from 'vitest';
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

/** Lets a test switch the display unit for temperature. */
function TempUnitButton() {
  const { setTempUnit } = useUi();
  return (
    <button type="button" onClick={() => setTempUnit('F')}>
      Use Fahrenheit
    </button>
  );
}

function renderCard(initialInputs) {
  return render(
    <UiProvider>
      <PlanProvider initialInputs={initialInputs}>
        <div data-testid="card">
          <ElectrolytesHydration />
        </div>
        <InputsProbe />
        <TempUnitButton />
      </PlanProvider>
    </UiProvider>,
  );
}

const readInputs = () => JSON.parse(screen.getByTestId('inputs').textContent);
const region = (name) => screen.getByRole('region', { name });
const pressed = (scope, name) => within(scope).getByRole('button', { name });

describe('ElectrolytesHydration', () => {
  it('shows the default plan from the real domain', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'Electrolytes & Hydration' })).toBeInTheDocument();

    // Sweat: preset 2 (1.25 L/h) and saltiness 2 (40 mmol/L ≈ 920 mg/L).
    const sweat = region('Sweat');
    const rate = within(sweat).getByLabelText('Sweat Rate');
    expect(rate).toHaveValue('2');
    expect(within(rate).getByRole('option', { name: 'Active sweating (1.25 L/h)' })).toBeInTheDocument();
    expect(
      within(sweat).getByText('Active sweating: Clothing shows distinct wet patches, sweat begins to drip occasionally'),
    ).toBeInTheDocument();
    const saltiness = within(sweat).getByLabelText('Sweat Saltiness');
    expect(saltiness).toHaveValue('2');
    expect(within(saltiness).getByRole('option', { name: 'Moderate salt content (920 mg/L)' })).toBeInTheDocument();
    expect(within(sweat).getByTestId('sweat-summary')).toHaveTextContent(
      'Sweat rate used: 1.25 L/h (likely 0.75–1.75 L/h). Sweat sodium: 920 mg/L.',
    );
    expect(pressed(sweat, 'Presets')).toHaveAttribute('aria-pressed', 'true');

    // Sodium: 180 min, 1.25 L/h, 40 mmol/L → 570 mg/h in 300–600.
    const sodium = region('Sodium target');
    expect(within(sodium).getByTestId('sodium-value')).toHaveTextContent('570 mg/h');
    expect(within(sodium).getByText('300–600 mg/h')).toBeInTheDocument();
    expect(within(sodium).getByText('about 1,150 mg/h')).toBeInTheDocument();
    expect(within(sodium).getByText('1,710 mg in total')).toBeInTheDocument();
    expect(within(sodium).queryByText('Optional')).not.toBeInTheDocument();
    expect(pressed(sodium, 'Auto')).toHaveAttribute('aria-pressed', 'true');
    expect(within(sodium).queryByLabelText('Your sodium target (mg/h)')).not.toBeInTheDocument();

    // Salts: auto, table salt for the whole activity, sodium on target.
    const salts = region('Salts');
    const list = within(salts).getByRole('list', { name: 'Salt amounts for the whole activity' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText('Sodium Chloride (Table Salt)')).toBeInTheDocument();
    expect(within(list).getByText('4.4 g')).toBeInTheDocument();
    const table = within(salts).getByRole('table', { name: 'Delivered vs target (whole activity)' });
    const sodiumRow = within(table).getByRole('row', { name: /sodium/i });
    expect(within(sodiumRow).getAllByText('1,710 mg')).toHaveLength(2);
    expect(within(sodiumRow).getByText('On target')).toHaveAttribute('data-status', 'met');

    // Fluid: 80% of 1.25 L/h capped at 800 ml/h.
    const fluid = region('Fluid');
    expect(within(fluid).getByTestId('fluid-value')).toHaveTextContent('800 ml/h');
    expect(within(fluid).getByText('400–800 ml/h')).toBeInTheDocument();
    expect(within(fluid).getByText('about 1,250 ml/h')).toBeInTheDocument();
    expect(within(fluid).getByText('2.4 L in total')).toBeInTheDocument();
    expect(within(fluid).queryByTestId('drink-to-thirst')).not.toBeInTheDocument();

    expect(screen.queryByRole('list', { name: 'Warnings' })).not.toBeInTheDocument();
  });

  it('recomputes the targets when a sweat preset changes', () => {
    renderCard();
    fireEvent.change(screen.getByLabelText('Sweat Rate'), { target: { value: '0' } });
    expect(readInputs().sweat.rateIndex).toBe(0);
    // 0.25 L/h: half the loss is below the 300 mg/h floor; fluid 200 ml/h.
    expect(screen.getByTestId('sodium-value')).toHaveTextContent('300 mg/h');
    expect(screen.getByTestId('fluid-value')).toHaveTextContent('200 ml/h');
    expect(screen.getByText('Light sweating: Skin feels slightly damp')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Sweat Rate'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Sweat Saltiness'), { target: { value: '4' } });
    expect(readInputs().sweat.saltinessIndex).toBe(4);
    // 70 mmol/L is salty sweat: range 300–1000, half of 2012 mg/h → 1000 mg/h.
    expect(screen.getByTestId('sodium-value')).toHaveTextContent('1,000 mg/h');
    expect(within(region('Sodium target')).getByText('300–1,000 mg/h')).toBeInTheDocument();
  });

  it('shows the interim estimate with sex, intensity, temperature and humidity', () => {
    renderCard();
    const sweat = region('Sweat');
    fireEvent.click(pressed(sweat, 'Estimate (interim)'));

    expect(readInputs().sweat.source).toBe('estimate');
    expect(pressed(sweat, 'Estimate (interim)')).toHaveAttribute('aria-pressed', 'true');
    expect(within(sweat).queryByLabelText('Sweat Rate')).not.toBeInTheDocument();
    expect(within(sweat).getByLabelText('Sweat Saltiness')).toBeInTheDocument();

    const sex = within(sweat).getByLabelText('Sex');
    expect(sex).toHaveValue('unspecified');
    expect(within(sex).getAllByRole('option').map((o) => o.textContent)).toEqual(['Not specified', 'Female', 'Male']);
    // 0.65 × 1.2 + (20 − 15) × 0.03 = 0.93 L/h, ±0.4 L/h.
    expect(within(sweat).getByTestId('sweat-estimate')).toHaveTextContent('0.93 L/h ± 0.4 L/h');
    expect(within(sweat).getByText(/intensity \(Moderate\), temperature \(20 °C\) and humidity \(50%\)/)).toBeInTheDocument();
    expect(within(sweat).getByText(/A sweat test and a better estimate are coming/)).toBeInTheDocument();
    expect(screen.getByTestId('sodium-value')).toHaveTextContent('430 mg/h');

    fireEvent.change(sex, { target: { value: 'male' } });
    expect(readInputs().athlete.sex).toBe('male');
    expect(within(sweat).getByTestId('sweat-estimate')).toHaveTextContent('1.11 L/h ± 0.4 L/h');

    fireEvent.click(screen.getByRole('button', { name: 'Use Fahrenheit' }));
    expect(within(sweat).getByText(/temperature \(68 °F\)/)).toBeInTheDocument();

    fireEvent.click(pressed(sweat, 'Presets'));
    expect(readInputs().sweat.source).toBe('preset');
    expect(within(sweat).getByLabelText('Sweat Rate')).toBeInTheDocument();
    expect(within(sweat).queryByTestId('sweat-estimate')).not.toBeInTheDocument();
  });

  it('explains the sweat, sodium and fluid targets with citations', () => {
    renderCard();
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
  });

  it('switches sodium to Adjust, starting from the recommendation, and warns on high values', () => {
    renderCard();
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
    expect(within(sodium).getByTestId('sodium-value')).toHaveTextContent('300 mg/h');
    expect(within(region('Fluid')).getByTestId('drink-to-thirst')).toHaveTextContent(/Drinking to thirst works well/);
  });

  it('suggests drinking to thirst in cool weather', () => {
    renderCard({ environment: { tempC: 10 } });
    expect(within(region('Fluid')).getByTestId('drink-to-thirst')).toBeInTheDocument();
  });

  it('turns on potassium, magnesium and calcium under Advanced', () => {
    renderCard();
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
    expect(within(list).getByText('Potassium Citrate (monohydrate)')).toBeInTheDocument();
    expect(within(list).getByText('913 mg')).toBeInTheDocument();
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
    try {
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
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });

  it('keeps a manual salt row and its focus when its salt changes', () => {
    renderCard({ salts: { mode: 'manual', manual: [{ id: 31, amountMg: 100 }, { id: 33, amountMg: 200 }] } });
    const salts = region('Salts');
    const select = within(salts).getByLabelText('Salt 1');
    select.focus();
    fireEvent.change(select, { target: { value: '32' } });
    expect(readInputs().salts.manual[0]).toEqual({ id: 32, amountMg: 100 });
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
    const amount = within(region('Salts')).getByLabelText('Sodium Citrate (dihydrate) amount in mg for the whole activity');
    expect(amount).toHaveAttribute('max', String(INPUT_LIMITS.saltAmountMg[1]));
    expect(within(region('Salts')).getByRole('table')).toHaveTextContent('On target');
  });

  it('picks the sodium salt in auto mode', () => {
    renderCard();
    const salts = region('Salts');
    const select = within(salts).getByLabelText('Sodium salt');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Table salt',
      'Sodium citrate',
      '50:50 mix',
    ]);

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

  it('edits manual salts and compares delivered sodium with the target', () => {
    renderCard();
    const salts = region('Salts');
    fireEvent.click(pressed(salts, 'Manual'));

    // Manual starts from the auto amounts.
    expect(readInputs().salts).toEqual({ mode: 'manual', sodiumSalt: 'table', manual: [{ id: 31, amountMg: 4351 }] });
    const first = within(salts).getByLabelText('Salt 1');
    expect(first).toHaveValue('31');
    const amount = within(salts).getByLabelText('Sodium Chloride (Table Salt) amount in mg for the whole activity');
    expect(amount).toHaveValue(4351);
    const table = within(salts).getByRole('table');
    expect(within(table).getByText('On target')).toBeInTheDocument();
    // Dark green text in the light theme (the bright green is about 2:1 on white).
    expect(within(table).getByText('On target')).toHaveClass('text-apple-green-ink');

    fireEvent.change(amount, { target: { value: '2000' } });
    expect(within(table).getByText('Short by 924 mg')).toHaveAttribute('data-status', 'short');

    fireEvent.change(amount, { target: { value: '20000' } });
    expect(within(table).getByText('Over by 6,150 mg')).toHaveAttribute('data-status', 'over');
    const warnings = within(salts).getByRole('list', { name: 'Warnings' });
    expect(within(warnings).getByText(/far above any guideline/)).toBeInTheDocument();

    fireEvent.click(within(salts).getByRole('button', { name: 'Add salt' }));
    const second = within(salts).getByLabelText('Salt 2');
    expect(second).toHaveValue('32'); // first salt not in the list yet
    expect(within(first).getByRole('option', { name: 'Potassium Chloride' })).toBeDisabled();
    expect(readInputs().salts.manual).toEqual([
      { id: 31, amountMg: 20000 },
      { id: 32, amountMg: 0 },
    ]);

    fireEvent.change(second, { target: { value: '39' } });
    fireEvent.change(within(salts).getByLabelText('Potassium Citrate (monohydrate) amount in mg for the whole activity'), {
      target: { value: '500' },
    });
    expect(readInputs().salts.manual[1]).toEqual({ id: 39, amountMg: 500 });
    // Potassium has no target, so it shows as over.
    expect(within(within(table).getByRole('row', { name: /Potassium/ })).getByText('Over by 181 mg')).toBeInTheDocument();

    fireEvent.click(within(salts).getByRole('button', { name: 'Remove Potassium Citrate (monohydrate)' }));
    expect(within(salts).queryByLabelText('Salt 2')).not.toBeInTheDocument();
    expect(readInputs().salts.manual).toEqual([{ id: 31, amountMg: 20000 }]);

    // Back to auto and to manual again keeps the manual list.
    fireEvent.click(pressed(salts, 'Auto'));
    expect(within(salts).getByText('4.4 g')).toBeInTheDocument();
    fireEvent.click(pressed(salts, 'Manual'));
    expect(within(salts).getByLabelText('Sodium Chloride (Table Salt) amount in mg for the whole activity')).toHaveValue(20000);
  });

  it('disables Add salt when every salt is in the list', () => {
    const manual = [31, 32, 33, 34, 35, 36, 37, 38, 39, 40].map((id) => ({ id, amountMg: 0 }));
    renderCard({ salts: { mode: 'manual', manual } });
    expect(screen.getByRole('button', { name: 'Add salt' })).toBeDisabled();
  });

  it('switches fluid to Adjust and warns when drinking more than sweat loss', () => {
    renderCard();
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

    const { unmount } = renderCard();
    check();
    unmount();

    renderCard({
      sweat: { source: 'estimate' },
      sodium: { mode: 'manual' },
      fluid: { mode: 'manual' },
      extras: { potassium: true },
      salts: { mode: 'manual', manual: [{ id: 31, amountMg: 100 }, { id: 33, amountMg: 200 }] },
    });
    check();
  });
});
