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
import { BookTemplate, X, Info } from "lucide-react";
import { TEMPLATES, sourceDataByIdMap } from "../../constants/constants";

const TemplateModal = () => {
  const { isTemplateModalOpen: isOpen, setIsTemplateModalOpen, applyTemplate } = useCalculatorContext();
  const onClose = () => setIsTemplateModalOpen(false);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 border-b border-card-border flex-shrink-0">
          <h3 className="font-bold text-lg text-text-primary flex items-center gap-2">
            <BookTemplate size={20} className="text-apple-blue" /> Pre-Mix
            Templates
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-text-secondary bg-card-border/30 rounded-full hover:bg-card-border/50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 bg-card-border/30 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEMPLATES.map((tpl, idx) => (
            <button
              key={idx}
              onClick={() => applyTemplate(tpl)}
              className="bg-card border border-card-border p-5 rounded-xl text-left hover:border-[#007AFF] hover:shadow-md transition-all flex flex-col group"
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-text-primary group-hover:text-apple-blue transition-colors">{tpl.name}</h4>
                <span className="text-xs font-medium text-apple-blue bg-indigo-50 px-2 py-1 rounded-full whitespace-nowrap ml-2">
                  Ratio {tpl.glucoseParts}:{tpl.fructoseParts}
                </span>
              </div>
              <p className="text-sm text-text-secondary mb-4">{tpl.description}</p>
              
              <div className="text-xs text-text-secondary space-y-2 mt-auto">
                <p><strong>App Sources:</strong> {
                  [...tpl.glucoseSources, ...tpl.fructoseSources, ...tpl.electrolyteSources]
                    .map(s => sourceDataByIdMap.get(s.id)?.label)
                    .filter(Boolean)
                    .join(', ') || 'None'
                }</p>
                {tpl.otherIngredients !== 'None' && (
                  <p><strong>Other Ingredients:</strong> {tpl.otherIngredients}</p>
                )}
                <div className="mt-3 p-3 bg-card-border/30 rounded-lg flex gap-2 items-start border border-card-border">
                  <Info size={14} className="text-text-secondary mt-0.5 flex-shrink-0" />
                  <p className="text-text-secondary text-[11px] leading-relaxed">{tpl.nutrition}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TemplateModal;