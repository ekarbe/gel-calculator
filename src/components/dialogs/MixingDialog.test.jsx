import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MixingDialog from './MixingDialog';
import { fluidInstruction } from './fluidInstruction';
import { laneTexts, renderDialog } from './testUtils';
import { MIXING_MODAL } from '../../state/UiProvider';
import { computePlan } from '../../domain/plan';
import { createT } from '../../i18n';

const OPEN = 'Open mixing';

function renderMixing(initialInputs, options = {}) {
  return renderDialog(<MixingDialog />, { modal: MIXING_MODAL, openLabel: OPEN, initialInputs, ...options });
}

const dialog = () => screen.getByRole('dialog', { name: 'Mixing steps' });
const block = (kind) => within(dialog()).getByTestId(`mix-section-${kind}`);
const lines = (scope, name) => laneTexts(within(scope).getByRole('list', { name }));
/** Step headings of a block, with the screen-reader "Step N:" prefix. */
const stepTitles = (scope) =>
  within(scope)
    .queryAllByRole('heading', { level: 4 })
    .map((h) => h.textContent);
/** Text of the step with this title. */
const stepText = (scope, title) =>
  within(scope).getByRole('heading', { level: 4, name: new RegExp(title) }).nextElementSibling.textContent;
const duringText = () => within(dialog()).getByTestId('mix-during').textContent;
const sectionWarnings = (kind) => within(block(kind)).queryByRole('list', { name: 'Warnings' });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MixingDialog', () => {
  it('stays closed until the mixing dialog is opened, then opens as a modal dialog', () => {
    renderMixing(undefined, { open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: OPEN }));
    expect(dialog().tagName).toBe('DIALOG');
    expect(dialog()).toHaveAttribute('open');
    expect(within(dialog()).getByRole('heading', { level: 2, name: 'Mixing steps' })).toBeInTheDocument();
  });

  it('makes the gel batch in steps: weigh, dissolve in the warm water, fill the flasks', () => {
    renderMixing();
    const total = within(dialog()).getByRole('group', { name: 'Total carbs' });
    expect(within(total).getByTestId('mix-total-carbs')).toHaveTextContent('225');
    expect(total).toHaveTextContent('225g');
    expect(within(dialog()).queryByTestId('mix-section-drink')).not.toBeInTheDocument();

    const gels = block('gel');
    expect(within(gels).getByRole('heading', { level: 3 })).toHaveTextContent('Gels');
    expect(within(gels).getByTestId('mix-servings')).toHaveTextContent('9 gels');
    expect(within(gels).getByRole('list', { name: 'Gels steps' })).toBeInTheDocument();
    expect(stepTitles(gels)).toEqual([
      'Step 1: Weigh the Ingredients',
      'Step 2: Dissolve',
      'Step 3: Fill the Flasks',
    ]);
    expect(stepText(gels, 'Weigh')).toBe('Weigh these for the whole batch of 9 gels:');
    // The whole batch, whatever view the board shows.
    expect(lines(gels, 'Gel ingredients')).toEqual([
      ['Maltodextrin', '158 g'],
      ['Crystalline Fructose', '75 g'],
      ['Sodium Chloride (Table Salt)', '2.3 g'],
    ]);
    // Each line carries its substance colour.
    const items = within(within(gels).getByRole('list', { name: 'Gel ingredients' })).getAllByRole('listitem');
    expect(items.map((li) => li.dataset.tone)).toEqual(['glucose', 'fructose', 'sodium']);
    // 140 ml added water (60 % gel); 375 g in 9 flasks of 42 g (about 32 ml).
    expect(stepText(gels, 'Dissolve')).toBe(
      'Warm 140 ml of water. Stir in the powders and syrups until they dissolve and the gel is smooth.',
    );
    expect(stepText(gels, 'Fill the Flasks')).toBe(
      'Divide the batch into 9 flasks of about 32 ml (42 g) each. Keep them closed and cool until the start.',
    );
    expect(sectionWarnings('gel')).toHaveTextContent('Take each gel with about 210 ml of water.');

    // The fluid comes from the plan and the schedule (250 ml/h; gel 1 lists 80 ml).
    expect(duringText()).toBe(
      'Drink about 250 ml/h: about 80 ml with each gel. The schedule lists the amount for every gel.',
    );
    expect(within(dialog()).queryByTestId('mouth-rinse-note')).not.toBeInTheDocument();
    expect(within(dialog()).queryByRole('list', { name: 'Caffeine tablets' })).not.toBeInTheDocument();
  });

  it('uses the batch amounts in the per-serving view too', () => {
    renderMixing({ format: { view: 'perServing' } });
    expect(lines(block('gel'), 'Gel ingredients')[0]).toEqual(['Maltodextrin', '158 g']);
  });

  it('says to add no water when the syrups bring enough', () => {
    // Grape juice concentrate alone at 70 %: 341 g of syrup already weighs more than the 321 g gel.
    renderMixing({
      carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 1 }, ingredients: [{ ref: 16, weight: 100 }] },
      format: { gelConsistency: 'thick' },
    });
    expect(stepText(block('gel'), 'Dissolve')).toBe(
      'Add no water: your syrups bring enough. Stir the powders into the syrups until they dissolve and the gel is smooth.',
    );
    expect(sectionWarnings('gel')).toHaveTextContent('No water is added, and the gel will be about 65.6% carbohydrate.');
  });

  it('fills drink bottles to the mark, per bottle', () => {
    renderMixing({ sweat: { source: 'preset' }, format: { type: 'drink' } });
    expect(within(dialog()).queryByTestId('mix-section-gel')).not.toBeInTheDocument();
    const drink = block('drink');
    // 2,400 ml of fluid in four 750 ml bottles, 600 ml each.
    expect(within(drink).getByRole('heading', { level: 3 })).toHaveTextContent('Drink');
    expect(within(drink).getByTestId('mix-servings')).toHaveTextContent('4 bottles, 600 ml each (750 ml bottle)');
    expect(stepTitles(drink)).toEqual(['Step 1: Add the Powders', 'Step 2: Fill and Shake']);
    expect(stepText(drink, 'Add the Powders')).toBe('Make 4 bottles. Put this in each bottle:');
    expect(lines(drink, 'Drink ingredients')).toEqual([
      ['Maltodextrin', '39 g'],
      ['Crystalline Fructose', '19 g'],
      ['Sodium Chloride (Table Salt)', '1.1 g'],
    ]);
    expect(stepText(drink, 'Fill and Shake')).toBe(
      'Add about 562 ml of water, up to the 600 ml mark. Your 750 ml bottle will not be full: that is all the fluid the plan needs from it. Shake until nothing is left at the bottom.',
    );
    expect(sectionWarnings('drink')).toHaveTextContent('Each bottle is 9.4% carbohydrate.');
    // The schedule's first sip (0 min) is 260 ml.
    expect(duringText()).toBe(
      'Drink about 800 ml/h from your bottles: about 260 ml every 20 min. The schedule lists every sip.',
    );
  });

  it('does not mention an unfilled bottle when the bottles are full', () => {
    // 750 ml/h for 2 h: 1,500 ml in two full 750 ml bottles.
    renderMixing({ event: { durationMin: 120 }, fluid: { mode: 'manual', manualMlPerHour: 750 }, format: { type: 'drink' } });
    expect(within(block('drink')).getByTestId('mix-servings')).toHaveTextContent('2 bottles of 750 ml');
    const text = stepText(block('drink'), 'Fill and Shake');
    expect(text).toMatch(/up to the 750 ml mark\. Shake until nothing is left at the bottom\.$/);
    expect(text).not.toMatch(/will not be full/);
  });

  it('makes gels and bottles in both mode, with caffeine tablets in the gels', () => {
    renderMixing({ sweat: { source: 'preset' }, format: { type: 'both' }, caffeine: { enabled: true, asIngredient: true } });
    const gels = block('gel');
    expect(stepTitles(gels)).toEqual([
      'Step 1: Weigh the Ingredients',
      'Step 2: Dissolve',
      'Step 3: Fill the Flasks',
      'Step 4: Add Caffeine Tablets',
    ]);
    // Half the carbs in the gels, no salt (the drink holds it).
    expect(lines(gels, 'Gel ingredients')).toEqual([
      ['Maltodextrin', '79 g'],
      ['Crystalline Fructose', '38 g'],
    ]);
    expect(lines(gels, 'Caffeine tablets')).toEqual([['Caffeine for gel 7 (100 mg tablets)', '0.5 tablets']]);
    expect(within(gels).getByText(/Crush each tablet into a fine powder/)).toBeInTheDocument();
    const noPowder = within(within(gels).getAllByRole('list', { name: 'Warnings' })[0]).getAllByRole('listitem')[0];
    expect(noPowder).toHaveAttribute('data-level', 'danger');
    expect(noPowder).toHaveTextContent(
      'Add caffeine as 100 mg tablets. Never use pure caffeine powder. A small measuring error with powder can be fatal.',
    );
    // The danger is in the caffeine step, not repeated in the summary.
    expect(within(dialog()).getAllByText(/Never use pure caffeine powder\. A small/)).toHaveLength(1);

    const drink = block('drink');
    expect(lines(drink, 'Drink ingredients')).toEqual([
      ['Maltodextrin', '20 g'],
      ['Crystalline Fructose', '9.4 g'],
      ['Sodium Chloride (Table Salt)', '1.1 g'],
    ]);
    // The fluid with each gel comes from the bottles.
    expect(duringText()).toBe(
      'Drink about 800 ml/h from your bottles: about 260 ml with each gel. The schedule lists the amount for every gel.',
    );
  });

  it('uses the chosen tablet size', () => {
    renderMixing({ caffeine: { enabled: true, asIngredient: true, tabletMg: 200, mgPerKg: 6 } });
    expect(lines(block('gel'), 'Caffeine tablets')[0][0]).toMatch(/\(200 mg tablets\)/);
    expect(within(dialog()).getByText(/Add caffeine as 200 mg tablets\./)).toBeInTheDocument();
  });

  it('shows the mouth rinse note for a 45–75 min event', () => {
    renderMixing({ event: { durationMin: 60 } });
    const note = within(dialog()).getByTestId('mouth-rinse-note');
    expect(note).toHaveTextContent(/Mouth rinse option\./);
    expect(within(note).getByRole('link', { name: /^Carter et al\. 2004/ })).toHaveAttribute(
      'href',
      'https://doi.org/10.1249/01.MSS.0000147585.65709.6F',
    );
    expect(within(note).getByRole('link', { name: /^Brietzke et al\. 2019/ })).toHaveAttribute('target', '_blank');
  });

  it('says there is nothing to mix when the recipe is empty', () => {
    renderMixing({ event: { durationMin: 30 }, sodium: { mode: 'manual', manualMgPerHour: 0 } });
    expect(within(dialog()).getByText('Nothing to mix for this plan.')).toBeInTheDocument();
    expect(within(dialog()).queryByTestId('mix-section-gel')).not.toBeInTheDocument();
  });

  // [almond2005] [hewbutler2015] the water advice must follow the plan, never a fixed amount
  it.each([
    // Lightest sweat preset: 200 ml/h, 66.7 ml per 20 min gel → 60 ml (not 150–250 ml).
    [{ sweat: { source: 'preset', rateIndex: 0 } }, 'Drink about 200 ml/h: about 60 ml with each gel.'],
    // 2 gels/h at 800 ml/h: 400 ml per gel.
    [{ sweat: { source: 'preset' }, format: { gelsPerHour: 2 } }, 'Drink about 800 ml/h: about 400 ml with each gel.'],
  ])('takes the fluid per gel from the schedule (%o)', (inputs, text) => {
    renderMixing(inputs);
    expect(duringText()).toMatch(text);
    expect(duringText()).toBe(fluidInstruction(createT('en'), computePlan(inputs)));
  });

  it('gives no fixed water amount when the plan has no fluid', () => {
    renderMixing({ fluid: { mode: 'manual', manualMlPerHour: 0 } });
    expect(duringText()).toBe('Take each gel at the time the schedule lists. This plan has no fluid target.');
    expect(within(dialog()).queryByText(/150–250/)).not.toBeInTheDocument();
  });

  it('adds that drinking to thirst works when the plan says so', () => {
    // 60 min: drinking to thirst is a reasonable alternative under 90 min (kenefick2018).
    renderMixing({ event: { durationMin: 60 } });
    expect(duringText()).toMatch(/Drinking to thirst also works for this event\.$/);
  });

  it('shows why a drink has no bottles when the plan has no fluid', () => {
    renderMixing({ format: { type: 'drink' }, fluid: { mode: 'manual', manualMlPerHour: 0 } });
    expect(stepTitles(block('drink'))).toEqual([]);
    expect(within(block('drink')).getByTestId('mix-servings')).toHaveTextContent('No bottles: no fluid planned');
    expect(sectionWarnings('drink')).toHaveTextContent('Your plan has no fluid, so there is no drink to mix.');
    expect(duringText()).toBe('This plan has no fluid target.');
  });

  // [thomas2016] no carbs under 45 min: no gel to make, the salt goes into a drink
  it('makes no gel base when the plan has no carbs', () => {
    renderMixing({ event: { durationMin: 30 } });
    expect(within(dialog()).getByText('This plan has no carbs, so there are no gels to make.')).toBeInTheDocument();
    expect(within(dialog()).queryByTestId('mix-section-gel')).not.toBeInTheDocument();
    const drink = block('drink');
    expect(stepTitles(drink)).toEqual(['Step 1: Add the Powders', 'Step 2: Fill and Shake']);
    expect(lines(drink, 'Drink ingredients')).toEqual([['Sodium Chloride (Table Salt)', '0.19 g']]);
    // 250 ml/h for 30 min: one bottle filled to 125 ml.
    expect(stepText(drink, 'Fill and Shake')).toMatch(/up to the 125 ml mark/);
    expect(within(dialog()).queryByText(/Warm .* of water/)).not.toBeInTheDocument();
    expect(
      within(dialog()).getByText('There are no carbs to put in gels, so the recipe puts the salts in your drink.'),
    ).toBeInTheDocument();
  });

  it('mixes the whole recipe into a checked drink at 0 gels per hour', () => {
    renderMixing({ format: { gelsPerHour: 0 } });
    expect(within(dialog()).queryByTestId('mix-section-gel')).not.toBeInTheDocument();
    const drink = block('drink');
    expect(stepTitles(drink)).toEqual(['Step 1: Add the Powders', 'Step 2: Fill and Shake']);
    expect(lines(drink, 'Drink ingredients')).toEqual([
      ['Maltodextrin', '158 g'],
      ['Crystalline Fructose', '75 g'],
      ['Sodium Chloride (Table Salt)', '2.3 g'],
    ]);
    // The drink holds all of it, so its own checks say how strong it is.
    // 225 g in the plan's 750 ml.
    expect(sectionWarnings('drink')).toHaveTextContent('Each bottle is 30% carbohydrate.');
    expect(within(dialog()).getByText(/No gels are planned, so the recipe puts all the carbs in your drink/)).toBeInTheDocument();
    // No gel, so no "take each gel with water" note.
    expect(within(dialog()).queryByText(/with each gel/)).not.toBeInTheDocument();
  });

  it('makes no salt-only gels when there is no carb ingredient', () => {
    renderMixing({ carbs: { ingredients: [] } });
    expect(within(dialog()).queryByTestId('mix-section-gel')).not.toBeInTheDocument();
    expect(lines(block('drink'), 'Drink ingredients')).toEqual([['Sodium Chloride (Table Salt)', '2.3 g']]);
    expect(within(dialog()).queryByText(/syrups/)).not.toBeInTheDocument();
    expect(within(dialog()).queryByText(/flask/)).not.toBeInTheDocument();
  });

  it('shows the carbs the recipe delivers and why when there is no carb ingredient', () => {
    renderMixing({ carbs: { ingredients: [] } });
    const total = within(dialog()).getByRole('group', { name: 'Total carbs' });
    expect(within(total).getByTestId('mix-total-carbs')).toHaveTextContent('0');
    expect(total).toHaveTextContent('of 225 g target');
    const warnings = within(dialog()).getAllByRole('list', { name: 'Warnings' })[0];
    expect(warnings).toHaveTextContent('Add at least one carb ingredient.');
  });

  it('writes volumes in US fl oz in imperial units, nutrients stay in g', () => {
    renderMixing({ sweat: { source: 'preset' }, format: { type: 'drink' } }, { prefs: { unitSystem: 'imperial' } });
    const drink = block('drink');
    // 600 ml = 20.3 fl oz, 750 ml = 25 fl oz (whole fl oz from 10).
    expect(within(drink).getByTestId('mix-servings')).toHaveTextContent('4 bottles, 20 fl oz each (25 fl oz bottle)');
    expect(lines(drink, 'Drink ingredients')[0]).toEqual(['Maltodextrin', '39 g']);
    expect(stepText(drink, 'Fill and Shake')).toMatch(/^Add about 19 fl oz of water, up to the 20 fl oz mark\./);
    expect(duringText()).toMatch(/^Drink about 27 fl oz\/h from your bottles: about 8.8 fl oz every 20 min\./);
  });

  it('formats numbers for the German locale', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderMixing(undefined, { prefs: { locale: 'de' } });
    const german = screen.getByRole('dialog', { name: 'Zubereitung' });
    const gels = within(german).getByTestId('mix-section-gel');
    // German text and the decimal comma ("2,3 g").
    expect(lines(gels, 'Gelzutaten')[2][1]).toBe('2,3 g');
    expect(stepTitles(gels)[0]).toBe('Schritt 1: Zutaten abwiegen');
    // Every key has a German twin: nothing falls back to English.
    expect(warn).not.toHaveBeenCalled();
  });

  it('closes with the close button, "Got it" and Escape, and returns focus to the opener', async () => {
    const user = userEvent.setup();
    renderMixing(undefined, { open: false });
    const opener = screen.getByRole('button', { name: OPEN });
    await user.click(opener);
    expect(within(dialog()).getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.click(within(dialog()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('modal')).toHaveTextContent('none');
    expect(opener).toHaveFocus();

    await user.click(opener);
    await user.click(within(dialog()).getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('closes on a click on the backdrop, not on a click inside', () => {
    renderMixing();
    fireEvent.pointerDown(within(dialog()).getByText('Got it'));
    fireEvent.click(within(dialog()).getByText('Got it').closest('div'));
    expect(dialog()).toBeInTheDocument();
    fireEvent.pointerDown(dialog());
    fireEvent.click(dialog());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('puts a tab stop in the scrolling body, so the keyboard can scroll the steps', async () => {
    const user = userEvent.setup();
    renderMixing(undefined, { open: false });
    await user.click(screen.getByRole('button', { name: OPEN }));
    // The default plan has no link or button among the steps: the content itself is the tab stop.
    const content = within(dialog()).getByRole('group', { name: 'Recipe and steps' });
    expect(content).toHaveAttribute('tabindex', '0');
    expect(content).toContainElement(within(dialog()).getByTestId('mix-section-gel'));
    expect(within(dialog()).getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.tab();
    expect(content).toHaveFocus();
    await user.tab();
    expect(within(dialog()).getByRole('button', { name: 'Got it' })).toHaveFocus();
  });

  it('writes a manual fluid rate in whole ml, as the board and the print view do', () => {
    // 20 fl oz typed in imperial is stored as 591.47 ml.
    renderMixing({ fluid: { mode: 'manual', manualMlPerHour: 591.47 } });
    expect(duringText()).toMatch(/^Drink about 591 ml\/h: about \d+ ml with each gel\./);
  });

  it('writes a manual fluid rate typed in fl oz back in fl oz', () => {
    renderMixing({ fluid: { mode: 'manual', manualMlPerHour: 591.47 } }, { prefs: { unitSystem: 'imperial' } });
    expect(duringText()).toMatch(/^Drink about 20 fl oz\/h: /);
  });

  it('names every control and every list, and gives unique ids', () => {
    renderMixing({ caffeine: { enabled: true, asIngredient: true }, format: { type: 'both' }, event: { durationMin: 70 } });
    for (const control of dialog().querySelectorAll('input, select, textarea, button, a')) {
      expect(control).toHaveAccessibleName();
    }
    for (const list of within(dialog()).getAllByRole('list')) expect(list).toHaveAccessibleName();
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
