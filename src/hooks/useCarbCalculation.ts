import { useState, useMemo, useCallback } from 'react';
import type { CarbSource, CalculatedCarbData, CarbTotals, SourceGrams, CarbSourceOption } from '@/types/gelCalculator';
import { sourceDataMap } from '@/constants/gelCalculator';

interface UseCarbCalculationProps {
    totalCarbsNeeded: number;
    initialGlucoseSources?: CarbSource[];
    initialFructoseSources?: CarbSource[];
    initialGlucoseRatio?: number;
    initialFructoseRatio?: number;
}

export function useCarbCalculation({
    totalCarbsNeeded,
    initialGlucoseSources = [],
    initialFructoseSources = [],
    initialGlucoseRatio = 100,
    initialFructoseRatio = 80,
}: UseCarbCalculationProps) {
    const [glucoseSources, setGlucoseSources] = useState<CarbSource[]>(initialGlucoseSources);
    const [fructoseSources, setFructoseSources] = useState<CarbSource[]>(initialFructoseSources);
    const [glucoseRatioSlider, setGlucoseRatioSlider] = useState(initialGlucoseRatio);
    const [fructoseRatioSlider, setFructoseRatioSlider] = useState(initialFructoseRatio);

    const isGlucosePercentagesValid = useMemo(() => {
        if (glucoseSources.length === 0) return true;
        const sum = glucoseSources.reduce((acc, source) => acc + source.percentage, 0);
        return Math.abs(sum - 100) < 0.01;
    }, [glucoseSources]);

    const isFructosePercentagesValid = useMemo(() => {
        if (fructoseSources.length === 0) return true;
        const sum = fructoseSources.reduce((acc, source) => acc + source.percentage, 0);
        return Math.abs(sum - 100) < 0.01;
    }, [fructoseSources]);

    const calculatedSourceGrams = useMemo((): CalculatedCarbData => {
        const finalGrams: SourceGrams = { totalGrams: 0 };
        let glucoseAccountedByMixed = 0;
        let fructoseAccountedByMixed = 0;

        if (totalCarbsNeeded <= 0 || (glucoseRatioSlider + fructoseRatioSlider <= 0)) {
            return { finalGrams: { totalGrams: 0 }, glucoseAccountedByMixed: 0, fructoseAccountedByMixed: 0 };
        }
        if (!isGlucosePercentagesValid || !isFructosePercentagesValid) {
            return { finalGrams: { totalGrams: 0 }, glucoseAccountedByMixed: 0, fructoseAccountedByMixed: 0 };
        }

        const totalRatioParts = glucoseRatioSlider + fructoseRatioSlider;
        const targetGlucoseCarbs = (glucoseRatioSlider / totalRatioParts) * totalCarbsNeeded;
        const targetFructoseCarbs = (fructoseRatioSlider / totalRatioParts) * totalCarbsNeeded;

        const tentativeMixedGrams: Record<string, number> = {};
        const allSelectedSources = [...glucoseSources, ...fructoseSources];
        const getSourceData = (sourceName: string) => sourceDataMap.get(sourceName);

        glucoseSources.forEach(source => {
            const data = getSourceData(source.source);
            if (data && data.glucoseContent > 0 && data.fructoseContent > 0 && source.percentage > 0) {
                const targetCarbs = targetGlucoseCarbs * (source.percentage / 100);
                const grams = (data.glucoseContent > 0 && data.carbsPerGram > 0)
                    ? targetCarbs / (data.glucoseContent * data.carbsPerGram)
                    : 0;
                tentativeMixedGrams[source.source] = grams;
            }
        });

        fructoseSources.forEach(source => {
            const data = getSourceData(source.source);
            if (data && data.glucoseContent > 0 && data.fructoseContent > 0 && source.percentage > 0) {
                const targetCarbs = targetFructoseCarbs * (source.percentage / 100);
                const grams = (data.fructoseContent > 0 && data.carbsPerGram > 0)
                    ? targetCarbs / (data.fructoseContent * data.carbsPerGram)
                    : 0;
                tentativeMixedGrams[source.source] = tentativeMixedGrams[source.source] ?? grams;
            }
        });

        for (const sourceName in tentativeMixedGrams) {
            const grams = tentativeMixedGrams[sourceName];
            const data = getSourceData(sourceName);
            if (data && grams > 0) {
                glucoseAccountedByMixed += grams * data.glucoseContent * data.carbsPerGram;
                fructoseAccountedByMixed += grams * data.fructoseContent * data.carbsPerGram;
            }
        }

        const neededPureGlucoseCarbs = Math.max(0, targetGlucoseCarbs - glucoseAccountedByMixed);
        const neededPureFructoseCarbs = Math.max(0, targetFructoseCarbs - fructoseAccountedByMixed);

        const pureGlucoseSources = glucoseSources.filter(source => {
            const data = getSourceData(source.source);
            return data && data.glucoseContent > 0 && data.fructoseContent === 0;
        });
        const totalPureGlucosePercent = pureGlucoseSources.reduce((sum, s) => sum + s.percentage, 0);

        if (totalPureGlucosePercent > 0) {
            pureGlucoseSources.forEach(source => {
                const data = getSourceData(source.source);
                if (!data || data.carbsPerGram === 0 || data.glucoseContent === 0) {
                    finalGrams[source.source] = 0; return;
                };
                const shareOfNeed = source.percentage / totalPureGlucosePercent;
                const targetCarbsForThisSource = neededPureGlucoseCarbs * shareOfNeed;
                const grams_pgi = (data.glucoseContent * data.carbsPerGram > 0)
                    ? targetCarbsForThisSource / (data.glucoseContent * data.carbsPerGram)
                    : 0;
                finalGrams[source.source] = grams_pgi;
            });
        } else {
            pureGlucoseSources.forEach(source => { finalGrams[source.source] = 0; });
        }

        const pureFructoseSources = fructoseSources.filter(source => {
            const data = getSourceData(source.source);
            return data && data.fructoseContent > 0 && data.glucoseContent === 0;
        });
        const totalPureFructosePercent = pureFructoseSources.reduce((sum, s) => sum + s.percentage, 0);

        if (totalPureFructosePercent > 0) {
            pureFructoseSources.forEach(source => {
                const data = getSourceData(source.source);
                if (!data || data.carbsPerGram === 0 || data.fructoseContent === 0) {
                    finalGrams[source.source] = 0; return;
                };
                const shareOfNeed = source.percentage / totalPureFructosePercent;
                const targetCarbsForThisSource = neededPureFructoseCarbs * shareOfNeed;
                const grams_pfj = (data.fructoseContent * data.carbsPerGram > 0)
                    ? targetCarbsForThisSource / (data.fructoseContent * data.carbsPerGram)
                    : 0;
                finalGrams[source.source] = grams_pfj;
            });
        } else {
            pureFructoseSources.forEach(source => { finalGrams[source.source] = 0; });
        }

        for (const sourceName in tentativeMixedGrams) {
            if (!(sourceName in finalGrams)) {
                finalGrams[sourceName] = tentativeMixedGrams[sourceName];
            }
        }

        allSelectedSources.forEach(source => {
            if (source.source && !(source.source in finalGrams)) {
                finalGrams[source.source] = 0;
            }
        });

        for (const sourceName in finalGrams) {
            finalGrams[sourceName] = parseFloat(finalGrams[sourceName].toFixed(2));
        }

        finalGrams.totalGrams = Object.values(finalGrams).reduce((sum, grams) => {
            return typeof grams === 'number' ? sum + grams : sum;
        }, 0);

        return {
            finalGrams,
            glucoseAccountedByMixed,
            fructoseAccountedByMixed
        };

    }, [
        totalCarbsNeeded,
        glucoseRatioSlider,
        fructoseRatioSlider,
        glucoseSources,
        fructoseSources,
        isGlucosePercentagesValid,
        isFructosePercentagesValid
    ]);

    const carbTotals = useMemo((): CarbTotals => {
        const { finalGrams, glucoseAccountedByMixed, fructoseAccountedByMixed } = calculatedSourceGrams;

        const totalRatioParts = glucoseRatioSlider + fructoseRatioSlider;
        const targetGlucoseCarbs = totalRatioParts > 0 ? (glucoseRatioSlider / totalRatioParts) * totalCarbsNeeded : 0;
        const targetFructoseCarbs = totalRatioParts > 0 ? (fructoseRatioSlider / totalRatioParts) * totalCarbsNeeded : 0;

        if (glucoseSources.length === 0 && fructoseSources.length === 0) {
            return {
                targetGlucoseCarbs,
                targetFructoseCarbs,
                actualGlucoseCarbs: 0,
                actualFructoseCarbs: 0,
                canAchieveRatio: true,
                message: ""
            };
        }

        let actualGlucoseCarbs = 0;
        let actualFructoseCarbs = 0;
        let canAchieveRatio = true;
        let message = "";

        let validationMessage = "";
        if (!isGlucosePercentagesValid && glucoseSources.length > 0) {
            validationMessage += "Glucose source percentages must sum to 100%. ";
        }
        if (!isFructosePercentagesValid && fructoseSources.length > 0) {
            validationMessage += "Fructose source percentages must sum to 100%. ";
        }

        if (validationMessage) {
            canAchieveRatio = false;
            message = validationMessage + "Calculation paused.";
            return { targetGlucoseCarbs, targetFructoseCarbs, actualGlucoseCarbs: 0, actualFructoseCarbs: 0, canAchieveRatio, message };
        }

        for (const sourceName in finalGrams) {
            if (sourceName === 'totalGrams') continue;
            const grams = finalGrams[sourceName];
            const data = sourceDataMap.get(sourceName);
            if (data && typeof grams === 'number' && grams > 0) {
                actualGlucoseCarbs += grams * data.glucoseContent * data.carbsPerGram;
                actualFructoseCarbs += grams * data.fructoseContent * data.carbsPerGram;
            }
        }

        const glucoseDiff = Math.abs(actualGlucoseCarbs - targetGlucoseCarbs);
        const fructoseDiff = Math.abs(actualFructoseCarbs - targetFructoseCarbs);
        const totalActualCarbs = actualGlucoseCarbs + actualFructoseCarbs;
        const totalDiff = Math.abs(totalActualCarbs - totalCarbsNeeded);

        const tolerance = Math.max(0.5, totalCarbsNeeded * 0.01);

        const actualRatioDisplay = actualFructoseCarbs > 0.01 ? (actualGlucoseCarbs / actualFructoseCarbs).toFixed(2) : (actualGlucoseCarbs > 0.01 ? "Inf" : "N/A");
        const targetRatioDisplay = targetFructoseCarbs > 0.01 ? (targetGlucoseCarbs / targetFructoseCarbs).toFixed(2) : (targetGlucoseCarbs > 0.01 ? "Inf" : "N/A");

        if (totalActualCarbs > 0.01 && (glucoseDiff > tolerance || fructoseDiff > tolerance || totalDiff > tolerance)) {
            canAchieveRatio = false;

            if (totalDiff > tolerance) {
                message = `Total calculated carbs (${totalActualCarbs.toFixed(1)}g) differ significantly from target (${totalCarbsNeeded.toFixed(1)}g). `;
            }
            if (glucoseDiff > tolerance || fructoseDiff > tolerance) {
                if (message) message += " ";
                message += `Actual ratio (${actualRatioDisplay}:1) deviates from target (${targetRatioDisplay}:1).`;

                const needsPureGlucose = targetGlucoseCarbs > glucoseAccountedByMixed + tolerance;
                const hasPureGlucoseSource = glucoseSources.some(s => { const d = sourceDataMap.get(s.source); return d && d.fructoseContent === 0 && s.percentage > 0; });
                const needsPureFructose = targetFructoseCarbs > fructoseAccountedByMixed + tolerance;
                const hasPureFructoseSource = fructoseSources.some(s => { const d = sourceDataMap.get(s.source); return d && d.glucoseContent === 0 && s.percentage > 0; });

                if (needsPureGlucose && !hasPureGlucoseSource && glucoseDiff > tolerance) {
                    message += " Consider adding a pure glucose source.";
                } else if (needsPureFructose && !hasPureFructoseSource && fructoseDiff > tolerance) {
                    message += " Consider adding a pure fructose source.";
                } else if (glucoseDiff > tolerance || fructoseDiff > tolerance) {
                    if (!message.includes("Consider adding")) {
                        message += " Review source selection/percentages.";
                    }
                }
            }
        }

        return {
            targetGlucoseCarbs,
            targetFructoseCarbs,
            actualGlucoseCarbs,
            actualFructoseCarbs,
            canAchieveRatio,
            message
        };
    }, [
        calculatedSourceGrams,
        totalCarbsNeeded,
        glucoseRatioSlider,
        fructoseRatioSlider,
        glucoseSources,
        fructoseSources,
        isGlucosePercentagesValid,
        isFructosePercentagesValid
    ]);

    const getSourceGrams = useCallback((sourceName: string): number => {
        if (!isGlucosePercentagesValid || !isFructosePercentagesValid) return 0;
        return calculatedSourceGrams.finalGrams[sourceName] || 0;
    }, [calculatedSourceGrams, isGlucosePercentagesValid, isFructosePercentagesValid]);

    const handleSourceChange = (
        value: string,
        index: number,
        type: 'glucose' | 'fructose',
        options: CarbSourceOption[]
    ) => {
        const selectedSource = options.find(option => option.label === value);
        if (selectedSource) {
            const setSources = type === 'glucose' ? setGlucoseSources : setFructoseSources;
            setSources(prevSources => {
                const newSources = [...prevSources];
                newSources[index] = {
                    ...newSources[index],
                    source: selectedSource.label,
                    carbsPerGram: selectedSource.carbsPerGram,
                };
                return newSources;
            });
        }
    };

    const handleRemoveSource = (index: number, type: 'glucose' | 'fructose') => {
        const setSources = type === 'glucose' ? setGlucoseSources : setFructoseSources;
        setSources(prevSources => {
            let newSources = prevSources.filter((_, i) => i !== index);
            const currentSum = newSources.reduce((acc, s) => acc + s.percentage, 0);
            if (newSources.length === 1 && Math.abs(currentSum - 100) > 0.01) {
                newSources[0].percentage = 100;
            }
            return newSources;
        });
    };

    const handlePercentageChange = (value: number, index: number, type: 'glucose' | 'fructose') => {
        const setSources = type === 'glucose' ? setGlucoseSources : setFructoseSources;
        setSources(prevSources => {
            const newSources = [...prevSources];
            newSources[index].percentage = Math.max(0, Math.min(100, value));
            return newSources;
        });
    };

    const handleAddSource = (type: 'glucose' | 'fructose') => {
        const setSources = type === 'glucose' ? setGlucoseSources : setFructoseSources;
        setSources(prevSources => [
            ...prevSources,
            { source: '', carbsPerGram: 0, percentage: prevSources.length === 0 ? 100 : 0 }
        ]);
    };


    return {
        glucoseSources,
        fructoseSources,
        glucoseRatioSlider,
        fructoseRatioSlider,
        setGlucoseRatioSlider,
        setFructoseRatioSlider,
        isGlucosePercentagesValid,
        isFructosePercentagesValid,
        calculatedSourceGrams,
        carbTotals,
        getSourceGrams,
        handleSourceChange,
        handleRemoveSource,
        handlePercentageChange,
        handleAddSource,
    };
}
