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

import React from "react";
import { Info } from "lucide-react";

const TooltipInfo = ({ content }) => (
  <div className="relative flex items-center group cursor-help ml-2">
    <div className="p-1.5 bg-slate-100 rounded-full text-slate-500 group-hover:bg-[#5e5ce6] group-hover:text-white transition-colors">
      <Info size={14} />
    </div>
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-[240px] sm:max-w-xs px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-20 scale-95 group-hover:scale-100 origin-bottom text-center">
      {content}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
    </div>
  </div>
);

export default TooltipInfo;
