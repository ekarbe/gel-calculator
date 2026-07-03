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

import { useCalculatorContext } from "../context/CalculatorContext";
import Header from "../components/feature/Header";
import ActivityBasics from "../components/feature/ActivityBasics";
import CarbMatrix from "../components/feature/CarbMatrix";
import ElectrolytesHydration from "../components/feature/ElectrolytesHydration";
import BalanceAnalysis from "../components/feature/BalanceAnalysis";
import FinalRecipe from "../components/feature/FinalRecipe";
import Footer from "../components/shared/Footer";
import MobileStickyBar from "../components/feature/MobileStickyBar";
import MixingModal from "../components/modal/MixingModal";
import TemplateModal from "../components/modal/TemplateModal";
import ShareModal from "../components/modal/ShareModal";
import Toast from "../components/shared/Toast";
import VisualTimeline from "../components/feature/VisualTimeline";

export default function App() {
  const {} = useCalculatorContext();
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary pb-28 lg:pb-8 font-sans transition-colors duration-300">
      <Header/>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-max">
          {/* Row 1 */}
          <div className="md:col-span-2">
            <ActivityBasics />
          </div>
          <div className="md:col-span-1">
            <ElectrolytesHydration />
          </div>

          {/* Row 2 */}
          <div className="md:col-span-2">
            <CarbMatrix />
          </div>
          <div className="md:col-span-1 row-span-2">
            <FinalRecipe />
          </div>

          {/* Row 3 */}
          <div className="md:col-span-1">
            <BalanceAnalysis />
          </div>
          <div className="md:col-span-1">
            <VisualTimeline />
          </div>
        </div>
      </main>

      <Footer />

      <MobileStickyBar />

      <MixingModal />
      <TemplateModal />
      <ShareModal />
      <Toast />
    </div>
  );
}
