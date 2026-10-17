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

import { Calculator } from "lucide-react";
import Button from "../ui/Button";
import Segmented from "../ui/Segmented";
import WarningList from "../ui/WarningList";
import { useT } from "../../i18n/useT";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import {
  EventDurationField,
  EventEffortFields,
  EventIntensityField,
  EventSettingField,
  EventSportField,
} from "../setup/EventFields";
import BodyWeatherFields from "../setup/BodyWeatherFields";
import SweatTestPanel from "../setup/SweatTestPanel";
import SweatEstimatePanel from "../setup/SweatEstimatePanel";
import { SweatPresetField, SweatSaltinessField } from "../setup/SweatFields";
import RaceBoard, { revealSchedule } from "../board/RaceBoard";
import Schedule from "../schedule/Schedule";
import GuidedScreen from "./GuidedScreen";
import { useFocusRadioAfterRender } from "./guidedFocus";

/*  The guided screens other than the pantry (`GuidedPantry.jsx`). Each one
    is a `GuidedScreen` around setup field groups that read and write the
    plan inputs themselves, so guided and expert mode edit the same plan
    with the same controls. Props of every screen: `idPrefix` (unique ids),
    `headingId`, `headingRef` and `caption` (from the flow). */

/**
 * @typedef {{ idPrefix: string, headingId: string, headingRef?: import('react').Ref<HTMLHeadingElement>,
 *   caption: string }} GuidedScreenProps
 */

/**
 * Step 1, the event: sport, duration, intensity and what drives the effort
 * (speed and power, or METs). The "Why?" is the carb target's explanation.
 * @param {GuidedScreenProps} props
 */
export function GuidedEventScreen({ headingId, headingRef, caption }) {
  const t = useT();
  const plan = usePlan();
  return (
    <GuidedScreen
      screen="event"
      headingId={headingId}
      headingRef={headingRef}
      caption={caption}
      title={t("ui-guided.event.title")}
      reason={t("ui-guided.event.reason")}
      why={plan.carbs.recommended?.why}
    >
      <div className="space-y-4">
        <EventSportField />
        <EventDurationField />
        <EventIntensityField />
        <EventEffortFields />
      </div>
    </GuidedScreen>
  );
}

/**
 * Step 2, first screen: body and weather (the setup's group: the app-wide
 * unit switch, body mass, height, heat acclimatisation, temperature,
 * humidity, sun) and the setting (indoors or out). The "Why?" is the sweat
 * rate's explanation, which these drive.
 * @param {GuidedScreenProps} props
 */
export function GuidedConditionsScreen({ headingId, headingRef, caption }) {
  const t = useT();
  const plan = usePlan();
  return (
    <GuidedScreen
      screen="conditions"
      headingId={headingId}
      headingRef={headingRef}
      caption={caption}
      title={t("ui-guided.conditions.title")}
      reason={t("ui-guided.conditions.reason")}
      why={plan.sweat.why}
    >
      <BodyWeatherFields />
      <div className="border-t border-line pt-4">
        <EventSettingField />
      </div>
    </GuidedScreen>
  );
}

/**
 * Step 2, second screen: "Have you done a sweat test?" (Yes / No, a
 * segmented choice of the sweat source: Yes is the test, No the estimate).
 * Yes shows the setup's sweat test list and form (add, edit, pick, delete,
 * scale to the event); No shows the heat-balance estimate. A self-assessed
 * preset set in expert mode counts as No: it shows that preset and offers
 * the estimate instead (the focus then moves to the No option). Then the
 * sweat warnings and the sweat saltiness, which every source uses. The
 * "Why?" is the fluid target's explanation: what the sweat rate drives.
 * @param {GuidedScreenProps} props
 */
export function GuidedSweatScreen({ idPrefix, headingId, headingRef, caption }) {
  const t = useT();
  const plan = usePlan();
  const { inputs, set } = usePlanInputs();
  const focusRadio = useFocusRadioAfterRender();
  const source = inputs.sweat.source;
  const questionId = `${idPrefix}-question`;
  const hintId = `${idPrefix}-answer-hint`;
  const groupId = `${idPrefix}-answer`;
  const hintKey =
    source === "test" ? "ui-guided.sweat.yesHint" : source === "preset" ? "ui-guided.sweat.presetHint" : "ui-guided.sweat.noHint";

  return (
    <GuidedScreen
      screen="sweat"
      headingId={headingId}
      headingRef={headingRef}
      caption={caption}
      title={t("ui-guided.sweat.title")}
      reason={t("ui-guided.sweat.reason")}
      why={plan.fluid.recommended?.why}
    >
      <div>
        <p id={questionId} className="caption mb-1 text-ink-2">
          {t("ui-guided.sweat.question")}
        </p>
        <Segmented
          id={groupId}
          labelledBy={questionId}
          aria-describedby={hintId}
          value={source === "test" ? "yes" : "no"}
          onChange={(answer) => set("sweat.source", answer === "yes" ? "test" : "estimate")}
          options={[
            { value: "yes", label: t("ui-guided.sweat.yes") },
            { value: "no", label: t("ui-guided.sweat.no") },
          ]}
          fullWidth
          data-testid="guided-sweat-answer"
        />
        <p id={hintId} className="mt-1 text-body-sm text-muted">
          {t(hintKey)}
        </p>
      </div>
      {source === "test" ? <SweatTestPanel idPrefix={`${idPrefix}-tests`} headingLevel={3} /> : null}
      {source === "estimate" ? <SweatEstimatePanel /> : null}
      {source === "preset" ? (
        <div className="space-y-3">
          <SweatPresetField id={`${idPrefix}-rate`} />
          <Button
            size="sm"
            icon={Calculator}
            onClick={() => {
              focusRadio(groupId);
              set("sweat.source", "estimate");
            }}
          >
            {t("ui-guided.sweat.useEstimate")}
          </Button>
        </div>
      ) : null}
      <WarningList warnings={plan.sweat.warnings} />
      <SweatSaltinessField id={`${idPrefix}-saltiness`} />
    </GuidedScreen>
  );
}

/**
 * Step 4, recipe and plan: the Race board (its heading one level below the
 * screen's), then the full schedule. The board's "Full schedule" moves the
 * focus to the schedule below it. No "Why?" of its own: every number on
 * the board has one.
 * @param {GuidedScreenProps} props
 */
export function GuidedPlanScreen({ headingId, headingRef, caption }) {
  const t = useT();
  return (
    <>
      <GuidedScreen
        screen="board"
        headingId={headingId}
        headingRef={headingRef}
        caption={caption}
        title={t("ui-guided.board.title")}
        reason={t("ui-guided.board.reason")}
        panel={false}
      >
        <RaceBoard headingLevel={3} onShowSchedule={revealSchedule} />
      </GuidedScreen>
      <Schedule />
    </>
  );
}
