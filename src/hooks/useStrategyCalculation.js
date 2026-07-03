"use client";
import { useState, useMemo } from "react";

export function useStrategyCalculation({ durationHours }) {
  const [weight, setWeight] = useState(70);
  const [isSmartSuggestions, setIsSmartSuggestions] = useState(false);
  const [gender, setGender] = useState("male");
  const [intensity, setIntensity] = useState("tempo"); // recovery, tempo, threshold, maximum
  const [temperature, setTemperature] = useState(20);
  const [humidity, setHumidity] = useState(50);
  const [ultraMode, setUltraMode] = useState(false);
  const [includeCaffeine, setIncludeCaffeine] = useState(false);
  const [caffeineHabituation, setCaffeineHabituation] = useState("habituated"); // naive, habituated

  const suggestedStrategies = useMemo(() => {
    let carbsPerHour = 60;
    let targetRatio = { glucose: 1.0, fructose: 0.8 };
    
    // 1. Carbohydrate Logic (Absolute duration-based, not weight-based)
    if (durationHours < 1.0) {
      carbsPerHour = 30; // 0-30g or mouth rinse
      targetRatio = { glucose: 1.0, fructose: 0.0 };
    } else if (durationHours >= 1.0 && durationHours <= 2.5) {
      carbsPerHour = 45; // 30-60g
      targetRatio = { glucose: 2.0, fructose: 1.0 }; // 2:1 is optimal here
    } else if (durationHours > 2.5) {
      if (ultraMode) {
        carbsPerHour = 105; // 90-120g range
        targetRatio = { glucose: 1.0, fructose: 0.8 }; // 1:0.8 required for extreme intake
      } else {
        carbsPerHour = 75; // 60-90g range
        targetRatio = { glucose: 2.0, fructose: 1.0 };
      }
    }

    // 2. Sweat Rate Logic (USARIEM proxy based on MHP and Env)
    const baseSweat = gender === "female" ? 0.5 : 0.8;
    
    let intensityModifier = 1.0;
    if (intensity === "recovery") intensityModifier = 0.8;
    else if (intensity === "tempo") intensityModifier = 1.2;
    else if (intensity === "threshold") intensityModifier = 1.5;
    else if (intensity === "maximum") intensityModifier = 1.8;

    // Environmental modifiers
    const heatLoad = (temperature - 15) * 0.03; 
    const humidityLoad = (humidity - 50) * 0.005; // high humidity increases sweat due to poor evaporation
    
    let sweatRate = (baseSweat * intensityModifier) + heatLoad + humidityLoad;
    sweatRate = Math.max(0.3, Math.min(sweatRate, 3.5)); // constrain to realistic physiological limits

    // 3. Caffeine Logic
    let caffeineStrategy = {
      preRace: 0,
      intraRacePerHour: 0,
      delayStartHours: 0,
      warning: null
    };

    if (includeCaffeine) {
      if (durationHours < 2.0) {
        // Single bolus dose 60 mins prior
        const mgPerKg = caffeineHabituation === "naive" ? 2 : 5;
        caffeineStrategy.preRace = Math.min(mgPerKg * weight, 450); // cap at safe limits
      } else if (durationHours >= 2.0 && durationHours <= 5.0) {
        // Split delivery
        caffeineStrategy.preRace = 100;
        caffeineStrategy.intraRacePerHour = 1.0 * weight; // 1 mg/kg/hr maintenance
      } else {
        // Ultra (> 5 hours) - combat sleep monster later in race
        caffeineStrategy.preRace = 0;
        caffeineStrategy.delayStartHours = Math.floor(durationHours / 2); // Start halfway through
        caffeineStrategy.intraRacePerHour = 75; // 50-100mg/hr flat
      }
      
      // Toxicity failsafe check (max 6mg/kg in a 2hr window)
      const maxSafeWindow = 6 * weight;
      const proposedWindow = caffeineStrategy.preRace + (caffeineStrategy.intraRacePerHour * 2);
      if (proposedWindow > maxSafeWindow) {
        caffeineStrategy.warning = "Toxicity threshold exceeded. Dose capped.";
        caffeineStrategy.preRace = Math.min(caffeineStrategy.preRace, maxSafeWindow * 0.6);
        caffeineStrategy.intraRacePerHour = Math.min(caffeineStrategy.intraRacePerHour, (maxSafeWindow * 0.4) / 2);
      }
    }

    return {
      carbsPerHour,
      targetRatio,
      sweatRate,
      caffeineStrategy
    };
  }, [durationHours, weight, gender, intensity, temperature, humidity, ultraMode, includeCaffeine, caffeineHabituation]);

  // 4. Cost Logic
  const getCostAnalysis = (totalCarbs) => {
    // ~$2.50 per 25g commercial gel -> $0.10 per gram of carbs
    const commercialCost = totalCarbs * 0.10;
    // DIY powders are roughly $0.015 per gram of carbs
    const diyCost = totalCarbs * 0.015;
    
    return {
      commercialTotal: commercialCost,
      diyTotal: diyCost,
      savings: commercialCost - diyCost,
    };
  };

  return {
    weight, setWeight,
    isSmartSuggestions, setIsSmartSuggestions,
    gender, setGender,
    intensity, setIntensity,
    temperature, setTemperature,
    humidity, setHumidity,
    ultraMode, setUltraMode,
    includeCaffeine, setIncludeCaffeine,
    caffeineHabituation, setCaffeineHabituation,
    suggestedStrategies,
    getCostAnalysis
  };
}
