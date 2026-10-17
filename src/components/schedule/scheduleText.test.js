import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { bottleNote, bottlesText, elapsedText, fluidAdvice, scheduleRows, spokenElapsedText } from './scheduleText';
import { computePlan } from '../../domain/plan';
import { formatElapsed } from '../../domain/schedule';
import { createT, t } from '../../i18n';
import { createFormat } from '../../i18n/formatters';

const en = createFormat('en');
const de = createFormat('de');
const tDe = createT('de');
const imperialT = createT('en', { unitSystem: 'imperial' });
const imperial = createFormat('en', { unitSystem: 'imperial' });

/** A drink section with `servings` bottles filled to `fill` ml. */
const drink = (servings, fill) => ({ kind: 'drink', servings, perServing: { volumeMl: fill } });

describe('elapsedText', () => {
  it('reads like formatElapsed in English', () => {
    for (const minutes of [0, 20, 59.6, 60, 80, -60, -90, -0.4, 135, 2880]) {
      expect(elapsedText(t, en, minutes), String(minutes)).toBe(formatElapsed(minutes));
    }
    fc.assert(
      fc.property(fc.integer({ min: -300, max: 3000 }), (minutes) => elapsedText(t, en, minutes) === formatElapsed(minutes)),
    );
  });

  it('uses a real minus sign before the start and counts bad values as 0', () => {
    expect(elapsedText(t, en, -90)).toBe('T−1h 30m');
    expect(elapsedText(t, en, NaN)).toBe('T+0m');
    expect(elapsedText(t, en, undefined)).toBe('T+0m');
  });

  it('uses the locale numbers', () => {
    expect(elapsedText(tDe, de, 2880)).toBe('T+48h');
    expect(elapsedText(tDe, de, -75)).toBe('T−1h 15m');
  });
});

describe('spokenElapsedText', () => {
  it('says the time in words for screen readers', () => {
    expect(spokenElapsedText(t, en, 0)).toBe('At the start');
    expect(spokenElapsedText(t, en, 0.3)).toBe('At the start');
    expect(spokenElapsedText(t, en, 20)).toBe('20 minutes after the start');
    expect(spokenElapsedText(t, en, 180)).toBe('3 hours after the start');
    expect(spokenElapsedText(t, en, -90)).toBe('1 hour 30 minutes before the start');
  });

  it('writes the units out with their plural, never abbreviated', () => {
    expect(spokenElapsedText(t, en, 1)).toBe('1 minute after the start');
    expect(spokenElapsedText(t, en, 59.6)).toBe('1 hour after the start');
    expect(spokenElapsedText(t, en, -60)).toBe('1 hour before the start');
    expect(spokenElapsedText(t, en, 61)).toBe('1 hour 1 minute after the start');
    expect(spokenElapsedText(t, en, 135)).toBe('2 hours 15 minutes after the start');
    expect(spokenElapsedText(t, en, 2880)).toBe('48 hours after the start');
    expect(spokenElapsedText(t, en, NaN)).toBe('At the start');
    fc.assert(
      fc.property(fc.integer({ min: -300, max: 3000 }), (minutes) => !/\b(h|min)\b/.test(spokenElapsedText(t, en, minutes))),
    );
  });

  it('builds the words from the catalog, in the locale numbers', () => {
    const spokenDe = (key, params) =>
      ({
        'ui-schedule.spoken.hours.one': `${params?.count} Stunde`,
        'ui-schedule.spoken.hours.other': `${params?.count} Stunden`,
        'ui-schedule.spoken.minutes.one': `${params?.count} Minute`,
        'ui-schedule.spoken.minutes.other': `${params?.count} Minuten`,
        'ui-schedule.spoken.hoursMinutes': `${params?.hours} und ${params?.minutes}`,
        'ui-schedule.time.before': `${params?.duration} vor dem Start`,
        'ui-schedule.time.after': `${params?.duration} nach dem Start`,
      })[key] ?? tDe(key, params);
    expect(spokenElapsedText(spokenDe, de, -90)).toBe('1 Stunde und 30 Minuten vor dem Start');
    expect(spokenElapsedText(spokenDe, de, 120)).toBe('2 Stunden nach dem Start');
    expect(spokenElapsedText(spokenDe, de, 1)).toBe('1 Minute nach dem Start');
  });
});

describe('scheduleRows', () => {
  it('turns each event into a row with a unique key', () => {
    const plan = computePlan({ event: { durationMin: 60 }, caffeine: { enabled: true }, bicarb: { enabled: true } });
    const rows = scheduleRows(t, en, plan.schedule);
    expect(rows).toHaveLength(plan.schedule.length);
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    expect(rows[0]).toMatchObject({
      type: 'bicarb',
      timeMin: -90,
      time: 'T−1h 30m',
      spokenTime: '1 hour 30 minutes before the start',
      title: 'Bicarbonate',
      spokenTitle: '1 hour 30 minutes before the start: Bicarbonate',
      text: 'Take 21 g sodium bicarbonate. It adds 5.7 g sodium.',
    });
  });

  it('accepts a missing schedule and skips bad entries', () => {
    expect(scheduleRows(t, en, undefined)).toEqual([]);
    expect(scheduleRows(t, en, [null, { type: 'finish', timeMin: 60, message: { key: 'schedule.finish' } }])).toHaveLength(1);
  });
});

describe('bottlesText', () => {
  it('names full and partly filled bottles', () => {
    expect(bottlesText(t, en, drink(3, 800), 800)).toBe('3 bottles of 800 ml');
    expect(bottlesText(t, en, drink(1, 750), 750)).toBe('1 bottle of 750 ml');
    expect(bottlesText(t, en, drink(4, 600), 750)).toBe('4 bottles, 600 ml each (750 ml bottle)');
    // One partly filled bottle reads as in the mixing dialog (the Phase 2 wording).
    expect(bottlesText(t, en, drink(1, 600), 750)).toBe('1 bottle, 600 ml each (750 ml bottle)');
    // A fill that rounds to the bottle size counts as full; a missing fill is a full bottle.
    expect(bottlesText(t, en, drink(2, 749.6), 750)).toBe('2 bottles of 750 ml');
    expect(bottlesText(t, en, { kind: 'drink', servings: 2 }, 500)).toBe('2 bottles of 500 ml');
  });

  it('is null without bottles', () => {
    expect(bottlesText(t, en, drink(0, 0), 750)).toBeNull();
    expect(bottlesText(t, en, null, 750)).toBeNull();
  });

  it('follows the unit system and the locale', () => {
    expect(bottlesText(imperialT, imperial, drink(4, 600), 750)).toBe('4 bottles, 20 fl oz each (25 fl oz bottle)');
    // 740 ml and 750 ml both read 25 fl oz: the bottles are full as far as the text can say.
    expect(bottlesText(imperialT, imperial, drink(3, 740), 750)).toBe('3 bottles of 25 fl oz');
    expect(bottlesText(imperialT, imperial, drink(1, 740), 750)).toBe('1 bottle of 25 fl oz');
    // In ml they differ, so the bottle size is named.
    expect(bottlesText(t, en, drink(3, 740), 750)).toBe('3 bottles, 740 ml each (750 ml bottle)');
    expect(bottlesText(tDe, de, drink(2, 1250), 1500)).toContain('1.250 ml');
  });
});

describe('bottleNote and fluidAdvice', () => {
  it('names the bottles only when drink sips carry the fluid', () => {
    expect(bottleNote(t, en, computePlan({}))).toBeNull();
    expect(bottleNote(t, en, computePlan({ sweat: { source: 'preset' }, format: { type: 'drink' } }))).toBe(
      'Drink from 4 bottles, 600 ml each (750 ml bottle), one after the other. Each sip lists the bottle it comes from.',
    );
    expect(bottleNote(t, en, computePlan({ format: { type: 'drink' }, fluid: { mode: 'manual', manualMlPerHour: 0 } }))).toBeNull();
  });

  it('explains the recommendation, or the manual target, and is null without fluid', () => {
    const auto = computePlan({ sweat: { source: 'preset' } });
    expect(fluidAdvice(t, auto)).toEqual({
      summary: t(auto.fluid.recommended.why.summary),
      details: (auto.fluid.recommended.why.details ?? []).map((detail) => t(detail)),
      citations: auto.fluid.recommended.why.citations,
    });
    const manual = computePlan({ sweat: { source: 'preset' }, fluid: { mode: 'manual', manualMlPerHour: 650 } });
    expect(fluidAdvice(t, manual).summary).toBe('You set your own fluid target of 650 ml/h. The recommendation is 800 ml/h.');
    const decimals = computePlan({ sweat: { source: 'preset' }, fluid: { mode: 'manual', manualMlPerHour: 512.37 } });
    expect(fluidAdvice(t, decimals).summary).toBe('You set your own fluid target of 512 ml/h. The recommendation is 800 ml/h.');
    expect(fluidAdvice(t, computePlan({ fluid: { mode: 'manual', manualMlPerHour: 0 } }))).toBeNull();
  });
});
