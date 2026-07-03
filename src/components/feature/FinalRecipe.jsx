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
import Card from "../shared/Card";

const FinalRecipe = () => {
  const {
    recipeRef,
    recipeView,
    setRecipeView,
    gelsPerHour,
    setGelsPerHour,
    totals,
    calculatedSourceGrams,
    duration,
    getDisplayValue,
    onOpenInstructions,
    glucoseSources,
    fructoseSources,
    electrolyteSources,
    strategy,
    targetCarbs
  } = useCalculatorContext();

  const durationHours = duration / 60;
  const costAnalysis = strategy.getCostAnalysis(targetCarbs * durationHours);

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
              <span className="text-xs text-text-secondary">
                Glucose: {getDisplayValue(gProvided)}g | Fructose: {getDisplayValue(fProvided)}g
              </span>
            </div>
          );
        }
        
        recipeItems.push({
          label: source.name,
          value: `${getDisplayValue(powderAmount)}g`,
          color: "bg-apple-blue",
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
              <span className="text-xs text-text-secondary">
                Glucose: {getDisplayValue(gProvided)}g | Fructose: {getDisplayValue(fProvided)}g
              </span>
            </div>
          );
        }

        recipeItems.push({
          label: source.name,
          value: `${getDisplayValue(powderAmount)}g`,
          color: "bg-apple-purple",
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

  return (
    <div ref={recipeRef} className="sticky top-24">
      <Card className="!p-0 flex flex-col h-full">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ListRestart size={20} className="text-apple-blue" />
            <h3 className="text-lg font-bold text-text-primary">Final Recipe</h3>
          </div>
          <div className="flex bg-card-border/50 p-1 rounded-lg">
            <button
              onClick={() => setRecipeView("total")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${recipeView === "total" ? "bg-apple-blue text-text-primary shadow-sm" : "text-text-secondary"}`}
            >
              Total Batch
            </button>
            <button
              onClick={() => setRecipeView("perGel")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${recipeView === "perGel" ? "bg-apple-blue text-text-primary shadow-sm" : "text-text-secondary"}`}
            >
              Per Gel
            </button>
          </div>
        </div>

        {recipeView === "perGel" && (
          <div className="mb-6 p-4 bg-apple-blue/10 rounded-xl border border-[#c7d2fe] flex items-center justify-between">
            <label className="text-sm font-semibold text-apple-blue">
              Gels per Hour
            </label>
            <input
              type="number"
              value={gelsPerHour}
              onChange={(e) => setGelsPerHour(Number(e.target.value))}
              className="w-20 px-3 py-1.5 text-sm font-bold text-text-primary text-right border border-card-border rounded-lg outline-none focus:ring-2 focus:ring-[#007AFF]"
            />
          </div>
        )}

        <div className="text-sm text-text-secondary mb-6 bg-card-border/30 p-3 rounded-xl border border-card-border">
          {recipeView === "total"
            ? `Total batch for a ${(duration / 60).toFixed(1)} hour activity.`
            : `Amounts to mix for one single gel flask (${gelsPerHour} gels/hr).`}
        </div>

        <div className="space-y-4">
          {recipeItems.map((item, idx) => (
            <div
              key={idx}
              className={`flex justify-between items-center py-2 ${item.noBorder ? "pt-2" : "border-b border-card-border border-dashed"}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                <div className="flex items-center">
                  <span className="font-medium text-text-primary">{item.label}</span>
                  {item.tooltipContent && (
                    <TooltipInfo content={item.tooltipContent} />
                  )}
                </div>
              </div>
              <span className="font-bold text-text-primary">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 py-4 bg-apple-green/10 border-t border-card-border flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-text-primary">Est. Cost (DIY)</h4>
          <p className="text-xs text-text-secondary">${costAnalysis.diyTotal.toFixed(2)}</p>
        </div>
        <div className="text-right">
          <h4 className="text-sm font-bold text-apple-green">You Save</h4>
          <p className="text-xs font-semibold text-apple-green/80">${costAnalysis.savings.toFixed(2)} vs Commercial</p>
        </div>
      </div>

      <div className="p-6 bg-card-border/30 border-t border-card-border rounded-b-[2rem]">
        <button
          onClick={onOpenInstructions}
          className="w-full bg-apple-blue hover:bg-[#4b49c6] text-text-primary font-semibold py-3.5 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 group"
        >
          View Mixing Instructions{" "}
          <ChevronRight
            size={18}
            className="group-hover:translate-x-1 transition-transform"
          />
        </button>
      </div>
      </Card>
    </div>
  );
};

export default FinalRecipe;
