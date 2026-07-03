import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import App from './app';

// Mock useCalculatorContext
vi.mock('../context/CalculatorContext', () => ({
  useCalculatorContext: () => ({}),
}));

// Mock all child components to isolate App testing
vi.mock('../components/feature/Header', () => ({ default: () => <div data-testid="header" /> }));
vi.mock('../components/feature/ActivityBasics', () => ({ default: () => <div data-testid="activity-basics" /> }));
vi.mock('../components/feature/CarbMatrix', () => ({ default: () => <div data-testid="carb-matrix" /> }));
vi.mock('../components/feature/ElectrolytesHydration', () => ({ default: () => <div data-testid="electrolytes-hydration" /> }));
vi.mock('../components/feature/BalanceAnalysis', () => ({ default: () => <div data-testid="balance-analysis" /> }));
vi.mock('../components/feature/VisualTimeline', () => ({ default: () => <div data-testid="visual-timeline" /> }));
vi.mock('../components/feature/FinalRecipe', () => ({ default: () => <div data-testid="final-recipe" /> }));
vi.mock('../components/shared/Footer', () => ({ default: () => <div data-testid="footer" /> }));
vi.mock('../components/feature/MobileStickyBar', () => ({ default: () => <div data-testid="mobile-sticky-bar" /> }));
vi.mock('../components/modal/MixingModal', () => ({ default: () => <div data-testid="mixing-modal" /> }));
vi.mock('../components/modal/TemplateModal', () => ({ default: () => <div data-testid="template-modal" /> }));
vi.mock('../components/modal/ShareModal', () => ({ default: () => <div data-testid="share-modal" /> }));
vi.mock('../components/shared/Toast', () => ({ default: () => <div data-testid="toast" /> }));

describe('App Component', () => {
  it('renders all main sections and components', () => {
    const { getByTestId } = render(<App />);

    expect(getByTestId('header')).toBeInTheDocument();
    expect(getByTestId('activity-basics')).toBeInTheDocument();
    expect(getByTestId('carb-matrix')).toBeInTheDocument();
    expect(getByTestId('electrolytes-hydration')).toBeInTheDocument();
    expect(getByTestId('visual-timeline')).toBeInTheDocument();
    expect(getByTestId('balance-analysis')).toBeInTheDocument();
    expect(getByTestId('final-recipe')).toBeInTheDocument();
    expect(getByTestId('footer')).toBeInTheDocument();
    expect(getByTestId('mobile-sticky-bar')).toBeInTheDocument();
    
    // Modals
    expect(getByTestId('mixing-modal')).toBeInTheDocument();
    expect(getByTestId('template-modal')).toBeInTheDocument();
    expect(getByTestId('share-modal')).toBeInTheDocument();
    
    // Toast
    expect(getByTestId('toast')).toBeInTheDocument();
  });
});
