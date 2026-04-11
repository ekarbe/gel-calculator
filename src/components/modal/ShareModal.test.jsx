import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ShareModal from './ShareModal';
import { CalculatorContext } from '../../context/CalculatorContext';

// Mock html-to-image to prevent canvas-related issues in JSDOM
vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,mock'),
}));

describe('ShareModal', () => {
  const mockGetDisplayValue = (val) => Math.round(val).toString();

  const defaultMockContext = {
    isShareModalOpen: true,
    setIsShareModalOpen: vi.fn(),
    shareView: 'menu',
    setShareView: vi.fn(),
    duration: 120,
    targetCarbs: 60,
    totals: {},
    getDisplayValue: mockGetDisplayValue,
    handleCopyLink: vi.fn(),
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
    },
    showToast: vi.fn(),
    glucoseParts: 1,
    fructoseParts: 0.8,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (contextProps = {}) => {
    return render(
      <CalculatorContext.Provider value={{ ...defaultMockContext, ...contextProps }}>
        <ShareModal />
      </CalculatorContext.Provider>
    );
  };

  it('does not render when isOpen is false', () => {
    renderComponent({ isShareModalOpen: false });
    expect(screen.queryByText(/Share Recipe/i)).not.toBeInTheDocument();
  });

  it('renders menu view by default', () => {
    renderComponent();
    expect(screen.getByText('Share Recipe')).toBeInTheDocument();
    expect(screen.getByText('Copy Link')).toBeInTheDocument();
    expect(screen.getByText('Generate Image')).toBeInTheDocument();
  });

  it('calls handleCopyLink when Copy Link button is clicked', () => {
    renderComponent();
    fireEvent.click(screen.getByText('Clickable web link').parentElement.parentElement);
    expect(defaultMockContext.handleCopyLink).toHaveBeenCalled();
  });

  it('changes view to image when Generate Image is clicked', () => {
    renderComponent();
    fireEvent.click(screen.getByText('Visual summary graphic').parentElement.parentElement);
    expect(defaultMockContext.setShareView).toHaveBeenCalledWith('image');
  });

  it('renders image view correctly', () => {
    renderComponent({ shareView: 'image' });
    expect(screen.getByText('Recipe Image')).toBeInTheDocument();
    expect(screen.getByText('TOTAL CARBS')).toBeInTheDocument();
    expect(screen.getByText('120g')).toBeInTheDocument(); // total carbs value

    expect(screen.getByText('Maltodextrin')).toBeInTheDocument();
    expect(screen.getByText('80g')).toBeInTheDocument();
    expect(screen.getByText('Fructose')).toBeInTheDocument();
    expect(screen.getByText('40g')).toBeInTheDocument();
    expect(screen.getByText('Sodium Citrate')).toBeInTheDocument();
    expect(screen.getByText('500mg')).toBeInTheDocument();

    expect(screen.getByText('RATIO')).toBeInTheDocument();
    expect(screen.getByText('1:0.8')).toBeInTheDocument();
  });

  it('calls setIsShareModalOpen on close button click', () => {
    renderComponent();
    const closeButton = screen.getAllByRole('button')[0];
    fireEvent.click(closeButton);
    expect(defaultMockContext.setIsShareModalOpen).toHaveBeenCalledWith(false);
  });
});
