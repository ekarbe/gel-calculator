import { describe, it, expect } from 'vitest';
import {
  SWEAT_SOURCES,
  currentConditions,
  describeConditions,
  freeTestId,
  newTestDraft,
  rateForText,
  sodiumMgPerL,
  testName,
  todayIso,
} from './SweatHelpers';
import { projectionLevel, projectionLevelLabel } from './SweatProjection';
import { createT, hasMessage, placeholdersOf, CATALOGS, PLACEHOLDER_TYPES } from '../../i18n/index';
import { DEFAULT_INPUTS, INPUT_OPTIONS, normalizeInputs } from '../../domain/plan';
import { SWEAT_RATE_PRESETS_LPH, SWEAT_SODIUM_PRESETS_MMOL } from '../../domain/sweat';

const t = createT('en', { unitSystem: 'metric' });
const imperial = createT('en', { unitSystem: 'imperial' });
const de = createT('de', { unitSystem: 'metric' });

const RIDE = {
  sport: 'cycling',
  speedKmh: 30,
  powerW: 0,
  mets: 8,
  setting: 'outdoor',
  tempC: 20,
  humidity: 50,
  sun: 'none',
};

describe('SweatHelpers', () => {
  it('describes exercise conditions per sport, in the unit system', () => {
    expect(describeConditions(t, RIDE)).toBe('Cycling at 30 km/h, outdoors, 20 °C, 50% humidity, shade or overcast');
    expect(describeConditions(t, RIDE, 158.4)).toBe(
      'Cycling at 30 km/h (about 158 W), outdoors, 20 °C, 50% humidity, shade or overcast',
    );
    // A measured power wins over the speed (and the derived power).
    expect(describeConditions(t, { ...RIDE, powerW: 210 }, 158)).toBe(
      'Cycling at 210 W, outdoors, 20 °C, 50% humidity, shade or overcast',
    );
    expect(describeConditions(t, { ...RIDE, sport: 'running', speedKmh: 12.04, sun: 'full' })).toBe(
      'Running at 12 km/h, outdoors, 20 °C, 50% humidity, full sun',
    );
    // Indoors the sun is not named (the model ignores it there).
    expect(describeConditions(t, { ...RIDE, sport: 'other', mets: 7.5, setting: 'indoorFan', sun: 'full' })).toBe(
      'Other sport at 7.5 METs, indoors with a fan, 20 °C, 50% humidity',
    );
    expect(describeConditions(t, { ...RIDE, setting: 'indoorNoFan', tempC: 22.55 })).toBe(
      'Cycling at 30 km/h, indoors without a fan, 22.6 °C, 50% humidity',
    );
    expect(describeConditions(imperial, { ...RIDE, sun: 'partly' })).toBe(
      'Cycling at 18.6 mph, outdoors, 68 °F, 50% humidity, partly sunny',
    );
    expect(describeConditions(de, { ...RIDE, speedKmh: 27.5, tempC: 18.5 })).toContain('27,5 km/h');
    expect(describeConditions(de, { ...RIDE, speedKmh: 27.5, tempC: 18.5 })).toMatch(
      /^Radfahren mit 27,5\skm\/h, draußen, 18,5\s°C, 50\u00a0% Luftfeuchtigkeit, Schatten oder bewölkt$/,
    );
  });

  it.each([80, 83, 85, 87, 89])('shows a temperature typed as %s °F unchanged (no rounding in °C first)', (fahrenheit) => {
    // The field stores the exact conversion; rounding it to 0.1 °C would read back as 84.9 or 87.1 °F.
    const tempC = (fahrenheit - 32) / 1.8;
    expect(describeConditions(imperial, { ...RIDE, tempC })).toContain(`, ${fahrenheit} °F,`);
    // A speed typed in mph reads back the same way.
    expect(describeConditions(imperial, { ...RIDE, tempC, speedKmh: 7.4 * 1.609344, sport: 'running' })).toMatch(/^Running at 7\.4 mph,/);
  });

  it('names a test by its label, else by its position', () => {
    expect(testName(t, { label: '  Hot ride ' }, 0)).toBe('Hot ride');
    expect(testName(t, { label: '' }, 2)).toBe('Sweat test 3');
    expect(testName(t, { label: '   ' }, 0)).toBe('Sweat test 1');
    expect(testName(t, {}, 0)).toBe('Sweat test 1');
  });

  it('finds the first free test id', () => {
    expect(freeTestId([])).toBe('t1');
    expect(freeTestId([{ id: 't1' }, { id: 't3' }])).toBe('t2');
    expect(freeTestId([{ id: 't2' }, { id: 't1' }])).toBe('t3');
  });

  it('writes local dates as YYYY-MM-DD', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(todayIso(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31');
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('starts a new test in the event conditions, valid for the inputs schema', () => {
    const inputs = normalizeInputs({ event: { sport: 'running', speedKmh: 12 }, environment: { tempC: 28, sun: 'full' } });
    expect(currentConditions(inputs)).toEqual({ ...RIDE, sport: 'running', speedKmh: 12, tempC: 28, sun: 'full' });
    const draft = newTestDraft(inputs, '2026-10-17');
    expect(draft).toEqual({
      date: '2026-10-17',
      label: '',
      preKg: 0,
      postKg: 0,
      fluidL: 0,
      urineL: 0,
      durationMin: 60,
      conditions: currentConditions(inputs),
    });
    // Saving it unchanged keeps every field (the inputs accept it as it is).
    const saved = normalizeInputs({ ...inputs, sweat: { ...inputs.sweat, tests: [{ id: 't1', ...draft }] } });
    expect(saved.sweat.tests[0]).toEqual({ id: 't1', ...draft });
    expect(newTestDraft(DEFAULT_INPUTS).conditions).toEqual(RIDE);
  });

  it('rounds rates and sodium for display', () => {
    expect(rateForText(1.3618)).toBe(1.36);
    expect(rateForText(undefined)).toBe(0);
    expect(sodiumMgPerL(40)).toBe(920);
    expect(sodiumMgPerL(70)).toBe(1609);
    expect(sodiumMgPerL(null)).toBe(0);
  });

  it('labels the projection levels, unknown levels as ok', () => {
    expect(projectionLevelLabel(t, 'ok')).toBe('Up to 2% loss');
    expect(projectionLevelLabel(t, 'mild')).toBe('2–3% loss');
    expect(projectionLevelLabel(t, 'high')).toBe('Over 3% loss');
    expect(projectionLevelLabel(t, 'gain')).toBe('Weight gain');
    expect(projectionLevelLabel(t, 'nonsense')).toBe('Up to 2% loss');
    expect(projectionLevel('toString')).toBe('ok');
    expect(projectionLevelLabel(de, 'mild')).toBe('2–3\u00a0% Verlust');
  });
});

describe('ui-setup-sweat catalog', () => {
  it('has every key the section builds from data', () => {
    const keys = [
      ...SWEAT_SOURCES.flatMap((source) => [`ui-setup-sweat.source.${source}`, `ui-setup-sweat.summary.source.${source}`]),
      ...SWEAT_RATE_PRESETS_LPH.flatMap((_, i) => [`ui-setup-sweat.preset.${i}.name`, `ui-setup-sweat.preset.${i}.description`]),
      ...SWEAT_SODIUM_PRESETS_MMOL.flatMap((_, i) => [
        `ui-setup-sweat.saltiness.${i}.name`,
        `ui-setup-sweat.saltiness.${i}.description`,
      ]),
      ...INPUT_OPTIONS.sport.map((sport) => `ui-common.sport.${sport}`),
      ...INPUT_OPTIONS.setting.flatMap((s) => [`ui-common.setting.${s}`, `ui-setup-sweat.conditions.setting.${s}`]),
      ...INPUT_OPTIONS.sun.flatMap((s) => [`ui-common.sun.${s}`, `ui-setup-sweat.conditions.sun.${s}`]),
    ];
    for (const key of keys) expect(hasMessage(key), key).toBe(true);
    expect(SWEAT_SOURCES).toEqual(INPUT_OPTIONS.sweatSource);
  });

  it('keeps its keys in its own namespace and types its quantities', () => {
    const catalog = CATALOGS['ui-setup-sweat'];
    expect(Object.keys(catalog).length).toBeGreaterThan(100);
    for (const [key, text] of Object.entries(catalog)) {
      expect(key.startsWith('ui-setup-sweat.'), key).toBe(true);
      expect(text.trim(), key).toBe(text);
      expect(text, key).not.toBe('');
      // Rates are typed volumes (L/h or fl oz/h), never a plain number before "L".
      expect(text, key).not.toMatch(/\{\w+\} ?(ml|L\b|kg|%|°|km\/h|cm|lb|mph)/);
      for (const token of placeholdersOf(text)) {
        const [name, type, ...flags] = token.split(':');
        if (type !== undefined) expect(PLACEHOLDER_TYPES, `${key}: ${token}`).toContain(type);
        for (const flag of flags) expect(flag, `${key}: ${token}`).toBe('nounit');
        if (name.endsWith('Lph')) expect(type, key).toBe('volumeL');
      }
    }
    expect(placeholdersOf(catalog['ui-setup-sweat.summary.range'])).toEqual(['lo:volumeL:nounit', 'hi:volumeL']);
  });
});
