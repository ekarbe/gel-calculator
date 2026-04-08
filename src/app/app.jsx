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
import React, { useState, useEffect, useRef } from "react";
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

export default function App() {
  const {} = useCalculatorContext();
  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-800 pb-28 lg:pb-8 font-sans">
      <Header/>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            <ActivityBasics />
            <CarbMatrix />
            <ElectrolytesHydration />
          </div>

          <div className="lg:col-span-5 xl:col-span-4 space-y-6">
            <BalanceAnalysis />
            <FinalRecipe />
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
