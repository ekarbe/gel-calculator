import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import BalanceAnalysis from './BalanceAnalysis';
import { PlanProvider } from '../../state/PlanProvider';
import { UiProvider, useUi } from '../../state/UiProvider';

/** Switches the display mass unit, like the header toggle. */
function UnitToggle() {
  const { setMassUnit } = useUi();
  return (
    <button type="button" onClick={() => setMassUnit('lb')}>
      Use lb
    </button>
  );
}

function renderCard(initialInputs) {
  return render(
    <UiProvider>
      <PlanProvider initialInputs={initialInputs} persist={false}>
        <UnitToggle />
        <BalanceAnalysis />
      </PlanProvider>
    </UiProvider>,
  );
}

const ring = (testId) => screen.getByTestId(testId);
const ratioGroup = () => screen.getByRole('group', { name: 'Carb Ratio' });
const sweatGroup = () => screen.getByRole('group', { name: 'Sweat and Body Mass' });
const text = (testId) => screen.getByTestId(testId).textContent;
/** The track and (when drawn) the progress arc of a ring. */
const ringCircles = (element) => element.querySelector('svg').querySelectorAll('circle');

/** A 60 min sweat test: 1 kg lost with 0.5 L drunk (1.36 L/h after the metabolic correction). */
const TEST = { id: 't1', date: '2026-09-01', label: 'Long ride', preKg: 70, postKg: 69, fluidL: 0.5, urineL: 0, durationMin: 60 };

describe('BalanceAnalysis', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('compares every ring with a real target for the default plan', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'Activity Summary' })).toBeInTheDocument();

    // Carbs: the recipe delivers the full 225 g target (180 min × 75 g/h).
    const carbs = ring('ring-carbs');
    expect(carbs).toHaveAccessibleName('Total Carbs');
    expect(within(carbs).getByText('225')).toBeInTheDocument();
    expect(within(carbs).getByText('of 225 g target')).toBeInTheDocument();
    expect(within(carbs).getByText('75 g/h')).toBeInTheDocument();
    expect(within(carbs).getByText('Auto · range 60–90 g/h')).toBeInTheDocument();
    expect(carbs).toHaveAttribute('data-progress', '100');

    // Sodium: 2,290 mg table salt delivers the 900 mg target (300 mg/h × 3 h).
    const sodium = ring('ring-sodium');
    expect(within(sodium).getByText('900')).toBeInTheDocument();
    expect(within(sodium).getByText('of 900 mg target')).toBeInTheDocument();
    expect(within(sodium).getByText('On target')).toBeInTheDocument();
    expect(within(sodium).getByText('Auto · range 300–600 mg/h')).toBeInTheDocument();
    expect(sodium).toHaveAttribute('data-progress', '100');

    // Fluid: 100 ml/h of the 100 ml/h plan (0.15 L/h estimated sweat).
    const fluid = ring('ring-fluid');
    expect(within(fluid).getByText('100')).toBeInTheDocument();
    expect(within(fluid).getByText('of 100 ml/h planned')).toBeInTheDocument();
    expect(within(fluid).getByText('300 ml in total')).toBeInTheDocument();
    expect(fluid).toHaveAttribute('data-progress', '100');

    // Energy: 225 g × 4 kcal = 900 kcal of 900 kcal planned; the ride burns about 2,035 kcal.
    const energy = ring('ring-energy');
    expect(within(energy).getByText('900')).toBeInTheDocument();
    expect(within(energy).getByText('of 900 kcal planned')).toBeInTheDocument();
    expect(within(energy).getByText('You burn about 2,040 kcal')).toBeInTheDocument();
    expect(energy).toHaveAttribute('data-progress', '100');
  });

  it('shows the estimated sweat rate with its uncertainty and the body-mass projection', () => {
    renderCard();
    expect(sweatGroup()).toBeInTheDocument();
    // Heat-balance estimate for 30 km/h at 20 °C in the shade: 0.15 L/h ± 0.5 L/h.
    expect(text('summary-sweat-rate')).toBe('0.15 ± 0.5 L/h');
    expect(text('summary-sweat-source')).toBe('Heat-balance estimate');
    // 100 ml/h of fluid: 0.15 L water lost, the scale drops 0.56 kg with the fuel burned.
    expect(text('summary-body-mass')).toBe('−0.6 kg');
    expect(text('summary-body-water')).toBe('0.15 L (0.2% of body mass)');
    const level = screen.getByTestId('summary-body-mass-level');
    expect(level).toHaveAttribute('data-level', 'ok');
    expect(level).toHaveTextContent('Up to 2% loss');
  });

  it('shows the scale change in the display unit', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Use lb' }));
    // −0.558 kg = −1.23 lb.
    expect(text('summary-body-mass')).toBe('−1.2 lb');
  });

  it('explains the sweat rate through Why', () => {
    renderCard();
    const why = within(sweatGroup()).getByRole('button', { name: /Why this sweat rate\?/ });
    fireEvent.click(why);
    expect(within(sweatGroup()).getByText(/Your estimated sweat rate is 0.15 L\/h/)).toBeVisible();
    expect(within(sweatGroup()).getByRole('link', { name: /Jay/ })).toBeInTheDocument();
  });

  it('names a self-assessed preset', () => {
    renderCard({ sweat: { source: 'preset' } });
    expect(text('summary-sweat-rate')).toBe('1.25 ± 0.5 L/h');
    expect(text('summary-sweat-source')).toBe('Self-assessed preset');
    // 1.25 L/h sweat, 0.8 L/h drunk for 3 h: 1.35 L (1.9 %), the scale drops 1.76 kg.
    expect(text('summary-body-mass')).toBe('−1.8 kg');
    expect(text('summary-body-water')).toBe('1.35 L (1.9% of body mass)');
  });

  it('says when a sweat test was chosen but cannot be used', () => {
    renderCard({ sweat: { source: 'test' } });
    expect(text('summary-sweat-source')).toBe('Heat-balance estimate (no usable sweat test)');
    expect(text('summary-sweat-rate')).toBe('0.15 ± 0.5 L/h');
  });

  // [baker2017] [cheuvront2017] a sweat test is accurate to about ±0.15 L/h
  it('shows a sweat test, scaled to the event or as measured', () => {
    const { unmount } = renderCard({ sweat: { source: 'test', tests: [TEST] } });
    // The test (1.36 L/h) is 9× the model, but it was done in the event's own conditions:
    // scaling to the event changes nothing, so the plan uses the measured rate.
    expect(text('summary-sweat-source')).toBe('Sweat test, scaled to this event');
    expect(text('summary-sweat-rate')).toBe('1.36 ± 0.15 L/h');
    unmount();

    renderCard({ sweat: { source: 'test', tests: [TEST], calibrate: false } });
    expect(text('summary-sweat-source')).toBe('Sweat test');
    expect(text('summary-sweat-rate')).toBe('1.36 ± 0.15 L/h');
    // 1.36 L/h sweat, 0.8 L/h drunk: 1.69 L lost (2.4 %), a mild deficit.
    expect(text('summary-body-water')).toBe('1.69 L (2.4% of body mass)');
    const level = screen.getByTestId('summary-body-mass-level');
    expect(level).toHaveAttribute('data-level', 'mild');
    expect(level).toHaveTextContent('2–3% loss');
  });

  // [hewbutler2015] drinking more than you sweat means weight gain
  it('flags a projected weight gain with text and an icon, not only color', () => {
    renderCard({ fluid: { mode: 'manual', manualMlPerHour: 800 } });
    expect(text('summary-body-mass')).toBe('+1.5 kg');
    expect(within(sweatGroup()).getByText('Water gained')).toBeInTheDocument();
    expect(text('summary-body-water')).toBe('1.95 L (2.8% of body mass)');
    const level = screen.getByTestId('summary-body-mass-level');
    expect(level).toHaveAttribute('data-level', 'gain');
    expect(level).toHaveTextContent('Weight gain');
    expect(level.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  // [sawka2007] losses above 3 % of body mass hurt performance
  it('flags a large water deficit', () => {
    renderCard({ sweat: { source: 'preset', rateIndex: 5 }, fluid: { mode: 'manual', manualMlPerHour: 0 } });
    expect(text('summary-body-mass')).toBe('−8.7 kg');
    expect(text('summary-body-water')).toBe('8.25 L (11.8% of body mass)');
    const level = screen.getByTestId('summary-body-mass-level');
    expect(level).toHaveAttribute('data-level', 'high');
    expect(level).toHaveTextContent('Over 3% loss');
  });

  it('draws the progress arc from the real share', () => {
    renderCard({ salts: { mode: 'manual', manual: [{ ref: 31, amountMg: 1000 }] } });
    const sodium = ring('ring-sodium');
    // 1,000 mg table salt → 393 mg sodium of 900 mg: 44 %, 507 mg short.
    expect(within(sodium).getByText('393')).toBeInTheDocument();
    expect(within(sodium).getByText('507 mg short')).toBeInTheDocument();
    expect(sodium).toHaveAttribute('data-progress', '44');
    const arc = ringCircles(sodium)[1];
    const circumference = 2 * Math.PI * 36;
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference * (1 - 393 / 900), 0);
    expect(arc.getAttribute('class')).toContain('text-orange-400');
  });

  it('shows sodium above the target as over', () => {
    renderCard({ salts: { mode: 'manual', manual: [{ ref: 31, amountMg: 3000 }] } });
    const sodium = ring('ring-sodium');
    // 3,000 mg table salt → 1,179 mg sodium: 279 mg over 900 mg; the ring is full but says 131 %.
    expect(within(sodium).getByText('1,179')).toBeInTheDocument();
    expect(within(sodium).getByText('279 mg over')).toBeInTheDocument();
    expect(sodium).toHaveAttribute('data-progress', '131');
    expect(within(sodium).getByText('(131%)')).toHaveClass('sr-only');
    const arc = ringCircles(sodium)[1];
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 5);
  });

  it('compares adjusted fluid with the recommended plan', () => {
    renderCard({ sweat: { source: 'preset' }, fluid: { mode: 'manual', manualMlPerHour: 400 } });
    const fluid = ring('ring-fluid');
    expect(within(fluid).getByText('400')).toBeInTheDocument();
    expect(within(fluid).getByText('of 800 ml/h planned')).toBeInTheDocument();
    expect(within(fluid).getByText('Adjusted · range 400–800 ml/h')).toBeInTheDocument();
    expect(fluid).toHaveAttribute('data-progress', '50');
  });

  it('shows carbs and energy short when there is no carb ingredient', () => {
    renderCard({ carbs: { ingredients: [] } });
    // Nothing is delivered, so there is no delivered ratio and nothing on either pathway.
    expect(screen.getByTestId('ratio-value')).toHaveTextContent('0:0');
    expect(screen.getByText('Glucose: 0 g/h')).toBeInTheDocument();
    expect(screen.getByText('Fructose: 0 g/h')).toBeInTheDocument();
    const carbs = ring('ring-carbs');
    expect(within(carbs).getByText('0')).toBeInTheDocument();
    expect(within(carbs).getByText('of 225 g target')).toBeInTheDocument();
    expect(within(carbs).getByText('225 g short · 75 g/h')).toBeInTheDocument();
    expect(carbs).toHaveAttribute('data-progress', '0');
    // No arc at 0 %.
    expect(ringCircles(carbs)).toHaveLength(1);
    const energy = ring('ring-energy');
    expect(within(energy).getByText('of 900 kcal planned')).toBeInTheDocument();
    expect(energy).toHaveAttribute('data-progress', '0');
  });

  it('has no carb target for a short event', () => {
    renderCard({ event: { durationMin: 30 } });
    const carbs = ring('ring-carbs');
    expect(within(carbs).getByText('No carb target')).toBeInTheDocument();
    expect(carbs).toHaveAttribute('data-progress', 'none');
    expect(ringCircles(carbs)).toHaveLength(1);
    expect(within(ring('ring-energy')).getByText('No energy target')).toBeInTheDocument();
    // A [0, 0] range reads as one value, like the carb card.
    expect(within(carbs).getByText('Auto · range 0 g/h')).toBeInTheDocument();
  });

  it('shows the auto ratio the recipe delivers as a glucose/fructose bar', () => {
    renderCard();
    const group = ratioGroup();
    expect(within(group).getByTestId('ratio-value')).toHaveTextContent('1:0.5');
    expect(within(group).getByTestId('ratio-glucose')).toHaveClass('bg-apple-blue');
    expect(within(group).getByTestId('ratio-fructose')).toHaveClass('bg-apple-purple');
    expect(parseFloat(within(group).getByTestId('ratio-glucose').style.width)).toBeCloseTo(66.667, 2);
    expect(parseFloat(within(group).getByTestId('ratio-fructose').style.width)).toBeCloseTo(33.333, 2);
    expect(within(group).getByRole('img')).toHaveAccessibleName('Glucose 67%, fructose 33%');
    expect(within(group).getByText('Glucose: 50 g/h')).toBeInTheDocument();
    expect(within(group).getByText('Fructose: 25 g/h')).toBeInTheDocument();
    expect(within(group).getByText('Auto · recommended 1:0.5 · range 1:0.5–1:1')).toBeInTheDocument();
    expect(within(group).queryByTestId('ratio-target')).not.toBeInTheDocument();
  });

  it('shows an adjusted ratio', () => {
    renderCard({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 0.8 } } });
    const group = ratioGroup();
    expect(within(group).getByTestId('ratio-value')).toHaveTextContent('1:0.8');
    // 0.8 / 1.8 = 44.4 % fructose of 75 g/h.
    expect(parseFloat(within(group).getByTestId('ratio-fructose').style.width)).toBeCloseTo(44.444, 2);
    expect(within(group).getByText('Glucose: 42 g/h')).toBeInTheDocument();
    expect(within(group).getByText('Fructose: 33 g/h')).toBeInTheDocument();
    expect(within(group).getByText('Adjusted · recommended 1:0.5 · range 1:0.5–1:1')).toBeInTheDocument();
  });

  it('shows the ratio the ingredients can make next to the target they cannot reach', () => {
    renderCard({
      carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 1 }, ingredients: [{ ref: 3, weight: 100 }] },
    });
    const group = ratioGroup();
    // Maltodextrin alone is all glucose.
    expect(within(group).getByTestId('ratio-value')).toHaveTextContent('1:0');
    expect(within(group).getByTestId('ratio-target')).toHaveTextContent('Target 1:1: the recipe delivers 1:0.');
    expect(within(group).getByTestId('ratio-glucose').style.width).toBe('100%');
    expect(within(group).getByTestId('ratio-fructose').style.width).toBe('0%');
    expect(within(group).getByText('Glucose: 75 g/h')).toBeInTheDocument();
    expect(within(group).getByText('Fructose: 0 g/h')).toBeInTheDocument();
  });

  it('shows an empty bar for a 0:0 ratio', () => {
    renderCard({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } });
    const group = ratioGroup();
    expect(within(group).getByTestId('ratio-value')).toHaveTextContent('0:0');
    expect(within(group).getByTestId('ratio-glucose').style.width).toBe('0%');
    expect(within(group).getByTestId('ratio-fructose').style.width).toBe('0%');
  });

  it('reveals the carb explanation and its citations through Why', () => {
    renderCard();
    const carbs = ring('ring-carbs');
    const why = within(carbs).getByRole('button', { name: /Why\?/ });
    expect(why).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'true');
    // carbs.why.long via t(): 180 min is in the 60–90 g/h band.
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

  it('has a Why control for sodium, fluid and the ratio', () => {
    renderCard();
    for (const scope of [ring('ring-sodium'), ring('ring-fluid'), ratioGroup()]) {
      expect(within(scope).getByRole('button', { name: /Why\?/ })).toBeInTheDocument();
    }
    fireEvent.click(within(ratioGroup()).getByRole('button', { name: /Why\?/ }));
    expect(within(ratioGroup()).getByText(/Use 1:0.5 glucose to fructose/)).toBeVisible();
  });

  it('says a manual sodium target below the evidence range is below range, not on target', () => {
    renderCard({ sodium: { mode: 'manual', manualMgPerHour: 60 } });
    const sodium = ring('ring-sodium');
    expect(within(sodium).getByText('Below the evidence range')).toBeInTheDocument();
    expect(within(sodium).queryByText('On target')).not.toBeInTheDocument();
    expect(within(sodium).getByText('Adjusted · range 300–600 mg/h')).toBeInTheDocument();
  });

  it('gives every control a label', () => {
    renderCard();
    const card = screen.getByRole('heading', { name: 'Activity Summary' }).closest('.glass-card');
    for (const control of card.querySelectorAll('input, select, textarea, button')) {
      expect(control).toHaveAccessibleName();
    }
  });
});
