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

import { useState, useMemo, useRef } from "react";
import { 
  glucoseSourceOptions, 
  fructoseSourceOptions, 
  electrolyteSourceOptions,
  sourceDataMap,
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
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    showToast("Recipe link copied!");
    setIsShareModalOpen(false);
  };

  const handleCopyImage = () => {
    showToast("Image copied to clipboard!");
    setIsShareModalOpen(false);
  };

  const applyTemplate = (carbs, gParts, fParts) => {
    setTargetCarbs(carbs);
    setGlucoseParts(gParts);
    setFructoseParts(fParts);
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
