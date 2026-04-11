import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Page from './page';

// Mock the App component
vi.mock('./app', () => {
  return {
    default: () => <div data-testid="mock-app">Mock App</div>,
  };
});

describe('Page Component', () => {
  it('renders the CalculatorProvider and App', () => {
    const { getByTestId, container } = render(<Page />);
    
    expect(getByTestId('mock-app')).toBeInTheDocument();
    expect(container.querySelector('main')).toHaveClass('min-h-screen');
  });
});
