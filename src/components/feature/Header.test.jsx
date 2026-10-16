import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Header from './Header';
import { UiProvider, useUi } from '../../state/UiProvider';

/** Shows the UI state the header changes, plus a control to move the share modal off its first view. */
function UiProbe() {
  const { modal, shareView, setShareView } = useUi();
  return (
    <div>
      <output data-testid="modal">{modal ?? 'none'}</output>
      <output data-testid="share-view">{shareView}</output>
      <button type="button" onClick={() => setShareView('image')}>
        Show image view
      </button>
    </div>
  );
}

function renderHeader() {
  return render(
    <UiProvider>
      <Header />
      <UiProbe />
    </UiProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Header', () => {
  it('renders the brand, the theme toggle and the two buttons', () => {
    renderHeader();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Gel-Calculator' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
    const templates = screen.getByRole('button', { name: 'Templates' });
    const share = screen.getByRole('button', { name: 'Share Link' });
    expect(templates).toHaveAttribute('aria-haspopup', 'dialog');
    expect(share).toHaveAttribute('aria-haspopup', 'dialog');
    expect(templates).toHaveAttribute('type', 'button');
    expect(share).toHaveAttribute('type', 'button');
  });

  it('opens the templates modal', () => {
    renderHeader();
    expect(screen.getByTestId('modal')).toHaveTextContent('none');
    fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
    expect(screen.getByTestId('modal')).toHaveTextContent('templates');
  });

  it('opens the share modal on its menu view', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Show image view' }));
    expect(screen.getByTestId('share-view')).toHaveTextContent('image');

    fireEvent.click(screen.getByRole('button', { name: 'Share Link' }));
    expect(screen.getByTestId('modal')).toHaveTextContent('share');
    expect(screen.getByTestId('share-view')).toHaveTextContent('menu');
  });

  it('switches from one modal to the other (only one is open at a time)', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share Link' }));
    expect(screen.getByTestId('modal')).toHaveTextContent('share');
  });

  it('needs a UiProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Header />)).toThrow(/UiProvider/);
  });
});
