import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShareDialog from './ShareDialog';
import { shareUrl } from './share';
import { laneTexts, renderDialog } from './testUtils';
import { SHARE_MODAL } from '../../state/UiProvider';
import { decodeShareState, encodeShareState } from '../../state/shareCodec';
import { normalizeInputs } from '../../domain/plan';

const image = vi.hoisted(() => ({ toPng: vi.fn() }));
vi.mock('html-to-image', () => ({ toPng: image.toPng }));

const OPEN = 'Open share';

function renderShare(initialInputs, options = {}) {
  return renderDialog(<ShareDialog />, { modal: SHARE_MODAL, openLabel: OPEN, initialInputs, ...options });
}

const dialog = (name = 'Share') => screen.getByRole('dialog', { name });
const copyButton = (name) => within(dialog(name)).getByRole('button', { name: 'Copy link' });
const sharedInputs = (url) => decodeShareState(new URL(url).searchParams.get('s'));
const toast = () => screen.getByTestId('toast');
const openImage = () => {
  fireEvent.click(within(dialog()).getByRole('button', { name: 'Make an image' }));
  return within(dialog('Recipe image')).getByTestId('share-image');
};
/** The headline numbers of the image, by caption. */
const stats = (img) => {
  const terms = within(img).getAllByRole('term').map((dt) => dt.textContent);
  const values = within(img).getAllByRole('definition').map((dd) => dd.textContent);
  return Object.fromEntries(terms.map((term, i) => [term, values[i]]));
};
/** [label, amount] of every line of a section on the image. */
const imageLines = (img, kind) =>
  laneTexts(within(within(img).getByTestId(`share-section-${kind}`)).getByRole('list'));

describe('ShareDialog', () => {
  let writeText;

  beforeEach(() => {
    vi.clearAllMocks();
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  afterEach(() => {
    delete navigator.clipboard;
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('stays closed until the share dialog is opened, then opens as a modal dialog', () => {
    renderShare(undefined, { open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: OPEN }));
    expect(dialog().tagName).toBe('DIALOG');
    expect(dialog()).toHaveAccessibleDescription('Send this plan as a link, or save a picture of the recipe.');
  });

  it('starts on the menu with the share link, Copy link and Make an image', () => {
    renderShare({ event: { durationMin: 240 } });
    const link = within(dialog()).getByLabelText('Share link');
    expect(link).toHaveAttribute('readonly');
    expect(link).toHaveAccessibleDescription(/Opens this plan with all its inputs/);
    expect(sharedInputs(link.value)).toEqual(normalizeInputs({ event: { durationMin: 240 } }));
    expect(copyButton()).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: 'Make an image' })).toBeInTheDocument();
  });

  it('copies a v4 share link with the current inputs, closes and confirms', async () => {
    renderShare();
    fireEvent.click(screen.getByRole('button', { name: 'Make it 4 h' }));
    fireEvent.click(copyButton());
    await waitFor(() => expect(toast()).toHaveTextContent('Recipe link copied.'));
    expect(toast()).toHaveAttribute('data-tone', 'ok');
    expect(writeText).toHaveBeenCalledTimes(1);
    const url = writeText.mock.calls[0][0];
    expect(new URL(url).searchParams.get('s')).toBe(encodeShareState({ event: { durationMin: 240 } }));
    expect(sharedInputs(url)).toEqual(normalizeInputs({ event: { durationMin: 240 } }));
    expect(screen.getByTestId('modal')).toHaveTextContent('none');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('builds the link on the current page, keeping other parameters', () => {
    window.history.replaceState(null, '', '/gel-calculator/?x=1');
    const inputs = normalizeInputs({ event: { durationMin: 90 } });
    const url = new URL(shareUrl(inputs));
    expect(url.pathname).toBe('/gel-calculator/');
    expect(url.searchParams.get('x')).toBe('1');
    expect(decodeShareState(url.searchParams.get('s'))).toEqual(inputs);
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
      renderShare({ format: { gelsPerHour: 2 } });
      fireEvent.click(copyButton());
      await waitFor(() => expect(toast()).toHaveTextContent('Recipe link copied.'));
      expect(execCommand).toHaveBeenCalledWith('copy');
      expect(document.querySelector('textarea')).toBeNull();
    } finally {
      delete document.execCommand;
    }
  });

  it('keeps the dialog open and says so when the link cannot be copied', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    renderShare();
    fireEvent.click(copyButton());
    await waitFor(() => expect(toast()).toHaveTextContent('Could not copy the link.'));
    expect(toast()).toHaveAttribute('data-tone', 'danger');
    expect(screen.getByTestId('modal')).toHaveTextContent('share');
    // Shown inside the open dialog, where it is seen and announced.
    await waitFor(() => expect(within(dialog()).getByRole('status')).toHaveTextContent('Could not copy the link.'));
  });

  it('shows the recipe image with the gel section of the plan', () => {
    renderShare();
    const img = openImage();
    expect(dialog('Recipe image')).toBeInTheDocument();
    // Caffeine is off: no caffeine number.
    expect(stats(img)).toEqual({
      'Total carbs': '225 g',
      'Carbs per hour': '75 g/h',
      Ratio: '1:0.5',
      Sodium: '300 mg/h',
      Fluid: '250 ml/h',
    });
    expect(within(img).getByTestId('share-event')).toHaveTextContent('3:00 h · Cycling · Moderate');
    expect(within(img).getByTestId('share-view-caption')).toHaveTextContent('Total · 3 h');
    expect(within(img).queryByTestId('share-section-drink')).not.toBeInTheDocument();

    const gels = within(img).getByTestId('share-section-gel');
    expect(within(gels).getByRole('heading', { name: 'Gels' })).toBeInTheDocument();
    expect(within(gels).getByTestId('share-servings')).toHaveTextContent('9 gels');
    expect(within(gels).getByTestId('share-amounts-caption')).toHaveTextContent('Whole batch');
    expect(within(gels).getByRole('list', { name: 'Gels recipe' })).toBeInTheDocument();
    expect(imageLines(img, 'gel')).toEqual([
      ['Maltodextrin', '158 g'],
      ['Crystalline Fructose', '75 g'],
      ['Sodium Chloride (Table Salt)', '2.3 g'],
      ['Warm water', '140 ml'],
    ]);
    // Carb lines carry a bar of their share of the carbs, said in words for screen readers.
    expect(gels).toHaveTextContent('67% of the carbs');
    expect(gels).toHaveTextContent('33% of the carbs');
    expect(within(gels).getByTestId('share-osmolality')).toHaveTextContent(
      '≈ 4,300 mOsm/kg, likely higher · Hypertonic',
    );
  });

  it('shows both sections, per serving, on the image', () => {
    renderShare({ sweat: { source: 'preset' }, format: { type: 'both', view: 'perServing' } });
    const img = openImage();
    expect(within(img).getByTestId('share-view-caption')).toHaveTextContent('Per serving');
    expect(stats(img)).toMatchObject({ Sodium: '570 mg/h', Fluid: '800 ml/h' });
    expect(within(img).getByTestId('share-section-gel')).toHaveTextContent('Per gel');
    expect(imageLines(img, 'gel')).toEqual([
      ['Maltodextrin', '8.8 g'],
      ['Crystalline Fructose', '4.2 g'],
      ['Warm water', '8 ml'],
    ]);
    const drink = within(img).getByTestId('share-section-drink');
    expect(within(drink).getByRole('heading', { name: 'Drink' })).toBeInTheDocument();
    expect(within(drink).getByTestId('share-servings')).toHaveTextContent('4 bottles, 600 ml each (750 ml bottle)');
    expect(within(drink).getByTestId('share-amounts-caption')).toHaveTextContent('Per bottle');
    expect(imageLines(img, 'drink')).toEqual([
      ['Maltodextrin', '20 g'],
      ['Crystalline Fructose', '9.4 g'],
      ['Sodium Chloride (Table Salt)', '1.1 g'],
      ['Water, to fill each bottle to 600 ml', '581 ml'],
    ]);
    expect(within(drink).getByTestId('share-osmolality')).toHaveTextContent('≈ 181 mOsm/kg · Hypotonic');
  });

  it('shows the carbs the recipe delivers and why when there is no carb ingredient', () => {
    renderShare({ carbs: { ingredients: [] } });
    const img = openImage();
    expect(stats(img)['Total carbs']).toBe('0 g');
    const warnings = within(img).getByRole('list', { name: 'Warnings' });
    expect(warnings).toHaveTextContent('Add at least one carb ingredient.');
    // No carbs means no gels: the salt goes into the drink, and there is no delivered ratio.
    expect(within(img).queryByTestId('share-section-gel')).not.toBeInTheDocument();
    expect(imageLines(img, 'drink')[0]).toEqual(['Sodium Chloride (Table Salt)', '2.3 g']);
    expect(stats(img).Ratio).toBe('0:0');
  });

  it('marks each headline number with its substance colour, as the board does', () => {
    renderShare({ caffeine: { enabled: true, asIngredient: true } });
    const img = openImage();
    const tones = within(within(img).getByTestId('share-stats'))
      .getAllByRole('term')
      .map((dt) => [dt.textContent, dt.parentElement.dataset.tone]);
    // The ratio is not an amount of fructose, so it is neutral.
    expect(tones).toEqual([
      ['Total carbs', 'glucose'],
      ['Carbs per hour', 'glucose'],
      ['Ratio', 'neutral'],
      ['Sodium', 'sodium'],
      ['Fluid', 'fluid'],
      ['Caffeine', 'caffeine'],
    ]);
    expect(within(img).getByText('Fluid').parentElement.className).toContain('border-fluid');
  });

  it('writes a manual fluid rate in whole ml, as the board does', () => {
    // 20 fl oz typed in imperial is stored as 591.47 ml.
    renderShare({ fluid: { mode: 'manual', manualMlPerHour: 591.47 } });
    expect(stats(openImage()).Fluid).toBe('591 ml/h');
  });

  it('writes a manual fluid rate typed in fl oz back in fl oz', () => {
    renderShare({ fluid: { mode: 'manual', manualMlPerHour: 591.47 } }, { prefs: { unitSystem: 'imperial' } });
    expect(stats(openImage()).Fluid).toBe('20 fl oz/h');
  });

  it('colours each line by its substance, never by colour alone', () => {
    renderShare({ sweat: { source: 'preset' }, format: { type: 'drink' } });
    const img = openImage();
    const items = within(within(img).getByTestId('share-section-drink')).getAllByRole('listitem');
    expect(items.map((li) => li.dataset.tone)).toEqual(['glucose', 'fructose', 'sodium', 'fluid']);
    // The label names every line; the dot is decorative.
    expect(items[2].querySelector('.bg-sodium')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the ratio the recipe delivers when the ingredients cannot make the target', () => {
    renderShare({
      carbs: { ratioMode: 'manual', manualRatio: { glucose: 1, fructose: 1 }, ingredients: [{ ref: 3, weight: 100 }] },
    });
    const img = openImage();
    expect(stats(img).Ratio).toBe('1:0');
    expect(within(img).getByRole('list', { name: 'Warnings' })).toHaveTextContent(
      'Your ingredients cannot make 1:1 glucose to fructose.',
    );
  });

  it('shows no recipe warning on the image for a plan the ingredients can make', () => {
    renderShare();
    const img = openImage();
    expect(within(img).queryByRole('list', { name: 'Warnings' })).not.toBeInTheDocument();
  });

  it('shows per-gel amounts and caffeine lines on the image', () => {
    renderShare({ format: { view: 'perServing' }, caffeine: { enabled: true, asIngredient: true } });
    const img = openImage();
    expect(stats(img)).toMatchObject({ Sodium: '300 mg/h', Fluid: '250 ml/h', Caffeine: '200 mg' });
    const lines = imageLines(img, 'gel');
    expect(lines[0]).toEqual(['Maltodextrin', '18 g']);
    expect(lines).toContainEqual(['Caffeine for gel 7 (100 mg tablets)', '0.5 tablets']);
    const caffeine = within(img).getByText('Caffeine for gel 7 (100 mg tablets)').closest('li');
    expect(caffeine).toHaveAttribute('data-tone', 'caffeine');
    expect(within(img).getByRole('list', { name: 'Warnings' })).toHaveTextContent(/Never use pure caffeine powder/);
  });

  it('says there is nothing to mix on an empty recipe image', () => {
    renderShare({ event: { durationMin: 30 }, sodium: { mode: 'manual', manualMgPerHour: 0 } });
    const img = openImage();
    expect(within(img).getByText('Nothing to mix for this plan.')).toBeInTheDocument();
    expect(within(img).queryByTestId('share-section-gel')).not.toBeInTheDocument();
  });

  it('writes fluid in fl oz on the image in imperial units', () => {
    renderShare(
      { sweat: { source: 'preset' }, format: { type: 'drink', view: 'perServing' } },
      { prefs: { unitSystem: 'imperial' } },
    );
    const img = openImage();
    expect(stats(img)).toMatchObject({ Sodium: '570 mg/h', Fluid: '27 fl oz/h' });
    // 562 ml of water per bottle, up to the 600 ml mark; nutrients stay in g.
    expect(imageLines(img, 'drink')[0]).toEqual(['Maltodextrin', '39 g']);
    expect(imageLines(img, 'drink')[3]).toEqual(['Water, to fill each bottle to 20 fl oz', '19 fl oz']);
    expect(within(img).getByTestId('share-servings')).toHaveTextContent('4 bottles, 20 fl oz each (25 fl oz bottle)');
  });

  it('moves focus into the image view and back to the menu', async () => {
    const user = userEvent.setup();
    renderShare();
    await user.click(within(dialog()).getByRole('button', { name: 'Make an image' }));
    expect(within(dialog('Recipe image')).getByRole('button', { name: 'Download' })).toHaveFocus();
    await user.click(within(dialog('Recipe image')).getByRole('button', { name: 'Back' }));
    expect(dialog()).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: 'Make an image' })).toHaveFocus();
  });

  it('downloads the image on the card colour and closes', async () => {
    image.toPng.mockResolvedValue('data:image/png;base64,abc');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderShare();
    const img = openImage();
    fireEvent.click(within(dialog('Recipe image')).getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Image downloaded.'));
    expect(image.toPng).toHaveBeenCalledWith(img, expect.objectContaining({ pixelRatio: 2, cacheBust: true }));
    const anchor = click.mock.contexts[0];
    expect(anchor.download).toBe('gel-recipe.png');
    expect(anchor.href).toBe('data:image/png;base64,abc');
    expect(screen.getByTestId('modal')).toHaveTextContent('none');
  });

  it('copies the link from the image view too', async () => {
    renderShare();
    openImage();
    fireEvent.click(copyButton('Recipe image'));
    await waitFor(() => expect(toast()).toHaveTextContent('Recipe link copied.'));
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('reports a failed image and stays open', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    image.toPng.mockRejectedValue(new Error('canvas'));
    renderShare();
    openImage();
    fireEvent.click(within(dialog('Recipe image')).getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Could not make the image.'));
    expect(toast()).toHaveAttribute('data-tone', 'danger');
    expect(screen.getByTestId('modal')).toHaveTextContent('share');
    expect(error).toHaveBeenCalled();
  });

  it('keeps focus on Download while the image is made and after it fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let fail;
    image.toPng.mockImplementation(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    const user = userEvent.setup();
    renderShare();
    await user.click(within(dialog()).getByRole('button', { name: 'Make an image' }));
    const download = within(dialog('Recipe image')).getByRole('button', { name: 'Download' });
    expect(download).toHaveFocus();
    await user.keyboard('{Enter}');
    // Busy: still focusable and focused (never `disabled`), said as busy and unavailable.
    await waitFor(() => expect(download).toHaveAttribute('aria-busy', 'true'));
    expect(download).toHaveAttribute('aria-disabled', 'true');
    expect(download).not.toBeDisabled();
    expect(download).toHaveFocus();
    // A second press while busy makes no second image.
    await user.keyboard('{Enter}');
    expect(image.toPng).toHaveBeenCalledTimes(1);

    fail(new Error('canvas'));
    await waitFor(() => expect(toast()).toHaveTextContent('Could not make the image.'));
    expect(download).not.toHaveAttribute('aria-disabled');
    expect(download).not.toHaveAttribute('aria-busy');
    expect(download).toHaveFocus();
  });

  it('puts a tab stop in the scrolling body: the image itself', async () => {
    const user = userEvent.setup();
    renderShare();
    const img = openImage();
    expect(img).toHaveAttribute('tabindex', '0');
    expect(img).toHaveAccessibleName('Recipe image preview');
    // Close, then the image, then the footer.
    within(dialog('Recipe image')).getByRole('button', { name: 'Close' }).focus();
    await user.tab();
    expect(img).toHaveFocus();
    await user.tab();
    expect(within(dialog('Recipe image')).getByRole('button', { name: 'Back' })).toHaveFocus();
  });

  it('names every control in both views and keeps ids unique', () => {
    renderShare();
    const check = (scope) => {
      const controls = scope.querySelectorAll('input, select, textarea, button');
      expect(controls.length).toBeGreaterThan(0);
      for (const control of controls) expect(control).toHaveAccessibleName();
      const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
      expect(new Set(ids).size).toBe(ids.length);
    };
    check(dialog());
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Make an image' }));
    check(dialog('Recipe image'));
  });

  it('closes with the close button and reopens on the menu', () => {
    renderShare();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Make an image' }));
    fireEvent.click(within(dialog('Recipe image')).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: OPEN }));
    expect(dialog('Share')).toBeInTheDocument();
  });

  it('closes on a backdrop click and on Escape, not on a click inside', async () => {
    const user = userEvent.setup();
    renderShare();
    const inside = within(dialog()).getByRole('heading', { name: 'Link' });
    fireEvent.pointerDown(inside);
    fireEvent.click(inside);
    expect(dialog()).toBeInTheDocument();
    fireEvent.pointerDown(dialog());
    fireEvent.click(dialog());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: OPEN }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: OPEN })).toHaveFocus();
  });
});
