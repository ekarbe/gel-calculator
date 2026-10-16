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

import { sourceDataByIdMap } from "../constants/constants";

// Share links store only the fields that differ from these defaults, as compact
// JSON encoded with base64url. Bump SHARE_VERSION whenever the payload changes shape.
export const SHARE_VERSION = 2;

const ELECTROLYTE_KEYS = ["Sodium", "Chloride", "Potassium", "Magnesium", "Calcium"];

export const DEFAULT_SHARE_STATE = {
  duration: 60,
  targetCarbs: 90,
  glucoseParts: 1.0,
  fructoseParts: 0.8,
  glucoseSources: [{ id: 3, percentage: 100 }],
  fructoseSources: [{ id: 11, percentage: 100 }],
  electrolyteSources: [],
  isSweatRate: true,
  sweatRate: 2,
  saltiness: 2,
  activeElectrolytes: { Sodium: true, Chloride: true, Potassium: true, Magnesium: true, Calcium: true },
  manualTargets: { Sodium: 0, Chloride: 0, Potassium: 0, Magnesium: 0, Calcium: 0 },
  recipeView: "total",
  gelsPerHour: 2,
  strategy: {
    isSmartSuggestions: false,
    weight: 70,
    weightUnit: "kg",
    gender: "male",
    intensity: "tempo",
    temperature: 20,
    temperatureUnit: "C",
    humidity: 50,
    ultraMode: false,
    includeCaffeine: false,
    includeBicarb: false,
    caffeineHabituation: "habituated",
    sweatSodiumConcentration: "average",
  },
};

// Short key, field name, and the allowed values for enumerated strategy fields.
const STRATEGY_FIELDS = [
  ["ism", "isSmartSuggestions", "bool"],
  ["wt", "weight", "number"],
  ["wu", "weightUnit", ["kg", "lbs"]],
  ["gnd", "gender", ["male", "female"]],
  ["int", "intensity", ["recovery", "tempo", "threshold", "maximum"]],
  ["tmp", "temperature", "number"],
  ["tu", "temperatureUnit", ["C", "F"]],
  ["hum", "humidity", "number"],
  ["ult", "ultraMode", "bool"],
  ["ic", "includeCaffeine", "bool"],
  ["ib", "includeBicarb", "bool"],
  ["ch", "caffeineHabituation", ["naive", "habituated"]],
  ["ssc", "sweatSodiumConcentration", ["low", "average", "high"]],
];

const sourcesToPairs = (sources, valueKey) =>
  (sources || []).filter((s) => s.id != null).map((s) => [s.id, s[valueKey]]);

const samePairs = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const toBase64Url = (str) =>
  btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromBase64Url = (str) => {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
};

/**
 * Encodes calculator state into a URL-safe string. Sources must be given as
 * `{ id, percentage }` (carbs) or `{ id, amount }` (electrolytes).
 */
export function encodeShareState(state) {
  const d = DEFAULT_SHARE_STATE;
  const p = { v: SHARE_VERSION };

  if (state.duration !== d.duration) p.d = state.duration;
  if (state.targetCarbs !== d.targetCarbs) p.t = state.targetCarbs;
  if (state.glucoseParts !== d.glucoseParts) p.gp = state.glucoseParts;
  if (state.fructoseParts !== d.fructoseParts) p.fp = state.fructoseParts;

  const gs = sourcesToPairs(state.glucoseSources, "percentage");
  if (!samePairs(gs, sourcesToPairs(d.glucoseSources, "percentage"))) p.gs = gs;
  const fs = sourcesToPairs(state.fructoseSources, "percentage");
  if (!samePairs(fs, sourcesToPairs(d.fructoseSources, "percentage"))) p.fs = fs;
  const es = sourcesToPairs(state.electrolyteSources, "amount");
  if (es.length > 0) p.es = es;

  if (state.isSweatRate === false) p.isr = 0;
  if (state.sweatRate !== d.sweatRate) p.sr = state.sweatRate;
  if (state.saltiness !== d.saltiness) p.sl = state.saltiness;

  if (state.activeElectrolytes) {
    const ae = ELECTROLYTE_KEYS.map((k) => (state.activeElectrolytes[k] ? "1" : "0")).join("");
    if (ae !== "11111") p.ae = ae;
  }
  if (state.manualTargets) {
    const mt = ELECTROLYTE_KEYS.map((k) => Number(state.manualTargets[k]) || 0);
    if (mt.some((v) => v !== 0)) p.mt = mt;
  }

  if (state.recipeView === "perGel") p.rv = "g";
  if (state.gelsPerHour !== d.gelsPerHour) p.gph = state.gelsPerHour;

  if (state.strategy) {
    const st = {};
    for (const [short, field, type] of STRATEGY_FIELDS) {
      const value = state.strategy[field];
      if (value === undefined || value === d.strategy[field]) continue;
      st[short] = type === "bool" ? (value ? 1 : 0) : value;
    }
    if (Object.keys(st).length > 0) p.st = st;
  }

  return toBase64Url(JSON.stringify(p));
}

const finite = (v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

const decodePairs = (pairs) => {
  if (!Array.isArray(pairs)) return undefined;
  return pairs
    .filter((pair) => Array.isArray(pair) && sourceDataByIdMap.has(pair[0]) && finite(pair[1]) !== undefined)
    .map(([id, value]) => [id, Math.max(0, value)]);
};

/**
 * Decodes a string produced by `encodeShareState`. Returns a partial state that
 * only contains valid fields, or `null` if the string is not a v2 share link.
 */
export function decodeShareState(str) {
  let p;
  try {
    p = JSON.parse(fromBase64Url(str));
  } catch {
    return null;
  }
  if (!p || typeof p !== "object" || p.v !== SHARE_VERSION) return null;

  const state = {};
  if (finite(p.d) !== undefined) state.duration = Math.max(0, p.d);
  if (finite(p.t) !== undefined) state.targetCarbs = Math.max(0, p.t);
  if (finite(p.gp) !== undefined) state.glucoseParts = Math.max(0, p.gp);
  if (finite(p.fp) !== undefined) state.fructoseParts = Math.max(0, p.fp);

  const gs = decodePairs(p.gs);
  if (gs) state.glucoseSources = gs.map(([id, percentage]) => ({ id, percentage }));
  const fs = decodePairs(p.fs);
  if (fs) state.fructoseSources = fs.map(([id, percentage]) => ({ id, percentage }));
  const es = decodePairs(p.es);
  if (es) state.electrolyteSources = es.map(([id, amount]) => ({ id, amount }));

  if (p.isr === 0) state.isSweatRate = false;
  if (Number.isInteger(p.sr) && p.sr >= 0 && p.sr <= 5) state.sweatRate = p.sr;
  if (Number.isInteger(p.sl) && p.sl >= 0 && p.sl <= 5) state.saltiness = p.sl;

  if (typeof p.ae === "string" && /^[01]{5}$/.test(p.ae)) {
    state.activeElectrolytes = Object.fromEntries(ELECTROLYTE_KEYS.map((k, i) => [k, p.ae[i] === "1"]));
  }
  if (Array.isArray(p.mt) && p.mt.length === ELECTROLYTE_KEYS.length) {
    state.manualTargets = Object.fromEntries(ELECTROLYTE_KEYS.map((k, i) => [k, Math.max(0, finite(p.mt[i]) ?? 0)]));
  }

  if (p.rv === "g") state.recipeView = "perGel";
  if (finite(p.gph) !== undefined) state.gelsPerHour = Math.max(0, p.gph);

  if (p.st && typeof p.st === "object") {
    const strategy = {};
    for (const [short, field, type] of STRATEGY_FIELDS) {
      const value = p.st[short];
      if (value === undefined) continue;
      if (type === "bool") strategy[field] = value === 1;
      else if (type === "number") {
        if (finite(value) !== undefined) strategy[field] = value;
      } else if (type.includes(value)) strategy[field] = value;
    }
    if (Object.keys(strategy).length > 0) state.strategy = strategy;
  }

  return state;
}
