import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, within, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IngredientsSection, {
  IngredientsFields,
  IngredientsList,
  IngredientsAdd,
  IngredientsCustom,
  IngredientsRatioReach,
  IngredientsRatioBar,
  useIngredientsSummary,
} from './IngredientsSection';
import { PlanProvider, usePlanInputs, usePlan } from '../../state/PlanProvider';
import { UiProvider, PREFS_KEY } from '../../state/UiProvider';
import uiSetupRecipe from '../../i18n/en/ui-setup-recipe';
import { MESSAGES, placeholderNames } from '../../i18n';

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
 * Renders the section with the real providers. Autosave is off, so no test
 * reads inputs that an earlier test left in localStorage. `prefs` are stored
 * before the render, as a returning visitor's.
 */
function renderSection(initialInputs, { prefs, children = <IngredientsSection /> } = {}) {
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

const section = () => screen.getByRole('region', { name: 'Ingredients' });
/** "Your ingredients" (a group named by its heading; the add menu's optgroup has the same name). */
const customGroup = () => within(section()).getByTestId('ingredients-custom');
const warningsIn = (container) => within(container).queryByRole('list', { name: 'Warnings' });
/** The solver warnings, in the ratio reach block (not those of the custom ingredients). */
const reachWarnings = () => warningsIn(screen.getByTestId('ratio-reach').parentElement);
const rangeBar = () => screen.getByRole('figure', { name: 'Ratios your ingredients can make' });
/** The value next to a legend term of the range bar. */
const legend = (term) => within(rangeBar()).getByText(term).closest('[data-legend]').querySelector('dd');
const ingredientList = () => within(section()).queryByRole('list', { name: 'Ingredient list' });
/** The list item of the ingredient named `name`. */
const row = (name) =>
  within(ingredientList())
    .getAllByTestId('ingredient-row')
    .find((li) => within(li).getByTestId('ingredient-name').textContent === name);
const usage = (name) => within(row(name)).getByTestId('ingredient-usage');
const weight = (name) => screen.getByRole('spinbutton', { name: `Weight of ${name}` });
const slider = (name) => screen.getByRole('slider', { name: `Weight of ${name} (slider)` });
const addSelect = () => within(section()).getByRole('combobox', { name: 'Add an ingredient' });
const optionLabels = (group) => [...group.querySelectorAll('option')].map((o) => o.textContent);

/** Types into a number field like a user would: change, then leave the field. */
function enter(input, value) {
  fireEvent.change(input, { target: { value: String(value) } });
  fireEvent.blur(input);
}

/** The role a form control is found by. */
const roleOf = (control) =>
  control.getAttribute('role') ??
  (control.tagName === 'SELECT' ? 'combobox' : control.getAttribute('type') === 'range' ? 'slider' : 'textbox');

/**
 * Checks every form control in `container`: it has an id and an accessible
 * name (its aria-label, else its label's text) that finds exactly this
 * control by role (`getByRole` fails on two matches) and that no other
 * control in the same scope has (the control's fieldset, named by its
 * legend, else the container). Ids on the page are unique. Returns the controls.
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
function expectUniquelyNamed(container) {
  const controls = [...container.querySelectorAll('input, select, textarea')];
  const names = new Map();
  for (const control of controls) {
    expect(control.id, control.outerHTML).not.toBe('');
    const name = (control.getAttribute('aria-label') ?? control.labels?.[0]?.textContent ?? '').trim();
    expect(name, control.outerHTML).not.toBe('');
    expect(control).toHaveAccessibleName(name);
    const scope = control.closest('fieldset') ?? container;
    expect(within(scope).getByRole(roleOf(control), { name })).toBe(control);
    const taken = names.get(scope) ?? new Set();
    expect(taken.has(name), name).toBe(false);
    names.set(scope, taken.add(name));
  }
  const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
  expect(new Set(ids).size).toBe(ids.length);
  return controls;
}

let warnSpy;

beforeEach(() => {
  latest.inputs = null;
  latest.plan = null;
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  // No key may be unknown (a typo shows the raw key). A German fallback to English is fine until the
  // German catalogs exist.
  const unknown = warnSpy.mock.calls.filter(([msg]) => String(msg).startsWith('[i18n] Missing message'));
  expect(unknown).toEqual([]);
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('ui-setup-recipe catalog', () => {
  it('is registered and namespaced', () => {
    for (const [key, text] of Object.entries(uiSetupRecipe)) {
      expect(key.startsWith('ui-setup-recipe.'), key).toBe(true);
      expect(MESSAGES[key], key).toBe(text);
    }
  });

  it('types its quantities: no bare number before %, ml, L, kg or °', () => {
    for (const [key, text] of Object.entries(uiSetupRecipe)) {
      expect(text, key).not.toMatch(/\{\w+\} ?(ml|L\b|kg|%|°|km\/h|cm)/);
      expect(new Set(placeholderNames(text)).size, key).toBeLessThanOrEqual(placeholderNames(text).length);
    }
  });
});

describe('IngredientsSection: layout', () => {
  it('is a collapsible region with a summary while closed', () => {
    renderSection();
    const region = section();
    expect(within(region).getByRole('heading', { level: 2, name: 'Ingredients' })).toBeInTheDocument();
    const toggle = within(region).getByRole('button', { name: 'Ingredients' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const body = document.getElementById(toggle.getAttribute('aria-controls'));
    expect(body).toBeVisible();
    expect(within(region).queryByText('Maltodextrin and Crystalline Fructose · recipe 1:0.5')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(body).not.toBeVisible();
    expect(within(region).getByText('Maltodextrin and Crystalline Fructose · recipe 1:0.5')).toBeInTheDocument();
    // The fields stay mounted while closed.
    expect(body).toContainElement(document.querySelector('input[type="range"]'));
  });

  it('has only its title as a level-2 heading (sub-sections are level 3)', () => {
    renderSection();
    expect(within(section()).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Ingredients']);
    expect(within(section()).getByRole('heading', { level: 3, name: 'Your ingredients' })).toBeInTheDocument();
    expect(customGroup()).toHaveAttribute('role', 'group');
    expect(customGroup()).toHaveAccessibleName('Your ingredients');
  });

  it('styles headings by level: the level-3 title as a block title, the form title one step smaller', () => {
    renderSection();
    fireEvent.click(within(customGroup()).getByRole('button', { name: 'New ingredient' }));
    // Like the block titles of the other setup sections (display face, uppercase).
    expect(within(section()).getByRole('heading', { level: 3, name: 'Your ingredients' })).toHaveClass('display-title');
    const formTitle = within(section()).getByRole('heading', { level: 4, name: 'New ingredient' });
    expect(formTitle).not.toHaveClass('display-title');
    expect(formTitle).toHaveClass('font-display', 'text-body', 'uppercase');
  });

  it('summarises an empty list and a plan without carbs', () => {
    function Summary() {
      return <p data-testid="summary">{useIngredientsSummary()}</p>;
    }
    renderSection({ carbs: { ingredients: [] } }, { children: <Summary /> });
    expect(screen.getByTestId('summary')).toHaveTextContent('No ingredients');
    cleanup();
    renderSection({ event: { durationMin: 30 } }, { children: <Summary /> });
    expect(screen.getByTestId('summary')).toHaveTextContent(/^Maltodextrin and Crystalline Fructose$/);
  });

  it('exports the field groups for the guided flow', () => {
    renderSection(undefined, {
      children: (
        <>
          <IngredientsRatioReach />
          <IngredientsList />
          <IngredientsAdd />
          <IngredientsCustom headingLevel={4} />
        </>
      ),
    });
    expect(rangeBar()).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Ingredient list' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Add an ingredient' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Your ingredients' })).toBeInTheDocument();
    expect(typeof IngredientsFields).toBe('function');
  });
});

describe('IngredientsSection: reachable ratio range', () => {
  it('draws the reachable range, the allowed range, the target and the recipe ratio for the default plan', () => {
    renderSection();
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
    expect(screen.queryByTestId('ratio-substituted')).not.toBeInTheDocument();
    expect(reachWarnings()).not.toBeInTheDocument();
  });

  it('follows the carb target: 1:0.8 at 120 g/h', () => {
    renderSection({ carbs: { mode: 'manual', manualGPerHour: 120 } });
    expect(legend('Allowed')).toHaveTextContent('1:0.8–1:1');
    expect(legend('Target')).toHaveTextContent('1:0.8');
    expect(legend('Your recipe')).toHaveTextContent('1:0.8');
    expect(latest.plan.carbs.ratio.value).toEqual({ glucose: 1, fructose: 0.8 });
  });

  it('allows glucose alone at low intakes (1:0–1:1 at 15 g/h)', () => {
    renderSection({ event: { durationMin: 60 } });
    expect(legend('Allowed')).toHaveTextContent('1:0–1:1');
  });

  it('shows no allowed band in Adjust mode: the target is the only allowed ratio', () => {
    renderSection({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 0.8 } } });
    expect(within(rangeBar()).queryByText('Allowed')).not.toBeInTheDocument();
    expect(within(rangeBar()).queryByTestId('ratio-range-allowed')).not.toBeInTheDocument();
    expect(legend('Target')).toHaveTextContent('1:0.8');
    expect(legend('Your recipe')).toHaveTextContent('1:0.8');
    expect(parseFloat(within(rangeBar()).getByTestId('ratio-range-target').style.left)).toBeCloseTo((0.8 / 1.8) * 100, 6);
  });

  it('shows the manual ratio normalised to glucose 1', () => {
    renderSection({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0.95, fructose: 0.85 } } });
    expect(legend('Target')).toHaveTextContent('1:0.89');
  });

  it('has no target marker, no recipe and no solver warning for a 0:0 ratio', () => {
    renderSection({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } });
    expect(reachWarnings()).not.toBeInTheDocument();
    expect(legend('Target')).toHaveTextContent('0:0');
    expect(legend('Your recipe')).toHaveTextContent('No carbs yet');
    expect(within(rangeBar()).queryByTestId('ratio-range-target')).not.toBeInTheDocument();
    expect(within(rangeBar()).queryByTestId('ratio-range-recipe')).not.toBeInTheDocument();
    expect(usage('Maltodextrin')).toHaveTextContent('Not used. The plan has no carbs to split.');
  });

  // [jeukendrup2014] glucose alone works at ≤ 60 g/h, so glucose-only ingredients still make a recipe
  it('uses 1:0 without a warning when only glucose ingredients are listed at 55 g/h', () => {
    renderSection({ event: { durationMin: 120 }, carbs: { ingredients: [{ ref: 3, weight: 100 }] } });
    expect(legend('Reachable')).toHaveTextContent('1:0 only');
    expect(legend('Target')).toHaveTextContent('1:0.5');
    expect(legend('Your recipe')).toHaveTextContent('1:0');
    expect(parseFloat(within(rangeBar()).getByTestId('ratio-range-recipe').style.left)).toBe(0);
    expect(screen.getByTestId('ratio-substituted')).toHaveTextContent(
      'Your ingredients cannot make 1:0.5. The recipe uses 1:0, which is still in the allowed range at 55 g/h.',
    );
    expect(reachWarnings()).not.toBeInTheDocument();
    expect(latest.plan.carbs.ingredients.adjusted).toBe(true);
  });

  it('uses 1:1 from honey alone, which is inside the allowed range at 75 g/h', () => {
    renderSection({ carbs: { ingredients: [{ ref: 14, weight: 100 }] } });
    expect(legend('Reachable')).toHaveTextContent('1:1 only');
    expect(legend('Your recipe')).toHaveTextContent('1:1');
    expect(screen.getByTestId('ratio-substituted')).toHaveTextContent(
      'The recipe uses 1:1, which is still in the allowed range at 75 g/h.',
    );
  });

  it('warns when the ingredients cannot reach the allowed range', () => {
    renderSection({ carbs: { ingredients: [{ ref: 3, weight: 100 }] } });
    const items = [...reachWarnings().children];
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveAttribute('data-level', 'warning');
    expect(items[0]).toHaveTextContent(
      'Your ingredients cannot make 1:0.5 glucose to fructose. The recipe uses 1:0, the closest they can make.',
    );
    expect(within(items[0]).getByRole('link', { name: /Jeukendrup 2014/ })).toBeInTheDocument();
    expect(screen.queryByTestId('ratio-substituted')).not.toBeInTheDocument();
    expect(legend('Your recipe')).toHaveTextContent('1:0');
  });

  it('says when there is nothing to make the carbs from', () => {
    renderSection({ carbs: { ingredients: [] } });
    expect(within(section()).getByText('No ingredients yet. Add one below.')).toBeInTheDocument();
    expect(ingredientList()).not.toBeInTheDocument();
    expect(legend('Reachable')).toHaveTextContent('None');
    expect(legend('Your recipe')).toHaveTextContent('No carbs yet');
    expect(within(rangeBar()).queryByTestId('ratio-range-reachable')).not.toBeInTheDocument();
    expect(within(reachWarnings()).getByText(/Add at least one carb ingredient/)).toBeInTheDocument();
  });

  it('has no recipe ratio and no warning when the plan has no carbs', () => {
    renderSection({ event: { durationMin: 30 } });
    expect(legend('Reachable')).toHaveTextContent('1:0–0:1');
    expect(legend('Your recipe')).toHaveTextContent('No carbs yet');
    expect(reachWarnings()).not.toBeInTheDocument();
    expect(usage('Crystalline Fructose')).toHaveTextContent('Not used. The plan has no carbs to split.');
  });

  it('draws a bar the screen reader skips, with every value in the legend', () => {
    render(<IngredientsRatioBar feasible={[0, 0.5]} allowed={null} target={0.25} targetText="1:0.33" recipe={null} />);
    const figure = rangeBar();
    expect(figure.querySelector('[aria-hidden="true"]')).toContainElement(within(figure).getByTestId('ratio-range-target'));
    expect(legend('Reachable')).toHaveTextContent('1:0–1:1');
    expect(legend('Target')).toHaveTextContent('1:0.33');
    expect(within(figure).queryByTestId('ratio-range-recipe')).not.toBeInTheDocument();
  });
});

describe('IngredientsSection: ingredient list', () => {
  it('shows the default ingredients with their kind, data, weight and amount in the recipe', () => {
    renderSection();
    const names = within(ingredientList())
      .getAllByTestId('ingredient-name')
      .map((el) => el.textContent);
    expect(names).toEqual(['Maltodextrin', 'Crystalline Fructose']);

    expect(row('Maltodextrin')).toHaveTextContent('Powder');
    expect(within(row('Maltodextrin')).getByTestId('ingredient-facts')).toHaveTextContent(
      '95 g carbs per 100 g · glucose 100% · fructose 0%',
    );
    expect(weight('Maltodextrin')).toHaveValue('67');
    expect(slider('Maltodextrin')).toHaveValue('67');
    // 225 g of carbs at 1:0.5: 150 g from maltodextrin (157.9 g powder) and 75 g from fructose.
    expect(usage('Maltodextrin')).toHaveTextContent('In the recipe: 158 g, 67% of the carbs.');
    expect(usage('Crystalline Fructose')).toHaveTextContent('In the recipe: 75 g, 33% of the carbs.');
    expect(weight('Crystalline Fructose')).toHaveValue('33');
  });

  it('gives the neutral kind chip a hairline, so it shows on the inset row', () => {
    renderSection();
    const chip = within(row('Maltodextrin')).getByText('Powder').parentElement;
    expect(row('Maltodextrin')).toHaveClass('bg-surface-2');
    expect(chip).toHaveClass('bg-surface-2', 'border', 'border-line');
  });

  it('describes the weight slider with what the recipe uses of the ingredient', () => {
    renderSection();
    expect(slider('Maltodextrin')).toHaveAccessibleDescription('In the recipe: 158 g, 67% of the carbs.');
    expect(slider('Crystalline Fructose')).toHaveAccessibleDescription('In the recipe: 75 g, 33% of the carbs.');
    // It follows the recipe.
    fireEvent.change(slider('Crystalline Fructose'), { target: { value: '0' } });
    expect(slider('Crystalline Fructose')).toHaveAccessibleDescription(usage('Crystalline Fructose').textContent);
  });

  it('shows the visible label "Weight" and names the weight controls after the ingredient', () => {
    renderSection();
    const input = weight('Maltodextrin');
    expect(document.querySelector(`label[for="${input.id}"]`)).toHaveTextContent('Weight');
    expect(input).toHaveAttribute('aria-valuemin', '0');
    expect(input).toHaveAttribute('aria-valuemax', '100');
  });

  it('describes syrups and mixed ingredients', () => {
    renderSection({ carbs: { ingredients: [{ ref: 3, weight: 50 }, { ref: 14, weight: 50 }] } });
    expect(row('Honey')).toHaveTextContent('Syrup');
    expect(row('Honey')).toHaveTextContent('82 g carbs per 100 g · glucose 50% · fructose 50%');
  });

  it('changes a weight with the number field and the slider, and the recipe follows', () => {
    renderSection({
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

    const sucrose = weight('Sucrose (Cane Sugar)');
    enter(sucrose, 0);
    expect(latest.inputs.carbs.ingredients[2]).toEqual({ ref: 18, weight: 0 });
    // 67:33 already makes 1:0.5, so sucrose is not needed.
    expect(usage('Sucrose (Cane Sugar)')).toHaveTextContent('Not used. The mix reaches the ratio without it.');
    expect(latest.plan.carbs.ingredients.items.map((item) => item.ref)).toEqual([3, 11]);
    expect(slider('Sucrose (Cane Sugar)')).toHaveValue('0');

    fireEvent.change(slider('Sucrose (Cane Sugar)'), { target: { value: '80' } });
    expect(latest.inputs.carbs.ingredients[2].weight).toBe(80);
    expect(sucrose).toHaveValue('80');
    expect(latest.plan.carbs.ingredients.items.map((item) => item.ref)).toEqual([3, 11, 18]);
  });

  it('steps a weight with the arrow keys and clamps typed values to 0–100', () => {
    renderSection();
    const input = weight('Maltodextrin');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(latest.inputs.carbs.ingredients[0].weight).toBe(70);
    enter(input, 250);
    expect(latest.inputs.carbs.ingredients[0].weight).toBe(100);
  });

  it('treats a cleared weight as 0', () => {
    renderSection();
    const input = weight('Maltodextrin');
    fireEvent.change(input, { target: { value: '' } });
    expect(latest.inputs.carbs.ingredients[0].weight).toBe(0);
    fireEvent.blur(input);
    expect(input).toHaveValue('0');
  });

  it('removes the right row and keeps the focus in the list', () => {
    renderSection({ carbs: { ingredients: [{ ref: 3, weight: 60 }, { ref: 1, weight: 30 }, { ref: 11, weight: 40 }] } });
    fireEvent.click(within(section()).getByRole('button', { name: 'Remove Dextrose (anhydrous)' }));
    expect(latest.inputs.carbs.ingredients).toEqual([
      { ref: 3, weight: 60 },
      { ref: 11, weight: 40 },
    ]);
    expect(weight('Crystalline Fructose')).toHaveValue('40');
    // The next row took its place, so its remove button has the focus.
    expect(within(section()).getByRole('button', { name: 'Remove Crystalline Fructose' })).toHaveFocus();

    fireEvent.click(within(section()).getByRole('button', { name: 'Remove Crystalline Fructose' }));
    expect(within(section()).getByRole('button', { name: 'Remove Maltodextrin' })).toHaveFocus();
    fireEvent.click(within(section()).getByRole('button', { name: 'Remove Maltodextrin' }));
    expect(addSelect()).toHaveFocus();
  });

  it('notes an ingredient listed twice (from a share link) once', () => {
    renderSection({ carbs: { ingredients: [{ ref: 3, weight: 40 }, { ref: 11, weight: 33 }, { ref: 3, weight: 27 }] } });
    const rows = within(ingredientList()).getAllByTestId('ingredient-row');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByTestId('ingredient-usage')).toHaveTextContent('In the recipe: 158 g');
    expect(within(rows[2]).getByTestId('ingredient-usage')).toHaveTextContent('Listed above too. The two weights add up.');
  });

  it('says when a listed ingredient has no carbs', () => {
    renderSection({
      carbs: {
        ingredients: [{ ref: 3, weight: 67 }, { ref: 11, weight: 33 }, { ref: 'c1', weight: 50 }],
        custom: [{ key: 'c1', name: 'Electrolyte tab', carbsPer100g: 0, fructoseSharePct: 0 }],
      },
    });
    expect(usage('Electrolyte tab')).toHaveTextContent('Has no carbs, so the recipe leaves it out.');
    expect(row('Electrolyte tab')).toHaveTextContent('Yours');
    expect(latest.plan.carbs.ingredients.items.map((item) => item.ref)).toEqual([3, 11]);
  });

  it('names an unnamed custom ingredient (from a share link) by its number', () => {
    renderSection({
      carbs: {
        ingredients: [{ ref: 'c2', weight: 50 }],
        custom: [{ key: 'c2', name: '  ', carbsPer100g: 60, fructoseSharePct: 50 }],
      },
    });
    expect(row('Custom ingredient 2')).toBeInTheDocument();
    expect(within(customGroup()).getByText('Custom ingredient 2')).toBeInTheDocument();
  });
});

describe('IngredientsSection: adding ingredients', () => {
  it('groups the unused ingredients into powders and syrups', () => {
    renderSection();
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
    renderSection();
    fireEvent.change(addSelect(), { target: { value: '14' } });
    expect(addSelect()).toHaveDisplayValue('Honey');
    fireEvent.click(within(section()).getByRole('button', { name: 'Add' }));

    expect(latest.inputs.carbs.ingredients).toEqual([
      { ref: 3, weight: 67 },
      { ref: 11, weight: 33 },
      { ref: 14, weight: 50 },
    ]);
    expect(weight('Honey')).toHaveValue('50');
    expect(latest.plan.carbs.ingredients.items.map((item) => item.ref)).toContain(14);
    // Honey is no longer offered; the menu falls back to the first ingredient left.
    expect(optionLabels(addSelect())).not.toContain('Honey');
    expect(addSelect()).toHaveDisplayValue('Dextrose (anhydrous)');
  });

  it('says so when every ingredient is listed', () => {
    const all = [1, 8, 2, 3, 4, 5, 6, 7, 11, 12, 13, 14, 15, 16, 20, 17, 18, 19].map((ref) => ({ ref, weight: 10 }));
    renderSection({ carbs: { ingredients: all } });
    expect(within(section()).queryByRole('combobox', { name: 'Add an ingredient' })).not.toBeInTheDocument();
    expect(within(section()).getByText('Every ingredient is in the list.')).toBeInTheDocument();
  });

  it('keeps the focus on Add, and on the note once the last ingredient is added', async () => {
    const user = userEvent.setup();
    const allButTwo = [1, 8, 2, 3, 4, 5, 6, 7, 11, 12, 13, 14, 15, 16, 20, 17].map((ref) => ({ ref, weight: 10 }));
    renderSection({ carbs: { ingredients: allButTwo } });
    const add = within(section()).getByRole('button', { name: 'Add' });
    add.focus();
    await user.keyboard('{Enter}');
    expect(latest.inputs.carbs.ingredients).toHaveLength(17);
    expect(within(section()).getByRole('button', { name: 'Add' })).toHaveFocus();

    // The last one: the menu and its button give way to the note, which takes the focus.
    await user.keyboard('{Enter}');
    expect(latest.inputs.carbs.ingredients).toHaveLength(18);
    expect(within(section()).queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
    expect(within(section()).getByText('Every ingredient is in the list.')).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it('offers your own ingredients that are not in the list', () => {
    renderSection({
      carbs: { custom: [{ key: 'c1', name: 'Gel X', carbsPer100g: 60, fructoseSharePct: 50 }] },
    });
    const groups = [...addSelect().querySelectorAll('optgroup')];
    expect(groups.map((g) => g.label)).toEqual(['Powders', 'Syrups', 'Your ingredients']);
    expect(optionLabels(groups[2])).toEqual(['Gel X']);

    fireEvent.change(addSelect(), { target: { value: 'c1' } });
    fireEvent.click(within(section()).getByRole('button', { name: 'Add' }));
    expect(latest.inputs.carbs.ingredients.at(-1)).toEqual({ ref: 'c1', weight: 50 });
    expect(row('Gel X')).toHaveTextContent('Yours');
    expect(row('Gel X')).toHaveTextContent('60 g carbs per 100 g · glucose 50% · fructose 50%');
  });
});

describe('IngredientsSection: your ingredients', () => {
  it('creates an ingredient from a label, adds it to the list and changes the recipe', async () => {
    const user = userEvent.setup();
    renderSection({ carbs: { ingredients: [{ ref: 3, weight: 100 }] } });
    expect(reachWarnings()).toBeInTheDocument(); // 1:0 only at 75 g/h

    await user.click(within(customGroup()).getByRole('button', { name: 'New ingredient' }));
    const form = within(customGroup()).getByRole('form', { name: 'New ingredient' });
    expect(within(form).getByLabelText('Name')).toHaveFocus();
    await user.type(within(form).getByLabelText('Name'), 'Fruit gel');
    await user.type(within(form).getByLabelText('Carbs per 100 g'), '60');
    await user.type(within(form).getByLabelText('Fructose share of the carbs'), '50');
    await user.type(within(form).getByLabelText('Water per 100 g (optional)'), '38');
    await user.click(within(customGroup()).getByRole('button', { name: 'Save ingredient' }));

    expect(latest.inputs.carbs.custom).toEqual([
      { key: 'c1', name: 'Fruit gel', carbsPer100g: 60, fructoseSharePct: 50, waterPct: 38 },
    ]);
    expect(latest.inputs.carbs.ingredients).toEqual([
      { ref: 3, weight: 100 },
      { ref: 'c1', weight: 50 },
    ]);
    expect(within(customGroup()).queryByRole('form')).not.toBeInTheDocument();
    expect(within(customGroup()).getByText('Fruit gel')).toBeInTheDocument();
    // Focus stays in the section: on the new ingredient's Edit button, not on the page.
    expect(within(customGroup()).getByRole('button', { name: 'Edit Fruit gel' })).toHaveFocus();
    expect(
      within(customGroup()).getByText('60 g carbs per 100 g · fructose 50% of the carbs · water 38 g per 100 g'),
    ).toBeInTheDocument();

    // The new ingredient brings fructose: 1:0.5 is reachable now and the recipe uses it.
    expect(row('Fruit gel')).toHaveTextContent('Yours');
    expect(reachWarnings()).not.toBeInTheDocument();
    expect(legend('Reachable')).toHaveTextContent('1:0–1:1');
    expect(legend('Your recipe')).toHaveTextContent('1:0.5');
    const gel = latest.plan.carbs.ingredients.items.find((item) => item.ref === 'c1');
    // 1:0.5 needs 75 g fructose: 150 g of the gel's carbs, 250 g of gel.
    expect(gel.carbsG).toBeCloseTo(150, 6);
    expect(usage('Fruit gel')).toHaveTextContent('In the recipe: 250 g, 67% of the carbs.');
  });

  it('checks the form and focuses the first field with a problem', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(within(customGroup()).getByRole('button', { name: 'New ingredient' }));
    await user.click(within(customGroup()).getByRole('button', { name: 'Save ingredient' }));

    const name = screen.getByLabelText('Name');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription('Error: Enter a name.');
    expect(name).toHaveFocus();
    expect(screen.getByLabelText('Carbs per 100 g')).toHaveAccessibleDescription(
      'Total carbohydrate from the label. Error: Enter more than 0 and at most 100 g.',
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
      'Leave empty to count the rest of the mass as water. Error: Carbs and water add up to more than 100 g.',
    );
    expect(water).toHaveFocus();
    expect(name).not.toHaveAttribute('aria-invalid');

    await user.clear(water);
    await user.click(screen.getByRole('button', { name: 'Save ingredient' }));
    // Without water the field is left out (the rest of the mass counts as water).
    expect(latest.inputs.carbs.custom).toEqual([{ key: 'c1', name: 'Syrup', carbsPer100g: 70, fructoseSharePct: 40 }]);
  });

  it('reads decimals typed with a comma or a point', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(within(customGroup()).getByRole('button', { name: 'New ingredient' }));
    await user.type(screen.getByLabelText('Name'), 'Mix');
    await user.type(screen.getByLabelText('Carbs per 100 g'), '62,5');
    await user.type(screen.getByLabelText('Fructose share of the carbs'), '33.3');
    await user.click(screen.getByRole('button', { name: 'Save ingredient' }));
    expect(latest.inputs.carbs.custom).toEqual([{ key: 'c1', name: 'Mix', carbsPer100g: 62.5, fructoseSharePct: 33.3 }]);
  });

  it('cancels the form without changes, also with Escape', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(within(customGroup()).getByRole('button', { name: 'New ingredient' }));
    await user.type(screen.getByLabelText('Name'), 'Draft');
    await user.click(within(customGroup()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(latest.inputs.carbs.custom).toEqual([]);
    expect(within(customGroup()).getByRole('button', { name: 'New ingredient' })).toHaveFocus();

    await user.click(within(customGroup()).getByRole('button', { name: 'New ingredient' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(within(customGroup()).getByRole('button', { name: 'New ingredient' })).toHaveFocus();
  });

  it('edits an ingredient in place', async () => {
    const user = userEvent.setup();
    renderSection({
      carbs: {
        ingredients: [{ ref: 3, weight: 50 }, { ref: 'c1', weight: 50 }],
        custom: [{ key: 'c1', name: 'Gel X', carbsPer100g: 60, fructoseSharePct: 50, waterPct: 38 }],
      },
    });
    await user.click(within(customGroup()).getByRole('button', { name: 'Edit Gel X' }));
    const form = within(customGroup()).getByRole('form', { name: 'Edit Gel X' });
    expect(within(form).getByLabelText('Name')).toHaveValue('Gel X');
    expect(within(form).getByLabelText('Carbs per 100 g')).toHaveValue('60');
    expect(within(form).getByLabelText('Fructose share of the carbs')).toHaveValue('50');
    expect(within(form).getByLabelText('Water per 100 g (optional)')).toHaveValue('38');
    // One form at a time.
    expect(within(customGroup()).getByRole('button', { name: 'New ingredient' })).toBeDisabled();

    const carbs = within(form).getByLabelText('Carbs per 100 g');
    await user.clear(carbs);
    await user.type(carbs, '55');
    await user.click(within(customGroup()).getByRole('button', { name: 'Save ingredient' }));

    expect(latest.inputs.carbs.custom).toEqual([
      { key: 'c1', name: 'Gel X', carbsPer100g: 55, fructoseSharePct: 50, waterPct: 38 },
    ]);
    expect(latest.inputs.carbs.ingredients).toEqual([
      { ref: 3, weight: 50 },
      { ref: 'c1', weight: 50 },
    ]);
    expect(row('Gel X')).toHaveTextContent('55 g carbs per 100 g');
    expect(within(customGroup()).getByRole('button', { name: 'Edit Gel X' })).toHaveFocus();
  });

  it('deletes an ingredient after confirming, also from the list', async () => {
    const user = userEvent.setup();
    renderSection({
      carbs: {
        ingredients: [{ ref: 3, weight: 50 }, { ref: 11, weight: 25 }, { ref: 'c2', weight: 50 }],
        custom: [
          { key: 'c1', name: 'Spare', carbsPer100g: 90, fructoseSharePct: 0 },
          { key: 'c2', name: 'Gel X', carbsPer100g: 60, fructoseSharePct: 50 },
        ],
      },
    });
    await user.click(within(customGroup()).getByRole('button', { name: 'Delete Gel X' }));
    expect(within(customGroup()).getByText('Delete Gel X? It leaves the ingredient list too.')).toBeInTheDocument();
    expect(within(customGroup()).getByRole('button', { name: 'Delete Gel X' })).toHaveAttribute('aria-expanded', 'true');
    // Asking moves focus to Keep, so a second Enter never deletes by accident.
    expect(within(customGroup()).getByRole('button', { name: 'Keep' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(latest.inputs.carbs.custom).toHaveLength(2);
    expect(within(customGroup()).getByRole('button', { name: 'Delete Gel X' })).toHaveFocus();

    // Escape in the confirmation keeps it too.
    await user.keyboard('{Enter}');
    expect(within(customGroup()).getByRole('button', { name: 'Keep' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(within(customGroup()).queryByRole('button', { name: 'Yes, delete' })).not.toBeInTheDocument();
    expect(within(customGroup()).getByRole('button', { name: 'Delete Gel X' })).toHaveFocus();

    await user.keyboard('{Enter}');
    await user.click(within(customGroup()).getByRole('button', { name: 'Yes, delete' }));
    expect(latest.inputs.carbs.custom).toEqual([{ key: 'c1', name: 'Spare', carbsPer100g: 90, fructoseSharePct: 0 }]);
    expect(latest.inputs.carbs.ingredients).toEqual([
      { ref: 3, weight: 50 },
      { ref: 11, weight: 25 },
    ]);
    expect(within(customGroup()).queryByText('Gel X')).not.toBeInTheDocument();
    expect(within(customGroup()).getByRole('button', { name: 'New ingredient' })).toHaveFocus();
  });

  it('keeps the focus in the open form when another ingredient is deleted', async () => {
    const user = userEvent.setup();
    renderSection({
      carbs: {
        custom: [
          { key: 'c1', name: 'Gel A', carbsPer100g: 60, fructoseSharePct: 50 },
          { key: 'c2', name: 'Gel B', carbsPer100g: 70, fructoseSharePct: 0 },
          { key: 'c3', name: 'Gel C', carbsPer100g: 80, fructoseSharePct: 20 },
        ],
      },
    });
    // Edit A, then delete B: "New ingredient" and Edit are off while the form is open.
    await user.click(within(customGroup()).getByRole('button', { name: 'Edit Gel A' }));
    const editForm = within(customGroup()).getByRole('form', { name: 'Edit Gel A' });
    await user.click(within(customGroup()).getByRole('button', { name: 'Delete Gel B' }));
    await user.click(within(customGroup()).getByRole('button', { name: 'Yes, delete' }));
    expect(latest.inputs.carbs.custom.map((c) => c.key)).toEqual(['c1', 'c3']);
    expect(within(editForm).getByLabelText('Name')).toHaveFocus();

    // The same with the new-ingredient form open: delete C.
    await user.click(within(editForm).getByRole('button', { name: 'Cancel' }));
    await user.click(within(customGroup()).getByRole('button', { name: 'New ingredient' }));
    const newForm = within(customGroup()).getByRole('form', { name: 'New ingredient' });
    await user.click(within(customGroup()).getByRole('button', { name: 'Delete Gel C' }));
    await user.keyboard('{Shift>}{Tab}{/Shift}{Enter}'); // from Keep back to "Yes, delete"
    expect(latest.inputs.carbs.custom.map((c) => c.key)).toEqual(['c1']);
    expect(within(newForm).getByLabelText('Name')).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it('takes the first free key for a new ingredient', async () => {
    const user = userEvent.setup();
    renderSection({ carbs: { custom: [{ key: 'c2', name: 'B', carbsPer100g: 50, fructoseSharePct: 0 }] } });
    await user.click(within(customGroup()).getByRole('button', { name: 'New ingredient' }));
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
    renderSection({ carbs: { custom } });
    const button = within(customGroup()).getByRole('button', { name: 'New ingredient' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(
      'You have 10 of your own ingredients, the most the app keeps. Delete one to add another.',
    );
  });
});

describe('IngredientsSection: language and units', () => {
  it('writes numbers, shares and ratios in German', async () => {
    renderSection(undefined, { prefs: { locale: 'de', unitSystem: 'metric', currency: 'EUR', mode: 'expert' } });
    await act(async () => {});
    // German text, German decimals and the space before %.
    const sectionDe = screen.getByRole('region', { name: 'Zutaten' });
    const rowDe = (name) =>
      within(within(sectionDe).getByRole('list', { name: 'Zutatenliste' }))
        .getAllByTestId('ingredient-row')
        .find((li) => within(li).getByTestId('ingredient-name').textContent === name);
    expect(within(rowDe('Maltodextrin')).getByTestId('ingredient-facts')).toHaveTextContent(
      '95 g Kohlenhydrate pro 100 g · Glukose 100 % · Fruktose 0 %',
    );
    const rangeDe = screen.getByRole('figure', { name: 'Verhältnisse, die mit deinen Zutaten möglich sind' });
    expect(within(rangeDe).getByText('Erlaubt').closest('[data-legend]').querySelector('dd')).toHaveTextContent('1:0,5–1:1');
    expect(within(rowDe('Maltodextrin')).getByTestId('ingredient-usage')).toHaveTextContent(
      'Im Rezept: 158 g, 67 % der Kohlenhydrate.',
    );
    fireEvent.click(within(sectionDe).getByRole('button', { name: 'Zutaten' }));
    expect(within(sectionDe).getByText('Maltodextrin und Fruktose (kristallin) · Rezept 1:0,5')).toBeInTheDocument();
  });

  it('keeps grams in imperial (nutrients stay g)', async () => {
    renderSection(undefined, { prefs: { locale: 'en', unitSystem: 'imperial', currency: 'USD', mode: 'expert' } });
    await act(async () => {});
    expect(usage('Maltodextrin')).toHaveTextContent('In the recipe: 158 g, 67% of the carbs.');
  });
});

describe('IngredientsSection: accessibility', () => {
  it('gives every form control a unique id and an accessible name', async () => {
    const user = userEvent.setup();
    const { container } = renderSection({
      carbs: {
        ingredients: [{ ref: 3, weight: 60 }, { ref: 1, weight: 40 }, { ref: 'c1', weight: 30 }],
        custom: [{ key: 'c1', name: 'Gel X', carbsPer100g: 60, fructoseSharePct: 50 }],
      },
    });
    await user.click(within(customGroup()).getByRole('button', { name: 'New ingredient' }));

    const controls = expectUniquelyNamed(container);
    // 3 rows × (number + slider), the add menu, 4 form fields.
    expect(controls.length).toBe(3 * 2 + 1 + 4);
    // Each name finds its control, as a label query would.
    expect(screen.getByLabelText('Weight of Dextrose (anhydrous)')).toBe(weight('Dextrose (anhydrous)'));
    expect(screen.getByLabelText('Name')).toHaveAttribute('name', 'name');
  });

  it('keeps ids unique with two copies on the page (expert section and guided step)', () => {
    renderSection(undefined, {
      children: (
        <>
          <IngredientsSection />
          <IngredientsFields />
        </>
      ),
    });
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('needs a PlanProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<IngredientsSection />)).toThrow(/must be used inside <PlanProvider>/);
  });
});
