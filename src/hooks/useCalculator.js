"use client";
import { useState, useRef, useEffect } from "react";
import { allSourcesOptions, sourceDataByIdMap } from "../constants/constants";
import { encodeShareState, decodeShareState } from "../lib/shareCodec";
import { getGelCount } from "../lib/schedule";
import { useCarbCalculation } from "./useCarbCalculation";
import { useElectrolyteCalculation } from "./useElectrolyteCalculation";
import { useStrategyCalculation } from "./useStrategyCalculation";

export function useCalculator() {
  const [duration, setDuration] = useState(60);
  const [targetCarbs, setTargetCarbs] = useState(90);
  
  const durationHours = duration / 60;

  const strategy = useStrategyCalculation({ durationHours });

  const effectiveTargetCarbs = strategy.isSmartSuggestions ? strategy.suggestedStrategies.carbsPerHour : targetCarbs;
  const effectiveSweatRate = strategy.isSmartSuggestions ? strategy.suggestedStrategies.sweatRate : undefined;

  const {
    glucoseParts, setGlucoseParts,
    fructoseParts, setFructoseParts,
    effectiveGlucoseParts, effectiveFructoseParts,
    glucoseSources, setGlucoseSources,
    fructoseSources, setFructoseSources,
    addCarbSource, updateCarbSource, removeCarbSource,
    calculatedSourceGrams, totals
  } = useCarbCalculation({ 
    durationHours, 
    targetCarbs: effectiveTargetCarbs,
    glucosePartsOverride: strategy.isSmartSuggestions ? strategy.suggestedStrategies.targetRatio.glucose : undefined,
    fructosePartsOverride: strategy.isSmartSuggestions ? strategy.suggestedStrategies.targetRatio.fructose : undefined
  });

  const {
    electrolyteSources, setElectrolyteSources,
    isSweatRate, setIsSweatRate,
    sweatRate, setSweatRate,
    saltiness, setSaltiness,
    activeElectrolytes, setActiveElectrolytes,
    manualTargets, setManualTargets,
    addElectrolyteSource, updateElectrolyteSource, removeElectrolyteSource,
    targetAmountsPerHour, electrolyteAnalysis, autoFillElectrolytes,
    sodiumCapped, uncappedSodiumPerHour
  } = useElectrolyteCalculation({ 
    durationHours, 
    sweatRateOverride: effectiveSweatRate,
    isSmartSuggestions: strategy.isSmartSuggestions,
    sodiumConcentrationOverride: strategy.suggestedStrategies.suggestedSodiumConcentration
  });

  const addSource = (type) => {
    if (type === "glucose" || type === "fructose") addCarbSource(type);
    else if (type === "electrolyte") addElectrolyteSource();
  };

  const updateSource = (type, id, field, value) => {
    if (type === "glucose" || type === "fructose") updateCarbSource(type, id, field, value);
    else if (type === "electrolyte") updateElectrolyteSource(id, field, value);
  };

  const removeSource = (type, id) => {
    if (type === "glucose" || type === "fructose") removeCarbSource(type, id);
    else if (type === "electrolyte") removeElectrolyteSource(id);
  };

  const [recipeView, setRecipeView] = useState("total");
  const [gelsPerHour, setGelsPerHour] = useState(2);

  const [isMixingModalOpen, setIsMixingModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareView, setShareView] = useState("menu");
  const [toastMessage, setToastMessage] = useState("");

  const recipeRef = useRef(null);

  const applySharedState = (state) => {
    const toSources = (sources) => sources.map((src, i) => ({
      id: Date.now() + i + Math.random(),
      name: sourceDataByIdMap.get(src.id)?.label ?? "",
      percentage: src.percentage,
      amount: src.amount,
    }));

    if (state.duration !== undefined) setDuration(state.duration);
    if (state.targetCarbs !== undefined) setTargetCarbs(state.targetCarbs);
    if (state.glucoseParts !== undefined) setGlucoseParts(state.glucoseParts);
    if (state.fructoseParts !== undefined) setFructoseParts(state.fructoseParts);
    if (state.glucoseSources !== undefined) setGlucoseSources(toSources(state.glucoseSources));
    if (state.fructoseSources !== undefined) setFructoseSources(toSources(state.fructoseSources));
    if (state.electrolyteSources !== undefined) setElectrolyteSources(toSources(state.electrolyteSources));
    if (state.isSweatRate !== undefined) setIsSweatRate(state.isSweatRate);
    if (state.sweatRate !== undefined) setSweatRate(state.sweatRate);
    if (state.saltiness !== undefined) setSaltiness(state.saltiness);
    if (state.activeElectrolytes !== undefined) setActiveElectrolytes(state.activeElectrolytes);
    if (state.manualTargets !== undefined) setManualTargets(state.manualTargets);
    if (state.recipeView !== undefined) setRecipeView(state.recipeView);
    if (state.gelsPerHour !== undefined) setGelsPerHour(state.gelsPerHour);

    const s = state.strategy;
    if (s) {
      if (s.isSmartSuggestions !== undefined) strategy.setIsSmartSuggestions(s.isSmartSuggestions);
      if (s.weight !== undefined) strategy.setWeight(s.weight);
      if (s.weightUnit !== undefined) strategy.setWeightUnit(s.weightUnit);
      if (s.gender !== undefined) strategy.setGender(s.gender);
      if (s.intensity !== undefined) strategy.setIntensity(s.intensity);
      if (s.temperature !== undefined) strategy.setTemperature(s.temperature);
      if (s.temperatureUnit !== undefined) strategy.setTemperatureUnit(s.temperatureUnit);
      if (s.humidity !== undefined) strategy.setHumidity(s.humidity);
      if (s.ultraMode !== undefined) strategy.setUltraMode(s.ultraMode);
      if (s.includeCaffeine !== undefined) strategy.setIncludeCaffeine(s.includeCaffeine);
      if (s.includeBicarb !== undefined) strategy.setIncludeBicarb(s.includeBicarb);
      if (s.caffeineHabituation !== undefined) strategy.setCaffeineHabituation(s.caffeineHabituation);
      if (s.sweatSodiumConcentration !== undefined) strategy.setSweatSodiumConcentration(s.sweatSodiumConcentration);
    }
  };

  // The page is statically exported, so the shared recipe in `?s=` can only be
  // read after hydration; restoring it is a one-time sync from the URL into state.
  useEffect(() => {
    const encoded = new URLSearchParams(window.location.search).get("s");
    if (!encoded) return;
    const state = decodeShareState(encoded);
    if (state) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from the URL after static render
      applySharedState(state);
    } else {
      console.warn("Ignoring unreadable share link");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const scrollToRecipe = () => recipeRef.current?.scrollIntoView({ behavior: "smooth" });

  const gelCount = getGelCount(duration, gelsPerHour);

  const getDisplayValue = (val) => {
    if (recipeView === "perGel") {
      return Math.round(val / (gelCount || 1));
    }
    return Math.round(val);
  };

  const toastTimerRef = useRef(null);
  const showToast = (msg) => {
    clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => setToastMessage(""), 3000);
  };

  const handleCopyLink = () => {
    const toIds = (sources) => sources.map(s => {
      const opt = allSourcesOptions.find(o => o.label === s.name);
      return { id: opt ? opt.id : undefined, percentage: s.percentage, amount: s.amount };
    });

    const stateToSave = {
      duration, targetCarbs, glucoseParts, fructoseParts,
      glucoseSources: toIds(glucoseSources),
      fructoseSources: toIds(fructoseSources),
      electrolyteSources: toIds(electrolyteSources),
      isSweatRate, sweatRate, saltiness, activeElectrolytes,
      manualTargets, recipeView, gelsPerHour,
      strategy: {
        isSmartSuggestions: strategy.isSmartSuggestions,
        weight: strategy.weight,
        weightUnit: strategy.weightUnit,
        gender: strategy.gender,
        intensity: strategy.intensity,
        temperature: strategy.temperature,
        temperatureUnit: strategy.temperatureUnit,
        humidity: strategy.humidity,
        ultraMode: strategy.ultraMode,
        includeCaffeine: strategy.includeCaffeine,
        includeBicarb: strategy.includeBicarb,
        caffeineHabituation: strategy.caffeineHabituation,
        sweatSodiumConcentration: strategy.sweatSodiumConcentration
      }
    };
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('s', encodeShareState(stateToSave));

      const copyText = url.toString();
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(copyText).catch(() => {});
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = copyText;
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";
        document.body.prepend(textArea);
        textArea.select();
        try { document.execCommand('copy'); } catch {} finally { textArea.remove(); }
      }
      showToast("Recipe link copied!");
    } catch {
      showToast("Failed to generate link.");
    }
    setIsShareModalOpen(false);
  };

  const applyTemplate = (template) => {
    if (template.glucoseParts !== undefined) setGlucoseParts(template.glucoseParts);
    if (template.fructoseParts !== undefined) setFructoseParts(template.fructoseParts);
    
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

  const totalCarbs = effectiveTargetCarbs * durationHours;
  const totalCalories = totalCarbs * 4; // 4 kcal per gram of carbohydrate

  return {
    duration, setDuration, 
    targetCarbs: effectiveTargetCarbs, setTargetCarbs, 
    glucoseParts: effectiveGlucoseParts, setGlucoseParts, 
    fructoseParts: effectiveFructoseParts, setFructoseParts,
    rawTargetCarbs: targetCarbs, rawGlucoseParts: glucoseParts, rawFructoseParts: fructoseParts,
    glucoseSources, setGlucoseSources, fructoseSources, setFructoseSources, electrolyteSources, setElectrolyteSources,
    isSweatRate, setIsSweatRate, sweatRate, setSweatRate, saltiness, setSaltiness, activeElectrolytes, setActiveElectrolytes,
    manualTargets, setManualTargets, addSource, updateSource, removeSource, recipeView, setRecipeView, gelsPerHour, setGelsPerHour,
    autoFillElectrolytes, totalCarbs, totalCalories, durationHours, gelCount,
    isMixingModalOpen, setIsMixingModalOpen, isTemplateModalOpen, setIsTemplateModalOpen, isShareModalOpen, setIsShareModalOpen,
    shareView, setShareView, toastMessage, setToastMessage, totals, calculatedSourceGrams, targetAmountsPerHour, electrolyteAnalysis,
    sodiumCapped, uncappedSodiumPerHour,
    recipeRef, scrollToRecipe, getDisplayValue, showToast, handleCopyLink, applyTemplate, onOpenInstructions,
    onOpenTemplates, onOpenShare, strategy
  };
}
