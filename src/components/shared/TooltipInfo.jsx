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

import { useState, useRef, useEffect } from "react";
import { Info } from "lucide-react";

const TooltipInfo = ({ content }) => {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  return (
    <div 
      ref={tooltipRef}
      className="relative flex items-center cursor-help ml-2"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onClick={() => setIsOpen(!isOpen)}
    >
      <div className={`p-1.5 rounded-full transition-colors ${isOpen ? 'bg-apple-blue text-text-primary' : 'bg-card-border/50 text-text-secondary hover:bg-apple-blue hover:text-text-primary'}`}>
        <Info size={14} />
      </div>
      <div className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-[240px] sm:max-w-xs px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-xl pointer-events-none transition-all z-20 origin-bottom text-center ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
      </div>
    </div>
  );
};

export default TooltipInfo;
