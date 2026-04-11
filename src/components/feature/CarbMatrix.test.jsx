import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CarbMatrix from './CarbMatrix';
import { CalculatorContext } from '../../context/CalculatorContext';

describe('CarbMatrix Component', () => {
  const defaultMockContext = {
    glucoseParts: 1.0,
    setGlucoseParts: vi.fn(),
    fructoseParts: 0.8,
    setFructoseParts: vi.fn(),
    glucoseSources: [
      { id: 1, name: 'Maltodextrin', percentage: 100 }
    ],
    fructoseSources: [
      { id: 2, name: 'Crystalline Fructose', percentage: 100 }
    ],
    addSource: vi.fn(),
    updateSource: vi.fn(),
    removeSource: vi.fn(),
    calculatedSourceGrams: { canAchieveRatio: true },
  };

  const renderComponent = (contextProps = {}) => {
    return render(
      <CalculatorContext.Provider value={{ ...defaultMockContext, ...contextProps }}>
        <CarbMatrix />
      </CalculatorContext.Provider>
    );
  };

  it('renders correctly', () => {
    renderComponent();
    expect(screen.getByText('Carbohydrate Matrix')).toBeInTheDocument();
    expect(screen.getByText(/Target:/)).toBeInTheDocument();
    expect(screen.getByText('1.00 : 0.80')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Maltodextrin')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Crystalline Fructose')).toBeInTheDocument();
  });

  it('calls addSource when Add button is clicked', () => {
    renderComponent();
    const addButtons = screen.getAllByText('Add');
    fireEvent.click(addButtons[0]); // Glucose add
    expect(defaultMockContext.addSource).toHaveBeenCalledWith('glucose');
    
    fireEvent.click(addButtons[1]); // Fructose add
    expect(defaultMockContext.addSource).toHaveBeenCalledWith('fructose');
  });

  it('displays warning when ratio cannot be achieved', () => {
    renderComponent({ calculatedSourceGrams: { canAchieveRatio: false } });
    expect(screen.getByText(/Warning:/)).toBeInTheDocument();
  });
});
