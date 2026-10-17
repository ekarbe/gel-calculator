import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TemplatesDialog, { templateTextKey } from './TemplatesDialog';
import { latest, renderDialog, resetLatest } from './testUtils';
import { planInputsReducer } from '../../state/PlanProvider';
import { TEMPLATE_MODAL } from '../../state/UiProvider';
import { TEMPLATES } from '../../constants/templates';
import { sourceDataByIdMap } from '../../constants/constants';
import { normalizeInputs, templateToInputs } from '../../domain/plan';
import { MESSAGES } from '../../i18n';

const OPEN = 'Open templates';

function renderTemplates(initialInputs, options = {}) {
  return renderDialog(<TemplatesDialog />, { modal: TEMPLATE_MODAL, openLabel: OPEN, initialInputs, ...options });
}

const dialog = () => screen.getByRole('dialog', { name: 'Gel templates' });
const card = (name) => within(dialog()).getByRole('article', { name });
const byId = (id) => TEMPLATES.find((tpl) => tpl.id === id);

afterEach(() => {
  resetLatest();
  vi.restoreAllMocks();
});

describe('TemplatesDialog: listing', () => {
  it('is closed until the templates dialog is opened', () => {
    renderTemplates(undefined, { open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: OPEN }));
    expect(dialog().tagName).toBe('DIALOG');
    expect(dialog()).toHaveAccessibleDescription(
      'A template copies a commercial gel’s sugar ratio, carb sources and sodium salt. Your carb and sodium targets stay the same.',
    );
  });

  it('lists every template from src/constants/templates.js', () => {
    renderTemplates();
    const list = within(dialog()).getByRole('list', { name: 'Templates' });
    expect(within(list).getAllByRole('article')).toHaveLength(TEMPLATES.length);
    for (const tpl of TEMPLATES) {
      const c = card(tpl.name);
      expect(within(c).getByRole('heading', { level: 3, name: tpl.name })).toBeInTheDocument();
      expect(within(c).getByText(`Inspired by ${tpl.brand}; not affiliated`)).toBeInTheDocument();
      expect(within(c).getByText(tpl.description)).toBeInTheDocument();
      expect(within(c).getByTestId('template-verified')).toHaveTextContent(tpl.verified ? 'Label verified' : 'Label not verified');

      const sources = within(c).getByRole('list', { name: 'Sources' });
      const links = within(sources).getAllByRole('link');
      expect(links.map((a) => a.getAttribute('href'))).toEqual(tpl.sources.map((s) => s.url));
      links.forEach((link, i) => {
        expect(link).toHaveAccessibleName(`${tpl.sources[i].label} (opens in a new tab)`);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link.getAttribute('rel')).toContain('noopener');
      });

      const carbLabels = [...tpl.glucoseSources, ...tpl.fructoseSources].map((s) => sourceDataByIdMap.get(s.id).label);
      expect(within(c).getByTestId('template-carb-sources')).toHaveTextContent(`Carb sources: ${carbLabels.join(', ')}`);
      expect(within(c).getByRole('button', { name: `Use template: ${tpl.name}` })).toHaveTextContent('Use template');
    }
  });

  it('shows per-gel nutrition, ratio, ingredients and a verified badge (Maurten Gel 100)', () => {
    renderTemplates();
    const c = card('Maurten Gel 100');
    const terms = within(c).getAllByRole('term').map((dt) => dt.textContent);
    const values = within(c).getAllByRole('definition').map((dd) => dd.textContent);
    expect(terms).toEqual(['Carbs', 'Sodium', 'Caffeine']);
    expect(values).toEqual(['25 g', '20 mg', '0 mg']);
    expect(within(c).getByTestId('template-ratio')).toHaveTextContent('Ratio 1:0.8');
    expect(within(c).getByTestId('template-carb-sources')).toHaveTextContent(
      'Carb sources: Dextrose (anhydrous), Crystalline Fructose',
    );
    expect(within(c).getByTestId('template-other-ingredients')).toHaveTextContent(
      'Other ingredients: Water, sodium alginate, gluconic acid, calcium carbonate',
    );
    // An icon and text, never colour alone.
    const badge = within(c).getByTestId('template-verified');
    expect(badge).toHaveTextContent('Label verified');
    expect(badge).toHaveClass('text-ok');
    expect(badge.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(within(c).queryByTestId('template-estimates')).not.toBeInTheDocument();
    expect(c).toHaveTextContent('(checked Oct 2026)');
  });

  it('makes each source link a full-height target, not only its line of text', () => {
    renderTemplates();
    for (const link of within(dialog()).getAllByTestId('template-source')) {
      // The link holds the height (24 px, 44 px on touch screens), not its list item.
      expect(link).toHaveClass('inline-flex', 'min-h-6', 'pointer-coarse:min-h-11');
      expect(link.closest('li').className).not.toMatch(/min-h-/);
    }
  });

  it('lets the per-gel tiles wrap as wholes, so a long caption never spills into the next tile', () => {
    renderTemplates();
    const perGel = within(card('Maurten Gel 100')).getByTestId('template-per-gel');
    expect(perGel).toHaveClass('flex', 'flex-wrap');
    expect(perGel.className).not.toMatch(/grid-cols-3/);
    for (const dt of within(perGel).getAllByRole('term')) {
      expect(dt.parentElement).toHaveClass('flex-auto', 'min-w-0');
      expect(dt).toHaveClass('break-words');
    }
  });

  it('marks estimated labels as not verified and shows the notes (GU Energy Gel)', async () => {
    const user = userEvent.setup();
    renderTemplates();
    const tpl = byId('gu-energy-gel');
    const c = card(tpl.name);
    const badge = within(c).getByTestId('template-verified');
    expect(badge).toHaveTextContent('Label not verified');
    expect(badge).toHaveClass('text-warn');
    expect(within(c).getByTestId('template-estimates')).toHaveTextContent('Some values are estimates. The label notes say which.');
    expect(within(c).getByTestId('template-ratio')).toHaveTextContent('Ratio 1:0.33');
    // The notes are a disclosure, closed at first.
    const notes = within(c).getByRole('button', { name: 'Label notes' });
    expect(notes).toHaveAttribute('aria-expanded', 'false');
    expect(within(c).getByText(tpl.notes)).not.toBeVisible();
    await user.click(notes);
    expect(notes).toHaveAttribute('aria-expanded', 'true');
    expect(within(c).getByText(tpl.notes)).toBeVisible();
  });

  it('skips "Other ingredients" when there are none (UnTapped)', () => {
    renderTemplates();
    const c = card('UnTapped Maple Syrup Energy Gel');
    expect(within(c).getByTestId('template-carb-sources')).toHaveTextContent('Carb sources: Maple Syrup');
    expect(c).not.toHaveTextContent('Other ingredients');
    expect(within(c).getByTestId('template-ratio')).toHaveTextContent('Ratio 1:1');
  });

  it('shows the gel rate each template gives at the current carb target', () => {
    renderTemplates(); // default plan: 75 g/h
    expect(within(card('Maurten Gel 100')).getByTestId('template-rate')).toHaveTextContent('At 75 g/h: 3 gels per hour');
    expect(within(card('Precision Fuel & Hydration PF 30 Gel')).getByTestId('template-rate')).toHaveTextContent(
      'At 75 g/h: 2.5 gels per hour',
    );
  });

  it('says "gel" for one gel per hour', () => {
    // 25 g/h ÷ 25 g per gel = 1 gel per hour.
    renderTemplates({ carbs: { mode: 'manual', manualGPerHour: 25 } });
    expect(within(card('Maurten Gel 100')).getByTestId('template-rate')).toHaveTextContent('At 25 g/h: 1 gel per hour');
  });

  it('formats numbers and months for the German locale', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderTemplates(undefined, { prefs: { locale: 'de' } });
    const german = screen.getByRole('dialog', { name: 'Gelvorlagen' });
    const c = within(german).getByRole('article', { name: 'GU Energy Gel' });
    expect(within(c).getByTestId('template-ratio')).toHaveTextContent('1:0,33');
    expect(c).toHaveTextContent('Okt. 2026');
    // Every key has a German twin: nothing falls back to English.
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps the template prose in the catalog identical to src/constants/templates.js', () => {
    for (const tpl of TEMPLATES) {
      expect(MESSAGES[templateTextKey(tpl, 'description')], tpl.id).toBe(tpl.description);
      expect(MESSAGES[templateTextKey(tpl, 'notes')], tpl.id).toBe(tpl.notes);
      if (tpl.otherIngredients !== 'None') {
        expect(MESSAGES[templateTextKey(tpl, 'otherIngredients')], tpl.id).toBe(tpl.otherIngredients);
      }
      tpl.sources.forEach((source, i) => expect(MESSAGES[templateTextKey(tpl, `source.${i}`)], tpl.id).toBe(source.label));
    }
    // No keys for templates or sources that do not exist.
    const ids = new Set(TEMPLATES.map((tpl) => tpl.id));
    for (const key of Object.keys(MESSAGES).filter((k) => k.startsWith('ui-dialogs.templates.data.'))) {
      const [, id, field, index] = /^ui-dialogs\.templates\.data\.([^.]+)\.([^.]+)(?:\.(\d+))?$/.exec(key) ?? [];
      expect(ids.has(id), key).toBe(true);
      if (field === 'source') expect(Number(index), key).toBeLessThan(TEMPLATES.find((tpl) => tpl.id === id).sources.length);
    }
  });
});

describe('TemplatesDialog: applying and closing', () => {
  it('applies a template through templateToInputs, closes and shows a toast', () => {
    renderTemplates();
    const tpl = byId('maurten-gel-100');
    fireEvent.click(within(dialog()).getByRole('button', { name: `Use template: ${tpl.name}` }));

    // 75 g/h ÷ 25 g per gel = 3 gels/h. The sodium target stays on its evidence-based value.
    expect(latest.inputs.carbs).toMatchObject({
      mode: 'auto',
      ratioMode: 'manual',
      manualRatio: { glucose: 1, fructose: 0.8 },
      // One ingredient list (inputs v4): weight = label % × the share of the
      // carbs its v3 list covers at 1:0.8 (5/9 glucose, 4/9 fructose).
      ingredients: [
        { ref: 1, weight: 55.56 },
        { ref: 11, weight: 44.44 },
      ],
    });
    expect(latest.inputs.carbs).not.toHaveProperty('glucoseSources');
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
    expect(screen.getByTestId('toast')).toHaveTextContent('Maurten Gel 100 template applied.');
    expect(screen.getByTestId('toast')).toHaveAttribute('data-tone', 'ok');
  });

  it('uses the current effective carb target (manual 100 g/h)', () => {
    renderTemplates({ carbs: { mode: 'manual', manualGPerHour: 100 } });
    const name = 'Precision Fuel & Hydration PF 30 Gel';
    // 100 / 30 = 3.33 → nearest 0.5 → 3.5 gels/h.
    expect(within(card(name)).getByTestId('template-rate')).toHaveTextContent('At 100 g/h: 3.5 gels per hour');
    fireEvent.click(within(dialog()).getByRole('button', { name: `Use template: ${name}` }));
    expect(latest.inputs.format.gelsPerHour).toBe(3.5);
    expect(latest.inputs.carbs).toMatchObject({ mode: 'manual', manualGPerHour: 100, ratioMode: 'manual' });
    expect(latest.inputs.carbs.manualRatio).toEqual({ glucose: 1, fructose: 0.5 });
    // PF 30 has no sodium on its label; the plan's sodium target is not touched.
    expect(latest.inputs.sodium).toEqual({ mode: 'auto', manualMgPerHour: 500 });
  });

  it('applies a glucose-only template with an empty fructose list', () => {
    renderTemplates();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Use template: SiS GO Isotonic Energy Gel' }));
    expect(latest.inputs.carbs.manualRatio).toEqual({ glucose: 1, fructose: 0 });
    // Glucose-only: maltodextrin carries all the weight.
    expect(latest.inputs.carbs.ingredients).toEqual([{ ref: 3, weight: 100 }]);
    expect(latest.inputs.salts.sodiumSalt).toBe('mix');
  });

  it('closes with the close button without changing the inputs', () => {
    renderTemplates();
    const before = latest.inputs;
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(latest.inputs).toBe(before);
    expect(screen.getByTestId('toast')).toBeEmptyDOMElement();
  });

  it('closes on Escape and returns focus to the opener', async () => {
    const user = userEvent.setup();
    renderTemplates(undefined, { open: false });
    await user.click(screen.getByRole('button', { name: OPEN }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: OPEN })).toHaveFocus();
  });

  it('moves focus to the close button when it opens', async () => {
    const user = userEvent.setup();
    renderTemplates(undefined, { open: false });
    await user.click(screen.getByRole('button', { name: OPEN }));
    expect(within(dialog()).getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('names every control and keeps ids unique', () => {
    renderTemplates();
    for (const control of dialog().querySelectorAll('button, a')) expect(control).toHaveAccessibleName();
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
