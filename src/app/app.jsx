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

import { useEffect, useState } from "react";
import { useUi } from "../state/UiProvider";
import { usePlanInputs } from "../state/PlanProvider";
import { SlidersHorizontal, Beaker, PieChart } from "lucide-react";
import Header from "../components/feature/Header";
import ActivityBasics from "../components/feature/ActivityBasics";
import CarbMatrix from "../components/feature/CarbMatrix";
import ElectrolytesHydration from "../components/feature/ElectrolytesHydration";
import BalanceAnalysis from "../components/feature/BalanceAnalysis";
import FinalRecipe from "../components/feature/FinalRecipe";
import Footer from "../components/shared/Footer";
import MixingModal from "../components/modal/MixingModal";
import TemplateModal from "../components/modal/TemplateModal";
import ShareModal from "../components/modal/ShareModal";
import RecipesModal from "../components/modal/RecipesModal";
import Toast from "../components/shared/Toast";
import VisualTimeline from "../components/feature/VisualTimeline";
import PrintRecipe from "../components/feature/PrintRecipe";

/** How long the "share link could not be loaded" notice stays, in ms. */
const SHARE_LINK_NOTICE_MS = 8000;

/** Phone bottom-bar tabs: which group of cards each one shows. */
const MOBILE_TABS = [
  { id: "inputs", label: "Setup", Icon: SlidersHorizontal },
  { id: "recipe", label: "Recipe", Icon: Beaker },
  { id: "analysis", label: "Analysis", Icon: PieChart },
];

/**
 * The calculator layout: header, input cards, recipe, analysis and schedule,
 * footer, the phone tab bar, the modals (mixing, templates, share, my
 * recipes) and the toast, plus the print view.
 *
 * Must be rendered inside `PlanProvider` and `UiProvider` (see `page.jsx`).
 * The toast text comes from `useUi()`. When the page was opened with a share
 * link that could not be read (damaged, or from an older version), a toast
 * says so (the provider then shows the autosaved or the default plan). On
 * phones one tab group is shown at a time; from the `md` breakpoint up every
 * card is visible.
 *
 * Printing (the recipe card's "Print / save as PDF", or the browser's print
 * command) hides the whole app (`print:hidden`) and shows `PrintRecipe`
 * instead, which is hidden on screen (`hidden print:block`).
 */
export default function App() {
  const { toastMessage, showToast } = useUi();
  const { shareLinkFailed } = usePlanInputs();
  const [activeMobileTab, setActiveMobileTab] = useState("inputs");

  useEffect(() => {
    if (shareLinkFailed) {
      showToast(
        "This share link is from an older version or is damaged, so it could not be opened.",
        SHARE_LINK_NOTICE_MS,
      );
    }
  }, [shareLinkFailed, showToast]);

  return (
    <>
      <div
        data-testid="app-content"
        className="min-h-screen bg-bg-primary text-text-primary pb-24 lg:pb-8 font-sans transition-colors duration-300 print:hidden"
      >
        <Header/>

        <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-max">
            {/* Inputs Tab (Mobile) / Row 1 & 2 (Desktop) */}
            <div className={`md:col-span-2 space-y-6 ${activeMobileTab === 'inputs' ? 'block' : 'hidden md:block'}`}>
              <ActivityBasics />
              <ElectrolytesHydration />
              <CarbMatrix />
            </div>

            {/* Recipe Tab (Mobile) / Row 1 & 2 (Desktop) */}
            <div className={`md:col-span-1 md:row-span-2 ${activeMobileTab === 'recipe' ? 'block' : 'hidden md:block'}`}>
              <FinalRecipe />
            </div>

            {/* Analysis Tab (Mobile) / Row 3 (Desktop) */}
            <div className={`md:col-span-1 ${activeMobileTab === 'analysis' ? 'block' : 'hidden md:block'}`}>
              <BalanceAnalysis />
            </div>
            <div className={`md:col-span-1 ${activeMobileTab === 'analysis' ? 'block' : 'hidden md:block'}`}>
              <VisualTimeline />
            </div>
          </div>
        </main>

        <Footer />

        {/* Mobile Tab Bar */}
        <nav aria-label="Sections" className="md:hidden fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-3xl border-t border-card-border shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] z-40 pb-safe">
          <div className="flex justify-around items-center px-2 pt-2 pb-1">
            {MOBILE_TABS.map(({ id, label, Icon }) => {
              const active = activeMobileTab === id;
              return (
                <button
                  key={id}
                  id={`mobile-tab-${id}`}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveMobileTab(id)}
                  className={`flex flex-col items-center gap-1 p-2 w-full transition-colors ${active ? 'text-apple-blue' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  <Icon size={22} aria-hidden="true" className={active ? 'stroke-[2.5px]' : ''} />
                  <span className="text-[10px] font-bold">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <MixingModal />
        <TemplateModal />
        <ShareModal />
        <RecipesModal />
        <Toast message={toastMessage} visible={Boolean(toastMessage)} />
      </div>
      <PrintRecipe />
    </>
  );
}
