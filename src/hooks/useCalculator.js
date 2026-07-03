"use client";
import { useState, useRef, useEffect } from "react";
import { allSourcesOptions, sourceDataByIdMap } from "../constants/constants";
import { useCarbCalculation } from "./useCarbCalculation";
import { useElectrolyteCalculation } from "./useElectrolyteCalculation";
import { useStrategyCalculation } from "./useStrategyCalculation";

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
  Calcium: 'ca',
  isSmart: 'ism',
  weight: 'wt',
  gender: 'gnd',
  intensity: 'int',
  temp: 'tmp',
  humidity: 'hum',
  ultraMode: 'ult',
  incCaffeine: 'ic',
  cafHabituation: 'ch',
  sweatSodiumConcentration: 'ssc'
};

function encodeState(state) {
  const parts = [];
  
  if (state.duration !== 60) parts.push(`d_${state.duration}`);
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
  
  if (state.strategy) {
    if (state.strategy.isSmartSuggestions) parts.push(`ism_1`);
    if (state.strategy.weight !== 70) parts.push(`wt_${state.strategy.weight}`);
    if (state.strategy.gender !== 'male') parts.push(`gnd_${state.strategy.gender}`);
    if (state.strategy.intensity !== 'tempo') parts.push(`int_${state.strategy.intensity}`);
    if (state.strategy.temperature !== 20) parts.push(`tmp_${state.strategy.temperature}`);
    if (state.strategy.humidity !== 50) parts.push(`hum_${state.strategy.humidity}`);
    if (state.strategy.ultraMode) parts.push(`ult_1`);
    if (state.strategy.includeCaffeine) parts.push(`ic_1`);
    if (state.strategy.caffeineHabituation !== 'habituated') parts.push(`ch_${state.strategy.caffeineHabituation}`);
    if (state.strategy.sweatSodiumConcentration !== 'average') parts.push(`ssc_${state.strategy.sweatSodiumConcentration}`);
  }

  return parts.length > 0 ? parts.join('~') : 'tm2';
}

function decodeState(str) {
  const state = {};
  if (str === 'tm2') return state;
  
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
    else if (k === 'rv') state.recipeView = v === 'g' ? 'perGel' : 'total';
    else if (k === 'gph') state.gelsPerHour = Number(v);
    else if (k === 'ism') { state.strategy = state.strategy || {}; state.strategy.isSmartSuggestions = v === '1'; }
    else if (k === 'wt') { state.strategy = state.strategy || {}; state.strategy.weight = Number(v); }
    else if (k === 'gnd') { state.strategy = state.strategy || {}; state.strategy.gender = v; }
    else if (k === 'int') { state.strategy = state.strategy || {}; state.strategy.intensity = v; }
    else if (k === 'tmp') { state.strategy = state.strategy || {}; state.strategy.temperature = Number(v); }
    else if (k === 'hum') { state.strategy = state.strategy || {}; state.strategy.humidity = Number(v); }
    else if (k === 'ult') { state.strategy = state.strategy || {}; state.strategy.ultraMode = v === '1'; }
    else if (k === 'ic') { state.strategy = state.strategy || {}; state.strategy.includeCaffeine = v === '1'; }
    else if (k === 'ch') { state.strategy = state.strategy || {}; state.strategy.caffeineHabituation = v; }
    else if (k === 'ssc') { state.strategy = state.strategy || {}; state.strategy.sweatSodiumConcentration = v; }
  }
  return state;
}

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
    targetAmountsPerHour, electrolyteAnalysis, autoFillElectrolytes
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
          
          if (state.strategy) {
            if (state.strategy.isSmartSuggestions !== undefined) strategy.setIsSmartSuggestions(state.strategy.isSmartSuggestions);
            if (state.strategy.weight !== undefined) strategy.setWeight(state.strategy.weight);
            if (state.strategy.gender !== undefined) strategy.setGender(state.strategy.gender);
            if (state.strategy.intensity !== undefined) strategy.setIntensity(state.strategy.intensity);
            if (state.strategy.temperature !== undefined) strategy.setTemperature(state.strategy.temperature);
            if (state.strategy.humidity !== undefined) strategy.setHumidity(state.strategy.humidity);
            if (state.strategy.ultraMode !== undefined) strategy.setUltraMode(state.strategy.ultraMode);
            if (state.strategy.includeCaffeine !== undefined) strategy.setIncludeCaffeine(state.strategy.includeCaffeine);
            if (state.strategy.caffeineHabituation !== undefined) strategy.setCaffeineHabituation(state.strategy.caffeineHabituation);
            if (state.strategy.sweatSodiumConcentration !== undefined) strategy.setSweatSodiumConcentration(state.strategy.sweatSodiumConcentration);
          }
        } catch (e) {
          console.error("Failed to parse share link", e);
        }
      }
    }
  }, []);

  const scrollToRecipe = () => recipeRef.current?.scrollIntoView({ behavior: "smooth" });

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
      duration, targetCarbs, glucoseParts, fructoseParts,
      glucoseSources: compressSources(glucoseSources),
      fructoseSources: compressSources(fructoseSources),
      electrolyteSources: compressSources(electrolyteSources),
      isSweatRate, sweatRate, saltiness, activeElectrolytes,
      manualTargets, recipeView, gelsPerHour,
      strategy: {
        isSmartSuggestions: strategy.isSmartSuggestions,
        weight: strategy.weight,
        gender: strategy.gender,
        intensity: strategy.intensity,
        temperature: strategy.temperature,
        humidity: strategy.humidity,
        ultraMode: strategy.ultraMode,
        includeCaffeine: strategy.includeCaffeine,
        caffeineHabituation: strategy.caffeineHabituation,
        sweatSodiumConcentration: strategy.sweatSodiumConcentration
      }
    };
    try {
      const base64String = encodeState(stateToSave);
      const url = new URL(window.location.href);
      url.searchParams.set('s', base64String);
      
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
        try { document.execCommand('copy'); } catch (err) {} finally { textArea.remove(); }
      }
      showToast("Recipe link copied!");
    } catch (e) {
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
    duration, setDuration, 
    targetCarbs: effectiveTargetCarbs, setTargetCarbs, 
    glucoseParts: effectiveGlucoseParts, setGlucoseParts, 
    fructoseParts: effectiveFructoseParts, setFructoseParts,
    rawTargetCarbs: targetCarbs, rawGlucoseParts: glucoseParts, rawFructoseParts: fructoseParts,
    glucoseSources, setGlucoseSources, fructoseSources, setFructoseSources, electrolyteSources, setElectrolyteSources,
    isSweatRate, setIsSweatRate, sweatRate, setSweatRate, saltiness, setSaltiness, activeElectrolytes, setActiveElectrolytes,
    manualTargets, setManualTargets, addSource, updateSource, removeSource, recipeView, setRecipeView, gelsPerHour, setGelsPerHour,
    autoFillElectrolytes,
    isMixingModalOpen, setIsMixingModalOpen, isTemplateModalOpen, setIsTemplateModalOpen, isShareModalOpen, setIsShareModalOpen,
    shareView, setShareView, toastMessage, setToastMessage, totals, calculatedSourceGrams, targetAmountsPerHour, electrolyteAnalysis,
    recipeRef, scrollToRecipe, getDisplayValue, showToast, handleCopyLink, handleCopyImage, applyTemplate, onOpenInstructions,
    onOpenTemplates, onOpenShare, strategy
  };
}
