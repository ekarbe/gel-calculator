import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecipesModal, { formatSavedAt, planSummary } from './RecipesModal';
import { shareUrl } from '../shared/share';
import Header from '../feature/Header';
import Toast from '../shared/Toast';
import { PlanProvider, usePlan, usePlanInputs } from '../../state/PlanProvider';
import { UiProvider, useUi, RECIPES_MODAL } from '../../state/UiProvider';
import { STORAGE_KEYS, listRecipes, saveRecipe } from '../../state/storage';
import { decodeShareState, encodeShareState } from '../../state/shareCodec';
import { computePlan, normalizeInputs } from '../../domain/plan';

/** Shows what the modal changes (the plan, the open modal) and a control that changes the inputs. */
function Probe() {
  const plan = usePlan();
  const { set } = usePlanInputs();
  const { modal, toastMessage } = useUi();
  return (
    <div>
      <span data-testid="duration">{plan.durationMin}</span>
      <span data-testid="format">{plan.format.type}</span>
      <span data-testid="modal">{modal ?? 'none'}</span>
      <button type="button" onClick={() => set('event.durationMin', 120)}>
        Set 120 min
      </button>
      <Toast message={toastMessage} visible={Boolean(toastMessage)} />
    </div>
  );
}

/**
 * The modal with the real providers and storage, opened from the real header.
 * Autosave is off, so only the recipes key is used.
 */
function renderRecipes({ initialInputs, open = true } = {}) {
  const user = userEvent.setup();
  const view = render(
    <PlanProvider initialInputs={initialInputs} persist={false}>
      <UiProvider>
        <Header />
        <RecipesModal />
        <Probe />
      </UiProvider>
    </PlanProvider>,
  );
  if (open) fireEvent.click(screen.getByRole('button', { name: 'My recipes' }));
  return { user, ...view };
}

const dialog = () => screen.getByRole('dialog', { name: 'My recipes' });
const savedList = () => within(dialog()).queryByRole('list', { name: 'Saved recipes' });
const savedItems = () => within(savedList()).getAllByRole('article');
const itemNamed = (name) => within(dialog()).getByRole('article', { name });
const toast = () => screen.getByRole('status');

/** Saves the current plan under `name` through the form. */
async function saveAs(user, name) {
  const input = within(dialog()).getByLabelText('Name');
  await user.clear(input);
  if (name) await user.type(input, name);
  await user.click(within(dialog()).getByRole('button', { name: 'Save' }));
}

/** Stores `count` recipes directly (oldest first in time), as storage.js writes them. */
function storeRecipes(count) {
  const encoded = encodeShareState({});
  const recipes = Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    name: `Recipe ${i}`,
    savedAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
    encoded,
  })).reverse();
  localStorage.setItem(STORAGE_KEYS.recipes, JSON.stringify(recipes));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('RecipesModal: helpers', () => {
  it('summarises a plan by duration, carb target and format', () => {
    expect(planSummary(computePlan({}))).toBe('3 h · 75 g/h · Gel');
    expect(planSummary(computePlan({ event: { durationMin: 120 }, format: { type: 'drink' } }))).toBe(
      '2 h · 55 g/h · Drink',
    );
    expect(planSummary(computePlan({ format: { type: 'both' } }))).toBe('3 h · 75 g/h · Gel + drink');
  });

  it('formats the saved time, and nothing for a time it cannot read', () => {
    const iso = '2026-10-16T18:15:00.000Z';
    expect(formatSavedAt(iso)).toBe(
      new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(Date.parse(iso)),
    );
    expect(formatSavedAt('not a date')).toBe('');
  });

  it('builds a share link on the current page that decodes to the inputs', () => {
    window.history.replaceState(null, '', '/gel-calculator/?x=1');
    const inputs = normalizeInputs({ event: { durationMin: 90 } });
    const url = new URL(shareUrl(inputs));
    expect(url.pathname).toBe('/gel-calculator/');
    expect(url.searchParams.get('x')).toBe('1');
    expect(decodeShareState(url.searchParams.get('s'))).toEqual(inputs);
  });
});

describe('RecipesModal: opening and closing', () => {
  it('is closed until the header button opens it', () => {
    renderRecipes({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'My recipes' }));
    expect(dialog()).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByTestId('modal')).toHaveTextContent(RECIPES_MODAL);
  });

  it('starts empty, shows the current plan and focuses the close button', () => {
    renderRecipes();
    expect(within(dialog()).getByRole('heading', { name: 'My recipes' })).toBeInTheDocument();
    expect(within(dialog()).getByTestId('recipes-current')).toHaveTextContent('Current plan: 3 h · 75 g/h · Gel');
    expect(dialog()).toHaveTextContent('No saved recipes yet.');
    expect(dialog()).toHaveTextContent('0 of 50');
    expect(savedList()).toBeNull();
    const close = within(dialog()).getByRole('button', { name: 'Close' });
    expect(close).toHaveAttribute('id', 'recipes-close');
    expect(document.activeElement).toBe(close);
  });

  it('gives every control an id and a label', () => {
    saveRecipe('Long ride', normalizeInputs({}));
    renderRecipes();
    const input = within(dialog()).getByLabelText('Name');
    expect(input).toHaveAttribute('id', 'recipes-name');
    expect(input).toHaveAttribute('maxlength', '60');
    expect(within(dialog()).getByRole('button', { name: 'Save' })).toHaveAttribute('id', 'recipes-save');
    for (const button of within(dialog()).getAllByRole('button')) {
      expect(button.id).not.toBe('');
      expect(button).toHaveAccessibleName();
    }
  });

  it('closes with Escape, the close button and a click on the backdrop', async () => {
    const { user } = renderRecipes();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'My recipes' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'My recipes' }));
    fireEvent.click(dialog());
    expect(dialog()).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('recipes-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reads the list from storage each time it opens', async () => {
    const { user } = renderRecipes();
    await user.keyboard('{Escape}');
    saveRecipe('Saved elsewhere', normalizeInputs({ event: { durationMin: 90 } }));
    fireEvent.click(screen.getByRole('button', { name: 'My recipes' }));
    expect(itemNamed('Saved elsewhere')).toHaveTextContent('1 h 30 min · 40 g/h · Gel');
  });
});

describe('RecipesModal: saving', () => {
  it('saves the current plan under a name', async () => {
    const { user } = renderRecipes();
    await saveAs(user, 'Long ride');

    const item = itemNamed('Long ride');
    expect(item).toHaveTextContent('3 h · 75 g/h · Gel');
    const [stored] = listRecipes();
    expect(stored.name).toBe('Long ride');
    expect(decodeShareState(stored.encoded)).toEqual(normalizeInputs({}));
    const time = within(item).getByText(formatSavedAt(stored.savedAt));
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('datetime', stored.savedAt);

    expect(toast()).toHaveTextContent('Saved "Long ride".');
    expect(within(dialog()).getByLabelText('Name')).toHaveValue('');
    expect(dialog()).toHaveTextContent('1 of 50');
  });

  it('saves with Enter, and without a name as "Untitled recipe"', async () => {
    const { user } = renderRecipes();
    await user.type(within(dialog()).getByLabelText('Name'), '   {Enter}');
    expect(itemNamed('Untitled recipe')).toBeInTheDocument();
    expect(toast()).toHaveTextContent('Saved "Untitled recipe".');
  });

  it('lists the newest recipe first, each with its own summary', async () => {
    const { user } = renderRecipes();
    await saveAs(user, 'Three hours');
    fireEvent.click(screen.getByRole('button', { name: 'Set 120 min' }));
    expect(within(dialog()).getByTestId('recipes-current')).toHaveTextContent('2 h · 55 g/h · Gel');
    await saveAs(user, 'Two hours');

    const items = savedItems();
    expect(items.map((item) => within(item).getByRole('heading').textContent)).toEqual(['Two hours', 'Three hours']);
    expect(items[0]).toHaveTextContent('2 h · 55 g/h · Gel');
    expect(items[1]).toHaveTextContent('3 h · 75 g/h · Gel');
  });

  it('says so when storage is blocked, and changes nothing', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { user } = renderRecipes();
    await saveAs(user, 'Long ride');
    expect(toast()).toHaveTextContent('Could not save the recipe. Your browser may block storage, or it is full.');
    expect(savedList()).toBeNull();
    expect(within(dialog()).getByLabelText('Name')).toHaveValue('Long ride');
  });

  it('says so when saving drops the oldest recipe at the limit of 50', async () => {
    storeRecipes(50);
    const { user } = renderRecipes();
    expect(savedItems()).toHaveLength(50);
    await saveAs(user, 'One more');
    expect(toast()).toHaveTextContent(
      'Saved "One more". The oldest recipe was removed. At most 50 recipes are kept.',
    );
    expect(savedItems()).toHaveLength(50);
    expect(within(savedItems()[0]).getByRole('heading')).toHaveTextContent('One more');
    expect(within(dialog()).queryByRole('article', { name: 'Recipe 0' })).not.toBeInTheDocument();
    expect(dialog()).toHaveTextContent('50 of 50');
  });
});

describe('RecipesModal: opening a recipe', () => {
  it('loads its inputs, closes the modal and confirms with a toast', async () => {
    saveRecipe('Short run', normalizeInputs({ event: { durationMin: 90 }, format: { type: 'drink' } }));
    const { user } = renderRecipes();
    expect(screen.getByTestId('duration')).toHaveTextContent('180');
    await user.click(within(itemNamed('Short run')).getByRole('button', { name: 'Open: Short run' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('duration')).toHaveTextContent('90');
    expect(screen.getByTestId('format')).toHaveTextContent('drink');
    expect(toast()).toHaveTextContent('Opened "Short run".');
  });

  it('replaces a plan opened from a share link and removes the link from the address bar', async () => {
    saveRecipe('Short run', normalizeInputs({ event: { durationMin: 90 } }));
    window.history.replaceState(null, '', `/?s=${encodeShareState({ event: { durationMin: 200 } })}&x=1`);
    const { user } = renderRecipes();
    expect(screen.getByTestId('duration')).toHaveTextContent('200');

    await user.click(within(itemNamed('Short run')).getByRole('button', { name: 'Open: Short run' }));
    expect(screen.getByTestId('duration')).toHaveTextContent('90');
    expect(new URLSearchParams(window.location.search).has('s')).toBe(false);
    expect(new URLSearchParams(window.location.search).get('x')).toBe('1');
  });

  it('cannot open, copy or link a recipe whose stored inputs cannot be read, but can rename or delete it', async () => {
    localStorage.setItem(
      STORAGE_KEYS.recipes,
      JSON.stringify([{ id: 'rbad', name: 'Damaged', savedAt: '2026-10-16T10:00:00.000Z', encoded: 'not-a-plan' }]),
    );
    const { user } = renderRecipes();
    const item = itemNamed('Damaged');
    expect(item).toHaveTextContent('This recipe cannot be read.');
    expect(within(item).getByRole('button', { name: 'Open: Damaged' })).toBeDisabled();
    expect(within(item).getByRole('button', { name: 'Copy link: Damaged' })).toBeDisabled();
    expect(within(item).getByRole('button', { name: 'Duplicate: Damaged' })).toBeDisabled();
    expect(within(item).getByRole('button', { name: 'Rename: Damaged' })).toBeEnabled();

    await user.click(within(item).getByRole('button', { name: 'Delete: Damaged' }));
    await user.click(within(itemNamed('Damaged')).getByRole('button', { name: 'Yes, delete' }));
    expect(savedList()).toBeNull();
    expect(listRecipes()).toEqual([]);
  });
});

describe('RecipesModal: renaming', () => {
  it('renames inline with Enter and puts focus back on the Rename button', async () => {
    saveRecipe('Long ride', normalizeInputs({}));
    const { user } = renderRecipes();
    await user.click(within(itemNamed('Long ride')).getByRole('button', { name: 'Rename: Long ride' }));

    const input = within(itemNamed('Long ride')).getByLabelText('New name for Long ride');
    expect(input).toHaveValue('Long ride');
    expect(document.activeElement).toBe(input);
    // The other actions wait until renaming is done.
    expect(within(itemNamed('Long ride')).queryByRole('button', { name: 'Open: Long ride' })).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'Hilly ride{Enter}');

    expect(itemNamed('Hilly ride')).toBeInTheDocument();
    expect(within(dialog()).queryByRole('article', { name: 'Long ride' })).not.toBeInTheDocument();
    expect(listRecipes()[0].name).toBe('Hilly ride');
    expect(toast()).toHaveTextContent('Renamed to "Hilly ride".');
    expect(document.activeElement).toBe(within(itemNamed('Hilly ride')).getByRole('button', { name: 'Rename: Hilly ride' }));
  });

  it('renames with the Save name button, and an empty name becomes "Untitled recipe"', async () => {
    saveRecipe('Long ride', normalizeInputs({}));
    const { user } = renderRecipes();
    await user.click(within(itemNamed('Long ride')).getByRole('button', { name: 'Rename: Long ride' }));
    await user.clear(within(itemNamed('Long ride')).getByLabelText('New name for Long ride'));
    await user.click(within(itemNamed('Long ride')).getByRole('button', { name: 'Save name' }));
    expect(itemNamed('Untitled recipe')).toBeInTheDocument();
    expect(listRecipes()[0].name).toBe('Untitled recipe');
  });

  it('cancels with Escape (the modal stays open) or the Cancel button', async () => {
    saveRecipe('Long ride', normalizeInputs({}));
    const { user } = renderRecipes();
    const item = () => itemNamed('Long ride');

    await user.click(within(item()).getByRole('button', { name: 'Rename: Long ride' }));
    await user.type(within(item()).getByLabelText('New name for Long ride'), ' 2{Escape}');
    expect(dialog()).toBeInTheDocument();
    expect(within(item()).queryByRole('textbox')).not.toBeInTheDocument();
    expect(listRecipes()[0].name).toBe('Long ride');
    expect(document.activeElement).toBe(within(item()).getByRole('button', { name: 'Rename: Long ride' }));

    await user.click(within(item()).getByRole('button', { name: 'Rename: Long ride' }));
    await user.type(within(item()).getByLabelText('New name for Long ride'), ' 2');
    await user.click(within(item()).getByRole('button', { name: 'Cancel renaming' }));
    expect(within(item()).queryByRole('textbox')).not.toBeInTheDocument();
    expect(listRecipes()[0].name).toBe('Long ride');
  });
});

describe('RecipesModal: duplicating and deleting', () => {
  it('duplicates a recipe to the top of the list', async () => {
    saveRecipe('Long ride', normalizeInputs({ event: { durationMin: 240 } }));
    const { user } = renderRecipes();
    await user.click(within(itemNamed('Long ride')).getByRole('button', { name: 'Duplicate: Long ride' }));

    const items = savedItems();
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByRole('heading')).toHaveTextContent('Long ride (copy)');
    expect(items[0]).toHaveTextContent('4 h · 75 g/h · Gel');
    expect(toast()).toHaveTextContent('Saved a copy as "Long ride (copy)".');
    const [copy, original] = listRecipes();
    expect(copy.encoded).toBe(original.encoded);
    expect(copy.id).not.toBe(original.id);
  });

  it('asks before deleting, and keeps the recipe on "Keep it"', async () => {
    saveRecipe('Long ride', normalizeInputs({}));
    const { user } = renderRecipes();
    await user.click(within(itemNamed('Long ride')).getByRole('button', { name: 'Delete: Long ride' }));

    const confirm = within(itemNamed('Long ride')).getByRole('group', {
      name: 'Delete "Long ride"? This cannot be undone.',
    });
    const keep = within(confirm).getByRole('button', { name: 'Keep it' });
    expect(document.activeElement).toBe(keep);
    expect(listRecipes()).toHaveLength(1);

    await user.click(keep);
    expect(within(itemNamed('Long ride')).queryByRole('group', { name: /Delete/ })).not.toBeInTheDocument();
    expect(listRecipes()).toHaveLength(1);
    expect(document.activeElement).toBe(within(itemNamed('Long ride')).getByRole('button', { name: 'Delete: Long ride' }));
  });

  it('keeps the recipe on Escape without closing the modal', async () => {
    saveRecipe('Long ride', normalizeInputs({}));
    const { user } = renderRecipes();
    await user.click(within(itemNamed('Long ride')).getByRole('button', { name: 'Delete: Long ride' }));
    await user.keyboard('{Escape}');
    expect(dialog()).toBeInTheDocument();
    expect(within(itemNamed('Long ride')).queryByRole('button', { name: 'Yes, delete' })).not.toBeInTheDocument();
    expect(listRecipes()).toHaveLength(1);
  });

  it('deletes after confirmation', async () => {
    saveRecipe('Old plan', normalizeInputs({}));
    saveRecipe('Long ride', normalizeInputs({}));
    const { user } = renderRecipes();
    await user.click(within(itemNamed('Long ride')).getByRole('button', { name: 'Delete: Long ride' }));
    await user.click(within(itemNamed('Long ride')).getByRole('button', { name: 'Yes, delete' }));

    expect(within(dialog()).queryByRole('article', { name: 'Long ride' })).not.toBeInTheDocument();
    expect(savedItems()).toHaveLength(1);
    expect(listRecipes().map((recipe) => recipe.name)).toEqual(['Old plan']);
    expect(toast()).toHaveTextContent('Deleted "Long ride".');
    expect(document.activeElement).toBe(within(dialog()).getByLabelText('Name'));
  });

  it('confirms only one delete at a time, and renaming cancels a pending delete', async () => {
    saveRecipe('A', normalizeInputs({}));
    saveRecipe('B', normalizeInputs({}));
    const { user } = renderRecipes();
    await user.click(within(itemNamed('A')).getByRole('button', { name: 'Delete: A' }));
    await user.click(within(itemNamed('B')).getByRole('button', { name: 'Delete: B' }));
    expect(within(dialog()).getAllByRole('button', { name: 'Yes, delete' })).toHaveLength(1);
    expect(within(itemNamed('B')).getByRole('button', { name: 'Yes, delete' })).toBeInTheDocument();

    await user.click(within(itemNamed('A')).getByRole('button', { name: 'Rename: A' }));
    expect(within(dialog()).queryByRole('button', { name: 'Yes, delete' })).not.toBeInTheDocument();
  });
});

describe('RecipesModal: copying a link', () => {
  let writeText;

  /**
   * Opens the modal, then puts a clipboard mock in place (user-event's setup
   * installs its own clipboard stub, so the mock must come after it).
   */
  function renderWithClipboard(clipboard) {
    const view = renderRecipes();
    Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
    return view;
  }

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete navigator.clipboard;
  });

  it('copies a share link that opens the recipe', async () => {
    const inputs = normalizeInputs({ event: { durationMin: 150 }, format: { type: 'both' } });
    saveRecipe('Long ride', inputs);
    const { user } = renderWithClipboard({ writeText });
    await user.click(within(itemNamed('Long ride')).getByRole('button', { name: 'Copy link: Long ride' }));

    await waitFor(() => expect(toast()).toHaveTextContent('Link to "Long ride" copied.'));
    expect(writeText).toHaveBeenCalledTimes(1);
    const url = new URL(writeText.mock.calls[0][0]);
    expect(decodeShareState(url.searchParams.get('s'))).toEqual(inputs);
    // The modal stays open, so more links can be copied.
    expect(dialog()).toBeInTheDocument();
  });

  it('says so when the link cannot be copied', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    saveRecipe('Long ride', normalizeInputs({}));
    const { user } = renderWithClipboard({ writeText });
    await user.click(within(itemNamed('Long ride')).getByRole('button', { name: 'Copy link: Long ride' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Could not copy the link.'));
  });

  it('falls back to execCommand without the Clipboard API', async () => {
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;
    try {
      saveRecipe('Long ride', normalizeInputs({}));
      const { user } = renderWithClipboard(undefined);
      await user.click(within(itemNamed('Long ride')).getByRole('button', { name: 'Copy link: Long ride' }));
      await waitFor(() => expect(toast()).toHaveTextContent('Link to "Long ride" copied.'));
      expect(execCommand).toHaveBeenCalledWith('copy');
    } finally {
      delete document.execCommand;
    }
  });
});
