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

"use client";

import { createContext, useContext } from "react";
import { useCalculator } from "../hooks/useCalculator";

export const CalculatorContext = createContext(null);

export function CalculatorProvider({ children }) {
  const calculatorState = useCalculator();
  return (
    <CalculatorContext.Provider value={calculatorState}>
      {children}
    </CalculatorContext.Provider>
  );
}

// Helper hook to easily use the context in components
export function useCalculatorContext() {
  return useContext(CalculatorContext);
}
