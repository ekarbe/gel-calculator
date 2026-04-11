import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { CalculatorProvider, useCalculatorContext } from './CalculatorContext';

describe('CalculatorContext', () => {
  it('provides the calculator state to children', () => {
    const wrapper = ({ children }) => (
      <CalculatorProvider>{children}</CalculatorProvider>
    );

    const { result } = renderHook(() => useCalculatorContext(), { wrapper });
    
    // Check if the state includes properties returned by useCalculator
    expect(result.current).toHaveProperty('duration');
    expect(result.current).toHaveProperty('targetCarbs');
    expect(result.current).toHaveProperty('setDuration');
  });

  it('returns null when used outside of Provider (default state)', () => {
    const { result } = renderHook(() => useCalculatorContext());
    expect(result.current).toBeNull();
  });
});
