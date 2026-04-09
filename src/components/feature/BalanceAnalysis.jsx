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
import { Settings } from "lucide-react";

const BalanceAnalysis = () => {
  const { totals, duration, targetCarbs, electrolyteAnalysis } = useCalculatorContext();
  const sodiumMatch = Math.min(100, Math.round(electrolyteAnalysis?.Sodium?.percentage || 0));
  const sodiumMessage = electrolyteAnalysis?.Sodium?.message || "No sources added";
  return (
    <div className="bg-[#1e1e2d] rounded-2xl shadow-xl shadow-[#5e5ce6]/10 p-6 text-white">
      <div className="flex items-center gap-2 mb-6">
        <Settings size={18} className="text-[#a2a0fa]" />
        <h3 className="font-bold text-lg">Balance Analysis</h3>
      </div>
      <div className="hidden sm:block pt-2 border-b border-slate-700 pb-5 mb-5">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-300 font-medium">
            Total Activity Carbs
          </span>
          <span className="text-white font-bold text-lg">
            {Math.round((duration / 60) * targetCarbs)}g
          </span>
        </div>
        <div className="text-xs text-slate-400 text-right">
          Targeting {targetCarbs}g / hour
        </div>
      </div>
      <div className="space-y-5">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-300 font-medium">Sodium Match</span>
            <span className="text-[#2dd4bf] font-bold">
              {sodiumMatch}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2dd4bf] rounded-full transition-all duration-300"
              style={{ width: `${sodiumMatch}%` }}
            ></div>
          </div>
          <div className="text-xs text-slate-400 mt-2">
            {sodiumMessage}
          </div>
        </div>
        <div className="pt-2">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-300 font-medium">
              Carb Pathway Limit
            </span>
            <span className="text-[#a2a0fa] font-bold">Optimal</span>
          </div>
          <div className="w-full h-1.5 bg-slate-700 rounded-full flex overflow-hidden">
            <div
              className="h-full bg-[#5e5ce6]"
              style={{ width: `${totals.glucoseRatio}%` }}
            ></div>
            <div
              className="h-full bg-[#9333ea]"
              style={{ width: `${totals.fructoseRatio}%` }}
            ></div>
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Ratio ({totals.glucoseRatio}:{totals.fructoseRatio})
          </div>
        </div>
      </div>
    </div>
  );
};

export default BalanceAnalysis;
