import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COPY_SUFFIX,
  MAX_RECIPES,
  MAX_RECIPE_NAME_LENGTH,
  STORAGE_KEYS,
  UNTITLED_RECIPE_NAME,
  deleteRecipe,
  duplicateRecipe,
  listRecipes,
  loadAutosave,
  loadRecipe,
  normalizeRecipeName,
  renameRecipe,
  saveAutosave,
  saveRecipe,
} from './storage';
import { decodeShareState, encodeShareState } from './shareCodec';
import { DEFAULT_INPUTS, normalizeInputs } from '../domain/plan';

// Fields that exist in both the v3 and v4 inputs schema, so these tests do not
// change when the codec moves to v4.
const partialA = { event: { durationMin: 240, intensity: 'race' }, environment: { tempC: 28, humidity: 70 } };
const partialB = { event: { durationMin: 95 }, athlete: { massKg: 58 }, fluid: { mode: 'manual', manualMlPerHour: 650 } };
const inputsA = normalizeInputs(partialA);
const inputsB = normalizeInputs(partialB);

const T0 = Date.parse('2026-10-16T08:00:00.000Z');

/** A Map-backed Storage whose reads or writes can be made to throw. */
function memoryStorage({ failGet = false, failSet = false, initial = {} } = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: vi.fn((key) => {
      if (failGet) throw new DOMException('blocked', 'SecurityError');
      return data.has(key) ? data.get(key) : null;
    }),
    setItem: vi.fn((key, value) => {
      if (failSet) throw new DOMException('full', 'QuotaExceededError');
      data.set(key, String(value));
    }),
    removeItem: vi.fn((key) => data.delete(key)),
    clear: vi.fn(() => data.clear()),
    key: vi.fn(() => null),
    get length() {
      return data.size;
    },
  };
}

/** Every public function, called with plausible arguments. */
function callEverything(id = 'r1') {
  return {
    loadAutosave: loadAutosave(),
    saveAutosave: saveAutosave(inputsA),
    listRecipes: listRecipes(),
    saveRecipe: saveRecipe('Hot race', inputsA),
    renameRecipe: renameRecipe(id, 'New name'),
    duplicateRecipe: duplicateRecipe(id),
    deleteRecipe: deleteRecipe(id),
    loadRecipe: loadRecipe(id),
  };
}

const NOTHING = {
  loadAutosave: null,
  saveAutosave: false,
  listRecipes: [],
  saveRecipe: null,
  renameRecipe: null,
  duplicateRecipe: null,
  deleteRecipe: false,
  loadRecipe: null,
};

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('STORAGE_KEYS', () => {
  it('uses the documented keys', () => {
    expect(STORAGE_KEYS).toEqual({ autosave: 'gel-calculator:autosave', recipes: 'gel-calculator:recipes' });
    expect(Object.isFrozen(STORAGE_KEYS)).toBe(true);
  });
});

describe('autosave', () => {
  it('is null when nothing is stored', () => {
    expect(loadAutosave()).toBeNull();
  });

  it('stores the share string and restores the normalized inputs', () => {
    expect(saveAutosave(inputsA)).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.autosave)).toBe(encodeShareState(inputsA));
    expect(loadAutosave()).toEqual(inputsA);
  });

  it('normalizes partial or invalid inputs through the codec', () => {
    expect(saveAutosave(partialB)).toBe(true);
    expect(loadAutosave()).toEqual(inputsB);
    expect(saveAutosave(null)).toBe(true);
    expect(loadAutosave()).toEqual(DEFAULT_INPUTS);
  });

  it('overwrites the previous autosave', () => {
    saveAutosave(inputsA);
    saveAutosave(inputsB);
    expect(loadAutosave()).toEqual(inputsB);
  });

  it('returns null for a stored string the codec cannot read', () => {
    for (const bad of ['', '   ', '{not json', '!!!not-base64!!!', '{"v":3}', btoa(JSON.stringify({ v: 2, d: 195 }))]) {
      localStorage.setItem(STORAGE_KEYS.autosave, bad);
      expect(loadAutosave()).toBeNull();
    }
  });

  it('returns a fresh object each time', () => {
    saveAutosave(inputsA);
    const first = loadAutosave();
    first.event.durationMin = 1;
    expect(loadAutosave()).toEqual(inputsA);
  });
});

describe('normalizeRecipeName', () => {
  it('trims and keeps names up to 60 characters', () => {
    expect(normalizeRecipeName('  Long ride  ')).toBe('Long ride');
    expect(normalizeRecipeName('x'.repeat(60))).toBe('x'.repeat(60));
    expect(MAX_RECIPE_NAME_LENGTH).toBe(60);
  });

  it('cuts longer names to 60 characters and trims the cut end', () => {
    expect(normalizeRecipeName('y'.repeat(100))).toBe('y'.repeat(60));
    expect(normalizeRecipeName('a'.repeat(59) + ' bcd')).toBe('a'.repeat(59));
  });

  it('does not split characters outside the basic plane', () => {
    const name = normalizeRecipeName('🍯'.repeat(70));
    expect(Array.from(name)).toHaveLength(60);
    expect(name).toBe('🍯'.repeat(60));
  });

  it('counts and cuts emoji sequences as one character each', () => {
    const family = '👨\u200d👩\u200d👧';
    const flag = '🇩🇪';
    const thumb = '👍🏽';
    // Exactly 60 visible characters: kept whole.
    expect(normalizeRecipeName('a'.repeat(59) + family)).toBe('a'.repeat(59) + family);
    // The cut falls after a sequence: the sequence stays whole.
    expect(normalizeRecipeName('a'.repeat(59) + family + 'b')).toBe('a'.repeat(59) + family);
    expect(normalizeRecipeName('a'.repeat(59) + flag + 'b')).toBe('a'.repeat(59) + flag);
    expect(normalizeRecipeName('a'.repeat(59) + thumb + 'b')).toBe('a'.repeat(59) + thumb);
    // The cut falls before a sequence: none of it is kept.
    expect(normalizeRecipeName('a'.repeat(60) + family)).toBe('a'.repeat(60));
    expect(normalizeRecipeName('a'.repeat(60) + flag)).toBe('a'.repeat(60));
    expect(normalizeRecipeName(flag.repeat(61))).toBe(flag.repeat(60));
  });

  it('cuts by code points and drops a dangling joiner without Intl.Segmenter', () => {
    vi.stubGlobal('Intl', { ...Intl, Segmenter: undefined });
    const family = '👨\u200d👩\u200d👧';
    expect(normalizeRecipeName('🍯'.repeat(70))).toBe('🍯'.repeat(60));
    // 58 + 5 code points: the cut lands after the first joiner, which is removed.
    expect(normalizeRecipeName('a'.repeat(58) + family)).toBe('a'.repeat(58) + '👨');
    expect(normalizeRecipeName('a'.repeat(59) + ' bcd')).toBe('a'.repeat(59));
  });

  it('uses "Untitled recipe" when nothing visible is left after the cut', () => {
    expect(normalizeRecipeName('\u200d' + ' '.repeat(70) + 'x')).toBe(UNTITLED_RECIPE_NAME);
  });

  it('uses "Untitled recipe" for empty or non-string names', () => {
    for (const empty of ['', '   ', '\n\t', undefined, null, 42, {}, []]) {
      expect(normalizeRecipeName(empty)).toBe(UNTITLED_RECIPE_NAME);
    }
    expect(UNTITLED_RECIPE_NAME).toBe('Untitled recipe');
  });
});

describe('saved recipes', () => {
  it('lists nothing at first', () => {
    expect(listRecipes()).toEqual([]);
  });

  it('saves a recipe and loads its inputs', () => {
    const recipe = saveRecipe('  Hot race  ', inputsA);
    expect(recipe).toEqual({
      id: expect.stringMatching(/^r[0-9a-z]+$/),
      name: 'Hot race',
      savedAt: '2026-10-16T08:00:00.000Z',
      encoded: encodeShareState(inputsA),
      dropped: [],
    });
    expect(recipe.id.startsWith('r' + T0.toString(36))).toBe(true);
    expect(listRecipes()).toEqual([
      { id: recipe.id, name: 'Hot race', savedAt: '2026-10-16T08:00:00.000Z', encoded: recipe.encoded },
    ]);
    expect(loadRecipe(recipe.id)).toEqual(inputsA);
    expect(decodeShareState(recipe.encoded)).toEqual(inputsA);
  });

  it('stores only the four recipe fields as a JSON array', () => {
    const recipe = saveRecipe('A', inputsA);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.recipes))).toEqual([
      { id: recipe.id, name: 'A', savedAt: recipe.savedAt, encoded: recipe.encoded },
    ]);
  });

  it('names an unnamed recipe "Untitled recipe"', () => {
    expect(saveRecipe('   ', inputsA).name).toBe('Untitled recipe');
    expect(saveRecipe(undefined, inputsA).name).toBe('Untitled recipe');
  });

  it('lists the newest first', () => {
    const a = saveRecipe('A', inputsA);
    vi.setSystemTime(T0 + 60_000);
    const b = saveRecipe('B', inputsB);
    vi.setSystemTime(T0 + 120_000);
    const c = saveRecipe('C', inputsA);
    expect(listRecipes().map((r) => r.id)).toEqual([c.id, b.id, a.id]);
    expect(listRecipes()[1].savedAt).toBe('2026-10-16T08:01:00.000Z');
  });

  it('gives unique ids within one millisecond and keeps the later one first', () => {
    const ids = [];
    for (let i = 0; i < 5; i += 1) ids.push(saveRecipe(`R${i}`, inputsA).id);
    expect(new Set(ids).size).toBe(5);
    expect(listRecipes().map((r) => r.id)).toEqual(ids.slice().reverse());
  });

  it('does not reuse an id that is already stored', () => {
    const first = saveRecipe('A', inputsA);
    // Simulate a reload: another tab stored ids made by the same counter values.
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.recipes));
    const counterIds = Array.from({ length: 500 }, (_, i) => 'r' + T0.toString(36) + i.toString(36));
    localStorage.setItem(
      STORAGE_KEYS.recipes,
      JSON.stringify([...stored, ...counterIds.filter((id) => id !== first.id).map((id) => ({ ...stored[0], id }))]),
    );
    const next = saveRecipe('B', inputsB);
    expect(counterIds).not.toContain(next.id);
    expect(listRecipes().filter((r) => r.id === next.id)).toHaveLength(1);
  });

  it('renames a recipe and keeps its id, time and inputs', () => {
    const a = saveRecipe('A', inputsA);
    vi.setSystemTime(T0 + 60_000);
    const b = saveRecipe('B', inputsB);
    const renamed = renameRecipe(a.id, '  Long hot ride ');
    expect(renamed).toEqual({ id: a.id, name: 'Long hot ride', savedAt: a.savedAt, encoded: a.encoded });
    expect(listRecipes()).toEqual([
      { id: b.id, name: 'B', savedAt: b.savedAt, encoded: b.encoded },
      renamed,
    ]);
    expect(renameRecipe(a.id, '').name).toBe('Untitled recipe');
    expect(renameRecipe(a.id, 'z'.repeat(80)).name).toBe('z'.repeat(60));
  });

  it('returns null when renaming an unknown id', () => {
    saveRecipe('A', inputsA);
    const before = localStorage.getItem(STORAGE_KEYS.recipes);
    expect(renameRecipe('nope', 'X')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.recipes)).toBe(before);
  });

  it('duplicates a recipe to the front with a new id', () => {
    const a = saveRecipe('Hot race', inputsA);
    vi.setSystemTime(T0 + 60_000);
    const copy = duplicateRecipe(a.id);
    expect(copy).toEqual({
      id: expect.stringMatching(/^r[0-9a-z]+$/),
      name: 'Hot race' + COPY_SUFFIX,
      savedAt: '2026-10-16T08:01:00.000Z',
      encoded: a.encoded,
      dropped: [],
    });
    expect(copy.name).toBe('Hot race (copy)');
    expect(copy.id).not.toBe(a.id);
    expect(listRecipes().map((r) => r.id)).toEqual([copy.id, a.id]);
    expect(loadRecipe(copy.id)).toEqual(inputsA);
  });

  it('duplicates with a given name and keeps copy names within 60 characters', () => {
    const long = saveRecipe('n'.repeat(60), inputsA);
    expect(duplicateRecipe(long.id).name).toBe('n'.repeat(53) + ' (copy)');
    expect(duplicateRecipe(long.id, ' Mine ').name).toBe('Mine');
    expect(duplicateRecipe('nope')).toBeNull();
  });

  it('cuts a long name, not the suffix, when naming a copy', () => {
    const cases = [
      ['m'.repeat(58), 'm'.repeat(53) + ' (copy)'],
      ['m'.repeat(54), 'm'.repeat(53) + ' (copy)'],
      ['m'.repeat(53), 'm'.repeat(53) + ' (copy)'],
      ['m'.repeat(52) + ' xyz', 'm'.repeat(52) + ' (copy)'],
      ['🇩🇪'.repeat(60), '🇩🇪'.repeat(53) + ' (copy)'],
    ];
    for (const [original, expected] of cases) {
      const copy = duplicateRecipe(saveRecipe(original, inputsA).id);
      expect(copy.name).toBe(expected);
      expect(copy.name.endsWith(COPY_SUFFIX)).toBe(true);
      expect(normalizeRecipeName(copy.name)).toBe(copy.name);
    }
  });

  it('deletes a recipe', () => {
    const a = saveRecipe('A', inputsA);
    const b = saveRecipe('B', inputsB);
    expect(deleteRecipe(a.id)).toBe(true);
    expect(listRecipes().map((r) => r.id)).toEqual([b.id]);
    expect(loadRecipe(a.id)).toBeNull();
    expect(deleteRecipe(a.id)).toBe(false);
    expect(deleteRecipe(b.id)).toBe(true);
    expect(listRecipes()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEYS.recipes)).toBe('[]');
  });

  it('returns null when loading an unknown id or an unreadable recipe', () => {
    expect(loadRecipe('nope')).toBeNull();
    localStorage.setItem(
      STORAGE_KEYS.recipes,
      JSON.stringify([{ id: 'r1', name: 'Broken', savedAt: '2026-01-01T00:00:00.000Z', encoded: '!!!' }]),
    );
    expect(listRecipes()).toHaveLength(1);
    expect(loadRecipe('r1')).toBeNull();
  });

  it('does not share objects between calls', () => {
    const a = saveRecipe('A', inputsA);
    listRecipes()[0].name = 'Changed';
    a.name = 'Changed too';
    expect(listRecipes()[0].name).toBe('A');
  });
});

describe('recipe limit', () => {
  /** Saves `count` recipes one minute apart, oldest first. */
  function fill(count) {
    const saved = [];
    for (let i = 0; i < count; i += 1) {
      vi.setSystemTime(T0 + i * 60_000);
      saved.push(saveRecipe(`Recipe ${i}`, i % 2 ? inputsB : inputsA));
    }
    return saved;
  }

  it('keeps 50 recipes without dropping any', () => {
    const saved = fill(MAX_RECIPES);
    expect(MAX_RECIPES).toBe(50);
    expect(saved.every((r) => r.dropped.length === 0)).toBe(true);
    expect(listRecipes()).toHaveLength(50);
  });

  it('drops the oldest recipe when saving the 51st and says so', () => {
    const saved = fill(MAX_RECIPES);
    vi.setSystemTime(T0 + 100 * 60_000);
    const extra = saveRecipe('Extra', inputsB);
    expect(extra.dropped).toEqual([
      { id: saved[0].id, name: 'Recipe 0', savedAt: saved[0].savedAt, encoded: saved[0].encoded },
    ]);
    const list = listRecipes();
    expect(list).toHaveLength(50);
    expect(list[0].id).toBe(extra.id);
    expect(list.map((r) => r.id)).not.toContain(saved[0].id);
    expect(list[49].id).toBe(saved[1].id);
  });

  it('drops the oldest when duplicating at the limit', () => {
    const saved = fill(MAX_RECIPES);
    vi.setSystemTime(T0 + 100 * 60_000);
    const copy = duplicateRecipe(saved[10].id);
    expect(copy.dropped.map((r) => r.id)).toEqual([saved[0].id]);
    expect(listRecipes()).toHaveLength(50);
  });

  it('trims a stored list longer than the limit and keeps the new recipe even with a clock behind', () => {
    const many = Array.from({ length: 53 }, (_, i) => ({
      id: `x${i}`,
      name: `Old ${i}`,
      savedAt: new Date(T0 + (60 - i) * 60_000).toISOString(),
      encoded: encodeShareState(inputsA),
    }));
    localStorage.setItem(STORAGE_KEYS.recipes, JSON.stringify(many));
    // The clock is behind every stored recipe.
    vi.setSystemTime(T0 - 3_600_000);
    const recipe = saveRecipe('New', inputsB);
    expect(recipe.dropped.map((r) => r.id)).toEqual(['x49', 'x50', 'x51', 'x52']);
    // 1 ms after the newest stored recipe (x0), so it sorts first.
    expect(recipe.savedAt).toBe(new Date(T0 + 60 * 60_000 + 1).toISOString());
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.recipes));
    expect(stored).toHaveLength(50);
    expect(stored[0].id).toBe(recipe.id);
    expect(listRecipes()[0].id).toBe(recipe.id);

    // The next save drops the oldest stored recipe, not the one just saved.
    const next = saveRecipe('Newer', inputsA);
    expect(next.dropped.map((r) => r.id)).toEqual(['x48']);
    expect(listRecipes().map((r) => r.id).slice(0, 3)).toEqual([next.id, recipe.id, 'x0']);
    const copy = duplicateRecipe('x5');
    expect(copy.dropped.map((r) => r.id)).toEqual(['x47']);
    expect(listRecipes().map((r) => r.id).slice(0, 3)).toEqual([copy.id, next.id, recipe.id]);
  });

  it('keeps saves in one millisecond in save order with distinct times', () => {
    const a = saveRecipe('A', inputsA);
    const b = saveRecipe('B', inputsA);
    expect(a.savedAt).toBe('2026-10-16T08:00:00.000Z');
    expect(b.savedAt).toBe('2026-10-16T08:00:00.001Z');
    expect(listRecipes().map((r) => r.id)).toEqual([b.id, a.id]);
  });

  it('does not throw when a stored recipe has the latest possible time', () => {
    const latest = new Date(8.64e15).toISOString();
    localStorage.setItem(
      STORAGE_KEYS.recipes,
      JSON.stringify([{ id: 'far', name: 'Far', savedAt: latest, encoded: encodeShareState(inputsA) }]),
    );
    const recipe = saveRecipe('Now', inputsB);
    expect(recipe.savedAt).toBe(latest);
    expect(listRecipes().map((r) => r.id)).toEqual([recipe.id, 'far']);
  });
});

describe('malformed stored data', () => {
  it('treats malformed JSON or a non-array as empty', () => {
    for (const bad of ['{not json', '', 'null', '42', '"text"', '{"id":"r1"}', 'undefined']) {
      localStorage.setItem(STORAGE_KEYS.recipes, bad);
      expect(listRecipes()).toEqual([]);
      expect(loadRecipe('r1')).toBeNull();
      expect(renameRecipe('r1', 'X')).toBeNull();
      expect(deleteRecipe('r1')).toBe(false);
    }
  });

  it('overwrites malformed data when a recipe is saved', () => {
    localStorage.setItem(STORAGE_KEYS.recipes, '{not json');
    const recipe = saveRecipe('Fresh', inputsA);
    expect(recipe).not.toBeNull();
    expect(listRecipes().map((r) => r.id)).toEqual([recipe.id]);
  });

  it('skips invalid entries and repeated ids, and cleans names', () => {
    const encoded = encodeShareState(inputsA);
    localStorage.setItem(
      STORAGE_KEYS.recipes,
      JSON.stringify([
        1,
        null,
        'r9',
        [],
        { id: 5, name: 'Numeric id', savedAt: '2026-01-01T00:00:00.000Z', encoded },
        { id: '', name: 'Empty id', savedAt: '2026-01-01T00:00:00.000Z', encoded },
        { id: 'r1', name: 'No encoded', savedAt: '2026-01-01T00:00:00.000Z' },
        { id: 'r2', name: 'No time', encoded },
        { id: 'r3', name: '  Good  ', savedAt: '2026-01-02T00:00:00.000Z', encoded, extra: true },
        { id: 'r3', name: 'Repeat', savedAt: '2026-01-05T00:00:00.000Z', encoded },
        { id: 'r4', name: 42, savedAt: '2026-01-03T00:00:00.000Z', encoded },
        { id: 'r5', name: 'Bad time', savedAt: 'yesterday', encoded },
        { id: 'r6', name: 'Empty time', savedAt: '', encoded },
        { id: 'r7', name: 'Number time', savedAt: T0, encoded },
        { id: 'r8', name: 'Out of range', savedAt: '+275760-09-13T00:00:00.001Z', encoded },
        // A valid entry after an invalid one with the same id is kept.
        { id: 'r5', name: 'Fixed time', savedAt: '2026-01-04T00:00:00.000Z', encoded },
      ]),
    );
    expect(listRecipes()).toEqual([
      { id: 'r5', name: 'Fixed time', savedAt: '2026-01-04T00:00:00.000Z', encoded },
      { id: 'r4', name: 'Untitled recipe', savedAt: '2026-01-03T00:00:00.000Z', encoded },
      { id: 'r3', name: 'Good', savedAt: '2026-01-02T00:00:00.000Z', encoded },
    ]);
    expect(loadRecipe('r3')).toEqual(inputsA);
    expect(loadRecipe('r6')).toBeNull();
  });

  it('lists every savedAt as a canonical ISO string', () => {
    const encoded = encodeShareState(inputsA);
    localStorage.setItem(
      STORAGE_KEYS.recipes,
      JSON.stringify([
        { id: 'date', name: 'Date only', savedAt: '2026-01-01', encoded },
        { id: 'offset', name: 'Offset', savedAt: '2026-01-02T02:30:00+02:00', encoded },
        { id: 'iso', name: 'ISO', savedAt: '2026-01-03T00:00:00.000Z', encoded },
      ]),
    );
    const list = listRecipes();
    expect(list.map((r) => [r.id, r.savedAt])).toEqual([
      ['iso', '2026-01-03T00:00:00.000Z'],
      ['offset', '2026-01-02T00:30:00.000Z'],
      ['date', '2026-01-01T00:00:00.000Z'],
    ]);
    for (const recipe of list) expect(new Date(recipe.savedAt).toISOString()).toBe(recipe.savedAt);
  });

  it('sorts a stored list that is out of order', () => {
    const encoded = encodeShareState(inputsA);
    localStorage.setItem(
      STORAGE_KEYS.recipes,
      JSON.stringify([
        { id: 'old', name: 'Old', savedAt: '2026-01-01T00:00:00.000Z', encoded },
        { id: 'new', name: 'New', savedAt: '2026-03-01T00:00:00.000Z', encoded },
        { id: 'mid', name: 'Mid', savedAt: '2026-02-01T00:00:00.000Z', encoded },
      ]),
    );
    expect(listRecipes().map((r) => r.id)).toEqual(['new', 'mid', 'old']);
  });
});

describe('unavailable storage', () => {
  it('never throws when every storage call throws', () => {
    vi.stubGlobal('localStorage', memoryStorage({ failGet: true, failSet: true }));
    expect(callEverything()).toEqual(NOTHING);
  });

  it('never throws when reading the localStorage property throws', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    try {
      expect(callEverything()).toEqual(NOTHING);
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
      else delete globalThis.localStorage;
    }
    expect(typeof localStorage.getItem).toBe('function');
  });

  it('never throws when there is no localStorage (server render)', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(callEverything()).toEqual(NOTHING);
    vi.stubGlobal('localStorage', { getItem: 'not a function' });
    expect(callEverything()).toEqual(NOTHING);
  });

  it('reports a full storage and keeps what was stored', () => {
    const existing = JSON.stringify([
      { id: 'r1', name: 'Kept', savedAt: '2026-01-01T00:00:00.000Z', encoded: encodeShareState(inputsA) },
    ]);
    const storage = memoryStorage({ failSet: true, initial: { [STORAGE_KEYS.recipes]: existing } });
    vi.stubGlobal('localStorage', storage);
    expect(saveAutosave(inputsA)).toBe(false);
    expect(saveRecipe('New', inputsB)).toBeNull();
    expect(renameRecipe('r1', 'Renamed')).toBeNull();
    expect(duplicateRecipe('r1')).toBeNull();
    expect(deleteRecipe('r1')).toBe(false);
    expect(storage.data.get(STORAGE_KEYS.recipes)).toBe(existing);
    // Reading still works.
    expect(listRecipes().map((r) => r.name)).toEqual(['Kept']);
    expect(loadRecipe('r1')).toEqual(inputsA);
  });

  it('does not overwrite a list it could not read', () => {
    const storage = memoryStorage({ failGet: true });
    vi.stubGlobal('localStorage', storage);
    expect(saveRecipe('New', inputsA)).toBeNull();
    expect(duplicateRecipe('r1')).toBeNull();
    expect(storage.setItem).not.toHaveBeenCalled();
    // The autosave needs no read, so it is still written.
    expect(saveAutosave(inputsA)).toBe(true);
    expect(storage.data.get(STORAGE_KEYS.autosave)).toBe(encodeShareState(inputsA));
    expect(loadAutosave()).toBeNull();
  });

  it('works with any Storage-like object', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const recipe = saveRecipe('In memory', inputsB);
    expect(listRecipes().map((r) => r.id)).toEqual([recipe.id]);
    expect(loadRecipe(recipe.id)).toEqual(inputsB);
    expect(saveAutosave(inputsB)).toBe(true);
    expect(loadAutosave()).toEqual(inputsB);
  });
});
