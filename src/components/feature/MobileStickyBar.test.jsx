import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileStickyBar from './MobileStickyBar';
import { CalculatorContext } from '../../context/CalculatorContext';

describe('MobileStickyBar Component', () => {
  it('renders target carbs and ratio correctly', () => {
    const mockContextValue = {
      totals: { glucoseRatio: 50, fructoseRatio: 50 },
      duration: 120,
      targetCarbs: 80,
      scrollToRecipe: vi.fn(),
      electrolyteAnalysis: {
        Sodium: { percentage: 100 }
      },
      glucoseParts: 1,
      fructoseParts: 1,
      activeElectrolytes: { Sodium: true, Chloride: false, Potassium: false, Magnesium: false, Calcium: false }
    };

    render(
      <CalculatorContext.Provider value={mockContextValue}>
        <MobileStickyBar />
      </CalculatorContext.Provider>
    );

    expect(screen.getByText(/Target: 160g/)).toBeInTheDocument();
    expect(screen.getByText(/1:1/)).toBeInTheDocument();
    expect(screen.getByText(/Na\+:/)).toBeInTheDocument();
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it('calls scrollToRecipe when button is clicked', () => {
    const scrollToRecipeMock = vi.fn();
    const mockContextValue = {
      totals: { glucoseRatio: 50, fructoseRatio: 50 },
      duration: 120,
      targetCarbs: 80,
      scrollToRecipe: scrollToRecipeMock,
      electrolyteAnalysis: {},
      glucoseParts: 1,
      fructoseParts: 1,
      activeElectrolytes: {}
    };

    render(
      <CalculatorContext.Provider value={mockContextValue}>
        <MobileStickyBar />
      </CalculatorContext.Provider>
    );

    const button = screen.getByRole('button', { name: /Recipe/i });
    fireEvent.click(button);
    expect(scrollToRecipeMock).toHaveBeenCalledTimes(1);
  });
});
