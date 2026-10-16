import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import ShareModal from './ShareModal';
import { shareUrl } from '../shared/share';
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
      <PlanProvider initialInputs={initialInputs} persist={false}>
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
const openImage = () => {
  fireEvent.click(within(dialog()).getByRole('button', { name: /Generate Image/ }));
  return within(dialog('Recipe Image')).getByTestId('share-image');
};
/** [label, amount] of every line of a section on the image. */
const imageLines = (img, kind) =>
  within(within(img).getByTestId(`share-section-${kind}`))
    .getAllByRole('listitem')
    .map((li) => [li.firstChild.textContent, li.lastChild.textContent]);

describe('ShareModal', () => {
  let writeText;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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

  it('copies a v4 share link with the current inputs', async () => {
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
    const url = shareUrl(normalizeInputs({}));
    const payload = new URL(url).searchParams.get('s');
    expect(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).toBe('{"v":4}');
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

  it('shows the recipe image with the gel section of the plan', () => {
    renderModal();
    const img = openImage();
    expect(within(img).getByText('TOTAL CARBS').nextSibling).toHaveTextContent('225g');
    expect(within(img).getByText('CARBS/HR').nextSibling).toHaveTextContent('75g');
    expect(within(img).getByText('RATIO').nextSibling).toHaveTextContent('1:0.5');
    expect(within(img).getByText('Sodium 300 mg/h · Fluid 100 ml/h')).toBeInTheDocument();
    expect(within(img).getByTestId('share-view-caption')).toHaveTextContent('Total · 3 h');
    expect(within(img).queryByTestId('share-section-drink')).not.toBeInTheDocument();

    const gels = within(img).getByTestId('share-section-gel');
    expect(within(gels).getByRole('heading', { name: 'Gels' })).toBeInTheDocument();
    expect(gels).toHaveTextContent('9 gels');
    expect(gels).toHaveTextContent('Whole batch');
    expect(imageLines(img, 'gel')).toEqual([
      ['Maltodextrin', '158 g'],
      ['Crystalline Fructose', '75 g'],
      ['Sodium Chloride (Table Salt)', '2.3 g'],
      ['Warm water', '140 ml'],
    ]);
    expect(within(gels).getByTestId('share-osmolality')).toHaveTextContent(
      '≈ 4,300 mOsm/kg, likely higher · Hypertonic',
    );
  });

  it('shows both sections, per serving, on the image', () => {
    renderModal({ sweat: { source: 'preset' }, format: { type: 'both', view: 'perServing' } });
    const img = openImage();
    expect(within(img).getByTestId('share-view-caption')).toHaveTextContent('Per serving');
    expect(within(img).getByText('Sodium 570 mg/h · Fluid 800 ml/h')).toBeInTheDocument();
    expect(within(img).getByTestId('share-section-gel')).toHaveTextContent('Per gel');
    expect(imageLines(img, 'gel')).toEqual([
      ['Maltodextrin', '8.8 g'],
      ['Crystalline Fructose', '4.2 g'],
      ['Warm water', '8 ml'],
    ]);
    const drink = within(img).getByTestId('share-section-drink');
    expect(within(drink).getByRole('heading', { name: 'Drink' })).toBeInTheDocument();
    expect(drink).toHaveTextContent('4 bottles, 600 ml each (750 ml bottle)');
    expect(drink).toHaveTextContent('Per bottle');
    expect(imageLines(img, 'drink')).toEqual([
      ['Maltodextrin', '20 g'],
      ['Crystalline Fructose', '9.4 g'],
      ['Sodium Chloride (Table Salt)', '1.1 g'],
      ['Water, to fill each bottle to 600 ml', '581 ml'],
    ]);
    expect(within(drink).getByTestId('share-osmolality')).toHaveTextContent('≈ 181 mOsm/kg · Hypotonic');
  });

  it('shows the carbs the recipe delivers and why when there is no carb ingredient', () => {
    renderModal({ carbs: { ingredients: [] } });
    const img = openImage();
    expect(within(img).getByText('TOTAL CARBS').nextSibling).toHaveTextContent('0g');
    const warnings = within(img).getByRole('list', { name: 'Warnings' });
    expect(warnings).toHaveTextContent('Add at least one carb ingredient.');
    // No carbs means no gels: the salt goes into the drink, and there is no delivered ratio.
    expect(within(img).queryByTestId('share-section-gel')).not.toBeInTheDocument();
    expect(imageLines(img, 'drink')[0]).toEqual(['Sodium Chloride (Table Salt)', '2.3 g']);
    expect(within(img).getByText('RATIO').nextSibling).toHaveTextContent('0:0');
  });

  it('writes the salt lines in an ink that reads on the white image', () => {
    renderModal({ sweat: { source: 'preset' }, format: { type: 'drink' } });
    const img = openImage();
    const salt = within(within(img).getByTestId('share-section-drink')).getByText('Sodium Chloride (Table Salt)').closest('li');
    expect(salt).toHaveClass('text-teal-700', 'dark:text-apple-teal');
    expect(salt).not.toHaveClass('text-apple-teal');
  });

  it('shows the ratio the recipe delivers when the ingredients cannot make the target', () => {
    renderModal({
      carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 1 }, ingredients: [{ ref: 3, weight: 100 }] },
    });
    const img = openImage();
    expect(within(img).getByText('RATIO').nextSibling).toHaveTextContent('1:0');
    expect(within(img).getByRole('list', { name: 'Warnings' })).toHaveTextContent(
      'Your ingredients cannot make 1:1 glucose to fructose.',
    );
  });

  it('shows no recipe warning on the image for a plan the ingredients can make', () => {
    renderModal();
    const img = openImage();
    expect(within(img).queryByRole('list', { name: 'Warnings' })).not.toBeInTheDocument();
  });

  it('shows per-gel amounts and caffeine lines on the image', () => {
    renderModal({ format: { view: 'perServing' }, caffeine: { enabled: true, asIngredient: true } });
    const img = openImage();
    expect(within(img).getByText('Sodium 300 mg/h · Fluid 100 ml/h · Caffeine 200 mg')).toBeInTheDocument();
    const caffeineLine = within(img).getByText('Caffeine for gel 7 (100 mg tablets)').closest('li');
    expect(caffeineLine).toHaveClass('text-apple-amber-ink');
    expect(caffeineLine).toHaveTextContent('0.5 tablets');
    expect(imageLines(img, 'gel')[0]).toEqual(['Maltodextrin', '18 g']);
    expect(within(img).getByRole('list', { name: 'Warnings' })).toHaveTextContent(/Never use pure caffeine powder/);
  });

  it('says there is nothing to mix on an empty recipe image', () => {
    renderModal({ event: { durationMin: 30 }, sodium: { mode: 'manual', manualMgPerHour: 0 } });
    const img = openImage();
    expect(within(img).getByText('Nothing to mix for this plan.')).toBeInTheDocument();
    expect(within(img).queryByTestId('share-section-gel')).not.toBeInTheDocument();
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
