import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import CarbMatrix from './CarbMatrix';
import { PlanProvider, usePlanInputs, usePlan } from '../../state/PlanProvider';
import { UiProvider } from '../../state/UiProvider';
import { t } from '../../i18n';

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

function renderMatrix(initialInputs) {
  return render(
    <PlanProvider initialInputs={initialInputs}>
      <UiProvider>
        <CarbMatrix />
        <Spy />
      </UiProvider>
    </PlanProvider>,
  );
}

const region = (name) => screen.getByRole('region', { name });
const ratioRegion = () => region('Pathway Ratio');
const glucoseRegion = () => region('Glucose Sources');
const fructoseRegion = () => region('Fructose Sources');
const modeButton = (name) => within(within(ratioRegion()).getByRole('group', { name: 'Ratio mode' })).getByRole('button', { name });
const ratioValue = () => within(ratioRegion()).getByTestId('carb-ratio-value');
const fact = (term) => within(ratioRegion()).getByText(term).nextElementSibling;
const warningsIn = (container) => within(container).queryByRole('list', { name: 'Warnings' });

let warnSpy;

beforeEach(() => {
  latest.inputs = null;
  latest.plan = null;
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  // No domain message may fall back to its raw key.
  const missing = warnSpy.mock.calls.filter(([msg]) => String(msg).startsWith('[i18n] Missing'));
  expect(missing).toEqual([]);
  warnSpy.mockRestore();
  cleanup();
});

describe('CarbMatrix', () => {
  describe('ratio in Auto mode', () => {
    it('shows the recommended ratio, its allowed range and the fructose share for the default plan', () => {
      renderMatrix();
      expect(screen.getByRole('heading', { name: 'Carbohydrate Matrix' })).toBeInTheDocument();
      expect(modeButton('Auto')).toHaveAttribute('aria-pressed', 'true');
      expect(modeButton('Adjust')).toHaveAttribute('aria-pressed', 'false');

      // Default plan: 180 min moderate → 75 g/h → 2:1 (1:0.5), allowed 1:0.5–1:1.
      expect(within(ratioRegion()).getByText('Recommended ratio')).toBeInTheDocument();
      expect(ratioValue()).toHaveTextContent('1:0.5');
      expect(within(ratioRegion()).getByText(/at your 75 g\/h target/)).toBeInTheDocument();
      expect(fact('Allowed range')).toHaveTextContent('1:0.5–1:1');
      expect(fact('Fructose share')).toHaveTextContent('33% (allowed 33–50%)');

      // No sliders and no warnings in Auto mode.
      expect(screen.queryByLabelText('Glucose parts')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Fructose parts')).not.toBeInTheDocument();
      expect(warningsIn(ratioRegion())).not.toBeInTheDocument();
    });

    it('follows the carb target: 1:0.8 at 120 g/h', () => {
      renderMatrix({ carbs: { mode: 'manual', manualGPerHour: 120 } });
      expect(ratioValue()).toHaveTextContent('1:0.8');
      expect(fact('Allowed range')).toHaveTextContent('1:0.8–1:1');
      expect(fact('Fructose share')).toHaveTextContent('44% (allowed 44–50%)');
      expect(latest.plan.carbs.ratio.value).toEqual({ glucose: 1, fructose: 0.8 });
    });

    it('allows glucose alone at low intakes (1:0–1:1 at 15 g/h)', () => {
      renderMatrix({ event: { durationMin: 60 } });
      expect(within(ratioRegion()).getByText(/at your 15 g\/h target/)).toBeInTheDocument();
      expect(fact('Allowed range')).toHaveTextContent('1:0–1:1');
    });

    // [jeukendrup2014] glucose alone works at ≤ 60 g/h, so glucose-only sources still make a recipe
    it('uses 1:0 with a note when only glucose sources are listed at 55 g/h', () => {
      renderMatrix({ event: { durationMin: 120 }, carbs: { fructoseSources: [] } });
      expect(ratioValue()).toHaveTextContent('1:0');
      const warnings = within(ratioRegion()).getByRole('list', { name: 'Warnings' });
      const items = [...warnings.children];
      expect(items).toHaveLength(1);
      expect(items[0]).toHaveAttribute('data-level', 'info');
      expect(items[0]).toHaveTextContent(
        'Your carb sources cannot make the recommended 1:0.5 glucose to fructose mix. The plan uses 1:0, which is still in the allowed range at 55 g/h.',
      );
      expect(latest.plan.carbs.sources.canAchieveRatio).toBe(true);
    });

    it('reveals the explanation and citation links behind "Why?"', () => {
      renderMatrix();
      const why = within(ratioRegion()).getByRole('button', { name: /Why\?/ });
      expect(why).toHaveAttribute('aria-expanded', 'false');
      const summary = t(latest.plan.carbs.ratio.recommended.why.summary);
      expect(summary).toMatch(/Use 1:0.5 glucose to fructose/);
      expect(within(ratioRegion()).getByText(summary)).not.toBeVisible();

      fireEvent.click(why);
      expect(why).toHaveAttribute('aria-expanded', 'true');
      expect(within(ratioRegion()).getByText(summary)).toBeVisible();
      const sources = within(ratioRegion()).getByRole('list', { name: 'Sources' });
      const link = within(sources).getByRole('link', { name: 'Jeukendrup 2014' });
      expect(link).toHaveAttribute('href', 'https://doi.org/10.1007/s40279-014-0148-z');
      expect(within(sources).getByRole('link', { name: 'Rowlands et al. 2015' })).toBeInTheDocument();
    });
  });

  describe('ratio in Adjust mode', () => {
    it('starts from the ratio in use and shows the part sliders', () => {
      renderMatrix();
      fireEvent.click(modeButton('Adjust'));

      expect(modeButton('Adjust')).toHaveAttribute('aria-pressed', 'true');
      expect(latest.inputs.carbs.ratioMode).toBe('manual');
      // The recommended 1:0.5, not the stored default 1:0.8, so nothing jumps.
      expect(latest.inputs.carbs.manualRatio).toEqual({ glucose: 1, fructose: 0.5 });
      expect(within(ratioRegion()).getByText('Your ratio')).toBeInTheDocument();
      expect(ratioValue()).toHaveTextContent('1:0.5');
      expect(fact('Recommended')).toHaveTextContent('1:0.5');

      expect(screen.getByLabelText('Glucose parts')).toHaveValue('1');
      expect(screen.getByLabelText('Fructose parts')).toHaveValue('0.5');
      expect(warningsIn(ratioRegion())).not.toBeInTheDocument();
    });

    it('changes the manual ratio with the +/- buttons and the sliders', () => {
      renderMatrix({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 0.8 } } });

      fireEvent.click(screen.getByRole('button', { name: 'Increase fructose parts' }));
      expect(latest.inputs.carbs.manualRatio.fructose).toBe(0.85);
      fireEvent.click(screen.getByRole('button', { name: 'Decrease glucose parts' }));
      expect(latest.inputs.carbs.manualRatio.glucose).toBe(0.95);
      // Shown normalized to glucose 1, like every other card (0.85 / 0.95 = 0.89).
      expect(ratioValue()).toHaveTextContent('1:0.89');

      fireEvent.change(screen.getByLabelText('Fructose parts'), { target: { value: '0.6' } });
      expect(latest.inputs.carbs.manualRatio.fructose).toBe(0.6);
      expect(latest.plan.carbs.ratio.value).toEqual({ glucose: 0.95, fructose: 0.6 });
    });

    it('stops the buttons at 0 and 2', () => {
      renderMatrix({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 2, fructose: 0 } } });
      expect(screen.getByRole('button', { name: 'Increase glucose parts' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Decrease fructose parts' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Decrease glucose parts' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Increase fructose parts' })).toBeEnabled();
    });

    it('keeps a part above 2 from a share link visible and lets it step down', () => {
      renderMatrix({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 3, fructose: 1 } } });
      const slider = screen.getByLabelText('Glucose parts');
      expect(slider).toHaveAttribute('max', '3');
      expect(slider).toHaveValue('3');
      fireEvent.click(screen.getByRole('button', { name: 'Decrease glucose parts' }));
      expect(latest.inputs.carbs.manualRatio.glucose).toBe(2.95);
    });

    it('warns when the ratio has too little fructose for the carb target', () => {
      renderMatrix({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 0.5 } } });
      fireEvent.change(screen.getByLabelText('Fructose parts'), { target: { value: '0' } });

      const list = warningsIn(ratioRegion());
      expect(list).toBeInTheDocument();
      const item = within(list).getByText(/At 75 g\/h, use at least 1:0.5 glucose to fructose/).closest('li');
      expect(item).toHaveAttribute('data-level', 'warning');
      expect(latest.plan.carbs.ratio.warnings.map((w) => w.id)).toEqual(['carbs.tooLittleFructose']);
    });

    it('warns when there is more fructose than glucose', () => {
      renderMatrix({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0.5, fructose: 1 } } });
      const list = warningsIn(ratioRegion());
      expect(within(list).getByText(/Use no more fructose than glucose/)).toBeInTheDocument();
    });

    it('flags a 0:0 ratio as danger, without a second infeasibility warning', () => {
      renderMatrix({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } });
      const list = warningsIn(ratioRegion());
      const items = list.querySelectorAll(':scope > li');
      expect(items).toHaveLength(1);
      expect(items[0]).toHaveAttribute('data-level', 'danger');
      expect(items[0]).toHaveTextContent(/Set at least one ratio part above zero/);
    });

    it('returns to the recommendation in Auto mode', () => {
      renderMatrix({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 0 } } });
      expect(warningsIn(ratioRegion())).toBeInTheDocument();

      fireEvent.click(modeButton('Auto'));
      expect(latest.inputs.carbs.ratioMode).toBe('auto');
      expect(ratioValue()).toHaveTextContent('1:0.5');
      expect(screen.queryByLabelText('Glucose parts')).not.toBeInTheDocument();
      expect(warningsIn(ratioRegion())).not.toBeInTheDocument();
    });
  });

  describe('source lists', () => {
    it('shows the default sources by id with their allocation', () => {
      renderMatrix();
      const glucoseSelect = within(glucoseRegion()).getByLabelText('Glucose source 1');
      expect(glucoseSelect).toHaveValue('3');
      expect(glucoseSelect).toHaveDisplayValue('Maltodextrin');
      expect(within(glucoseRegion()).getByLabelText('Maltodextrin share (%)')).toHaveValue(100);
      expect(within(glucoseRegion()).getByText('100% Allocated')).toBeInTheDocument();

      const fructoseSelect = within(fructoseRegion()).getByLabelText('Fructose source 1');
      expect(fructoseSelect).toHaveValue('11');
      expect(fructoseSelect).toHaveDisplayValue('Crystalline Fructose');
      expect(within(fructoseRegion()).getByText('100% Allocated')).toBeInTheDocument();
    });

    it('shows carbs per gram and the glucose/fructose split of each source', () => {
      renderMatrix({ carbs: { fructoseSources: [{ id: 14, percentage: 100 }] } });
      expect(within(glucoseRegion()).getByText('0.95g Carbs / 1g')).toBeInTheDocument();
      expect(within(glucoseRegion()).getByText(/Glucose: 100% \| Fructose:\s*0%/)).toBeInTheDocument();
      expect(within(fructoseRegion()).getByText('0.82g Carbs / 1g')).toBeInTheDocument();
      expect(within(fructoseRegion()).getByText(/Glucose: 50% \| Fructose:\s*50%/)).toBeInTheDocument();
    });

    it('picks a source by id and disables options used in another row', () => {
      renderMatrix({ carbs: { glucoseSources: [{ id: 3, percentage: 50 }, { id: 1, percentage: 50 }] } });
      const first = within(glucoseRegion()).getByLabelText('Glucose source 1');
      expect(within(first).getByRole('option', { name: 'Dextrose (anhydrous)' })).toBeDisabled();
      expect(within(first).getByRole('option', { name: 'Maltodextrin' })).toBeEnabled();

      fireEvent.change(first, { target: { value: '2' } });
      expect(latest.inputs.carbs.glucoseSources).toEqual([
        { id: 2, percentage: 50 },
        { id: 1, percentage: 50 },
      ]);
      expect(first).toHaveDisplayValue('Glucose Syrup');
    });

    it('updates percentages and the allocation badge', () => {
      renderMatrix();
      const input = within(glucoseRegion()).getByLabelText('Maltodextrin share (%)');

      fireEvent.change(input, { target: { value: '120' } });
      expect(latest.inputs.carbs.glucoseSources[0].percentage).toBe(120);
      expect(within(glucoseRegion()).getByText('Over by 20%')).toBeInTheDocument();

      fireEvent.change(input, { target: { value: '60' } });
      expect(within(glucoseRegion()).getByText('40% Remaining')).toBeInTheDocument();

      // Clearing the field means 0%; it shows empty with a "0" placeholder.
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);
      expect(latest.inputs.carbs.glucoseSources[0].percentage).toBe(0);
      expect(input).toHaveValue(null);
      expect(input).toHaveAttribute('placeholder', '0');
      expect(within(glucoseRegion()).getByText('100% Remaining')).toBeInTheDocument();
    });

    it('adds the first unused option at 0%', () => {
      renderMatrix();
      fireEvent.click(within(glucoseRegion()).getByRole('button', { name: 'Add glucose source' }));
      expect(latest.inputs.carbs.glucoseSources).toEqual([
        { id: 3, percentage: 100 },
        { id: 1, percentage: 0 },
      ]);
      expect(within(glucoseRegion()).getByLabelText('Glucose source 2')).toHaveDisplayValue('Dextrose (anhydrous)');

      fireEvent.click(within(fructoseRegion()).getByRole('button', { name: 'Add fructose source' }));
      expect(latest.inputs.carbs.fructoseSources).toEqual([
        { id: 11, percentage: 100 },
        { id: 12, percentage: 0 },
      ]);
    });

    it('disables Add once every option is in the list', () => {
      const all = [1, 8, 2, 3, 4, 5, 6, 7].map((id) => ({ id, percentage: 12.5 }));
      renderMatrix({ carbs: { glucoseSources: all } });
      expect(within(glucoseRegion()).getByRole('button', { name: 'Add glucose source' })).toBeDisabled();
      expect(within(glucoseRegion()).getByText('100% Allocated')).toBeInTheDocument();
    });

    it('removes a source and warns when the ratio can no longer be made', () => {
      renderMatrix();
      expect(latest.plan.carbs.sources.canAchieveRatio).toBe(true);
      expect(warningsIn(ratioRegion())).not.toBeInTheDocument();

      fireEvent.click(within(fructoseRegion()).getByRole('button', { name: 'Remove Crystalline Fructose' }));
      expect(latest.inputs.carbs.fructoseSources).toEqual([]);
      expect(within(fructoseRegion()).getByText('No fructose sources yet.')).toBeInTheDocument();
      expect(latest.plan.carbs.sources.canAchieveRatio).toBe(false);

      const list = warningsIn(ratioRegion());
      expect(within(list).getByText(/Your carb sources cannot make a 1:0.5 glucose to fructose mix/)).toBeInTheDocument();

      // Adding a fructose source back makes the ratio reachable again.
      fireEvent.click(within(fructoseRegion()).getByRole('button', { name: 'Add fructose source' }));
      fireEvent.change(within(fructoseRegion()).getByLabelText('Crystalline Fructose share (%)'), {
        target: { value: '100' },
      });
      expect(latest.plan.carbs.sources.canAchieveRatio).toBe(true);
      expect(warningsIn(ratioRegion())).not.toBeInTheDocument();
    });

    it('removes the right row by position', () => {
      renderMatrix({ carbs: { glucoseSources: [{ id: 3, percentage: 70 }, { id: 1, percentage: 30 }] } });
      fireEvent.click(within(glucoseRegion()).getByRole('button', { name: 'Remove Maltodextrin' }));
      expect(latest.inputs.carbs.glucoseSources).toEqual([{ id: 1, percentage: 30 }]);
      expect(within(glucoseRegion()).getByLabelText('Glucose source 1')).toHaveDisplayValue('Dextrose (anhydrous)');
    });
  });

  it('gives every form control an id and an associated label', () => {
    const { container } = renderMatrix({
      carbs: {
        ratioMode: 'manual',
        glucoseSources: [{ id: 3, percentage: 60 }, { id: 1, percentage: 40 }],
        fructoseSources: [{ id: 11, percentage: 100 }],
      },
    });
    const controls = container.querySelectorAll('input, select, textarea');
    expect(controls.length).toBe(2 + 2 * 2 + 2); // 2 sliders, 2 glucose rows, 1 fructose row
    for (const control of controls) {
      expect(control.id).not.toBe('');
      expect(container.querySelector(`label[for="${control.id}"]`)).not.toBeNull();
      expect(screen.getByLabelText(container.querySelector(`label[for="${control.id}"]`).textContent)).toBe(control);
    }
    const ids = [...controls].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('needs a PlanProvider', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<CarbMatrix />)).toThrow(/must be used inside <PlanProvider>/);
    error.mockRestore();
  });
});
