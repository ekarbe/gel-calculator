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
import { BookTemplate, X } from "lucide-react";

const TemplateModal = () => {
  const { isTemplateModalOpen: isOpen, setIsTemplateModalOpen, applyTemplate } = useCalculatorContext();
  const onClose = () => setIsTemplateModalOpen(false);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <BookTemplate size={20} className="text-[#5e5ce6]" /> Pre-Mix
            Templates
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 bg-slate-50 rounded-full"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 bg-slate-50 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => applyTemplate(80, 1.0, 0.8)}
            className="bg-white border border-slate-200 p-5 rounded-xl text-left hover:border-[#5e5ce6] hover:shadow-md transition-all"
          >
            <h4 className="font-bold text-slate-900 mb-1">
              Maurten Drink Mix 320
            </h4>
            <div className="flex justify-between text-sm mt-4">
              <span className="text-slate-700">80g/hr</span>
              <span className="text-[#a2a0fa]">Ratio 1:0.8</span>
            </div>
          </button>
          <button
            onClick={() => applyTemplate(90, 1.0, 0.8)}
            className="bg-white border border-slate-200 p-5 rounded-xl text-left hover:border-orange-500 hover:shadow-md transition-all"
          >
            <h4 className="font-bold text-slate-900 mb-1">SiS Beta Fuel</h4>
            <div className="flex justify-between text-sm mt-4">
              <span className="text-slate-700">90g/hr</span>
              <span className="text-orange-400">Ratio 1:0.8</span>
            </div>
          </button>
          <button
            onClick={() => applyTemplate(60, 1.0, 0.5)}
            className="bg-white border border-slate-200 p-5 rounded-xl text-left hover:border-red-500 hover:shadow-md transition-all"
          >
            <h4 className="font-bold text-slate-900 mb-1">
              Traditional Isotonic
            </h4>
            <div className="flex justify-between text-sm mt-4">
              <span className="text-slate-700">60g/hr</span>
              <span className="text-red-400">Ratio 1:0.5</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateModal;
