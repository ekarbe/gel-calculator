import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import MixingModal from './MixingModal';
import { PlanProvider } from '../../state/PlanProvider';
import { UiProvider, useUi, MIXING_MODAL } from '../../state/UiProvider';

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
      <PlanProvider initialInputs={initialInputs}>
        <Controls />
        <MixingModal />
      </PlanProvider>
    </UiProvider>,
  );
  if (open) fireEvent.click(screen.getByRole('button', { name: 'Open mixing' }));
  return result;
}

const dialog = () => screen.getByRole('dialog', { name: 'DIY Mix Instructions' });
const listTexts = (name) =>
  within(within(dialog()).getByRole('list', { name })).getAllByRole('listitem').map((li) => li.textContent);
const stepTitles = () =>
  within(dialog())
    .getAllByRole('heading', { level: 4 })
    .map((h) => h.textContent);
/** Text of the last step ("During the Activity"). */
const duringText = () => within(dialog()).getByRole('heading', { name: /During the Activity/ }).nextElementSibling.textContent;

describe('MixingModal', () => {
  it('stays closed until the mixing modal is opened', () => {
    renderModal(undefined, { open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open mixing' }));
    expect(dialog()).toHaveAttribute('aria-modal', 'true');
  });

  it('lists the ingredients from the recipe items', () => {
    renderModal();
    expect(within(dialog()).getByText('225 g')).toBeInTheDocument();
    expect(within(dialog()).getByText('Amounts for the whole batch (9 gels).')).toBeInTheDocument();
    expect(listTexts('Ingredients')).toEqual([
      '158 g Maltodextrin',
      '75 g Crystalline Fructose',
      '4.4 g Sodium Chloride (Table Salt)',
    ]);
    expect(stepTitles()).toEqual([
      '1. Gather Ingredients',
      '2. Initial Mixing (Gel Base)',
      '3. Final Consistency',
      '4. During the Activity',
    ]);
    // The fluid comes from the plan and the schedule (800 ml/h; gel 1 lists 260 ml).
    expect(duringText()).toBe(
      'Drink about 800 ml/h: about 260 ml with each gel. The schedule lists the amount for every gel.',
    );
    expect(within(dialog()).queryByTestId('mouth-rinse-note')).not.toBeInTheDocument();
    expect(within(dialog()).queryByRole('list', { name: 'Caffeine tablets' })).not.toBeInTheDocument();
  });

  it('follows the per-gel view', () => {
    renderModal({ format: { view: 'perGel' } });
    expect(within(dialog()).getByText('Amounts for one gel (9 gels in total).')).toBeInTheDocument();
    expect(listTexts('Ingredients')).toEqual([
      '18 g Maltodextrin',
      '8 g Crystalline Fructose',
      '483 mg Sodium Chloride (Table Salt)',
    ]);
  });

  it('explains how to add caffeine tablets and never powder', () => {
    renderModal({ caffeine: { enabled: true, asIngredient: true } });
    expect(stepTitles()).toEqual([
      '1. Gather Ingredients',
      '2. Initial Mixing (Gel Base)',
      '3. Final Consistency',
      '4. Add Caffeine Tablets',
      '5. During the Activity',
    ]);
    // Tablets are not mixed into the batch.
    expect(listTexts('Ingredients')).toHaveLength(3);
    expect(listTexts('Caffeine tablets')).toEqual(['Caffeine for gel 7: 0.5 × 100 mg tablet (50 mg)']);
    expect(within(dialog()).getByText(/Split the batch into 9 equal gels\./)).toBeInTheDocument();
    expect(within(dialog()).getByText(/Crush each tablet into a fine powder/)).toBeInTheDocument();
    const warning = within(within(dialog()).getByRole('list', { name: 'Warnings' })).getByRole('listitem');
    expect(warning).toHaveAttribute('data-level', 'danger');
    expect(warning).toHaveTextContent(
      'Add caffeine as 100 mg tablets. Never use pure caffeine powder. A small measuring error with powder can be fatal.',
    );
  });

  it('uses the chosen tablet size', () => {
    renderModal({ caffeine: { enabled: true, asIngredient: true, tabletMg: 200, mgPerKg: 6 } });
    expect(listTexts('Caffeine tablets')[0]).toMatch(/× 200 mg tablet/);
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

  it('shows an empty ingredient step when there is nothing to mix', () => {
    renderModal({ event: { durationMin: 30 }, sodium: { mode: 'manual', manualMgPerHour: 0 } });
    expect(within(dialog()).queryByRole('list', { name: 'Ingredients' })).not.toBeInTheDocument();
    expect(within(dialog()).getByText('Nothing to mix for this plan.')).toBeInTheDocument();
    expect(stepTitles()).toEqual(['1. Gather Ingredients', '2. During the Activity']);
  });

  // [almond2005] [hewbutler2015] the water advice must follow the plan, never a fixed amount
  it.each([
    // Lightest sweat preset: 200 ml/h, 66.7 ml per 20 min gel → 60 ml (not 150–250 ml).
    [{ sweat: { rateIndex: 0 } }, 'Drink about 200 ml/h: about 60 ml with each gel.'],
    // 2 gels/h at 800 ml/h: 400 ml per gel.
    [{ format: { gelsPerHour: 2 } }, 'Drink about 800 ml/h: about 400 ml with each gel.'],
  ])('takes the fluid per gel from the schedule (%o)', (inputs, text) => {
    renderModal(inputs);
    expect(duringText()).toMatch(text);
  });

  it('gives no fixed water amount when the plan has no fluid', () => {
    renderModal({ fluid: { mode: 'manual', manualMlPerHour: 0 } });
    expect(duringText()).toBe('Take each gel at the time the schedule lists. This plan has no fluid target.');
    expect(within(dialog()).queryByText(/150–250/)).not.toBeInTheDocument();
  });

  // [thomas2016] no carbs under 45 min: no gel to make, the salt goes into the drink
  it('makes no gel base when the plan has no carbs', () => {
    renderModal({ event: { durationMin: 30 } });
    expect(
      within(dialog()).getByText('This plan has no carbs, so there are no gels. Amounts are for the whole activity.'),
    ).toBeInTheDocument();
    expect(stepTitles()).toEqual(['1. Gather Ingredients', '2. Mix Into Your Drink', '3. During the Activity']);
    expect(listTexts('Ingredients')).toEqual(['382 mg Sodium Chloride (Table Salt)']);
    expect(within(dialog()).queryByText(/gel-like paste/)).not.toBeInTheDocument();
    expect(duringText()).toBe('Drink about 800 ml/h. Drinking to thirst also works for this event.');
  });

  it('shows the carbs the recipe delivers and why when the sources cannot make the ratio', () => {
    renderModal({ carbs: { fructoseSources: [] } });
    expect(within(dialog()).getByText(/Total Carbs:/)).toHaveTextContent('Total Carbs: 0 g of 225 g target');
    const warnings = within(dialog()).getByRole('list', { name: 'Warnings' });
    expect(warnings).toHaveTextContent(/cannot make a 1:0.5 glucose to fructose mix/);
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
    renderModal({ caffeine: { enabled: true, asIngredient: true }, event: { durationMin: 180 } });
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
