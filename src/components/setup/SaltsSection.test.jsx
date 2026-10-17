import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, within, cleanup, act } from '@testing-library/react';
import SaltsSection, {
  SaltsFields,
  SaltsModeField,
  SaltsSodiumSaltField,
  SaltsAutoList,
  SaltsManualList,
  SaltsComparison,
  SaltsCustom,
  useSaltsSummary,
  saltContents,
} from './SaltsSection';
import { PlanProvider, usePlanInputs, usePlan } from '../../state/PlanProvider';
import { UiProvider, PREFS_KEY } from '../../state/UiProvider';
import { INPUT_LIMITS, computePlan } from '../../domain/plan';
import { createT } from '../../i18n';
import { createFormat } from '../../i18n/formatters';

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

/** Renders the section with the real providers; autosave is off. `prefs` are stored first. */
function renderSection(initialInputs, { prefs, children = <SaltsSection /> } = {}) {
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

const salts = () => screen.getByRole('region', { name: 'Salts' });
const mode = (name) => within(within(salts()).getByRole('radiogroup', { name: 'Salt mode' })).getByRole('radio', { name });
const saltSelect = (n) => within(salts()).getByRole('combobox', { name: `Salt ${n}` });
const amount = (name) => within(salts()).getByRole('spinbutton', { name: `Amount of ${name} for the whole activity` });
const table = () => within(salts()).getByRole('table', { name: 'Delivered vs target (whole activity)' });
const editor = () => within(salts()).getByRole('list', { name: 'Salts from a label' });

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
  const unknown = warnSpy.mock.calls.filter(([msg]) => String(msg).startsWith('[i18n] Missing message'));
  expect(unknown).toEqual([]);
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('SaltsSection: layout', () => {
  it('is a collapsible region with the Auto/Manual choice in its title row and a summary while closed', () => {
    renderSection();
    const region = salts();
    expect(within(region).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Salts']);
    expect(mode('Auto')).toHaveAttribute('aria-checked', 'true');
    expect(mode('Manual')).toHaveAttribute('aria-checked', 'false');
    const toggle = within(region).getByRole('button', { name: 'Salts' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(region).getByText('Auto · Table salt')).toBeInTheDocument();
    expect(within(region).getByRole('combobox', { name: 'Sodium salt', hidden: true })).not.toBeVisible();
    // The choice stays in reach while the section is closed.
    expect(mode('Manual')).toBeVisible();
  });

  it('summarises manual salts', () => {
    function Summary() {
      return <p data-testid="summary">{useSaltsSummary()}</p>;
    }
    renderSection(
      { salts: { mode: 'manual', manual: [{ ref: 31, amountMg: 100 }, { ref: 33, amountMg: 200 }] } },
      { children: <Summary /> },
    );
    expect(screen.getByTestId('summary')).toHaveTextContent(
      'Manual · Sodium Chloride (Table Salt) and Sodium Citrate (dihydrate)',
    );
    cleanup();
    renderSection({ salts: { mode: 'manual', manual: [] } }, { children: <Summary /> });
    expect(screen.getByTestId('summary')).toHaveTextContent('Manual · no salts');
  });

  it('exports the field groups for the guided flow', () => {
    renderSection(undefined, {
      children: (
        <>
          <SaltsModeField />
          <SaltsSodiumSaltField />
          <SaltsAutoList />
          <SaltsComparison />
        </>
      ),
    });
    expect(screen.getByRole('radiogroup', { name: 'Salt mode' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Sodium salt' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Salt amounts for the whole activity' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    for (const part of [SaltsFields, SaltsManualList, SaltsCustom]) expect(typeof part).toBe('function');
  });
});

describe('SaltsSection: Auto', () => {
  it('picks the sodium salt and lists the amounts for the whole activity', () => {
    renderSection({ sweat: { source: 'preset' } });
    const select = within(salts()).getByRole('combobox', { name: 'Sodium salt' });
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Table salt',
      'Sodium citrate',
      '50:50 mix',
    ]);
    expect(select).toHaveAccessibleDescription('Potassium, magnesium and calcium come from their citrates.');
    let list = within(salts()).getByRole('list', { name: 'Salt amounts for the whole activity' });
    expect(within(list).getByText('Sodium Chloride (Table Salt)')).toBeInTheDocument();
    expect(within(list).getByText('4.4 g')).toBeInTheDocument();
    expect(within(salts()).getByText('Amounts are for the whole activity.')).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'citrate' } });
    expect(latest.inputs.salts.sodiumSalt).toBe('citrate');
    list = within(salts()).getByRole('list', { name: 'Salt amounts for the whole activity' });
    expect(within(list).getByText('Sodium Citrate (dihydrate)')).toBeInTheDocument();
    expect(within(list).getByText('7.3 g')).toBeInTheDocument();
    expect(within(list).queryByText('Sodium Chloride (Table Salt)')).not.toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'mix' } });
    list = within(salts()).getByRole('list', { name: 'Salt amounts for the whole activity' });
    expect(within(list).getByText('2.2 g')).toBeInTheDocument();
    expect(within(list).getByText('3.6 g')).toBeInTheDocument();
    expect(within(table()).getByText('On target')).toHaveAttribute('data-status', 'met');
  });

  it('lists the extras salts too', () => {
    renderSection({ sweat: { source: 'preset' }, extras: { potassium: true, magnesium: true } });
    const list = within(salts()).getByRole('list', { name: 'Salt amounts for the whole activity' });
    expect(within(list).getByText('Potassium Citrate (monohydrate)')).toBeInTheDocument();
    expect(within(list).getByText('Magnesium Citrate (anhydrous)')).toBeInTheDocument();
    expect(within(table()).getAllByRole('row').map((r) => r.querySelector('th')?.textContent)).toEqual([
      'Ion',
      'Sodium',
      'Potassium',
      'Magnesium',
    ]);
  });

  it('says when the plan needs no salts, with no comparison', () => {
    renderSection({ event: { durationMin: 30 }, sodium: { mode: 'manual', manualMgPerHour: 0 } });
    expect(within(salts()).getByText('No salts needed for this plan.')).toBeInTheDocument();
    expect(within(salts()).queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('SaltsSection: Manual', () => {
  it('starts manual salts from the auto amounts, even the largest ones', () => {
    // 48 h at 5000 mg/h sodium from sodium citrate needs about 1,023 g of citrate.
    const extreme = {
      event: { durationMin: 2880 },
      sodium: { mode: 'manual', manualMgPerHour: 5000 },
      salts: { sodiumSalt: 'citrate' },
    };
    const autoItems = computePlan(extreme).salts.items;
    renderSection(extreme);
    fireEvent.click(mode('Manual'));
    expect(latest.inputs.salts.manual).toEqual(autoItems);
    const field = amount('Sodium Citrate (dihydrate)');
    expect(field).toHaveAttribute('aria-valuemax', String(INPUT_LIMITS.saltAmountMg[1] / 1000));
    expect(field).toHaveValue(String(autoItems[0].amountMg / 1000));
    expect(within(table()).getByText('On target')).toBeInTheDocument();
  });

  it('keeps a manual salt row and its focus when its salt changes', () => {
    renderSection({ salts: { mode: 'manual', manual: [{ ref: 31, amountMg: 100 }, { ref: 33, amountMg: 200 }] } });
    const select = saltSelect(1);
    select.focus();
    fireEvent.change(select, { target: { value: '32' } });
    expect(latest.inputs.salts.manual[0]).toEqual({ ref: 32, amountMg: 100 });
    expect(saltSelect(1)).toBe(select);
    expect(select.isConnected).toBe(true);
    expect(document.activeElement).toBe(select);
    // What the salt holds is its description.
    expect(select).toHaveAccessibleDescription('Contains 52.4% Potassium, 47.6% Chloride');
  });

  it('edits manual salt amounts in grams and compares delivered sodium with the target', () => {
    renderSection({ sweat: { source: 'preset' } });
    fireEvent.click(mode('Manual'));

    // Manual starts from the auto amounts.
    expect(latest.inputs.salts).toEqual({
      mode: 'manual',
      sodiumSalt: 'table',
      manual: [{ ref: 31, amountMg: 4351 }],
      custom: [],
    });
    expect(mode('Manual')).toHaveAttribute('aria-checked', 'true');
    const first = saltSelect(1);
    expect(first).toHaveValue('31');
    const field = amount('Sodium Chloride (Table Salt)');
    expect(field).toHaveValue('4.351');
    expect(field).toHaveAttribute('aria-valuetext', '4.351 g');
    expect(within(table()).getByText('On target')).toHaveAttribute('data-status', 'met');

    fireEvent.change(field, { target: { value: '2' } });
    expect(latest.inputs.salts.manual[0].amountMg).toBe(2000);
    expect(within(table()).getByText('Short by 924 mg')).toHaveAttribute('data-status', 'short');

    fireEvent.change(field, { target: { value: '20' } });
    expect(within(table()).getByText('Over by 6,150 mg')).toHaveAttribute('data-status', 'over');
    const warnings = within(salts()).getByRole('list', { name: 'Warnings' });
    expect(within(warnings).getByText(/far above any guideline/)).toBeInTheDocument();

    fireEvent.click(within(salts()).getByRole('button', { name: 'Add salt' }));
    const second = saltSelect(2);
    expect(second).toHaveValue('32'); // the first salt not in the list yet
    expect(second).toHaveFocus();
    expect(within(first).getByRole('option', { name: 'Potassium Chloride' })).toBeDisabled();
    expect(latest.inputs.salts.manual).toEqual([
      { ref: 31, amountMg: 20000 },
      { ref: 32, amountMg: 0 },
    ]);

    fireEvent.change(second, { target: { value: '39' } });
    fireEvent.change(amount('Potassium Citrate (monohydrate)'), { target: { value: '0.5' } });
    expect(latest.inputs.salts.manual[1]).toEqual({ ref: 39, amountMg: 500 });
    // Potassium has no target, so it shows as over.
    expect(within(within(table()).getByRole('row', { name: /Potassium/ })).getByText('Over by 181 mg')).toBeInTheDocument();

    fireEvent.click(within(salts()).getByRole('button', { name: 'Remove Potassium Citrate (monohydrate)' }));
    expect(within(salts()).queryByRole('combobox', { name: 'Salt 2' })).not.toBeInTheDocument();
    expect(latest.inputs.salts.manual).toEqual([{ ref: 31, amountMg: 20000 }]);
    // The focus moves to the row before it, not to the page.
    expect(saltSelect(1)).toHaveFocus();

    // Back to auto and to manual again keeps the manual list.
    fireEvent.click(mode('Auto'));
    expect(within(salts()).getByText('4.4 g')).toBeInTheDocument();
    fireEvent.click(mode('Manual'));
    expect(amount('Sodium Chloride (Table Salt)')).toHaveValue('20');
  });

  it('moves the focus to Add salt after removing the last row', () => {
    renderSection({ salts: { mode: 'manual', manual: [{ ref: 31, amountMg: 100 }] } });
    fireEvent.click(within(salts()).getByRole('button', { name: 'Remove Sodium Chloride (Table Salt)' }));
    expect(within(salts()).getByText('No salts added.')).toBeInTheDocument();
    expect(within(salts()).getByRole('button', { name: 'Add salt' })).toHaveFocus();
  });

  it('disables Add salt when every salt is in the list', () => {
    const manual = [31, 32, 33, 34, 35, 36, 37, 38, 39, 40].map((ref) => ({ ref, amountMg: 0 }));
    renderSection({ salts: { mode: 'manual', manual } });
    expect(within(salts()).getByRole('button', { name: 'Add salt' })).toBeDisabled();
  });

  it('adds a salt from a label in Manual mode and uses its elements', () => {
    renderSection({ salts: { mode: 'manual', manual: [] } });
    expect(within(salts()).queryByRole('list', { name: 'Salts from a label' })).not.toBeInTheDocument();
    expect(within(salts()).getByRole('heading', { level: 3, name: 'Salts from a label' })).toBeInTheDocument();

    fireEvent.click(within(salts()).getByRole('button', { name: 'Add a salt from a label' }));
    expect(latest.inputs.salts.custom).toEqual([
      { key: 's1', name: '', sodiumPct: 0, potassiumPct: 0, magnesiumPct: 0, calciumPct: 0, chloridePct: 0 },
    ]);
    expect(latest.inputs.salts.manual).toEqual([{ ref: 's1', amountMg: 0 }]);
    const name = within(editor()).getByRole('textbox', { name: 'Salt name' });
    expect(name).toHaveFocus();
    expect(name).toHaveAttribute('placeholder', 'Custom salt 1');
    expect(within(editor()).getByText('Enter at least one value from the label.')).toBeInTheDocument();
    expect(within(editor()).getByText('Enter at least one value from the label.').closest('[role="status"]')).not.toBeNull();
    // The new salt is in the manual list under a default name.
    expect(saltSelect(1)).toHaveValue('s1');
    expect(within(saltSelect(1)).getByRole('option', { name: 'Custom salt 1' })).toBeInTheDocument();
    expect(saltSelect(1)).toHaveAccessibleDescription('No values entered yet.');
    // Each salt's fields are a group named after the salt.
    expect(within(editor()).getByRole('group', { name: 'Custom salt 1' })).toBeInTheDocument();

    fireEvent.change(name, { target: { value: 'Drink mix' } });
    fireEvent.change(within(editor()).getByRole('spinbutton', { name: 'Sodium (Na)' }), { target: { value: '20' } });
    expect(latest.inputs.salts.custom[0]).toMatchObject({ name: 'Drink mix', sodiumPct: 20 });
    expect(within(salts()).getByRole('option', { name: 'Drink mix' })).toBeInTheDocument();
    expect(saltSelect(1)).toHaveAccessibleDescription('Contains 20% Sodium');

    // 1 g with 20% sodium delivers 200 mg of the 900 mg target.
    fireEvent.change(amount('Drink mix'), { target: { value: '1' } });
    expect(latest.inputs.salts.manual).toEqual([{ ref: 's1', amountMg: 1000 }]);
    expect(within(within(table()).getByRole('row', { name: /Sodium/ })).getByText('Short by 700 mg')).toBeInTheDocument();

    // Values above 100% in total are flagged, with the level for screen readers, in a polite live
    // region that was there (empty) before, so the note is read out while typing.
    const status = within(editor()).getByTestId('custom-salt-status');
    expect(status).toHaveAttribute('role', 'status');
    expect(status).toBeEmptyDOMElement();
    fireEvent.change(within(editor()).getByRole('spinbutton', { name: 'Chloride (Cl)' }), { target: { value: '90' } });
    expect(within(editor()).getByTestId('custom-salt-status')).toBe(status);
    expect(status).toContainElement(within(editor()).getByTestId('custom-salt-over'));
    expect(within(editor()).getByTestId('custom-salt-over')).toHaveTextContent(
      'Warning: These values add up to 110%, more than the whole salt. Check the label.',
    );

    // A second row can use a built-in salt; the custom salt is taken.
    fireEvent.click(within(salts()).getByRole('button', { name: 'Add salt' }));
    const second = saltSelect(2);
    expect(second).toHaveValue('31');
    expect(within(second).getByRole('option', { name: 'Drink mix' })).toBeDisabled();
    expect([...second.querySelectorAll('optgroup')].map((g) => g.label)).toEqual(['Salts', 'Your salts']);

    // Deleting the custom salt removes its row too.
    fireEvent.click(within(editor()).getByRole('button', { name: 'Delete Drink mix from your salts' }));
    expect(latest.inputs.salts.custom).toEqual([]);
    expect(latest.inputs.salts.manual).toEqual([{ ref: 31, amountMg: 0 }]);
    expect(within(salts()).queryByRole('list', { name: 'Salts from a label' })).not.toBeInTheDocument();
    expect(within(salts()).getByRole('button', { name: 'Add a salt from a label' })).toHaveFocus();
  });

  it('keeps the case of the chemical symbols in the uppercase field labels', () => {
    renderSection({
      salts: {
        mode: 'manual',
        custom: [{ key: 's1', name: 'Mix', sodiumPct: 0, potassiumPct: 0, magnesiumPct: 0, calciumPct: 0, chloridePct: 0 }],
      },
    });
    const names = { sodiumPct: 'Sodium (Na)', potassiumPct: 'Potassium (K)', magnesiumPct: 'Magnesium (Mg)', calciumPct: 'Calcium (Ca)', chloridePct: 'Chloride (Cl)' };
    for (const [field, name] of Object.entries(names)) {
      const input = within(editor()).getByRole('spinbutton', { name });
      expect(input.id.endsWith(field), input.id).toBe(true);
      const label = input.labels[0];
      // The caption style uppercases the label; the symbol opts out ("MAGNESIUM (Mg)", not "(MG)").
      expect(label).toHaveClass('caption');
      const symbol = label.querySelector('.normal-case');
      expect(symbol).toHaveTextContent(name.slice(name.indexOf('(')));
      expect(label.firstChild.textContent).toBe(name.slice(0, name.indexOf(' (')));
    }
  });

  it('keeps at most 10 salts from a label and says why', () => {
    const custom = Array.from({ length: 10 }, (_, i) => ({
      key: `s${i + 1}`,
      name: `Mix ${i + 1}`,
      sodiumPct: 10,
      potassiumPct: 0,
      magnesiumPct: 0,
      calciumPct: 0,
      chloridePct: 0,
    }));
    renderSection({ salts: { mode: 'manual', custom } });
    const button = within(salts()).getByRole('button', { name: 'Add a salt from a label' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('You have 10 salts from a label, the most the app keeps.');
  });

  it('shows the salts from a label in Manual mode only', () => {
    renderSection({ salts: { mode: 'auto' } });
    expect(within(salts()).queryByRole('button', { name: 'Add a salt from a label' })).not.toBeInTheDocument();
    fireEvent.click(mode('Manual'));
    expect(within(salts()).getByRole('button', { name: 'Add a salt from a label' })).toBeInTheDocument();
    expect(within(salts()).queryByRole('combobox', { name: 'Sodium salt' })).not.toBeInTheDocument();
  });
});

describe('SaltsSection: language and units', () => {
  it('writes amounts in German with a comma', async () => {
    renderSection({ sweat: { source: 'preset' } }, { prefs: { locale: 'de', unitSystem: 'metric', currency: 'EUR', mode: 'expert' } });
    await act(async () => {});
    // German text and the decimal comma.
    const saltsDe = () => screen.getByRole('region', { name: 'Salze' });
    const amountDe = (name) => within(saltsDe()).getByRole('spinbutton', { name: `Menge von ${name} für die gesamte Dauer` });
    const tableDe = () => within(saltsDe()).getByRole('table', { name: 'Geliefert vs. Ziel (gesamte Dauer)' });
    const list = within(saltsDe()).getByRole('list', { name: 'Salzmengen für die gesamte Dauer' });
    expect(within(list).getByText('4,4 g')).toBeInTheDocument();
    fireEvent.click(within(within(saltsDe()).getByRole('radiogroup', { name: 'Salzmodus' })).getByRole('radio', { name: 'Manuell' }));
    expect(amountDe('Natriumchlorid (Kochsalz)')).toHaveValue('4,351');
    fireEvent.change(amountDe('Natriumchlorid (Kochsalz)'), { target: { value: '2,5' } });
    expect(latest.inputs.salts.manual[0].amountMg).toBe(2500);
    // 2,500 mg × 39.3% = 982.5 mg of the 1,710 mg target.
    expect(within(tableDe()).getByText('728 mg zu wenig')).toBeInTheDocument();
    fireEvent.change(amountDe('Natriumchlorid (Kochsalz)'), { target: { value: '10' } });
    expect(within(tableDe()).getByText('2.220 mg zu viel')).toBeInTheDocument();
    expect(within(tableDe()).getByText('1.710 mg')).toBeInTheDocument();
  });

  it('keeps salts in grams in imperial', async () => {
    renderSection({ sweat: { source: 'preset' } }, { prefs: { locale: 'en', unitSystem: 'imperial', currency: 'USD', mode: 'expert' } });
    await act(async () => {});
    expect(within(salts()).getByText('4.4 g')).toBeInTheDocument();
  });

  it('describes salt contents with the ion names of the catalog', () => {
    const t = createT('en');
    const f = createFormat('en');
    expect(saltContents(t, f, 33, [])).toBe('Contains 23.5% Sodium, 64.3% Citrate');
    expect(saltContents(t, f, 's9', [])).toBe('No values entered yet.');
  });
});

describe('SaltsSection: accessibility', () => {
  it('gives every form control a unique id and an accessible name', () => {
    let view = renderSection();
    // Auto: the sodium salt.
    expect(expectUniquelyNamed(view.container).map((c) => c.getAttribute('aria-label') ?? c.labels[0].textContent)).toEqual([
      'Sodium salt',
    ]);
    view.unmount();
    view = renderSection({
      salts: {
        mode: 'manual',
        manual: [
          { ref: 31, amountMg: 100 },
          { ref: 's1', amountMg: 200 },
        ],
        custom: [
          { key: 's1', name: 'Mix', sodiumPct: 20, potassiumPct: 0, magnesiumPct: 0, calciumPct: 0, chloridePct: 0 },
          { key: 's2', name: '', sodiumPct: 0, potassiumPct: 0, magnesiumPct: 0, calciumPct: 0, chloridePct: 0 },
        ],
      },
    });
    const controls = expectUniquelyNamed(view.container);
    // 2 manual rows × (salt + amount), 2 salts from a label × (name + 5 elements).
    expect(controls.length).toBe(2 * 2 + 2 * 6);
    // The label fields of each salt repeat per salt, inside a group named after it.
    for (const name of ['Mix', 'Custom salt 2']) {
      const group = within(editor()).getByRole('group', { name });
      expect(within(group).getAllByRole('spinbutton')).toHaveLength(5);
      expect(within(group).getByRole('textbox', { name: 'Salt name' })).toBeInTheDocument();
    }
    expect(screen.getByRole('spinbutton', { name: 'Amount of Mix for the whole activity' })).toBe(amount('Mix'));
  });

  it('marks every comparison status with an icon and text, not colour alone', () => {
    renderSection({ salts: { mode: 'manual', manual: [{ ref: 31, amountMg: 100 }] } });
    const status = within(table()).getByText(/Short by/);
    expect(status.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(status).toHaveTextContent(/^Short by [\d,]+ mg$/);
    // The number and its unit never wrap apart; the icon stays with the first line.
    expect(status.textContent).toMatch(/\d\u00a0mg$/);
    expect(status).toHaveClass('items-start');
  });

  it('needs a PlanProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<SaltsSection />)).toThrow(/must be used inside <PlanProvider>/);
  });
});
