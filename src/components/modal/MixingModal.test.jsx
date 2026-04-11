import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MixingModal from './MixingModal';
import { CalculatorContext } from '../../context/CalculatorContext';

describe('MixingModal', () => {
  const mockGetDisplayValue = (val) => Math.round(val).toString();

  const defaultMockContext = {
    isMixingModalOpen: true,
    setIsMixingModalOpen: vi.fn(),
    duration: 120,
    targetCarbs: 60,
    getDisplayValue: mockGetDisplayValue,
    glucoseSources: [
      { id: 'maltodextrin', name: 'Maltodextrin', percentage: 100 }
    ],
    fructoseSources: [
      { id: 'fructose', name: 'Fructose', percentage: 100 }
    ],
    electrolyteSources: [
      { id: 'sodium', name: 'Sodium Citrate', amount: 500 }
    ],
    calculatedSourceGrams: {
      finalGrams: {
        'Maltodextrin': 80,
        'Fructose': 40
      }
    }
  };

  const renderComponent = (contextProps = {}) => {
    return render(
      <CalculatorContext.Provider value={{ ...defaultMockContext, ...contextProps }}>
        <MixingModal />
      </CalculatorContext.Provider>
    );
  };

  it('does not render when isOpen is false', () => {
    renderComponent({ isMixingModalOpen: false });
    expect(screen.queryByText(/DIY Mix Instructions/i)).not.toBeInTheDocument();
  });

  it('renders modal content when open', () => {
    renderComponent();
    expect(screen.getByText(/DIY Mix Instructions/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Carbs:/i)).toBeInTheDocument();
    expect(screen.getByText(/120g/i)).toBeInTheDocument(); // 120 / 60 * 60 = 120g
    
    // Ingredients
    expect(screen.getByText(/80g Maltodextrin/i)).toBeInTheDocument();
    expect(screen.getByText(/40g Fructose/i)).toBeInTheDocument();
    expect(screen.getByText(/500mg Sodium Citrate/i)).toBeInTheDocument();
  });

  it('calls setIsMixingModalOpen(false) when close button is clicked', () => {
    renderComponent();
    const closeButtons = screen.getAllByRole('button');
    // Top close button
    fireEvent.click(closeButtons[0]);
    expect(defaultMockContext.setIsMixingModalOpen).toHaveBeenCalledWith(false);
  });

  it('calls setIsMixingModalOpen(false) when "Got It" button is clicked', () => {
    renderComponent();
    const gotItButton = screen.getByText('Got It');
    fireEvent.click(gotItButton);
    expect(defaultMockContext.setIsMixingModalOpen).toHaveBeenCalledWith(false);
  });
});
