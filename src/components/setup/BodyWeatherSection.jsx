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
import { ThermometerSun } from "lucide-react";
import Panel from "../ui/Panel";
import PanelHeader from "../ui/PanelHeader";
import BodyWeatherFields, { useBodyWeatherSummary } from "./BodyWeatherFields";
import { useT } from "../../i18n/useT";

export {
  BodyWeatherUnitsField,
  BodyWeatherMassField,
  BodyWeatherHeightField,
  BodyWeatherAcclimatisedField,
  BodyWeatherTemperatureField,
  BodyWeatherHumidityField,
  BodyWeatherSunField,
  BodyWeatherBodyFields,
  BodyWeatherWeatherFields,
  useBodyWeatherSummary,
} from "./BodyWeatherFields";
export { default as BodyWeatherFields } from "./BodyWeatherFields";

/**
 * The Body & weather setup section: the app-wide metric/imperial switch of
 * the UI prefs at the top (named "Units (whole app)"; Settings has it too),
 * then body mass, height and heat acclimatisation (group "Body"), then
 * temperature, humidity and sun (group "Weather").
 * These feed the heat-balance sweat estimate (acclimatisation only moves
 * the heat strain limit) and the per-kg doses. Fields show kg/lb, cm/in and
 * °C/°F per the prefs; the plan stores kg, cm and °C.
 *
 * A collapsible panel (open by default, a named region "Body & weather"):
 * the title is a disclosure button, and while closed the header shows a
 * one-line summary ("70 kg · 20 °C · 50%"). The fields stay mounted while
 * closed. The field groups are exported (`./BodyWeatherFields.jsx`) for
 * the guided flow.
 *
 * Must be rendered inside `PlanProvider` (and `UiProvider` for the prefs
 * and the unit switch; without it English, metric and no switch).
 */
export default function BodyWeatherSection() {
  const t = useT();
  const summary = useBodyWeatherSummary();
  const titleId = useId();
  const bodyId = useId();
  const [expanded, setExpanded] = useState(true);
  return (
    <Panel aria-labelledby={titleId} data-testid="setup-body-weather">
      <PanelHeader
        id={titleId}
        title={t("ui-setup-event.bodyWeather.title")}
        icon={ThermometerSun}
        expanded={expanded}
        onToggle={() => setExpanded((open) => !open)}
        controls={bodyId}
        description={expanded ? undefined : summary}
      />
      <div id={bodyId} hidden={!expanded} className="mt-4">
        <BodyWeatherFields />
      </div>
    </Panel>
  );
}
