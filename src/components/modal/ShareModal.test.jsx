import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import ShareModal, { buildShareUrl } from './ShareModal';
import { PlanProvider, usePlanInputs } from '../../state/PlanProvider';
import { UiProvider, useUi, SHARE_MODAL } from '../../state/UiProvider';
import { decodeShareState, encodeShareState } from '../../state/shareCodec';
import { normalizeInputs } from '../../domain/plan';

const image = vi.hoisted(() => ({ toPng: vi.fn() }));
vi.mock('html-to-image', () => ({ toPng: image.toPng }));

/** Opens the modal, edits an input, and shows the UI state. */
function Controls() {
  const { openModal, modal, toastMessage } = useUi();
  const { set } = usePlanInputs();
  return (
    <>
      <button type="button" onClick={() => openModal(SHARE_MODAL)}>
        Open share
      </button>
      <button type="button" onClick={() => set('event.durationMin', 240)}>
        Make it 4 h
      </button>
      <span data-testid="modal">{modal ?? 'none'}</span>
      <span data-testid="toast">{toastMessage}</span>
    </>
  );
}

function renderModal(initialInputs, { open = true } = {}) {
  const result = render(
    <UiProvider>
      <PlanProvider initialInputs={initialInputs}>
        <Controls />
        <ShareModal />
      </PlanProvider>
    </UiProvider>,
  );
  if (open) fireEvent.click(screen.getByRole('button', { name: 'Open share' }));
  return result;
}

const dialog = (name = 'Share Recipe') => screen.getByRole('dialog', { name });
const copyButton = () => within(dialog()).getByRole('button', { name: /Copy Link/ });
const sharedInputs = (url) => decodeShareState(new URL(url).searchParams.get('s'));

describe('ShareModal', () => {
  let writeText;

  beforeEach(() => {
    vi.clearAllMocks();
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  afterEach(() => {
    delete navigator.clipboard;
  });

  it('stays closed until the share modal is opened', () => {
    renderModal(undefined, { open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open share' }));
    expect(dialog()).toHaveAttribute('aria-modal', 'true');
  });

  it('starts on the menu', () => {
    renderModal();
    expect(within(dialog()).getByRole('button', { name: /Copy Link/ })).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: /Generate Image/ })).toBeInTheDocument();
  });

  it('copies a v3 share link with the current inputs', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Make it 4 h' }));
    fireEvent.click(copyButton());
    await waitFor(() => expect(screen.getByTestId('toast')).toHaveTextContent('Recipe link copied!'));
    expect(writeText).toHaveBeenCalledTimes(1);
    const url = writeText.mock.calls[0][0];
    expect(new URL(url).searchParams.get('s')).toBe(encodeShareState({ event: { durationMin: 240 } }));
    expect(sharedInputs(url)).toEqual(normalizeInputs({ event: { durationMin: 240 } }));
    expect(screen.getByTestId('modal')).toHaveTextContent('none');
  });

  it('encodes the default inputs as the minimal payload', () => {
    const url = buildShareUrl(normalizeInputs({}));
    const payload = new URL(url).searchParams.get('s');
    expect(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).toBe('{"v":3}');
    expect(sharedInputs(url)).toEqual(normalizeInputs({}));
  });

  it('falls back to execCommand when the Clipboard API fails', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;
    try {
      renderModal({ format: { gelsPerHour: 2 } });
      fireEvent.click(copyButton());
      await waitFor(() => expect(screen.getByTestId('toast')).toHaveTextContent('Recipe link copied!'));
      expect(execCommand).toHaveBeenCalledWith('copy');
      expect(document.querySelector('textarea')).toBeNull();
    } finally {
      delete document.execCommand;
    }
  });

  it('keeps the modal open and says so when the link cannot be copied', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    renderModal();
    fireEvent.click(copyButton());
    await waitFor(() => expect(screen.getByTestId('toast')).toHaveTextContent('Could not copy the link.'));
    expect(screen.getByTestId('modal')).toHaveTextContent('share');
  });

  it('shows the recipe image from the plan and recipe items', () => {
    renderModal();
    fireEvent.click(within(dialog()).getByRole('button', { name: /Generate Image/ }));
    const img = within(dialog('Recipe Image')).getByTestId('share-image');
    expect(within(img).getByText('TOTAL CARBS').nextSibling).toHaveTextContent('225g');
    expect(within(img).getByText('CARBS/HR').nextSibling).toHaveTextContent('75g');
    expect(within(img).getByText('RATIO').nextSibling).toHaveTextContent('1:0.5');
    expect(within(img).getByText('Sodium 570 mg/h · Fluid 800 ml/h')).toBeInTheDocument();
    expect(within(img).getByText('Total batch · 3 h · 9 gels')).toBeInTheDocument();
    const lines = within(within(img).getByRole('list', { name: 'Recipe' }))
      .getAllByRole('listitem')
      .map((li) => [li.firstChild.textContent, li.lastChild.textContent]);
    expect(lines).toEqual([
      ['Maltodextrin', '158 g'],
      ['Crystalline Fructose', '75 g'],
      ['Sodium Chloride (Table Salt)', '4.4 g'],
    ]);
  });

  it('shows the carbs the recipe delivers and why when the sources cannot make the ratio', () => {
    renderModal({ carbs: { fructoseSources: [] } });
    fireEvent.click(within(dialog()).getByRole('button', { name: /Generate Image/ }));
    const img = within(dialog('Recipe Image')).getByTestId('share-image');
    expect(within(img).getByText('TOTAL CARBS').nextSibling).toHaveTextContent('0g');
    const warnings = within(img).getByRole('list', { name: 'Warnings' });
    expect(warnings).toHaveTextContent(/cannot make a 1:0.5 glucose to fructose mix/);
  });

  it('shows no recipe warning on the image for a plan the sources can make', () => {
    renderModal();
    fireEvent.click(within(dialog()).getByRole('button', { name: /Generate Image/ }));
    const img = within(dialog('Recipe Image')).getByTestId('share-image');
    expect(within(img).queryByRole('list', { name: 'Warnings' })).not.toBeInTheDocument();
  });

  it('shows per-gel amounts and caffeine lines on the image', () => {
    renderModal({ format: { view: 'perGel' }, caffeine: { enabled: true, asIngredient: true } });
    fireEvent.click(within(dialog()).getByRole('button', { name: /Generate Image/ }));
    const img = within(dialog('Recipe Image')).getByTestId('share-image');
    expect(within(img).getByText('Per gel · 9 gels in total')).toBeInTheDocument();
    expect(within(img).getByText('Sodium 570 mg/h · Fluid 800 ml/h · Caffeine 200 mg')).toBeInTheDocument();
    const caffeineLine = within(img).getByText('Caffeine for gel 7: 0.5 × 100 mg tablet').closest('li');
    expect(caffeineLine).toHaveClass('text-apple-amber-ink');
    expect(caffeineLine).toHaveTextContent('50 mg');
    expect(within(img).getByText('18 g')).toBeInTheDocument();
  });

  it('goes back to the menu', () => {
    renderModal();
    fireEvent.click(within(dialog()).getByRole('button', { name: /Generate Image/ }));
    fireEvent.click(within(dialog('Recipe Image')).getByRole('button', { name: 'Back' }));
    expect(dialog()).toBeInTheDocument();
  });

  it('downloads the image and closes', async () => {
    image.toPng.mockResolvedValue('data:image/png;base64,abc');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderModal();
    fireEvent.click(within(dialog()).getByRole('button', { name: /Generate Image/ }));
    const img = within(dialog('Recipe Image')).getByTestId('share-image');
    fireEvent.click(within(dialog('Recipe Image')).getByRole('button', { name: /Download/ }));
    await waitFor(() => expect(screen.getByTestId('toast')).toHaveTextContent('Image downloaded successfully!'));
    expect(image.toPng).toHaveBeenCalledWith(img, expect.objectContaining({ pixelRatio: 2 }));
    expect(click).toHaveBeenCalled();
    expect(screen.getByTestId('modal')).toHaveTextContent('none');
    click.mockRestore();
  });

  it('reports a failed image', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    image.toPng.mockRejectedValue(new Error('canvas'));
    renderModal();
    fireEvent.click(within(dialog()).getByRole('button', { name: /Generate Image/ }));
    fireEvent.click(within(dialog('Recipe Image')).getByRole('button', { name: /Download/ }));
    await waitFor(() => expect(screen.getByTestId('toast')).toHaveTextContent('Failed to generate image.'));
    expect(screen.getByTestId('modal')).toHaveTextContent('share');
    error.mockRestore();
  });

  it('gives every control an id and a label in both views', () => {
    renderModal();
    const check = (scope) => {
      const controls = scope.querySelectorAll('input, select, textarea, button');
      expect(controls.length).toBeGreaterThan(0);
      for (const control of controls) {
        expect(control.id).not.toBe('');
        expect(control).toHaveAccessibleName();
      }
    };
    check(dialog());
    fireEvent.click(within(dialog()).getByRole('button', { name: /Generate Image/ }));
    check(dialog('Recipe Image'));
  });

  it('closes with the close button and reopens on the menu', () => {
    renderModal();
    fireEvent.click(within(dialog()).getByRole('button', { name: /Generate Image/ }));
    fireEvent.click(within(dialog('Recipe Image')).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open share' }));
    expect(dialog('Share Recipe')).toBeInTheDocument();
  });

  it('closes on a backdrop click and on Escape, not on a click inside', () => {
    renderModal();
    fireEvent.click(dialog());
    expect(dialog()).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('share-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open share' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
