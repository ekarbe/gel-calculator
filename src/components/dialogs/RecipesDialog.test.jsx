import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { screen, fireEvent, within, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecipesDialog, { LONG_TOAST_MS } from './RecipesDialog';
import TemplatesDialog from './TemplatesDialog';
import { copyName } from './share';
import { formatSavedAt, planSummary } from './dialogText';
import { renderDialog } from './testUtils';
import { RECIPES_MODAL } from '../../state/UiProvider';
import { STORAGE_KEYS, listRecipes, saveRecipe } from '../../state/storage';
import { decodeShareState, encodeShareState } from '../../state/shareCodec';
import { computePlan, normalizeInputs } from '../../domain/plan';
import { createT } from '../../i18n';
import { createFormat } from '../../i18n/formatters';

const OPEN = 'My recipes';

/**
 * The dialog with the real providers and storage (autosave off, so only the
 * recipes key is used), opened from a "My recipes" button. The templates
 * dialog is there too, for the "Start from a gel template" button.
 */
function renderRecipes({ initialInputs, open = true, prefs } = {}) {
  const user = userEvent.setup();
  const view = renderDialog(
    <>
      <RecipesDialog />
      <TemplatesDialog />
    </>,
    { modal: RECIPES_MODAL, openLabel: OPEN, initialInputs, prefs, open },
  );
  return { user, ...view };
}

const dialog = () => screen.getByRole('dialog', { name: 'My recipes' });
const savedList = () => within(dialog()).queryByRole('list', { name: 'Saved recipes' });
const savedItems = () => within(savedList()).getAllByRole('article');
const itemNamed = (name) => within(dialog()).getByRole('article', { name });
const toast = () => screen.getByTestId('toast');
const en = createT('en');
const f = createFormat('en');

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

describe('RecipesDialog: helpers', () => {
  it('summarises a plan by duration, carb target and format', () => {
    expect(planSummary(en, f, computePlan({}))).toBe('3:00 h · 75 g/h · Gel');
    expect(planSummary(en, f, computePlan({ event: { durationMin: 120 }, format: { type: 'drink' } }))).toBe(
      '2:00 h · 55 g/h · Drink',
    );
    expect(planSummary(en, f, computePlan({ format: { type: 'both' } }))).toBe('3:00 h · 75 g/h · Gel + drink');
  });

  it('formats the saved time, and nothing for a time it cannot read', () => {
    const iso = '2026-10-16T18:15:00.000Z';
    expect(formatSavedAt(f, iso)).toBe(
      new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(Date.parse(iso)),
    );
    expect(formatSavedAt(f, 'not a date')).toBe('');
  });

  it('names a copy "(copy)", cutting a long name so the addition fits in 60 characters', () => {
    expect(copyName(en, 'Long ride')).toBe('Long ride (copy)');
    const long = 'x'.repeat(60);
    expect(copyName(en, long)).toBe(`${'x'.repeat(53)} (copy)`);
    expect([...copyName(en, long)]).toHaveLength(60);
  });
});

describe('RecipesDialog: opening and closing', () => {
  it('is closed until the button opens it', () => {
    renderRecipes({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: OPEN }));
    expect(dialog().tagName).toBe('DIALOG');
    expect(screen.getByTestId('modal')).toHaveTextContent(RECIPES_MODAL);
    expect(dialog()).toHaveAccessibleDescription(
      'Recipes are saved in this browser only, and Safari deletes them after about a week without a visit. Copy a link to keep a recipe or to use it on another device.',
    );
  });

  it('starts empty, shows the current plan and focuses the close button', async () => {
    const { user } = renderRecipes({ open: false });
    await user.click(screen.getByRole('button', { name: OPEN }));
    expect(within(dialog()).getByRole('heading', { level: 2, name: 'My recipes' })).toBeInTheDocument();
    expect(within(dialog()).getByTestId('recipes-current')).toHaveTextContent('Current plan: 3:00 h · 75 g/h · Gel');
    expect(dialog()).toHaveTextContent('No saved recipes yet.');
    expect(within(dialog()).getByTestId('recipes-count')).toHaveTextContent('0 of 50');
    expect(savedList()).toBeNull();
    expect(within(dialog()).getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('labels every control, keeps ids unique, and limits the name to 60 characters', () => {
    saveRecipe('Long ride', normalizeInputs({}));
    renderRecipes();
    const input = within(dialog()).getByLabelText('Name');
    expect(input).toHaveAttribute('maxlength', '60');
    expect(input).toHaveAccessibleDescription('Up to 60 characters. Without a name it is saved as “Untitled recipe”.');
    for (const control of dialog().querySelectorAll('input, button')) expect(control).toHaveAccessibleName();
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('closes with Escape, the close button and a click on the backdrop', async () => {
    const { user } = renderRecipes();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: OPEN }));
    await user.click(within(dialog()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: OPEN }));
    const heading = within(dialog()).getByRole('heading', { name: 'Saved recipes' });
    fireEvent.pointerDown(heading);
    fireEvent.click(heading);
    expect(dialog()).toBeInTheDocument();
    fireEvent.pointerDown(dialog());
    fireEvent.click(dialog());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reads the list from storage each time it opens', async () => {
    const { user } = renderRecipes();
    await user.keyboard('{Escape}');
    saveRecipe('Saved elsewhere', normalizeInputs({ event: { durationMin: 90 } }));
    fireEvent.click(screen.getByRole('button', { name: OPEN }));
    expect(itemNamed('Saved elsewhere')).toHaveTextContent('1:30 h · 40 g/h · Gel');
  });

  it('opens the gel templates from its footer', async () => {
    const { user } = renderRecipes();
    expect(within(dialog()).getByRole('button', { name: 'Start from a gel template' })).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(within(dialog()).getByRole('button', { name: 'Start from a gel template' }));
    expect(screen.queryByRole('dialog', { name: 'My recipes' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Gel templates' })).toBeInTheDocument();
  });
});

describe('RecipesDialog: saving', () => {
  it('saves the current plan under a name', async () => {
    const { user } = renderRecipes();
    await saveAs(user, 'Long ride');

    const item = itemNamed('Long ride');
    expect(item).toHaveTextContent('3:00 h · 75 g/h · Gel');
    const [stored] = listRecipes();
    expect(stored.name).toBe('Long ride');
    expect(decodeShareState(stored.encoded)).toEqual(normalizeInputs({}));
    const time = within(item).getByText(formatSavedAt(f, stored.savedAt));
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('datetime', stored.savedAt);
    expect(time.parentElement).toHaveTextContent(`Saved ${formatSavedAt(f, stored.savedAt)}`);

    expect(toast()).toHaveTextContent('Saved “Long ride”.');
    expect(toast()).toHaveAttribute('data-tone', 'ok');
    // The dialog shows the toast itself (the page behind it is inert).
    await waitFor(() => expect(within(dialog()).getByRole('status')).toHaveTextContent('Saved “Long ride”.'));
    expect(within(dialog()).getByLabelText('Name')).toHaveValue('');
    expect(within(dialog()).getByTestId('recipes-count')).toHaveTextContent('1 of 50');
  });

  it('saves with Enter, and without a name as "Untitled recipe"', async () => {
    const { user } = renderRecipes();
    await user.type(within(dialog()).getByLabelText('Name'), '   {Enter}');
    expect(itemNamed('Untitled recipe')).toBeInTheDocument();
    expect(toast()).toHaveTextContent('Saved “Untitled recipe”.');
  });

  it('lists the newest recipe first, each with its own summary', async () => {
    const { user } = renderRecipes();
    await saveAs(user, 'Three hours');
    fireEvent.click(screen.getByRole('button', { name: 'Set 120 min' }));
    expect(within(dialog()).getByTestId('recipes-current')).toHaveTextContent('2:00 h · 55 g/h · Gel');
    await saveAs(user, 'Two hours');

    const items = savedItems();
    expect(items.map((item) => within(item).getByRole('heading').textContent)).toEqual(['Two hours', 'Three hours']);
    expect(items[0]).toHaveTextContent('2:00 h · 55 g/h · Gel');
    expect(items[1]).toHaveTextContent('3:00 h · 75 g/h · Gel');
  });

  it('says so when storage is blocked, and changes nothing', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { user } = renderRecipes();
    await saveAs(user, 'Long ride');
    expect(toast()).toHaveTextContent('Could not save the recipe. Your browser may block storage, or it is full.');
    expect(toast()).toHaveAttribute('data-tone', 'danger');
    expect(savedList()).toBeNull();
    expect(within(dialog()).getByLabelText('Name')).toHaveValue('Long ride');
  });

  it('says so when saving drops the oldest recipe at the limit of 50, and keeps the toast longer', async () => {
    storeRecipes(50);
    const { user } = renderRecipes();
    expect(savedItems()).toHaveLength(50);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await saveAs(user, 'One more');
      expect(toast()).toHaveTextContent('Saved “One more”. The oldest recipe was removed. At most 50 recipes are kept.');
      expect(toast()).toHaveAttribute('data-tone', 'warn');
      vi.advanceTimersByTime(LONG_TOAST_MS - 1000);
      await waitFor(() => expect(toast()).toHaveTextContent('Saved “One more”.'));
    } finally {
      vi.useRealTimers();
    }
    expect(savedItems()).toHaveLength(50);
    expect(within(savedItems()[0]).getByRole('heading')).toHaveTextContent('One more');
    expect(within(dialog()).queryByRole('article', { name: 'Recipe 0' })).not.toBeInTheDocument();
    expect(within(dialog()).getByTestId('recipes-count')).toHaveTextContent('50 of 50');
  });
});

describe('RecipesDialog: opening a recipe', () => {
  it('loads its inputs, closes the dialog and confirms with a toast', async () => {
    saveRecipe('Short run', normalizeInputs({ event: { durationMin: 90 }, format: { type: 'drink' } }));
    const { user } = renderRecipes();
    expect(screen.getByTestId('duration')).toHaveTextContent('180');
    await user.click(within(itemNamed('Short run')).getByRole('button', { name: 'Open: Short run' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('duration')).toHaveTextContent('90');
    expect(screen.getByTestId('format')).toHaveTextContent('drink');
    expect(toast()).toHaveTextContent('Opened “Short run”.');
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

describe('RecipesDialog: renaming', () => {
  it('renames inline with Enter and puts focus back on the Rename button', async () => {
    saveRecipe('Long ride', normalizeInputs({}));
    const { user } = renderRecipes();
    await user.click(within(itemNamed('Long ride')).getByRole('button', { name: 'Rename: Long ride' }));

    const input = within(itemNamed('Long ride')).getByLabelText('New name for Long ride');
    expect(input).toHaveValue('Long ride');
    expect(input).toHaveFocus();
    // The other actions wait until renaming is done.
    expect(within(itemNamed('Long ride')).queryByRole('button', { name: 'Open: Long ride' })).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'Hilly ride{Enter}');

    expect(itemNamed('Hilly ride')).toBeInTheDocument();
    expect(within(dialog()).queryByRole('article', { name: 'Long ride' })).not.toBeInTheDocument();
    expect(listRecipes()[0].name).toBe('Hilly ride');
    expect(toast()).toHaveTextContent('Renamed to “Hilly ride”.');
    expect(within(itemNamed('Hilly ride')).getByRole('button', { name: 'Rename: Hilly ride' })).toHaveFocus();
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

  it('cancels with Escape (the dialog stays open) or the Cancel button', async () => {
    saveRecipe('Long ride', normalizeInputs({}));
    const { user } = renderRecipes();
    const item = () => itemNamed('Long ride');

    await user.click(within(item()).getByRole('button', { name: 'Rename: Long ride' }));
    await user.type(within(item()).getByLabelText('New name for Long ride'), ' 2{Escape}');
    expect(dialog()).toBeInTheDocument();
    expect(within(item()).queryByRole('textbox')).not.toBeInTheDocument();
    expect(listRecipes()[0].name).toBe('Long ride');
    expect(within(item()).getByRole('button', { name: 'Rename: Long ride' })).toHaveFocus();

    await user.click(within(item()).getByRole('button', { name: 'Rename: Long ride' }));
    await user.type(within(item()).getByLabelText('New name for Long ride'), ' 2');
    await user.click(within(item()).getByRole('button', { name: 'Cancel renaming' }));
    expect(within(item()).queryByRole('textbox')).not.toBeInTheDocument();
    expect(listRecipes()[0].name).toBe('Long ride');

    // Escape outside the inline form closes the dialog.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('RecipesDialog: duplicating and deleting', () => {
  it('duplicates a recipe to the top of the list', async () => {
    saveRecipe('Long ride', normalizeInputs({ event: { durationMin: 240 } }));
    const { user } = renderRecipes();
    await user.click(within(itemNamed('Long ride')).getByRole('button', { name: 'Duplicate: Long ride' }));

    const items = savedItems();
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByRole('heading')).toHaveTextContent('Long ride (copy)');
    expect(items[0]).toHaveTextContent('4:00 h · 75 g/h · Gel');
    expect(toast()).toHaveTextContent('Saved a copy as “Long ride (copy)”.');
    const [copy, original] = listRecipes();
    expect(copy.encoded).toBe(original.encoded);
    expect(copy.id).not.toBe(original.id);
  });

  it('asks before deleting, and keeps the recipe on "Keep it"', async () => {
    saveRecipe('Long ride', normalizeInputs({}));
    const { user } = renderRecipes();
    await user.click(within(itemNamed('Long ride')).getByRole('button', { name: 'Delete: Long ride' }));

    const confirm = within(itemNamed('Long ride')).getByRole('group', {
      name: 'Delete “Long ride”? This cannot be undone.',
    });
    const keep = within(confirm).getByRole('button', { name: 'Keep it' });
    expect(keep).toHaveFocus();
    expect(listRecipes()).toHaveLength(1);

    await user.click(keep);
    expect(within(itemNamed('Long ride')).queryByRole('group', { name: /Delete/ })).not.toBeInTheDocument();
    expect(listRecipes()).toHaveLength(1);
    expect(within(itemNamed('Long ride')).getByRole('button', { name: 'Delete: Long ride' })).toHaveFocus();
  });

  it('keeps the recipe on Escape without closing the dialog', async () => {
    saveRecipe('Long ride', normalizeInputs({}));
    const { user } = renderRecipes();
    await user.click(within(itemNamed('Long ride')).getByRole('button', { name: 'Delete: Long ride' }));
    await user.keyboard('{Escape}');
    expect(dialog()).toBeInTheDocument();
    expect(within(itemNamed('Long ride')).queryByRole('button', { name: 'Yes, delete' })).not.toBeInTheDocument();
    expect(listRecipes()).toHaveLength(1);
    expect(within(itemNamed('Long ride')).getByRole('button', { name: 'Delete: Long ride' })).toHaveFocus();
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
    expect(toast()).toHaveTextContent('Deleted “Long ride”.');
    expect(within(dialog()).getByLabelText('Name')).toHaveFocus();
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

describe('RecipesDialog: copying a link', () => {
  let writeText;

  /**
   * Opens the dialog, then puts a clipboard mock in place (user-event's setup
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

    await waitFor(() => expect(toast()).toHaveTextContent('Link to “Long ride” copied.'));
    expect(writeText).toHaveBeenCalledTimes(1);
    const url = new URL(writeText.mock.calls[0][0]);
    expect(decodeShareState(url.searchParams.get('s'))).toEqual(inputs);
    // The dialog stays open, so more links can be copied.
    expect(dialog()).toBeInTheDocument();
  });

  it('says so when the link cannot be copied', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    saveRecipe('Long ride', normalizeInputs({}));
    const { user } = renderWithClipboard({ writeText });
    await user.click(within(itemNamed('Long ride')).getByRole('button', { name: 'Copy link: Long ride' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Could not copy the link.'));
    expect(toast()).toHaveAttribute('data-tone', 'danger');
  });

  it('falls back to execCommand without the Clipboard API', async () => {
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;
    try {
      saveRecipe('Long ride', normalizeInputs({}));
      const { user } = renderWithClipboard(undefined);
      await user.click(within(itemNamed('Long ride')).getByRole('button', { name: 'Copy link: Long ride' }));
      await waitFor(() => expect(toast()).toHaveTextContent('Link to “Long ride” copied.'));
      expect(execCommand).toHaveBeenCalledWith('copy');
    } finally {
      delete document.execCommand;
    }
  });
});

describe('RecipesDialog: language', () => {
  it('formats the counts and dates for the German locale', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    storeRecipes(2);
    renderRecipes({ prefs: { locale: 'de' } });
    const german = screen.getByRole('dialog', { name: 'Meine Rezepte' });
    const item = within(german).getByRole('article', { name: 'Recipe 1' });
    const de = createFormat('de');
    const time = item.querySelector('time');
    expect(time).toHaveTextContent(formatSavedAt(de, time.getAttribute('datetime')));
    expect(time.textContent).toMatch(/\d{2}\.\d{2}\.\d{4}/);
    // Every key has a German twin: nothing falls back to English.
    expect(warn).not.toHaveBeenCalled();
  });
});
