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
import { Droplet, Plus, Trash2 } from "lucide-react";
import Card from "../shared/Card";
import TooltipInfo from "../shared/TooltipInfo";
import { electrolyteSourceOptions } from "../../constants/constants";

const ElectrolytesHydration = () => {
  const { electrolyteSources, addSource, updateSource, removeSource } = useCalculatorContext();
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
        <button className="flex-1 py-2 text-sm font-semibold bg-white text-slate-800 shadow-sm border border-slate-200/60 rounded-lg">
          Sweat Profile
        </button>
        <button className="flex-1 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">
          Manual Targets
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Sweat Rate
          </label>
          <select className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none font-medium">
            <option>Moderate (1.0 L/hr)</option>
            <option>Heavy (1.5 L/hr)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Saltiness
          </label>
          <select className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none font-medium">
            <option>Average (1000mg/L)</option>
            <option>Salty (1500mg/L)</option>
          </select>
        </div>
      </div>
      <div className="pt-6 border-t border-slate-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-800">Added Sources</h3>
          <button 
            onClick={() => addSource("electrolyte")}
            className="text-sm text-[#5e5ce6] font-medium flex items-center gap-1 hover:underline"
          >
            <Plus size={16} /> Add
          </button>
        </div>
        <div className="space-y-4">
          {electrolyteSources.map((source) => {
            const currentOption = electrolyteSourceOptions.find(opt => opt.label === source.name);
            const tooltipContent = currentOption ? `Contains ${currentOption.components.map(c => `${(c.ratio * 100).toFixed(1)}% ${c.name}`).join(", ")}` : "";
            
            return (
              <div key={source.id} className="flex items-center gap-2 p-3 border border-slate-200 rounded-xl bg-white shadow-sm">
                <select 
                  value={source.name}
                  onChange={(e) => updateSource("electrolyte", source.id, "name", e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none"
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
