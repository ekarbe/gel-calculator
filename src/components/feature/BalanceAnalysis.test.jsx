import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import BalanceAnalysis from './BalanceAnalysis';
import CarbMatrix from './CarbMatrix';
import { PlanProvider } from '../../state/PlanProvider';
import { UiProvider } from '../../state/UiProvider';

function renderCard(initialInputs) {
  return render(
    <UiProvider>
      <PlanProvider initialInputs={initialInputs}>
        <BalanceAnalysis />
      </PlanProvider>
    </UiProvider>,
  );
}

const ring = (testId) => screen.getByTestId(testId);
const ratioGroup = () => screen.getByRole('group', { name: 'Carb Ratio' });
/** The track and (when drawn) the progress arc of a ring. */
const ringCircles = (element) => element.querySelector('svg').querySelectorAll('circle');

describe('BalanceAnalysis', () => {
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

    // Sodium: table salt delivers 1,710 mg of the 1,710 mg target (570 mg/h × 3 h).
    const sodium = ring('ring-sodium');
    expect(within(sodium).getByText('1,710')).toBeInTheDocument();
    expect(within(sodium).getByText('of 1,710 mg target')).toBeInTheDocument();
    expect(within(sodium).getByText('On target')).toBeInTheDocument();
    expect(within(sodium).getByText('Auto · range 300–600 mg/h')).toBeInTheDocument();
    expect(sodium).toHaveAttribute('data-progress', '100');

    // Fluid: 800 ml/h of the 800 ml/h plan.
    const fluid = ring('ring-fluid');
    expect(within(fluid).getByText('800')).toBeInTheDocument();
    expect(within(fluid).getByText('of 800 ml/h planned')).toBeInTheDocument();
    expect(within(fluid).getByText('2,400 ml in total')).toBeInTheDocument();
    expect(within(fluid).getByText('Auto · range 400–800 ml/h')).toBeInTheDocument();
    expect(fluid).toHaveAttribute('data-progress', '100');

    // Energy: 225 g × 4 kcal = 900 kcal of 900 kcal planned (not a fixed 83 % ring).
    const energy = ring('ring-energy');
    expect(within(energy).getByText('900')).toBeInTheDocument();
    expect(within(energy).getByText('of 900 kcal planned')).toBeInTheDocument();
    expect(energy).toHaveAttribute('data-progress', '100');
  });

  it('draws the progress arc from the real share', () => {
    renderCard({ salts: { mode: 'manual', manual: [{ id: 31, amountMg: 2000 }] } });
    const sodium = ring('ring-sodium');
    // 2,000 mg table salt → 786 mg sodium of 1,710 mg: 46 %, 924 mg short.
    expect(within(sodium).getByText('786')).toBeInTheDocument();
    expect(within(sodium).getByText('924 mg short')).toBeInTheDocument();
    expect(sodium).toHaveAttribute('data-progress', '46');
    const arc = ringCircles(sodium)[1];
    const circumference = 2 * Math.PI * 36;
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference * (1 - 786 / 1710), 1);
    expect(arc.getAttribute('class')).toContain('text-orange-400');
  });

  it('shows sodium above the target as over', () => {
    renderCard({ salts: { mode: 'manual', manual: [{ id: 31, amountMg: 6000 }] } });
    const sodium = ring('ring-sodium');
    // 6,000 mg table salt → 2,358 mg sodium: 648 mg over 1,710 mg; the ring is full but says 138 %.
    expect(within(sodium).getByText('2,358')).toBeInTheDocument();
    expect(within(sodium).getByText('648 mg over')).toBeInTheDocument();
    expect(sodium).toHaveAttribute('data-progress', '138');
    expect(within(sodium).getByText('(138%)')).toHaveClass('sr-only');
    const arc = ringCircles(sodium)[1];
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 5);
  });

  it('compares adjusted fluid with the recommended plan', () => {
    renderCard({ fluid: { mode: 'manual', manualMlPerHour: 400 } });
    const fluid = ring('ring-fluid');
    expect(within(fluid).getByText('400')).toBeInTheDocument();
    expect(within(fluid).getByText('of 800 ml/h planned')).toBeInTheDocument();
    expect(within(fluid).getByText('Adjusted · range 400–800 ml/h')).toBeInTheDocument();
    expect(fluid).toHaveAttribute('data-progress', '50');
  });

  it('shows carbs and energy short when the sources cannot make the mix', () => {
    renderCard({
      carbs: {
        ratioMode: 'manual',
        manualRatio: { glucose: 1, fructose: 1 },
        glucoseSources: [{ id: 3, percentage: 100 }],
        fructoseSources: [],
      },
    });
    const carbs = ring('ring-carbs');
    expect(within(carbs).getByText('0')).toBeInTheDocument();
    expect(within(carbs).getByText('of 225 g target')).toBeInTheDocument();
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
  });

  it('shows the effective auto ratio as a glucose/fructose bar', () => {
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

  it('reads delivered carbs and energy from the plan when the sources cannot make the ratio', () => {
    // A tiny target (0.4 g) the sources cannot make: nothing is delivered.
    renderCard({
      event: { durationMin: 24 },
      carbs: {
        mode: 'manual',
        manualGPerHour: 1,
        ratioMode: 'manual',
        manualRatio: { glucose: 1, fructose: 1 },
        fructoseSources: [{ id: 14, percentage: 300 }],
      },
    });
    const carbs = ring('ring-carbs');
    expect(within(carbs).getByText('0')).toBeInTheDocument();
    expect(carbs).toHaveAttribute('data-progress', '0');
    expect(within(ring('ring-energy')).getByText('0')).toBeInTheDocument();
  });

  it('says a manual sodium target below the evidence range is below range, not on target', () => {
    renderCard({ sodium: { mode: 'manual', manualMgPerHour: 60 } });
    const sodium = ring('ring-sodium');
    expect(within(sodium).getByText('Below the evidence range')).toBeInTheDocument();
    expect(within(sodium).queryByText('On target')).not.toBeInTheDocument();
    expect(within(sodium).getByText('Adjusted · range 300–600 mg/h')).toBeInTheDocument();
  });

  it('shows a manual ratio the same way as the Carb Matrix card', () => {
    render(
      <UiProvider>
        <PlanProvider initialInputs={{ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0.95, fructose: 0.85 } } }}>
          <CarbMatrix />
          <BalanceAnalysis />
        </PlanProvider>
      </UiProvider>,
    );
    expect(screen.getByTestId('carb-ratio-value')).toHaveTextContent('1:0.89');
    expect(within(ratioGroup()).getByTestId('ratio-value')).toHaveTextContent('1:0.89');
  });

  it('shows a [0, 0] range as one value, like the carb card', () => {
    renderCard({ event: { durationMin: 30 } });
    expect(within(ring('ring-carbs')).getByText('Auto · range 0 g/h')).toBeInTheDocument();
  });
});
