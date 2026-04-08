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
import { X, Link2, ImageIcon, Zap, Copy } from "lucide-react";

const ShareModal = () => {
  const {
    isShareModalOpen: isOpen,
    setIsShareModalOpen,
    shareView,
    setShareView,
    duration,
    targetCarbs,
    totals,
    getDisplayValue,
    handleCopyLink,
    handleCopyImage,
  } = useCalculatorContext();
  const onClose = () => setIsShareModalOpen(false);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-end sm:items-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-lg text-slate-800">
            {shareView === "menu" ? "Share Recipe" : "Recipe Image"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 bg-slate-50 p-1.5 rounded-full"
          >
            <X size={18} />
          </button>
        </div>
        {shareView === "menu" ? (
          <div className="p-6 space-y-3">
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-4 p-4 border border-slate-200 rounded-xl hover:border-[#5e5ce6] hover:bg-indigo-50 transition-all text-left"
            >
              <div className="bg-indigo-100 p-2.5 rounded-lg text-[#5e5ce6]">
                <Link2 size={20} />
              </div>
              <div>
                <div className="font-semibold text-slate-800">Copy Link</div>
                <div className="text-xs text-slate-500">Clickable web link</div>
              </div>
            </button>
            <button
              onClick={() => setShareView("image")}
              className="w-full flex items-center gap-4 p-4 border border-slate-200 rounded-xl hover:border-[#5e5ce6] hover:bg-indigo-50 transition-all text-left"
            >
              <div className="bg-indigo-100 p-2.5 rounded-lg text-[#5e5ce6]">
                <ImageIcon size={20} />
              </div>
              <div>
                <div className="font-semibold text-slate-800">
                  Generate Image
                </div>
                <div className="text-xs text-slate-500">
                  Visual summary graphic
                </div>
              </div>
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="p-6 bg-slate-100 flex justify-center">
              <div className="bg-[#1e1e2d] text-white p-8 rounded-2xl w-full max-w-[320px] aspect-[4/5] flex flex-col relative ring-1 ring-slate-800">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#5e5ce6] to-[#2dd4bf]"></div>
                <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
                  <Zap
                    size={20}
                    className="text-[#5e5ce6]"
                    fill="currentColor"
                  />{" "}
                  Gel-Calc
                </h2>
                <div className="flex justify-between items-end mb-8 pb-6 border-b border-slate-700/50">
                  <div>
                    <div className="text-xs text-slate-400">TOTAL CARBS</div>
                    <div className="text-4xl font-bold">
                      {Math.round((duration / 60) * targetCarbs)}g
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">RATIO</div>
                    <div className="text-2xl font-bold text-[#a2a0fa]">
                      {totals.glucoseRatio}:{totals.fructoseRatio}
                    </div>
                  </div>
                </div>
                <div className="space-y-4 flex-1">
                  <div className="flex justify-between">
                    <span>Maltodextrin</span>
                    <span className="font-semibold">
                      {getDisplayValue(totals.malto)}g
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fructose</span>
                    <span className="font-semibold">
                      {getDisplayValue(totals.fructose)}g
                    </span>
                  </div>
                  <div className="flex justify-between text-[#2dd4bf]">
                    <span>Sodium Citrate</span>
                    <span className="font-semibold">
                      {getDisplayValue(totals.sodiumCitrate)}mg
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-3 bg-white">
              <button
                onClick={() => setShareView("menu")}
                className="px-5 py-3 text-slate-600 bg-slate-100 rounded-xl font-semibold"
              >
                Back
              </button>
              <button
                onClick={handleCopyImage}
                className="flex-1 bg-[#5e5ce6] text-white font-semibold py-3 rounded-xl flex justify-center items-center gap-2"
              >
                <Copy size={18} /> Copy Image
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareModal;
