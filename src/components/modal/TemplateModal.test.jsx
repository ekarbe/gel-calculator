import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TemplateModal from './TemplateModal';
import { CalculatorContext } from '../../context/CalculatorContext';
import { TEMPLATES } from '../../constants/constants';

vi.mock('../../constants/constants', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    TEMPLATES: [
      {
        name: 'Test Template 1',
        description: 'A test template description',
        glucoseParts: 1,
        fructoseParts: 0.8,
        glucoseSources: [{ id: 'malto' }],
        fructoseSources: [{ id: 'fructose' }],
        electrolyteSources: [{ id: 'sodium' }],
        otherIngredients: 'None',
        nutrition: 'Nutrition info 1'
      },
      {
        name: 'Test Template 2',
        description: 'Another test template',
        glucoseParts: 1,
        fructoseParts: 1,
        glucoseSources: [{ id: 'glucose' }],
        fructoseSources: [{ id: 'fructose' }],
        electrolyteSources: [],
        otherIngredients: 'Caffeine',
        nutrition: 'Nutrition info 2'
      }
    ],
    sourceDataByIdMap: new Map([
      ['malto', { label: 'Maltodextrin' }],
      ['glucose', { label: 'Glucose' }],
      ['fructose', { label: 'Fructose' }],
      ['sodium', { label: 'Sodium' }]
    ])
  };
});

describe('TemplateModal', () => {
  const defaultMockContext = {
    isTemplateModalOpen: true,
    setIsTemplateModalOpen: vi.fn(),
    applyTemplate: vi.fn(),
  };

  const renderComponent = (contextProps = {}) => {
    return render(
      <CalculatorContext.Provider value={{ ...defaultMockContext, ...contextProps }}>
        <TemplateModal />
      </CalculatorContext.Provider>
    );
  };

  it('does not render when isOpen is false', () => {
    renderComponent({ isTemplateModalOpen: false });
    expect(screen.queryByText(/Pre-Mix Templates/i)).not.toBeInTheDocument();
  });

  it('renders templates from constants', () => {
    renderComponent();
    expect(screen.getByText('Pre-Mix Templates')).toBeInTheDocument();
    expect(screen.getByText('Test Template 1')).toBeInTheDocument();
    expect(screen.getByText('Test Template 2')).toBeInTheDocument();
    
    expect(screen.getByText(/Ratio 1:0.8/)).toBeInTheDocument();
    expect(screen.getByText(/Ratio 1:1/)).toBeInTheDocument();
    
    expect(screen.getByText('A test template description')).toBeInTheDocument();
    expect(screen.getByText('Another test template')).toBeInTheDocument();

    expect(screen.getByText(/Maltodextrin, Fructose, Sodium/)).toBeInTheDocument();
    expect(screen.getByText(/Glucose, Fructose/)).toBeInTheDocument();
  });

  it('calls applyTemplate when a template is clicked', () => {
    renderComponent();
    const templateButton = screen.getByText('Test Template 1').closest('button');
    fireEvent.click(templateButton);
    
    // Expect the first template from mocked TEMPLATES to be passed
    expect(defaultMockContext.applyTemplate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Test Template 1'
    }));
  });

  it('calls setIsTemplateModalOpen on close button click', () => {
    renderComponent();
    const closeButtons = screen.getAllByRole('button');
    fireEvent.click(closeButtons[0]);
    expect(defaultMockContext.setIsTemplateModalOpen).toHaveBeenCalledWith(false);
  });
});
