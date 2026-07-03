import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FinalRecipe from './FinalRecipe';
import { CalculatorContext } from '../../context/CalculatorContext';

describe('FinalRecipe Component', () => {
  const mockGetDisplayValue = (val) => Math.round(val).toString();

  const defaultMockContext = {
    recipeRef: { current: null },
    recipeView: 'total',
    setRecipeView: vi.fn(),
    gelsPerHour: 2,
    setGelsPerHour: vi.fn(),
    totals: {},
    calculatedSourceGrams: {
      finalGrams: {
        'Maltodextrin': 120,
        'Fructose': 80
      }
    },
    duration: 120,
    getDisplayValue: mockGetDisplayValue,
    onOpenInstructions: vi.fn(),
    glucoseSources: [{ id: 1, name: 'Maltodextrin', percentage: 100 }],
    fructoseSources: [{ id: 2, name: 'Fructose', percentage: 100 }],
    electrolyteSources: [{ id: 3, name: 'Sodium Citrate', amount: 1000 }],
    targetCarbs: 90,
    strategy: {
      isSmartSuggestions: false,
      getCostAnalysis: () => ({ diyTotal: 1.5, savings: 5.0 })
    }
  };

  const renderComponent = (contextProps = {}) => {
    return render(
      <CalculatorContext.Provider value={{ ...defaultMockContext, ...contextProps }}>
        <FinalRecipe />
      </CalculatorContext.Provider>
    );
  };

  it('renders correctly in total view', () => {
    renderComponent();
    expect(screen.getByText('Final Recipe')).toBeInTheDocument();
    expect(screen.getByText(/Total batch for a 2.0 hour activity/)).toBeInTheDocument();
    
    // Ingredients are displayed
    expect(screen.getByText('Maltodextrin')).toBeInTheDocument();
    expect(screen.getByText('120g')).toBeInTheDocument();
    expect(screen.getByText('Fructose')).toBeInTheDocument();
    expect(screen.getByText('80g')).toBeInTheDocument();
    expect(screen.getByText('Sodium Citrate')).toBeInTheDocument();
    expect(screen.getByText('1000mg')).toBeInTheDocument();
  });

  it('renders correctly in perGel view', () => {
    renderComponent({ recipeView: 'perGel' });
    expect(screen.getByText('Gels per Hour')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    expect(screen.getByText(/Amounts to mix for one single gel flask/)).toBeInTheDocument();
  });

  it('calls setRecipeView when buttons are clicked', () => {
    renderComponent();
    fireEvent.click(screen.getByText('Per Gel'));
    expect(defaultMockContext.setRecipeView).toHaveBeenCalledWith('perGel');
    
    fireEvent.click(screen.getByText('Total Batch'));
    expect(defaultMockContext.setRecipeView).toHaveBeenCalledWith('total');
  });

  it('calls onOpenInstructions when View Mixing Instructions is clicked', () => {
    renderComponent();
    fireEvent.click(screen.getByText(/View Mixing Instructions/));
    expect(defaultMockContext.onOpenInstructions).toHaveBeenCalled();
  });
});
