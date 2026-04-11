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
import { ListRestart, ChevronRight } from "lucide-react";
import { sourceDataMap } from "../../constants/constants";
import TooltipInfo from "../shared/TooltipInfo";

const FinalRecipe = () => {
  const {
    recipeRef,
    recipeView,
    setRecipeView,
    gelsPerHour,
    setGelsPerHour,
    targetOsmolarity,
    setTargetOsmolarity,
    totals,
    calculatedSourceGrams,
    duration,
    getDisplayValue,
    onOpenInstructions,
    glucoseSources,
    fructoseSources,
    electrolyteSources
  } = useCalculatorContext();

  const recipeItems = [];

  glucoseSources.forEach(source => {
    if (source.percentage > 0) {
      const powderAmount = calculatedSourceGrams?.finalGrams?.[source.name] || 0;
      if (powderAmount > 0) {
        const data = sourceDataMap.get(source.name);
        let tooltipContent = null;
        if (data) {
          const totalCarbs = powderAmount * (data.carbsPerGram || 1);
          const gProvided = totalCarbs * (data.glucoseContent || 0);
          const fProvided = totalCarbs * (data.fructoseContent || 0);
          tooltipContent = (
            <div className="flex flex-col gap-1 text-left min-w-max">
              <span className="font-semibold">{getDisplayValue(totalCarbs)}g Total Carbs</span>
              <span className="text-xs text-slate-300">
                Glucose: {getDisplayValue(gProvided)}g | Fructose: {getDisplayValue(fProvided)}g
              </span>
            </div>
          );
        }
        
        recipeItems.push({
          label: source.name,
          value: `${getDisplayValue(powderAmount)}g`,
          color: "bg-[#5e5ce6]",
          tooltipContent,
        });
      }
    }
  });

  fructoseSources.forEach(source => {
    if (source.percentage > 0) {
      const powderAmount = calculatedSourceGrams?.finalGrams?.[source.name] || 0;
      if (powderAmount > 0) {
        const data = sourceDataMap.get(source.name);
        let tooltipContent = null;
        if (data) {
          const totalCarbs = powderAmount * (data.carbsPerGram || 1);
          const gProvided = totalCarbs * (data.glucoseContent || 0);
          const fProvided = totalCarbs * (data.fructoseContent || 0);
          tooltipContent = (
            <div className="flex flex-col gap-1 text-left min-w-max">
              <span className="font-semibold">{getDisplayValue(totalCarbs)}g Total Carbs</span>
              <span className="text-xs text-slate-300">
                Glucose: {getDisplayValue(gProvided)}g | Fructose: {getDisplayValue(fProvided)}g
              </span>
            </div>
          );
        }

        recipeItems.push({
          label: source.name,
          value: `${getDisplayValue(powderAmount)}g`,
          color: "bg-[#9333ea]",
          tooltipContent,
        });
      }
    }
  });

  electrolyteSources.forEach(source => {
    if (source.amount > 0) {
      recipeItems.push({
        label: source.name,
        value: `${getDisplayValue(source.amount)}mg`,
        color: "bg-[#2dd4bf]",
      });
    }
  });

  recipeItems.push({
    label: "Water",
    value: `${getDisplayValue(totals.water)}ml`,
    color: "bg-blue-400",
    noBorder: true,
  });

  return (
    <div
      ref={recipeRef}
      className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden sticky top-24"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ListRestart size={20} className="text-[#5e5ce6]" />
            <h3 className="text-lg font-bold text-slate-900">Final Recipe</h3>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setRecipeView("total")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${recipeView === "total" ? "bg-[#5e5ce6] text-white shadow-sm" : "text-slate-600"}`}
            >
              Total Batch
            </button>
            <button
              onClick={() => setRecipeView("perGel")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${recipeView === "perGel" ? "bg-[#5e5ce6] text-white shadow-sm" : "text-slate-600"}`}
            >
              Per Gel
            </button>
          </div>
        </div>

        {recipeView === "perGel" && (
          <div className="mb-6 p-4 bg-[#eef2ff] rounded-xl border border-[#c7d2fe] flex items-center justify-between">
            <label className="text-sm font-semibold text-[#5e5ce6]">
              Gels per Hour
            </label>
            <input
              type="number"
              value={gelsPerHour}
              onChange={(e) => setGelsPerHour(Number(e.target.value))}
              className="w-20 px-3 py-1.5 text-sm font-bold text-slate-800 text-right border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#5e5ce6]"
            />
          </div>
        )}

        <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-700">
            Target Osmolarity
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={targetOsmolarity}
              onChange={(e) => setTargetOsmolarity(Number(e.target.value))}
              className="w-20 px-3 py-1.5 text-sm font-bold text-slate-800 text-right border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#5e5ce6]"
            />
            <span className="text-sm text-slate-500">mOsm/L</span>
          </div>
        </div>

        <div className="text-sm text-slate-600 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
          {recipeView === "total"
            ? `Total batch for a ${(duration / 60).toFixed(1)} hour activity.`
            : `Amounts to mix for one single gel flask (${gelsPerHour} gels/hr).`}
        </div>

        <div className="space-y-4">
          {recipeItems.map((item, idx) => (
            <div
              key={idx}
              className={`flex justify-between items-center py-2 ${item.noBorder ? "pt-2" : "border-b border-slate-100 border-dashed"}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                <div className="flex items-center">
                  <span className="font-medium text-slate-700">{item.label}</span>
                  {item.tooltipContent && (
                    <TooltipInfo content={item.tooltipContent} />
                  )}
                </div>
              </div>
              <span className="font-bold text-slate-900">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 bg-slate-50 border-t border-slate-100">
        <button
          onClick={onOpenInstructions}
          className="w-full bg-[#5e5ce6] hover:bg-[#4b49c6] text-white font-semibold py-3.5 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 group"
        >
          View Mixing Instructions{" "}
          <ChevronRight
            size={18}
            className="group-hover:translate-x-1 transition-transform"
          />
        </button>
      </div>
    </div>
  );
};

export default FinalRecipe;
