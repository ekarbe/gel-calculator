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

import { CheckCircle2 } from "lucide-react";

const Toast = ({ message, visible }) => (
  <div
    className={`fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1e1e2d] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 transition-all duration-300 z-50 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8 pointer-events-none"}`}
  >
    <CheckCircle2 size={18} className="text-[#2dd4bf]" />
    <span className="text-sm font-medium">{message}</span>
  </div>
);

export default Toast;
