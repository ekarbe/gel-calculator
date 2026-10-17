import { describe, it, expect, vi, afterEach } from 'vitest';
import { useEffect } from 'react';
import { renderHook, act, render } from '@testing-library/react';
import {
  UiProvider,
  useUi,
  usePrefs,
  TOAST_DURATION_MS,
  TOAST_TONES,
  MIXING_MODAL,
  TEMPLATE_MODAL,
  SHARE_MODAL,
  RECIPES_MODAL,
  SETTINGS_MODAL,
  PREFS_KEY,
  DEFAULT_PREFS,
  BOARD_TABS,
  GUIDED_STEP_COUNT,
} from './UiProvider';
import { PlanProvider } from './PlanProvider';
import { saveAutosave } from './storage';
import { encodeShareState } from './shareCodec';
import { normalizeInputs } from '../domain/plan';

const wrapper = ({ children }) => <UiProvider>{children}</UiProvider>;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('UiProvider', () => {
  it('starts with no modal, the share menu, no toast and metric units', () => {
    const { result } = renderHook(useUi, { wrapper });
    expect(result.current.modal).toBeNull();
    expect(result.current.shareView).toBe('menu');
    expect(result.current.toastMessage).toBe('');
    expect(result.current.unitSystem).toBe('metric');
  });

  it('opens and closes one modal at a time', () => {
    const { result } = renderHook(useUi, { wrapper });
    act(() => result.current.openModal('templates'));
    expect(result.current.modal).toBe('templates');
    expect(result.current.isModalOpen('templates')).toBe(true);
    expect(result.current.isModalOpen('share')).toBe(false);
    act(() => result.current.openModal('mixing'));
    expect(result.current.modal).toBe('mixing');
    act(() => result.current.closeModal());
    expect(result.current.modal).toBeNull();
    act(() => result.current.openModal(''));
    expect(result.current.modal).toBeNull();
  });

  it('resets the share view when the share modal opens', () => {
    const { result } = renderHook(useUi, { wrapper });
    act(() => result.current.setShareView('image'));
    expect(result.current.shareView).toBe('image');
    act(() => result.current.openModal('share'));
    expect(result.current.shareView).toBe('menu');
    expect(result.current.modal).toBe('share');
  });

  it('shows a toast and hides it after the timer', () => {
    vi.useFakeTimers();
    const { result } = renderHook(useUi, { wrapper });
    act(() => result.current.showToast('Recipe link copied!'));
    expect(result.current.toastMessage).toBe('Recipe link copied!');
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1));
    expect(result.current.toastMessage).toBe('Recipe link copied!');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toastMessage).toBe('');
  });

  it('restarts the timer for a new toast and supports a custom duration', () => {
    vi.useFakeTimers();
    const { result } = renderHook(useUi, { wrapper });
    act(() => result.current.showToast('First'));
    act(() => vi.advanceTimersByTime(2000));
    act(() => result.current.showToast('Second', 5000));
    act(() => vi.advanceTimersByTime(4000));
    expect(result.current.toastMessage).toBe('Second');
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.toastMessage).toBe('');
  });

  it('gives a toast a tone (default neutral) and keeps the numeric duration form', () => {
    vi.useFakeTimers();
    const { result } = renderHook(useUi, { wrapper });
    expect(result.current.toastTone).toBe('neutral');
    act(() => result.current.showToast('Could not copy the link.', { tone: 'danger', durationMs: 5000 }));
    expect(result.current.toastMessage).toBe('Could not copy the link.');
    expect(result.current.toastTone).toBe('danger');
    act(() => vi.advanceTimersByTime(4999));
    expect(result.current.toastMessage).toBe('Could not copy the link.');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toastMessage).toBe('');
    act(() => result.current.showToast('Saved', { tone: 'ok' }));
    expect(result.current.toastTone).toBe('ok');
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS));
    expect(result.current.toastMessage).toBe('');
    act(() => result.current.showToast('Plain', 4000));
    expect(result.current.toastTone).toBe('neutral');
    act(() => result.current.showToast('Odd', { tone: 'purple' }));
    expect(result.current.toastTone).toBe('neutral');
    expect(TOAST_TONES).toEqual(['neutral', 'ok', 'warn', 'danger']);
  });

  it('hides a toast on demand and clears its timer on unmount', () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(useUi, { wrapper });
    act(() => result.current.showToast('Hi'));
    act(() => result.current.hideToast());
    expect(result.current.toastMessage).toBe('');
    act(() => result.current.showToast('Again'));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('only accepts known unit systems', () => {
    const { result } = renderHook(useUi, { wrapper });
    act(() => result.current.setUnitSystem('imperial'));
    expect(result.current.unitSystem).toBe('imperial');
    act(() => result.current.setUnitSystem('stone'));
    act(() => result.current.setUnitSystem('lb'));
    expect(result.current.unitSystem).toBe('imperial');
  });

  it('exposes the modal names and no scroll helper or recipe ref', () => {
    expect([MIXING_MODAL, TEMPLATE_MODAL, SHARE_MODAL, RECIPES_MODAL]).toEqual(['mixing', 'templates', 'share', 'recipes']);
    const { result } = renderHook(useUi, { wrapper });
    expect(result.current).not.toHaveProperty('scrollToRecipe');
    // The PDF export that captured the recipe card is gone (print view instead).
    expect(result.current).not.toHaveProperty('recipeRef');
    act(() => result.current.openModal(RECIPES_MODAL));
    expect(result.current.isModalOpen(RECIPES_MODAL)).toBe(true);
  });

  it('useUi throws outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useUi())).toThrow(/UiProvider/);
  });
});

describe('UiProvider: prefs', () => {
  const stored = () => JSON.parse(window.localStorage.getItem(PREFS_KEY));

  it('starts with the default prefs, then resolves them after mount', () => {
    const seen = [];
    function Probe() {
      const { prefs, prefsReady } = useUi();
      seen.push({ ...prefs, prefsReady });
      return null;
    }
    render(
      <UiProvider>
        <Probe />
      </UiProvider>,
    );
    expect(seen[0]).toEqual({ ...DEFAULT_PREFS, prefsReady: false });
    // A first visit outside a PlanProvider restored nothing: guided.
    expect(seen.at(-1)).toEqual({ locale: 'en', unitSystem: 'metric', currency: 'EUR', mode: 'guided', prefsReady: true });
  });

  it.each([
    ['de-DE', { locale: 'de', unitSystem: 'metric', currency: 'EUR' }],
    ['en-US', { locale: 'en', unitSystem: 'imperial', currency: 'USD' }],
    ['en-GB', { locale: 'en', unitSystem: 'metric', currency: 'GBP' }],
    ['fr-FR', { locale: 'en', unitSystem: 'metric', currency: 'EUR' }],
  ])('defaults from navigator.language %s', (language, expected) => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue(language);
    const { result } = renderHook(useUi, { wrapper });
    expect(result.current).toMatchObject(expected);
    expect(result.current.prefs).toMatchObject(expected);
  });

  it('persists the resolved prefs and every change', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
    const { result } = renderHook(useUi, { wrapper });
    expect(stored()).toEqual({ locale: 'en', unitSystem: 'imperial', currency: 'USD', mode: 'guided' });
    act(() => result.current.setLocale('de'));
    act(() => result.current.setUnitSystem('metric'));
    act(() => result.current.setCurrency('GBP'));
    act(() => result.current.setMode('expert'));
    expect(result.current).toMatchObject({ locale: 'de', unitSystem: 'metric', currency: 'GBP', mode: 'expert' });
    expect(stored()).toEqual({ locale: 'de', unitSystem: 'metric', currency: 'GBP', mode: 'expert' });
  });

  it('prefers stored prefs over the browser language, field by field', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ locale: 'de', currency: 'nope' }));
    const { result } = renderHook(useUi, { wrapper });
    // Stored prefs mean a returning visitor: expert unless a mode was stored.
    expect(result.current.prefs).toEqual({ locale: 'de', unitSystem: 'imperial', currency: 'USD', mode: 'expert' });
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ mode: 'guided' }));
    const { result: again } = renderHook(useUi, { wrapper });
    expect(again.current.mode).toBe('guided');
  });

  it('ignores values that are not allowed', () => {
    const { result } = renderHook(useUi, { wrapper });
    const before = result.current.prefs;
    act(() => result.current.setLocale('fr'));
    act(() => result.current.setUnitSystem('nautical'));
    act(() => result.current.setCurrency('JPY'));
    act(() => result.current.setMode('wizard'));
    expect(result.current.prefs).toBe(before);
  });

  it('keeps a pref set before the prefs were resolved', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
    function EarlyChild() {
      const { setLocale } = useUi();
      // Child effects run before the provider's own effects.
      useEffect(() => setLocale('de'), [setLocale]);
      return null;
    }
    const { result } = renderHook(useUi, {
      wrapper: ({ children }) => (
        <UiProvider>
          <EarlyChild />
          {children}
        </UiProvider>
      ),
    });
    expect(result.current.prefs).toMatchObject({ locale: 'de', unitSystem: 'imperial', currency: 'USD' });
  });

  it('works when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(useUi, { wrapper });
    expect(result.current.prefsReady).toBe(true);
    act(() => result.current.setLocale('de'));
    expect(result.current.locale).toBe('de');
  });

  it('has one unit system instead of the old separate mass and temperature units', () => {
    const { result } = renderHook(useUi, { wrapper });
    for (const gone of ['massUnit', 'setMassUnit', 'tempUnit', 'setTempUnit']) expect(result.current).not.toHaveProperty(gone);
  });
});

describe('UiProvider: mode on the first visit', () => {
  const planWrapper = ({ children }) => (
    <PlanProvider>
      <UiProvider>{children}</UiProvider>
    </PlanProvider>
  );

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('is guided with no stored prefs, no share link and no autosave', () => {
    const { result } = renderHook(useUi, { wrapper: planWrapper });
    expect(result.current.prefsReady).toBe(true);
    expect(result.current.mode).toBe('guided');
  });

  it('waits for the plan restore and is expert after an autosave', () => {
    saveAutosave(normalizeInputs({ event: { durationMin: 240 } }));
    const modes = [];
    function Probe() {
      const { mode, prefsReady } = useUi();
      modes.push([prefsReady, mode]);
      return null;
    }
    render(
      <PlanProvider>
        <UiProvider>
          <Probe />
        </UiProvider>
      </PlanProvider>,
    );
    expect(modes.at(-1)).toEqual([true, 'expert']);
    // Never ready with a guess made before the restore.
    expect(modes.filter(([ready, mode]) => ready && mode !== 'expert')).toEqual([]);
  });

  it('is expert when the page was opened with a share link', () => {
    window.history.replaceState({}, '', `/?s=${encodeShareState({ event: { durationMin: 75 } })}`);
    const { result } = renderHook(useUi, { wrapper: planWrapper });
    expect(result.current.mode).toBe('expert');
  });

  it('remembers the mode on the next visit', () => {
    const first = renderHook(useUi, { wrapper: planWrapper });
    expect(first.result.current.mode).toBe('guided');
    act(() => first.result.current.setMode('expert'));
    first.unmount();
    const { result } = renderHook(useUi, { wrapper: planWrapper });
    expect(result.current.mode).toBe('expert');
  });
});

describe('UiProvider: layout state', () => {
  it('clamps the guided step to 0–3 and accepts an updater', () => {
    const { result } = renderHook(useUi, { wrapper });
    expect(GUIDED_STEP_COUNT).toBe(4);
    expect(result.current.guidedStep).toBe(0);
    act(() => result.current.setGuidedStep(2));
    expect(result.current.guidedStep).toBe(2);
    act(() => result.current.setGuidedStep((step) => step + 5));
    expect(result.current.guidedStep).toBe(3);
    act(() => result.current.setGuidedStep(-1));
    expect(result.current.guidedStep).toBe(0);
    act(() => result.current.setGuidedStep(1.6));
    expect(result.current.guidedStep).toBe(2);
    act(() => result.current.setGuidedStep(NaN));
    act(() => result.current.setGuidedStep('3'));
    expect(result.current.guidedStep).toBe(2);
  });

  it('switches the phone tab between board, setup and schedule only', () => {
    const { result } = renderHook(useUi, { wrapper });
    expect(BOARD_TABS).toEqual(['board', 'setup', 'schedule']);
    expect(result.current.boardTab).toBe('board');
    act(() => result.current.setBoardTab('schedule'));
    expect(result.current.boardTab).toBe('schedule');
    act(() => result.current.setBoardTab('analysis'));
    expect(result.current.boardTab).toBe('schedule');
  });

  it('has a settings modal name', () => {
    expect(SETTINGS_MODAL).toBe('settings');
    const { result } = renderHook(useUi, { wrapper });
    act(() => result.current.openModal(SETTINGS_MODAL));
    expect(result.current.isModalOpen(SETTINGS_MODAL)).toBe(true);
  });
});

describe('usePrefs', () => {
  it('returns the prefs inside the provider and the defaults outside', () => {
    expect(renderHook(usePrefs).result.current).toBe(DEFAULT_PREFS);
    const { result } = renderHook(() => ({ prefs: usePrefs(), ui: useUi() }), { wrapper });
    expect(result.current.prefs).toBe(result.current.ui.prefs);
    act(() => result.current.ui.setLocale('de'));
    expect(result.current.prefs.locale).toBe('de');
  });
});
