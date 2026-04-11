import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BalanceAnalysis from './BalanceAnalysis';
import { CalculatorContext } from '../../context/CalculatorContext';

describe('BalanceAnalysis Component', () => {
  it('renders optimal pathway status and electrolytes', () => {
    const mockContextValue = {
      totals: { glucoseRatio: 50, fructoseRatio: 50 },
      duration: 120,
      targetCarbs: 80,
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

    expect(screen.getByText('Balance Analysis')).toBeInTheDocument();
    expect(screen.getByText('160g')).toBeInTheDocument();
    expect(screen.getByText('Sodium Match')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Optimal')).toBeInTheDocument();
    expect(screen.getByText('Ratio (1:1)')).toBeInTheDocument();
  });

  it('renders overloaded pathways', () => {
    const mockContextValue = {
      totals: { glucoseRatio: 70, fructoseRatio: 30 },
      duration: 60,
      targetCarbs: 100,
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

    expect(screen.getByText('SGLT1 Overload')).toBeInTheDocument();
  });
});
