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
import TooltipInfo from "../shared/TooltipInfo";

const ActivityBasics = () => {
  const { duration, setDuration, targetCarbs, setTargetCarbs, strategy } = useCalculatorContext();

  const handleDurationChange = (type, value) => {
    let newHours = Math.floor(duration / 60);
    let newMinutes = duration % 60;
    
    if (type === "hours") newHours = parseInt(value) || 0;
    if (type === "minutes") newMinutes = parseInt(value) || 0;
    
    setDuration((newHours * 60) + newMinutes);
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-apple-blue/10 p-2 rounded-lg text-apple-blue">
            <Activity size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-primary">Activity Basics</h2>
            <p className="text-sm text-text-secondary">
              Define the scope and target intensity of your session.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Duration (Hours)
            </label>
            <input
              type="number"
              min="0"
              value={Math.floor(duration / 60)}
              onChange={(e) => handleDurationChange("hours", e.target.value)}
              className="w-full px-4 py-2.5 border border-card-border rounded-xl outline-none font-medium text-text-primary bg-card"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              (Minutes)
            </label>
            <input
              type="number"
              min="0"
              max="59"
              value={duration % 60}
              onChange={(e) => handleDurationChange("minutes", e.target.value)}
              className="w-full px-4 py-2.5 border border-card-border rounded-xl outline-none font-medium text-text-primary bg-card"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-text-primary mb-1.5 flex items-center">
            Target Carbs (g/hr)
            <TooltipInfo content="How many grams of carbohydrates you aim to consume per hour of exercise. Standard endurance targets are 60-90g/hr, but can go up to 120g/hr with gut training." />
          </label>
          <div className="relative">
            <input
              type="number"
              value={targetCarbs}
              onChange={(e) => setTargetCarbs(Number(e.target.value))}
              disabled={strategy.isSmartSuggestions}
              className={`w-full pl-4 pr-10 py-2.5 border rounded-xl outline-none transition-all font-semibold ${
                strategy.isSmartSuggestions 
                  ? "bg-apple-blue/10 border-apple-blue/30 text-apple-blue cursor-not-allowed" 
                  : "border-card-border focus:ring-2 focus:ring-[#007AFF] focus:border-transparent text-text-primary"
              }`}
            />
            <Zap size={16} className={`absolute right-3 top-3 ${strategy.isSmartSuggestions ? "text-apple-blue/70" : "text-text-secondary"}`} />
          </div>
          {strategy.isSmartSuggestions && (
            <p className="text-xs text-apple-blue mt-1 flex items-center gap-1">
              <BrainCircuit size={12} /> Auto-calculated by physiological logic
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-card-border pt-6 mt-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-apple-blue/20 p-1.5 rounded-lg text-apple-blue">
              <BrainCircuit size={16} />
            </div>
            <h3 className="text-md font-bold text-text-primary">Smart Physiology Suggestions</h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={strategy.isSmartSuggestions}
              onChange={(e) => strategy.setIsSmartSuggestions(e.target.checked)}
            />
            <div className="w-11 h-6 bg-card-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-card-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-apple-blue"></div>
          </label>
        </div>

        {strategy.isSmartSuggestions && (
          <div className="bg-apple-blue/10 p-4 rounded-xl border border-apple-blue/20 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-sm font-medium text-text-primary">Body Weight</label>
              <div className="flex bg-card-border/50 rounded-lg p-0.5">
                <button
                  onClick={() => {
                    if (strategy.weightUnit !== "kg") {
                      strategy.setWeight(Math.round(strategy.weight / 2.20462));
                      strategy.setWeightUnit("kg");
                    }
                  }}
                  className={`px-2 py-0.5 text-xs rounded-md transition-colors ${strategy.weightUnit === "kg" ? "bg-card text-text-primary shadow-sm font-bold" : "text-text-secondary hover:text-text-primary"}`}
                >
                  kg
                </button>
                <button
                  onClick={() => {
                    if (strategy.weightUnit !== "lbs") {
                      strategy.setWeight(Math.round(strategy.weight * 2.20462));
                      strategy.setWeightUnit("lbs");
                    }
                  }}
                  className={`px-2 py-0.5 text-xs rounded-md transition-colors ${strategy.weightUnit === "lbs" ? "bg-card text-text-primary shadow-sm font-bold" : "text-text-secondary hover:text-text-primary"}`}
                >
                  lbs
                </button>
              </div>
            </div>
            <input
              type="number"
              value={strategy.weight}
              onChange={(e) => strategy.setWeight(Number(e.target.value))}
              className="w-full px-4 py-2.5 border border-card-border rounded-xl outline-none font-medium text-text-primary bg-card"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-sm font-medium text-text-primary">Temperature</label>
              <div className="flex bg-card-border/50 rounded-lg p-0.5">
                <button
                  onClick={() => {
                    if (strategy.temperatureUnit !== "C") {
                      strategy.setTemperature(Math.round((strategy.temperature - 32) * 5 / 9));
                      strategy.setTemperatureUnit("C");
                    }
                  }}
                  className={`px-2 py-0.5 text-xs rounded-md transition-colors ${strategy.temperatureUnit === "C" ? "bg-card text-text-primary shadow-sm font-bold" : "text-text-secondary hover:text-text-primary"}`}
                >
                  °C
                </button>
                <button
                  onClick={() => {
                    if (strategy.temperatureUnit !== "F") {
                      strategy.setTemperature(Math.round(strategy.temperature * 9 / 5 + 32));
                      strategy.setTemperatureUnit("F");
                    }
                  }}
                  className={`px-2 py-0.5 text-xs rounded-md transition-colors ${strategy.temperatureUnit === "F" ? "bg-card text-text-primary shadow-sm font-bold" : "text-text-secondary hover:text-text-primary"}`}
                >
                  °F
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-card-border/30 px-4 py-2.5 rounded-xl border border-card-border">
              <input
                type="range"
                min={strategy.temperatureUnit === "C" ? -5 : 23}
                max={strategy.temperatureUnit === "C" ? 40 : 104}
                value={strategy.temperature}
                onChange={(e) => strategy.setTemperature(Number(e.target.value))}
                className="w-full accent-apple-amber"
              />
              <span className="font-bold text-apple-amber min-w-[3rem] text-right">
                {strategy.temperature}°{strategy.temperatureUnit}
              </span>
            </div>
          </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1 flex items-center gap-1"><User size={12}/> Gender</label>
                <select
                  value={strategy.gender}
                  onChange={(e) => strategy.setGender(e.target.value)}
                  className="w-full px-3 py-2 border border-card-border rounded-lg text-sm focus:ring-2 focus:ring-apple-blue/50 focus:border-transparent outline-none bg-card"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1 flex items-center gap-1"><Dumbbell size={12}/> Intensity</label>
                <select
                  value={strategy.intensity}
                  onChange={(e) => strategy.setIntensity(e.target.value)}
                  className="w-full px-3 py-2 border border-card-border rounded-lg text-sm focus:ring-2 focus:ring-apple-blue/50 focus:border-transparent outline-none bg-card"
                >
                  <option value="recovery">Recovery (Zone 1-2)</option>
                  <option value="tempo">Tempo (Zone 3)</option>
                  <option value="threshold">Threshold (Zone 4)</option>
                  <option value="maximum">Maximum (Zone 5)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1 flex items-center gap-1"><Thermometer size={12}/> Temperature (°C)</label>
                <input
                  type="number"
                  value={strategy.temperature}
                  onChange={(e) => strategy.setTemperature(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-card-border rounded-lg text-sm focus:ring-2 focus:ring-apple-blue/50 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1 flex items-center gap-1"><Droplets size={12}/> Humidity (%)</label>
                <input
                  type="number"
                  value={strategy.humidity}
                  onChange={(e) => strategy.setHumidity(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-card-border rounded-lg text-sm focus:ring-2 focus:ring-apple-blue/50 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1 flex items-center gap-1"><Droplets size={12}/> Sweat Saltiness <TooltipInfo content="How salty your sweat is. 'Low' means you rarely see white salt stains on your clothes. 'High' means heavy white crusting on your skin/clothes after a workout." /></label>
                <select
                  value={strategy.sweatSodiumConcentration}
                  onChange={(e) => strategy.setSweatSodiumConcentration(e.target.value)}
                  className="w-full px-3 py-2 border border-card-border rounded-lg text-sm focus:ring-2 focus:ring-apple-blue/50 focus:border-transparent outline-none bg-card"
                >
                  <option value="low">Low (Light white marks)</option>
                  <option value="average">Average</option>
                  <option value="high">Salty (Heavy white crusting)</option>
                </select>
              </div>
              <div className="flex flex-col justify-end pb-1">
                <label className="inline-flex items-center cursor-pointer relative">
                  <input type="checkbox" className="sr-only peer" checked={strategy.ultraMode} onChange={(e) => strategy.setUltraMode(e.target.checked)}/>
                  <div className="w-9 h-5 bg-card-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-card-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-apple-blue"></div>
                  <span className="ml-3 text-sm font-semibold text-text-primary flex items-center gap-1">Ultra Mode (1:0.8 Ratio) <TooltipInfo content="Shifts the target glucose:fructose ratio from 1:0.5 (standard) to 1:0.8, which is highly recommended for pushing carbohydrate intake beyond 90g/hr to avoid gut distress." /></span>
                </label>
              </div>
            </div>

            <div className="border-t border-apple-blue/20 pt-4">
              <div className="flex items-center justify-between mb-3">
              <label className="inline-flex items-center cursor-pointer justify-between w-full p-4 border border-card-border rounded-xl bg-card hover:bg-card-border/50 transition-colors">
                <span className="text-sm font-semibold text-text-primary flex items-center gap-2"><Coffee size={18} className="text-amber-600"/> Include Caffeine Strategy</span>
                <div className="relative flex items-center">
                  <input type="checkbox" className="sr-only peer" checked={strategy.includeCaffeine} onChange={(e) => strategy.setIncludeCaffeine(e.target.checked)}/>
                  <div className="w-11 h-6 bg-card-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-apple-blue"></div>
                </div>
              </label>

              <label className="inline-flex items-center cursor-pointer justify-between w-full p-4 border border-card-border rounded-xl bg-card hover:bg-card-border/50 transition-colors">
                <span className="text-sm font-semibold text-text-primary flex items-center gap-2"><div className="w-4 h-4 bg-slate-200 rounded-sm text-[10px] flex items-center justify-center font-bold text-slate-800">Na</div> Include Bicarb Strategy <TooltipInfo content="Sodium Bicarbonate buffers blood acidity, improving high-intensity performance. Requires 300mg/kg ingested 90 mins pre-exercise."/></span>
                <div className="relative flex items-center">
                  <input type="checkbox" className="sr-only peer" checked={strategy.includeBicarb} onChange={(e) => strategy.setIncludeBicarb(e.target.checked)}/>
                  <div className="w-11 h-6 bg-card-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-apple-blue"></div>
                </div>
              </label>
              </div>
              
              {strategy.includeCaffeine && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Tolerance Profile</label>
                    <select
                      value={strategy.caffeineHabituation}
                      onChange={(e) => strategy.setCaffeineHabituation(e.target.value)}
                      className="w-full px-3 py-2 border border-card-border rounded-lg text-sm focus:ring-2 focus:ring-apple-amber/50 focus:border-transparent outline-none bg-card"
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
