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
import { useState } from "react";
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
import Toast from "../components/shared/Toast";
import VisualTimeline from "../components/feature/VisualTimeline";

export default function App() {
  const {} = useCalculatorContext();
  const [activeMobileTab, setActiveMobileTab] = useState('inputs'); // 'inputs', 'recipe', 'analysis'

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary pb-24 lg:pb-8 font-sans transition-colors duration-300">
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-3xl border-t border-card-border shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] z-40 pb-safe">
        <div className="flex justify-around items-center px-2 pt-2 pb-1">
          <button
            onClick={() => setActiveMobileTab('inputs')}
            className={`flex flex-col items-center gap-1 p-2 w-full transition-colors ${activeMobileTab === 'inputs' ? 'text-apple-blue' : 'text-text-secondary hover:text-text-primary'}`}
          >
            <SlidersHorizontal size={22} className={activeMobileTab === 'inputs' ? 'stroke-[2.5px]' : ''} />
            <span className="text-[10px] font-bold">Setup</span>
          </button>
          <button
            onClick={() => setActiveMobileTab('recipe')}
            className={`flex flex-col items-center gap-1 p-2 w-full transition-colors ${activeMobileTab === 'recipe' ? 'text-apple-blue' : 'text-text-secondary hover:text-text-primary'}`}
          >
            <Beaker size={22} className={activeMobileTab === 'recipe' ? 'stroke-[2.5px]' : ''} />
            <span className="text-[10px] font-bold">Recipe</span>
          </button>
          <button
            onClick={() => setActiveMobileTab('analysis')}
            className={`flex flex-col items-center gap-1 p-2 w-full transition-colors ${activeMobileTab === 'analysis' ? 'text-apple-blue' : 'text-text-secondary hover:text-text-primary'}`}
          >
            <PieChart size={22} className={activeMobileTab === 'analysis' ? 'stroke-[2.5px]' : ''} />
            <span className="text-[10px] font-bold">Analysis</span>
          </button>
        </div>
      </div>

      <MixingModal />
      <TemplateModal />
      <ShareModal />
      <Toast />
    </div>
  );
}
