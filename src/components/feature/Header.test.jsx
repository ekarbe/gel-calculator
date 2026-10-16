import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Header from './Header';
import { PlanProvider } from '../../state/PlanProvider';
import { UiProvider, useUi, RECIPES_MODAL, SHARE_MODAL, TEMPLATE_MODAL } from '../../state/UiProvider';

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

/** The header with the real providers (autosave off, so no test sees another's inputs). */
function renderHeader() {
  return render(
    <PlanProvider persist={false}>
      <UiProvider>
        <Header />
        <UiProbe />
      </UiProvider>
    </PlanProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Header', () => {
  it('renders the brand, the theme toggle and the three buttons', () => {
    renderHeader();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Gel-Calculator' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
    const buttons = [
      ['My recipes', 'header-recipes'],
      ['Templates', 'header-templates'],
      ['Share Link', 'header-share'],
    ];
    for (const [name, id] of buttons) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveAttribute('id', id);
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('aria-haspopup', 'dialog');
      // The text is hidden on phones; the aria-label keeps the name.
      expect(button).toHaveAttribute('aria-label', name);
      expect(button).toHaveTextContent(name);
    }
  });

  it('opens the saved recipes modal', () => {
    renderHeader();
    expect(screen.getByTestId('modal')).toHaveTextContent('none');
    fireEvent.click(screen.getByRole('button', { name: 'My recipes' }));
    expect(screen.getByTestId('modal')).toHaveTextContent(RECIPES_MODAL);
  });

  it('opens the templates modal', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
    expect(screen.getByTestId('modal')).toHaveTextContent(TEMPLATE_MODAL);
  });

  it('opens the share modal on its menu view', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Show image view' }));
    expect(screen.getByTestId('share-view')).toHaveTextContent('image');

    fireEvent.click(screen.getByRole('button', { name: 'Share Link' }));
    expect(screen.getByTestId('modal')).toHaveTextContent(SHARE_MODAL);
    expect(screen.getByTestId('share-view')).toHaveTextContent('menu');
  });

  it('switches from one modal to another (only one is open at a time)', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
    fireEvent.click(screen.getByRole('button', { name: 'My recipes' }));
    expect(screen.getByTestId('modal')).toHaveTextContent(RECIPES_MODAL);
    fireEvent.click(screen.getByRole('button', { name: 'Share Link' }));
    expect(screen.getByTestId('modal')).toHaveTextContent(SHARE_MODAL);
  });

  it('needs a UiProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Header />)).toThrow(/UiProvider/);
  });
});
