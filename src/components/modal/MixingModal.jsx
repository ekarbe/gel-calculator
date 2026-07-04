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
import { FlaskConical, X } from "lucide-react";

const MixingModal = () => {
  const { 
    isMixingModalOpen: isOpen, 
    setIsMixingModalOpen, 
    duration, 
    targetCarbs, 
    getDisplayValue,
    glucoseSources,
    fructoseSources,
    electrolyteSources,
    calculatedSourceGrams
  } = useCalculatorContext();
  const onClose = () => setIsMixingModalOpen(false);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-center items-end sm:items-center p-0 sm:p-4 transition-all">
      <div className="bg-modal w-full sm:max-w-xl sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-card-border backdrop-blur-3xl">
        <div className="flex justify-between items-center px-6 py-4 border-b border-card-border bg-card-border/30">
          <h3 className="font-bold text-lg text-text-primary flex items-center gap-2">
            <FlaskConical size={20} className="text-apple-blue" /> DIY Mix
            Instructions
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-text-secondary hover:text-text-secondary bg-card rounded-full border border-card-border"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          <div className="text-sm text-text-primary leading-relaxed space-y-6">
            <div className="bg-[#f8f9fc] p-4 rounded-xl border border-card-border">
              <div className="font-semibold text-text-primary">
                Total Carbs:{" "}
                <span className="font-bold text-apple-blue">
                  {Math.round((duration / 60) * targetCarbs)}g
                </span>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-text-primary mb-2">
                1. Gather Ingredients
              </h4>
              <ul className="list-disc pl-5 space-y-1 text-text-secondary font-medium">
                {glucoseSources.map(source => {
                  const amount = calculatedSourceGrams?.finalGrams?.[source.name] || 0;
                  if (source.percentage > 0 && amount > 0) {
                    return <li key={`glucose-${source.id}`}>{getDisplayValue(amount)}g {source.name}</li>;
                  }
                  return null;
                })}
                {fructoseSources.map(source => {
                  const amount = calculatedSourceGrams?.finalGrams?.[source.name] || 0;
                  if (source.percentage > 0 && amount > 0) {
                    return <li key={`fructose-${source.id}`}>{getDisplayValue(amount)}g {source.name}</li>;
                  }
                  return null;
                })}
                {electrolyteSources.map(source => {
                  if (source.amount > 0) {
                    return <li key={`electrolyte-${source.id}`}>{getDisplayValue(source.amount)}mg {source.name}</li>;
                  }
                  return null;
                })}
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-text-primary mb-2">
                2. Initial Mixing (Gel Base)
              </h4>
              <p className="text-text-secondary">
                Add warm water to powders. Shake until smooth gel-like paste
                forms.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-text-primary mb-2">
                3. Final Consistency
              </h4>
              <p className="text-text-secondary">
                Add cold water gradually while shaking until desired consistency
                is reached.
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-card-border bg-card">
          <button
            onClick={onClose}
            className="w-full bg-apple-blue text-white font-semibold py-3 rounded-full hover:bg-[#4b49c6] transition-colors shadow-sm"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};

export default MixingModal;
