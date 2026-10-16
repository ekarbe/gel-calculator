import { describe, it, expect, afterEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import TemplateModal from './TemplateModal';
import { PlanProvider, usePlanInputs, planInputsReducer } from '../../state/PlanProvider';
import { UiProvider, useUi } from '../../state/UiProvider';
import { TEMPLATES } from '../../constants/templates';
import { sourceDataByIdMap } from '../../constants/constants';
import { normalizeInputs, templateToInputs } from '../../domain/plan';

/** Latest inputs and UI state, captured by <Spy /> after every render. */
const latest = { inputs: null, ui: null };

function Spy() {
  const { inputs } = usePlanInputs();
  const ui = useUi();
  useEffect(() => {
    latest.inputs = inputs;
    latest.ui = ui;
  }, [inputs, ui]);
  return <output data-testid="toast">{ui.toastMessage}</output>;
}

function OpenTemplates() {
  const { openModal } = useUi();
  return (
    <button type="button" onClick={() => openModal('templates')}>
      Open templates
    </button>
  );
}

function renderModal(initialInputs, { open = true } = {}) {
  const utils = render(
    <PlanProvider initialInputs={initialInputs}>
      <UiProvider>
        <OpenTemplates />
        <TemplateModal />
        <Spy />
      </UiProvider>
    </PlanProvider>,
  );
  if (open) fireEvent.click(screen.getByRole('button', { name: 'Open templates' }));
  return utils;
}

const card = (name) => screen.getByRole('article', { name });
const byId = (id) => TEMPLATES.find((tpl) => tpl.id === id);

afterEach(() => {
  latest.inputs = null;
  latest.ui = null;
});

describe('TemplateModal: listing', () => {
  it('is closed until the templates modal is opened', () => {
    renderModal(undefined, { open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open templates' }));
    expect(screen.getByRole('dialog', { name: 'Pre-Mix Templates' })).toBeInTheDocument();
  });

  it('lists every template from src/constants/templates.js', () => {
    renderModal();
    const list = screen.getByRole('list', { name: 'Templates' });
    expect(within(list).getAllByRole('article')).toHaveLength(TEMPLATES.length);
    for (const tpl of TEMPLATES) {
      const c = card(tpl.name);
      expect(within(c).getByRole('heading', { name: tpl.name })).toBeInTheDocument();
      expect(within(c).getByText(`Inspired by ${tpl.brand}; not affiliated`)).toBeInTheDocument();
      expect(within(c).getByText(tpl.description)).toBeInTheDocument();
      expect(within(c).getByText(tpl.verified ? 'Label verified' : /Label not verified/)).toBeInTheDocument();

      const sources = within(c).getByRole('list', { name: 'Sources' });
      const links = within(sources).getAllByRole('link');
      expect(links.map((a) => a.getAttribute('href'))).toEqual(tpl.sources.map((s) => s.url));
      links.forEach((link, i) => {
        expect(link).toHaveTextContent(tpl.sources[i].label);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link.getAttribute('rel')).toContain('noopener');
      });

      const carbLabels = [...tpl.glucoseSources, ...tpl.fructoseSources].map((s) => sourceDataByIdMap.get(s.id).label);
      expect(c).toHaveTextContent(`Carb sources: ${carbLabels.join(', ')}`);
      expect(within(c).getByRole('button', { name: `Use template: ${tpl.name}` })).toBeInTheDocument();
    }
  });

  it('shows per-gel nutrition, ratio, ingredients and a verified badge (Maurten Gel 100)', () => {
    renderModal();
    const c = card('Maurten Gel 100');
    const terms = within(c).getAllByRole('term').map((dt) => dt.textContent);
    const values = within(c).getAllByRole('definition').map((dd) => dd.textContent);
    expect(terms).toEqual(['Carbs', 'Sodium', 'Caffeine']);
    expect(values).toEqual(['25 g', '20 mg', '0 mg']);
    expect(within(c).getByText('Ratio 1:0.8')).toBeInTheDocument();
    expect(c).toHaveTextContent('Carb sources: Dextrose (anhydrous), Crystalline Fructose');
    expect(c).toHaveTextContent('Other ingredients: Water, sodium alginate, gluconic acid, calcium carbonate');
    expect(within(c).getByText('Label verified')).toBeInTheDocument();
    expect(within(c).getByText('Label verified')).toHaveClass('text-apple-green-ink');
    expect(within(c).queryByText(/Label not verified/)).not.toBeInTheDocument();
    expect(c).toHaveTextContent('(checked 2026-10)');
  });

  it('marks estimated labels as not verified and shows the notes (GU Energy Gel)', () => {
    renderModal();
    const tpl = byId('gu-energy-gel');
    const c = card(tpl.name);
    expect(within(c).getByText('Label not verified. Some values are estimates.')).toBeInTheDocument();
    // Dark amber text in the light theme (the bright amber is about 2:1 on white).
    expect(within(c).getByText('Label not verified. Some values are estimates.')).toHaveClass('text-apple-amber-ink');
    expect(within(c).queryByText('Label verified')).not.toBeInTheDocument();
    expect(within(c).getByText('Ratio 1:0.33')).toBeInTheDocument();
    expect(within(c).getByText('Label notes')).toBeInTheDocument();
    expect(within(c).getByText(tpl.notes)).toBeInTheDocument();
  });

  it('skips "Other ingredients" when there are none (UnTapped)', () => {
    renderModal();
    const c = card('UnTapped Maple Syrup Energy Gel');
    expect(c).toHaveTextContent('Carb sources: Maple Syrup');
    expect(c).not.toHaveTextContent('Other ingredients');
    expect(within(c).getByText('Ratio 1:1')).toBeInTheDocument();
  });

  it('shows the gel rate each template gives at the current carb target', () => {
    renderModal(); // default plan: 75 g/h
    expect(card('Maurten Gel 100')).toHaveTextContent('At 75 g/h: 3 gels per hour');
    expect(card('Precision Fuel & Hydration PF 30 Gel')).toHaveTextContent('At 75 g/h: 2.5 gels per hour');
  });
});

describe('TemplateModal: applying and closing', () => {
  it('applies a template through templateToInputs, closes and shows a toast', () => {
    renderModal();
    const tpl = byId('maurten-gel-100');
    fireEvent.click(screen.getByRole('button', { name: `Use template: ${tpl.name}` }));

    // 75 g/h ÷ 25 g per gel = 3 gels/h. The sodium target stays on its evidence-based value.
    expect(latest.inputs.carbs).toMatchObject({
      mode: 'auto',
      ratioMode: 'manual',
      manualRatio: { glucose: 1, fructose: 0.8 },
      glucoseSources: [{ id: 1, percentage: 100 }],
      fructoseSources: [{ id: 11, percentage: 100 }],
    });
    expect(latest.inputs.format.gelsPerHour).toBe(3);
    expect(latest.inputs.sodium).toEqual({ mode: 'auto', manualMgPerHour: 500 });
    expect(latest.inputs.salts).toMatchObject({ mode: 'auto', sodiumSalt: 'table' });

    // Same result as the reducer's apply of templateToInputs on the defaults.
    const expected = planInputsReducer(normalizeInputs(), {
      type: 'apply',
      partial: templateToInputs(tpl, { gPerHour: 75 }),
    });
    expect(latest.inputs).toEqual(expected);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(latest.ui.modal).toBeNull();
    expect(screen.getByTestId('toast')).toHaveTextContent('Maurten Gel 100 template applied');
  });

  it('uses the current effective carb target (manual 100 g/h)', () => {
    renderModal({ carbs: { mode: 'manual', manualGPerHour: 100 } });
    const name = 'Precision Fuel & Hydration PF 30 Gel';
    // 100 / 30 = 3.33 → nearest 0.5 → 3.5 gels/h.
    expect(card(name)).toHaveTextContent('At 100 g/h: 3.5 gels per hour');
    fireEvent.click(screen.getByRole('button', { name: `Use template: ${name}` }));
    expect(latest.inputs.format.gelsPerHour).toBe(3.5);
    expect(latest.inputs.carbs).toMatchObject({ mode: 'manual', manualGPerHour: 100, ratioMode: 'manual' });
    expect(latest.inputs.carbs.manualRatio).toEqual({ glucose: 1, fructose: 0.5 });
    // PF 30 has no sodium on its label; the plan's sodium target is not touched.
    expect(latest.inputs.sodium).toEqual({ mode: 'auto', manualMgPerHour: 500 });
  });

  it('applies a glucose-only template with an empty fructose list', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Use template: SiS GO Isotonic Energy Gel' }));
    expect(latest.inputs.carbs.manualRatio).toEqual({ glucose: 1, fructose: 0 });
    expect(latest.inputs.carbs.fructoseSources).toEqual([]);
    expect(latest.inputs.salts.sodiumSalt).toBe('mix');
  });

  it('closes with the close button without changing the inputs', () => {
    renderModal();
    const before = latest.inputs;
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(latest.inputs).toBe(before);
    expect(screen.getByTestId('toast')).toBeEmptyDOMElement();
  });

  it('closes on Escape', () => {
    renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves focus to the close button when it opens', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });
});
