import { describe, it, expect } from 'vitest';
import {
  amountsCaption,
  bodyMassText,
  osmolalityText,
  planCitations,
  printMixingSteps,
  referenceText,
  sectionFacts,
  servingsText,
  summaryRows,
} from './printText';
import { computePlan } from '../../domain/plan';
import { createT, t } from '../../i18n';
import { createFormat } from '../../i18n/formatters';

const en = createFormat('en');
const de = createFormat('de');
const tDe = createT('de');
const imperial = createFormat('en', { unitSystem: 'imperial' });
const tImperial = createT('en', { unitSystem: 'imperial' });

/** The sections of a plan by kind. */
const sectionOf = (plan, kind) => plan.recipe.sections.find((section) => section.kind === kind);

describe('sections', () => {
  it('names the servings, worded to follow the section name', () => {
    const plan = computePlan({ sweat: { source: 'preset' }, format: { type: 'both' } });
    expect(servingsText(t, en, sectionOf(plan, 'gel'), 750)).toBe('9 gels');
    expect(servingsText(t, en, sectionOf(plan, 'drink'), 750)).toBe('4 bottles, 600 ml each (750 ml bottle)');
    expect(servingsText(t, en, { kind: 'gel', servings: 1 }, 750)).toBe('1 gel');
    expect(servingsText(t, en, { kind: 'gel', servings: 0 }, 750)).toBe('no gels planned');
    expect(servingsText(t, en, { kind: 'drink', servings: 0 }, 750)).toBe('no bottles, because no fluid is planned');
  });

  it('heads the amount column for the section', () => {
    expect(amountsCaption(t, { kind: 'gel', servings: 9 })).toBe('Whole batch');
    expect(amountsCaption(t, { kind: 'drink', servings: 4 })).toBe('All bottles');
    expect(amountsCaption(t, { kind: 'drink', servings: 0 })).toBe('Whole activity');
  });

  it('lists no facts for a section without servings', () => {
    const plan = computePlan({ format: { type: 'drink' }, fluid: { mode: 'manual', manualMlPerHour: 0 } });
    expect(sectionFacts(t, en, plan, sectionOf(plan, 'drink'))).toEqual([]);
  });
});

describe('osmolalityText', () => {
  it('rounds osmolality like the board', () => {
    expect(osmolalityText(t, en, null, 'gel')).toBeNull();
    expect(osmolalityText(t, en, { mOsmPerKg: 0, tonicity: 'hypotonic' }, 'drink')).toBeNull();
    expect(osmolalityText(t, en, { mOsmPerKg: Infinity, tonicity: 'hypertonic' }, 'gel')).toBeNull();
    expect(osmolalityText(t, en, { mOsmPerKg: 312.2, tonicity: 'isotonic' }, 'drink')).toBe('≈ 312 mOsm/kg (isotonic)');
    expect(osmolalityText(t, en, { mOsmPerKg: 1559, tonicity: 'hypertonic' }, 'drink')).toBe('≈ 1,600 mOsm/kg (hypertonic)');
    expect(osmolalityText(t, en, { mOsmPerKg: 4326.5, tonicity: 'hypertonic' }, 'gel')).toBe(
      '≈ 4,300 mOsm/kg, likely higher (hypertonic)',
    );
    expect(osmolalityText(t, en, { mOsmPerKg: 600 }, 'gel')).toBe('≈ 600 mOsm/kg');
    expect(osmolalityText(tDe, de, { mOsmPerKg: 1559 }, 'drink')).toBe('≈ 1.600 mOsm/kg');
  });
});

describe('citations', () => {
  it('collects citations once each, in order of first use', () => {
    const plan = computePlan({ caffeine: { enabled: true } });
    const ids = planCitations(plan);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(plan.caffeine.why.citations));
    expect(planCitations(computePlan({}))).not.toContain('guest2021');
  });

  it('adds the extras and bicarbonate explanations only when they are on', () => {
    const off = planCitations(computePlan({}));
    const on = planCitations(computePlan({ extras: { potassium: true }, bicarb: { enabled: true } }));
    const bicarb = computePlan({ bicarb: { enabled: true } }).bicarb.why.citations;
    expect(on).toEqual(expect.arrayContaining(bicarb));
    expect(bicarb.some((id) => !off.includes(id))).toBe(true);
  });

  it('prints a reference in full, and an unknown citation by its label', () => {
    expect(referenceText(t, 'nobody1999')).toBe('nobody1999');
    expect(referenceText(t, 'sawka2007')).toMatch(/^Sawka MN.* \(2007\)\. .*https:\/\/doi\.org\//);
    expect(referenceText(tDe, 'sawka2007')).toContain('(2007).');
  });
});

describe('bodyMassText', () => {
  it('signs the scale change after rounding and names the level', () => {
    expect(bodyMassText(t, en, { level: 'ok', scaleChangeKg: -0.558, waterDeficitL: 0.15, deficitPct: 0.21 })).toBe(
      'About −0.6 kg on the scale after the activity · Water lost 0.15 L (0.2% of body mass) · Up to 2% loss',
    );
    expect(bodyMassText(t, en, { level: 'mild', scaleChangeKg: -1.9, waterDeficitL: 1.7, deficitPct: 2.4 })).toMatch(
      / · 2–3% loss$/,
    );
    expect(bodyMassText(t, en, { level: 'high', scaleChangeKg: -4.2, waterDeficitL: 3.75, deficitPct: 5.36 })).toMatch(
      /Water lost 3\.75 L \(5\.4% of body mass\) · Over 3% loss$/,
    );
    expect(bodyMassText(t, en, { level: 'gain', scaleChangeKg: 1.8, waterDeficitL: -2.25, deficitPct: -3.2 })).toBe(
      'About +1.8 kg on the scale after the activity · Water gained 2.25 L (3.2% of body mass) · Weight gain',
    );
    // A level the domain never returns counts as ok; missing numbers count as 0.
    expect(bodyMassText(t, en, { level: 'odd' })).toBe(
      'About 0 kg on the scale after the activity · Water lost 0 L (0% of body mass) · Up to 2% loss',
    );
  });

  it('follows the unit system and the locale', () => {
    expect(bodyMassText(tImperial, imperial, { level: 'ok', scaleChangeKg: -0.558, waterDeficitL: 0.15, deficitPct: 0.21 })).toBe(
      'About −1.2 lb on the scale after the activity · Water lost 5.1 fl oz (0.2% of body mass) · Up to 2% loss',
    );
    expect(bodyMassText(tDe, de, { level: 'ok', scaleChangeKg: -0.558, waterDeficitL: 0.15, deficitPct: 0.21 })).toContain(
      '−0,6 kg',
    );
  });
});

describe('summaryRows', () => {
  it('writes a temperature typed in °F the way the field shows it, in both unit systems', () => {
    // 87 °F is stored as 30.5556 °C: metric reads "30.6 °C" (not "30.556 °C"), imperial "87 °F".
    const plan = computePlan({ environment: { tempC: (87 - 32) / 1.8 } });
    const conditions = (tr, f) => summaryRows(tr, f, plan).find((row) => row.id === 'conditions').value;
    expect(conditions(t, en)).toMatch(/^Outdoors · 30\.6 °C · /);
    expect(conditions(tDe, de)).toMatch(/^Draußen · 30,6\s°C · /);
    expect(conditions(tImperial, imperial)).toMatch(/^Outdoors · 87 °F · /);
  });

  it('lists the rows in order, with caffeine and bicarbonate only when they are on', () => {
    expect(summaryRows(t, en, computePlan({})).map((row) => row.id)).toEqual([
      'activity', 'conditions', 'carbs', 'sodium', 'fluid', 'sweat', 'bodyMass', 'format', 'energy',
    ]);
    const rows = summaryRows(t, en, computePlan({ caffeine: { enabled: true }, bicarb: { enabled: true } }));
    expect(rows.map((row) => row.id)).toEqual([
      'activity', 'conditions', 'carbs', 'sodium', 'fluid', 'sweat', 'bodyMass', 'format', 'caffeine', 'bicarb', 'energy',
    ]);
    expect(rows.find((row) => row.id === 'bicarb')).toEqual({
      id: 'bicarb',
      term: 'Sodium bicarbonate',
      value: '21 g, 90 min before the start',
    });
  });
});

describe('printMixingSteps', () => {
  it('writes each recipe line as text, caffeine tablets after their name', () => {
    const [weigh] = printMixingSteps(t, en, sectionOf(computePlan({}), 'gel'), 750);
    expect(weigh.lines).toEqual(['158 g Maltodextrin', '75 g Crystalline Fructose', '2.3 g Sodium Chloride (Table Salt)']);
    const caffeine = printMixingSteps(t, en, sectionOf(computePlan({ caffeine: { enabled: true, asIngredient: true } }), 'gel'), 750).at(-1);
    expect(caffeine.key).toBe('caffeine');
    expect(caffeine.lines).toEqual(['Caffeine for gel 7 (100 mg tablets): 0.5 tablets']);
  });

  it('has no steps without servings', () => {
    expect(printMixingSteps(t, en, { kind: 'gel', servings: 0, items: [] }, 750)).toEqual([]);
    expect(printMixingSteps(t, en, null, 750)).toEqual([]);
  });

  it('fills one gel into one flask', () => {
    // Half a gel per hour for 1 h: one gel of about 19 ml (25 g).
    const plan = computePlan({ format: { gelsPerHour: 0.5 }, event: { durationMin: 60 } });
    const steps = printMixingSteps(t, en, sectionOf(plan, 'gel'), 750);
    expect(steps.map((step) => step.key)).toEqual(['weigh', 'dissolve', 'fill']);
    expect(steps[0].text).toBe('Weigh these for the whole batch of 1 gel:');
    expect(steps[2].text).toBe('Fill the batch into 1 flask of about 19 ml (25 g). Keep it closed and cool until the start.');
  });

  it('leaves out the flask size when the gel volume is unknown', () => {
    const section = { ...sectionOf(computePlan({}), 'gel'), perServing: {} };
    expect(printMixingSteps(t, en, section, 750)[2].text).toBe(
      'Divide the batch into 9 flasks. Keep them closed and cool until the start.',
    );
  });

  it('mixes one partly filled bottle, and plain water without ingredients', () => {
    // 0.25 L/h preset for 1 h in a 1500 ml bottle: one bottle filled to 200 ml.
    const plan = computePlan({ format: { type: 'drink', bottleMl: 1500 }, sweat: { source: 'preset', rateIndex: 0 }, event: { durationMin: 60 } });
    const drink = sectionOf(plan, 'drink');
    const [add, shake] = printMixingSteps(t, en, drink, 1500);
    expect(add.text).toBe('Make 1 bottle. Put this in each bottle:');
    expect(add.listLabel).toBe('Drink ingredients');
    expect(shake.text).toMatch(
      /^Add about \d+ ml of water, up to the 200 ml mark\. Your 1,500 ml bottle will not be full: that is all the fluid the plan needs from it\. Shake until nothing is left at the bottom\.$/,
    );
    const water = { ...drink, items: [], water: { totalMl: 600, perServingMl: 600 }, perServing: { volumeMl: 600 }, servings: 2 };
    expect(printMixingSteps(t, en, water, 600)).toEqual([
      {
        key: 'shake',
        title: 'Fill and Shake',
        text: 'Make 2 bottles of water. Add about 600 ml of water, up to the 600 ml mark. Shake until nothing is left at the bottom.',
        lines: [],
      },
    ]);
  });

  it('says a bottle is not full only when the mark and the bottle read differently', () => {
    // 740 ml/h for 3 h in 750 ml bottles: 3 bottles filled to 740 ml.
    const plan = computePlan({ format: { type: 'drink' }, fluid: { mode: 'manual', manualMlPerHour: 740 } });
    const drink = sectionOf(plan, 'drink');
    expect(drink.servings).toBe(3);
    expect(Math.round(drink.perServing.volumeMl)).toBe(740);
    // In ml: up to the 740 ml mark of a 750 ml bottle.
    const metricShake = printMixingSteps(t, en, drink, 750).at(-1);
    expect(metricShake.text).toMatch(/up to the 740 ml mark\. Your 750 ml bottle will not be full/);
    // In fl oz both read 25: no "25 fl oz mark. Your 25 fl oz bottle will not be full".
    const imperialShake = printMixingSteps(tImperial, imperial, drink, 750).at(-1);
    expect(imperialShake.text).toMatch(/up to the 25 fl oz mark\. Shake until nothing is left at the bottom\.$/);
    expect(imperialShake.text).not.toContain('will not be full');
    // The section's servings read the same way.
    expect(servingsText(tImperial, imperial, drink, 750)).toBe('3 bottles of 25 fl oz');
    expect(servingsText(t, en, drink, 750)).toBe('3 bottles, 740 ml each (750 ml bottle)');
  });

  it('writes the steps with German numbers', () => {
    const steps = printMixingSteps(tDe, de, sectionOf(computePlan({}), 'gel'), 750);
    expect(steps[0].lines).toContain('2,3 g Natriumchlorid (Kochsalz)');
  });
});
