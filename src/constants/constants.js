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

// carbsPerGram: available carbohydrate per gram as purchased.
// glucoseContent / fructoseContent: share of that carbohydrate absorbed via the
// glucose (SGLT1) or fructose (GLUT5) pathway; they always sum to 1. Sucrose
// splits 50/50, maltose and maltodextrin count as glucose.
// osmPerG: osmoles per gram as purchased (mOsm/g, osmotic coefficient 1).
// Sugars: 1000 / molar mass; starch hydrolysates: DE / 18.016 per dry gram
// (Mn = 18016 / DE). Maltodextrin assumes DE 18, glucose syrup DE 42 at 80% dry
// solids (Vist & Maughan 1995 validates 40 g/L glucose at 228 vs 230 measured).
// waterFraction: water per gram as purchased (hydrate or syrup water); it
// dilutes the gel or drink like added water.
// group: 'powder' (dry, weighed and dissolved) or 'syrup' (brings its own water).
export const glucoseSourceOptions = [
    { id: 1, label: 'Dextrose (anhydrous)', carbsPerGram: 1.00, glucoseContent: 1.00, fructoseContent: 0, osmPerG: 5.55, waterFraction: 0, group: 'powder' },
    { id: 8, label: 'Dextrose (monohydrate)', carbsPerGram: 0.91, glucoseContent: 1.00, fructoseContent: 0, osmPerG: 5.05, waterFraction: 0.091, group: 'powder' },
    { id: 2, label: 'Glucose Syrup', carbsPerGram: 0.80, glucoseContent: 1.00, fructoseContent: 0, osmPerG: 1.86, waterFraction: 0.20, group: 'syrup' },
    { id: 3, label: 'Maltodextrin', carbsPerGram: 0.95, glucoseContent: 1.00, fructoseContent: 0, osmPerG: 0.95, waterFraction: 0.05, group: 'powder' },
    { id: 4, label: 'Maltose', carbsPerGram: 0.95, glucoseContent: 1.00, fructoseContent: 0, osmPerG: 2.78, waterFraction: 0.05, group: 'powder' },
    { id: 5, label: 'Highly Branched Cyclic Dextrin (HBCD)', carbsPerGram: 0.95, glucoseContent: 1.00, fructoseContent: 0, osmPerG: 0.02, waterFraction: 0.05, group: 'powder' },
    { id: 6, label: 'Rice Syrup', carbsPerGram: 0.78, glucoseContent: 1.00, fructoseContent: 0, osmPerG: 2.00, waterFraction: 0.21, group: 'syrup' },
    { id: 7, label: 'Barley Malt Extract', carbsPerGram: 0.72, glucoseContent: 0.97, fructoseContent: 0.03, osmPerG: 2.00, waterFraction: 0.20, group: 'syrup' },
];

export const fructoseSourceOptions = [
    { id: 11, label: 'Crystalline Fructose', carbsPerGram: 1.00, glucoseContent: 0, fructoseContent: 1.00, osmPerG: 5.55, waterFraction: 0, group: 'powder' },
    { id: 12, label: 'High Fructose Corn Syrup', carbsPerGram: 0.77, glucoseContent: 0.45, fructoseContent: 0.55, osmPerG: 4.21, waterFraction: 0.23, group: 'syrup' },
    { id: 13, label: 'Agave Syrup', carbsPerGram: 0.76, glucoseContent: 0.18, fructoseContent: 0.82, osmPerG: 3.80, waterFraction: 0.23, group: 'syrup' },
    { id: 14, label: 'Honey', carbsPerGram: 0.82, glucoseContent: 0.50, fructoseContent: 0.50, osmPerG: 4.50, waterFraction: 0.17, group: 'syrup' },
    { id: 15, label: 'Date Syrup', carbsPerGram: 0.70, glucoseContent: 0.50, fructoseContent: 0.50, osmPerG: 3.90, waterFraction: 0.25, group: 'syrup' },
    { id: 16, label: 'Grape Juice Concentrate', carbsPerGram: 0.66, glucoseContent: 0.50, fructoseContent: 0.50, osmPerG: 3.90, waterFraction: 0.32, group: 'syrup' },
    { id: 20, label: 'Apple Juice Concentrate', carbsPerGram: 0.68, glucoseContent: 0.30, fructoseContent: 0.70, osmPerG: 3.90, waterFraction: 0.30, group: 'syrup' },
    { id: 17, label: 'Maple Syrup', carbsPerGram: 0.67, glucoseContent: 0.50, fructoseContent: 0.50, osmPerG: 1.95, waterFraction: 0.32, group: 'syrup' },
    { id: 18, label: 'Sucrose (Cane Sugar)', carbsPerGram: 1.00, glucoseContent: 0.50, fructoseContent: 0.50, osmPerG: 2.92, waterFraction: 0, group: 'powder' },
    { id: 19, label: "Coconut Sugar", carbsPerGram: 0.92, glucoseContent: 0.50, fructoseContent: 0.50, osmPerG: 3.00, waterFraction: 0.03, group: 'powder' },
];

export const allCarbSourceOptions = [...glucoseSourceOptions, ...fructoseSourceOptions];

/**
 * Every carb source in one list for the ingredient picker: powders first, then
 * syrups, each group in the order of the lists above.
 */
export const carbSourceOptions = [
    ...allCarbSourceOptions.filter((opt) => opt.group === 'powder'),
    ...allCarbSourceOptions.filter((opt) => opt.group === 'syrup'),
];

// ratio: mass fraction of the ion in the salt *as sold* (hydrate water included),
// so labels name the form. There are no absorption factors: guidance is given as
// ingested amounts (Sawka et al. 2007; EFSA 2011; Fine et al. 1991).
// osmPerG: effective mOsm per gram as sold (ions per formula unit × osmotic
// coefficient ÷ molar mass). Calcium citrate counts as 0: it barely dissolves
// (about 1 g/L).
export const electrolyteSourceOptions = [
    { id: 31, label: 'Sodium Chloride (Table Salt)', components: [{ name: 'Sodium', ratio: 0.393 }, { name: 'Chloride', ratio: 0.607 }], osmPerG: 31.8 },
    { id: 32, label: 'Potassium Chloride', components: [{ name: 'Potassium', ratio: 0.524 }, { name: 'Chloride', ratio: 0.476 }], osmPerG: 24.7 },
    { id: 33, label: 'Sodium Citrate (dihydrate)', components: [{ name: 'Sodium', ratio: 0.2345 }, { name: 'Citrate', ratio: 0.643 }], osmPerG: 10.9 },
    { id: 34, label: 'Magnesium Citrate (anhydrous)', components: [{ name: 'Magnesium', ratio: 0.1616 }, { name: 'Citrate', ratio: 0.8384 }], osmPerG: 5.5 },
    { id: 35, label: 'Calcium Citrate (tetrahydrate)', components: [{ name: 'Calcium', ratio: 0.2108 }, { name: 'Citrate', ratio: 0.6629 }], osmPerG: 0 },
    { id: 36, label: 'Magnesium Chloride (hexahydrate flakes)', components: [{ name: 'Magnesium', ratio: 0.1196 }, { name: 'Chloride', ratio: 0.3488 }], osmPerG: 13.0 },
    { id: 37, label: 'Calcium Chloride (anhydrous)', components: [{ name: 'Calcium', ratio: 0.3611 }, { name: 'Chloride', ratio: 0.6389 }], osmPerG: 23.5 },
    { id: 38, label: 'Sodium Bicarbonate', components: [{ name: 'Sodium', ratio: 0.274 }, { name: 'Bicarbonate', ratio: 0.726 }], osmPerG: 22.1 },
    { id: 39, label: 'Potassium Citrate (monohydrate)', components: [{ name: 'Potassium', ratio: 0.3616 }, { name: 'Citrate', ratio: 0.5829 }], osmPerG: 9.9 },
    { id: 40, label: 'Magnesium Sulfate (Epsom Salt, heptahydrate)', components: [{ name: 'Magnesium', ratio: 0.0986 }, { name: 'Sulfate', ratio: 0.3897 }], osmPerG: 5.3 }
];

export const allSourcesOptions = [...allCarbSourceOptions, ...electrolyteSourceOptions];
export const sourceDataByIdMap = new Map(allSourcesOptions.map(opt => [opt.id, opt]));

export const SWEAT_RATES = [0.25, 0.75, 1.25, 1.75, 2.25, 2.75];
// Sweat sodium in mmol/L per saltiness level, spanning the measured 10–90 mmol/L
// range around a ~40 mmol/L mean (Baker 2017; Baker 2019). Potassium, magnesium
// and calcium do not track sodium; their typical values are SWEAT_EXTRAS_MMOL in
// src/domain/electrolytes.js.
export const ELECTROLYTE_CONCENTRATIONS = { Sodium: [15, 25, 40, 55, 70, 90] };
export const SWEAT_RATE_DESCRIPTIONS = ["Light sweating: Skin feels slightly damp", "Moderate sweating: Noticeable moisture on skin, shirt may show small damp patches", "Active sweating: Clothing shows distinct wet patches, sweat begins to drip occasionally", "Heavy sweating: Clothing widely soaked, continuous dripping of sweat", "Very heavy sweating: Clothes completely saturated, sweat constantly dripping/running", "Extreme sweating: Excessive sweating with clothes completely drenched"];
export const SALTINESS_DESCRIPTIONS = ["Very low salt content: Sweat barely tastes salty, minimal salt marks on clothing", "Low salt content: Slight salty taste, faint white marks may appear on dark clothing", "Moderate salt content: Clearly salty taste, visible white marks on dried clothing", "High salt content: Strong salty taste, prominent white marks after drying", "Very high salt content: Very strong salty taste, thick white residue on clothing", "Extreme salt content: Extremely salty, heavy white crystallization on skin and clothing"];
