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

import { Info } from "lucide-react";
import Disclosure from "../ui/Disclosure";
import Select from "../ui/Select";
import { useT } from "../../i18n/useT";
import { usePlanInputs } from "../../state/PlanProvider";
import { SWEAT_RATE_PRESETS_LPH, SWEAT_SODIUM_PRESETS_MMOL } from "../../domain/sweat";
import { sodiumMgPerL } from "./SweatHelpers";

/**
 * The presets tab: a self-assessed sweat rate (`sweat.rateIndex`), each
 * level named with its rate in the UI units; the hint under the select
 * describes the chosen level (linked with `aria-describedby`). Exported for
 * the guided flow.
 * @param {{ id?: string }} props  `id` is the select's id (default generated).
 */
export function SweatPresetField({ id }) {
  const t = useT();
  const { inputs, set } = usePlanInputs();
  const index = inputs.sweat.rateIndex;
  return (
    <div className="space-y-3" data-testid="sweat-preset-panel">
      <p className="text-body-sm text-ink-2">{t("ui-setup-sweat.preset.intro")}</p>
      <Select
        id={id}
        label={t("ui-setup-sweat.preset.label")}
        value={index}
        onChange={(value) => set("sweat.rateIndex", value)}
        options={SWEAT_RATE_PRESETS_LPH.map((rateLph, i) => ({
          value: i,
          label: t("ui-setup-sweat.preset.option", { name: t(`ui-setup-sweat.preset.${i}.name`), rateLph }),
        }))}
        hint={t(`ui-setup-sweat.preset.${index}.description`)}
      />
    </div>
  );
}

/**
 * Sweat saltiness (`sweat.saltinessIndex`): every sweat source uses it for
 * sweat sodium. Each level is named with its sodium in mg/L; the hint
 * describes the chosen level, and "About sweat saltiness" (a disclosure, in
 * place of the old hover tooltip) explains it. Exported for the guided flow.
 * @param {{ id?: string }} props  `id` is the select's id (default generated).
 */
export function SweatSaltinessField({ id }) {
  const t = useT();
  const { inputs, set } = usePlanInputs();
  const index = inputs.sweat.saltinessIndex;
  return (
    <div>
      <Select
        id={id}
        label={t("ui-setup-sweat.saltiness.label")}
        value={index}
        onChange={(value) => set("sweat.saltinessIndex", value)}
        options={SWEAT_SODIUM_PRESETS_MMOL.map((mmol, i) => ({
          value: i,
          label: t("ui-setup-sweat.saltiness.option", {
            name: t(`ui-setup-sweat.saltiness.${i}.name`),
            mgPerL: sodiumMgPerL(mmol),
          }),
        }))}
        hint={t(`ui-setup-sweat.saltiness.${index}.description`)}
      />
      <Disclosure
        summary={t("ui-setup-sweat.saltiness.about")}
        icon={Info}
        className="mt-1"
        buttonClassName="text-body-sm text-ink-2 hover:text-ink"
        panelClassName="mt-1 rounded-control border border-line bg-surface-2 p-3 text-body-sm text-ink-2"
      >
        <p>{t("ui-setup-sweat.saltiness.aboutText")}</p>
      </Disclosure>
    </div>
  );
}
