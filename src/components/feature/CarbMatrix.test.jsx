import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

/**
 * Renders the card with the real providers. Autosave is off, so no test
 * reads inputs that an earlier test left in localStorage.
 */
function renderMatrix(initialInputs) {
  return render(
    <PlanProvider initialInputs={initialInputs} persist={false}>
      <UiProvider>
        <CarbMatrix />
        <Spy />
      </UiProvider>
    </PlanProvider>,
  );
}

const region = (name) => screen.getByRole('region', { name });
const ratioRegion = () => region('Pathway Ratio');
const ingredientsRegion = () => region('Ingredients');
const customRegion = () => region('Your ingredients');
const modeButton = (name) =>
  within(within(ratioRegion()).getByRole('group', { name: 'Ratio mode' })).getByRole('button', { name });
const ratioValue = () => within(ratioRegion()).getByTestId('carb-ratio-value');
const fact = (term) => within(ratioRegion()).getByText(term).nextElementSibling;
const warningsIn = (container) => within(container).queryByRole('list', { name: 'Warnings' });
const rangeBar = () => within(ingredientsRegion()).getByRole('figure', { name: 'Ratios your ingredients can make' });
/** The value next to a legend term of the range bar. */
const legend = (term) => within(rangeBar()).getByText(term).closest('div').querySelector('dd');
const ingredientList = () => within(ingredientsRegion()).queryByRole('list', { name: 'Ingredient list' });
/** The list item of the ingredient whose name is `name`. */
const row = (name) =>
  within(ingredientList())
    .getAllByRole('listitem')
    .find((li) => li.querySelector('p span')?.textContent === name);
const usage = (name) => within(row(name)).getByTestId('ingredient-usage');
const addSelect = () => within(ingredientsRegion()).getByLabelText('Add an ingredient');
const optionLabels = (group) => [...group.querySelectorAll('option')].map((o) => o.textContent);

/** Types into a field like a user would: change, then leave the field. */
function enter(input, value) {
  fireEvent.change(input, { target: { value: String(value) } });
  fireEvent.blur(input);
}

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
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
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
      expect(warningsIn(ingredientsRegion())).not.toBeInTheDocument();
    });

    it('follows the carb target: 1:0.8 at 120 g/h', () => {
      renderMatrix({ carbs: { mode: 'manual', manualGPerHour: 120 } });
      expect(ratioValue()).toHaveTextContent('1:0.8');
      expect(fact('Allowed range')).toHaveTextContent('1:0.8–1:1');
      expect(fact('Fructose share')).toHaveTextContent('44% (allowed 44–50%)');
      expect(latest.plan.carbs.ratio.value).toEqual({ glucose: 1, fructose: 0.8 });
      expect(legend('Target')).toHaveTextContent('1:0.8');
      expect(legend('Your recipe')).toHaveTextContent('1:0.8');
    });

    it('allows glucose alone at low intakes (1:0–1:1 at 15 g/h)', () => {
      renderMatrix({ event: { durationMin: 60 } });
      expect(within(ratioRegion()).getByText(/at your 15 g\/h target/)).toBeInTheDocument();
      expect(fact('Allowed range')).toHaveTextContent('1:0–1:1');
      expect(legend('Allowed')).toHaveTextContent('1:0–1:1');
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
      expect(legend('Target')).toHaveTextContent('1:0.89');

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

    it('flags a 0:0 ratio as danger, without a solver warning or a target marker', () => {
      renderMatrix({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } });
      const items = warningsIn(ratioRegion()).querySelectorAll(':scope > li');
      expect(items).toHaveLength(1);
      expect(items[0]).toHaveAttribute('data-level', 'danger');
      expect(items[0]).toHaveTextContent(/Set at least one ratio part above zero/);

      expect(warningsIn(ingredientsRegion())).not.toBeInTheDocument();
      expect(legend('Target')).toHaveTextContent('0:0');
      expect(legend('Your recipe')).toHaveTextContent('No carbs yet');
      expect(within(rangeBar()).queryByTestId('ratio-range-target')).not.toBeInTheDocument();
      expect(within(rangeBar()).queryByTestId('ratio-range-recipe')).not.toBeInTheDocument();
      expect(usage('Maltodextrin')).toHaveTextContent('Not used. The plan has no carbs to split.');
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

  describe('reachable ratio range', () => {
    it('draws the reachable range, the allowed range, the target and the recipe ratio for the default plan', () => {
      renderMatrix();
      expect(legend('Reachable')).toHaveTextContent('1:0–0:1');
      expect(legend('Allowed')).toHaveTextContent('1:0.5–1:1');
      expect(legend('Target')).toHaveTextContent('1:0.5');
      expect(legend('Your recipe')).toHaveTextContent('1:0.5');

      const bar = rangeBar();
      expect(within(bar).getByTestId('ratio-range-reachable')).toBeInTheDocument();
      expect(within(bar).getByTestId('ratio-range-allowed')).toBeInTheDocument();
      // Positions are the fructose share on a 1:0 → 0:1 scale: 1:0.5 is a third of the way.
      expect(parseFloat(within(bar).getByTestId('ratio-range-target').style.left)).toBeCloseTo(100 / 3, 6);
      expect(parseFloat(within(bar).getByTestId('ratio-range-recipe').style.left)).toBeCloseTo(100 / 3, 6);
      expect(within(ingredientsRegion()).queryByTestId('ratio-substituted')).not.toBeInTheDocument();
    });

    it('shows no allowed band in Adjust mode: the target is the only allowed ratio', () => {
      renderMatrix({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 0.8 } } });
      expect(within(rangeBar()).queryByText('Allowed')).not.toBeInTheDocument();
      expect(within(rangeBar()).queryByTestId('ratio-range-allowed')).not.toBeInTheDocument();
      expect(legend('Target')).toHaveTextContent('1:0.8');
      expect(legend('Your recipe')).toHaveTextContent('1:0.8');
      expect(parseFloat(within(rangeBar()).getByTestId('ratio-range-target').style.left)).toBeCloseTo(
        (0.8 / 1.8) * 100,
        6,
      );
    });

    // [jeukendrup2014] glucose alone works at ≤ 60 g/h, so glucose-only ingredients still make a recipe
    it('uses 1:0 without a warning when only glucose ingredients are listed at 55 g/h', () => {
      renderMatrix({ event: { durationMin: 120 }, carbs: { ingredients: [{ ref: 3, weight: 100 }] } });
      expect(legend('Reachable')).toHaveTextContent('1:0 only');
      expect(legend('Target')).toHaveTextContent('1:0.5');
      expect(legend('Your recipe')).toHaveTextContent('1:0');
      expect(parseFloat(within(rangeBar()).getByTestId('ratio-range-recipe').style.left)).toBe(0);
      expect(within(ingredientsRegion()).getByTestId('ratio-substituted')).toHaveTextContent(
        'Your ingredients cannot make 1:0.5. The recipe uses 1:0, which is still in the allowed range at 55 g/h.',
      );
      expect(warningsIn(ingredientsRegion())).not.toBeInTheDocument();
      expect(latest.plan.carbs.ingredients.adjusted).toBe(true);
    });

    it('uses 1:1 from honey alone, which is inside the allowed range at 75 g/h', () => {
      renderMatrix({ carbs: { ingredients: [{ ref: 14, weight: 100 }] } });
      expect(legend('Reachable')).toHaveTextContent('1:1 only');
      expect(legend('Your recipe')).toHaveTextContent('1:1');
      expect(within(ingredientsRegion()).getByTestId('ratio-substituted')).toHaveTextContent(
        'The recipe uses 1:1, which is still in the allowed range at 75 g/h.',
      );
    });

    it('warns when the ingredients cannot reach the allowed range', () => {
      renderMatrix({ carbs: { ingredients: [{ ref: 3, weight: 100 }] } });
      const list = warningsIn(ingredientsRegion());
      const items = [...list.children];
      expect(items).toHaveLength(1);
      expect(items[0]).toHaveAttribute('data-level', 'warning');
      expect(items[0]).toHaveTextContent(
        'Your ingredients cannot make 1:0.5 glucose to fructose. The recipe uses 1:0, the closest they can make.',
      );
      expect(within(items[0]).getByRole('link', { name: 'Jeukendrup 2014' })).toBeInTheDocument();
      expect(within(ingredientsRegion()).queryByTestId('ratio-substituted')).not.toBeInTheDocument();
      expect(legend('Your recipe')).toHaveTextContent('1:0');
    });

    it('says when there is nothing to make the carbs from', () => {
      renderMatrix({ carbs: { ingredients: [] } });
      expect(within(ingredientsRegion()).getByText('No ingredients yet. Add one below.')).toBeInTheDocument();
      expect(ingredientList()).not.toBeInTheDocument();
      expect(legend('Reachable')).toHaveTextContent('None');
      expect(legend('Your recipe')).toHaveTextContent('No carbs yet');
      expect(within(rangeBar()).queryByTestId('ratio-range-reachable')).not.toBeInTheDocument();
      const list = warningsIn(ingredientsRegion());
      expect(within(list).getByText(/Add at least one carb ingredient/)).toBeInTheDocument();
    });

    it('has no recipe ratio and no warning when the plan has no carbs', () => {
      renderMatrix({ event: { durationMin: 30 } });
      expect(legend('Reachable')).toHaveTextContent('1:0–0:1');
      expect(legend('Your recipe')).toHaveTextContent('No carbs yet');
      expect(warningsIn(ingredientsRegion())).not.toBeInTheDocument();
      expect(usage('Crystalline Fructose')).toHaveTextContent('Not used. The plan has no carbs to split.');
    });
  });

  describe('ingredient list', () => {
    it('shows the default ingredients with their kind, data, weight and amount in the recipe', () => {
      renderMatrix();
      const names = within(ingredientList())
        .getAllByRole('listitem')
        .map((li) => li.querySelector('p span').textContent);
      expect(names).toEqual(['Maltodextrin', 'Crystalline Fructose']);

      expect(row('Maltodextrin')).toHaveTextContent('Powder');
      expect(row('Maltodextrin')).toHaveTextContent('95 g carbs per 100 g · glucose 100% · fructose 0%');
      expect(screen.getByLabelText('Weight of Maltodextrin')).toHaveValue(67);
      expect(screen.getByLabelText('Weight of Maltodextrin (slider)')).toHaveValue('67');
      // 225 g of carbs at 1:0.5: 150 g from maltodextrin (157.9 g powder) and 75 g from fructose.
      expect(usage('Maltodextrin')).toHaveTextContent('In the recipe: 158 g, 67% of the carbs.');
      expect(usage('Crystalline Fructose')).toHaveTextContent('In the recipe: 75 g, 33% of the carbs.');
      expect(screen.getByLabelText('Weight of Crystalline Fructose')).toHaveValue(33);
    });

    it('describes syrups and mixed ingredients', () => {
      renderMatrix({ carbs: { ingredients: [{ ref: 3, weight: 50 }, { ref: 14, weight: 50 }] } });
      expect(row('Honey')).toHaveTextContent('Syrup');
      expect(row('Honey')).toHaveTextContent('82 g carbs per 100 g · glucose 50% · fructose 50%');
    });

    it('changes a weight with the number field and the slider, and the recipe follows', () => {
      renderMatrix({
        carbs: {
          ingredients: [
            { ref: 3, weight: 67 },
            { ref: 11, weight: 33 },
            { ref: 18, weight: 50 },
          ],
        },
      });
      // Preferred 67:33:50 cannot keep 1:0.5 exactly, so the solver moves the split as little as it can.
      expect(usage('Sucrose (Cane Sugar)')).toHaveTextContent('In the recipe: 75 g, 33% of the carbs.');

      const sucrose = screen.getByLabelText('Weight of Sucrose (Cane Sugar)');
      enter(sucrose, 0);
      expect(latest.inputs.carbs.ingredients[2]).toEqual({ ref: 18, weight: 0 });
      // 67:33 already makes 1:0.5, so sucrose is not needed.
      expect(usage('Sucrose (Cane Sugar)')).toHaveTextContent('Not used. The mix reaches the ratio without it.');
      expect(latest.plan.carbs.ingredients.items.map((item) => item.ref)).toEqual([3, 11]);
      expect(screen.getByLabelText('Weight of Sucrose (Cane Sugar) (slider)')).toHaveValue('0');

      fireEvent.change(screen.getByLabelText('Weight of Sucrose (Cane Sugar) (slider)'), { target: { value: '80' } });
      expect(latest.inputs.carbs.ingredients[2].weight).toBe(80);
      expect(sucrose).toHaveValue(80);
      expect(latest.plan.carbs.ingredients.items.map((item) => item.ref)).toEqual([3, 11, 18]);
    });

    it('treats a cleared weight as 0', () => {
      renderMatrix();
      const input = screen.getByLabelText('Weight of Maltodextrin');
      fireEvent.change(input, { target: { value: '' } });
      expect(latest.inputs.carbs.ingredients[0].weight).toBe(0);
      fireEvent.blur(input);
      expect(input).toHaveValue(0);
    });

    it('removes the right row', () => {
      renderMatrix({ carbs: { ingredients: [{ ref: 3, weight: 60 }, { ref: 1, weight: 30 }, { ref: 11, weight: 40 }] } });
      fireEvent.click(within(ingredientsRegion()).getByRole('button', { name: 'Remove Dextrose (anhydrous)' }));
      expect(latest.inputs.carbs.ingredients).toEqual([
        { ref: 3, weight: 60 },
        { ref: 11, weight: 40 },
      ]);
      expect(screen.getByLabelText('Weight of Crystalline Fructose')).toHaveValue(40);
    });

    it('notes an ingredient listed twice (from a share link) once', () => {
      renderMatrix({ carbs: { ingredients: [{ ref: 3, weight: 40 }, { ref: 11, weight: 33 }, { ref: 3, weight: 27 }] } });
      const rows = within(ingredientList()).getAllByRole('listitem');
      expect(rows).toHaveLength(3);
      expect(within(rows[0]).getByTestId('ingredient-usage')).toHaveTextContent('In the recipe: 158 g');
      expect(within(rows[2]).getByTestId('ingredient-usage')).toHaveTextContent('Listed above too. The two weights add up.');
    });
  });

  describe('adding ingredients', () => {
    it('groups the unused ingredients into powders and syrups', () => {
      renderMatrix();
      const groups = [...addSelect().querySelectorAll('optgroup')];
      expect(groups.map((g) => g.label)).toEqual(['Powders', 'Syrups']);
      // Listed ingredients (maltodextrin, fructose) are not offered again.
      expect(optionLabels(groups[0])).toEqual([
        'Dextrose (anhydrous)',
        'Dextrose (monohydrate)',
        'Maltose',
        'Highly Branched Cyclic Dextrin (HBCD)',
        'Sucrose (Cane Sugar)',
        'Coconut Sugar',
      ]);
      expect(optionLabels(groups[1])).toContain('Honey');
      expect(optionLabels(groups[1])).toContain('Glucose Syrup');
      expect(addSelect()).toHaveDisplayValue('Dextrose (anhydrous)');
    });

    it('adds the chosen ingredient with weight 50', () => {
      renderMatrix();
      fireEvent.change(addSelect(), { target: { value: '14' } });
      expect(addSelect()).toHaveDisplayValue('Honey');
      fireEvent.click(within(ingredientsRegion()).getByRole('button', { name: 'Add' }));

      expect(latest.inputs.carbs.ingredients).toEqual([
        { ref: 3, weight: 67 },
        { ref: 11, weight: 33 },
        { ref: 14, weight: 50 },
      ]);
      expect(screen.getByLabelText('Weight of Honey')).toHaveValue(50);
      expect(latest.plan.carbs.ingredients.items.map((item) => item.ref)).toContain(14);
      // Honey is no longer offered; the menu falls back to the first ingredient left.
      expect(optionLabels(addSelect())).not.toContain('Honey');
      expect(addSelect()).toHaveDisplayValue('Dextrose (anhydrous)');
    });

    it('says so when every ingredient is listed', () => {
      const all = [1, 8, 2, 3, 4, 5, 6, 7, 11, 12, 13, 14, 15, 16, 20, 17, 18, 19].map((ref) => ({ ref, weight: 10 }));
      renderMatrix({ carbs: { ingredients: all } });
      expect(within(ingredientsRegion()).queryByLabelText('Add an ingredient')).not.toBeInTheDocument();
      expect(within(ingredientsRegion()).getByText('Every ingredient is in the list.')).toBeInTheDocument();
    });

    it('offers your own ingredients that are not in the list', () => {
      renderMatrix({
        carbs: { custom: [{ key: 'c1', name: 'Gel X', carbsPer100g: 60, fructoseSharePct: 50 }] },
      });
      const groups = [...addSelect().querySelectorAll('optgroup')];
      expect(groups.map((g) => g.label)).toEqual(['Powders', 'Syrups', 'Your ingredients']);
      expect(optionLabels(groups[2])).toEqual(['Gel X']);

      fireEvent.change(addSelect(), { target: { value: 'c1' } });
      fireEvent.click(within(ingredientsRegion()).getByRole('button', { name: 'Add' }));
      expect(latest.inputs.carbs.ingredients.at(-1)).toEqual({ ref: 'c1', weight: 50 });
      expect(row('Gel X')).toHaveTextContent('Yours');
      expect(row('Gel X')).toHaveTextContent('60 g carbs per 100 g · glucose 50% · fructose 50%');
    });
  });

  describe('your ingredients', () => {
    it('creates an ingredient from a label, adds it to the list and changes the recipe', async () => {
      const user = userEvent.setup();
      renderMatrix({ carbs: { ingredients: [{ ref: 3, weight: 100 }] } });
      expect(warningsIn(ingredientsRegion())).toBeInTheDocument(); // 1:0 only at 75 g/h

      await user.click(within(customRegion()).getByRole('button', { name: 'New ingredient' }));
      const form = within(customRegion()).getByRole('group', { name: 'New ingredient' });
      expect(within(form).getByLabelText('Name')).toHaveFocus();
      await user.type(within(form).getByLabelText('Name'), 'Fruit gel');
      await user.type(within(form).getByLabelText('Carbs per 100 g'), '60');
      await user.type(within(form).getByLabelText('Fructose share of the carbs'), '50');
      await user.type(within(form).getByLabelText('Water per 100 g (optional)'), '38');
      await user.click(within(customRegion()).getByRole('button', { name: 'Save ingredient' }));

      expect(latest.inputs.carbs.custom).toEqual([
        { key: 'c1', name: 'Fruit gel', carbsPer100g: 60, fructoseSharePct: 50, waterPct: 38 },
      ]);
      expect(latest.inputs.carbs.ingredients).toEqual([
        { ref: 3, weight: 100 },
        { ref: 'c1', weight: 50 },
      ]);
      expect(within(customRegion()).queryByRole('group', { name: 'New ingredient' })).not.toBeInTheDocument();
      expect(within(customRegion()).getByText('Fruit gel')).toBeInTheDocument();
      // Focus stays in the section: on the new ingredient's Edit button, not on the page.
      expect(within(customRegion()).getByRole('button', { name: 'Edit Fruit gel' })).toHaveFocus();
      expect(
        within(customRegion()).getByText('60 g carbs per 100 g · fructose 50% of the carbs · water 38 g per 100 g'),
      ).toBeInTheDocument();

      // The new ingredient brings fructose: 1:0.5 is reachable now and the recipe uses it.
      expect(row('Fruit gel')).toHaveTextContent('Yours');
      expect(warningsIn(ingredientsRegion())).not.toBeInTheDocument();
      expect(legend('Reachable')).toHaveTextContent('1:0–1:1');
      expect(legend('Your recipe')).toHaveTextContent('1:0.5');
      const gel = latest.plan.carbs.ingredients.items.find((item) => item.ref === 'c1');
      // 1:0.5 needs 75 g fructose: 150 g of the gel's carbs, 250 g of gel.
      expect(gel.carbsG).toBeCloseTo(150, 6);
      expect(usage('Fruit gel')).toHaveTextContent('In the recipe: 250 g, 67% of the carbs.');
    });

    it('checks the form and focuses the first field with a problem', async () => {
      const user = userEvent.setup();
      renderMatrix();
      await user.click(within(customRegion()).getByRole('button', { name: 'New ingredient' }));
      await user.click(within(customRegion()).getByRole('button', { name: 'Save ingredient' }));

      const name = screen.getByLabelText('Name');
      expect(name).toHaveAttribute('aria-invalid', 'true');
      expect(name).toHaveAccessibleDescription('Enter a name.');
      expect(name).toHaveFocus();
      expect(screen.getByLabelText('Carbs per 100 g')).toHaveAccessibleDescription(
        'Total carbohydrate from the label. Enter more than 0 and at most 100 g.',
      );
      expect(screen.getByLabelText('Fructose share of the carbs')).toHaveAttribute('aria-invalid', 'true');
      // Water is optional.
      expect(screen.getByLabelText('Water per 100 g (optional)')).not.toHaveAttribute('aria-invalid');
      expect(latest.inputs.carbs.custom).toEqual([]);

      await user.type(name, 'Syrup');
      await user.type(screen.getByLabelText('Carbs per 100 g'), '70');
      await user.type(screen.getByLabelText('Fructose share of the carbs'), '40');
      await user.type(screen.getByLabelText('Water per 100 g (optional)'), '35');
      await user.click(screen.getByRole('button', { name: 'Save ingredient' }));
      const water = screen.getByLabelText('Water per 100 g (optional)');
      expect(water).toHaveAccessibleDescription(
        'Leave empty to count the rest of the mass as water. Carbs and water add up to more than 100 g.',
      );
      expect(water).toHaveFocus();
      expect(name).not.toHaveAttribute('aria-invalid');

      await user.clear(water);
      await user.click(screen.getByRole('button', { name: 'Save ingredient' }));
      // Without water the field is left out (the rest of the mass counts as water).
      expect(latest.inputs.carbs.custom).toEqual([
        { key: 'c1', name: 'Syrup', carbsPer100g: 70, fructoseSharePct: 40 },
      ]);
    });

    it('cancels the form without changes', async () => {
      const user = userEvent.setup();
      renderMatrix();
      await user.click(within(customRegion()).getByRole('button', { name: 'New ingredient' }));
      await user.type(screen.getByLabelText('Name'), 'Draft');
      await user.click(within(customRegion()).getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
      expect(latest.inputs.carbs.custom).toEqual([]);
      expect(within(customRegion()).getByRole('button', { name: 'New ingredient' })).toHaveFocus();
    });

    it('edits an ingredient in place', async () => {
      const user = userEvent.setup();
      renderMatrix({
        carbs: {
          ingredients: [{ ref: 3, weight: 50 }, { ref: 'c1', weight: 50 }],
          custom: [{ key: 'c1', name: 'Gel X', carbsPer100g: 60, fructoseSharePct: 50, waterPct: 38 }],
        },
      });
      await user.click(within(customRegion()).getByRole('button', { name: 'Edit Gel X' }));
      const form = within(customRegion()).getByRole('group', { name: 'Edit Gel X' });
      expect(within(form).getByLabelText('Name')).toHaveValue('Gel X');
      expect(within(form).getByLabelText('Carbs per 100 g')).toHaveValue(60);
      expect(within(form).getByLabelText('Fructose share of the carbs')).toHaveValue(50);
      expect(within(form).getByLabelText('Water per 100 g (optional)')).toHaveValue(38);
      // One form at a time.
      expect(within(customRegion()).getByRole('button', { name: 'New ingredient' })).toBeDisabled();

      const carbs = within(form).getByLabelText('Carbs per 100 g');
      await user.clear(carbs);
      await user.type(carbs, '55');
      await user.click(within(customRegion()).getByRole('button', { name: 'Save ingredient' }));

      expect(latest.inputs.carbs.custom).toEqual([
        { key: 'c1', name: 'Gel X', carbsPer100g: 55, fructoseSharePct: 50, waterPct: 38 },
      ]);
      expect(latest.inputs.carbs.ingredients).toEqual([
        { ref: 3, weight: 50 },
        { ref: 'c1', weight: 50 },
      ]);
      expect(row('Gel X')).toHaveTextContent('55 g carbs per 100 g');
      expect(within(customRegion()).getByRole('button', { name: 'Edit Gel X' })).toHaveFocus();
    });

    it('deletes an ingredient after confirming, also from the list', async () => {
      const user = userEvent.setup();
      renderMatrix({
        carbs: {
          ingredients: [{ ref: 3, weight: 50 }, { ref: 11, weight: 25 }, { ref: 'c2', weight: 50 }],
          custom: [
            { key: 'c1', name: 'Spare', carbsPer100g: 90, fructoseSharePct: 0 },
            { key: 'c2', name: 'Gel X', carbsPer100g: 60, fructoseSharePct: 50 },
          ],
        },
      });
      await user.click(within(customRegion()).getByRole('button', { name: 'Delete Gel X' }));
      expect(within(customRegion()).getByText('Delete Gel X? It leaves the ingredient list too.')).toBeInTheDocument();
      // Asking moves focus to Keep, so a second Enter never deletes by accident.
      expect(within(customRegion()).getByRole('button', { name: 'Keep' })).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(latest.inputs.carbs.custom).toHaveLength(2);
      expect(within(customRegion()).getByRole('button', { name: 'Delete Gel X' })).toHaveFocus();

      await user.keyboard('{Enter}');
      await user.click(within(customRegion()).getByRole('button', { name: 'Yes, delete' }));
      expect(latest.inputs.carbs.custom).toEqual([{ key: 'c1', name: 'Spare', carbsPer100g: 90, fructoseSharePct: 0 }]);
      expect(latest.inputs.carbs.ingredients).toEqual([
        { ref: 3, weight: 50 },
        { ref: 11, weight: 25 },
      ]);
      expect(within(customRegion()).queryByText('Gel X')).not.toBeInTheDocument();
      expect(within(customRegion()).getByRole('button', { name: 'New ingredient' })).toHaveFocus();
    });

    it('takes the first free key for a new ingredient', async () => {
      const user = userEvent.setup();
      renderMatrix({ carbs: { custom: [{ key: 'c2', name: 'B', carbsPer100g: 50, fructoseSharePct: 0 }] } });
      await user.click(within(customRegion()).getByRole('button', { name: 'New ingredient' }));
      await user.type(screen.getByLabelText('Name'), 'A');
      await user.type(screen.getByLabelText('Carbs per 100 g'), '80');
      await user.type(screen.getByLabelText('Fructose share of the carbs'), '0');
      await user.click(screen.getByRole('button', { name: 'Save ingredient' }));
      expect(latest.inputs.carbs.custom.map((c) => c.key)).toEqual(['c2', 'c1']);
      expect(latest.inputs.carbs.ingredients.at(-1)).toEqual({ ref: 'c1', weight: 50 });
    });

    it('keeps at most 10 and says why New ingredient is off', () => {
      const custom = Array.from({ length: 10 }, (_, i) => ({
        key: `c${i + 1}`,
        name: `Mix ${i + 1}`,
        carbsPer100g: 50,
        fructoseSharePct: 20,
      }));
      renderMatrix({ carbs: { custom } });
      const button = within(customRegion()).getByRole('button', { name: 'New ingredient' });
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription(
        'You have 10 of your own ingredients, the most the app keeps. Delete one to add another.',
      );
    });

    it('says when a listed ingredient has no carbs', () => {
      renderMatrix({
        carbs: {
          ingredients: [{ ref: 3, weight: 67 }, { ref: 11, weight: 33 }, { ref: 'c1', weight: 50 }],
          custom: [{ key: 'c1', name: 'Electrolyte tab', carbsPer100g: 0, fructoseSharePct: 0 }],
        },
      });
      expect(usage('Electrolyte tab')).toHaveTextContent('Has no carbs, so the recipe leaves it out.');
      expect(latest.plan.carbs.ingredients.items.map((item) => item.ref)).toEqual([3, 11]);
    });
  });

  it('gives every form control an id and its own label', async () => {
    const user = userEvent.setup();
    const { container } = renderMatrix({
      carbs: {
        ratioMode: 'manual',
        ingredients: [{ ref: 3, weight: 60 }, { ref: 1, weight: 40 }, { ref: 'c1', weight: 30 }],
        custom: [{ key: 'c1', name: 'Gel X', carbsPer100g: 60, fructoseSharePct: 50 }],
      },
    });
    await user.click(within(customRegion()).getByRole('button', { name: 'New ingredient' }));

    const controls = container.querySelectorAll('input, select, textarea');
    // 2 ratio sliders, 3 rows × (number + slider), the add menu, 4 form fields.
    expect(controls.length).toBe(2 + 3 * 2 + 1 + 4);
    for (const control of controls) {
      expect(control.id).not.toBe('');
      const label = container.querySelector(`label[for="${control.id}"]`);
      expect(label).not.toBeNull();
      expect(screen.getByLabelText(label.textContent)).toBe(control);
    }
    const ids = [...controls].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('needs a PlanProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<CarbMatrix />)).toThrow(/must be used inside <PlanProvider>/);
  });
});
