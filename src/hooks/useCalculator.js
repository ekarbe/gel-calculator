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

import { useState, useEffect } from "react";
import { glucoseSourceOptions, fructoseSourceOptions, electrolyteSourceOptions } from "../constants/constants";

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
  const [electrolyteSources, setElectrolyteSources] = useState([
    { id: 1, name: "Sodium Chloride (Table Salt)"}
  ])

  const addSource = (type) => {
    const newSource = { id: Date.now(), name: "", percentage: 0 };
    if (type === "glucose") {
      setGlucoseSources((prev) => {
        const usedNames = prev.map((s) => s.name);
        const availableOption = glucoseSourceOptions.find(
          (opt) => !usedNames.includes(opt.label),
        );
        if (!availableOption) return prev;
        return [...prev, { ...newSource, name: availableOption.label }];
      });
    } else if (type === "fructose") {
      setFructoseSources((prev) => {
        const usedNames = prev.map((s) => s.name);
        const availableOption = fructoseSourceOptions.find(
          (opt) => !usedNames.includes(opt.label),
        );
        if (!availableOption) return prev;
        return [...prev, { ...newSource, name: availableOption.label }];
      });
    } else if (type === "electrolyte") {
      setElectrolyteSources((prev) => {
        const usedNames = prev.map((s) => s.name);
        const availableOption = electrolyteSourceOptions.find(
          (opt) => !usedNames.includes(opt.label),
        );
        if (!availableOption) return prev;
        return [...prev, { id: Date.now(), name: availableOption.label, amount: 0 }];
      });
    }
  };

  const updateSource = (type, id, field, value) => {
    if (type === "glucose") {
      setGlucoseSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
      );
    } else if (type === "fructose") {
      setFructoseSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
      );
    } else if (type === "electrolyte") {
      setElectrolyteSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
      );
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

  // Calculated State
  const [totals, setTotals] = useState({
    glucoseRatio: 56,
    fructoseRatio: 44,
    malto: 151,
    fructose: 119,
    sodiumCitrate: 3000,
    tableSalt: 1500,
    water: 180,
    sodiumMatch: 95,
  });

  const recipeRef = null;

  // Core Calculation Engine
  useEffect(() => {
    const durationHours = duration / 60;
    const totalCarbsRequired = durationHours * targetCarbs;
    const totalParts = glucoseParts + fructoseParts;
    const validTotalParts = totalParts > 0 ? totalParts : 1;

    const gRatio = Math.round((glucoseParts / validTotalParts) * 100);
    const fRatio = Math.round((fructoseParts / validTotalParts) * 100);

    setTotals((prev) => ({
      ...prev,
      glucoseRatio: gRatio,
      fructoseRatio: fRatio,
      malto: Math.round(totalCarbsRequired * (gRatio / 100)),
      fructose: Math.round(totalCarbsRequired * (fRatio / 100)),
      water: Math.round(durationHours * 60),
    }));
  }, [duration, targetCarbs, glucoseParts, fructoseParts]);

  const scrollToRecipe = () =>
    recipeRef.current?.scrollIntoView({ behavior: "smooth" });

  const getDisplayValue = (val) => {
    if (recipeView === "perGel") {
      const totalGels = (duration / 60) * gelsPerHour;
      return Math.round(val / (totalGels || 1));
    }
    return val;
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
    duration,
    setDuration,
    targetCarbs,
    setTargetCarbs,
    glucoseParts,
    setGlucoseParts,
    fructoseParts,
    setFructoseParts,
    glucoseSources,
    setGlucoseSources,
    fructoseSources,
    setFructoseSources,
    electrolyteSources,
    setElectrolyteSources,
    addSource,
    updateSource,
    removeSource,
    recipeView,
    setRecipeView,
    gelsPerHour,
    setGelsPerHour,
    isMixingModalOpen,
    setIsMixingModalOpen,
    isTemplateModalOpen,
    setIsTemplateModalOpen,
    isShareModalOpen,
    setIsShareModalOpen,
    shareView,
    setShareView,
    toastMessage,
    setToastMessage,
    totals,
    setTotals,
    recipeRef,
    useEffect,
    scrollToRecipe,
    getDisplayValue,
    showToast,
    handleCopyLink,
    handleCopyImage,
    applyTemplate,
    onOpenInstructions,
    onOpenTemplates,
    onOpenShare,
  };
}
