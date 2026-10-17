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

import { useId, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { BookTemplate, Copy, FolderOpen, Link2, Pencil, Save, Trash2 } from "lucide-react";
import Button from "../ui/Button";
import Dialog from "../ui/Dialog";
import Field, { CONTROL_CLASSES } from "../ui/Field";
import { cx } from "../ui/cx";
import { computePlan } from "../../domain/plan";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { useUi, RECIPES_MODAL, TEMPLATE_MODAL } from "../../state/UiProvider";
import { decodeShareState } from "../../state/shareCodec";
import {
  MAX_RECIPES,
  MAX_RECIPE_NAME_LENGTH,
  deleteRecipe,
  duplicateRecipe,
  listRecipes,
  loadRecipe,
  renameRecipe,
  saveRecipe,
} from "../../state/storage";
import { formatSavedAt, planSummary, splitAround } from "./dialogText";
import { pluralOf } from "../../i18n/plural";
import { copyName, copyText, recipeNameOrUntitled, shareUrl } from "./share";

/** @typedef {import('../../state/storage').SavedRecipe} SavedRecipe */
/** @typedef {import('../../i18n/index').TranslateFn} TranslateFn */
/** @typedef {import('../../i18n/formatters').Formatters} Formatters */

/** How long a toast that reports a problem or a removed recipe stays, in ms. */
export const LONG_TOAST_MS = 6000;

/**
 * A recipe id made safe for an HTML id. Ids the storage creates
 * (`r` + base 36) pass unchanged.
 * @param {string} id
 * @returns {string}
 */
const safeId = (id) => String(id).replace(/[^A-Za-z0-9_-]/g, "_");

/**
 * Moves focus to the element with this id, if it is on the page.
 * @param {string} id
 */
function focusById(id) {
  document.getElementById(id)?.focus();
}

/**
 * Summary of a saved recipe (`planSummary` of its plan), or `null` when its
 * stored inputs cannot be read.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {SavedRecipe} recipe
 * @returns {string|null}
 */
function recipeSummary(t, f, recipe) {
  const inputs = decodeShareState(recipe.encoded);
  return inputs ? planSummary(t, f, computePlan(inputs)) : null;
}

/**
 * Text added to a toast when saving or copying removed the oldest recipes;
 * `''` when nothing was removed.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {SavedRecipe[]|undefined} dropped
 * @returns {string}
 */
function droppedNote(t, f, dropped) {
  if (!Array.isArray(dropped) || dropped.length === 0) return "";
  return t(`ui-dialogs.recipes.toast.dropped.${pluralOf(dropped.length)}`, {
    count: f.number(dropped.length),
    max: f.number(MAX_RECIPES),
  });
}

/**
 * Escape inside an inline form cancels it instead of closing the dialog:
 * `preventDefault` on the keydown keeps the native `<dialog>` from firing
 * its cancel (close request), which works wherever React listens (also on
 * `document`, as in the app).
 * @param {import('react').KeyboardEvent} event
 * @param {() => void} cancel
 */
function onInlineKeyDown(event, cancel) {
  if (event.key !== "Escape") return;
  event.preventDefault();
  cancel();
}

/**
 * The open dialog's content: the save form and the saved recipes. Mounted
 * only while the dialog is open, so the list is read from storage each time
 * it opens.
 */
function RecipesBody() {
  const t = useT();
  const f = useFormat();
  const plan = usePlan();
  const { inputs, loadInputs } = usePlanInputs();
  const { closeModal, showToast } = useUi();
  const base = `recipes-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const nameId = `${base}-name`;
  const saveHeadingId = `${base}-save-heading`;
  const listHeadingId = `${base}-list-heading`;
  const rowId = (recipe, part) => `${base}-${safeId(recipe.id)}-${part}`;

  const [recipes, setRecipes] = useState(listRecipes);
  const [name, setName] = useState("");
  /** The recipe being renamed and the name typed so far. */
  const [editing, setEditing] = useState(/** @type {{ id: string, name: string }|null} */ (null));
  /** The recipe whose delete is waiting for confirmation. */
  const [confirmingId, setConfirmingId] = useState(/** @type {string|null} */ (null));

  const summaries = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipeSummary(t, f, recipe)])), [recipes, t, f]);

  const refresh = () => setRecipes(listRecipes());
  /** A confirmation (ok), or a problem that stays longer. */
  const notify = (message, { tone = "ok", long = false } = {}) =>
    showToast(message, { tone, durationMs: long ? LONG_TOAST_MS : undefined });
  const failed = (message) => notify(message, { tone: "danger", long: true });

  const handleSave = (event) => {
    event.preventDefault();
    const saved = saveRecipe(recipeNameOrUntitled(t, name), inputs);
    if (!saved) {
      failed(t("ui-dialogs.recipes.toast.saveFailed"));
      return;
    }
    refresh();
    setName("");
    const note = droppedNote(t, f, saved.dropped);
    const message = [t("ui-dialogs.recipes.toast.saved", { name: saved.name }), note].filter(Boolean).join(" ");
    notify(message, note ? { tone: "warn", long: true } : {});
  };

  /** @param {SavedRecipe} recipe */
  const handleOpen = (recipe) => {
    const loaded = loadRecipe(recipe.id);
    if (!loaded) {
      refresh();
      failed(t("ui-dialogs.recipes.toast.openFailed"));
      return;
    }
    loadInputs(loaded);
    closeModal();
    notify(t("ui-dialogs.recipes.toast.opened", { name: recipe.name }));
  };

  /** @param {SavedRecipe} recipe */
  const startRename = (recipe) => {
    setConfirmingId(null);
    setEditing({ id: recipe.id, name: recipe.name });
  };

  /** Ends renaming and puts focus back on the recipe's Rename button. */
  const endRename = (recipe) => {
    flushSync(() => {
      setEditing(null);
      refresh();
    });
    focusById(rowId(recipe, "rename"));
  };

  const submitRename = (event, recipe) => {
    event.preventDefault();
    if (!editing) return;
    const renamed = renameRecipe(editing.id, recipeNameOrUntitled(t, editing.name));
    if (renamed) notify(t("ui-dialogs.recipes.toast.renamed", { name: renamed.name }));
    else failed(t("ui-dialogs.recipes.toast.renameFailed"));
    endRename(recipe);
  };

  /** @param {SavedRecipe} recipe */
  const handleDuplicate = (recipe) => {
    const copy = duplicateRecipe(recipe.id, copyName(t, recipe.name));
    if (!copy) {
      failed(t("ui-dialogs.recipes.toast.duplicateFailed"));
      return;
    }
    refresh();
    const note = droppedNote(t, f, copy.dropped);
    const message = [t("ui-dialogs.recipes.toast.duplicated", { name: copy.name }), note].filter(Boolean).join(" ");
    notify(message, note ? { tone: "warn", long: true } : {});
  };

  /** @param {SavedRecipe} recipe */
  const askDelete = (recipe) => {
    setEditing(null);
    setConfirmingId(recipe.id);
  };

  /** @param {SavedRecipe} recipe */
  const cancelDelete = (recipe) => {
    flushSync(() => setConfirmingId(null));
    focusById(rowId(recipe, "delete"));
  };

  /** @param {SavedRecipe} recipe */
  const confirmDelete = (recipe) => {
    const deleted = deleteRecipe(recipe.id);
    flushSync(() => {
      setConfirmingId(null);
      refresh();
    });
    if (deleted) notify(t("ui-dialogs.recipes.toast.deleted", { name: recipe.name }));
    else failed(t("ui-dialogs.recipes.toast.deleteFailed"));
    focusById(nameId);
  };

  /** @param {SavedRecipe} recipe */
  const handleCopyLink = async (recipe) => {
    const loaded = loadRecipe(recipe.id);
    if (!loaded) {
      failed(t("ui-dialogs.recipes.toast.readFailed"));
      return;
    }
    let copied = false;
    try {
      copied = await copyText(shareUrl(loaded));
    } catch {
      copied = false;
    }
    if (copied) notify(t("ui-dialogs.recipes.toast.linkCopied", { name: recipe.name }));
    else failed(t("ui-dialogs.recipes.toast.linkFailed"));
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} aria-labelledby={saveHeadingId} className="space-y-2">
        <h3 id={saveHeadingId} className="display-title text-ink">
          {t("ui-dialogs.recipes.save.heading")}
        </h3>
        <p data-testid="recipes-current" className="text-body-sm text-ink-2">
          {t("ui-dialogs.recipes.current", { summary: planSummary(t, f, plan) })}
        </p>
        <Field
          id={nameId}
          label={t("ui-dialogs.recipes.name")}
          hint={t("ui-dialogs.recipes.nameHint", {
            max: MAX_RECIPE_NAME_LENGTH,
            untitled: t("ui-dialogs.recipes.untitled"),
          })}
        >
          {(controlProps) => (
            <div className="flex gap-2">
              <input
                {...controlProps}
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={MAX_RECIPE_NAME_LENGTH}
                placeholder={t("ui-dialogs.recipes.namePlaceholder")}
                autoComplete="off"
                className={cx(CONTROL_CLASSES, "min-w-0 flex-1")}
              />
              <Button type="submit" variant="primary" icon={Save}>
                {t("ui-dialogs.recipes.save")}
              </Button>
            </div>
          )}
        </Field>
      </form>

      <section aria-labelledby={listHeadingId} className="space-y-3 border-t border-line pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 id={listHeadingId} className="display-title text-ink">
            {t("ui-dialogs.recipes.list.heading")}
          </h3>
          <p data-testid="recipes-count" className="font-mono text-body-sm text-ink-2">
            {t("ui-dialogs.recipes.count", { count: f.number(recipes.length), max: f.number(MAX_RECIPES) })}
          </p>
        </div>
        {recipes.length === 0 ? (
          <p className="text-body-sm text-ink-2">{t("ui-dialogs.recipes.empty")}</p>
        ) : (
          <ul role="list" aria-label={t("ui-dialogs.recipes.list.heading")} className="space-y-3">
            {recipes.map((recipe) => {
              const summary = summaries.get(recipe.id) ?? null;
              const isEditing = editing?.id === recipe.id;
              const isConfirming = confirmingId === recipe.id;
              const savedText = formatSavedAt(f, recipe.savedAt);
              const [savedBefore, savedAfter] = splitAround(t, "ui-dialogs.recipes.saved", "time");
              const nameHeadingId = rowId(recipe, "name");
              const confirmTextId = rowId(recipe, "confirm-text");
              const unreadable = summary === null;
              return (
                <li key={recipe.id}>
                  <article
                    aria-labelledby={nameHeadingId}
                    data-recipe-id={recipe.id}
                    className="space-y-3 rounded-panel border border-line bg-surface-2 p-3"
                  >
                    <div className="min-w-0">
                      <h4 id={nameHeadingId} className="break-words text-body font-semibold text-ink">
                        {recipe.name}
                      </h4>
                      <p className="text-body-sm text-ink-2">{summary ?? t("ui-dialogs.recipes.unreadable")}</p>
                      {savedText ? (
                        <p className="text-caption text-muted">
                          {savedBefore}
                          <time dateTime={recipe.savedAt}>{savedText}</time>
                          {savedAfter}
                        </p>
                      ) : null}
                    </div>

                    {isEditing ? (
                      <form
                        onSubmit={(event) => submitRename(event, recipe)}
                        onKeyDown={(event) => onInlineKeyDown(event, () => endRename(recipe))}
                      >
                        <Field id={rowId(recipe, "rename-input")} label={t("ui-dialogs.recipes.newName")}>
                          {(controlProps) => (
                            <div className="flex flex-wrap gap-2">
                              <input
                                {...controlProps}
                                type="text"
                                aria-label={t("ui-dialogs.recipes.newNameFor", { name: recipe.name })}
                                value={editing.name}
                                onChange={(event) => setEditing({ id: recipe.id, name: event.target.value })}
                                maxLength={MAX_RECIPE_NAME_LENGTH}
                                autoComplete="off"
                                autoFocus
                                className={cx(CONTROL_CLASSES, "min-w-0 flex-1 basis-48")}
                              />
                              <Button type="submit">
                                {t("ui-dialogs.recipes.saveName")}
                              </Button>
                              <Button
                                variant="ghost"
                                aria-label={t("ui-dialogs.recipes.cancelRename")}
                                onClick={() => endRename(recipe)}
                              >
                                {t("ui-dialogs.recipes.cancel")}
                              </Button>
                            </div>
                          )}
                        </Field>
                      </form>
                    ) : null}

                    {isConfirming ? (
                      <div
                        role="group"
                        aria-labelledby={confirmTextId}
                        onKeyDown={(event) => onInlineKeyDown(event, () => cancelDelete(recipe))}
                        className="space-y-2 rounded-control border border-danger bg-danger-soft p-3"
                      >
                        <p id={confirmTextId} className="text-body-sm text-ink">
                          {t("ui-dialogs.recipes.confirmDelete", { name: recipe.name })}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="danger" size="sm" icon={Trash2} onClick={() => confirmDelete(recipe)}>
                            {t("ui-dialogs.recipes.yesDelete")}
                          </Button>
                          <Button size="sm" autoFocus onClick={() => cancelDelete(recipe)}>
                            {t("ui-dialogs.recipes.keep")}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {!isEditing && !isConfirming ? (
                      <div role="group" aria-label={t("ui-dialogs.recipes.actions", { name: recipe.name })} className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          icon={FolderOpen}
                          aria-label={t("ui-dialogs.recipes.openNamed", { name: recipe.name })}
                          disabled={unreadable}
                          onClick={() => handleOpen(recipe)}
                        >
                          {t("ui-dialogs.recipes.open")}
                        </Button>
                        <Button
                          id={rowId(recipe, "rename")}
                          size="sm"
                          icon={Pencil}
                          aria-label={t("ui-dialogs.recipes.renameNamed", { name: recipe.name })}
                          onClick={() => startRename(recipe)}
                        >
                          {t("ui-dialogs.recipes.rename")}
                        </Button>
                        <Button
                          size="sm"
                          icon={Copy}
                          aria-label={t("ui-dialogs.recipes.duplicateNamed", { name: recipe.name })}
                          disabled={unreadable}
                          onClick={() => handleDuplicate(recipe)}
                        >
                          {t("ui-dialogs.recipes.duplicate")}
                        </Button>
                        <Button
                          size="sm"
                          icon={Link2}
                          aria-label={t("ui-dialogs.recipes.copyLinkNamed", { name: recipe.name })}
                          disabled={unreadable}
                          onClick={() => handleCopyLink(recipe)}
                        >
                          {t("ui-dialogs.recipes.copyLink")}
                        </Button>
                        <Button
                          id={rowId(recipe, "delete")}
                          size="sm"
                          variant="danger"
                          icon={Trash2}
                          aria-label={t("ui-dialogs.recipes.deleteNamed", { name: recipe.name })}
                          onClick={() => askDelete(recipe)}
                        >
                          {t("ui-dialogs.recipes.delete")}
                        </Button>
                      </div>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * "My recipes": plans saved in this browser (`src/state/storage.js`), on the
 * `Dialog` primitive. Open with `useUi().openModal(RECIPES_MODAL)` (the
 * header's "My recipes" button). It lets the visitor:
 * - save the current inputs under a name (`saveRecipe`; an empty name saves
 *   as "Untitled recipe" in the UI language),
 * - see the saved recipes newest first, each with its name, a summary of
 *   its plan (duration, carb target, format) and when it was saved,
 * - open one: `loadRecipe` → `usePlanInputs().loadInputs` (which also drops
 *   a `?s=` link from the address bar), close the dialog, toast,
 * - rename one inline (Enter or "Save name" saves, Escape or "Cancel"
 *   cancels; focus goes back to its Rename button),
 * - duplicate one (the copy, "Name (copy)", goes to the top of the list),
 * - delete one after an in-page confirmation ("Yes, delete" / "Keep it";
 *   Escape keeps it),
 * - copy a share link (`?s=` with share codec v4) to the clipboard,
 * - start from a gel template (opens the templates dialog instead).
 *
 * Each result is confirmed with a toast (shown in the dialog while it is
 * open). When storage is blocked or full, the toast says so and nothing
 * changes. Saving or duplicating at the limit of 50 recipes drops the
 * oldest, and the toast says that too. A recipe whose stored inputs cannot
 * be read can only be renamed or deleted. Escape (outside the inline forms),
 * the close button and a click on the backdrop close the dialog.
 */
export default function RecipesDialog() {
  const t = useT();
  const { isModalOpen, closeModal, openModal } = useUi();
  return (
    <Dialog
      open={isModalOpen(RECIPES_MODAL)}
      onClose={closeModal}
      title={t("ui-dialogs.recipes.title")}
      description={t("ui-dialogs.recipes.description")}
      size="md"
      data-testid="recipes-dialog"
      footer={
        <Button variant="ghost" icon={BookTemplate} aria-haspopup="dialog" onClick={() => openModal(TEMPLATE_MODAL)} className="mr-auto">
          {t("ui-dialogs.recipes.templates")}
        </Button>
      }
    >
      <RecipesBody />
    </Dialog>
  );
}
