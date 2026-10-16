/*  Gel-Calculator - Personalized fuel calculator for endurance athletes.
    Copyright (C) 2026  Eike Christian Karbe

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>. */

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Copy, FolderOpen, Link2, Pencil, Save, Trash2, X } from "lucide-react";
import { computePlan } from "../../domain/plan";
import { fmt, formatDuration } from "../shared/format";
import { copyText, shareUrl } from "../shared/share";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { useUi, RECIPES_MODAL } from "../../state/UiProvider";
import { decodeShareState } from "../../state/shareCodec";
import {
  MAX_RECIPES,
  MAX_RECIPE_NAME_LENGTH,
  UNTITLED_RECIPE_NAME,
  deleteRecipe,
  duplicateRecipe,
  listRecipes,
  loadRecipe,
  renameRecipe,
  saveRecipe,
} from "../../state/storage";

/** @typedef {import('../../state/storage').SavedRecipe} SavedRecipe */
/** @typedef {import('../../domain/plan').Plan} Plan */

/** How long a toast that reports a problem or a removed recipe stays, in ms. */
const LONG_TOAST_MS = 6000;

/** Recipe formats (`inputs.format.type`) as the summary names them. */
const FORMAT_LABELS = Object.freeze({ gel: "Gel", drink: "Drink", both: "Gel + drink" });

/** "Oct 16, 2026, 8:15 PM" in the visitor's time zone. */
const SAVED_AT_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

/** Classes of a small action button in a recipe row. */
const ACTION_BUTTON =
  "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-card-border text-text-primary bg-card hover:bg-card-border/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

/** Classes of a text field. */
const INPUT_CLASS =
  "w-full min-w-0 bg-card border border-card-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-apple-blue/40";

/**
 * One-line summary of a plan: duration, carb target and the format of its
 * recipe (`plan.format.type`; "3 h · 75 g/h · Gel").
 * @param {Plan} plan
 * @returns {string}
 */
export function planSummary(plan) {
  const format = FORMAT_LABELS[plan.format?.type] ?? FORMAT_LABELS.gel;
  return `${formatDuration(plan.durationMin)} · ${fmt(plan.carbs.gPerHour)} g/h · ${format}`;
}

/**
 * Summary of a saved recipe ({@link planSummary} of its plan), or `null`
 * when its stored inputs cannot be read.
 * @param {SavedRecipe} recipe
 * @returns {string|null}
 */
function recipeSummary(recipe) {
  const inputs = decodeShareState(recipe.encoded);
  return inputs ? planSummary(computePlan(inputs)) : null;
}

/**
 * When a recipe was saved, as text in the visitor's time zone. `''` for a
 * time that cannot be read.
 * @param {string} savedAt  ISO 8601.
 * @returns {string}
 */
export function formatSavedAt(savedAt) {
  const time = Date.parse(savedAt);
  return Number.isFinite(time) ? SAVED_AT_FORMAT.format(time) : "";
}

/**
 * A recipe id made safe for an HTML id. Ids the storage creates
 * (`r` + base 36) pass unchanged.
 * @param {string} id
 * @returns {string}
 */
const domId = (id) => `recipes-${String(id).replace(/[^A-Za-z0-9_-]/g, "_")}`;

/**
 * Text added to a toast when saving or copying removed the oldest recipes.
 * @param {SavedRecipe[]} dropped
 * @returns {string}
 */
function droppedNote(dropped) {
  if (!Array.isArray(dropped) || dropped.length === 0) return "";
  const what = dropped.length === 1 ? "The oldest recipe was" : `The ${fmt(dropped.length)} oldest recipes were`;
  return ` ${what} removed. At most ${MAX_RECIPES} recipes are kept.`;
}

/**
 * Moves focus to the element with this id, if it is on the page.
 * @param {string} id
 */
function focusById(id) {
  document.getElementById(id)?.focus();
}

/**
 * The open modal. Mounted only while the modal is open, so the recipe list
 * is read from storage each time it opens.
 */
function RecipesDialog() {
  const plan = usePlan();
  const { inputs, loadInputs } = usePlanInputs();
  const { closeModal, showToast } = useUi();
  const titleId = useId();
  const closeRef = useRef(/** @type {HTMLButtonElement|null} */ (null));
  const [recipes, setRecipes] = useState(listRecipes);
  const [name, setName] = useState("");
  /** The recipe being renamed and the name typed so far. */
  const [editing, setEditing] = useState(/** @type {{ id: string, name: string }|null} */ (null));
  /** The recipe whose delete is waiting for confirmation. */
  const [confirmingId, setConfirmingId] = useState(/** @type {string|null} */ (null));

  const summaries = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipeSummary(recipe)])), [recipes]);

  useEffect(() => {
    closeRef.current?.focus();
    // An inline form (rename, delete confirmation) that handled Escape marks
    // the event (`preventDefault`). Stopping propagation is not enough: in
    // the app React listens on `document` itself, the same node as this
    // listener, so the event still reaches it.
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !event.defaultPrevented) closeModal();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeModal]);

  const refresh = () => setRecipes(listRecipes());

  const handleSave = (event) => {
    event.preventDefault();
    const saved = saveRecipe(name, inputs);
    if (!saved) {
      showToast("Could not save the recipe. Your browser may block storage, or it is full.", LONG_TOAST_MS);
      return;
    }
    refresh();
    setName("");
    const note = droppedNote(saved.dropped);
    showToast(`Saved "${saved.name}".${note}`, note ? LONG_TOAST_MS : undefined);
  };

  /** @param {SavedRecipe} recipe */
  const handleOpen = (recipe) => {
    const loaded = loadRecipe(recipe.id);
    if (!loaded) {
      refresh();
      showToast("This recipe could not be opened.", LONG_TOAST_MS);
      return;
    }
    loadInputs(loaded);
    closeModal();
    showToast(`Opened "${recipe.name}".`);
  };

  /** @param {SavedRecipe} recipe */
  const startRename = (recipe) => {
    setConfirmingId(null);
    setEditing({ id: recipe.id, name: recipe.name });
  };

  /** Ends renaming and puts focus back on the recipe's Rename button. */
  const endRename = (id) => {
    flushSync(() => {
      setEditing(null);
      refresh();
    });
    focusById(`${domId(id)}-rename`);
  };

  const submitRename = (event) => {
    event.preventDefault();
    if (!editing) return;
    const renamed = renameRecipe(editing.id, editing.name);
    showToast(renamed ? `Renamed to "${renamed.name}".` : "Could not rename the recipe.", renamed ? undefined : LONG_TOAST_MS);
    endRename(editing.id);
  };

  /** @param {SavedRecipe} recipe */
  const handleDuplicate = (recipe) => {
    const copy = duplicateRecipe(recipe.id);
    if (!copy) {
      showToast("Could not copy the recipe. Your browser may block storage, or it is full.", LONG_TOAST_MS);
      return;
    }
    refresh();
    const note = droppedNote(copy.dropped);
    showToast(`Saved a copy as "${copy.name}".${note}`, note ? LONG_TOAST_MS : undefined);
  };

  /** @param {SavedRecipe} recipe */
  const askDelete = (recipe) => {
    setEditing(null);
    setConfirmingId(recipe.id);
  };

  /** @param {string} id */
  const cancelDelete = (id) => {
    flushSync(() => setConfirmingId(null));
    focusById(`${domId(id)}-delete`);
  };

  /** @param {SavedRecipe} recipe */
  const confirmDelete = (recipe) => {
    const deleted = deleteRecipe(recipe.id);
    flushSync(() => {
      setConfirmingId(null);
      refresh();
    });
    showToast(deleted ? `Deleted "${recipe.name}".` : "Could not delete the recipe.", deleted ? undefined : LONG_TOAST_MS);
    focusById("recipes-name");
  };

  /** @param {SavedRecipe} recipe */
  const handleCopyLink = async (recipe) => {
    const loaded = loadRecipe(recipe.id);
    if (!loaded) {
      showToast("This recipe could not be read.", LONG_TOAST_MS);
      return;
    }
    let copied = false;
    try {
      copied = await copyText(shareUrl(loaded));
    } catch {
      copied = false;
    }
    showToast(copied ? `Link to "${recipe.name}" copied.` : "Could not copy the link.");
  };

  /**
   * Escape inside an inline form cancels it instead of closing the modal:
   * `preventDefault` tells the modal's own Escape listener to leave it open.
   */
  const onInlineKeyDown = (event, cancel) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    cancel();
  };

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) closeModal();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-center items-end sm:items-center p-0 sm:p-4"
      onClick={handleBackdropClick}
      data-testid="recipes-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-modal border border-card-border backdrop-blur-3xl shadow-2xl w-full sm:max-w-xl sm:rounded-2xl rounded-t-3xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="flex justify-between items-start gap-4 px-6 py-4 border-b border-card-border flex-shrink-0">
          <div>
            <h3 id={titleId} className="font-bold text-lg text-text-primary flex items-center gap-2">
              <FolderOpen size={20} aria-hidden="true" className="text-apple-blue" /> My recipes
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              Recipes are saved in this browser only. Copy a link to use one on another device.
            </p>
          </div>
          <button
            id="recipes-close"
            ref={closeRef}
            type="button"
            onClick={closeModal}
            aria-label="Close"
            className="p-2 text-text-secondary bg-card-border/30 rounded-full hover:bg-card-border/50 transition-colors"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <form onSubmit={handleSave} aria-labelledby="recipes-save-heading" className="space-y-2">
            <h4 id="recipes-save-heading" className="font-semibold text-text-primary">
              Save the current plan
            </h4>
            <p data-testid="recipes-current" className="text-xs text-text-secondary">
              Current plan: {planSummary(plan)}
            </p>
            <label htmlFor="recipes-name" className="block text-xs font-semibold text-text-secondary">
              Name
            </label>
            <div className="flex gap-2">
              <input
                id="recipes-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={MAX_RECIPE_NAME_LENGTH}
                placeholder="e.g. Long ride, hot day"
                autoComplete="off"
                aria-describedby="recipes-name-hint"
                className={INPUT_CLASS}
              />
              <button
                id="recipes-save"
                type="submit"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-apple-blue hover:bg-apple-blue/90 px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                <Save size={16} aria-hidden="true" /> Save
              </button>
            </div>
            <p id="recipes-name-hint" className="text-xs text-text-secondary">
              Up to {MAX_RECIPE_NAME_LENGTH} characters. Without a name it is saved as &quot;{UNTITLED_RECIPE_NAME}&quot;.
            </p>
          </form>

          <section aria-labelledby="recipes-list-heading" className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h4 id="recipes-list-heading" className="font-semibold text-text-primary">
                Saved recipes
              </h4>
              <p className="text-xs text-text-secondary">
                {fmt(recipes.length)} of {MAX_RECIPES}
              </p>
            </div>
            {recipes.length === 0 ? (
              <p className="text-sm text-text-secondary">No saved recipes yet. Save the current plan to find it here later.</p>
            ) : (
              <ul aria-label="Saved recipes" className="space-y-3">
                {recipes.map((recipe) => {
                  const base = domId(recipe.id);
                  const summary = summaries.get(recipe.id) ?? null;
                  const isEditing = editing?.id === recipe.id;
                  const isConfirming = confirmingId === recipe.id;
                  const savedText = formatSavedAt(recipe.savedAt);
                  return (
                    <li key={recipe.id}>
                      <article
                        aria-labelledby={`${base}-name`}
                        data-recipe-id={recipe.id}
                        className="bg-card border border-card-border rounded-xl p-4 space-y-3"
                      >
                        <div>
                          <h5 id={`${base}-name`} className="font-bold text-text-primary break-words">
                            {recipe.name}
                          </h5>
                          <p className="text-xs text-text-secondary">
                            {summary ?? "This recipe cannot be read. It may come from a newer version of the app."}
                          </p>
                          {savedText && (
                            <p className="text-xs text-text-secondary">
                              Saved <time dateTime={recipe.savedAt}>{savedText}</time>
                            </p>
                          )}
                        </div>

                        {isEditing && (
                          <form
                            onSubmit={submitRename}
                            onKeyDown={(event) => onInlineKeyDown(event, () => endRename(recipe.id))}
                            className="space-y-2"
                          >
                            <label htmlFor={`${base}-rename-input`} className="block text-xs font-semibold text-text-secondary">
                              New name
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <input
                                id={`${base}-rename-input`}
                                type="text"
                                aria-label={`New name for ${recipe.name}`}
                                value={editing.name}
                                onChange={(event) => setEditing({ id: recipe.id, name: event.target.value })}
                                maxLength={MAX_RECIPE_NAME_LENGTH}
                                autoComplete="off"
                                autoFocus
                                className={`${INPUT_CLASS} flex-1`}
                              />
                              <button id={`${base}-rename-save`} type="submit" className={ACTION_BUTTON}>
                                Save name
                              </button>
                              <button
                                id={`${base}-rename-cancel`}
                                type="button"
                                aria-label="Cancel renaming"
                                onClick={() => endRename(recipe.id)}
                                className={ACTION_BUTTON}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}

                        {isConfirming && (
                          <div
                            role="group"
                            aria-labelledby={`${base}-confirm-text`}
                            onKeyDown={(event) => onInlineKeyDown(event, () => cancelDelete(recipe.id))}
                            className="rounded-lg border border-apple-red/30 bg-apple-red/10 p-3 space-y-2"
                          >
                            <p id={`${base}-confirm-text`} className="text-sm text-text-primary">
                              Delete &quot;{recipe.name}&quot;? This cannot be undone.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <button
                                id={`${base}-confirm-delete`}
                                type="button"
                                onClick={() => confirmDelete(recipe)}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white bg-apple-red hover:bg-apple-red/90 transition-colors"
                              >
                                <Trash2 size={14} aria-hidden="true" /> Yes, delete
                              </button>
                              <button
                                id={`${base}-confirm-cancel`}
                                type="button"
                                autoFocus
                                onClick={() => cancelDelete(recipe.id)}
                                className={ACTION_BUTTON}
                              >
                                Keep it
                              </button>
                            </div>
                          </div>
                        )}

                        {!isEditing && !isConfirming && (
                          <div role="group" aria-label={`Actions for ${recipe.name}`} className="flex flex-wrap gap-2">
                            <button
                              id={`${base}-open`}
                              aria-label={`Open: ${recipe.name}`}
                              type="button"
                              disabled={summary === null}
                              onClick={() => handleOpen(recipe)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white bg-apple-blue hover:bg-apple-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <FolderOpen size={14} aria-hidden="true" /> Open
                            </button>
                            <button
                              id={`${base}-rename`}
                              aria-label={`Rename: ${recipe.name}`}
                              type="button"
                              onClick={() => startRename(recipe)}
                              className={ACTION_BUTTON}
                            >
                              <Pencil size={14} aria-hidden="true" /> Rename
                            </button>
                            <button
                              id={`${base}-duplicate`}
                              aria-label={`Duplicate: ${recipe.name}`}
                              type="button"
                              disabled={summary === null}
                              onClick={() => handleDuplicate(recipe)}
                              className={ACTION_BUTTON}
                            >
                              <Copy size={14} aria-hidden="true" /> Duplicate
                            </button>
                            <button
                              id={`${base}-copy-link`}
                              aria-label={`Copy link: ${recipe.name}`}
                              type="button"
                              disabled={summary === null}
                              onClick={() => handleCopyLink(recipe)}
                              className={ACTION_BUTTON}
                            >
                              <Link2 size={14} aria-hidden="true" /> Copy link
                            </button>
                            <button
                              id={`${base}-delete`}
                              aria-label={`Delete: ${recipe.name}`}
                              type="button"
                              onClick={() => askDelete(recipe)}
                              className={`${ACTION_BUTTON} text-apple-red`}
                            >
                              <Trash2 size={14} aria-hidden="true" /> Delete
                            </button>
                          </div>
                        )}
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * "My recipes" modal: plans saved in this browser (`src/state/storage.js`).
 *
 * Open when `useUi().modal` is {@link RECIPES_MODAL} (the header's "My
 * recipes" button). It lets the visitor:
 * - save the current inputs under a name (`saveRecipe`; an empty name saves
 *   as "Untitled recipe"),
 * - see the saved recipes newest first, each with its name, a summary of
 *   its plan (duration, carb target, format) and when it was saved,
 * - open one: `loadRecipe` → `usePlanInputs().loadInputs` (which also drops
 *   a `?s=` link from the address bar), close the modal, toast,
 * - rename one inline (Enter or "Save name" saves, Escape or "Cancel"
 *   cancels),
 * - duplicate one (the copy goes to the top of the list),
 * - delete one after an in-page confirmation ("Yes, delete" / "Keep it";
 *   Escape keeps it),
 * - copy a share link (`?s=` with share codec v4) to the clipboard.
 *
 * Each result is confirmed with a toast. When storage is blocked or full,
 * the toast says so and nothing changes. Saving or duplicating at the limit
 * of 50 recipes drops the oldest, and the toast says that too. A recipe whose
 * stored inputs cannot be read can only be renamed or deleted. Escape (outside
 * the inline forms), the close button and a click on the backdrop close the
 * modal.
 */
export default function RecipesModal() {
  const { isModalOpen } = useUi();
  if (!isModalOpen(RECIPES_MODAL)) return null;
  return <RecipesDialog />;
}
