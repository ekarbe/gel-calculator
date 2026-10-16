import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import MixingModal, { fluidInstruction } from './MixingModal';
import { PlanProvider } from '../../state/PlanProvider';
import { UiProvider, useUi, MIXING_MODAL } from '../../state/UiProvider';
import { computePlan } from '../../domain/plan';

/** Opens the modal the way the recipe card does, and shows which modal is open. */
function Controls() {
  const { openModal, modal } = useUi();
  return (
    <>
      <button type="button" onClick={() => openModal(MIXING_MODAL)}>
        Open mixing
      </button>
      <span data-testid="modal">{modal ?? 'none'}</span>
    </>
  );
}

function renderModal(initialInputs, { open = true } = {}) {
  const result = render(
    <UiProvider>
      <PlanProvider initialInputs={initialInputs} persist={false}>
        <Controls />
        <MixingModal />
      </PlanProvider>
    </UiProvider>,
  );
  if (open) fireEvent.click(screen.getByRole('button', { name: 'Open mixing' }));
  return result;
}

const dialog = () => screen.getByRole('dialog', { name: 'DIY Mix Instructions' });
const block = (kind) => within(dialog()).getByTestId(`mix-section-${kind}`);
const listTexts = (scope, name) =>
  within(within(scope).getByRole('list', { name })).getAllByRole('listitem').map((li) => li.textContent);
const stepTitles = (scope) =>
  within(scope)
    .queryAllByRole('heading', { level: 5 })
    .map((h) => h.textContent);
/** Text of the step with this title. */
const stepText = (scope, title) =>
  within(scope).getByRole('heading', { level: 5, name: new RegExp(title) }).nextElementSibling.textContent;
const duringText = () => within(dialog()).getByTestId('mix-during').textContent;
const sectionWarnings = (kind) => within(block(kind)).queryByRole('list', { name: 'Warnings' });

describe('MixingModal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stays closed until the mixing modal is opened', () => {
    renderModal(undefined, { open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open mixing' }));
    expect(dialog()).toHaveAttribute('aria-modal', 'true');
  });

  it('makes the gel batch in steps: weigh, dissolve in the warm water, fill the flasks', () => {
    renderModal();
    expect(within(dialog()).getByTestId('mix-total-carbs')).toHaveTextContent('Total Carbs: 225 g');
    expect(within(dialog()).queryByTestId('mix-section-drink')).not.toBeInTheDocument();

    const gels = block('gel');
    expect(within(gels).getByRole('heading', { level: 4 })).toHaveTextContent('Gels · 9 gels');
    expect(stepTitles(gels)).toEqual(['1. Weigh the Ingredients', '2. Dissolve', '3. Fill the Flasks']);
    // The whole batch, whatever view the card shows.
    expect(listTexts(gels, 'Gel ingredients')).toEqual([
      '158 g Maltodextrin',
      '75 g Crystalline Fructose',
      '2.3 g Sodium Chloride (Table Salt)',
    ]);
    // 140 ml added water (60 % gel); 375 g in 9 flasks of 42 g (about 32 ml).
    expect(stepText(gels, 'Dissolve')).toBe(
      'Warm 140 ml of water. Stir in the powders and syrups until they dissolve and the gel is smooth.',
    );
    expect(stepText(gels, 'Fill the Flasks')).toBe(
      'Divide the batch into 9 flasks of about 32 ml (42 g) each. Keep them closed and cool until the start.',
    );
    expect(sectionWarnings('gel')).toHaveTextContent('Take each gel with about 210 ml of water.');

    // The fluid comes from the plan and the schedule (100 ml/h; gel 1 lists 30 ml).
    expect(duringText()).toBe(
      'Drink about 100 ml/h: about 30 ml with each gel. The schedule lists the amount for every gel.',
    );
    expect(within(dialog()).queryByTestId('mouth-rinse-note')).not.toBeInTheDocument();
    expect(within(dialog()).queryByRole('list', { name: 'Caffeine tablets' })).not.toBeInTheDocument();
  });

  it('uses the batch amounts in the per-serving view too', () => {
    renderModal({ format: { view: 'perServing' } });
    expect(listTexts(block('gel'), 'Gel ingredients')[0]).toBe('158 g Maltodextrin');
  });

  it('says to add no water when the syrups bring enough', () => {
    // Grape juice concentrate alone at 70 %: 341 g of syrup already weighs more than the 321 g gel.
    renderModal({
      carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 1 }, ingredients: [{ ref: 16, weight: 100 }] },
      format: { gelConsistency: 'thick' },
    });
    expect(stepText(block('gel'), 'Dissolve')).toBe(
      'Add no water: your syrups bring enough. Stir the powders into the syrups until they dissolve and the gel is smooth.',
    );
    expect(sectionWarnings('gel')).toHaveTextContent('No water is added, and the gel will be about 65.6% carbohydrate.');
  });

  it('fills drink bottles to the mark, per bottle', () => {
    renderModal({ sweat: { source: 'preset' }, format: { type: 'drink' } });
    expect(within(dialog()).queryByTestId('mix-section-gel')).not.toBeInTheDocument();
    const drink = block('drink');
    // 2,400 ml of fluid in four 750 ml bottles, 600 ml each.
    expect(within(drink).getByRole('heading', { level: 4 })).toHaveTextContent(
      'Drink · 4 bottles, 600 ml each (750 ml bottle)',
    );
    expect(stepTitles(drink)).toEqual(['1. Add the Powders', '2. Fill and Shake']);
    expect(stepText(drink, 'Add the Powders')).toMatch(/^Make 4 bottles\. Put this in each bottle:/);
    expect(listTexts(drink, 'Drink ingredients')).toEqual([
      '39 g Maltodextrin',
      '19 g Crystalline Fructose',
      '1.1 g Sodium Chloride (Table Salt)',
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
    renderModal({ event: { durationMin: 120 }, fluid: { mode: 'manual', manualMlPerHour: 750 }, format: { type: 'drink' } });
    const text = stepText(block('drink'), 'Fill and Shake');
    expect(text).toMatch(/up to the 750 ml mark\. Shake until nothing is left at the bottom\.$/);
    expect(text).not.toMatch(/will not be full/);
  });

  it('makes gels and bottles in both mode, with caffeine tablets in the gels', () => {
    renderModal({ sweat: { source: 'preset' }, format: { type: 'both' }, caffeine: { enabled: true, asIngredient: true } });
    const gels = block('gel');
    expect(stepTitles(gels)).toEqual([
      '1. Weigh the Ingredients',
      '2. Dissolve',
      '3. Fill the Flasks',
      '4. Add Caffeine Tablets',
    ]);
    // Half the carbs in the gels, no salt (the drink holds it).
    expect(listTexts(gels, 'Gel ingredients')).toEqual(['79 g Maltodextrin', '38 g Crystalline Fructose']);
    expect(listTexts(gels, 'Caffeine tablets')).toEqual(['Caffeine for gel 7 (100 mg tablets): 0.5 tablets']);
    expect(within(gels).getByText(/Crush each tablet into a fine powder/)).toBeInTheDocument();
    const noPowder = within(within(gels).getAllByRole('list', { name: 'Warnings' })[0]).getAllByRole('listitem')[0];
    expect(noPowder).toHaveAttribute('data-level', 'danger');
    expect(noPowder).toHaveTextContent(
      'Add caffeine as 100 mg tablets. Never use pure caffeine powder. A small measuring error with powder can be fatal.',
    );

    const drink = block('drink');
    expect(listTexts(drink, 'Drink ingredients')).toEqual([
      '20 g Maltodextrin',
      '9.4 g Crystalline Fructose',
      '1.1 g Sodium Chloride (Table Salt)',
    ]);
    // The fluid with each gel comes from the bottles.
    expect(duringText()).toBe(
      'Drink about 800 ml/h from your bottles: about 260 ml with each gel. The schedule lists the amount for every gel.',
    );
  });

  it('uses the chosen tablet size', () => {
    renderModal({ caffeine: { enabled: true, asIngredient: true, tabletMg: 200, mgPerKg: 6 } });
    expect(listTexts(block('gel'), 'Caffeine tablets')[0]).toMatch(/\(200 mg tablets\)/);
    expect(within(dialog()).getByText(/Add caffeine as 200 mg tablets\./)).toBeInTheDocument();
  });

  it('shows the mouth rinse note for a 45–75 min event', () => {
    renderModal({ event: { durationMin: 60 } });
    const note = within(dialog()).getByTestId('mouth-rinse-note');
    expect(note).toHaveTextContent(/Mouth rinse option\./);
    expect(within(note).getByRole('link', { name: 'Carter et al. 2004' })).toHaveAttribute(
      'href',
      'https://doi.org/10.1249/01.MSS.0000147585.65709.6F',
    );
    expect(within(note).getByRole('link', { name: 'Brietzke et al. 2019' })).toBeInTheDocument();
  });

  it('says there is nothing to mix when the recipe is empty', () => {
    renderModal({ event: { durationMin: 30 }, sodium: { mode: 'manual', manualMgPerHour: 0 } });
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
    renderModal(inputs);
    expect(duringText()).toMatch(text);
    const plan = computePlan(inputs);
    expect(duringText()).toBe(fluidInstruction(plan));
  });

  it('gives no fixed water amount when the plan has no fluid', () => {
    renderModal({ fluid: { mode: 'manual', manualMlPerHour: 0 } });
    expect(duringText()).toBe('Take each gel at the time the schedule lists. This plan has no fluid target.');
    expect(within(dialog()).queryByText(/150–250/)).not.toBeInTheDocument();
  });

  it('shows why a drink has no bottles when the plan has no fluid', () => {
    renderModal({ format: { type: 'drink' }, fluid: { mode: 'manual', manualMlPerHour: 0 } });
    expect(stepTitles(block('drink'))).toEqual([]);
    expect(sectionWarnings('drink')).toHaveTextContent('Your plan has no fluid, so there is no drink to mix.');
    expect(duringText()).toBe('This plan has no fluid target.');
  });

  // [thomas2016] no carbs under 45 min: no gel to make, the salt goes into a drink
  it('makes no gel base when the plan has no carbs', () => {
    renderModal({ event: { durationMin: 30 } });
    expect(within(dialog()).getByText('This plan has no carbs, so there are no gels to make.')).toBeInTheDocument();
    expect(within(dialog()).queryByTestId('mix-section-gel')).not.toBeInTheDocument();
    const drink = block('drink');
    expect(stepTitles(drink)).toEqual(['1. Add the Powders', '2. Fill and Shake']);
    expect(listTexts(drink, 'Drink ingredients')).toEqual(['89 mg Sodium Chloride (Table Salt)']);
    // 100 ml/h for 30 min: one bottle filled to 50 ml.
    expect(stepText(drink, 'Fill and Shake')).toMatch(/up to the 50 ml mark/);
    expect(within(dialog()).queryByText(/Warm .* of water/)).not.toBeInTheDocument();
    expect(within(dialog()).getByText('There are no carbs to put in gels, so the recipe puts the salts in your drink.')).toBeInTheDocument();
  });

  it('mixes the whole recipe into a checked drink at 0 gels per hour', () => {
    renderModal({ format: { gelsPerHour: 0 } });
    expect(within(dialog()).queryByTestId('mix-section-gel')).not.toBeInTheDocument();
    const drink = block('drink');
    expect(stepTitles(drink)).toEqual(['1. Add the Powders', '2. Fill and Shake']);
    expect(listTexts(drink, 'Drink ingredients')).toEqual([
      '158 g Maltodextrin',
      '75 g Crystalline Fructose',
      '2.3 g Sodium Chloride (Table Salt)',
    ]);
    // The drink holds all of it, so its own checks say how strong it is.
    expect(sectionWarnings('drink')).toHaveTextContent('Each bottle is 75% carbohydrate.');
    expect(within(dialog()).getByText(/No gels are planned, so the recipe puts all the carbs in your drink/)).toBeInTheDocument();
    // No gel, so no "take each gel with water" note.
    expect(within(dialog()).queryByText(/with each gel/)).not.toBeInTheDocument();
  });

  it('makes no salt-only gels when there is no carb ingredient', () => {
    renderModal({ carbs: { ingredients: [] } });
    expect(within(dialog()).queryByTestId('mix-section-gel')).not.toBeInTheDocument();
    const drink = block('drink');
    expect(listTexts(drink, 'Drink ingredients')).toEqual(['2.3 g Sodium Chloride (Table Salt)']);
    expect(within(dialog()).queryByText(/syrups/)).not.toBeInTheDocument();
    expect(within(dialog()).queryByText(/flask/)).not.toBeInTheDocument();
  });

  it('shows the carbs the recipe delivers and why when there is no carb ingredient', () => {
    renderModal({ carbs: { ingredients: [] } });
    expect(within(dialog()).getByTestId('mix-total-carbs')).toHaveTextContent('Total Carbs: 0 g of 225 g target');
    const warnings = within(dialog()).getAllByRole('list', { name: 'Warnings' })[0];
    expect(warnings).toHaveTextContent('Add at least one carb ingredient.');
  });

  it('closes with the close button', () => {
    renderModal();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('modal')).toHaveTextContent('none');
  });

  it('closes with "Got It"', () => {
    renderModal();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Got It' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('gives every control an id and a label', () => {
    renderModal({ caffeine: { enabled: true, asIngredient: true }, format: { type: 'both' } });
    for (const control of dialog().querySelectorAll('input, select, textarea, button')) {
      expect(control.id).not.toBe('');
      expect(control).toHaveAccessibleName();
    }
  });

  it('closes with Escape', () => {
    renderModal();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
