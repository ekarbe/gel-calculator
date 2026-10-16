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

/**
 * Display unit conversions shared by every card and the print view. The
 * plan always works in kg, cm and °C; these only change what is shown.
 */

/** Pounds per kilogram (1 lb = 0.45359237 kg exactly). */
export const LB_PER_KG = 1 / 0.45359237;

/** Centimetres per inch (exact). */
export const CM_PER_IN = 2.54;
