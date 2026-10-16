import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCalculator } from './useCalculator';
import { encodeShareState, DEFAULT_SHARE_STATE } from '../lib/shareCodec';

describe('useCalculator hook', () => {
  it('initializes with default values', () => {
    const { result } = renderHook(() => useCalculator());
    
    expect(result.current.duration).toBe(60);
    expect(result.current.targetCarbs).toBe(90);
    expect(result.current.glucoseParts).toBe(1.0);
    expect(result.current.fructoseParts).toBe(0.8);
    expect(result.current.glucoseSources).toHaveLength(1);
    expect(result.current.glucoseSources[0].name).toBe('Maltodextrin');
    expect(result.current.fructoseSources).toHaveLength(1);
    expect(result.current.fructoseSources[0].name).toBe('Crystalline Fructose');
    expect(result.current.electrolyteSources).toHaveLength(0);
    expect(result.current.isSweatRate).toBe(true);
  });

  it('adds a glucose source', () => {
    const { result } = renderHook(() => useCalculator());
    
    act(() => {
      result.current.addSource('glucose');
    });
    
    expect(result.current.glucoseSources.length).toBe(2);
    expect(result.current.glucoseSources[1]).toHaveProperty('name');
    expect(result.current.glucoseSources[1].name).not.toBe('Maltodextrin'); // Assuming default was Maltodextrin and it avoids duplicates
  });

  it('updates duration', () => {
    const { result } = renderHook(() => useCalculator());
    
    act(() => {
      result.current.setDuration(120);
    });
    
    expect(result.current.duration).toBe(120);
  });

  it('adds and removes a source', () => {
    const { result } = renderHook(() => useCalculator());
    
    act(() => {
      result.current.addSource('fructose');
    });
    
    expect(result.current.fructoseSources.length).toBe(2);
    const addedId = result.current.fructoseSources[1].id;

    act(() => {
      result.current.removeSource('fructose', addedId);
    });

    expect(result.current.fructoseSources.length).toBe(1);
  });

  it('calculates totals correctly based on default parts', () => {
    const { result } = renderHook(() => useCalculator());
    
    expect(result.current.totals.glucoseRatio).toBe(56); // 1.0 / 1.8 = 55.5%
    expect(result.current.totals.fructoseRatio).toBe(44); // 0.8 / 1.8 = 44.4%
  });

  it('computes total calories from the carb target', () => {
    const { result } = renderHook(() => useCalculator());
    expect(result.current.totalCarbs).toBe(90);
    expect(result.current.totalCalories).toBe(360);
  });

  it('divides per-gel amounts by the number of gels in the schedule', () => {
    const { result } = renderHook(() => useCalculator());
    act(() => {
      result.current.setDuration(75);
      result.current.setRecipeView('perGel');
    });
    expect(result.current.gelCount).toBe(3);
    expect(result.current.getDisplayValue(90)).toBe(30);
  });

  it('restores a shared recipe from the URL, including manual targets', () => {
    const encoded = encodeShareState({
      ...DEFAULT_SHARE_STATE,
      duration: 150,
      isSweatRate: false,
      manualTargets: { Sodium: 500, Chloride: 0, Potassium: 120, Magnesium: 0, Calcium: 0 },
      electrolyteSources: [{ id: 31, amount: 1250.5 }],
    });
    window.history.replaceState(null, '', `/?s=${encoded}`);
    try {
      const { result } = renderHook(() => useCalculator());
      expect(result.current.duration).toBe(150);
      expect(result.current.isSweatRate).toBe(false);
      expect(result.current.manualTargets.Sodium).toBe(500);
      expect(result.current.manualTargets.Potassium).toBe(120);
      expect(result.current.electrolyteSources[0]).toMatchObject({ name: 'Sodium Chloride (Table Salt)', amount: 1250.5 });
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });
});
