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

import { useId, useState } from "react";
import { CircleCheck, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import Button from "../ui/Button";
import Chip from "../ui/Chip";
import Icon from "../ui/Icon";
import Switch from "../ui/Switch";
import { cx } from "../ui/cx";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { INPUT_LIMITS } from "../../domain/plan";
import { roundTo } from "../../domain/units";
import SweatTestForm from "./SweatTestForm";
import { describeConditions, freeTestId, newTestDraft, rateForText, testName } from "./SweatHelpers";
import { useFocusAfterRender } from "../ui/useFocusAfterRender";

/** @typedef {import('./SweatHelpers').SweatTestDraft} SweatTestDraft */
/** @typedef {import('../../domain/sweat').SweatTest} SweatTest */

/**
 * The sweat test tab: the saved tests (name, date, duration, conditions,
 * the measured rate or what is wrong with the test), a radio choice of the
 * test the plan uses ("In use" marks it while the plan uses a test), the
 * add/edit form ({@link SweatTestForm}), delete with an in-page
 * confirmation, and the switch that scales the test to the event with its
 * result. At most `INPUT_LIMITS.sweatTests[1]` tests.
 *
 * Keyboard focus never drops to the page: after saving, focus goes to the
 * new test's radio or the edited test's Edit button; after Cancel back to
 * the button that opened the form; a delete confirmation focuses its Cancel
 * button, and Escape inside it cancels (the handler calls
 * `preventDefault`, so a surrounding dialog stays open). After a delete,
 * focus goes to the neighbouring test's radio (the next, else the previous
 * one), else to "Add a sweat test", else (the form is open, so Add is not
 * shown) to the form's first field.
 *
 * Each test's radio is named by the test's name and described by its
 * "In use" chip, its date, duration and conditions, and its measured rate
 * or what is wrong with it, so arrowing through the tests says which one
 * cannot be used.
 *
 * Reads the plan from `usePlan()` and edits the inputs with
 * `usePlanInputs()`. Exported for the guided flow.
 *
 * @param {{ idPrefix?: string, headingLevel?: number }} props
 *   `idPrefix` makes the ids unique (default generated); `headingLevel` is the level of the form title
 *   (default 3).
 */
export default function SweatTestPanel({ idPrefix, headingLevel = 3 }) {
  const t = useT();
  const f = useFormat();
  const { inputs, set, apply } = usePlanInputs();
  const plan = usePlan();
  const focusAfterRender = useFocusAfterRender();
  const generatedId = useId();
  const prefix = idPrefix ?? `sweat-tests-${generatedId.replace(/:/g, "")}`;
  const id = (name) => `${prefix}-${name}`;
  const [form, setForm] = useState(
    /** @type {{ mode: 'add'|'edit', testId: string|null, initial: SweatTestDraft } | null} */ (null),
  );
  const [confirmingId, setConfirmingId] = useState(/** @type {string|null} */ (null));

  const tests = inputs.sweat.tests;
  const results = plan.sweat.tests;
  const maxTests = INPUT_LIMITS.sweatTests[1];
  const atLimit = tests.length >= maxTests;
  const selectedId = inputs.sweat.selectedTestId ?? tests.at(-1)?.id ?? null;
  const usingTest = plan.sweat.source === "test";
  const calibration = usingTest ? plan.sweat.calibration : null;
  const measured = usingTest ? plan.sweat.test : null;

  const openAdd = () => {
    setConfirmingId(null);
    setForm({ mode: "add", testId: null, initial: newTestDraft(inputs) });
  };
  /** @param {SweatTest} test */
  const openEdit = (test) => {
    setConfirmingId(null);
    const { id: testId, ...fields } = test;
    setForm({
      mode: "edit",
      testId,
      initial: /** @type {SweatTestDraft} */ ({ ...fields, conditions: { ...fields.conditions } }),
    });
  };
  const closeForm = () => {
    const editedStillThere = form?.mode === "edit" && tests.some((test) => test.id === form.testId);
    focusAfterRender(editedStillThere ? id(`${form.testId}-edit`) : id("add"));
    setForm(null);
  };
  /** @param {SweatTestDraft} draft */
  const saveForm = (draft) => {
    const fields = { ...draft, label: draft.label.trim() };
    if (form?.mode === "edit") {
      const index = tests.findIndex((test) => test.id === form.testId);
      if (index >= 0) set(["sweat", "tests", index], { id: form.testId, ...fields });
      focusAfterRender(id(`${form.testId}-edit`), id("add"));
    } else {
      // A new test becomes the one the plan uses.
      const testId = freeTestId(tests);
      apply({ sweat: { tests: [...tests, { id: testId, ...fields }], selectedTestId: testId } });
      focusAfterRender(id(`${testId}-use`), id("add"));
    }
    setForm(null);
  };

  const askDelete = (testId) => {
    setConfirmingId(testId);
    focusAfterRender(id(`${testId}-cancel-delete`));
  };
  const cancelDelete = () => {
    if (confirmingId !== null) focusAfterRender(id(`${confirmingId}-delete`));
    setConfirmingId(null);
  };
  const confirmDelete = () => {
    const testId = confirmingId;
    const index = tests.findIndex((test) => test.id === testId);
    const neighbour = index >= 0 ? (tests[index + 1] ?? tests[index - 1]) : undefined;
    setConfirmingId(null);
    if (form?.testId === testId) setForm(null);
    // A deleted selected test leaves `selectedTestId` naming no test: the inputs turn it into null (the last test).
    set("sweat.tests", (list) => (Array.isArray(list) ? list.filter((test) => test?.id !== testId) : []));
    // The focused "Yes, delete" goes away with its row. Add is not shown while the form is open.
    focusAfterRender(...(neighbour ? [id(`${neighbour.id}-use`)] : []), id("add"), id("form-date"));
  };

  return (
    <div className="space-y-4" data-testid="sweat-test-panel">
      <p className="text-body-sm text-ink-2">{t("ui-setup-sweat.tests.intro")}</p>

      {tests.length === 0 ? (
        <p className="text-body-sm text-muted">{t("ui-setup-sweat.tests.empty")}</p>
      ) : (
        <fieldset className="min-w-0">
          <legend className="caption mb-2 text-ink-2">{t("ui-setup-sweat.tests.legend")}</legend>
          <ul role="list" aria-label={t("ui-setup-sweat.tests.listLabel")} className="space-y-2">
            {tests.map((test, index) => {
              const result = results[index];
              const name = testName(t, test, index);
              const selected = test.id === selectedId;
              const confirming = confirmingId === test.id;
              const radioId = id(`${test.id}-use`);
              const questionId = id(`${test.id}-delete-question`);
              const inUse = selected && usingTest;
              const inUseId = id(`${test.id}-in-use`);
              const metaId = id(`${test.id}-meta`);
              const resultId = id(`${test.id}-result`);
              const meta = [
                test.date ? f.date(test.date) : t("ui-setup-sweat.tests.noDate"),
                t("ui-setup-sweat.tests.duration", { minutes: roundTo(test.durationMin, 1) }),
                describeConditions(t, test.conditions),
              ].join(" · ");
              return (
                <li
                  key={test.id}
                  data-testid={`sweat-test-${test.id}`}
                  data-selected={selected ? "true" : undefined}
                  className={cx(
                    "rounded-control border p-3",
                    selected ? "border-ink bg-surface" : "border-line bg-surface-2",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <input
                        id={radioId}
                        type="radio"
                        name={id("selected")}
                        checked={selected}
                        aria-describedby={[inUse ? inUseId : null, metaId, resultId].filter(Boolean).join(" ")}
                        onChange={() => set("sweat.selectedTestId", test.id)}
                        className="mt-3 size-5 shrink-0 cursor-pointer accent-ink"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <label htmlFor={radioId} className="flex min-h-11 cursor-pointer items-center font-semibold text-ink">
                            {name}
                          </label>
                          {inUse ? (
                            <Chip id={inUseId} tone="ok" icon={CircleCheck}>
                              {t("ui-setup-sweat.tests.inUse")}
                            </Chip>
                          ) : null}
                        </div>
                        <p id={metaId} className="text-body-sm text-ink-2">
                          {meta}
                        </p>
                        {result?.valid ? (
                          <p
                            id={resultId}
                            data-testid="sweat-test-result"
                            className="mt-1 flex flex-wrap items-baseline gap-x-2"
                          >
                            <span className="caption text-muted">{t("ui-setup-sweat.tests.measured")}</span>{" "}
                            <span className="num font-medium text-ink">
                              {t("ui-setup-sweat.tests.measuredValue", { rateLph: rateForText(result.rateLph) })}
                            </span>
                          </p>
                        ) : (
                          <div id={resultId} data-testid="sweat-test-result" className="mt-1 space-y-1 text-body-sm text-ink">
                            {(result?.problems ?? []).map((problem, i) => (
                              <p key={`${problem.key}-${i}`} className="flex items-start gap-1.5">
                                <Icon icon={TriangleAlert} size={16} className="mt-0.5 text-warn" />
                                <span>
                                  <span className="sr-only">{t("ui-setup-sweat.tests.cannotUse")}</span> {t(problem)}
                                </span>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0">
                      <Button
                        id={id(`${test.id}-edit`)}
                        variant="ghost"
                        iconOnly
                        icon={Pencil}
                        onClick={() => openEdit(test)}
                      >
                        {t("ui-setup-sweat.tests.edit", { name })}
                      </Button>
                      <Button
                        id={id(`${test.id}-delete`)}
                        variant="ghost"
                        iconOnly
                        icon={Trash2}
                        onClick={() => askDelete(test.id)}
                      >
                        {t("ui-setup-sweat.tests.delete", { name })}
                      </Button>
                    </div>
                  </div>
                  {confirming ? (
                    <div
                      role="group"
                      aria-labelledby={questionId}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          cancelDelete();
                        }
                      }}
                      className="mt-3 rounded-control border border-danger bg-danger-soft p-3 text-body-sm text-ink"
                    >
                      <p id={questionId} className="mb-2">
                        {t("ui-setup-sweat.tests.deleteQuestion", { name })}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="danger" icon={Trash2} onClick={confirmDelete}>
                          {t("ui-setup-sweat.tests.confirmDelete")}
                        </Button>
                        <Button id={id(`${test.id}-cancel-delete`)} onClick={cancelDelete}>
                          {t("ui-setup-sweat.tests.cancelDelete")}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}

      {form ? (
        <SweatTestForm
          key={form.testId ?? "new"}
          idPrefix={id("form")}
          mode={form.mode}
          initial={form.initial}
          onSave={saveForm}
          onCancel={closeForm}
          headingLevel={headingLevel}
        />
      ) : (
        <div>
          <Button id={id("add")} icon={Plus} onClick={openAdd} disabled={atLimit}>
            {t("ui-setup-sweat.tests.add")}
          </Button>
          {atLimit ? (
            <p className="mt-1 text-body-sm text-muted">{t("ui-setup-sweat.tests.limit", { max: maxTests })}</p>
          ) : null}
        </div>
      )}

      <div className="border-t border-line pt-3">
        <Switch
          id={id("calibrate")}
          checked={inputs.sweat.calibrate}
          onChange={(checked) => set("sweat.calibrate", checked)}
          label={t("ui-setup-sweat.calibration.label")}
          description={t("sweat.test.calibrateHelp")}
        />
        {measured?.valid && calibration ? (
          <p data-testid="sweat-calibration" className="mt-2 text-body-sm text-ink">
            {calibration.applied
              ? t(calibration.clamped ? "ui-setup-sweat.calibration.scaledAtLimit" : "ui-setup-sweat.calibration.scaled", {
                  measuredLph: rateForText(measured.rateLph),
                  rateLph: rateForText(plan.sweat.rateLph),
                  factor: roundTo(calibration.factor, 2),
                })
              : t("ui-setup-sweat.calibration.direct", { measuredLph: rateForText(measured.rateLph) })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
