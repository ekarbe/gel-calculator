import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCalculator } from './useCalculator';

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
});
