"use client";

import React, { useState, useMemo } from 'react';
import Image from 'next/image';

import { useCarbCalculation } from '@/hooks/useCarbCalculation';
import { useElectrolyteCalculation } from '@/hooks/useElectrolyteCalculation';

import { glucoseSourceOptions, fructoseSourceOptions } from '@/constants/gelCalculator';

import {
    BasicInputs,
    CarbSourceSection,
    ElectrolyteSection,
    RecipeSection
} from './gel-calculator';
import Footer from '@/components/ui/footer';
import RecipeModal from '@/components/ui/RecipeModal';

const GelCalculator = () => {
    const [hours, setHours] = useState(1);
    const [carbsPerHour, setCarbsPerHour] = useState(90);
    const [isBatchMode, setIsBatchMode] = useState(true);
    const [gelsPerHour, setGelsPerHour] = useState(3);
    const [recipeModalOpen, setRecipeModalOpen] = useState(false);

    const totalCarbsNeeded = useMemo(() => carbsPerHour * hours, [carbsPerHour, hours]);

    const {
        glucoseSources,
        fructoseSources,
        glucoseRatioSlider,
        fructoseRatioSlider,
        setGlucoseRatioSlider,
        setFructoseRatioSlider,
        isGlucosePercentagesValid,
        isFructosePercentagesValid,
        calculatedSourceGrams: calculatedCarbData,
        carbTotals,
        getSourceGrams,
        handleSourceChange,
        handleRemoveSource,
        handlePercentageChange,
        handleAddSource,
    } = useCarbCalculation({ totalCarbsNeeded });

    const {
        isSweatRate,
        setIsSweatRate,
        sweatRate,
        setSweatRate,
        saltiness,
        setSaltiness,
        activeElectrolytes,
        setActiveElectrolytes,
        electrolyteSources,
        manualTargets,
        targetAmountsPerHour,
        electrolyteAnalysis,
        calculateTotalContribution,
        handleElectrolyteSourceChange,
        handleElectrolyteAmountChange,
        addElectrolyteSource,
        removeElectrolyteSource,
        handleManualTargetChange,
        handleAutoCalculateElectrolytes,
    } = useElectrolyteCalculation({ hours });

    return (
        <div className="w-full max-w-4xl mx-auto p-2 sm:p-4 space-y-4 sm:space-y-6">
            <div className="flex items-center justify-center gap-2 text-xl sm:text-2xl font-bold text-foreground">
                <div>
                    <Image
                        src="/gel-calculator/favicon.svg"
                        alt="Gel Calculator Logo"
                        width={32}
                        height={32}
                        className="w-6 h-6 sm:w-8 sm:h-8"
                    />
                </div>
                <h1>Gel Calculator</h1>
            </div>

            <BasicInputs
                hours={hours}
                setHours={setHours}
                carbsPerHour={carbsPerHour}
                setCarbsPerHour={setCarbsPerHour}
                totalCarbsNeeded={totalCarbsNeeded}
            />

            <CarbSourceSection
                title="Glucose"
                pathwayName="SGLT1"
                ratioSliderValue={glucoseRatioSlider}
                onRatioSliderChange={setGlucoseRatioSlider}
                targetCarbs={carbTotals.targetGlucoseCarbs}
                actualCarbs={carbTotals.actualGlucoseCarbs}
                canAchieveRatio={carbTotals.canAchieveRatio}
                sources={glucoseSources}
                sourceOptions={glucoseSourceOptions}
                onSourceChange={(value, index) => handleSourceChange(value, index, 'glucose', glucoseSourceOptions)}
                onPercentageChange={(value, index) => handlePercentageChange(value, index, 'glucose')}
                onRemoveSource={(index) => handleRemoveSource(index, 'glucose')}
                onAddSource={() => handleAddSource('glucose')}
                getSourceGrams={getSourceGrams}
                isPercentageValid={isGlucosePercentagesValid}
            />

            <CarbSourceSection
                title="Fructose"
                pathwayName="GLUT-5"
                ratioSliderValue={fructoseRatioSlider}
                onRatioSliderChange={setFructoseRatioSlider}
                targetCarbs={carbTotals.targetFructoseCarbs}
                actualCarbs={carbTotals.actualFructoseCarbs}
                canAchieveRatio={carbTotals.canAchieveRatio}
                detailedMessage={carbTotals.message}
                sources={fructoseSources}
                sourceOptions={fructoseSourceOptions}
                onSourceChange={(value, index) => handleSourceChange(value, index, 'fructose', fructoseSourceOptions)}
                onPercentageChange={(value, index) => handlePercentageChange(value, index, 'fructose')}
                onRemoveSource={(index) => handleRemoveSource(index, 'fructose')}
                onAddSource={() => handleAddSource('fructose')}
                getSourceGrams={getSourceGrams}
                isPercentageValid={isFructosePercentagesValid}
            />

            <ElectrolyteSection
                hours={hours}
                isSweatRate={isSweatRate}
                setIsSweatRate={setIsSweatRate}
                sweatRate={sweatRate}
                setSweatRate={setSweatRate}
                saltiness={saltiness}
                setSaltiness={setSaltiness}
                activeElectrolytes={activeElectrolytes}
                setActiveElectrolytes={setActiveElectrolytes}
                electrolyteSources={electrolyteSources}
                manualTargets={manualTargets}
                targetAmountsPerHour={targetAmountsPerHour}
                electrolyteAnalysis={electrolyteAnalysis}
                calculateTotalContribution={calculateTotalContribution}
                handleElectrolyteSourceChange={handleElectrolyteSourceChange}
                handleElectrolyteAmountChange={handleElectrolyteAmountChange}
                addElectrolyteSource={addElectrolyteSource}
                removeElectrolyteSource={removeElectrolyteSource}
                handleManualTargetChange={handleManualTargetChange}
                handleAutoCalculateElectrolytes={handleAutoCalculateElectrolytes}
            />

            <RecipeSection
                hours={hours}
                isBatchMode={isBatchMode}
                setIsBatchMode={setIsBatchMode}
                gelsPerHour={gelsPerHour}
                setGelsPerHour={setGelsPerHour}
                setRecipeModalOpen={setRecipeModalOpen}
                calculatedCarbData={calculatedCarbData}
                carbTotals={carbTotals}
                electrolyteSources={electrolyteSources}
            />

            <Footer />
            <RecipeModal
                open={recipeModalOpen}
                onOpenChange={setRecipeModalOpen}
                isBatchMode={isBatchMode}
                gelsPerHour={gelsPerHour}
                hours={hours}
                calculatedCarbData={calculatedCarbData}
                electrolyteSources={electrolyteSources}
            />
        </div>
    );
};

export default GelCalculator;
