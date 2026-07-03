/* Gel-Calculator - Personalized fuel calculator for endurance athletes.
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
import { FlaskConical, Scale, Minus, Plus, Trash2 } from "lucide-react";
import Card from "../shared/Card";
import TooltipInfo from "../shared/TooltipInfo";
import { glucoseSourceOptions, fructoseSourceOptions, sourceDataMap } from "../../constants/constants";

const CarbMatrix = () => {
  const { 
    glucoseParts, 
    setGlucoseParts, 
    fructoseParts, 
    setFructoseParts,
    glucoseSources,
    fructoseSources,
    addSource,
    updateSource,
    removeSource,
    calculatedSourceGrams,
    strategy
  } = useCalculatorContext();

  const totalGlucosePercentage = glucoseSources.reduce((sum, s) => sum + (s.percentage || 0), 0);
  const totalFructosePercentage = fructoseSources.reduce((sum, s) => sum + (s.percentage || 0), 0);

  return (
    <Card>
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-apple-blue/10 p-2 rounded-lg text-apple-blue">
          <FlaskConical size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">
            Carbohydrate Matrix
          </h2>
          <p className="text-sm text-text-secondary">
            Optimize your glucose to fructose ratio for maximum absorption.
          </p>
        </div>
      </div>

      <div className="bg-card-border/30 rounded-xl p-5 border border-card-border mb-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Scale size={18} className="text-apple-blue" />
            <span className="font-semibold text-text-primary flex items-center">Pathway Ratio <TooltipInfo content="Your gut uses different pathways to absorb carbohydrates (SGLT1 for glucose, GLUT5 for fructose). A 1:0.8 ratio maximizes total hourly absorption without overwhelming a single pathway." /></span>
          </div>
          <div className="text-sm bg-card px-3 py-1 rounded-lg border border-card-border shadow-sm">
            Target:{" "}
            <strong className="text-text-primary">
              {glucoseParts.toFixed(2)} : {fructoseParts.toFixed(2)}
            </strong>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex justify-between text-xs text-text-secondary mb-2">
              <span className="font-medium">Glucose Parts</span>
              <span className="font-bold text-text-primary">
                {glucoseParts.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() =>
                  setGlucoseParts((p) =>
                    Math.max(0.0, Number((p - 0.05).toFixed(2))),
                  )
                }
                disabled={strategy.isSmartSuggestions}
                className={`w-8 h-8 shrink-0 flex items-center justify-center bg-card border border-card-border rounded-full shadow-sm ${strategy.isSmartSuggestions ? 'opacity-50 cursor-not-allowed' : 'text-text-secondary hover:border-[#007AFF] hover:text-apple-blue'}`}
              >
                <Minus size={14} />
              </button>
              <input
                type="range"
                min="0.0"
                max="2.0"
                step="0.05"
                value={glucoseParts}
                onChange={(e) => setGlucoseParts(Number(e.target.value))}
                disabled={strategy.isSmartSuggestions}
                className={`w-full h-2.5 bg-apple-blue/20 rounded-lg appearance-none accent-apple-blue ${strategy.isSmartSuggestions ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
              />
              <button
                onClick={() =>
                  setGlucoseParts((p) =>
                    Math.min(2.0, Number((p + 0.05).toFixed(2))),
                  )
                }
                disabled={strategy.isSmartSuggestions}
                className={`w-8 h-8 shrink-0 flex items-center justify-center bg-card border border-card-border rounded-full shadow-sm ${strategy.isSmartSuggestions ? 'opacity-50 cursor-not-allowed' : 'text-text-secondary hover:border-[#007AFF] hover:text-apple-blue'}`}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-text-secondary mb-2">
              <span className="font-medium">Fructose Parts</span>
              <span className="font-bold text-text-primary">
                {fructoseParts.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() =>
                  setFructoseParts((p) =>
                    Math.max(0.0, Number((p - 0.05).toFixed(2))),
                  )
                }
                disabled={strategy.isSmartSuggestions}
                className={`w-8 h-8 shrink-0 flex items-center justify-center bg-card border border-card-border rounded-full shadow-sm ${strategy.isSmartSuggestions ? 'opacity-50 cursor-not-allowed' : 'text-text-secondary hover:border-[#AF52DE] hover:text-[#AF52DE]'}`}
              >
                <Minus size={14} />
              </button>
              <input
                type="range"
                min="0.0"
                max="2.0"
                step="0.05"
                value={fructoseParts}
                onChange={(e) => setFructoseParts(Number(e.target.value))}
                disabled={strategy.isSmartSuggestions}
                className={`w-full h-2.5 bg-apple-blue/20 rounded-lg appearance-none accent-[#AF52DE] ${strategy.isSmartSuggestions ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
              />
              <button
                onClick={() =>
                  setFructoseParts((p) =>
                    Math.min(2.0, Number((p + 0.05).toFixed(2))),
                  )
                }
                disabled={strategy.isSmartSuggestions}
                className={`w-8 h-8 shrink-0 flex items-center justify-center bg-card border border-card-border rounded-full shadow-sm ${strategy.isSmartSuggestions ? 'opacity-50 cursor-not-allowed' : 'text-text-secondary hover:border-[#AF52DE] hover:text-[#AF52DE]'}`}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        {!calculatedSourceGrams?.canAchieveRatio && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-3">
            <span className="font-bold shrink-0 mt-0.5">⚠️ Warning:</span>
            <p>
              The target ratio cannot be achieved with the current sources. 
              Please add a source to cover the missing carbohydrates or adjust your ratio.
            </p>
          </div>
        )}
      </div>

      {/* Source Groups */}
      <div className="space-y-6">
        {/* Glucose Sources */}
        <div className="p-5 rounded-xl border border-card-border bg-card-border/30">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-apple-blue"></div> Glucose
              Sources
            </h3>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-semibold px-2 py-1 rounded-md border transition-colors ${
                totalGlucosePercentage > 100 
                  ? "text-apple-red bg-apple-red/10 border-apple-red/30" 
                  : totalGlucosePercentage === 100 
                    ? "text-apple-green bg-apple-green/10 border-apple-green/30"
                    : "text-apple-amber bg-apple-amber/10 border-apple-amber/30"
              }`}>
                {totalGlucosePercentage > 100 
                  ? `Over by ${totalGlucosePercentage - 100}%` 
                  : totalGlucosePercentage === 100 
                    ? "100% Allocated" 
                    : `${100 - totalGlucosePercentage}% Remaining`}
              </span>
              <button 
                onClick={() => addSource("glucose")}
                className="text-xs text-apple-blue font-medium flex items-center gap-1 hover:underline"
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {glucoseSources.map((source) => (
              <div key={source.id} className={`flex flex-wrap sm:flex-nowrap items-center gap-2 p-3 border rounded-xl bg-card shadow-sm transition-colors ${totalGlucosePercentage > 100 ? 'border-red-200/60' : 'border-blue-200/60'}`}>
                <select 
                  value={source.name}
                  onChange={(e) => updateSource("glucose", source.id, "name", e.target.value)}
                  className="flex-1 min-w-[120px] bg-card-border/30 border border-card-border rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 outline-none"
                >
                  {glucoseSourceOptions.map((opt) => (
                    <option 
                      key={opt.label} 
                      value={opt.label}
                      disabled={glucoseSources.some((s) => s.name === opt.label && s.id !== source.id)}
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
                <TooltipInfo content={
                  <div className="flex flex-col gap-1 text-left">
                    <span className="font-semibold">{(sourceDataMap.get(source.name)?.carbsPerGram || 1.00).toFixed(2)}g Carbs / 1g</span>
                    <span className="text-xs text-text-secondary">
                      Glucose: {((sourceDataMap.get(source.name)?.glucoseContent || 0) * 100).toFixed(0)}% | Fructose: {((sourceDataMap.get(source.name)?.fructoseContent || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                } />
                <div className={`flex items-center gap-1 text-sm bg-card-border/30 px-3 py-2 rounded-lg border ml-1 transition-colors ${totalGlucosePercentage > 100 ? 'border-red-200' : 'border-card-border'}`}>
                  <input
                    type="number"
                    min="0"
                    value={source.percentage === 0 ? '' : source.percentage}
                    placeholder="0"
                    onChange={(e) => {
                      let val = Number(e.target.value);
                      if (val < 0) val = 0; // Only block negative numbers
                      updateSource("glucose", source.id, "percentage", val);
                    }}
                    className={`w-12 bg-transparent outline-none font-semibold text-right transition-colors ${totalGlucosePercentage > 100 ? 'text-red-600' : 'text-text-primary'}`}
                  />
                  <span className={totalGlucosePercentage > 100 ? "text-red-400" : "text-text-secondary"}>%</span>
                </div>
                <button 
                  onClick={() => removeSource("glucose", source.id)}
                  className="text-text-secondary hover:text-red-500 p-2"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Fructose Sources */}
        <div className="p-5 rounded-xl border border-card-border bg-card-border/30">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-apple-purple"></div> Fructose
              Sources
            </h3>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-semibold px-2 py-1 rounded-md border transition-colors ${
                totalFructosePercentage > 100 
                  ? "text-apple-red bg-apple-red/10 border-apple-red/30" 
                  : totalFructosePercentage === 100 
                    ? "text-apple-green bg-apple-green/10 border-apple-green/30"
                    : "text-apple-amber bg-apple-amber/10 border-apple-amber/30"
              }`}>
                {totalFructosePercentage > 100 
                  ? `Over by ${totalFructosePercentage - 100}%` 
                  : totalFructosePercentage === 100 
                    ? "100% Allocated" 
                    : `${100 - totalFructosePercentage}% Remaining`}
              </span>
              <button 
                onClick={() => addSource("fructose")}
                className="text-xs text-[#AF52DE] font-medium flex items-center gap-1 hover:underline"
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {fructoseSources.map((source) => (
              <div key={source.id} className={`flex flex-wrap sm:flex-nowrap items-center gap-2 p-3 border rounded-xl bg-card shadow-sm transition-colors ${totalFructosePercentage > 100 ? 'border-red-200/60' : 'border-apple-blue/30/60'}`}>
                <select 
                  value={source.name}
                  onChange={(e) => updateSource("fructose", source.id, "name", e.target.value)}
                  className="flex-1 min-w-[120px] bg-card-border/30 border border-card-border rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 outline-none"
                >
                  {fructoseSourceOptions.map((opt) => (
                    <option 
                      key={opt.label} 
                      value={opt.label}
                      disabled={fructoseSources.some((s) => s.name === opt.label && s.id !== source.id)}
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
                <TooltipInfo content={
                  <div className="flex flex-col gap-1 text-left">
                    <span className="font-semibold">{(sourceDataMap.get(source.name)?.carbsPerGram || 1.00).toFixed(2)}g Carbs / 1g</span>
                    <span className="text-xs text-text-secondary">
                      Glucose: {((sourceDataMap.get(source.name)?.glucoseContent || 0) * 100).toFixed(0)}% | Fructose: {((sourceDataMap.get(source.name)?.fructoseContent || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                } />
                <div className={`flex items-center gap-1 text-sm bg-card-border/30 px-3 py-2 rounded-lg border ml-1 transition-colors ${totalFructosePercentage > 100 ? 'border-red-200' : 'border-card-border'}`}>
                  <input
                    type="number"
                    min="0"
                    value={source.percentage === 0 ? '' : source.percentage}
                    placeholder="0"
                    onChange={(e) => {
                      let val = Number(e.target.value);
                      if (val < 0) val = 0; // Only block negative numbers
                      updateSource("fructose", source.id, "percentage", val);
                    }}
                    className={`w-12 bg-transparent outline-none font-semibold text-right transition-colors ${totalFructosePercentage > 100 ? 'text-red-600' : 'text-text-primary'}`}
                  />
                  <span className={totalFructosePercentage > 100 ? "text-red-400" : "text-text-secondary"}>%</span>
                </div>
                <button 
                  onClick={() => removeSource("fructose", source.id)}
                  className="text-text-secondary hover:text-red-500 p-2"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default CarbMatrix;