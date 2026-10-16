import { useEffect, useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import FinalRecipe from './FinalRecipe';
import { recipeItemLabel, recipeItemDotClass } from '../shared/recipe';
import { PlanProvider, usePlanInputs } from '../../state/PlanProvider';
import { UiProvider, useUi } from '../../state/UiProvider';
import { computePlan } from '../../domain/plan';
import { buildRecipeItems } from '../../domain/recipe';

const pdf = vi.hoisted(() => ({
  toPng: vi.fn(),
  addImage: vi.fn(),
  save: vi.fn(),
  ctor: vi.fn(),
}));

vi.mock('html-to-image', () => ({ toPng: pdf.toPng }));
vi.mock('jspdf', () => ({
  jsPDF: function jsPDF(...args) {
    pdf.ctor(...args);
    return { internal: { pageSize: { getWidth: () => 210 } }, addImage: pdf.addImage, save: pdf.save };
  },
}));

/** Shows the current inputs and UI state so tests can check what the card changed. */
function Probe() {
  const { inputs } = usePlanInputs();
  const { modal, recipeRef } = useUi();
  const [refTag, setRefTag] = useState('none');
  useEffect(() => {
    setRefTag(recipeRef.current?.tagName ?? 'none');
  }, [recipeRef]);
  return (
    <>
      <pre data-testid="inputs">{JSON.stringify(inputs)}</pre>
      <span data-testid="modal">{modal ?? 'none'}</span>
      <span data-testid="recipe-ref">{refTag}</span>
    </>
  );
}

function renderCard(initialInputs) {
  return render(
    <UiProvider>
      <PlanProvider initialInputs={initialInputs}>
        <FinalRecipe />
        <Probe />
      </PlanProvider>
    </UiProvider>,
  );
}

const readInputs = () => JSON.parse(screen.getByTestId('inputs').textContent);
const card = () => screen.getByRole('region', { name: 'Final Recipe' });
const ingredientRows = () =>
  within(screen.getByRole('list', { name: 'Ingredients' }))
    .getAllByRole('listitem')
    .map((li) => [li.querySelector('.font-medium').textContent, li.lastElementChild.textContent]);

/** The recipe lines the card should show, straight from the domain. */
function expectedRows(inputs) {
  const plan = computePlan(inputs);
  return buildRecipeItems({
    carbSources: plan.carbs.sources.items,
    salts: plan.salts.items,
    caffeine: plan.caffeine,
    gelCount: plan.gels.count,
    view: plan.inputs.format.view,
  }).map((item) => [recipeItemLabel(item), item.display]);
}

describe('FinalRecipe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the default total batch from buildRecipeItems', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'Final Recipe' })).toBeInTheDocument();
    expect(screen.getByText('Total batch for a 3.0 hour activity.')).toBeInTheDocument();

    // 180 min at 75 g/h, 1:0.5 → 150 g glucose (158 g maltodextrin) + 75 g fructose; 1,710 mg sodium as table salt.
    expect(ingredientRows()).toEqual([
      ['Maltodextrin', '158 g'],
      ['Crystalline Fructose', '75 g'],
      ['Sodium Chloride (Table Salt)', '4.4 g'],
    ]);
    expect(ingredientRows()).toEqual(expectedRows({}));

    // Dots: glucose blue, fructose purple, salt teal.
    const dots = within(screen.getByRole('list', { name: 'Ingredients' }))
      .getAllByRole('listitem')
      .map((li) => li.querySelector('[aria-hidden="true"]').className);
    expect(dots[0]).toContain('bg-apple-blue');
    expect(dots[1]).toContain('bg-apple-purple');
    expect(dots[2]).toContain('bg-apple-teal');

    // Carb tooltip from the item detail.
    expect(screen.getByText('150 g total carbs')).toBeInTheDocument();
    expect(screen.getByText('Glucose: 150 g | Fructose: 0 g')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Total Batch' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Per Gel' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('recipe-ref')).toHaveTextContent('DIV');
  });

  it('shows the cost estimate from plan.cost', () => {
    renderCard();
    // 225 g carbs: DIY 225 × 0.015 = 3.375; commercial 22.50; savings 19.125.
    expect(screen.getByText('$3.38')).toBeInTheDocument();
    expect(screen.getByText('$19.13 vs Commercial')).toBeInTheDocument();
  });

  it('switches format.view to per gel and shows per-gel amounts', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Per Gel' }));
    expect(readInputs().format.view).toBe('perGel');
    expect(screen.getByRole('button', { name: 'Per Gel' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Amounts to mix for one single gel flask (3 gels/hr).')).toBeInTheDocument();
    // 9 gels: 158/9, 75/9, 4,351/9 mg.
    expect(ingredientRows()).toEqual([
      ['Maltodextrin', '18 g'],
      ['Crystalline Fructose', '8 g'],
      ['Sodium Chloride (Table Salt)', '483 mg'],
    ]);
    expect(ingredientRows()).toEqual(expectedRows({ format: { view: 'perGel' } }));

    fireEvent.click(screen.getByRole('button', { name: 'Total Batch' }));
    expect(readInputs().format.view).toBe('total');
  });

  it('binds the gels-per-hour input to format.gelsPerHour', () => {
    renderCard({ format: { view: 'perGel' } });
    const input = screen.getByLabelText('Gels per Hour');
    expect(input).toHaveAttribute('id');
    expect(input).toHaveValue(3);
    expect(input).toHaveAccessibleDescription('9 gels in total');

    fireEvent.change(input, { target: { value: '2' } });
    expect(readInputs().format.gelsPerHour).toBe(2);
    expect(input).toHaveAccessibleDescription('6 gels in total');
    // 225 g over 6 gels: 158/6 = 26 g maltodextrin, 75/6 = 13 g fructose.
    expect(ingredientRows()).toEqual(expectedRows({ format: { view: 'perGel', gelsPerHour: 2 } }));
    expect(ingredientRows()[0]).toEqual(['Maltodextrin', '26 g']);
  });

  it('lets the gels-per-hour field be cleared while typing without committing', () => {
    renderCard();
    const input = screen.getByLabelText('Gels per Hour');
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue(null);
    expect(readInputs().format.gelsPerHour).toBe(3);
    fireEvent.blur(input);
    expect(input).toHaveValue(3);
  });

  it('clamps gels per hour to the input limit and handles zero gels', () => {
    renderCard({ format: { view: 'perGel' } });
    const input = screen.getByLabelText('Gels per Hour');
    // Out-of-range text is kept while typing and committed (then clamped) on blur.
    fireEvent.change(input, { target: { value: '50' } });
    expect(readInputs().format.gelsPerHour).toBe(3);
    fireEvent.blur(input);
    expect(readInputs().format.gelsPerHour).toBe(12);

    fireEvent.change(input, { target: { value: '0' } });
    expect(readInputs().format.gelsPerHour).toBe(0);
    expect(input).toHaveAccessibleDescription('No gels planned');
    expect(
      screen.getByText('No gels are planned, so these are the amounts for the whole activity.'),
    ).toBeInTheDocument();
    expect(ingredientRows()[0]).toEqual(['Maltodextrin', '158 g']);
  });

  // [thomas2016] no carbs under 45 min: no gels, and the card says why
  it('says no gels are needed when the plan has no carbs', () => {
    renderCard({ event: { durationMin: 30 } });
    expect(screen.getByLabelText('Gels per Hour')).toHaveAccessibleDescription('No gels needed: this plan has no carbs');
    expect(ingredientRows()).toEqual([['Sodium Chloride (Table Salt)', '382 mg']]);
  });

  it('explains a recipe without carbs when the ratio is 0:0', () => {
    renderCard({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } });
    const warnings = within(card()).getByRole('list', { name: 'Warnings' });
    expect(warnings.children[0]).toHaveAttribute('data-level', 'danger');
    expect(warnings.children[0]).toHaveTextContent(/Set at least one ratio part above zero/);
  });

  it('lists caffeine tablet lines through t() and shows the no-powder warning', () => {
    renderCard({ caffeine: { enabled: true, asIngredient: true } });
    // 70 kg, 3 mg/kg, 180 min: intra 50 mg (0.5 × 100 mg) in the gel at 120 min (gel 7).
    const rows = ingredientRows();
    expect(rows.at(-1)).toEqual(['Caffeine for gel 7: 0.5 × 100 mg tablet', '50 mg']);
    expect(rows).toEqual(expectedRows({ caffeine: { enabled: true, asIngredient: true } }));
    const warnings = within(card()).getByRole('list', { name: 'Warnings' });
    expect(within(warnings).getByText(/Never use pure caffeine powder/)).toBeInTheDocument();
    expect(within(warnings).getByRole('listitem')).toHaveAttribute('data-level', 'danger');
  });

  it('does not show the no-powder warning without caffeine lines', () => {
    // 60 min: only a pre-start dose, so nothing goes into a gel.
    renderCard({ event: { durationMin: 60 }, caffeine: { enabled: true, asIngredient: true } });
    expect(ingredientRows().some(([label]) => label.startsWith('Caffeine'))).toBe(false);
    expect(within(card()).queryByRole('list', { name: 'Warnings' })).not.toBeInTheDocument();
  });

  it('explains an infeasible carb mix instead of showing carb lines', () => {
    renderCard({
      carbs: {
        ratioMode: 'manual',
        manualRatio: { glucose: 1, fructose: 1 },
        glucoseSources: [{ id: 3, percentage: 100 }],
        fructoseSources: [],
      },
    });
    expect(ingredientRows()).toEqual([['Sodium Chloride (Table Salt)', '4.4 g']]);
    const warnings = within(card()).getByRole('list', { name: 'Warnings' });
    expect(
      within(warnings).getByText(
        'Your carb sources cannot make a 1:1 glucose to fructose mix. Add a source for the missing sugar or change the ratio.',
      ),
    ).toBeInTheDocument();
  });

  it('shows an empty state when there is nothing to mix', () => {
    renderCard({ event: { durationMin: 30 }, sodium: { mode: 'manual', manualMgPerHour: 0 } });
    expect(screen.queryByRole('list', { name: 'Ingredients' })).not.toBeInTheDocument();
    expect(screen.getByText('Nothing to mix for this plan.')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('opens the mixing modal', () => {
    renderCard();
    expect(screen.getByTestId('modal')).toHaveTextContent('none');
    fireEvent.click(screen.getByRole('button', { name: /View Mixing Instructions/ }));
    expect(screen.getByTestId('modal')).toHaveTextContent('mixing');
  });

  it('saves the recipe card as a PDF with lazily loaded libraries', async () => {
    pdf.toPng.mockResolvedValue('data:image/png;base64,abc');
    const { container } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Save as PDF' }));
    await waitFor(() => expect(pdf.save).toHaveBeenCalledWith('Fueling-Recipe.pdf'));
    expect(pdf.toPng).toHaveBeenCalledWith(container.firstChild, expect.objectContaining({ pixelRatio: 2 }));
    expect(pdf.ctor).toHaveBeenCalledWith('p', 'mm', 'a4');
    expect(pdf.addImage).toHaveBeenCalledWith('data:image/png;base64,abc', 'PNG', 0, 0, 210, expect.any(Number));
  });

  it('logs and survives a failed PDF export', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    pdf.toPng.mockRejectedValue(new Error('canvas'));
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Save as PDF' }));
    await waitFor(() => expect(error).toHaveBeenCalledWith('Failed to generate PDF', expect.any(Error)));
    expect(pdf.save).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('gives every form control an id and a label', () => {
    const { container } = renderCard();
    for (const control of container.querySelectorAll('input, select, textarea, button')) {
      expect(control.id).not.toBe('');
      expect(control).toHaveAccessibleName();
    }
  });
});

describe('recipe item helpers', () => {
  it('translates caffeine labels and passes source labels through', () => {
    expect(recipeItemLabel({ label: 'Maltodextrin' })).toBe('Maltodextrin');
    expect(
      recipeItemLabel({ label: { key: 'recipe.caffeineTablet', params: { tablets: 1.5, tabletMg: 100, gel: 3 } } }),
    ).toBe('Caffeine for gel 3: 1.5 × 100 mg tablet');
    expect(recipeItemLabel(null)).toBe('');
  });

  it('colors dots by pathway and kind', () => {
    expect(recipeItemDotClass({ kind: 'carb', pathway: 'glucose' })).toBe('bg-apple-blue');
    expect(recipeItemDotClass({ kind: 'carb', pathway: 'fructose' })).toBe('bg-apple-purple');
    expect(recipeItemDotClass({ kind: 'salt' })).toBe('bg-apple-teal');
    expect(recipeItemDotClass({ kind: 'caffeine' })).toBe('bg-apple-amber');
    expect(recipeItemDotClass({ kind: 'other' })).toBe('bg-text-secondary');
  });
});
