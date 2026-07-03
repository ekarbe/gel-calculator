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
import { BookTemplate, Share2 } from "lucide-react";
import FuelBeakerIcon from "../shared/FuelBeakerIcon";
import { ThemeToggle } from "../shared/ThemeToggle";

const Header = () => {
  const { onOpenTemplates, onOpenShare } = useCalculatorContext();
  return (
    <header className="bg-card border-b border-card-border px-4 sm:px-6 py-4 flex justify-between items-center sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <div className="bg-apple-blue text-text-primary p-1.5 rounded-lg flex items-center justify-center">
          <FuelBeakerIcon className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold text-text-primary tracking-tight hidden sm:block">
          Gel-Calculator
        </h1>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <ThemeToggle />
        <button
          onClick={onOpenTemplates}
          className="flex items-center gap-2 text-sm font-medium text-text-secondary bg-card-border/50 hover:bg-card-border px-3 py-2 rounded-lg transition-colors"
        >
          <BookTemplate size={16} />{" "}
          <span className="hidden sm:inline">Templates</span>
        </button>
        <button
          onClick={onOpenShare}
          className="flex items-center gap-2 text-sm font-medium text-text-primary bg-card hover:bg-slate-800 px-3 py-2 rounded-lg transition-colors shadow-sm"
        >
          <Share2 size={16} />{" "}
          <span className="hidden sm:inline">Share Link</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
