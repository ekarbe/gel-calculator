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

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { usePlan } from "../../state/PlanProvider";
import { warningsAnnouncement, warningsSummary } from "./boardText";

/**
 * How long the warnings must stay the same before the change is announced,
 * in ms: typing "75" passes through "7", and only the settled plan counts.
 */
export const WARNINGS_ANNOUNCE_DELAY_MS = 1000;

const noSubscribe = () => () => {};

/** True in the browser after hydration, false while rendering on the server. */
function useIsClient() {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Announces changes of the plan's warnings politely (design doc,
 * Accessibility: "warnings … announced politely"): a visually hidden,
 * polite, atomic live region with a short summary ("4 warnings, 1 danger"),
 * updated only when the number of warnings or dangers changes and has
 * stayed so for {@link WARNINGS_ANNOUNCE_DELAY_MS}. Nothing is announced on
 * load, and the list itself is not live (each keystroke would be read).
 *
 * The region is portalled to `<body>`, so it still speaks while the board
 * is hidden (the Setup tab on phones, where the setup is edited). It is a
 * plain `aria-live` region, not `role="status"`: the page's one status is
 * the toast.
 */
export default function BoardAnnouncer() {
  const t = useT();
  const f = useFormat();
  const plan = usePlan();
  const isClient = useIsClient();
  const { count, dangers } = warningsSummary(plan.warnings);
  const key = `${count}|${dangers}`;
  const text = warningsAnnouncement(t, f, { count, dangers });
  const lastKey = useRef(key);
  const latestText = useRef(text);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    latestText.current = text;
  });

  useEffect(() => {
    if (key === lastKey.current) return undefined;
    const timer = setTimeout(() => {
      lastKey.current = key;
      setAnnouncement(latestText.current);
    }, WARNINGS_ANNOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [key]);

  if (!isClient) return null;
  return createPortal(
    <div aria-live="polite" aria-atomic="true" data-testid="board-warnings-status" className="sr-only">
      {announcement}
    </div>,
    document.body,
  );
}
