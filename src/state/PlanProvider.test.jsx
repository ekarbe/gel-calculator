import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { renderHook, act, render, screen } from '@testing-library/react';
import {
  PlanProvider,
  usePlanInputs,
  usePlan,
  planInputsReducer,
  PlanInputsContext,
  PlanContext,
  AUTOSAVE_DELAY_MS,
} from './PlanProvider';
import { DEFAULT_INPUTS, normalizeInputs, computePlan } from '../domain/plan';
import { encodeShareState, decodeShareState } from './shareCodec';
import { STORAGE_KEYS, saveAutosave } from './storage';

const wrapper = ({ children }) => <PlanProvider>{children}</PlanProvider>;
const useBoth = () => ({ api: usePlanInputs(), plan: usePlan() });
const storedAutosave = () => {
  const raw = window.localStorage.getItem(STORAGE_KEYS.autosave);
  return raw === null ? null : decodeShareState(raw);
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.history.replaceState({}, '', '/');
  window.localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('planInputsReducer', () => {
  const state = normalizeInputs({});

  it('set writes one field by dot path or key array, normalized', () => {
    expect(planInputsReducer(state, { type: 'set', path: 'event.durationMin', value: 240 }).event.durationMin).toBe(240);
    expect(planInputsReducer(state, { type: 'set', path: ['carbs', 'manualRatio', 'fructose'], value: 9 }).carbs.manualRatio).toEqual({
      glucose: 1,
      fructose: 5,
    });
  });

  it('set indexes into arrays with numeric segments', () => {
    const next = planInputsReducer(state, { type: 'set', path: 'carbs.ingredients.0.weight', value: 40 });
    expect(next.carbs.ingredients).toEqual([{ ref: 3, weight: 40 }, { ref: 11, weight: 33 }]);
    expect(state.carbs.ingredients).toEqual([{ ref: 3, weight: 67 }, { ref: 11, weight: 33 }]);
  });

  it('set accepts an updater function', () => {
    const next = planInputsReducer(state, {
      type: 'set',
      path: 'carbs.ingredients',
      value: (list) => [...list, { ref: 1, weight: 50 }],
    });
    expect(next.carbs.ingredients).toEqual([{ ref: 3, weight: 67 }, { ref: 11, weight: 33 }, { ref: 1, weight: 50 }]);
  });

  it('apply deep-merges a partial; arrays replace', () => {
    const next = planInputsReducer(state, {
      type: 'apply',
      partial: { carbs: { manualRatio: { fructose: 0.5 }, ingredients: [] }, format: { view: 'perServing' } },
    });
    expect(next.carbs.manualRatio).toEqual({ glucose: 1, fructose: 0.5 });
    expect(next.carbs.ingredients).toEqual([]);
    expect(next.carbs.custom).toEqual(state.carbs.custom);
    expect(next.format.view).toBe('perServing');
  });

  it('apply ignores an own __proto__ key', () => {
    const next = planInputsReducer(state, { type: 'apply', partial: JSON.parse('{"__proto__":{"polluted":1},"event":{"durationMin":90}}') });
    expect(next.event.durationMin).toBe(90);
    expect(Object.getPrototypeOf(next)).toBe(Object.prototype);
    expect({}.polluted).toBeUndefined();
  });

  it('replace merges onto the defaults, not onto the current state', () => {
    const custom = normalizeInputs({ event: { durationMin: 300 }, caffeine: { enabled: true } });
    const next = planInputsReducer(custom, { type: 'replace', inputs: { caffeine: { enabled: true } } });
    expect(next.event.durationMin).toBe(180);
    expect(next.caffeine.enabled).toBe(true);
  });

  it('reset restores the defaults', () => {
    const custom = normalizeInputs({ event: { durationMin: 300 } });
    expect(planInputsReducer(custom, { type: 'reset' })).toEqual(DEFAULT_INPUTS);
  });

  it('keeps the same state object for no-op and unknown actions', () => {
    expect(planInputsReducer(state, { type: 'set', path: 'event.durationMin', value: 180 })).toBe(state);
    expect(planInputsReducer(state, { type: 'set', path: 'event.durationMin', value: 'junk' })).toBe(state);
    expect(planInputsReducer(state, { type: 'set', path: '', value: 1 })).toBe(state);
    expect(planInputsReducer(state, { type: 'apply', partial: null })).toBe(state);
    expect(planInputsReducer(state, { type: 'reset' })).toBe(state);
    expect(planInputsReducer(state, { type: 'unknown' })).toBe(state);
  });
});

describe('PlanProvider', () => {
  it('starts from the defaults and provides the computed plan', () => {
    const { result } = renderHook(useBoth, { wrapper });
    expect(result.current.api.inputs).toEqual(DEFAULT_INPUTS);
    expect(result.current.plan).toEqual(computePlan(DEFAULT_INPUTS));
    expect(result.current.plan.carbs.gPerHour).toBe(75);
  });

  it('accepts initial inputs', () => {
    const { result } = renderHook(useBoth, {
      wrapper: ({ children }) => <PlanProvider initialInputs={{ event: { durationMin: 60 } }}>{children}</PlanProvider>,
    });
    expect(result.current.api.inputs.event.durationMin).toBe(60);
    expect(result.current.plan.durationMin).toBe(60);
  });

  it('set, apply, replace and reset update inputs and the plan', () => {
    const { result } = renderHook(useBoth, { wrapper });

    act(() => result.current.api.set('event.durationMin', 240));
    expect(result.current.api.inputs.event.durationMin).toBe(240);
    expect(result.current.plan.durationMin).toBe(240);

    act(() => result.current.api.apply({ carbs: { mode: 'manual', manualGPerHour: 130 } }));
    expect(result.current.plan.carbs.gPerHour).toBe(130);
    expect(result.current.plan.warnings[0].id).toBe('carbs.aboveStudied');

    act(() => result.current.api.replace({ event: { durationMin: 90 } }));
    expect(result.current.api.inputs.carbs.mode).toBe('auto');
    expect(result.current.plan.durationMin).toBe(90);

    act(() => result.current.api.reset());
    expect(result.current.api.inputs).toEqual(DEFAULT_INPUTS);
  });

  it('keeps action functions stable and the plan memoised across no-op updates', () => {
    const { result } = renderHook(useBoth, { wrapper });
    const { set, apply, replace, reset } = result.current.api;
    const plan = result.current.plan;
    act(() => result.current.api.set('event.durationMin', 180));
    expect(result.current.plan).toBe(plan);
    act(() => result.current.api.set('event.durationMin', 200));
    expect(result.current.plan).not.toBe(plan);
    expect(result.current.api.set).toBe(set);
    expect(result.current.api.apply).toBe(apply);
    expect(result.current.api.replace).toBe(replace);
    expect(result.current.api.reset).toBe(reset);
  });

  it('restores inputs from a ?s= share link on mount', () => {
    const shared = normalizeInputs({ event: { durationMin: 270, intensity: 'hard' }, caffeine: { enabled: true } });
    window.history.replaceState({}, '', `/?s=${encodeShareState(shared)}`);
    const { result } = renderHook(useBoth, { wrapper });
    expect(result.current.api.inputs).toEqual(shared);
    expect(result.current.plan.caffeine.enabled).toBe(true);
  });

  it('restores a v3 share link, migrated to v4', () => {
    const v3 = btoa(JSON.stringify({ v: 3, event: { durationMin: 240 } })).replace(/=+$/, '');
    window.history.replaceState({}, '', `/?s=${v3}`);
    const { result } = renderHook(useBoth, { wrapper });
    expect(result.current.api.inputs.event.durationMin).toBe(240);
    expect(result.current.api.inputs.sweat.source).toBe('preset');
    expect(result.current.api.shareLinkFailed).toBe(false);
  });

  it('ignores an unreadable or old share link with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const v2 = btoa(JSON.stringify({ v: 2, d: 195 })).replace(/=+$/, '');
    window.history.replaceState({}, '', `/?s=${v2}`);
    const { result } = renderHook(useBoth, { wrapper });
    expect(result.current.api.inputs).toEqual(DEFAULT_INPUTS);
    expect(warn).toHaveBeenCalledWith('Ignoring unreadable share link');
  });

  it('flags an unreadable share link and removes it from the address bar', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const v2 = btoa(JSON.stringify({ v: 2, d: 195 })).replace(/=+$/, '');
    window.history.replaceState({}, '', `/?x=1&s=${v2}#top`);
    const { result } = renderHook(useBoth, { wrapper });
    expect(result.current.api.shareLinkFailed).toBe(true);
    expect(window.location.search).toBe('?x=1');
    expect(window.location.hash).toBe('#top');
  });

  it('does not flag a missing or readable share link', () => {
    const { result } = renderHook(useBoth, { wrapper });
    expect(result.current.api.shareLinkFailed).toBe(false);
    window.history.replaceState({}, '', `/?s=${encodeShareState({ event: { durationMin: 240 } })}`);
    const restored = renderHook(useBoth, { wrapper });
    expect(restored.result.current.api.inputs.event.durationMin).toBe(240);
    expect(restored.result.current.api.shareLinkFailed).toBe(false);
  });

  it('loadInputs replaces the inputs and drops a share link from the address bar', () => {
    window.history.replaceState({}, '', `/?x=1&s=${encodeShareState({ event: { durationMin: 240 } })}`);
    const { result } = renderHook(useBoth, { wrapper });
    expect(result.current.api.inputs.event.durationMin).toBe(240);
    act(() => result.current.api.loadInputs({ event: { durationMin: 90 }, format: { type: 'drink' } }));
    expect(result.current.api.inputs.event.durationMin).toBe(90);
    expect(result.current.api.inputs.format.type).toBe('drink');
    expect(result.current.api.inputs.carbs.mode).toBe('auto');
    expect(window.location.search).toBe('?x=1');
  });

  it('exposes the contexts for components and tests', () => {
    render(
      <PlanProvider>
        <PlanInputsContext.Consumer>{(api) => <span>inputs:{api.inputs.event.durationMin}</span>}</PlanInputsContext.Consumer>
        <PlanContext.Consumer>{(plan) => <span>plan:{plan.carbs.gPerHour}</span>}</PlanContext.Consumer>
      </PlanProvider>,
    );
    expect(screen.getByText('inputs:180')).toBeInTheDocument();
    expect(screen.getByText('plan:75')).toBeInTheDocument();
  });

  it('hooks throw outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => usePlanInputs())).toThrow(/PlanProvider/);
    expect(() => renderHook(() => usePlan())).toThrow(/PlanProvider/);
  });
});

describe('PlanProvider: autosave', () => {
  const stored = normalizeInputs({ event: { durationMin: 300 }, format: { type: 'both' } });

  it('restores the autosave on mount when there is no share link', () => {
    saveAutosave(stored);
    const { result } = renderHook(useBoth, { wrapper });
    expect(result.current.api.inputs).toEqual(stored);
    expect(result.current.api.restored).toBe(true);
    expect(result.current.plan.durationMin).toBe(300);
  });

  it('prefers a readable share link over the autosave', () => {
    saveAutosave(stored);
    window.history.replaceState({}, '', `/?s=${encodeShareState({ event: { durationMin: 75 } })}`);
    const { result } = renderHook(useBoth, { wrapper });
    expect(result.current.api.inputs.event.durationMin).toBe(75);
    expect(result.current.api.inputs.format.type).toBe('gel');
  });

  it('falls back to the autosave when the share link cannot be read', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    saveAutosave(stored);
    window.history.replaceState({}, '', `/?s=${btoa(JSON.stringify({ v: 2 }))}`);
    const { result } = renderHook(useBoth, { wrapper });
    expect(result.current.api.shareLinkFailed).toBe(true);
    expect(result.current.api.inputs).toEqual(stored);
  });

  it('saves changes 400 ms after the last change', () => {
    vi.useFakeTimers();
    const { result } = renderHook(useBoth, { wrapper });
    expect(AUTOSAVE_DELAY_MS).toBe(400);
    act(() => result.current.api.set('event.durationMin', 200));
    act(() => vi.advanceTimersByTime(300));
    act(() => result.current.api.set('event.durationMin', 210));
    act(() => vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1));
    expect(storedAutosave()).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(storedAutosave().event.durationMin).toBe(210);
  });

  it('never saves before or because of the restore', () => {
    vi.useFakeTimers();
    saveAutosave(stored);
    const before = window.localStorage.getItem(STORAGE_KEYS.autosave);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    renderHook(useBoth, { wrapper });
    act(() => vi.advanceTimersByTime(10 * AUTOSAVE_DELAY_MS));
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(STORAGE_KEYS.autosave)).toBe(before);
  });

  it('does not overwrite the autosave with the defaults on a fresh mount', () => {
    vi.useFakeTimers();
    const { result } = renderHook(useBoth, { wrapper });
    act(() => vi.advanceTimersByTime(10 * AUTOSAVE_DELAY_MS));
    expect(storedAutosave()).toBeNull();
    // A no-op change keeps the same state, so nothing is saved either.
    act(() => result.current.api.set('event.durationMin', 180));
    act(() => vi.advanceTimersByTime(10 * AUTOSAVE_DELAY_MS));
    expect(storedAutosave()).toBeNull();
  });

  it('writes a pending save when the page is hidden, and drops it on unmount', () => {
    vi.useFakeTimers();
    const first = renderHook(useBoth, { wrapper });
    act(() => first.result.current.api.set('event.durationMin', 220));
    act(() => window.dispatchEvent(new Event('pagehide')));
    expect(storedAutosave().event.durationMin).toBe(220);
    act(() => first.result.current.api.set('event.durationMin', 230));
    first.unmount();
    act(() => vi.advanceTimersByTime(10 * AUTOSAVE_DELAY_MS));
    expect(storedAutosave().event.durationMin).toBe(220);
  });

  it('does not restore the autosave when initial inputs are given', () => {
    saveAutosave(stored);
    const { result } = renderHook(useBoth, {
      wrapper: ({ children }) => <PlanProvider initialInputs={{ event: { durationMin: 60 } }}>{children}</PlanProvider>,
    });
    expect(result.current.api.inputs.event.durationMin).toBe(60);
  });

  it('neither restores nor saves with persist={false}', () => {
    vi.useFakeTimers();
    saveAutosave(stored);
    const before = window.localStorage.getItem(STORAGE_KEYS.autosave);
    const { result } = renderHook(useBoth, {
      wrapper: ({ children }) => <PlanProvider persist={false}>{children}</PlanProvider>,
    });
    expect(result.current.api.inputs).toEqual(DEFAULT_INPUTS);
    expect(result.current.api.restored).toBe(true);
    act(() => result.current.api.set('event.durationMin', 100));
    act(() => window.dispatchEvent(new Event('pagehide')));
    act(() => vi.advanceTimersByTime(10 * AUTOSAVE_DELAY_MS));
    expect(window.localStorage.getItem(STORAGE_KEYS.autosave)).toBe(before);
  });

  it('keeps working when storage throws', () => {
    vi.useFakeTimers();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(useBoth, { wrapper });
    expect(result.current.api.inputs).toEqual(DEFAULT_INPUTS);
    act(() => result.current.api.set('event.durationMin', 100));
    act(() => vi.advanceTimersByTime(AUTOSAVE_DELAY_MS));
    expect(result.current.plan.durationMin).toBe(100);
  });

  it('restores once and saves only real changes under StrictMode', () => {
    vi.useFakeTimers();
    saveAutosave(stored);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(useBoth, {
      wrapper: ({ children }) => (
        <StrictMode>
          <PlanProvider>{children}</PlanProvider>
        </StrictMode>
      ),
    });
    expect(result.current.api.inputs).toEqual(stored);
    act(() => vi.advanceTimersByTime(10 * AUTOSAVE_DELAY_MS));
    expect(setItem).not.toHaveBeenCalled();
    act(() => result.current.api.set('event.durationMin', 310));
    act(() => vi.advanceTimersByTime(AUTOSAVE_DELAY_MS));
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(storedAutosave().event.durationMin).toBe(310);
  });

  it('saves a loaded recipe', () => {
    vi.useFakeTimers();
    const { result } = renderHook(useBoth, { wrapper });
    act(() => result.current.api.loadInputs(stored));
    act(() => vi.advanceTimersByTime(AUTOSAVE_DELAY_MS));
    expect(storedAutosave()).toEqual(stored);
  });
});

describe('PlanProvider: restoredFrom', () => {
  const stored = normalizeInputs({ event: { durationMin: 300 } });

  it('is null before and after a restore that found nothing', () => {
    const seen = [];
    function Probe() {
      const { restored, restoredFrom } = usePlanInputs();
      seen.push([restored, restoredFrom]);
      return null;
    }
    render(
      <PlanProvider>
        <Probe />
      </PlanProvider>,
    );
    expect(seen[0]).toEqual([false, null]);
    expect(seen.at(-1)).toEqual([true, null]);
  });

  it('is "autosave" when the autosave was restored, set in the same render as restored', () => {
    saveAutosave(stored);
    const seen = [];
    function Probe() {
      const { restored, restoredFrom } = usePlanInputs();
      seen.push([restored, restoredFrom]);
      return null;
    }
    render(
      <PlanProvider>
        <Probe />
      </PlanProvider>,
    );
    expect(seen.at(-1)).toEqual([true, 'autosave']);
    // Never restored without knowing where from.
    expect(seen.filter(([restored, from]) => restored && from === null)).toEqual([]);
  });

  it('is "link" for a readable share link, even with an autosave', () => {
    saveAutosave(stored);
    window.history.replaceState({}, '', `/?s=${encodeShareState({ event: { durationMin: 75 } })}`);
    const { result } = renderHook(useBoth, { wrapper });
    expect(result.current.api.restoredFrom).toBe('link');
  });

  it('is "autosave" when an unreadable link falls back to the autosave, else null', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.history.replaceState({}, '', `/?s=${btoa(JSON.stringify({ v: 2 }))}`);
    const { result: none } = renderHook(useBoth, { wrapper });
    expect(none.current.api.restoredFrom).toBeNull();
    saveAutosave(stored);
    window.history.replaceState({}, '', `/?s=${btoa(JSON.stringify({ v: 2 }))}`);
    const { result } = renderHook(useBoth, { wrapper });
    expect(result.current.api.restoredFrom).toBe('autosave');
  });

  it('is null with initial inputs or persist={false}, and does not change when a recipe is loaded', () => {
    saveAutosave(stored);
    const { result: initial } = renderHook(useBoth, {
      wrapper: ({ children }) => <PlanProvider initialInputs={{ event: { durationMin: 60 } }}>{children}</PlanProvider>,
    });
    expect(initial.current.api.restoredFrom).toBeNull();
    const { result } = renderHook(useBoth, {
      wrapper: ({ children }) => <PlanProvider persist={false}>{children}</PlanProvider>,
    });
    expect(result.current.api.restoredFrom).toBeNull();
    act(() => result.current.api.loadInputs(stored));
    expect(result.current.api.restoredFrom).toBeNull();
  });

  it('is recorded once under StrictMode', () => {
    window.history.replaceState({}, '', `/?s=${encodeShareState({ event: { durationMin: 75 } })}`);
    const { result } = renderHook(useBoth, {
      wrapper: ({ children }) => (
        <StrictMode>
          <PlanProvider>{children}</PlanProvider>
        </StrictMode>
      ),
    });
    expect(result.current.api.restoredFrom).toBe('link');
  });
});
