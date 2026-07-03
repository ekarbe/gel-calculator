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
import { Activity, Clock, Zap, BrainCircuit, Droplets, Thermometer, User, Dumbbell, Coffee, ShieldAlert } from "lucide-react";
import Card from "../shared/Card";

const ActivityBasics = () => {
  const { duration, setDuration, targetCarbs, setTargetCarbs, strategy } = useCalculatorContext();

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-[#eef2ff] p-2 rounded-lg text-[#5e5ce6]">
            <Activity size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Activity Basics</h2>
            <p className="text-sm text-slate-600">
              Define the scope and target intensity of your session.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Duration (Minutes)
          </label>
          <div className="relative">
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5e5ce6] focus:border-transparent outline-none transition-all font-semibold text-slate-800"
            />
            <Clock size={16} className="absolute right-3 top-3 text-slate-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Target Carbs (g/hr)
          </label>
          <div className="relative">
            <input
              type="number"
              value={targetCarbs}
              onChange={(e) => setTargetCarbs(Number(e.target.value))}
              disabled={strategy.isSmartSuggestions}
              className={`w-full pl-4 pr-10 py-2.5 border rounded-xl outline-none transition-all font-semibold ${
                strategy.isSmartSuggestions 
                  ? "bg-purple-50/50 border-purple-200 text-purple-700 cursor-not-allowed" 
                  : "border-slate-200 focus:ring-2 focus:ring-[#5e5ce6] focus:border-transparent text-slate-800"
              }`}
            />
            <Zap size={16} className={`absolute right-3 top-3 ${strategy.isSmartSuggestions ? "text-purple-400" : "text-slate-500"}`} />
          </div>
          {strategy.isSmartSuggestions && (
            <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
              <BrainCircuit size={12} /> Auto-calculated by physiological logic
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-6 mt-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-purple-100 p-1.5 rounded-lg text-purple-600">
              <BrainCircuit size={16} />
            </div>
            <h3 className="text-md font-bold text-slate-900">Smart Physiology Suggestions</h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={strategy.isSmartSuggestions}
              onChange={(e) => strategy.setIsSmartSuggestions(e.target.checked)}
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {strategy.isSmartSuggestions && (
          <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1"><User size={12}/> Weight (kg)</label>
                <input
                  type="number"
                  value={strategy.weight}
                  onChange={(e) => strategy.setWeight(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1"><User size={12}/> Gender</label>
                <select
                  value={strategy.gender}
                  onChange={(e) => strategy.setGender(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none bg-white"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1"><Dumbbell size={12}/> Intensity</label>
                <select
                  value={strategy.intensity}
                  onChange={(e) => strategy.setIntensity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none bg-white"
                >
                  <option value="recovery">Recovery (Zone 1-2)</option>
                  <option value="tempo">Tempo (Zone 3)</option>
                  <option value="threshold">Threshold (Zone 4)</option>
                  <option value="maximum">Maximum (Zone 5)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1"><Thermometer size={12}/> Temperature (°C)</label>
                <input
                  type="number"
                  value={strategy.temperature}
                  onChange={(e) => strategy.setTemperature(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1"><Droplets size={12}/> Humidity (%)</label>
                <input
                  type="number"
                  value={strategy.humidity}
                  onChange={(e) => strategy.setHumidity(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1"><Droplets size={12}/> Sweat Saltiness</label>
                <select
                  value={strategy.sweatSodiumConcentration}
                  onChange={(e) => strategy.setSweatSodiumConcentration(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none bg-white"
                >
                  <option value="low">Low (Light white marks)</option>
                  <option value="average">Average</option>
                  <option value="high">Salty (Heavy white crusting)</option>
                </select>
              </div>
              <div className="flex flex-col justify-end pb-1">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={strategy.ultraMode} onChange={(e) => strategy.setUltraMode(e.target.checked)}/>
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  <span className="ml-3 text-sm font-semibold text-slate-700 flex items-center gap-1">Ultra Mode (1:0.8 Ratio)</span>
                </label>
              </div>
            </div>

            <div className="border-t border-purple-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Coffee size={16} className="text-amber-600" />
                  <h4 className="text-sm font-bold text-slate-800">Caffeine Strategy</h4>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={strategy.includeCaffeine} onChange={(e) => strategy.setIncludeCaffeine(e.target.checked)}/>
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>
              
              {strategy.includeCaffeine && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Tolerance Profile</label>
                    <select
                      value={strategy.caffeineHabituation}
                      onChange={(e) => strategy.setCaffeineHabituation(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none bg-white"
                    >
                      <option value="naive">Naive (Sensitive)</option>
                      <option value="habituated">Habituated (Regular Consumer)</option>
                    </select>
                  </div>
                  {strategy.suggestedStrategies?.caffeineStrategy?.warning && (
                    <div className="bg-red-50 text-red-700 text-xs p-2 rounded-lg flex gap-2 items-start border border-red-100">
                      <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                      <p>{strategy.suggestedStrategies.caffeineStrategy.warning}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ActivityBasics;
