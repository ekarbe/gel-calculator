import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ActivityBasics from './ActivityBasics';
import { CalculatorContext } from '../../context/CalculatorContext';

describe('ActivityBasics Component', () => {
  it('renders inputs with values from context', () => {
    const mockContextValue = {
      duration: 120,
      setDuration: vi.fn(),
      targetCarbs: 80,
      setTargetCarbs: vi.fn(),
    };

    render(
      <CalculatorContext.Provider value={mockContextValue}>
        <ActivityBasics />
      </CalculatorContext.Provider>
    );

    const durationInput = screen.getAllByRole('spinbutton')[0];
    const carbsInput = screen.getAllByRole('spinbutton')[1];

    expect(durationInput).toHaveValue(120);
    expect(carbsInput).toHaveValue(80);
  });

  it('calls context update functions on input change', () => {
    const mockContextValue = {
      duration: 120,
      setDuration: vi.fn(),
      targetCarbs: 80,
      setTargetCarbs: vi.fn(),
    };

    render(
      <CalculatorContext.Provider value={mockContextValue}>
        <ActivityBasics />
      </CalculatorContext.Provider>
    );

    const durationInput = screen.getAllByRole('spinbutton')[0];
    const carbsInput = screen.getAllByRole('spinbutton')[1];

    fireEvent.change(durationInput, { target: { value: '150' } });
    expect(mockContextValue.setDuration).toHaveBeenCalledWith(150);

    fireEvent.change(carbsInput, { target: { value: '100' } });
    expect(mockContextValue.setTargetCarbs).toHaveBeenCalledWith(100);
  });
});
