import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, within, cleanup, act } from '@testing-library/react';
import FormatSection, {
  FormatFields,
  FormatTypeField,
  FormatGelsPerHourField,
  FormatConsistencyField,
  FormatBottleField,
  FormatDrinkShareField,
  BOTTLE_PRESETS_ML,
} from './FormatSection';
import { PlanProvider, usePlanInputs, usePlan } from '../../state/PlanProvider';
import { UiProvider, PREFS_KEY } from '../../state/UiProvider';

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
function renderSection(initialInputs, { prefs, children = <FormatSection /> } = {}) {
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

const region = () => screen.getByRole('region', { name: 'Format' });
const typeRadio = (name) => within(within(region()).getByRole('radiogroup', { name: 'Format' })).getByRole('radio', { name });
const bottleRadio = (name) => within(within(region()).getByRole('radiogroup', { name: 'Bottle size' })).getByRole('radio', { name });
const gels = () => within(region()).getByRole('spinbutton', { name: 'Gels per hour' });
const queryGels = () => within(region()).queryByRole('spinbutton', { name: 'Gels per hour' });
const consistency = () => within(region()).getByRole('combobox', { name: 'Gel consistency' });
const share = () => within(region()).getByRole('spinbutton', { name: 'Carbs in the drink' });
const shareSlider = () => within(region()).getByRole('slider', { name: 'Carbs in the drink, slider' });
const customBottle = () => within(region()).queryByRole('spinbutton', { name: 'Custom bottle size' });

/** The role a form control is found by. */
const roleOf = (control) =>
  control.getAttribute('role') ??
  (control.tagName === 'SELECT' ? 'combobox' : control.getAttribute('type') === 'range' ? 'slider' : 'textbox');

/**
 * Checks every form control in `container`: it has an id and an accessible
 * name (its aria-label, else its label's text) that finds exactly this
 * control by role (`getByRole` fails on two matches) and that no other
 * control has. Ids on the page are unique. Returns the controls.
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
function expectUniquelyNamed(container) {
  const controls = [...container.querySelectorAll('input, select, textarea')];
  const names = new Set();
  for (const control of controls) {
    expect(control.id, control.outerHTML).not.toBe('');
    const name = (control.getAttribute('aria-label') ?? control.labels?.[0]?.textContent ?? '').trim();
    expect(name, control.outerHTML).not.toBe('');
    expect(control).toHaveAccessibleName(name);
    expect(within(container).getByRole(roleOf(control), { name })).toBe(control);
    expect(names.has(name), name).toBe(false);
    names.add(name);
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

describe('FormatSection: layout', () => {
  it('is a collapsible region with a summary while closed', () => {
    renderSection();
    expect(within(region()).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Format']);
    const toggle = within(region()).getByRole('button', { name: 'Format' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(region()).getByText('Gel · 3 per hour · Standard 60%')).toBeInTheDocument();
  });

  it.each([
    [{ format: { type: 'drink' } }, 'Drink · 750 ml bottles'],
    [{ format: { type: 'both', drinkCarbSharePct: 25 } }, 'Both · 25% of the carbs in the drink'],
  ])('summarises %j', (inputs, text) => {
    renderSection(inputs);
    fireEvent.click(within(region()).getByRole('button', { name: 'Format' }));
    expect(within(region()).getByText(text)).toBeInTheDocument();
  });

  it('summarises a drink in imperial with the bottle size as the presets write it', async () => {
    renderSection({ format: { type: 'drink' } }, { prefs: { locale: 'en', unitSystem: 'imperial', currency: 'USD', mode: 'expert' } });
    await act(async () => {});
    // One decimal, as on the preset (not "25 fl oz").
    expect(bottleRadio('25.4 fl oz')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(region()).getByRole('button', { name: 'Format' }));
    expect(within(region()).getByText('Drink · 25.4 fl oz bottles')).toBeInTheDocument();
    cleanup();
    renderSection(
      { format: { type: 'drink', bottleMl: 500 } },
      { prefs: { locale: 'de', unitSystem: 'imperial', currency: 'USD', mode: 'expert' } },
    );
    await act(async () => {});
    fireEvent.click(within(region()).getByRole('button', { name: 'Format' }));
    expect(within(region()).getByText('Getränk · Flaschen à 16,9 fl oz')).toBeInTheDocument();
  });

  it('shows gel controls for gels', () => {
    renderSection();
    expect(typeRadio('Gel')).toHaveAttribute('aria-checked', 'true');
    expect(gels()).toBeInTheDocument();
    expect(consistency()).toBeInTheDocument();
    expect(within(region()).queryByRole('radiogroup', { name: 'Bottle size' })).not.toBeInTheDocument();
    expect(within(region()).queryByRole('spinbutton', { name: 'Carbs in the drink' })).not.toBeInTheDocument();
  });

  it('exports the field groups for the guided flow', () => {
    renderSection(undefined, {
      children: (
        <>
          <FormatTypeField />
          <FormatGelsPerHourField />
          <FormatConsistencyField />
          <FormatBottleField />
          <FormatDrinkShareField />
        </>
      ),
    });
    expect(screen.getByRole('radiogroup', { name: 'Format' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Gels per hour' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Gel consistency' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Bottle size' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Carbs in the drink, slider' })).toBeInTheDocument();
    expect(typeof FormatFields).toBe('function');
    expect(BOTTLE_PRESETS_ML).toEqual([500, 750, 950]);
  });
});

describe('FormatSection: format type', () => {
  it('switches to a drink: the gel controls give way to the bottle size', () => {
    renderSection({ sweat: { source: 'preset' } });
    fireEvent.click(typeRadio('Drink'));
    expect(latest.inputs.format.type).toBe('drink');
    expect(typeRadio('Drink')).toHaveAttribute('aria-checked', 'true');
    expect(queryGels()).not.toBeInTheDocument();
    expect(within(region()).queryByRole('combobox', { name: 'Gel consistency' })).not.toBeInTheDocument();
    expect(bottleRadio('750 ml')).toHaveAttribute('aria-checked', 'true');
    expect(latest.plan.recipe.sections.map((s) => s.kind)).toEqual(['drink']);
  });

  it('moves between formats with the arrow keys', () => {
    renderSection();
    typeRadio('Gel').focus();
    fireEvent.keyDown(typeRadio('Gel'), { key: 'ArrowRight' });
    expect(latest.inputs.format.type).toBe('drink');
    expect(typeRadio('Drink')).toHaveFocus();
    fireEvent.keyDown(typeRadio('Drink'), { key: 'End' });
    expect(latest.inputs.format.type).toBe('both');
  });
});

describe('FormatSection: bottle size', () => {
  it('picks a bottle size from the presets or a custom size', () => {
    renderSection({ format: { type: 'drink' } });
    fireEvent.click(bottleRadio('500 ml'));
    expect(latest.inputs.format.bottleMl).toBe(500);
    expect(bottleRadio('500 ml')).toHaveAttribute('aria-checked', 'true');
    expect(customBottle()).not.toBeInTheDocument();

    fireEvent.click(bottleRadio('Custom'));
    expect(bottleRadio('Custom')).toHaveAttribute('aria-checked', 'true');
    const input = customBottle();
    expect(input).toHaveValue('500');
    expect(input).toHaveAccessibleDescription('Any size from 250 to 1,500 ml.');
    expect(input).toHaveAttribute('aria-valuemin', '250');
    expect(input).toHaveAttribute('aria-valuemax', '1500');
    fireEvent.change(input, { target: { value: '620' } });
    expect(latest.inputs.format.bottleMl).toBe(620);
    expect(bottleRadio('Custom')).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(bottleRadio('950 ml'));
    expect(latest.inputs.format.bottleMl).toBe(950);
    expect(customBottle()).not.toBeInTheDocument();
  });

  it('shows a custom bottle size that came with the inputs', () => {
    renderSection({ format: { type: 'drink', bottleMl: 600 } });
    expect(bottleRadio('Custom')).toHaveAttribute('aria-checked', 'true');
    expect(customBottle()).toHaveValue('600');
  });

  it('clamps a custom size to 250–1500 ml when leaving the field', () => {
    renderSection({ format: { type: 'drink', bottleMl: 600 } });
    fireEvent.change(customBottle(), { target: { value: '100' } });
    expect(latest.inputs.format.bottleMl).toBe(600);
    fireEvent.blur(customBottle());
    expect(latest.inputs.format.bottleMl).toBe(250);
  });

  it('shows bottle sizes in fl oz in imperial and stores ml', async () => {
    renderSection({ format: { type: 'drink' } }, { prefs: { locale: 'en', unitSystem: 'imperial', currency: 'USD', mode: 'expert' } });
    await act(async () => {});
    expect(bottleRadio('25.4 fl oz')).toHaveAttribute('aria-checked', 'true');
    expect(bottleRadio('16.9 fl oz')).toBeInTheDocument();
    expect(bottleRadio('32.1 fl oz')).toBeInTheDocument();
    fireEvent.click(bottleRadio('Custom'));
    const input = customBottle();
    expect(input).toHaveValue('25.4');
    expect(input).toHaveAttribute('aria-valuetext', '25.4 fl oz');
    expect(input).toHaveAccessibleDescription('Any size from 8.5 to 50.7 fl oz.');
    fireEvent.change(input, { target: { value: '20' } });
    // 20 US fl oz = 591.47 ml, stored in whole ml.
    expect(latest.inputs.format.bottleMl).toBe(591);
  });
});

describe('FormatSection: both', () => {
  it('splits the carbs between gels and a drink', () => {
    renderSection({ sweat: { source: 'preset' }, format: { type: 'both' } });
    expect(typeRadio('Both')).toHaveAttribute('aria-checked', 'true');
    expect(gels()).toBeInTheDocument();
    expect(within(region()).getByRole('radiogroup', { name: 'Bottle size' })).toBeInTheDocument();

    expect(share()).toHaveValue('50');
    expect(share()).toHaveAccessibleDescription('The rest goes into gels. The drink holds all the salts.');
    fireEvent.change(share(), { target: { value: '25' } });
    fireEvent.blur(share());
    expect(latest.inputs.format.drinkCarbSharePct).toBe(25);
    const gel = latest.plan.recipe.sections.find((s) => s.kind === 'gel');
    // 75 % of 158 g maltodextrin in the gels.
    expect(gel.items[0].display).toBe('118 g');

    expect(shareSlider()).toHaveAttribute('aria-valuetext', '25% in the drink');
    fireEvent.change(shareSlider(), { target: { value: '100' } });
    expect(latest.inputs.format.drinkCarbSharePct).toBe(100);
    expect(share()).toHaveValue('100');
    // All carbs in the drink: no gels, so the recipe is the drink alone.
    expect(gels()).toHaveAccessibleDescription('No gels: all carbs are in the drink');
    expect(latest.plan.recipe.sections.map((s) => s.kind)).toEqual(['drink']);
  });
});

describe('FormatSection: gels', () => {
  it('sets the gel consistency and shows its carbohydrate %', () => {
    renderSection();
    expect(within(consistency()).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Isotonic-style 33%',
      'Liquid 45%',
      'Standard 60%',
      'Thick 70%',
    ]);
    expect(consistency()).toHaveDisplayValue('Standard 60%');
    expect(consistency()).toHaveAccessibleDescription(
      'Carbohydrate as % of the gel mass. Higher is thicker and needs more water with each gel.',
    );
    fireEvent.change(consistency(), { target: { value: 'thick' } });
    expect(latest.inputs.format.gelConsistency).toBe('thick');
    expect(latest.plan.concentration.gel.carbPct).toBe(70);
    expect(screen.queryByTestId('isotonic-note')).not.toBeInTheDocument();

    fireEvent.change(consistency(), { target: { value: 'isotonic' } });
    expect(latest.inputs.format.gelConsistency).toBe('isotonic');
    expect(screen.getByTestId('isotonic-note')).toHaveTextContent('Close to isotonic only with HBCD or low-DE maltodextrin.');
  });

  it('binds the gels-per-hour field to format.gelsPerHour', () => {
    renderSection();
    const input = gels();
    expect(input).toHaveAttribute('id');
    expect(input).toHaveValue('3');
    expect(input).toHaveAccessibleDescription('9 gels in total');

    fireEvent.change(input, { target: { value: '2' } });
    expect(latest.inputs.format.gelsPerHour).toBe(2);
    expect(input).toHaveAccessibleDescription('6 gels in total');
    expect(latest.plan.gels.count).toBe(6);

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(latest.inputs.format.gelsPerHour).toBe(2.5);
    fireEvent.click(within(region()).getByRole('button', { name: 'Increase Gels per hour' }));
    expect(latest.inputs.format.gelsPerHour).toBe(3);
  });

  it('says "1 gel" for one gel', () => {
    renderSection({ event: { durationMin: 90 }, format: { gelsPerHour: 0.5 } });
    expect(gels()).toHaveAccessibleDescription('1 gel in total');
  });

  it('lets the gels-per-hour field be cleared while typing without committing', () => {
    renderSection();
    const input = gels();
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue('');
    expect(latest.inputs.format.gelsPerHour).toBe(3);
    fireEvent.blur(input);
    expect(input).toHaveValue('3');
  });

  it('clamps gels per hour to the input limit and handles zero gels', () => {
    renderSection();
    const input = gels();
    // Out-of-range text is kept while typing and committed (then clamped) on blur.
    fireEvent.change(input, { target: { value: '50' } });
    expect(latest.inputs.format.gelsPerHour).toBe(3);
    fireEvent.blur(input);
    expect(latest.inputs.format.gelsPerHour).toBe(12);

    fireEvent.change(input, { target: { value: '0' } });
    expect(latest.inputs.format.gelsPerHour).toBe(0);
    expect(input).toHaveAccessibleDescription('No gels planned: the carbs go in your drink');
    // No gel batch: the carbs and salt go into a drink.
    expect(latest.plan.format.type).toBe('drink');
  });

  // [thomas2016] no carbs under 45 min: no gels, and the section says why
  it('says no gels are needed when the plan has no carbs', () => {
    renderSection({ event: { durationMin: 30 } });
    expect(gels()).toHaveAccessibleDescription('No gels needed: this plan has no carbs');
  });

  it('says why there are no gels without carb ingredients', () => {
    renderSection({ carbs: { ingredients: [] } });
    expect(gels()).toHaveAccessibleDescription('No gels: your ingredients give no carbs');
  });
});

describe('FormatSection: language', () => {
  it('writes the percentages and decimals in German', async () => {
    renderSection({ format: { gelsPerHour: 2.5 } }, { prefs: { locale: 'de', unitSystem: 'metric', currency: 'EUR', mode: 'expert' } });
    await act(async () => {});
    const gelsDe = () => within(region()).getByRole('spinbutton', { name: 'Gels pro Stunde' });
    expect(gelsDe()).toHaveValue('2,5');
    expect(within(region()).getByRole('combobox', { name: 'Gelkonsistenz' })).toHaveDisplayValue('Standard 60 %');
    fireEvent.change(gelsDe(), { target: { value: '1,5' } });
    expect(latest.inputs.format.gelsPerHour).toBe(1.5);
  });
});

describe('FormatSection: accessibility', () => {
  it('gives every form control a unique id and an accessible name', () => {
    const names = (controls) => controls.map((c) => c.getAttribute('aria-label') ?? c.labels[0].textContent);
    let view = renderSection();
    expect(names(expectUniquelyNamed(view.container))).toEqual(['Gels per hour', 'Gel consistency']);
    view.unmount();
    view = renderSection({ format: { type: 'both', bottleMl: 600 } });
    expect(names(expectUniquelyNamed(view.container))).toEqual([
      'Gels per hour',
      'Gel consistency',
      'Custom bottle size',
      'Carbs in the drink',
      'Carbs in the drink, slider',
    ]);
  });

  it('needs a PlanProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<FormatSection />)).toThrow(/must be used inside <PlanProvider>/);
  });
});
