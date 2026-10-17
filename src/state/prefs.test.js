import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  PREFS_KEY,
  MODES,
  BOARD_TABS,
  GUIDED_STEP_COUNT,
  DEFAULT_PREFS,
  prefsForLanguage,
  normalizePrefs,
  loadPrefs,
  savePrefs,
} from './prefs';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('constants', () => {
  it('names the key, modes, tabs and steps', () => {
    expect(PREFS_KEY).toBe('gel-calculator:prefs');
    expect(MODES).toEqual(['guided', 'expert']);
    expect(BOARD_TABS).toEqual(['board', 'setup', 'schedule']);
    expect(GUIDED_STEP_COUNT).toBe(4);
    expect(DEFAULT_PREFS).toEqual({ locale: 'en', unitSystem: 'metric', currency: 'EUR', mode: 'expert' });
    expect(Object.isFrozen(DEFAULT_PREFS)).toBe(true);
  });
});

describe('prefsForLanguage', () => {
  it('maps browser languages to language, units and currency', () => {
    expect(prefsForLanguage('de')).toEqual({ locale: 'de', unitSystem: 'metric', currency: 'EUR' });
    expect(prefsForLanguage('de-AT')).toEqual({ locale: 'de', unitSystem: 'metric', currency: 'EUR' });
    expect(prefsForLanguage('DE_ch')).toEqual({ locale: 'de', unitSystem: 'metric', currency: 'EUR' });
    expect(prefsForLanguage('en-US')).toEqual({ locale: 'en', unitSystem: 'imperial', currency: 'USD' });
    expect(prefsForLanguage('en_us')).toEqual({ locale: 'en', unitSystem: 'imperial', currency: 'USD' });
    expect(prefsForLanguage('en-GB')).toEqual({ locale: 'en', unitSystem: 'metric', currency: 'GBP' });
    for (const other of ['en', 'en-AU', 'fr-FR', 'dex', '', undefined, 42]) {
      expect(prefsForLanguage(other), String(other)).toEqual({ locale: 'en', unitSystem: 'metric', currency: 'EUR' });
    }
  });
});

describe('normalizePrefs', () => {
  it('keeps allowed values, fills the rest from the fallback, then the defaults', () => {
    expect(normalizePrefs({ locale: 'de', unitSystem: 'yards', extra: 1 }, { unitSystem: 'imperial', mode: 'guided' })).toEqual({
      locale: 'de',
      unitSystem: 'imperial',
      currency: 'EUR',
      mode: 'guided',
    });
    expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs('de', { currency: 'JPY' })).toEqual(DEFAULT_PREFS);
  });
});

describe('loadPrefs and savePrefs', () => {
  it('returns null when nothing usable is stored', () => {
    expect(loadPrefs()).toBeNull();
    localStorage.setItem(PREFS_KEY, '{not json');
    expect(loadPrefs()).toBeNull();
    localStorage.setItem(PREFS_KEY, '[1,2]');
    expect(loadPrefs()).toBeNull();
    localStorage.setItem(PREFS_KEY, 'null');
    expect(loadPrefs()).toBeNull();
  });

  it('round-trips the four prefs and keeps only valid stored fields', () => {
    expect(savePrefs({ locale: 'de', unitSystem: 'imperial', currency: 'GBP', mode: 'guided', theme: 'dark' })).toBe(true);
    expect(JSON.parse(localStorage.getItem(PREFS_KEY))).toEqual({ locale: 'de', unitSystem: 'imperial', currency: 'GBP', mode: 'guided' });
    expect(loadPrefs()).toEqual({ locale: 'de', unitSystem: 'imperial', currency: 'GBP', mode: 'guided' });
    localStorage.setItem(PREFS_KEY, JSON.stringify({ locale: 'fr', unitSystem: 'imperial', mode: 7 }));
    expect(loadPrefs()).toEqual({ unitSystem: 'imperial' });
    localStorage.setItem(PREFS_KEY, '{}');
    expect(loadPrefs()).toEqual({});
  });

  it('never throws when storage does', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(loadPrefs()).toBeNull();
    expect(savePrefs(DEFAULT_PREFS)).toBe(false);
  });

  it('treats a missing localStorage as unavailable', () => {
    vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(loadPrefs()).toBeNull();
    expect(savePrefs(DEFAULT_PREFS)).toBe(false);
  });
});
