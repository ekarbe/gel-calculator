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
      strategy: {
        isSmartSuggestions: false,
        setIsSmartSuggestions: vi.fn(),
      }
    };

    render(
      <CalculatorContext.Provider value={mockContextValue}>
        <ActivityBasics />
      </CalculatorContext.Provider>
    );

    const hoursInput = screen.getAllByRole('spinbutton')[0];
    const minutesInput = screen.getAllByRole('spinbutton')[1];
    const carbsInput = screen.getAllByRole('spinbutton')[2];

    expect(hoursInput).toHaveValue(2);
    expect(minutesInput).toHaveValue(0);
    expect(carbsInput).toHaveValue(80);
  });

  it('calls context update functions on input change', () => {
    const mockContextValue = {
      duration: 120,
      setDuration: vi.fn(),
      targetCarbs: 80,
      setTargetCarbs: vi.fn(),
      strategy: {
        isSmartSuggestions: false,
        setIsSmartSuggestions: vi.fn(),
      }
    };

    render(
      <CalculatorContext.Provider value={mockContextValue}>
        <ActivityBasics />
      </CalculatorContext.Provider>
    );

    const hoursInput = screen.getAllByRole('spinbutton')[0];
    const minutesInput = screen.getAllByRole('spinbutton')[1];
    const carbsInput = screen.getAllByRole('spinbutton')[2];

    fireEvent.change(hoursInput, { target: { value: '3' } });
    expect(mockContextValue.setDuration).toHaveBeenCalledWith(180);

    fireEvent.change(carbsInput, { target: { value: '100' } });
    expect(mockContextValue.setTargetCarbs).toHaveBeenCalledWith(100);
  });
});
