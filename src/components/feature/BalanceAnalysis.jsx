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
  const { totals, duration, targetCarbs, electrolyteAnalysis, glucoseParts, fructoseParts, activeElectrolytes } = useCalculatorContext();

  const activeElectrolyteKeys = ['Sodium', 'Chloride', 'Potassium', 'Magnesium', 'Calcium'].filter(
    (key) => activeElectrolytes?.[key]
  );

  const glucoseCarbs = (totals.glucoseRatio / 100) * targetCarbs;
  const fructoseCarbs = (totals.fructoseRatio / 100) * targetCarbs;
  
  let pathwayStatus = "Optimal";
  let pathwayColor = "text-[#a2a0fa]";
  if (glucoseCarbs > 67 && fructoseCarbs > 53) {
    pathwayStatus = "Both Overloaded";
    pathwayColor = "text-red-400";
  } else if (glucoseCarbs > 67) {
    pathwayStatus = "SGLT1 Overload";
    pathwayColor = "text-orange-400";
  } else if (fructoseCarbs > 53) {
    pathwayStatus = "GLUT5 Overload";
    pathwayColor = "text-orange-400";
  }

  const formattedRatio = glucoseParts > 0 
    ? `1:${Number((fructoseParts / glucoseParts).toFixed(2))}`
    : `0:1`;

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
        {activeElectrolyteKeys.map(electrolyte => {
          const match = Math.min(100, Math.round(electrolyteAnalysis?.[electrolyte]?.percentage || 0));
          const message = electrolyteAnalysis?.[electrolyte]?.message || "No sources added";
          
          let colorClass = "text-[#2dd4bf]";
          let bgClass = "bg-[#2dd4bf]";
          if (match < 50) {
            colorClass = "text-red-400";
            bgClass = "bg-red-400";
          } else if (match < 80) {
            colorClass = "text-orange-400";
            bgClass = "bg-orange-400";
          } else if (match > 100) {
            colorClass = "text-orange-400";
            bgClass = "bg-orange-400";
          }

          return (
            <div key={electrolyte}>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-300 font-medium">{electrolyte} Match</span>
                <span className={`${colorClass} font-bold`}>
                  {match}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${bgClass} rounded-full transition-all duration-300`}
                  style={{ width: `${match}%` }}
                ></div>
              </div>
              <div className="text-xs text-slate-400 mt-2">
                {message}
              </div>
            </div>
          );
        })}
        <div className="pt-2">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-300 font-medium">
              Carb Pathway Limit
            </span>
            <span className={`${pathwayColor} font-bold`}>{pathwayStatus}</span>
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
            Ratio ({formattedRatio})
          </div>
        </div>
      </div>
    </div>
  );
};

export default BalanceAnalysis;
