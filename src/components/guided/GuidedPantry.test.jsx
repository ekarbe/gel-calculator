import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { screen, fireEvent, within, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PANTRY_SHELF_IDS } from './GuidedPantry';
import { currentScreen, description, ingredientRefs, latest, renderGuided, resetLatest, screenRegion } from './testUtils';
import { carbSourceOptions } from '../../constants/constants';
import { formatAmount } from '../recipe/recipeText';
import { t } from '../../i18n';
import { createFormat } from '../../i18n/formatters';

let warnSpy;

beforeEach(() => {
  resetLatest();
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  const unknown = warnSpy.mock.calls.filter(([msg]) => String(msg).startsWith('[i18n] Missing message'));
  expect(unknown).toEqual([]);
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

const LABEL = new Map(carbSourceOptions.map((o) => [o.id, o.label]));

/** Renders the flow on the pantry screen. */
function renderPantry(initialInputs) {
  renderGuided(initialInputs);
  act(() => latest.ui.setGuidedStep(2));
  expect(currentScreen()).toBe('pantry');
}

const carbs = () => screen.getByRole('group', { name: 'Carbohydrates' });
const tile = (name) => screen.getByRole('button', { name });
/** The tiles directly on the shelf (not in "More ingredients" or "Your own"). */
const shelfTiles = () => [...carbs().querySelector(':scope > ul').querySelectorAll('[data-testid="pantry-tile"]')];
const tileName = (button) => button.querySelector('[data-testid="pantry-tile-name"]').textContent;
const moreButton = () => screen.getByRole('button', { name: 'More ingredients' });
const salt = () => screen.getByRole('group', { name: 'Salt' });
const saltChoice = () => screen.getByRole('radiogroup', { name: 'Which salt do you have?' });
/** The solver warnings in the ratio reach block. */
const reachWarnings = () => within(screen.getByTestId('ratio-reach').parentElement).queryByRole('list', { name: 'Warnings' });

describe('Guided pantry: carbohydrates', () => {
  it('puts the usual sugars on the shelf as toggle tiles, the default mix picked', () => {
    renderPantry();
    expect(shelfTiles().map(tileName)).toEqual(PANTRY_SHELF_IDS.map((id) => LABEL.get(id)));
    expect(shelfTiles().map(tileName)).toEqual([
      'Maltodextrin',
      'Dextrose (monohydrate)',
      'Crystalline Fructose',
      'Sucrose (Cane Sugar)',
      'Honey',
      'Maple Syrup',
    ]);
    expect(shelfTiles().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'true', 'false', 'false', 'false']);
    // Named by the ingredient alone; described by its split and, when picked, what the recipe uses.
    expect(tile('Maltodextrin')).toHaveAccessibleName('Maltodextrin');
    const f = createFormat('en');
    const item = latest.plan.carbs.ingredients.items.find((i) => i.ref === 3);
    expect(description(tile('Maltodextrin'))).toBe(
      `Glucose 100% · fructose 0% ${formatAmount(t, f, item.grams, 'g')} in the recipe`,
    );
    expect(description(tile('Honey'))).toBe('Glucose 50% · fructose 50%');
  });

  it('adds a picked sugar at weight 50, removes it again, and keeps the focus on the tile', async () => {
    const user = userEvent.setup();
    renderPantry();
    await user.click(tile('Honey'));
    expect(tile('Honey')).toHaveAttribute('aria-pressed', 'true');
    expect(tile('Honey')).toHaveFocus();
    expect(latest.inputs.carbs.ingredients.at(-1)).toEqual({ ref: 14, weight: 50 });
    expect(within(tile('Honey')).getByTestId('pantry-tile-usage')).toBeInTheDocument();
    await user.click(tile('Honey'));
    expect(tile('Honey')).toHaveAttribute('aria-pressed', 'false');
    expect(tile('Honey')).toHaveFocus();
    expect(ingredientRefs()).toEqual([3, 11]);
    // The keyboard toggles too.
    await user.keyboard(' ');
    expect(ingredientRefs()).toEqual([3, 11, 14]);
  });

  it('removes every entry of a sugar listed twice', async () => {
    const user = userEvent.setup();
    renderPantry({ carbs: { ingredients: [{ ref: 3, weight: 40 }, { ref: 11, weight: 30 }, { ref: 3, weight: 20 }] } });
    await user.click(tile('Maltodextrin'));
    expect(ingredientRefs()).toEqual([11]);
  });

  it('says what the recipe does with each picked sugar', () => {
    renderPantry({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 0 } } });
    // Glucose only: the fructose is not needed.
    expect(within(tile('Crystalline Fructose')).getByTestId('pantry-tile-usage')).toHaveTextContent('Not needed for this ratio');
    expect(within(tile('Maltodextrin')).getByTestId('pantry-tile-usage')).toHaveTextContent(/^\d+ g in the recipe$/);
    act(() => latest.set('event.durationMin', 30));
    expect(latest.plan.carbs.deliveredG).toBe(0);
    expect(within(tile('Maltodextrin')).getByTestId('pantry-tile-usage')).toHaveTextContent('Not used: the plan has no carbs');
  });

  it('says the mix cannot use a picked sugar when the plan has carbs but the mix delivers none', () => {
    // A 0:0 ratio set in expert mode: a carb target, nothing delivered.
    renderPantry({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } });
    expect(latest.plan.carbs.totalG).toBeGreaterThan(0);
    expect(latest.plan.carbs.deliveredG).toBe(0);
    expect(within(tile('Maltodextrin')).getByTestId('pantry-tile-usage')).toHaveTextContent(
      'Not used: the mix cannot use it. See the warnings.',
    );
    expect(within(tile('Crystalline Fructose')).getByTestId('pantry-tile-usage')).toHaveTextContent(
      'Not used: the mix cannot use it. See the warnings.',
    );
    expect(screen.queryByText('Not used: the plan has no carbs')).toBeNull();
  });

  it('says the same for a pick of carb-free ingredients only', () => {
    renderPantry({
      carbs: {
        custom: [{ key: 'c1', name: 'Electrolyte tab', carbsPer100g: 0, fructoseSharePct: 0 }],
        ingredients: [{ ref: 'c1', weight: 50 }],
      },
    });
    expect(latest.plan.carbs.totalG).toBeGreaterThan(0);
    expect(latest.plan.carbs.deliveredG).toBe(0);
    expect(latest.plan.carbs.ingredients.warnings.map((w) => w.id)).toContain('carbs.noIngredients');
    expect(within(tile('Electrolyte tab')).getByTestId('pantry-tile-usage')).toHaveTextContent('Not used: the mix cannot use it');
  });

  it('draws unpicked tiles with the control border, 12 px apart, with tabular figures', () => {
    renderPantry();
    expect(tile('Honey')).toHaveClass('border-line-strong', 'num');
    expect(tile('Honey')).not.toHaveClass('border-line');
    expect(tile('Maltodextrin')).toHaveClass('border-ink', 'ring-1');
    const grids = new Set([...carbs().querySelectorAll('[data-testid="pantry-tile"]')].map((b) => b.closest('ul')));
    expect(grids.size).toBe(3); // the shelf, powders and syrups
    for (const grid of grids) expect(grid).toHaveClass('gap-3');
  });

  it('warns right here when the pick cannot make the ratio, or has no carbs', async () => {
    const user = userEvent.setup();
    renderPantry();
    expect(reachWarnings()).toBeNull();
    await user.click(tile('Crystalline Fructose'));
    expect(ingredientRefs()).toEqual([3]);
    expect(reachWarnings()).toHaveTextContent(t(latest.plan.carbs.ingredients.warnings[0].message));
    expect(latest.plan.carbs.ingredients.warnings.map((w) => w.id)).toEqual(['carbs.ratioNotReachable']);
    await user.click(tile('Maltodextrin'));
    expect(ingredientRefs()).toEqual([]);
    expect(latest.plan.carbs.ingredients.warnings.map((w) => w.id)).toEqual(['carbs.noIngredients']);
    expect(reachWarnings()).toHaveTextContent(t('carbs.warn.noIngredients'));
    // The ratio reach bar is there to see what the pick can make.
    expect(screen.getByRole('figure', { name: 'Ratios your ingredients can make' })).toBeInTheDocument();
  });

  it('keeps every other source under "More ingredients", as powders and syrups', async () => {
    const user = userEvent.setup();
    renderPantry();
    expect(moreButton()).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById(moreButton().getAttribute('aria-controls'));
    expect(panel).not.toBeVisible();
    await user.click(moreButton());
    expect(panel).toBeVisible();
    const others = carbSourceOptions.filter((o) => !PANTRY_SHELF_IDS.includes(o.id));
    const powders = within(panel).getByRole('group', { name: 'Powders' });
    const syrups = within(panel).getByRole('group', { name: 'Syrups' });
    expect(within(powders).getAllByTestId('pantry-tile').map(tileName)).toEqual(others.filter((o) => o.group === 'powder').map((o) => o.label));
    expect(within(syrups).getAllByTestId('pantry-tile').map(tileName)).toEqual(others.filter((o) => o.group === 'syrup').map((o) => o.label));
    // Every built-in source is offered exactly once.
    expect(within(carbs()).getAllByTestId('pantry-tile')).toHaveLength(carbSourceOptions.length);
    await user.click(tile('Highly Branched Cyclic Dextrin (HBCD)'));
    expect(ingredientRefs()).toEqual([3, 11, 5]);
  });

  it('opens "More ingredients" on arrival when one of them is in the mix', () => {
    renderPantry({ carbs: { ingredients: [{ ref: 5, weight: 60 }, { ref: 13, weight: 40 }] } });
    expect(moreButton()).toHaveAttribute('aria-expanded', 'true');
    expect(tile('Agave Syrup')).toBeVisible();
    expect(tile('Agave Syrup')).toHaveAttribute('aria-pressed', 'true');
  });

  it("shows the athlete's own ingredients as tiles, and edits them from a label", async () => {
    const user = userEvent.setup();
    renderPantry({
      carbs: {
        custom: [{ key: 'c1', name: 'Gel mix', carbsPer100g: 60, fructoseSharePct: 30 }],
        ingredients: [{ ref: 3, weight: 60 }, { ref: 'c1', weight: 40 }],
      },
    });
    const yours = within(carbs()).getByRole('group', { name: 'Your own' });
    expect(within(yours).getByRole('button', { name: 'Gel mix' })).toHaveAttribute('aria-pressed', 'true');
    expect(description(within(yours).getByRole('button', { name: 'Gel mix' }))).toMatch(/^Glucose 70% · fructose 30% /);
    await user.click(within(yours).getByRole('button', { name: 'Gel mix' }));
    expect(ingredientRefs()).toEqual([3]);
    // Out of the mix, still on the shelf.
    expect(latest.inputs.carbs.custom).toHaveLength(1);
    expect(within(yours).getByRole('button', { name: 'Gel mix' })).toHaveAttribute('aria-pressed', 'false');

    const add = screen.getByRole('button', { name: 'Add your own from a label' });
    expect(add).toHaveAttribute('aria-expanded', 'false');
    await user.click(add);
    const editor = screen.getByTestId('ingredients-custom');
    expect(within(editor).getByRole('heading', { level: 4, name: 'Your ingredients' })).toBeVisible();
    await user.click(within(editor).getByRole('button', { name: 'New ingredient' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Drink powder');
    await user.type(screen.getByRole('textbox', { name: /Carbs per 100 g/ }), '90');
    await user.type(screen.getByRole('textbox', { name: /Fructose share/ }), '50');
    await user.click(screen.getByRole('button', { name: 'Save ingredient' }));
    // A new one joins the mix at once, and gets its tile.
    expect(ingredientRefs()).toEqual([3, 'c2']);
    expect(within(yours).getByRole('button', { name: 'Drink powder' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('explains the ratio target in the screen Why', async () => {
    const user = userEvent.setup();
    renderPantry();
    const why = within(screenRegion()).getAllByRole('button', { name: 'Why?' })[0];
    await user.click(why);
    expect(document.getElementById(why.getAttribute('aria-controls'))).toHaveTextContent(
      t(latest.plan.carbs.ratio.recommended.why.summary),
    );
  });
});

describe('Guided pantry: salt', () => {
  it('asks which sodium salt there is, with the amounts the plan uses', async () => {
    const user = userEvent.setup();
    renderPantry();
    expect(within(saltChoice()).getAllByRole('radio').map((r) => r.textContent)).toEqual([
      'Table salt',
      'Sodium citrate',
      'Both, half each',
    ]);
    expect(within(saltChoice()).getByRole('radio', { name: 'Table salt' })).toHaveAttribute('aria-checked', 'true');
    const amounts = within(salt()).getByRole('list', { name: 'Salt amounts for the whole activity' });
    expect(amounts).toHaveTextContent('Sodium Chloride (Table Salt)');
    await user.click(within(saltChoice()).getByRole('radio', { name: 'Sodium citrate' }));
    expect(latest.inputs.salts.sodiumSalt).toBe('citrate');
    expect(within(salt()).getByRole('list', { name: 'Salt amounts for the whole activity' })).toHaveTextContent('Sodium Citrate');
    await user.click(within(saltChoice()).getByRole('radio', { name: 'Both, half each' }));
    expect(latest.inputs.salts.sodiumSalt).toBe('mix');
  });

  it('explains the sodium target in its Why', async () => {
    const user = userEvent.setup();
    renderPantry();
    const why = within(salt()).getByRole('button', { name: 'Why?' });
    await user.click(why);
    expect(document.getElementById(why.getAttribute('aria-controls'))).toHaveTextContent(
      t(latest.plan.sodium.recommended.why.summary),
    );
  });

  it('keeps manual salts from expert mode until the athlete lets the plan choose', async () => {
    const user = userEvent.setup();
    renderPantry({ salts: { mode: 'manual', manual: [{ ref: 33, amountMg: 2000 }] } });
    expect(screen.queryByRole('radiogroup', { name: 'Which salt do you have?' })).toBeNull();
    expect(within(salt()).getByTestId('guided-salts-manual')).toHaveTextContent('You entered the salts yourself');
    await user.click(screen.getByRole('button', { name: 'Let the plan choose the salts' }));
    expect(latest.inputs.salts.mode).toBe('auto');
    // The manual list stays for expert mode; the focus moves to the choice that appeared.
    expect(latest.inputs.salts.manual).toEqual([{ ref: 33, amountMg: 2000 }]);
    expect(within(saltChoice()).getByRole('radio', { name: 'Table salt' })).toHaveFocus();
  });
});
