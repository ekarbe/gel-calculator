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

import { useCalculatorContext } from "../../context/CalculatorContext";
import React from "react";
import { Zap, Scale, Droplet, ChevronRight } from "lucide-react";

const MobileStickyBar = () => {
  const { totals, duration, targetCarbs, scrollToRecipe } =
    useCalculatorContext();
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] z-30 pb-safe">
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Zap size={14} className="text-[#5e5ce6]" fill="currentColor" />{" "}
            Target: {Math.round((duration / 60) * targetCarbs)}g
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
              <Scale size={12} className="text-[#a2a0fa]" /> Ratio:{" "}
              <span className="text-[#a2a0fa] font-bold">
                {totals.glucoseRatio}:{totals.fructoseRatio}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
              <Droplet
                size={12}
                className="text-[#2dd4bf]"
                fill="currentColor"
              />{" "}
              Na+:{" "}
              <span
                className={
                  totals.sodiumMatch >= 90
                    ? "text-[#2dd4bf] font-bold"
                    : "text-amber-500 font-bold"
                }
              >
                {totals.sodiumMatch}%
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={scrollToRecipe}
          className="bg-[#1e1e2d] text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 active:scale-95 transition-transform"
        >
          Recipe <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default MobileStickyBar;
