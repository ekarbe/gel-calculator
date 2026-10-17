import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup, act } from '@testing-library/react';
import PrintRecipe from './PrintRecipe';
import { planCitations, referenceText } from './printText';
import { PlanProvider, usePlanInputs } from '../../state/PlanProvider';
import { UiProvider, useUi, PREFS_KEY } from '../../state/UiProvider';
import { computePlan } from '../../domain/plan';
import { formatElapsed } from '../../domain/schedule';
import { citationLabel } from '../../domain/evidence';
import { t } from '../../i18n';

/** A preset sweat rate of 1.25 L/h: 800 ml/h of fluid, 2,400 ml in 3 h. */
const PRESET_SWEAT = { sweat: { source: 'preset' } };

/** Controls outside the print view: change the inputs and the display units. */
function Controls() {
  const { set } = usePlanInputs();
  const { setUnitSystem, setLocale } = useUi();
  return (
    <>
      <button type="button" onClick={() => set('event.durationMin', 120)}>
        Set 120 min
      </button>
      <button type="button" onClick={() => setUnitSystem('imperial')}>
        Use imperial units
      </button>
      <button type="button" onClick={() => setLocale('de')}>
        Use German
      </button>
    </>
  );
}

/** The print view with the real providers (autosave off). `prefs` are stored first. */
function renderPrint(initialInputs, { prefs } = {}) {
  if (prefs) window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  return render(
    <PlanProvider initialInputs={initialInputs} persist={false}>
      <UiProvider>
        <PrintRecipe />
        <Controls />
      </UiProvider>
    </PlanProvider>,
  );
}

const printView = () => screen.getByTestId('print-recipe');
const region = (name) => within(printView()).getByRole('region', { name });

/**
 * The value printed next to a summary term.
 * @param {string} term
 * @param {string} [block] name of the summary block ("Planübersicht" in German)
 */
function summary(term, block = 'Plan summary') {
  const dt = within(region(block))
    .getAllByRole('term')
    .find((el) => el.textContent === term);
  if (!dt) throw new Error(`No summary row "${term}"`);
  return dt.nextElementSibling.textContent;
}

/** Rows of a table as arrays of cell texts (header row included). */
const rowsOf = (table) =>
  within(table)
    .getAllByRole('row')
    .map((row) => Array.from(row.querySelectorAll('th, td'), (cell) => cell.textContent));

let warnSpy;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  // No key of this area may be missing from the catalogs, in English or German.
  const unknown = warnSpy.mock.calls.filter(([msg]) => String(msg).startsWith('[i18n] Missing'));
  expect(unknown).toEqual([]);
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('PrintRecipe: page', () => {
  it('has a title, every block, and the token colours the print styles flatten to black on white', () => {
    renderPrint();
    // The shell's print host hides it on screen; the page itself uses the tokens, never a fixed palette.
    expect(printView()).toHaveClass('bg-surface', 'text-ink');
    expect(printView().outerHTML).not.toMatch(/\b(bg-white|text-black|text-gray-\d+|border-gray-\d+)\b/);
    expect(within(printView()).getByRole('heading', { level: 1, name: 'Race-day fuel plan' })).toBeInTheDocument();
    for (const name of ['Plan summary', 'Recipe', 'Mixing', 'Schedule', 'Warnings and notes', 'Sources']) {
      expect(region(name)).toBeInTheDocument();
    }
  });

  it('prints today’s date, read again just before printing', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 16, 12, 0));
    renderPrint();
    expect(screen.getByTestId('print-date')).toHaveTextContent('Printed on October 16, 2026');

    vi.setSystemTime(new Date(2026, 9, 18, 9, 0));
    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
    });
    expect(screen.getByTestId('print-date')).toHaveTextContent('Printed on October 18, 2026');
  });

  it('prints the date in the UI language', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 16, 12, 0));
    renderPrint();
    fireEvent.click(screen.getByRole('button', { name: 'Use German' }));
    expect(screen.getByTestId('print-date')).toHaveTextContent('16. Oktober 2026');
  });

  it('follows the plan when the inputs change', () => {
    renderPrint();
    expect(summary('Activity')).toBe('Cycling · 3 h · Moderate intensity');
    fireEvent.click(screen.getByRole('button', { name: 'Set 120 min' }));
    expect(summary('Activity')).toBe('Cycling · 2 h · Moderate intensity');
    expect(summary('Carbohydrate')).toMatch(/^55 g\/h · 110 g in the recipe/);
  });

  it('closes with the disclaimer', () => {
    renderPrint();
    expect(printView()).toHaveTextContent('This plan is general guidance, not medical advice.');
  });

  it('keeps each block heading with what follows it on paper', () => {
    renderPrint();
    for (const name of ['Plan summary', 'Recipe', 'Mixing', 'Schedule', 'Warnings and notes', 'Sources']) {
      expect(within(region(name)).getByRole('heading', { level: 2 })).toHaveClass('break-after-avoid');
    }
  });
});

describe('PrintRecipe: plan summary', () => {
  it('summarises the default plan', () => {
    renderPrint();
    expect(summary('Activity')).toBe('Cycling · 3 h · Moderate intensity');
    expect(summary('Conditions')).toBe('Outdoors · 20 °C · 50% humidity · shade or overcast');
    // 75 g/h × 3 h = 225 g at 1:0.5; 300 mg/h sodium, all of it in 2,290 mg table salt.
    expect(summary('Carbohydrate')).toBe('75 g/h · 225 g in the recipe · glucose:fructose 1:0.5');
    expect(summary('Sodium')).toBe('300 mg/h · 900 mg in the recipe');
    expect(summary('Fluid')).toBe('100 ml/h · 300 ml in total');
    expect(summary('Sweat rate')).toBe('0.15 L/h ± 0.5 (heat-balance estimate)');
    expect(summary('Body mass')).toBe(
      'About −0.6 kg on the scale after the activity · Water lost 0.15 L (0.2% of body mass) · Up to 2% loss',
    );
    expect(summary('Format')).toBe('Gels: 9 gels (3 per hour)');
    // The burn is an estimate: rounded to 10 kcal, as the activity summary shows it.
    expect(summary('Energy')).toBe('900 kcal from carbohydrate · about 2,040 kcal burned (estimate)');
    const terms = within(region('Plan summary')).getAllByRole('term').map((dt) => dt.textContent);
    expect(terms).not.toContain('Caffeine');
    expect(terms).not.toContain('Sodium bicarbonate');
  });

  it('names the sweat source, the drink bottles, caffeine and bicarbonate', () => {
    renderPrint({
      ...PRESET_SWEAT,
      format: { type: 'drink' },
      caffeine: { enabled: true },
      bicarb: { enabled: true },
    });
    expect(summary('Sweat rate')).toBe('1.25 L/h ± 0.5 (self-assessed preset)');
    expect(summary('Fluid')).toBe('800 ml/h · 2,400 ml in total');
    expect(summary('Format')).toBe('Drink: 4 bottles, 600 ml each (750 ml bottle)');
    // 70 kg × 3 mg/kg = 210 mg; 0.3 g/kg bicarbonate = 21 g, 90 min before the start.
    expect(summary('Caffeine')).toBe('210 mg in total (3 mg/kg)');
    expect(summary('Sodium bicarbonate')).toBe('21 g, 90 min before the start');
  });

  it('lists gels and bottles for "both"', () => {
    renderPrint({ ...PRESET_SWEAT, format: { type: 'both' } });
    expect(summary('Format')).toBe('Gels: 9 gels (3 per hour). Drink: 4 bottles, 600 ml each (750 ml bottle)');
  });

  it('says so when a plan has no gels and no drink', () => {
    renderPrint({ format: { gelsPerHour: 0 }, event: { durationMin: 30 }, sodium: { mode: 'manual', manualMgPerHour: 0 } });
    // Nothing to mix: the format stays gels, without any.
    expect(summary('Format')).toBe('Gels: no gels');
  });

  // [hewbutler2015] drinking more than you sweat is a gain, never a "negative deficit"
  it('prints a projected gain as water gained, as on screen', () => {
    renderPrint({ fluid: { mode: 'manual', manualMlPerHour: 1000 }, sweat: { source: 'preset', rateIndex: 0 } });
    expect(summary('Body mass')).toBe(
      'About +1.8 kg on the scale after the activity · Water gained 2.25 L (3.2% of body mass) · Weight gain',
    );
  });

  it('rounds the scale change before it picks the sign', () => {
    // 0.25 L/h preset, 370 ml/h for 3 h: −0.047 kg on the scale reads 0, never "−0".
    renderPrint({ fluid: { mode: 'manual', manualMlPerHour: 370 }, sweat: { source: 'preset', rateIndex: 0 } });
    expect(summary('Body mass')).toMatch(/^About 0 kg on the scale/);
  });

  it('names a mild or high loss with its limits', () => {
    // 1.25 L/h sweat with no fluid for 3 h: 3.75 L, 5.4% of 70 kg.
    renderPrint({ ...PRESET_SWEAT, fluid: { mode: 'manual', manualMlPerHour: 0 } });
    expect(summary('Body mass')).toMatch(/ · Over 3% loss$/);
  });

  it('leaves the sun out of indoor conditions, as the sweat model does', () => {
    renderPrint({ event: { setting: 'indoorFan' }, environment: { sun: 'full' } });
    expect(summary('Conditions')).toBe('Indoors with a fan · 20 °C · 50% humidity');
  });

  it('uses the unit system', () => {
    renderPrint();
    fireEvent.click(screen.getByRole('button', { name: 'Use imperial units' }));
    expect(summary('Conditions')).toBe('Outdoors · 68 °F · 50% humidity · shade or overcast');
    // −0.558 kg × 2.20462 = −1.23 lb.
    expect(summary('Body mass')).toMatch(/^About −1\.2 lb on the scale/);
    expect(summary('Body mass')).toContain('Water lost 5.1 fl oz (0.2% of body mass)');
    // 100 ml/h for 3 h: 3.4 fl oz/h, 10 fl oz in total. Nutrients stay g and mg.
    expect(summary('Fluid')).toBe('3.4 fl oz/h · 10 fl oz in total');
    expect(summary('Sweat rate')).toBe('5.1 fl oz/h ± 17 (heat-balance estimate)');
    expect(summary('Carbohydrate')).toBe('75 g/h · 225 g in the recipe · glucose:fructose 1:0.5');
  });

  it('uses German number formats', () => {
    renderPrint({ ...PRESET_SWEAT, format: { type: 'drink' } }, { prefs: { locale: 'de', unitSystem: 'metric', mode: 'expert' } });
    const de = (term) => summary(term, 'Planübersicht');
    expect(de('Trinkmenge')).toBe('800 ml/h · 2.400 ml insgesamt');
    expect(de('Schweißrate')).toBe('1,25 L/h ± 0,5 (Selbsteinschätzung)');
    expect(de('Kohlenhydrate')).toContain('Glukose:Fruktose 1:0,5');
    expect(de('Bedingungen')).toContain('50\u00a0% Luftfeuchtigkeit');
  });

  it('prints a 0:0 ratio as 0:0', () => {
    renderPrint({ carbs: { ratioMode: 'manual', manualRatio: { glucose: 0, fructose: 0 } } });
    expect(summary('Carbohydrate')).toBe('75 g/h · 0 g in the recipe · glucose:fructose 0:0');
  });

  it('prints the ratio the recipe delivers, not the target', () => {
    // Maltodextrin alone cannot make the manual 1:1, so the recipe is 1:0.
    renderPrint({
      carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 1 }, ingredients: [{ ref: 3, weight: 100 }] },
    });
    expect(summary('Carbohydrate')).toBe('75 g/h · 225 g in the recipe · glucose:fructose 1:0');
  });
});

describe('PrintRecipe: recipe sections', () => {
  it('prints the gel batch in total and per gel, with its consistency and osmolality', () => {
    renderPrint();
    const recipe = region('Recipe');
    const gel = within(recipe).getByRole('region', { name: 'Gel batch: 9 gels' });
    const table = within(gel).getByRole('table', { name: 'Gel batch ingredients' });
    expect(rowsOf(table)).toEqual([
      ['Ingredient', 'Whole batch', 'Per gel'],
      ['Maltodextrin', '158 g', '18 g'],
      ['Crystalline Fructose', '75 g', '8.3 g'],
      ['Sodium Chloride (Table Salt)', '2.3 g', '0.25 g'],
      ['Warm water', '140 ml', '16 ml'],
    ]);
    expect(gel).toHaveTextContent('Consistency: Standard, 60% carbohydrate.');
    expect(gel).toHaveTextContent('Each gel: about 42 g (32 ml) with 25 g carbohydrate.');
    expect(gel).toHaveTextContent('Osmolality: ≈ 4,300 mOsm/kg, likely higher (hypertonic).');
  });

  it('prints every line of every section, as the recipe holds it', () => {
    const inputs = { ...PRESET_SWEAT, format: { type: 'both' }, caffeine: { enabled: true, asIngredient: true } };
    renderPrint(inputs);
    const plan = computePlan(inputs);
    const tables = within(region('Recipe')).getAllByRole('table');
    expect(tables).toHaveLength(plan.recipe.sections.length);
    plan.recipe.sections.forEach((section, i) => {
      const rows = rowsOf(tables[i]).slice(1);
      expect(rows).toHaveLength(section.items.length);
      section.items.forEach((item, j) => {
        const label = typeof item.label === 'string' ? item.label : t(item.label);
        expect(rows[j]).toEqual([label, item.display, item.perServingDisplay]);
      });
    });
    // Raw message keys never reach the page.
    expect(printView()).not.toHaveTextContent('recipe.');
    expect(printView()).not.toHaveTextContent('ui-print.');
  });

  it('prints the drink per bottle, with its strength, sodium and osmolality', () => {
    renderPrint({ ...PRESET_SWEAT, format: { type: 'drink' } });
    const drink = within(region('Recipe')).getByRole('region', {
      name: 'Drink: 4 bottles, 600 ml each (750 ml bottle)',
    });
    const rows = rowsOf(within(drink).getByRole('table', { name: 'Drink ingredients' }));
    expect(rows[0]).toEqual(['Ingredient', 'All bottles', 'Per bottle']);
    expect(rows[1]).toEqual(['Maltodextrin', '158 g', '39 g']);
    expect(rows.at(-1)[0]).toBe('Water, to fill each bottle to 600 ml');
    // 225 g in 4 bottles = 56.25 g per 600 ml bottle = 9.4% w/v; 1,710 mg sodium / 4 = 427 mg (712 mg/L).
    expect(drink).toHaveTextContent('Each bottle: 56 g carbohydrate (9.4% w/v) and 427 mg sodium (712 mg/L).');
    expect(drink).toHaveTextContent('Osmolality: ≈ 312 mOsm/kg (isotonic).');
  });

  it('prints a drink without fluid with the whole amounts only', () => {
    renderPrint({ format: { type: 'drink' }, fluid: { mode: 'manual', manualMlPerHour: 0 } });
    const drink = within(region('Recipe')).getByRole('region', {
      name: 'Drink: no bottles, because no fluid is planned',
    });
    const rows = rowsOf(within(drink).getByRole('table'));
    expect(rows[0]).toEqual(['Ingredient', 'Whole activity']);
    expect(drink).not.toHaveTextContent('Osmolality');
  });

  it('prints water in fl oz and the bottle size in imperial units', () => {
    renderPrint({ ...PRESET_SWEAT, format: { type: 'drink' } }, { prefs: { unitSystem: 'imperial', mode: 'expert' } });
    const drink = within(region('Recipe')).getByRole('region', {
      name: 'Drink: 4 bottles, 20 fl oz each (25 fl oz bottle)',
    });
    const rows = rowsOf(within(drink).getByRole('table'));
    expect(rows.at(-1)[0]).toBe('Water, to fill each bottle to 20 fl oz');
    expect(rows.at(-1)[1]).toMatch(/fl oz$/);
    // Nutrients stay in grams.
    expect(rows[1]).toEqual(['Maltodextrin', '158 g', '39 g']);
  });

  it('prints German decimals in the amounts', () => {
    renderPrint({}, { prefs: { locale: 'de', unitSystem: 'metric', mode: 'expert' } });
    const table = within(region('Rezept')).getAllByRole('table')[0];
    expect(rowsOf(table)[2].slice(1)).toEqual(['75 g', '8,3 g']);
    expect(rowsOf(table)[3].slice(1)).toEqual(['2,3 g', '0,25 g']);
    expect(region('Rezept')).toHaveTextContent('≈ 4.300 mOsm/kg');
  });
});

describe('PrintRecipe: mixing steps', () => {
  /** Each step's text, or `[text, lines]` when it lists recipe lines. */
  const steps = (name) =>
    Array.from(within(region('Mixing')).getByRole('list', { name }).children, (li) => {
      const nested = li.querySelector('ul');
      const text = Array.from(li.childNodes, (node) => (node === nested ? '' : node.textContent)).join('');
      return nested ? [text, Array.from(nested.children, (item) => item.textContent)] : text;
    });

  it('makes the gel batch: weigh, dissolve in warm water, divide into flasks', () => {
    renderPrint();
    expect(steps('Gel batch steps')).toEqual([
      [
        'Weigh the Ingredients. Weigh these for the whole batch of 9 gels:',
        ['158 g Maltodextrin', '75 g Crystalline Fructose', '2.3 g Sodium Chloride (Table Salt)'],
      ],
      'Dissolve. Warm 140 ml of water. Stir in the powders and syrups until they dissolve and the gel is smooth.',
      'Fill the Flasks. Divide the batch into 9 flasks of about 32 ml (42 g) each. Keep them closed and cool until the start.',
    ]);
    const list = within(region('Mixing')).getByRole('list', { name: 'Gel ingredients' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
  });

  it('adds the caffeine tablets to their gel, never as powder', () => {
    renderPrint({ caffeine: { enabled: true, asIngredient: true } });
    const [text, lines] = steps('Gel batch steps').at(-1);
    expect(text).toMatch(/^Add Caffeine Tablets\. Crush each tablet into a fine powder and stir it into its gel/);
    expect(text).toContain('Never use pure caffeine powder.');
    expect(lines).toEqual(['Caffeine for gel 7 (100 mg tablets): 0.5 tablets']);
  });

  it('mixes each bottle: powders, water to the mark, shake', () => {
    renderPrint({ ...PRESET_SWEAT, format: { type: 'drink' } });
    const [add, shake] = steps('Drink steps');
    expect(add).toEqual([
      'Add the Powders. Make 4 bottles. Put this in each bottle:',
      ['39 g Maltodextrin', '19 g Crystalline Fructose', '1.1 g Sodium Chloride (Table Salt)'],
    ]);
    expect(shake).toMatch(/^Fill and Shake\. Add about \d+ ml of water, up to the 600 ml mark\. Your 750 ml bottle will not be full/);
    expect(shake).toMatch(/Shake until nothing is left at the bottom\.$/);
  });

  it('gives each section its own steps for "both"', () => {
    renderPrint({ ...PRESET_SWEAT, format: { type: 'both' } });
    const mixing = region('Mixing');
    expect(within(mixing).getByRole('heading', { name: 'Gel batch' })).toBeInTheDocument();
    expect(within(mixing).getByRole('heading', { name: 'Drink' })).toBeInTheDocument();
    expect(steps('Gel batch steps')[0][1]).toEqual(['79 g Maltodextrin', '38 g Crystalline Fructose']);
    expect(steps('Drink steps')[0][1]).toEqual([
      '20 g Maltodextrin',
      '9.4 g Crystalline Fructose',
      '1.1 g Sodium Chloride (Table Salt)',
    ]);
  });

  it('mixes the salts of a plan without carbs into a drink, and says when there is no drink', () => {
    const { unmount } = renderPrint({ event: { durationMin: 30 } });
    expect(within(region('Mixing')).queryByRole('list', { name: 'Gel batch steps' })).not.toBeInTheDocument();
    expect(steps('Drink steps')[0]).toEqual([
      'Add the Powders. Make 1 bottle. Put this in each bottle:',
      ['89 mg Sodium Chloride (Table Salt)'],
    ]);
    unmount();
    renderPrint({ format: { type: 'drink' }, fluid: { mode: 'manual', manualMlPerHour: 0 } });
    expect(within(region('Mixing')).queryByRole('list', { name: 'Drink steps' })).not.toBeInTheDocument();
    expect(region('Mixing')).toHaveTextContent('Your plan has no fluid, so there is no drink to mix.');
  });

  it('adds no water when the recipe lists none, as the mixing dialog does', () => {
    // A thick gel from a syrup with 70.1 % carbs needs 0.23 ml of water: the recipe lists no water line.
    const inputs = {
      format: { type: 'both', gelConsistency: 'thick' },
      carbs: { custom: [{ key: 'c1', name: 'Syrup X', carbsPer100g: 70.1, fructoseSharePct: 33 }], ingredients: [{ ref: 'c1', weight: 100 }] },
    };
    const plan = computePlan(inputs);
    const gel = plan.recipe.sections.find((s) => s.kind === 'gel');
    expect(gel.water.totalMl).toBeGreaterThan(0);
    expect(gel.water.totalMl).toBeLessThan(0.5);
    expect(gel.items.some((item) => item.kind === 'water')).toBe(false);
    renderPrint(inputs);
    expect(steps('Gel batch steps')[1]).toBe(
      'Dissolve. Add no water: your syrups bring enough. Stir the powders into the syrups until they dissolve and the gel is smooth.',
    );
  });

  it('writes volumes in fl oz in imperial units', () => {
    renderPrint({}, { prefs: { unitSystem: 'imperial', mode: 'expert' } });
    const [, dissolve, fill] = steps('Gel batch steps');
    // 140 ml of water = 4.7 fl oz; each gel 32 ml = 1.1 fl oz (42 g).
    expect(dissolve).toBe('Dissolve. Warm 4.7 fl oz of water. Stir in the powders and syrups until they dissolve and the gel is smooth.');
    expect(fill).toContain('9 flasks of about 1.1 fl oz (42 g) each');
  });

  it('adds the mouth rinse protocol for 45–75 min events', () => {
    renderPrint({ event: { durationMin: 60 } });
    const plan = computePlan({ event: { durationMin: 60 } });
    expect(screen.getByTestId('print-mouth-rinse')).toHaveTextContent(t(plan.carbs.mouthRinseHowTo.summary));
    expect(screen.getByTestId('print-mouth-rinse')).toHaveTextContent(/^Mouth rinse option\./);
  });
});

describe('PrintRecipe: schedule, warnings and sources', () => {
  it('prints every schedule event as a table row', () => {
    const inputs = { ...PRESET_SWEAT, format: { type: 'drink' }, caffeine: { enabled: true } };
    renderPrint(inputs);
    const plan = computePlan(inputs);
    const table = within(region('Schedule')).getByRole('table', { name: 'Race-day schedule' });
    const rows = rowsOf(table);
    expect(rows[0]).toEqual(['Time', 'Action', 'Details']);
    expect(rows.slice(1)).toEqual(
      plan.schedule.map((event) => [formatElapsed(event.timeMin), t(`schedule.title.${event.type}`), t(event.message)]),
    );
    expect(rows[3]).toEqual(['T+0m', 'Drink', 'Drink about 260 ml from bottle 1.']);
    // The time is the header of its row, so each detail is announced with its time.
    const headers = within(table).getAllByRole('rowheader');
    expect(headers.map((th) => th.textContent)).toEqual(plan.schedule.map((event) => formatElapsed(event.timeMin)));
    headers.forEach((th) => expect(th).toHaveAttribute('scope', 'row'));
  });

  it('prints every warning with its level written out and its sources', () => {
    renderPrint();
    const plan = computePlan({});
    const items = within(region('Warnings and notes')).getAllByRole('listitem');
    expect(items).toHaveLength(plan.warnings.length);
    plan.warnings.forEach((warning, i) => {
      const level = { danger: 'Danger', warning: 'Warning', info: 'Note' }[warning.level];
      expect(items[i]).toHaveAttribute('data-level', warning.level);
      expect(items[i].textContent.startsWith(`${level}: ${t(warning.message)}`)).toBe(true);
      for (const id of warning.citations ?? []) expect(items[i]).toHaveTextContent(citationLabel(id));
    });
    expect(items.map((li) => li.dataset.level)).toEqual(['warning', 'info']);
  });

  it('prints a danger first, with its level as a word', () => {
    renderPrint({ ...PRESET_SWEAT, fluid: { mode: 'manual', manualMlPerHour: 1500 } });
    const [first] = within(region('Warnings and notes')).getAllByRole('listitem');
    expect(first).toHaveAttribute('data-level', 'danger');
    expect(first.textContent).toMatch(/^Danger: /);
  });

  it('says when there are no warnings', () => {
    renderPrint({ ...PRESET_SWEAT, format: { type: 'drink' }, carbs: { mode: 'manual', manualGPerHour: 40 } });
    expect(region('Warnings and notes')).toHaveTextContent('None for this plan.');
  });

  it('lists the full reference of every study the plan cites', () => {
    renderPrint();
    const plan = computePlan({});
    const items = within(region('Sources')).getAllByRole('listitem');
    const ids = planCitations(plan);
    expect(items.map((li) => li.dataset.citation)).toEqual(ids);
    items.forEach((li, i) => expect(li).toHaveTextContent(referenceText(t, ids[i])));
    // The heat-balance estimate (Gagnon 2013) comes first; every reference has its DOI link.
    expect(ids[0]).toBe('gagnon2013');
    for (const li of items) expect(li.textContent).toMatch(/https:\/\/doi\.org\/10\./);
    // Years are never grouped like numbers ("2,013").
    expect(items[0]).toHaveTextContent('(2013).');
  });
});
