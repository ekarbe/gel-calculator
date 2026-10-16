"use client";
import { useState, useMemo } from "react";
import { electrolyteSourceOptions, sourceDataByIdMap, SWEAT_RATES, ELECTROLYTE_CONCENTRATIONS, CONVERSION_FACTORS } from "../constants/constants";
import { capSodiumTargets } from "../lib/safety";

const SODIUM_CHLORIDE_ID = 31;
const PREFERRED_SOURCE_IDS = { Sodium: 33, Potassium: 39, Magnesium: 34, Calcium: 35 };

export function useElectrolyteCalculation({ durationHours, sweatRateOverride, isSmartSuggestions, sodiumConcentrationOverride }) {
  const [electrolyteSources, setElectrolyteSources] = useState([]);
  const [isSweatRate, setIsSweatRate] = useState(true);
  const [sweatRate, setSweatRate] = useState(2); // 0-5 index
  const [saltiness, setSaltiness] = useState(2); // 0-5 index
  const [activeElectrolytes, setActiveElectrolytes] = useState({ Sodium: true, Chloride: true, Potassium: true, Magnesium: true, Calcium: true });
  const [manualTargets, setManualTargets] = useState({ Sodium: 0, Chloride: 0, Potassium: 0, Magnesium: 0, Calcium: 0 });

  const addElectrolyteSource = () => {
    setElectrolyteSources((prev) => {
      const usedNames = prev.map((s) => s.name);
      const availableOption = electrolyteSourceOptions.find((opt) => !usedNames.includes(opt.label));
      if (!availableOption) return prev;
      return [...prev, { id: Date.now(), name: availableOption.label, amount: 0 }];
    });
  };

  const updateElectrolyteSource = (id, field, value) => {
    setElectrolyteSources((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const removeElectrolyteSource = (id) => {
    setElectrolyteSources((prev) => prev.filter((s) => s.id !== id));
  };

  const sodiumTarget = useMemo(() => {
    const targets = { Sodium: 0, Chloride: 0, Potassium: 0, Magnesium: 0, Calcium: 0 };
    if (!isSweatRate && !isSmartSuggestions) {
      // Manual targets are the user's own numbers: never capped, only warned about.
      Object.keys(targets).forEach(key => targets[key] = activeElectrolytes[key] ? manualTargets[key] : 0);
      return { targets, sodiumCapped: false, uncappedSodium: targets.Sodium };
    }

    const rateL = isSmartSuggestions && sweatRateOverride !== undefined ? sweatRateOverride : (sweatRateOverride !== undefined ? sweatRateOverride : SWEAT_RATES[sweatRate]);
    Object.keys(targets).forEach(key => {
      if (!isSmartSuggestions && !activeElectrolytes[key]) {
        targets[key] = 0;
        return;
      }

      if (isSmartSuggestions && (key === 'Potassium' || key === 'Magnesium' || key === 'Calcium')) {
        targets[key] = 0;
        return;
      }

      if (isSmartSuggestions && (key === 'Sodium' || key === 'Chloride')) {
        const conversion = CONVERSION_FACTORS[key];
        targets[key] = rateL * sodiumConcentrationOverride * conversion;
        return;
      }

      const concentrations = ELECTROLYTE_CONCENTRATIONS[key];
      if (concentrations) {
        const conc_mmolL = concentrations[saltiness];
        const conversion = CONVERSION_FACTORS[key];
        targets[key] = rateL * conc_mmolL * conversion;
      }
    });
    return capSodiumTargets(targets);
  }, [isSweatRate, sweatRate, saltiness, manualTargets, activeElectrolytes, sweatRateOverride, isSmartSuggestions, sodiumConcentrationOverride]);

  const targetAmountsPerHour = sodiumTarget.targets;

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

  const autoFillElectrolytes = () => {
    const totalTargets = {};
    ['Sodium', 'Chloride', 'Potassium', 'Magnesium', 'Calcium'].forEach(type => {
      totalTargets[type] = targetAmountsPerHour[type] * durationHours;
    });

    const newSources = [];
    let idCounter = Date.now();
    
    const addSourceAmount = (name, amount) => {
        if (amount > 0) newSources.push({ id: idCounter++, name, amount: Math.round(amount) });
    };

    if (totalTargets.Chloride > 0) {
        const opt = sourceDataByIdMap.get(SODIUM_CHLORIDE_ID);
        if (opt) {
          const clComp = opt.components.find(c => c.name === 'Chloride');
          const naComp = opt.components.find(c => c.name === 'Sodium');
          const clRatio = clComp.ratio * clComp.absorptionRate;
          const naRatio = naComp.ratio * naComp.absorptionRate;
          
          let powder = totalTargets.Chloride / clRatio;
          if (powder * naRatio > totalTargets.Sodium && totalTargets.Sodium > 0) {
              powder = totalTargets.Sodium / naRatio;
          }
          addSourceAmount(opt.label, powder);
          totalTargets.Chloride -= powder * clRatio;
          totalTargets.Sodium -= powder * naRatio;
        }
    }

    ['Sodium', 'Potassium', 'Magnesium', 'Calcium'].forEach(type => {
        if (totalTargets[type] > 0) {
            const opt = sourceDataByIdMap.get(PREFERRED_SOURCE_IDS[type]);
            if (opt) {
                const comp = opt.components.find(c => c.name === type);
                const powder = totalTargets[type] / (comp.ratio * comp.absorptionRate);
                addSourceAmount(opt.label, powder);
            }
        }
    });

    setElectrolyteSources(newSources);
  };

  return {
    electrolyteSources, setElectrolyteSources,
    isSweatRate, setIsSweatRate,
    sweatRate, setSweatRate,
    saltiness, setSaltiness,
    activeElectrolytes, setActiveElectrolytes,
    manualTargets, setManualTargets,
    addElectrolyteSource, updateElectrolyteSource, removeElectrolyteSource,
    targetAmountsPerHour, electrolyteAnalysis, autoFillElectrolytes,
    sodiumCapped: sodiumTarget.sodiumCapped, uncappedSodiumPerHour: sodiumTarget.uncappedSodium
  };
}
