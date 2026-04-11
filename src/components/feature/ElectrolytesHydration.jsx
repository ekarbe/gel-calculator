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
import { useState } from "react";
import { Droplet, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import Card from "../shared/Card";
import TooltipInfo from "../shared/TooltipInfo";
import { 
  electrolyteSourceOptions,
  SWEAT_RATES,
  SWEAT_RATE_DESCRIPTIONS,
  SALTINESS_DESCRIPTIONS,
  ELECTROLYTE_CONCENTRATIONS,
  CONVERSION_FACTORS
} from "../../constants/constants";

const ElectrolytesHydration = () => {
  const [isTargetsExpanded, setIsTargetsExpanded] = useState(false);
  const { 
    electrolyteSources, addSource, updateSource, removeSource,
    isSweatRate, setIsSweatRate, sweatRate, setSweatRate, saltiness, setSaltiness,
    activeElectrolytes, setActiveElectrolytes, manualTargets, setManualTargets, targetAmountsPerHour,
    autoFillElectrolytes
  } = useCalculatorContext();
  return (
    <Card>
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-[#eef2ff] p-2 rounded-lg text-[#5e5ce6]">
          <Droplet size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Electrolytes & Hydration
          </h2>
          <p className="text-sm text-slate-600">
            Calculate sodium and mineral losses.
          </p>
        </div>
      </div>
      <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
        <button 
          onClick={() => setIsSweatRate(true)}
          className={`flex-1 py-2 text-sm rounded-lg transition-colors ${isSweatRate ? 'font-semibold bg-white text-slate-800 shadow-sm border border-slate-200/60' : 'font-medium text-slate-600 hover:text-slate-800'}`}>
          Sweat Profile
        </button>
        <button 
          onClick={() => setIsSweatRate(false)}
          className={`flex-1 py-2 text-sm rounded-lg transition-colors ${!isSweatRate ? 'font-semibold bg-white text-slate-800 shadow-sm border border-slate-200/60' : 'font-medium text-slate-600 hover:text-slate-800'}`}>
          Manual Targets
        </button>
      </div>
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 ${!isSweatRate ? 'opacity-50 pointer-events-none' : ''}`}>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Sweat Rate
          </label>
          <select 
            value={sweatRate}
            onChange={(e) => setSweatRate(Number(e.target.value))}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none font-medium">
            {SWEAT_RATES.map((rate, index) => (
              <option key={rate} value={index}>
                {SWEAT_RATE_DESCRIPTIONS[index].split(':')[0]} ({rate} L/hr)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Saltiness
          </label>
          <select 
            value={saltiness}
            onChange={(e) => setSaltiness(Number(e.target.value))}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none font-medium">
            {SALTINESS_DESCRIPTIONS.map((desc, index) => {
              const mgPerL = Math.round(ELECTROLYTE_CONCENTRATIONS.Sodium[index] * CONVERSION_FACTORS.Sodium);
              return (
                <option key={index} value={index}>
                  {desc.split(':')[0]} ({mgPerL}mg/L)
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 mb-8">
        <button 
          onClick={() => setIsTargetsExpanded(!isTargetsExpanded)}
          className="flex items-center justify-between w-full mb-4 group focus:outline-none"
        >
          <h3 className="font-semibold text-slate-800">Electrolyte Targets (per hour)</h3>
          {isTargetsExpanded ? (
            <ChevronUp className="text-slate-400 group-hover:text-slate-600 transition-colors" size={20} />
          ) : (
            <ChevronDown className="text-slate-400 group-hover:text-slate-600 transition-colors" size={20} />
          )}
        </button>
        {isTargetsExpanded && (
          <div className="space-y-3">
            {['Sodium', 'Chloride', 'Potassium', 'Magnesium', 'Calcium'].map(electrolyte => (
              <div key={electrolyte} className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={activeElectrolytes[electrolyte]}
                    onChange={(e) => setActiveElectrolytes(prev => ({ ...prev, [electrolyte]: e.target.checked }))}
                    className="rounded text-[#5e5ce6] focus:ring-[#5e5ce6]"
                  />
                  <span className={`text-sm font-medium ${activeElectrolytes[electrolyte] ? 'text-slate-700' : 'text-slate-400'}`}>{electrolyte}</span>
                </label>
                {isSweatRate ? (
                  <span className={`text-sm font-bold ${activeElectrolytes[electrolyte] ? 'text-slate-900' : 'text-slate-400'}`}>
                    {activeElectrolytes[electrolyte] ? Math.round(targetAmountsPerHour[electrolyte]) : 0} mg
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={manualTargets[electrolyte] || 0}
                      onChange={(e) => setManualTargets(prev => ({ ...prev, [electrolyte]: Number(e.target.value) }))}
                      disabled={!activeElectrolytes[electrolyte]}
                      className="w-20 px-2 py-1 text-sm border border-slate-200 rounded-lg text-right font-bold disabled:bg-slate-50 disabled:text-slate-400 outline-none focus:ring-2 focus:ring-[#5e5ce6]"
                    />
                    <span className="text-sm text-slate-500 w-6">mg</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-6 border-t border-slate-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-800">Added Sources</h3>
          <div className="flex items-center gap-4">
            <button 
              onClick={autoFillElectrolytes}
              className="text-sm text-[#5e5ce6] font-medium flex items-center gap-1 hover:underline"
            >
              Auto-Fill
            </button>
            <button 
              onClick={() => addSource("electrolyte")}
              className="text-sm text-[#5e5ce6] font-medium flex items-center gap-1 hover:underline"
            >
              <Plus size={16} /> Add
            </button>
          </div>
        </div>
        <div className="space-y-4">
          {electrolyteSources.map((source) => {
            const currentOption = electrolyteSourceOptions.find(opt => opt.label === source.name);
            const tooltipContent = currentOption ? `Contains ${currentOption.components.map(c => `${(c.ratio * 100).toFixed(1)}% ${c.name}`).join(", ")}` : "";
            
            return (
              <div key={source.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-3 border border-slate-200 rounded-xl bg-white shadow-sm">
                <select 
                  value={source.name}
                  onChange={(e) => updateSource("electrolyte", source.id, "name", e.target.value)}
                  className="flex-1 min-w-[120px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none"
                >
                  {electrolyteSourceOptions.map((opt) => (
                    <option 
                      key={opt.label} 
                      value={opt.label}
                      disabled={electrolyteSources.some((s) => s.name === opt.label && s.id !== source.id)}
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
                <TooltipInfo content={tooltipContent} />
                <input
                  type="number"
                  value={source.amount}
                  onChange={(e) => updateSource("electrolyte", source.id, "amount", Number(e.target.value))}
                  className="w-24 px-3 py-2 text-sm border border-slate-200 rounded-lg text-right font-bold"
                />{" "}
                <span className="text-sm">mg</span>
                <button 
                  onClick={() => removeSource("electrolyte", source.id)}
                  className="text-slate-400 hover:text-red-500 p-2"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

export default ElectrolytesHydration;
