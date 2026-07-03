"use client";
import { useState, useMemo } from "react";
import { glucoseSourceOptions, fructoseSourceOptions, sourceDataMap } from "../constants/constants";

export function useCarbCalculation({ durationHours, targetCarbs }) {
  const [glucoseParts, setGlucoseParts] = useState(1.0);
  const [fructoseParts, setFructoseParts] = useState(0.8);

  const [glucoseSources, setGlucoseSources] = useState([
    { id: 1, name: "Maltodextrin", percentage: 100 },
  ]);
  const [fructoseSources, setFructoseSources] = useState([
    { id: 1, name: "Crystalline Fructose", percentage: 100 },
  ]);

  const addCarbSource = (type) => {
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
    }
  };

  const updateCarbSource = (type, id, field, value) => {
    if (type === "glucose") {
      setGlucoseSources((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    } else if (type === "fructose") {
      setFructoseSources((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    }
  };

  const removeCarbSource = (type, id) => {
    if (type === "glucose") {
      setGlucoseSources((prev) => prev.filter((s) => s.id !== id));
    } else if (type === "fructose") {
      setFructoseSources((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const calculatedSourceGrams = useMemo(() => {
    const totalCarbsNeeded = targetCarbs * durationHours;

    const finalGrams = { totalGrams: 0 };
    let glucoseAccountedByMixed = 0;
    let fructoseAccountedByMixed = 0;
    let canAchieveRatio = true;

    const totalParts = glucoseParts + fructoseParts;
    const validTotalParts = totalParts > 0 ? totalParts : 1;
    const targetGlucose = (glucoseParts / validTotalParts) * totalCarbsNeeded;
    const targetFructose = (fructoseParts / validTotalParts) * totalCarbsNeeded;

    const allUserSources = [
      ...glucoseSources.map(s => ({ ...s, targetPool: 'glucose', target: targetGlucose })),
      ...fructoseSources.map(s => ({ ...s, targetPool: 'fructose', target: targetFructose }))
    ];

    const mixedSources = allUserSources.filter(s => {
      const data = sourceDataMap.get(s.name);
      return data && data.glucoseContent > 0 && data.fructoseContent > 0;
    });

    mixedSources.forEach(s => {
      const data = sourceDataMap.get(s.name);
      if (!data) return;
      const targetForSource = s.target * (s.percentage / 100);
      const relevantContentRatio = s.targetPool === 'glucose' ? data.glucoseContent : data.fructoseContent;
      const rawGramsNeeded = targetForSource / (relevantContentRatio * data.carbsPerGram);
      
      finalGrams[s.name] = (finalGrams[s.name] || 0) + rawGramsNeeded;
      finalGrams.totalGrams += rawGramsNeeded;

      glucoseAccountedByMixed += rawGramsNeeded * data.carbsPerGram * data.glucoseContent;
      fructoseAccountedByMixed += rawGramsNeeded * data.carbsPerGram * data.fructoseContent;
    });

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

    let actualGlucoseProvided = glucoseAccountedByMixed;
    let actualFructoseProvided = fructoseAccountedByMixed;

    const pureGlucosePercentageSum = pureGlucoseSources.reduce((acc, s) => acc + s.percentage, 0);
    if (remainingGlucoseNeed > 0 && pureGlucosePercentageSum > 0) {
      pureGlucoseSources.forEach(s => {
        const data = sourceDataMap.get(s.name);
        if (!data) return;
        const relativePercentage = s.percentage / pureGlucosePercentageSum;
        const rawGramsNeeded = (remainingGlucoseNeed * relativePercentage) / (data.glucoseContent * data.carbsPerGram);
        finalGrams[s.name] = (finalGrams[s.name] || 0) + rawGramsNeeded;
        finalGrams.totalGrams += rawGramsNeeded;
        actualGlucoseProvided += rawGramsNeeded * data.glucoseContent * data.carbsPerGram;
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
        actualFructoseProvided += rawGramsNeeded * data.fructoseContent * data.carbsPerGram;
      });
    }

    const totalActualCarbs = actualGlucoseProvided + actualFructoseProvided;
    const tolerance = Math.max(0.5, totalCarbsNeeded * 0.01);
    const isTotalCarbsMatch = Math.abs(totalActualCarbs - totalCarbsNeeded) <= tolerance;
    const isGlucoseMatch = Math.abs(actualGlucoseProvided - targetGlucose) <= tolerance;
    const isFructoseMatch = Math.abs(actualFructoseProvided - targetFructose) <= tolerance;

    canAchieveRatio = isTotalCarbsMatch && isGlucoseMatch && isFructoseMatch;

    if (!canAchieveRatio) {
      return { 
        finalGrams: { totalGrams: 0 }, 
        glucoseAccountedByMixed, 
        fructoseAccountedByMixed, 
        canAchieveRatio: false 
      };
    }

    return { finalGrams, glucoseAccountedByMixed, fructoseAccountedByMixed, canAchieveRatio };
  }, [durationHours, targetCarbs, glucoseParts, fructoseParts, glucoseSources, fructoseSources]);

  const totals = useMemo(() => {
    return {
      glucoseRatio: Math.round((glucoseParts / (glucoseParts + fructoseParts)) * 100),
      fructoseRatio: Math.round((fructoseParts / (glucoseParts + fructoseParts)) * 100),
      malto: 0,
      fructose: 0,
    };
  }, [glucoseParts, fructoseParts]);

  return {
    glucoseParts, setGlucoseParts,
    fructoseParts, setFructoseParts,
    glucoseSources, setGlucoseSources,
    fructoseSources, setFructoseSources,
    addCarbSource, updateCarbSource, removeCarbSource,
    calculatedSourceGrams, totals
  };
}
