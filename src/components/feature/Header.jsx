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
import { BookTemplate, Share2 } from "lucide-react";
import FuelBeakerIcon from "../shared/FuelBeakerIcon";

const Header = () => {
  const { onOpenTemplates, onOpenShare } = useCalculatorContext();
  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex justify-between items-center sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <div className="bg-[#5e5ce6] text-white p-1.5 rounded-lg flex items-center justify-center">
          <FuelBeakerIcon className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight hidden sm:block">
          Gel-Calculator
        </h1>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <button
          onClick={onOpenTemplates}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors"
        >
          <BookTemplate size={16} />{" "}
          <span className="hidden sm:inline">Templates</span>
        </button>
        <button
          onClick={onOpenShare}
          className="flex items-center gap-2 text-sm font-medium text-white bg-[#1e1e2d] hover:bg-slate-800 px-3 py-2 rounded-lg transition-colors shadow-sm"
        >
          <Share2 size={16} />{" "}
          <span className="hidden sm:inline">Share Link</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
