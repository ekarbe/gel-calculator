import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import FinalRecipe from './FinalRecipe';
import { deliveredRatioText } from '../shared/recipe';
import { PlanProvider, usePlanInputs } from '../../state/PlanProvider';
import { UiProvider, useUi } from '../../state/UiProvider';
import { computePlan } from '../../domain/plan';
import { t } from '../../i18n';
import finalRecipeSource from './FinalRecipe.jsx?raw';

/** Shows the current inputs and the open modal so tests can check what the card changed. */
function Probe() {
  const { inputs } = usePlanInputs();
  const { modal } = useUi();
  return (
    <>
      <pre data-testid="inputs">{JSON.stringify(inputs)}</pre>
      <span data-testid="modal">{modal ?? 'none'}</span>
    </>
  );
}

function renderCard(initialInputs) {
  return render(
    <UiProvider>
      <PlanProvider initialInputs={initialInputs} persist={false}>
        <FinalRecipe />
        <Probe />
      </PlanProvider>
    </UiProvider>,
  );
}

const readInputs = () => JSON.parse(screen.getByTestId('inputs').textContent);
const card = () => screen.getByRole('region', { name: 'Final Recipe' });
const section = (kind) => screen.getByTestId(`recipe-section-${kind}`);
const formatControls = () => screen.getByTestId('format-controls');
/** [label, amount] of every line of a section. */
const rows = (kind) =>
  within(section(kind))
    .getAllByRole('listitem')
    .filter((li) => li.hasAttribute('data-kind'))
    .map((li) => [within(li).getByTestId('item-label').textContent, within(li).getByTestId('item-amount').textContent]);
/** The lines the card should show for a section, straight from the domain. */
const expectedRows = (inputs, kind, view = 'total') =>
  computePlan(inputs)
    .recipe.sections.find((s) => s.kind === kind)
    .items.map((item) => [
      typeof item.label === 'string' ? item.label : t(item.label),
      view === 'perServing' ? item.perServingDisplay : item.display,
    ]);
const fact = (kind, term) => within(section(kind)).getByText(term).nextElementSibling.textContent;
const choice = (name) => within(formatControls()).getByRole('button', { name });

describe('FinalRecipe', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the default gel batch from the plan recipe sections', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'Final Recipe' })).toBeInTheDocument();
    expect(screen.getByText('Totals for a 3.0 hour activity.')).toBeInTheDocument();
    expect(screen.queryByTestId('recipe-section-drink')).not.toBeInTheDocument();

    // 180 min at 75 g/h, 1:0.5: 150 g glucose (158 g maltodextrin) + 75 g fructose; 300 mg/h sodium
    // (900 mg) as 2,290 mg table salt; a 60 % gel of 375 g needs 140 ml added water.
    expect(rows('gel')).toEqual([
      ['Maltodextrin', '158 g'],
      ['Crystalline Fructose', '75 g'],
      ['Sodium Chloride (Table Salt)', '2.3 g'],
      ['Warm water', '140 ml'],
    ]);
    expect(rows('gel')).toEqual(expectedRows({}, 'gel'));
    expect(within(section('gel')).getByRole('heading', { name: 'Gels' })).toBeInTheDocument();
    // One "Ingredients" list per section, inside the section's region.
    expect(within(screen.getByRole('region', { name: 'Gels' })).getByRole('list', { name: 'Ingredients' })).toBe(
      within(section('gel')).getByRole('list', { name: 'Ingredients' }),
    );
    expect(within(section('gel')).getByTestId('section-servings')).toHaveTextContent('9 gels');
    expect(within(section('gel')).getByTestId('amounts-caption')).toHaveTextContent('Whole batch');

    // One gel: 375 g / 9 = 42 g, 25 g carbs, 60 % w/w, about 32 ml.
    expect(fact('gel', 'Gel mass')).toBe('42 g');
    expect(fact('gel', 'Gel volume')).toBe('≈ 32 ml');
    expect(fact('gel', 'Carbs per gel')).toBe('25 g');
    expect(fact('gel', 'Carbohydrate')).toBe('60% w/w');

    // About 4,327 mOsm/kg: rounded to 100 and marked as likely higher, with a tonicity chip that names the band.
    const osmo = within(section('gel')).getByTestId('osmolality');
    expect(osmo).toHaveTextContent('Osmolality≈ 4,300 mOsm/kg, likely higher');
    expect(within(osmo).getByTestId('tonicity-chip')).toHaveTextContent('Hypertonic');

    // Section warning from the gel batch: take each gel with water (pfeiffer2010).
    const warnings = within(section('gel')).getByRole('list', { name: 'Warnings' });
    expect(warnings).toHaveTextContent('Take each gel with about 210 ml of water.');
    expect(warnings.children).toHaveLength(1);
    expect(warnings.children[0]).toHaveAttribute('data-level', 'info');

    // Nothing wrong with the carbs, so no card-level warning.
    expect(within(card()).getAllByRole('list', { name: 'Warnings' })).toHaveLength(1);

    // Carb tooltip from the item detail.
    expect(within(section('gel')).getByText('150 g carbs')).toBeInTheDocument();
    expect(within(section('gel')).getByText('Glucose: 150 g | Fructose: 0 g')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Total' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Per serving' })).toHaveAttribute('aria-pressed', 'false');
    expect(choice('Gel')).toHaveAttribute('aria-pressed', 'true');
    expect(choice('Standard 60%')).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the cost estimate from plan.cost', () => {
    renderCard();
    // 225 g carbs: DIY 225 × 0.015 = 3.375; commercial 22.50; savings 19.125.
    expect(screen.getByText('$3.38')).toBeInTheDocument();
    expect(screen.getByText('$19.13 vs Commercial')).toBeInTheDocument();
  });

  it('switches format.view to per serving and shows the amounts for one gel', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Per serving' }));
    expect(readInputs().format.view).toBe('perServing');
    expect(screen.getByRole('button', { name: 'Per serving' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Amounts for one gel.')).toBeInTheDocument();
    expect(within(section('gel')).getByTestId('amounts-caption')).toHaveTextContent('Per gel');
    // 9 gels: 158/9, 75/9, 2,290/9 mg, 140/9 ml.
    expect(rows('gel')).toEqual([
      ['Maltodextrin', '18 g'],
      ['Crystalline Fructose', '8.3 g'],
      ['Sodium Chloride (Table Salt)', '0.25 g'],
      ['Warm water', '16 ml'],
    ]);
    expect(rows('gel')).toEqual(expectedRows({ format: { view: 'perServing' } }, 'gel', 'perServing'));
    // The tooltip follows the view.
    expect(within(section('gel')).getByText('17 g carbs')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Total' }));
    expect(readInputs().format.view).toBe('total');
  });

  it('switches to a drink and shows the bottles', () => {
    const inputs = { sweat: { source: 'preset' } };
    renderCard(inputs);
    fireEvent.click(choice('Drink'));
    expect(readInputs().format.type).toBe('drink');
    expect(choice('Drink')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('recipe-section-gel')).not.toBeInTheDocument();
    // Gel controls give way to the bottle size.
    expect(screen.queryByLabelText('Gels per Hour')).not.toBeInTheDocument();
    expect(within(formatControls()).queryByRole('group', { name: 'Gel consistency' })).not.toBeInTheDocument();
    expect(choice('750 ml')).toHaveAttribute('aria-pressed', 'true');

    // 800 ml/h for 3 h = 2,400 ml in four 750 ml bottles, each filled to 600 ml.
    expect(within(section('drink')).getByTestId('section-servings')).toHaveTextContent(
      '4 bottles, 600 ml each (750 ml bottle)',
    );
    expect(within(section('drink')).getByTestId('amounts-caption')).toHaveTextContent('All bottles');
    expect(rows('drink')).toEqual([
      ['Maltodextrin', '158 g'],
      ['Crystalline Fructose', '75 g'],
      ['Sodium Chloride (Table Salt)', '4.4 g'],
      ['Water, to fill each bottle to 600 ml', '2,249 ml'],
    ]);
    expect(rows('drink')).toEqual(expectedRows({ ...inputs, format: { type: 'drink' } }, 'drink'));

    expect(fact('drink', 'Fill each bottle to')).toBe('600 ml');
    expect(fact('drink', 'Carbs per bottle')).toBe('56 g (9.4% w/v)');
    expect(fact('drink', 'Sodium per bottle')).toBe('0.43 g (712 mg/L)');
    const osmo = within(section('drink')).getByTestId('osmolality');
    expect(osmo).toHaveTextContent('≈ 312 mOsm/kg');
    expect(osmo).not.toHaveTextContent('likely higher');
    expect(within(osmo).getByTestId('tonicity-chip')).toHaveTextContent('Isotonic');
    expect(within(section('drink')).getByRole('list', { name: 'Warnings' })).toHaveTextContent(
      'Each bottle is 9.4% carbohydrate.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Per serving' }));
    expect(screen.getByText('Amounts for one bottle.')).toBeInTheDocument();
    expect(within(section('drink')).getByTestId('amounts-caption')).toHaveTextContent('Per bottle');
    expect(rows('drink')).toEqual([
      ['Maltodextrin', '39 g'],
      ['Crystalline Fructose', '19 g'],
      ['Sodium Chloride (Table Salt)', '1.1 g'],
      ['Water, to fill each bottle to 600 ml', '562 ml'],
    ]);
  });

  it('picks a bottle size from the presets or a custom size', () => {
    renderCard({ format: { type: 'drink' } });
    fireEvent.click(choice('500 ml'));
    expect(readInputs().format.bottleMl).toBe(500);
    expect(choice('500 ml')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText(/Custom bottle size/)).not.toBeInTheDocument();

    fireEvent.click(choice('Custom'));
    expect(choice('Custom')).toHaveAttribute('aria-pressed', 'true');
    const input = screen.getByLabelText('Custom bottle size (ml, 250–1,500)');
    expect(input).toHaveValue(500);
    fireEvent.change(input, { target: { value: '620' } });
    expect(readInputs().format.bottleMl).toBe(620);
    expect(choice('Custom')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(choice('950 ml'));
    expect(readInputs().format.bottleMl).toBe(950);
    expect(screen.queryByLabelText(/Custom bottle size/)).not.toBeInTheDocument();
  });

  it('shows a custom bottle size that came with the inputs', () => {
    renderCard({ format: { type: 'drink', bottleMl: 600 } });
    expect(choice('Custom')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/Custom bottle size/)).toHaveValue(600);
  });

  it('splits the carbs between gels and a drink in both mode', () => {
    const inputs = { sweat: { source: 'preset' }, format: { type: 'both' } };
    renderCard(inputs);
    expect(choice('Both')).toHaveAttribute('aria-pressed', 'true');
    // Half the carbs in gels, half and all salts in the drink.
    expect(rows('gel')).toEqual(expectedRows(inputs, 'gel'));
    expect(rows('gel')[0]).toEqual(['Maltodextrin', '79 g']);
    expect(rows('gel').some(([label]) => label.startsWith('Sodium'))).toBe(false);
    expect(rows('drink')).toEqual(expectedRows(inputs, 'drink'));
    expect(rows('drink')[2]).toEqual(['Sodium Chloride (Table Salt)', '4.4 g']);
    // A 4.7 % drink is hypotonic (181 mOsm/kg).
    const drinkOsmo = within(section('drink')).getByTestId('osmolality');
    expect(drinkOsmo).toHaveTextContent('≈ 181 mOsm/kg');
    expect(within(drinkOsmo).getByTestId('tonicity-chip')).toHaveTextContent('Hypotonic');

    const share = screen.getByLabelText('Carbs in the drink (%)');
    expect(share).toHaveValue(50);
    expect(share).toHaveAccessibleDescription('The rest goes into gels. The drink holds all the salts.');
    fireEvent.change(share, { target: { value: '25' } });
    expect(readInputs().format.drinkCarbSharePct).toBe(25);
    // 75 % of 158 g maltodextrin in the gels.
    expect(rows('gel')[0]).toEqual(['Maltodextrin', '118 g']);

    const slider = screen.getByLabelText('Carbs in the drink, slider');
    expect(slider).toHaveAttribute('aria-valuetext', '25% in the drink');
    fireEvent.change(slider, { target: { value: '100' } });
    expect(readInputs().format.drinkCarbSharePct).toBe(100);
    // All carbs in the drink: no gels, so the recipe is the drink alone.
    expect(screen.getByLabelText('Gels per Hour')).toHaveAccessibleDescription('No gels: all carbs are in the drink');
    expect(screen.queryByTestId('recipe-section-gel')).not.toBeInTheDocument();
    expect(rows('drink')[0]).toEqual(['Maltodextrin', '158 g']);
  });

  it('sets the gel consistency and shows its carbohydrate %', () => {
    renderCard();
    const group = within(formatControls()).getByRole('group', { name: 'Gel consistency' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Isotonic-style 33%',
      'Liquid 45%',
      'Standard 60%',
      'Thick 70%',
    ]);
    fireEvent.click(choice('Thick 70%'));
    expect(readInputs().format.gelConsistency).toBe('thick');
    expect(fact('gel', 'Carbohydrate')).toBe('70% w/w');
    expect(rows('gel')).toEqual(expectedRows({ format: { gelConsistency: 'thick' } }, 'gel'));
    expect(screen.queryByTestId('isotonic-note')).not.toBeInTheDocument();

    fireEvent.click(choice('Isotonic-style 33%'));
    expect(readInputs().format.gelConsistency).toBe('isotonic');
    expect(screen.getByTestId('isotonic-note')).toHaveTextContent(
      'Close to isotonic only with HBCD or low-DE maltodextrin.',
    );
    // A thinner gel needs more water: 225 g / 0.33 = 682 g in total.
    expect(rows('gel').at(-1)).toEqual(expectedRows({ format: { gelConsistency: 'isotonic' } }, 'gel').at(-1));
    expect(fact('gel', 'Gel mass')).toBe('76 g');
  });

  it('binds the gels-per-hour input to format.gelsPerHour', () => {
    renderCard({ format: { view: 'perServing' } });
    const input = screen.getByLabelText('Gels per Hour');
    expect(input).toHaveAttribute('id');
    expect(input).toHaveValue(3);
    expect(input).toHaveAccessibleDescription('9 gels in total');

    fireEvent.change(input, { target: { value: '2' } });
    expect(readInputs().format.gelsPerHour).toBe(2);
    expect(input).toHaveAccessibleDescription('6 gels in total');
    // 225 g over 6 gels: 158/6 = 26 g maltodextrin.
    expect(rows('gel')).toEqual(expectedRows({ format: { view: 'perServing', gelsPerHour: 2 } }, 'gel', 'perServing'));
    expect(rows('gel')[0]).toEqual(['Maltodextrin', '26 g']);
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
    renderCard({ format: { view: 'perServing' } });
    const input = screen.getByLabelText('Gels per Hour');
    // Out-of-range text is kept while typing and committed (then clamped) on blur.
    fireEvent.change(input, { target: { value: '50' } });
    expect(readInputs().format.gelsPerHour).toBe(3);
    fireEvent.blur(input);
    expect(readInputs().format.gelsPerHour).toBe(12);

    fireEvent.change(input, { target: { value: '0' } });
    expect(readInputs().format.gelsPerHour).toBe(0);
    expect(input).toHaveAccessibleDescription('No gels planned: the carbs go in your drink');
    // No gel batch: the carbs and salt go into a drink that is checked like any drink.
    expect(screen.queryByTestId('recipe-section-gel')).not.toBeInTheDocument();
    expect(rows('drink').slice(0, 3)).toEqual([
      ['Maltodextrin', '158 g'],
      ['Crystalline Fructose', '75 g'],
      ['Sodium Chloride (Table Salt)', '2.3 g'],
    ]);
    expect(screen.queryByText(/Mix them into your drink/)).not.toBeInTheDocument();
  });

  // [thomas2016] no carbs under 45 min: no gels, and the card says why
  it('says no gels are needed when the plan has no carbs', () => {
    renderCard({ event: { durationMin: 30 } });
    expect(screen.getByLabelText('Gels per Hour')).toHaveAccessibleDescription('No gels needed: this plan has no carbs');
    expect(screen.queryByTestId('recipe-section-gel')).not.toBeInTheDocument();
    expect(rows('drink')).toEqual(expectedRows({ event: { durationMin: 30 } }, 'drink'));
    expect(rows('drink')[0]).toEqual(['Sodium Chloride (Table Salt)', '89 mg']);
  });

  it('explains a recipe without carbs when the ratio is 0:0', () => {
    renderCard({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } });
    expect(screen.queryByTestId('recipe-section-gel')).not.toBeInTheDocument();
    expect(rows('drink').some(([label]) => label === 'Maltodextrin')).toBe(false);
    const warnings = within(card()).getAllByRole('list', { name: 'Warnings' }).at(-1);
    expect(warnings.children[0]).toHaveAttribute('data-level', 'danger');
    expect(warnings.children[0]).toHaveTextContent(/Set at least one ratio part above zero/);
    expect(warnings).toHaveTextContent('There are no carbs to put in gels, so the recipe puts the salts in your drink.');
  });

  it('explains a recipe without carb ingredients, with no salt-only gels', () => {
    renderCard({ carbs: { ingredients: [] } });
    expect(screen.getByLabelText('Gels per Hour')).toHaveAccessibleDescription('No gels: your ingredients give no carbs');
    expect(screen.queryByTestId('recipe-section-gel')).not.toBeInTheDocument();
    expect(rows('drink')[0]).toEqual(['Sodium Chloride (Table Salt)', '2.3 g']);
    const warnings = within(card()).getAllByRole('list', { name: 'Warnings' }).at(-1);
    expect(warnings).toHaveTextContent('Add at least one carb ingredient. Without one, the recipe has no carbs.');
  });

  it('says when the ingredients cannot make the ratio and shows what the recipe uses', () => {
    const inputs = {
      carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 1 }, ingredients: [{ ref: 3, weight: 100 }] },
    };
    renderCard(inputs);
    // Maltodextrin alone: 225 g carbs at 0.95 g per g = 237 g, a 1:0 mix.
    expect(rows('gel')[0]).toEqual(['Maltodextrin', '237 g']);
    const warnings = within(card()).getAllByRole('list', { name: 'Warnings' }).at(-1);
    expect(warnings).toHaveTextContent(
      'Your ingredients cannot make 1:1 glucose to fructose. The recipe uses 1:0, the closest they can make.',
    );
    expect(deliveredRatioText(computePlan(inputs))).toBe('1:0');
  });

  it('lists caffeine tablet lines in the gels and shows the no-powder warning', () => {
    renderCard({ caffeine: { enabled: true, asIngredient: true } });
    // 70 kg, 3 mg/kg, 180 min: intra 50 mg (0.5 × 100 mg) in the gel at 120 min (gel 7).
    expect(rows('gel').at(-1)).toEqual(['Caffeine for gel 7 (100 mg tablets)', '0.5 tablets']);
    expect(rows('gel')).toEqual(expectedRows({ caffeine: { enabled: true, asIngredient: true } }, 'gel'));
    const warnings = within(card()).getAllByRole('list', { name: 'Warnings' }).at(-1);
    expect(within(warnings).getByText(/Never use pure caffeine powder/)).toBeInTheDocument();
    expect(warnings.children[0]).toHaveAttribute('data-level', 'danger');
  });

  it('does not show the no-powder warning without caffeine lines', () => {
    // 60 min: only a pre-start dose, so nothing goes into a gel.
    renderCard({ event: { durationMin: 60 }, caffeine: { enabled: true, asIngredient: true } });
    expect(rows('gel').some(([label]) => label.startsWith('Caffeine'))).toBe(false);
    expect(within(card()).queryByText(/Never use pure caffeine powder/)).not.toBeInTheDocument();
  });

  it('shows an empty state when there is nothing to mix', () => {
    renderCard({ event: { durationMin: 30 }, sodium: { mode: 'manual', manualMgPerHour: 0 } });
    expect(screen.queryByTestId('recipe-section-gel')).not.toBeInTheDocument();
    expect(screen.getByText('Nothing to mix for this plan.')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('says why a drink has no bottles when the plan has no fluid', () => {
    renderCard({ format: { type: 'drink' }, fluid: { mode: 'manual', manualMlPerHour: 0 } });
    expect(within(section('drink')).getByTestId('section-servings')).toHaveTextContent('No bottles: no fluid planned');
    expect(within(section('drink')).queryByTestId('osmolality')).not.toBeInTheDocument();
    expect(within(section('drink')).getByRole('list', { name: 'Warnings' })).toHaveTextContent(
      'Your plan has no fluid, so there is no drink to mix.',
    );
  });

  it('puts the whole recipe into a checked drink when no gels are planned', () => {
    renderCard({ sweat: { source: 'preset' }, format: { type: 'both', gelsPerHour: 0 } });
    // No gels: everything is one drink, so its strength covers all 225 g of carbs (9.4 % w/v, not 4.7 %).
    expect(screen.queryByTestId('recipe-section-gel')).not.toBeInTheDocument();
    expect(rows('drink')).toEqual([
      ['Maltodextrin', '158 g'],
      ['Crystalline Fructose', '75 g'],
      ['Sodium Chloride (Table Salt)', '4.4 g'],
      ['Water, to fill each bottle to 600 ml', '2,249 ml'],
    ]);
    expect(fact('drink', 'Carbs per bottle')).toBe('56 g (9.4% w/v)');
    expect(within(section('drink')).getByTestId('osmolality')).toHaveTextContent('≈ 312 mOsm/kg');
    expect(within(section('drink')).getByRole('list', { name: 'Warnings' })).toHaveTextContent('Each bottle is 9.4% carbohydrate.');
    const warnings = within(card()).getAllByRole('list', { name: 'Warnings' }).at(-1);
    expect(warnings).toHaveTextContent('No gels are planned, so the recipe puts all the carbs in your drink.');
    expect(within(card()).queryByText(/Take each gel with/)).not.toBeInTheDocument();
  });

  it('shows the choices that are not picked in a readable ink, not the light secondary gray', () => {
    renderCard();
    const idle = choice('Drink');
    expect(idle).toHaveAttribute('aria-pressed', 'false');
    expect(idle.className).toContain('text-text-primary/75');
    expect(idle.className).not.toContain('text-text-secondary');
    const pct = within(formatControls()).getByRole('button', { name: /Liquid/ }).querySelector('span');
    expect(pct.className).not.toContain('opacity');
  });

  it('opens the mixing modal', () => {
    renderCard();
    expect(screen.getByTestId('modal')).toHaveTextContent('none');
    fireEvent.click(screen.getByRole('button', { name: /View Mixing Instructions/ }));
    expect(screen.getByTestId('modal')).toHaveTextContent('mixing');
  });

  it('opens the print dialog instead of exporting a PDF image', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Print / save as PDF' }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Save as PDF' })).not.toBeInTheDocument();
    // The jsPDF export is gone.
    expect(finalRecipeSource).not.toMatch(/jspdf/i);
  });

  it.each([
    ['gel', {}],
    ['drink with a custom bottle', { format: { type: 'drink', bottleMl: 600 } }],
    ['both', { format: { type: 'both' }, caffeine: { enabled: true, asIngredient: true } }],
  ])('gives every form control an id and a label (%s)', (_, inputs) => {
    const { container } = renderCard(inputs);
    const controls = container.querySelectorAll('input, select, textarea, button');
    expect(controls.length).toBeGreaterThan(5);
    for (const control of controls) {
      expect(control.id).not.toBe('');
      expect(control).toHaveAccessibleName();
    }
    expect(new Set([...controls].map((c) => c.id)).size).toBe(controls.length);
  });
});
