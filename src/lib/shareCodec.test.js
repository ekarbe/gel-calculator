import { describe, it, expect } from 'vitest';
import { encodeShareState, decodeShareState, DEFAULT_SHARE_STATE } from './shareCodec';

const toBase64Url = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('shareCodec', () => {
  it('encodes the default state to a minimal URL-safe payload', () => {
    const encoded = encodeShareState(DEFAULT_SHARE_STATE);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeShareState(encoded)).toEqual({});
  });

  it('round-trips a fully customised state, including decimals and manual targets', () => {
    const state = {
      ...DEFAULT_SHARE_STATE,
      duration: 195,
      targetCarbs: 82.5,
      glucoseParts: 1.05,
      fructoseParts: 0.85,
      glucoseSources: [{ id: 3, percentage: 62.5 }, { id: 1, percentage: 37.5 }],
      fructoseSources: [{ id: 18, percentage: 100 }],
      electrolyteSources: [{ id: 31, amount: 1234.5 }, { id: 39, amount: 300 }],
      isSweatRate: false,
      sweatRate: 4,
      saltiness: 1,
      activeElectrolytes: { Sodium: true, Chloride: false, Potassium: true, Magnesium: false, Calcium: false },
      manualTargets: { Sodium: 600, Chloride: 0, Potassium: 150.5, Magnesium: 0, Calcium: 0 },
      recipeView: 'perGel',
      gelsPerHour: 3,
      strategy: {
        ...DEFAULT_SHARE_STATE.strategy,
        isSmartSuggestions: true,
        weight: 154,
        weightUnit: 'lbs',
        gender: 'female',
        intensity: 'threshold',
        temperature: 86,
        temperatureUnit: 'F',
        humidity: 70,
        ultraMode: true,
        includeCaffeine: true,
        includeBicarb: true,
        caffeineHabituation: 'naive',
        sweatSodiumConcentration: 'high',
      },
    };
    const decoded = decodeShareState(encodeShareState(state));
    expect(decoded).toEqual({
      duration: 195,
      targetCarbs: 82.5,
      glucoseParts: 1.05,
      fructoseParts: 0.85,
      glucoseSources: state.glucoseSources,
      fructoseSources: state.fructoseSources,
      electrolyteSources: state.electrolyteSources,
      isSweatRate: false,
      sweatRate: 4,
      saltiness: 1,
      activeElectrolytes: state.activeElectrolytes,
      manualTargets: state.manualTargets,
      recipeView: 'perGel',
      gelsPerHour: 3,
      strategy: {
        isSmartSuggestions: true,
        weight: 154,
        weightUnit: 'lbs',
        gender: 'female',
        intensity: 'threshold',
        temperature: 86,
        temperatureUnit: 'F',
        humidity: 70,
        ultraMode: true,
        includeCaffeine: true,
        includeBicarb: true,
        caffeineHabituation: 'naive',
        sweatSodiumConcentration: 'high',
      },
    });
  });

  it('keeps explicitly empty source lists', () => {
    const decoded = decodeShareState(encodeShareState({ ...DEFAULT_SHARE_STATE, glucoseSources: [] }));
    expect(decoded.glucoseSources).toEqual([]);
  });

  it('rejects garbage, other versions and the legacy format', () => {
    expect(decodeShareState('not base64 !!')).toBeNull();
    expect(decodeShareState(toBase64Url({ v: 1, d: 90 }))).toBeNull();
    expect(decodeShareState('d_90~t_80')).toBeNull();
  });

  it('drops unknown sources and invalid values instead of trusting the link', () => {
    const decoded = decodeShareState(toBase64Url({
      v: 2,
      d: 'ninety',
      t: -50,
      gs: [[999, 50], [3, 'x'], [3, 100]],
      es: [[31, -20]],
      sr: 9,
      ae: '10',
      st: { int: 'insane', wt: 80, ism: 1 },
    }));
    expect(decoded).toEqual({
      targetCarbs: 0,
      glucoseSources: [{ id: 3, percentage: 100 }],
      electrolyteSources: [{ id: 31, amount: 0 }],
      strategy: { weight: 80, isSmartSuggestions: true },
    });
  });
});
