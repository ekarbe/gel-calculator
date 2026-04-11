import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Header from './Header';
import { CalculatorContext } from '../../context/CalculatorContext';

describe('Header Component', () => {
  it('renders the title and buttons', () => {
    const mockContextValue = {
      onOpenTemplates: vi.fn(),
      onOpenShare: vi.fn(),
    };

    render(
      <CalculatorContext.Provider value={mockContextValue}>
        <Header />
      </CalculatorContext.Provider>
    );

    // Title should be present
    expect(screen.getByText('Gel-Calculator')).toBeInTheDocument();
    
    // Buttons should be present
    expect(screen.getByText('Templates')).toBeInTheDocument();
    expect(screen.getByText('Share Link')).toBeInTheDocument();
  });

  it('calls context update functions on button click', () => {
    const mockContextValue = {
      onOpenTemplates: vi.fn(),
      onOpenShare: vi.fn(),
    };

    render(
      <CalculatorContext.Provider value={mockContextValue}>
        <Header />
      </CalculatorContext.Provider>
    );

    const templatesBtn = screen.getByRole('button', { name: /Templates/i });
    const shareBtn = screen.getByRole('button', { name: /Share Link/i });

    fireEvent.click(templatesBtn);
    expect(mockContextValue.onOpenTemplates).toHaveBeenCalled();

    fireEvent.click(shareBtn);
    expect(mockContextValue.onOpenShare).toHaveBeenCalled();
  });
});
