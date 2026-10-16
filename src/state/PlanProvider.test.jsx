import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, render, screen } from '@testing-library/react';
import {
  PlanProvider,
  usePlanInputs,
  usePlan,
  planInputsReducer,
  PlanInputsContext,
  PlanContext,
} from './PlanProvider';
import { DEFAULT_INPUTS, normalizeInputs, computePlan } from '../domain/plan';
import { encodeShareState } from './shareCodec';

const wrapper = ({ children }) => <PlanProvider>{children}</PlanProvider>;
const useBoth = () => ({ api: usePlanInputs(), plan: usePlan() });

afterEach(() => {
  window.history.replaceState({}, '', '/');
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
    const next = planInputsReducer(state, { type: 'set', path: 'carbs.glucoseSources.0.percentage', value: 40 });
    expect(next.carbs.glucoseSources).toEqual([{ id: 3, percentage: 40 }]);
    expect(state.carbs.glucoseSources).toEqual([{ id: 3, percentage: 100 }]);
  });

  it('set accepts an updater function', () => {
    const next = planInputsReducer(state, {
      type: 'set',
      path: 'carbs.glucoseSources',
      value: (list) => [...list, { id: 1, percentage: 50 }],
    });
    expect(next.carbs.glucoseSources).toEqual([{ id: 3, percentage: 100 }, { id: 1, percentage: 50 }]);
  });

  it('apply deep-merges a partial; arrays replace', () => {
    const next = planInputsReducer(state, {
      type: 'apply',
      partial: { carbs: { manualRatio: { fructose: 0.5 }, fructoseSources: [] }, format: { view: 'perGel' } },
    });
    expect(next.carbs.manualRatio).toEqual({ glucose: 1, fructose: 0.5 });
    expect(next.carbs.fructoseSources).toEqual([]);
    expect(next.carbs.glucoseSources).toEqual(state.carbs.glucoseSources);
    expect(next.format.view).toBe('perGel');
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
