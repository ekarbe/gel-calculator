import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ElectrolytesHydration from './ElectrolytesHydration';
import { CalculatorContext } from '../../context/CalculatorContext';

describe('ElectrolytesHydration Component', () => {
  const defaultMockContext = {
    electrolyteSources: [
      { id: 1, name: 'Sodium Citrate', amount: 500 }
    ],
    addSource: vi.fn(),
    updateSource: vi.fn(),
    removeSource: vi.fn(),
    isSweatRate: true,
    setIsSweatRate: vi.fn(),
    sweatRate: 2,
    setSweatRate: vi.fn(),
    saltiness: 2,
    setSaltiness: vi.fn(),
    activeElectrolytes: { Sodium: true, Chloride: true, Potassium: false, Magnesium: false, Calcium: false },
    setActiveElectrolytes: vi.fn(),
    manualTargets: { Sodium: 0 },
    setManualTargets: vi.fn(),
    targetAmountsPerHour: { Sodium: 800, Chloride: 500 },
    autoFillElectrolytes: vi.fn(),
  };

  const renderComponent = (contextProps = {}) => {
    return render(
      <CalculatorContext.Provider value={{ ...defaultMockContext, ...contextProps }}>
        <ElectrolytesHydration />
      </CalculatorContext.Provider>
    );
  };

  it('renders correctly', () => {
    renderComponent();
    expect(screen.getByText('Electrolytes & Hydration')).toBeInTheDocument();
    expect(screen.getByText('Sweat Profile')).toBeInTheDocument();
    expect(screen.getByText('Manual Targets')).toBeInTheDocument();
    expect(screen.getByDisplayValue('500')).toBeInTheDocument(); // amount
  });

  it('toggles target expansion and shows targets', () => {
    renderComponent();
    fireEvent.click(screen.getByText('Electrolyte Targets (per hour)'));
    expect(screen.getByText('800 mg')).toBeInTheDocument(); // Sodium target
  });

  it('calls autoFillElectrolytes when Auto-Fill is clicked', () => {
    renderComponent();
    fireEvent.click(screen.getByText('Auto-Fill'));
    expect(defaultMockContext.autoFillElectrolytes).toHaveBeenCalled();
  });

  it('calls setIsSweatRate when profile/manual buttons are clicked', () => {
    renderComponent();
    fireEvent.click(screen.getByText('Manual Targets'));
    expect(defaultMockContext.setIsSweatRate).toHaveBeenCalledWith(false);
  });
});
