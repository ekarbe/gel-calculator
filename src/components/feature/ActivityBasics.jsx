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
import { Activity, Clock, Zap } from "lucide-react";
import Card from "../shared/Card";

const ActivityBasics = () => {
  const { duration, setDuration, targetCarbs, setTargetCarbs } =
    useCalculatorContext();
  return (
    <Card>
      <div className="flex items-center gap-3 mb-6">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
            <Clock
              size={16}
              className="absolute right-3 top-3 text-slate-500"
            />
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
              className="w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5e5ce6] focus:border-transparent outline-none transition-all font-semibold text-slate-800"
            />
            <Zap size={16} className="absolute right-3 top-3 text-slate-500" />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ActivityBasics;
