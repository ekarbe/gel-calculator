import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BalanceAnalysis from './BalanceAnalysis';
import { CalculatorContext } from '../../context/CalculatorContext';

describe('BalanceAnalysis Component', () => {
  it('renders circular rings and total calories', () => {
    const mockContextValue = {
      totals: { glucoseRatio: 50, fructoseRatio: 50 },
      duration: 120,
      targetCarbs: 80,
      totalCalories: 640,
      electrolyteAnalysis: {
        Sodium: { percentage: 100, message: 'Optimal sodium' },
        Chloride: { percentage: 80, message: 'Good chloride' }
      },
      glucoseParts: 1,
      fructoseParts: 1,
      activeElectrolytes: { Sodium: true, Chloride: true, Potassium: false, Magnesium: false, Calcium: false }
    };

    render(
      <CalculatorContext.Provider value={mockContextValue}>
        <BalanceAnalysis />
      </CalculatorContext.Provider>
    );

    expect(screen.getByText('Activity Summary')).toBeInTheDocument();
    expect(screen.getByText('160')).toBeInTheDocument(); // Total Carbs
    expect(screen.getByText('Total Carbs')).toBeInTheDocument();
    
    expect(screen.getByText('100')).toBeInTheDocument(); // Sodium Match
    expect(screen.getByText('Sodium Match')).toBeInTheDocument();
    
    expect(screen.getByText('640')).toBeInTheDocument(); // Total Energy
    expect(screen.getByText('Total Energy')).toBeInTheDocument();
    
    expect(screen.getByText('1:1')).toBeInTheDocument();
  });

  it('renders overloaded pathways gracefully with the new UI', () => {
    const mockContextValue = {
      totals: { glucoseRatio: 70, fructoseRatio: 30 },
      duration: 60,
      targetCarbs: 100,
      totalCalories: 400,
      electrolyteAnalysis: {},
      glucoseParts: 2.33,
      fructoseParts: 1,
      activeElectrolytes: {}
    };

    render(
      <CalculatorContext.Provider value={mockContextValue}>
        <BalanceAnalysis />
      </CalculatorContext.Provider>
    );

    expect(screen.getByText('1:0.43')).toBeInTheDocument();
    expect(screen.getByText('Glu: 70g/hr')).toBeInTheDocument();
    expect(screen.getByText('Fru: 30g/hr')).toBeInTheDocument();
  });
});
