// src/hooks/useElectrolyteCalculation.ts

import { useState, useMemo, useCallback } from 'react';
import type {
    ElectrolyteType,
    ElectrolyteSource,
    ElectrolyteAnalysisItem,
    ActiveElectrolytes,
    ManualElectrolyteTargets,
    ElectrolyteSourceOption,
    ElectrolyteComponent
} from '@/types/gelCalculator';
import {
    SWEAT_RATES,
    ELECTROLYTE_CONCENTRATIONS,
    CONVERSION_FACTORS,
    electrolyteSourceOptions,
    initialActiveElectrolytes,
    initialManualTargets
} from '@/constants/gelCalculator';

interface UseElectrolyteCalculationProps {
    hours: number;
}

const getSourceOptionData = (label: string): ElectrolyteSourceOption | undefined => {
    return electrolyteSourceOptions.find(opt => opt.label === label);
};

const getComponentData = (sourceOpt: ElectrolyteSourceOption, componentName: ElectrolyteType | string): Omit<ElectrolyteComponent, 'amount'> | undefined => {
    return sourceOpt.components.find(c => c.name === componentName);
};

export function useElectrolyteCalculation({ hours }: UseElectrolyteCalculationProps) {
    const [isSweatRate, setIsSweatRate] = useState(true);
    const [sweatRate, setSweatRate] = useState(0);
    const [saltiness, setSaltiness] = useState(0);
    const [activeElectrolytes, setActiveElectrolytes] = useState<ActiveElectrolytes>(initialActiveElectrolytes);
    const [electrolyteSources, setElectrolyteSources] = useState<ElectrolyteSource[]>([]);
    const [manualTargets, setManualTargets] = useState<ManualElectrolyteTargets>(initialManualTargets);

    const targetAmountsPerHour = useMemo(() => {
        const calculateElectrolyteNeeds = (electrolyte: ElectrolyteType): number => {
            if (!isSweatRate) return manualTargets[electrolyte];
            if (!activeElectrolytes[electrolyte]) return 0;

            const sweatRateValue = SWEAT_RATES[Math.min(Math.max(0, sweatRate), SWEAT_RATES.length - 1)];
            const concentration = ELECTROLYTE_CONCENTRATIONS[electrolyte][Math.min(Math.max(0, saltiness), ELECTROLYTE_CONCENTRATIONS[electrolyte].length - 1)];
            const mgPerL = concentration * CONVERSION_FACTORS[electrolyte];
            return sweatRateValue * mgPerL;
        };

        const targets: ManualElectrolyteTargets = { Sodium: 0, Chloride: 0, Potassium: 0, Magnesium: 0, Calcium: 0 };
        (Object.keys(targets) as ElectrolyteType[]).forEach(e => {
            targets[e] = calculateElectrolyteNeeds(e);
        });
        return targets;
    }, [isSweatRate, manualTargets, sweatRate, saltiness, activeElectrolytes]);

    const calculateTotalContribution = useCallback((electrolyte: string): number => {
        const totalAbsorbedDuration = electrolyteSources.reduce((total, source) => {
            const component = source.components.find(c => c.name === electrolyte);
            if (component && typeof component.amount === 'number') {
                return total + (component.amount * component.absorptionRate);
            }
            return total;
        }, 0);
        return hours > 0 ? totalAbsorbedDuration / hours : 0;
    }, [electrolyteSources, hours]);

    const calculateWeightedAbsorptionRate = useCallback((electrolyte: ElectrolyteType): number => {
        let totalMg = 0;
        let weightedMg = 0;

        electrolyteSources.forEach(source => {
            source.components.forEach(comp => {
                if (comp.name === electrolyte && typeof comp.amount === 'number' && comp.amount > 0) {
                    totalMg += comp.amount;
                    weightedMg += comp.amount * comp.absorptionRate;
                }
            });
        });

        if (totalMg === 0) return 0;
        return weightedMg / totalMg;
    }, [electrolyteSources]);

    const electrolyteAnalysis = useMemo((): ElectrolyteAnalysisItem[] => {
        return (Object.entries(targetAmountsPerHour) as [ElectrolyteType, number][])
            .filter(([electrolyte]) => activeElectrolytes[electrolyte])
            .map(([electrolyte, targetPerHour]) => {
                const targetTotal = targetPerHour * hours;
                const absRate = calculateWeightedAbsorptionRate(electrolyte);
                const totalMgAdded = electrolyteSources.reduce((sum, source) => {
                    const comp = source.components.find(c => c.name === electrolyte);
                    return sum + (comp?.amount ?? 0);
                }, 0);
                const absorbedTotal = totalMgAdded * absRate;
                const diffAbsorbed = targetTotal - absorbedTotal;
                const percentage = targetTotal > 0 ? (absorbedTotal / targetTotal) * 100 : (absorbedTotal > 0 ? Infinity : 100);
                const hasAnySources = electrolyteSources.some(source =>
                    source.components.some(comp => comp.name === electrolyte && typeof comp.amount === 'number' && comp.amount > 0)
                );
                let message = '';
                const tolerance = 1.0;

                if (!hasAnySources && targetTotal > tolerance) {
                    message = `Need ${targetTotal.toFixed(1)}mg (absorbed), no sources added.`;
                } else if (targetTotal <= tolerance && absorbedTotal > tolerance) {
                    message = `Target is ~0mg, but ${absorbedTotal.toFixed(1)}mg absorbed from sources.`;
                } else if (hasAnySources || targetTotal > tolerance) {
                    if (diffAbsorbed > tolerance) {
                        const additionalAbsorbedNeeded = diffAbsorbed;
                        if (absRate > 0) {
                            const additionalRawMgNeeded = additionalAbsorbedNeeded / absRate;
                            message = `Short by ${additionalAbsorbedNeeded.toFixed(1)}mg (absorbed). Need ~${additionalRawMgNeeded.toFixed(1)}mg more raw ${electrolyte} (avg. ${(absRate * 100).toFixed(0)}% abs.).`;
                        } else {
                            message = `Short by ${additionalAbsorbedNeeded.toFixed(1)}mg (absorbed), but no current sources provide absorbable ${electrolyte}.`;
                        }
                    } else if (diffAbsorbed < -tolerance) {
                        message = `Excess of ${Math.abs(diffAbsorbed).toFixed(1)}mg (absorbed).`;
                    } else {
                        message = 'Target met (absorbed).';
                    }
                } else {
                    message = 'Target is ~0mg, none added.';
                }

                return { electrolyte, percentage, message, absorbed: absorbedTotal, target: targetTotal, hasAnySources };
            });
    }, [targetAmountsPerHour, hours, calculateWeightedAbsorptionRate, activeElectrolytes, electrolyteSources]);

    const handleElectrolyteSourceChange = (value: string, index: number) => {
        const selectedSource = electrolyteSourceOptions.find(option => option.label === value);
        if (selectedSource) {
            setElectrolyteSources(prevSources => {
                const newSources = [...prevSources];
                const currentAmount = newSources[index]?.amount || 0;

                newSources[index] = {
                    source: selectedSource.label,
                    amount: currentAmount,
                    components: selectedSource.components.map(comp => ({
                        name: comp.name,
                        ratio: comp.ratio,
                        absorptionRate: comp.absorptionRate,
                        amount: parseFloat(((comp.ratio) * currentAmount).toFixed(1))
                    }))
                };
                return newSources;
            });
        }
    };

    const handleElectrolyteAmountChange = (value: number, index: number) => {
        setElectrolyteSources(prevSources => {
            const newSources = [...prevSources];
            if (!newSources[index]) return prevSources;

            const source = newSources[index];
            const newAmount = Math.max(0, value);

            newSources[index] = {
                ...source,
                amount: newAmount,
                components: source.components.map(comp => ({
                    ...comp,
                    amount: parseFloat(((comp.ratio) * newAmount).toFixed(1))
                }))
            };
            return newSources;
        });
    };

    const addElectrolyteSource = () => {
        setElectrolyteSources(prev => [...prev, { source: '', amount: 0, components: [] }]);
    };

    const removeElectrolyteSource = (index: number) => {
        setElectrolyteSources(prev => prev.filter((_, i) => i !== index));
    };

    const handleManualTargetChange = (electrolyte: ElectrolyteType, value: number) => {
        setManualTargets(prev => ({
            ...prev,
            [electrolyte]: Math.max(0, value)
        }));
    };

    // --- NEW: Auto-Calculate Handler ---
    const handleAutoCalculateElectrolytes = useCallback(() => {
        if (hours <= 0) {
            setElectrolyteSources([]);
            return;
        }

        const preferredSources: Partial<Record<ElectrolyteType, string>> = {
            Sodium: 'Sodium Chloride (Table Salt)',
            Potassium: 'Potassium Citrate',
            Chloride: 'Sodium Chloride (Table Salt)',
            Magnesium: 'Magnesium Citrate',
            Calcium: 'Calcium Citrate',
        };
        const calculationOrder: ElectrolyteType[] = ['Sodium', 'Potassium', 'Magnesium', 'Calcium', 'Chloride'];

        const totalRawTargets: ManualElectrolyteTargets = (Object.keys(targetAmountsPerHour) as ElectrolyteType[])
            .reduce((acc, key) => {
                acc[key] = activeElectrolytes[key] ? targetAmountsPerHour[key] * hours : 0;
                return acc;
            }, {} as ManualElectrolyteTargets);

        const remainingRawNeedsPass1 = { ...totalRawTargets };
        const sourcesToAdd: Record<string, number> = {};

        calculationOrder.forEach(electrolyte => {
            if (!activeElectrolytes[electrolyte] || remainingRawNeedsPass1[electrolyte] <= 0.01) {
                return;
            }

            const targetRawNeed = remainingRawNeedsPass1[electrolyte];
            const preferredSourceLabel = preferredSources[electrolyte];
            if (!preferredSourceLabel) return;

            const sourceOpt = getSourceOptionData(preferredSourceLabel);
            if (!sourceOpt) return;

            const targetComponent = getComponentData(sourceOpt, electrolyte);
            if (!targetComponent || targetComponent.ratio <= 0) return;

            const absorptionRate = targetComponent.absorptionRate;
            if (absorptionRate <= 0 && targetRawNeed > 0.01) return;
            if (absorptionRate <= 0) return;

            const mgElectrolytePerMgSource = targetComponent.ratio;
            const effectiveMgAbsorbedPerMgSource = mgElectrolytePerMgSource * absorptionRate;

            let sourceAmountNeeded = targetRawNeed / effectiveMgAbsorbedPerMgSource;

            sourceAmountNeeded = Math.max(0, sourceAmountNeeded);

            if (sourceAmountNeeded > 0.01) {
                const alreadyAddedAmount = sourcesToAdd[preferredSourceLabel] || 0;
                const netAmountToAdd = Math.max(0, sourceAmountNeeded - alreadyAddedAmount);

                if (netAmountToAdd > 0.01) {
                    sourcesToAdd[preferredSourceLabel] = alreadyAddedAmount + netAmountToAdd;

                    sourceOpt.components.forEach(comp => {
                        const compName = comp.name as ElectrolyteType;
                        if (activeElectrolytes[compName]) {
                            const compRatio = comp.ratio;
                            const rawAmountProvided = netAmountToAdd * compRatio;
                            remainingRawNeedsPass1[compName] -= rawAmountProvided;
                        }
                    });
                }
            }
        });

        const remainingRawNeedsPass2 = { ...remainingRawNeedsPass1 };

        calculationOrder.forEach(electrolyte => {
            if (!activeElectrolytes[electrolyte] || remainingRawNeedsPass2[electrolyte] <= 0.01) {
                return;
            }

            const additionalRawNeed = remainingRawNeedsPass2[electrolyte];
            const preferredSourceLabel = preferredSources[electrolyte];
            if (!preferredSourceLabel) return;

            const sourceOpt = getSourceOptionData(preferredSourceLabel);
            if (!sourceOpt) return;

            const targetComponent = getComponentData(sourceOpt, electrolyte);
            if (!targetComponent || targetComponent.ratio <= 0) return;

            const absorptionRate = targetComponent.absorptionRate;
            if (absorptionRate <= 0) return;

            const mgElectrolytePerMgSource = targetComponent.ratio;
            const effectiveMgAbsorbedPerMgSource = mgElectrolytePerMgSource * absorptionRate;

            let additionalSourceAmount = additionalRawNeed / effectiveMgAbsorbedPerMgSource;

            let allowAddition = true;
            sourceOpt.components.forEach(comp => {
                const compName = comp.name as ElectrolyteType;
                if (compName !== electrolyte && activeElectrolytes[compName]) {
                    const compRatio = comp.ratio;
                    if (compRatio > 0) {
                        const currentSecondaryNeed = remainingRawNeedsPass2[compName];
                        if (currentSecondaryNeed < -1.0 && (additionalSourceAmount * compRatio > 0.01)) {
                            allowAddition = false;
                        }
                    }
                }
            });

            if (!allowAddition) {
                additionalSourceAmount = 0;
            }

            additionalSourceAmount = Math.max(0, additionalSourceAmount);

            if (additionalSourceAmount > 0.01) {
                sourcesToAdd[preferredSourceLabel] = (sourcesToAdd[preferredSourceLabel] || 0) + additionalSourceAmount;

                sourceOpt.components.forEach(comp => {
                    const compName = comp.name as ElectrolyteType;
                    if (activeElectrolytes[compName]) {
                        const compRatio = comp.ratio;
                        const rawAmountProvided = additionalSourceAmount * compRatio;
                        remainingRawNeedsPass2[compName] -= rawAmountProvided;
                    }
                });
            }
        });

        const newElectrolyteSources: ElectrolyteSource[] = Object.entries(sourcesToAdd)
            .filter(([_, amount]) => amount > 0.1)
            .map(([label, totalAmount]) => {
                const sourceOpt = getSourceOptionData(label)!;
                const calculatedComponents: ElectrolyteComponent[] = sourceOpt.components.map(comp => ({
                    name: comp.name,
                    ratio: comp.ratio,
                    absorptionRate: comp.absorptionRate,
                    amount: parseFloat((comp.ratio * totalAmount).toFixed(1))
                }));
                return {
                    source: label,
                    amount: parseFloat(totalAmount.toFixed(1)),
                    components: calculatedComponents
                };
            });

        setElectrolyteSources(newElectrolyteSources);

    }, [hours, activeElectrolytes, targetAmountsPerHour, setElectrolyteSources]);


    return {
        isSweatRate,
        setIsSweatRate,
        sweatRate,
        setSweatRate,
        saltiness,
        setSaltiness,
        activeElectrolytes,
        setActiveElectrolytes,
        electrolyteSources,
        setElectrolyteSources,
        manualTargets,
        handleManualTargetChange,
        targetAmountsPerHour,
        electrolyteAnalysis,
        calculateTotalContribution,
        handleElectrolyteSourceChange,
        handleElectrolyteAmountChange,
        addElectrolyteSource,
        removeElectrolyteSource,
        handleAutoCalculateElectrolytes,
    };
}
