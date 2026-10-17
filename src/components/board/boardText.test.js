import { describe, it, expect } from 'vitest';
import {
  amountsCaption,
  durationText,
  eventSummary,
  sectionTitle,
  servingsText,
  sweatSourceKey,
  warningsAnnouncement,
  warningsSummary,
} from './boardText';
import { computePlan } from '../../domain/plan';
import { createT, MESSAGES, placeholdersOf } from '../../i18n';
import { countText } from '../../i18n/plural';
import { createFormat } from '../../i18n/formatters';
import uiBoard from '../../i18n/en/ui-board';

const en = { t: createT('en'), f: createFormat('en') };
const de = { t: createT('de'), f: createFormat('de') };
const us = { t: createT('en', { unitSystem: 'imperial', currency: 'USD' }), f: createFormat('en', { unitSystem: 'imperial', currency: 'USD' }) };

describe('ui-board catalog', () => {
  it('namespaces every key and is registered with the other catalogs', () => {
    for (const [key, text] of Object.entries(uiBoard)) {
      expect(key.startsWith('ui-board.'), key).toBe(true);
      expect(MESSAGES[key], key).toBe(text);
    }
  });

  it('types every fluid volume and percentage', () => {
    for (const [key, text] of Object.entries(uiBoard)) {
      expect(text, key).not.toMatch(/\{\w+\} ?(ml|L\b|kg|%|°|km\/h|cm|fl oz)/);
    }
    expect(placeholdersOf(uiBoard['ui-board.chip.sweat'])).toEqual(['rateL:volumeL', 'uncertaintyL:volumeL:nounit']);
  });

  it('keeps no copy of the schedule time texts (Next up uses the schedule\'s own)', () => {
    expect(Object.keys(uiBoard).filter((key) => key.startsWith('ui-board.next.time.'))).toEqual([]);
  });
});

describe('plan summaries', () => {
  it('writes the event summary with h:mm', () => {
    expect(durationText(en.t, en.f, 330)).toBe('5:30 h');
    expect(durationText(de.t, de.f, 45)).toBe('0:45 h');
    expect(eventSummary(de.t, de.f, { durationMin: 330, sport: 'other', intensity: 'race' })).toBe('5:30 h · Andere Sportart · Wettkampf');
    expect(eventSummary(en.t, en.f, { durationMin: 180, sport: 'cycling', intensity: 'moderate' })).toBe('3:00 h · Cycling · Moderate');
    expect(eventSummary(en.t, en.f, { durationMin: 95, sport: 'running', intensity: 'race' })).toBe('1:35 h · Running · Race');
    expect(eventSummary(en.t, en.f, { durationMin: 30.4, sport: 'other', intensity: 'easy' })).toBe('0:30 h · Other sport · Easy');
  });

  it('names the sweat source the plan used', () => {
    const TEST = { id: 't1', date: '2026-09-01', label: 'Long ride', preKg: 70, postKg: 69, fluidL: 0.5, urineL: 0, durationMin: 60 };
    expect(sweatSourceKey(computePlan({}), 'estimate')).toBe('ui-board.chip.sweatSource.estimate');
    expect(sweatSourceKey(computePlan({ sweat: { source: 'preset' } }), 'preset')).toBe('ui-board.chip.sweatSource.preset');
    expect(sweatSourceKey(computePlan({ sweat: { source: 'test' } }), 'test')).toBe('ui-board.chip.sweatSource.estimateNoTest');
    expect(sweatSourceKey(computePlan({ sweat: { source: 'test', tests: [TEST] } }), 'test')).toBe(
      'ui-board.chip.sweatSource.testScaled',
    );
    expect(sweatSourceKey(computePlan({ sweat: { source: 'test', tests: [TEST], calibrate: false } }), 'test')).toBe(
      'ui-board.chip.sweatSource.test',
    );
  });

  it('counts warnings and dangers and finds the worst level', () => {
    expect(warningsSummary([])).toEqual({ count: 0, worst: null, dangers: 0 });
    expect(warningsSummary(null)).toEqual({ count: 0, worst: null, dangers: 0 });
    expect(warningsSummary([{ level: 'info' }, { level: 'warning' }])).toEqual({ count: 2, worst: 'warning', dangers: 0 });
    expect(warningsSummary([{ level: 'info' }, { level: 'danger' }, null])).toEqual({ count: 2, worst: 'danger', dangers: 1 });
    expect(warningsSummary([{ level: 'danger' }, { level: 'danger' }])).toEqual({ count: 2, worst: 'danger', dangers: 2 });
    expect(warningsSummary([{ level: 'odd' }])).toEqual({ count: 1, worst: 'info', dangers: 0 });
  });

  it('writes the short warnings announcement', () => {
    expect(warningsAnnouncement(en.t, en.f, { count: 0, dangers: 0 })).toBe('No warnings');
    expect(warningsAnnouncement(en.t, en.f, { count: 1, dangers: 0 })).toBe('1 warning');
    expect(warningsAnnouncement(en.t, en.f, { count: 4, dangers: 1 })).toBe('4 warnings, 1 danger');
    expect(warningsAnnouncement(en.t, en.f, { count: 4, dangers: 2 })).toBe('4 warnings, 2 dangers');
    expect(warningsAnnouncement(de.t, de.f, { count: 1200, dangers: 0 })).toBe('1.200 Warnungen');
  });

  it('counts with one and other', () => {
    expect(countText(en.t, en.f, 'ui-board.chip.warnings', 1)).toBe('1 warning');
    expect(countText(en.t, en.f, 'ui-board.chip.warnings', 1200)).toBe('1,200 warnings');
    expect(countText(de.t, de.f, 'ui-board.chip.warnings', 1200)).toBe('1.200 Warnungen');
  });
});

describe('recipe section text', () => {
  const gelPlan = computePlan({});
  const drinkPlan = computePlan({ sweat: { source: 'preset' }, format: { type: 'drink' } });
  const gel = gelPlan.recipe.sections[0];
  const drink = drinkPlan.recipe.sections[0];

  it('titles a section with its count', () => {
    expect(sectionTitle(en.t, en.f, gel)).toBe('Gels ×9');
    expect(sectionTitle(en.t, en.f, drink)).toBe('Bottles ×4');
    expect(sectionTitle(en.t, en.f, { kind: 'gel', servings: 0 })).toBe('Gels');
    expect(sectionTitle(en.t, en.f, { kind: 'drink', servings: 0 })).toBe('Drink');
  });

  it('says what the bottles hold, or why there are none', () => {
    expect(servingsText(en.t, en.f, gel, 750)).toBeNull();
    expect(servingsText(en.t, en.f, { kind: 'gel', servings: 0 }, 750)).toBe('No gels planned');
    // 2,400 ml in four 750 ml bottles: each filled to 600 ml.
    expect(servingsText(en.t, en.f, drink, 750)).toBe('600 ml each (750 ml bottle)');
    expect(servingsText(us.t, us.f, drink, 750)).toBe('20 fl oz each (25 fl oz bottle)');
    expect(servingsText(en.t, en.f, { kind: 'drink', servings: 2, perServing: { volumeMl: 750 } }, 750)).toBe('750 ml each');
    expect(servingsText(en.t, en.f, { kind: 'drink', servings: 0 }, 750)).toBe('No bottles: no fluid planned');
  });

  it.each([730, 740, 745, 749])('names the bottle size only when it reads differently (%s ml of 750 ml)', (ml) => {
    const partial = { kind: 'drink', servings: 3, perServing: { volumeMl: ml } };
    expect(servingsText(en.t, en.f, partial, 750)).toBe(`${ml} ml each (750 ml bottle)`);
    // 730–749 ml and 750 ml are all 25 fl oz.
    expect(servingsText(us.t, us.f, partial, 750)).toBe('25 fl oz each');
  });

  it('keeps the bottle size in fl oz when the fill reads lower', () => {
    // 700 ml = 23.7 fl oz → 24 fl oz; 750 ml = 25 fl oz.
    expect(servingsText(us.t, us.f, { kind: 'drink', servings: 3, perServing: { volumeMl: 700 } }, 750)).toBe(
      '24 fl oz each (25 fl oz bottle)',
    );
  });

  it('captions the amounts of a view', () => {
    expect(amountsCaption(en.t, gel, 'total')).toBe('Whole batch');
    expect(amountsCaption(en.t, gel, 'perServing')).toBe('Per gel');
    expect(amountsCaption(en.t, drink, 'total')).toBe('All bottles');
    expect(amountsCaption(en.t, drink, 'perServing')).toBe('Per bottle');
    expect(amountsCaption(en.t, { kind: 'drink', servings: 0 }, 'perServing')).toBe('Whole activity');
  });
});
