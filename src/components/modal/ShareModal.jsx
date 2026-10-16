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

import { useEffect, useId, useRef } from "react";
import { X, Link2, ImageIcon, Download, Copy } from "lucide-react";
import FuelBeakerIcon from "../shared/FuelBeakerIcon";
import Warnings from "../shared/Warnings";
import { fmt, formatRatio } from "../shared/format";
import { carbRecipeWarnings, recipeItemLabel } from "../shared/recipe";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { useUi, SHARE_MODAL } from "../../state/UiProvider";
import { encodeShareState } from "../../state/shareCodec";

/** Text color of a line on the share image, by item kind. */
const LINE_CLASSES = { salt: "text-apple-teal", caffeine: "text-apple-amber-ink" };

/**
 * The current page URL with the inputs in the `s` parameter (share link v3).
 * @param {unknown} inputs
 * @returns {string}
 */
export function buildShareUrl(inputs) {
  const url = new URL(window.location.href);
  url.searchParams.set("s", encodeShareState(inputs));
  return url.toString();
}

/**
 * Copies text to the clipboard. Uses the Clipboard API when the browser has
 * it, otherwise a hidden textarea with `execCommand('copy')`.
 * @param {string} text
 * @returns {Promise<boolean>} Whether the text was copied.
 */
async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or not focused: try the fallback below.
    }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "absolute";
  area.style.left = "-999999px";
  document.body.append(area);
  area.select();
  try {
    return typeof document.execCommand === "function" && document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/**
 * One headline number on the share image.
 * @param {{ label: string, value: string, align?: string, accent?: boolean }} props
 */
function Stat({ label, value, align = "text-left", accent = false }) {
  return (
    <div className={align}>
      <div className="text-xs text-text-secondary">{label}</div>
      <div className={`text-2xl font-bold pb-1 ${accent ? "text-apple-blue" : ""}`}>{value}</div>
    </div>
  );
}

/**
 * Share modal: copy a share link or make a recipe image.
 *
 * "Copy Link" encodes the current inputs with share codec v3
 * (`encodeShareState`) into the `?s=` parameter and copies the URL. The image
 * shows the plan's headline numbers (total carbs as the recipe delivers them),
 * the same recipe lines as the recipe card (`plan.recipe.items`) and, when the
 * recipe has no carbs, the plan's warning that says why. "Download" renders it
 * to PNG with the lazily loaded `html-to-image`. Open with
 * `useUi().openModal(SHARE_MODAL)`, which also starts on the menu view.
 */
export default function ShareModal() {
  const plan = usePlan();
  const { inputs } = usePlanInputs();
  const { isModalOpen, closeModal, shareView, setShareView, showToast } = useUi();
  const isOpen = isModalOpen(SHARE_MODAL);
  const imageRef = useRef(/** @type {HTMLDivElement|null} */ (null));
  const baseId = useId();
  const titleId = `${baseId}-title`;

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closeModal]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    let copied = false;
    try {
      copied = await copyText(buildShareUrl(inputs));
    } catch {
      copied = false;
    }
    if (copied) {
      showToast("Recipe link copied!");
      closeModal();
    } else {
      showToast("Could not copy the link.");
    }
  };

  const handleDownloadImage = async () => {
    if (!imageRef.current) return;
    try {
      const { toPng } = await import("html-to-image");
      const isDark = document.documentElement.classList.contains("dark");
      const dataUrl = await toPng(imageRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
      });
      const link = document.createElement("a");
      link.download = "gel-recipe.png";
      link.href = dataUrl;
      link.click();
      showToast("Image downloaded successfully!");
      closeModal();
    } catch (error) {
      console.error("Failed to generate image", error);
      showToast("Failed to generate image.");
    }
  };

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) closeModal();
  };

  const view = inputs.format.view;
  const carbWarnings = carbRecipeWarnings(plan);
  const gelCount = plan.gels.count;
  const gelText = `${fmt(gelCount)} ${gelCount === 1 ? "gel" : "gels"}`;
  const viewCaption =
    view === "perGel" && gelCount > 0
      ? `Per gel · ${gelText} in total`
      : `Total batch · ${fmt(plan.durationH, 1)} h · ${gelText}`;
  const perHour = [
    `Sodium ${fmt(plan.sodium.mgPerHour)} mg/h`,
    `Fluid ${fmt(plan.fluid.mlPerHour)} ml/h`,
    plan.caffeine.enabled ? `Caffeine ${fmt(plan.caffeine.totalMg)} mg` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-end sm:items-center p-0 sm:p-4"
      onClick={handleBackdropClick}
      data-testid="share-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-modal w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-card-border backdrop-blur-3xl"
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-card-border">
          <h3 id={titleId} className="font-bold text-lg text-text-primary">
            {shareView === "image" ? "Recipe Image" : "Share Recipe"}
          </h3>
          <button
            id={`${baseId}-close`}
            type="button"
            onClick={closeModal}
            aria-label="Close"
            className="text-text-secondary bg-card-border/30 p-1.5 rounded-full"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {shareView !== "image" ? (
          <div className="p-6 space-y-3">
            <button
              id={`${baseId}-copy-link`}
              type="button"
              onClick={handleCopyLink}
              className="w-full flex items-center gap-4 p-4 border border-card-border rounded-xl hover:border-apple-blue hover:bg-apple-blue/5 transition-all text-left group"
            >
              <div className="bg-apple-blue/10 p-2.5 rounded-lg text-apple-blue group-hover:bg-apple-blue/20 transition-colors">
                <Link2 size={20} aria-hidden="true" />
              </div>
              <div>
                <div className="font-semibold text-text-primary">Copy Link</div>
                <div className="text-xs text-text-secondary">Clickable web link</div>
              </div>
            </button>
            <button
              id={`${baseId}-generate-image`}
              type="button"
              onClick={() => setShareView("image")}
              className="w-full flex items-center gap-4 p-4 border border-card-border rounded-xl hover:border-apple-blue hover:bg-apple-blue/5 transition-all text-left group"
            >
              <div className="bg-apple-blue/10 p-2.5 rounded-lg text-apple-blue group-hover:bg-apple-blue/20 transition-colors">
                <ImageIcon size={20} aria-hidden="true" />
              </div>
              <div>
                <div className="font-semibold text-text-primary">Generate Image</div>
                <div className="text-xs text-text-secondary">Visual summary graphic</div>
              </div>
            </button>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="p-6 bg-card-border/50 flex justify-center overflow-y-auto">
              <div
                ref={imageRef}
                data-testid="share-image"
                className="bg-card text-text-primary p-8 rounded-2xl w-full max-w-[320px] h-fit min-h-[400px] flex flex-col relative ring-1 ring-card-border shrink-0"
              >
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-apple-blue to-apple-teal rounded-t-2xl"></div>
                <h1 className="text-2xl font-bold mb-8 flex items-center gap-2">
                  <FuelBeakerIcon className="w-6 h-6 text-apple-blue" fill="currentColor" /> Gel-Calculator
                </h1>
                <div className="flex justify-between items-end gap-2 mb-2">
                  <Stat label="TOTAL CARBS" value={`${fmt(plan.carbs.deliveredG)}g`} />
                  <Stat label="CARBS/HR" value={`${fmt(plan.carbs.gPerHour)}g`} align="text-center" />
                  <Stat label="RATIO" value={formatRatio(plan.carbs.ratio.value)} align="text-right" accent />
                </div>
                <p className="text-xs text-text-secondary mb-8 pb-6 border-b border-card-border/50">{perHour}</p>
                <Warnings warnings={carbWarnings} showCitations={false} className="mb-4" />
                <div className="text-xs font-semibold text-text-secondary mb-3">{viewCaption}</div>
                <ul aria-label="Recipe" className="space-y-4 flex-1">
                  {plan.recipe.items.map((item) => (
                    <li key={item.key} className={`flex justify-between gap-3 ${LINE_CLASSES[item.kind] ?? ""}`}>
                      <span>{recipeItemLabel(item)}</span>
                      <span className="font-semibold whitespace-nowrap">{item.display}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 pt-4 text-[10px] text-text-secondary text-center border-t border-card-border">
                  eikekarbe.com/gel-calculator
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-card-border flex gap-2 bg-card shrink-0">
              <button
                id={`${baseId}-back`}
                type="button"
                onClick={() => setShareView("menu")}
                className="px-4 py-3 text-text-secondary bg-card-border/50 rounded-full font-semibold hover:bg-card-border transition-colors"
              >
                Back
              </button>
              <button
                id={`${baseId}-image-copy-link`}
                type="button"
                onClick={handleCopyLink}
                className="flex-1 bg-apple-blue/10 text-apple-blue font-semibold py-3 rounded-full flex justify-center items-center gap-2 hover:bg-apple-blue/20 transition-colors"
              >
                <Copy size={18} aria-hidden="true" /> Copy Link
              </button>
              <button
                id={`${baseId}-download`}
                type="button"
                onClick={handleDownloadImage}
                className="flex-1 bg-apple-blue text-white font-semibold py-3 rounded-full flex justify-center items-center gap-2 hover:bg-apple-blue/90 transition-colors"
              >
                <Download size={18} aria-hidden="true" /> Download
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
