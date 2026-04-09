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

import { useState, useMemo, useRef, useEffect } from "react";
import { zlibSync, unzlibSync, strToU8, strFromU8 } from 'fflate';

const keyMap = {
  duration: 'd',
  targetCarbs: 't',
  glucoseParts: 'gp',
  fructoseParts: 'fp',
  glucoseSources: 'gs',
  fructoseSources: 'fs',
  electrolyteSources: 'es',
  isSweatRate: 'isr',
  sweatRate: 'sr',
  saltiness: 'sl',
  activeElectrolytes: 'ae',
  manualTargets: 'mt',
  recipeView: 'rv',
  gelsPerHour: 'gph',
  id: 'i',
  name: 'n',
  percentage: 'p',
  amount: 'a',
  Sodium: 's',
  Chloride: 'c',
  Potassium: 'po',
  Magnesium: 'm',
  Calcium: 'ca'
};

const reverseKeyMap = Object.entries(keyMap).reduce((acc, [k, v]) => { acc[v] = k; return acc; }, {});

function mapKeys(obj, map) {
  if (Array.isArray(obj)) {
    return obj.map(item => mapKeys(item, map));
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const mappedKey = map[key] || key;
      acc[mappedKey] = mapKeys(obj[key], map);
      return acc;
    }, {});
  }
  return obj;
}

function encodeState(state) {
  const parts = [];
  
  if (state.duration !== 180) parts.push(`d_${state.duration}`);
  if (state.targetCarbs !== 90) parts.push(`t_${state.targetCarbs}`);
  if (state.glucoseParts !== 1.0) parts.push(`gp_${state.glucoseParts}`);
  if (state.fructoseParts !== 0.8) parts.push(`fp_${state.fructoseParts}`);
  
  if (state.glucoseSources && state.glucoseSources.length > 0) {
    const gsStr = state.glucoseSources.filter(s => s.id != null).map(s => `${s.id}-${s.percentage}`).join('.');
    if (gsStr !== '3-100') parts.push(`gs_${gsStr}`);
  } else {
    parts.push(`gs_empty`);
  }
  
  if (state.fructoseSources && state.fructoseSources.length > 0) {
    const fsStr = state.fructoseSources.filter(s => s.id != null).map(s => `${s.id}-${s.percentage}`).join('.');
    if (fsStr !== '11-100') parts.push(`fs_${fsStr}`);
  } else {
    parts.push(`fs_empty`);
  }
  
  if (state.electrolyteSources && state.electrolyteSources.length > 0) {
    const esStr = state.electrolyteSources.filter(s => s.id != null).map(s => `${s.id}-${s.amount}`).join('.');
    if (esStr !== '') parts.push(`es_${esStr}`);
  }
  
  if (state.isSweatRate === false) parts.push(`isr_0`);
  if (state.sweatRate !== 2) parts.push(`sr_${state.sweatRate}`);
  if (state.saltiness !== 2) parts.push(`sl_${state.saltiness}`);
  
  if (state.activeElectrolytes) {
    const aeArray = ['Sodium', 'Chloride', 'Potassium', 'Magnesium', 'Calcium'];
    const aeStr = aeArray.map(k => state.activeElectrolytes[k] ? '1' : '0').join('');
    if (aeStr !== '11111') parts.push(`ae_${aeStr}`);
  }
  
  if (state.manualTargets && state.isSweatRate === false) {
    const aeArray = ['Sodium', 'Chloride', 'Potassium', 'Magnesium', 'Calcium'];
    const mtStr = aeArray.map(k => state.manualTargets[k] || 0).join('-');
    if (mtStr !== '0-0-0-0-0') parts.push(`mt_${mtStr}`);
  }
  
  if (state.recipeView !== 'total') parts.push(`rv_${state.recipeView === 'perGel' ? 'g' : 't'}`);
  if (state.gelsPerHour !== 2) parts.push(`gph_${state.gelsPerHour}`);

  return parts.length > 0 ? parts.join('~') : 'v2';
}

function decodeStateV1(base64Url) {
  try {
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const jsonString = strFromU8(unzlibSync(bytes));
    return mapKeys(JSON.parse(jsonString), reverseKeyMap);
  } catch (e) {
    console.error("V1 decode error", e);
    return {};
  }
}

function decodeState(str) {
  if (!str.includes('_') && str !== 'v2') {
    return decodeStateV1(str);
  }
  
  const state = {};
  if (str === 'v2') return state;
  
  const parts = str.split('~');
  for (const part of parts) {
    const [k, v] = part.split('_');
    if (!v) continue;
    
    if (k === 'd') state.duration = Number(v);
    else if (k === 't') state.targetCarbs = Number(v);
    else if (k === 'gp') state.glucoseParts = Number(v);
    else if (k === 'fp') state.fructoseParts = Number(v);
    else if (k === 'gs') {
      if (v === 'empty') state.glucoseSources = [];
      else state.glucoseSources = v.split('.').map(s => { const [id, p] = s.split('-'); return { id: Number(id), percentage: Number(p) }; });
    }
    else if (k === 'fs') {
      if (v === 'empty') state.fructoseSources = [];
      else state.fructoseSources = v.split('.').map(s => { const [id, p] = s.split('-'); return { id: Number(id), percentage: Number(p) }; });
    }
    else if (k === 'es') {
      state.electrolyteSources = v.split('.').map(s => { const [id, a] = s.split('-'); return { id: Number(id), amount: Number(a) }; });
    }
    else if (k === 'isr') state.isSweatRate = v === '1';
    else if (k === 'sr') state.sweatRate = Number(v);
    else if (k === 'sl') state.saltiness = Number(v);
    else if (k === 'ae') {
      const keys = ['Sodium', 'Chloride', 'Potassium', 'Magnesium', 'Calcium'];
      state.activeElectrolytes = {};
      for (let i = 0; i < keys.length; i++) state.activeElectrolytes[keys[i]] = v[i] === '1';
    }
    else if (k === 'mt') {
      const keys = ['Sodium', 'Chloride', 'Potassium', 'Magnesium', 'Calcium'];
      const vals = v.split('-');
      state.manualTargets = {};
      for (let i = 0; i < keys.length; i++) state.manualTargets[keys[i]] = Number(vals[i]);
    }
    else if (k === 'rv') state.recipeView = v === 'g' ? 'perGel' : 'total';
    else if (k === 'gph') state.gelsPerHour = Number(v);
  }
  return state;
}
import { 
  glucoseSourceOptions, 
  fructoseSourceOptions, 
  electrolyteSourceOptions,
  sourceDataMap,
  allSourcesOptions,
  sourceDataByIdMap,
  SWEAT_RATES,
  ELECTROLYTE_CONCENTRATIONS,
  CONVERSION_FACTORS
} from "../constants/constants";

export function useCalculator() {
  // Activity State
  const [duration, setDuration] = useState(180);
  const [targetCarbs, setTargetCarbs] = useState(90);

  // Carb Matrix State
  const [glucoseParts, setGlucoseParts] = useState(1.0);
  const [fructoseParts, setFructoseParts] = useState(0.8);

  const [glucoseSources, setGlucoseSources] = useState([
    { id: 1, name: "Maltodextrin", percentage: 100 },
  ]);
  const [fructoseSources, setFructoseSources] = useState([
    { id: 1, name: "Crystalline Fructose", percentage: 100 },
  ]);
  const [electrolyteSources, setElectrolyteSources] = useState([]);

  // Electrolyte State
  const [isSweatRate, setIsSweatRate] = useState(true);
  const [sweatRate, setSweatRate] = useState(2); // 0-5 index
  const [saltiness, setSaltiness] = useState(2); // 0-5 index
  const [activeElectrolytes, setActiveElectrolytes] = useState({ Sodium: true, Chloride: true, Potassium: true, Magnesium: true, Calcium: true });
  const [manualTargets, setManualTargets] = useState({ Sodium: 0, Chloride: 0, Potassium: 0, Magnesium: 0, Calcium: 0 });

  const addSource = (type) => {
    const newSource = { id: Date.now(), name: "", percentage: 0 };
    if (type === "glucose") {
      setGlucoseSources((prev) => {
        const usedNames = prev.map((s) => s.name);
        const availableOption = glucoseSourceOptions.find((opt) => !usedNames.includes(opt.label));
        if (!availableOption) return prev;
        return [...prev, { ...newSource, name: availableOption.label }];
      });
    } else if (type === "fructose") {
      setFructoseSources((prev) => {
        const usedNames = prev.map((s) => s.name);
        const availableOption = fructoseSourceOptions.find((opt) => !usedNames.includes(opt.label));
        if (!availableOption) return prev;
        return [...prev, { ...newSource, name: availableOption.label }];
      });
    } else if (type === "electrolyte") {
      setElectrolyteSources((prev) => {
        const usedNames = prev.map((s) => s.name);
        const availableOption = electrolyteSourceOptions.find((opt) => !usedNames.includes(opt.label));
        if (!availableOption) return prev;
        return [...prev, { id: Date.now(), name: availableOption.label, amount: 0 }];
      });
    }
  };

  const updateSource = (type, id, field, value) => {
    if (type === "glucose") {
      setGlucoseSources((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    } else if (type === "fructose") {
      setFructoseSources((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    } else if (type === "electrolyte") {
      setElectrolyteSources((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    }
  };

  const removeSource = (type, id) => {
    if (type === "glucose") {
      setGlucoseSources((prev) => prev.filter((s) => s.id !== id));
    } else if (type === "fructose") {
      setFructoseSources((prev) => prev.filter((s) => s.id !== id));
    } else if (type === "electrolyte") {
      setElectrolyteSources((prev) => prev.filter((s) => s.id !== id));
    }
  };

  // Recipe View State
  const [recipeView, setRecipeView] = useState("total");
  const [gelsPerHour, setGelsPerHour] = useState(2);

  // Modals & UI State
  const [isMixingModalOpen, setIsMixingModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareView, setShareView] = useState("menu");
  const [toastMessage, setToastMessage] = useState("");

  const recipeRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const s = urlParams.get('s');
      if (s) {
        try {
          let state;
          try {
            state = decodeState(s);
          } catch {
            const jsonString = decodeURIComponent(atob(s));
            state = JSON.parse(jsonString);
          }

          const decompressSources = (sources) => sources.map(src => {
            if (src.name) return { ...src, id: Date.now() + Math.random() };
            const opt = allSourcesOptions.find(o => o.id == src.id);
            return { id: Date.now() + Math.random(), name: opt ? opt.label : "", percentage: src.percentage, amount: src.amount };
          });
          
          if (state.duration !== undefined) setDuration(state.duration);
          if (state.targetCarbs !== undefined) setTargetCarbs(state.targetCarbs);
          if (state.glucoseParts !== undefined) setGlucoseParts(state.glucoseParts);
          if (state.fructoseParts !== undefined) setFructoseParts(state.fructoseParts);
          if (state.glucoseSources !== undefined) setGlucoseSources(decompressSources(state.glucoseSources));
          if (state.fructoseSources !== undefined) setFructoseSources(decompressSources(state.fructoseSources));
          if (state.electrolyteSources !== undefined) setElectrolyteSources(decompressSources(state.electrolyteSources));
          if (state.isSweatRate !== undefined) setIsSweatRate(state.isSweatRate);
          if (state.sweatRate !== undefined) setSweatRate(state.sweatRate);
          if (state.saltiness !== undefined) setSaltiness(state.saltiness);
          if (state.activeElectrolytes !== undefined) setActiveElectrolytes(state.activeElectrolytes);
          if (state.manualTargets !== undefined) setManualTargets(state.manualTargets);
          if (state.recipeView !== undefined) setRecipeView(state.recipeView);
          if (state.gelsPerHour !== undefined) setGelsPerHour(state.gelsPerHour);
        } catch (e) {
          console.error("Failed to parse share link", e);
        }
      }
    }
  }, []);

  // Calculation Engines
  const durationHours = duration / 60;
  
  // 1. Carb Engine
  const calculatedSourceGrams = useMemo(() => {
    const totalCarbsNeeded = targetCarbs * durationHours;
    const gSum = glucoseSources.reduce((acc, s) => acc + s.percentage, 0);
    const fSum = fructoseSources.reduce((acc, s) => acc + s.percentage, 0);

    const finalGrams = { totalGrams: 0 };
    let glucoseAccountedByMixed = 0;
    let fructoseAccountedByMixed = 0;
    let canAchieveRatio = true;

    // "Percentage Validation Lock"
    if (Math.abs(gSum - 100) > 0.01 || Math.abs(fSum - 100) > 0.01) {
      return { finalGrams, glucoseAccountedByMixed, fructoseAccountedByMixed, canAchieveRatio: false };
    }

    const totalParts = glucoseParts + fructoseParts;
    const validTotalParts = totalParts > 0 ? totalParts : 1;
    const targetGlucose = (glucoseParts / validTotalParts) * totalCarbsNeeded;
    const targetFructose = (fructoseParts / validTotalParts) * totalCarbsNeeded;

    // Combine sources for processing
    const allUserSources = [
      ...glucoseSources.map(s => ({ ...s, targetPool: 'glucose', target: targetGlucose })),
      ...fructoseSources.map(s => ({ ...s, targetPool: 'fructose', target: targetFructose }))
    ];

    // Process mixed sources first
    const mixedSources = allUserSources.filter(s => {
      const data = sourceDataMap.get(s.name);
      return data && data.glucoseContent > 0 && data.fructoseContent > 0;
    });

    mixedSources.forEach(s => {
      const data = sourceDataMap.get(s.name);
      if (!data) return;
      const targetForSource = s.target * (s.percentage / 100);
      const relevantContentRatio = s.targetPool === 'glucose' ? data.glucoseContent : data.fructoseContent;
      // Formula: Raw Grams Needed = Target Carbs for Source / (sourceContentRatio * carbsPerGram)
      const rawGramsNeeded = targetForSource / (relevantContentRatio * data.carbsPerGram);
      
      finalGrams[s.name] = (finalGrams[s.name] || 0) + rawGramsNeeded;
      finalGrams.totalGrams += rawGramsNeeded;

      glucoseAccountedByMixed += rawGramsNeeded * data.carbsPerGram * data.glucoseContent;
      fructoseAccountedByMixed += rawGramsNeeded * data.carbsPerGram * data.fructoseContent;
    });

    // Process pure sources
    let remainingGlucoseNeed = targetGlucose - glucoseAccountedByMixed;
    let remainingFructoseNeed = targetFructose - fructoseAccountedByMixed;
    remainingGlucoseNeed = remainingGlucoseNeed > 0 ? remainingGlucoseNeed : 0;
    remainingFructoseNeed = remainingFructoseNeed > 0 ? remainingFructoseNeed : 0;

    const pureSources = allUserSources.filter(s => {
      const data = sourceDataMap.get(s.name);
      return data && (data.glucoseContent === 0 || data.fructoseContent === 0);
    });

    const pureGlucoseSources = pureSources.filter(s => s.targetPool === 'glucose');
    const pureFructoseSources = pureSources.filter(s => s.targetPool === 'fructose');

    const pureGlucosePercentageSum = pureGlucoseSources.reduce((acc, s) => acc + s.percentage, 0);
    if (remainingGlucoseNeed > 0 && pureGlucosePercentageSum > 0) {
      pureGlucoseSources.forEach(s => {
        const data = sourceDataMap.get(s.name);
        if (!data) return;
        const relativePercentage = s.percentage / pureGlucosePercentageSum;
        const rawGramsNeeded = (remainingGlucoseNeed * relativePercentage) / (data.glucoseContent * data.carbsPerGram);
        finalGrams[s.name] = (finalGrams[s.name] || 0) + rawGramsNeeded;
        finalGrams.totalGrams += rawGramsNeeded;
      });
    }

    const pureFructosePercentageSum = pureFructoseSources.reduce((acc, s) => acc + s.percentage, 0);
    if (remainingFructoseNeed > 0 && pureFructosePercentageSum > 0) {
      pureFructoseSources.forEach(s => {
        const data = sourceDataMap.get(s.name);
        if (!data) return;
        const relativePercentage = s.percentage / pureFructosePercentageSum;
        const rawGramsNeeded = (remainingFructoseNeed * relativePercentage) / (data.fructoseContent * data.carbsPerGram);
        finalGrams[s.name] = (finalGrams[s.name] || 0) + rawGramsNeeded;
        finalGrams.totalGrams += rawGramsNeeded;
      });
    }

    const totalActualCarbs = glucoseAccountedByMixed + fructoseAccountedByMixed + remainingGlucoseNeed + remainingFructoseNeed;
    const tolerance = Math.max(0.5, totalCarbsNeeded * 0.01);
    if (Math.abs(totalActualCarbs - totalCarbsNeeded) > tolerance) {
      canAchieveRatio = false;
    }

    return { finalGrams, glucoseAccountedByMixed, fructoseAccountedByMixed, canAchieveRatio };
  }, [durationHours, targetCarbs, glucoseParts, fructoseParts, glucoseSources, fructoseSources]);

  // 2. Electrolyte Engine
  const targetAmountsPerHour = useMemo(() => {
    const targets = { Sodium: 0, Chloride: 0, Potassium: 0, Magnesium: 0, Calcium: 0 };
    if (!isSweatRate) {
      Object.keys(targets).forEach(key => targets[key] = activeElectrolytes[key] ? manualTargets[key] : 0);
      return targets;
    }

    const rateL = SWEAT_RATES[sweatRate];
    Object.keys(targets).forEach(key => {
      if (!activeElectrolytes[key]) {
        targets[key] = 0;
        return;
      }
      const concentrations = ELECTROLYTE_CONCENTRATIONS[key];
      if (concentrations) {
        const conc_mmolL = concentrations[saltiness];
        const conversion = CONVERSION_FACTORS[key];
        targets[key] = rateL * conc_mmolL * conversion;
      }
    });
    return targets;
  }, [isSweatRate, sweatRate, saltiness, manualTargets, activeElectrolytes]);

  const electrolyteAnalysis = useMemo(() => {
    const analysis = {};
    const electrolytes = ['Sodium', 'Chloride', 'Potassium', 'Magnesium', 'Calcium'];
    
    electrolytes.forEach(type => {
      const targetTotal = targetAmountsPerHour[type] * durationHours;
      analysis[type] = {
        electrolyte: type,
        target: targetTotal,
        absorbed: 0,
        percentage: 0,
        message: "",
        hasAnySources: false
      };
    });

    electrolyteSources.forEach(es => {
      const opt = electrolyteSourceOptions.find(o => o.label === es.name);
      if (!opt) return;
      opt.components.forEach(comp => {
        if (analysis[comp.name]) {
          const absorbedAmt = es.amount * comp.ratio * comp.absorptionRate;
          analysis[comp.name].absorbed += absorbedAmt;
          analysis[comp.name].hasAnySources = true;
        }
      });
    });

    electrolytes.forEach(type => {
      const a = analysis[type];
      a.percentage = a.target > 0 ? (a.absorbed / a.target) * 100 : 100;
      const diff = a.absorbed - a.target;
      if (Math.abs(diff) <= 1.0) {
        a.message = "Target met";
      } else if (diff < -1.0) {
        a.message = `Short by ${Math.abs(diff).toFixed(0)}mg`;
      } else {
        a.message = `Excess of ${diff.toFixed(0)}mg`;
      }
    });

    return analysis;
  }, [targetAmountsPerHour, durationHours, electrolyteSources]);

  const totals = useMemo(() => {
    return {
      water: Math.round(durationHours * 60),
      glucoseRatio: Math.round((glucoseParts / (glucoseParts + fructoseParts)) * 100),
      fructoseRatio: Math.round((fructoseParts / (glucoseParts + fructoseParts)) * 100),
      malto: 0, // Legacy fallback, handled in calculatedSourceGrams now
      fructose: 0, // Legacy fallback
    };
  }, [durationHours, glucoseParts, fructoseParts]);

  const scrollToRecipe = () =>
    recipeRef.current?.scrollIntoView({ behavior: "smooth" });

  const getDisplayValue = (val) => {
    if (recipeView === "perGel") {
      const totalGels = durationHours * gelsPerHour;
      return Math.round(val / (totalGels || 1));
    }
    return Math.round(val);
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const handleCopyLink = () => {
    const compressSources = (sources) => sources.map(s => {
      const opt = allSourcesOptions.find(o => o.label === s.name);
      return { id: opt ? opt.id : undefined, percentage: s.percentage, amount: s.amount };
    });

    const stateToSave = {
      duration,
      targetCarbs,
      glucoseParts,
      fructoseParts,
      glucoseSources: compressSources(glucoseSources),
      fructoseSources: compressSources(fructoseSources),
      electrolyteSources: compressSources(electrolyteSources),
      isSweatRate,
      sweatRate,
      saltiness,
      activeElectrolytes,
      manualTargets,
      recipeView,
      gelsPerHour
    };
    try {
      const base64String = encodeState(stateToSave);
      const url = new URL(window.location.href);
      url.searchParams.set('s', base64String);
      
      const copyText = url.toString();
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(copyText).catch(() => {});
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = copyText;
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";
        document.body.prepend(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (err) {
          console.error("Fallback copy failed", err);
        } finally {
          textArea.remove();
        }
      }
      showToast("Recipe link copied!");
    } catch (e) {
      console.error("Failed to generate share link", e);
      showToast("Failed to generate link.");
    }
    setIsShareModalOpen(false);
  };

  const handleCopyImage = () => {
    showToast("Image copied to clipboard!");
    setIsShareModalOpen(false);
  };

  const applyTemplate = (template) => {
    if (template.glucoseParts !== undefined) setGlucoseParts(template.glucoseParts);
    if (template.fructoseParts !== undefined) setFructoseParts(template.fructoseParts);
    
    // Create new IDs for sources to ensure uniqueness when applying and resolve names
    if (template.glucoseSources !== undefined) {
      setGlucoseSources(template.glucoseSources.map((s, i) => {
        const opt = sourceDataByIdMap.get(s.id);
        return { id: Date.now() + i, name: opt ? opt.label : "", percentage: s.percentage };
      }));
    }
    if (template.fructoseSources !== undefined) {
      setFructoseSources(template.fructoseSources.map((s, i) => {
        const opt = sourceDataByIdMap.get(s.id);
        return { id: Date.now() + 100 + i, name: opt ? opt.label : "", percentage: s.percentage };
      }));
    }
    if (template.electrolyteSources !== undefined) {
      setElectrolyteSources(template.electrolyteSources.map((s, i) => {
        const opt = sourceDataByIdMap.get(s.id);
        return { id: Date.now() + 200 + i, name: opt ? opt.label : "", amount: s.amount };
      }));
    }

    setIsTemplateModalOpen(false);
    showToast("Template applied successfully!");
  };

  const onOpenInstructions = () => setIsMixingModalOpen(true);
  const onOpenTemplates = () => setIsTemplateModalOpen(true);
  const onOpenShare = () => setIsShareModalOpen(true);

  return {
    duration, setDuration, targetCarbs, setTargetCarbs, glucoseParts, setGlucoseParts, fructoseParts, setFructoseParts,
    glucoseSources, setGlucoseSources, fructoseSources, setFructoseSources, electrolyteSources, setElectrolyteSources,
    isSweatRate, setIsSweatRate, sweatRate, setSweatRate, saltiness, setSaltiness, activeElectrolytes, setActiveElectrolytes,
    manualTargets, setManualTargets, addSource, updateSource, removeSource, recipeView, setRecipeView, gelsPerHour, setGelsPerHour,
    isMixingModalOpen, setIsMixingModalOpen, isTemplateModalOpen, setIsTemplateModalOpen, isShareModalOpen, setIsShareModalOpen,
    shareView, setShareView, toastMessage, setToastMessage, totals, calculatedSourceGrams, targetAmountsPerHour, electrolyteAnalysis,
    recipeRef, scrollToRecipe, getDisplayValue, showToast, handleCopyLink, handleCopyImage, applyTemplate, onOpenInstructions,
    onOpenTemplates, onOpenShare,
  };
}
