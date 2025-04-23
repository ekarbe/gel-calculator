import React from 'react';
import { Plus, Trash2, Zap } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ElectrolytesGrid from '@/components/ui/ElectrolyteGrid';

import type {
    ElectrolyteType,
    ElectrolyteSource,
    ElectrolyteAnalysisItem,
    ActiveElectrolytes,
    ManualElectrolyteTargets
} from '@/types/gelCalculator';
import {
    SWEAT_RATES,
    SWEAT_RATE_DESCRIPTIONS,
    SALTINESS_DESCRIPTIONS,
    electrolyteSourceOptions
} from '@/constants/gelCalculator';

interface ElectrolyteSectionProps {
    hours: number;
    isSweatRate: boolean;
    setIsSweatRate: (value: boolean) => void;
    sweatRate: number;
    setSweatRate: (value: number) => void;
    saltiness: number;
    setSaltiness: (value: number) => void;
    activeElectrolytes: ActiveElectrolytes;
    setActiveElectrolytes: React.Dispatch<React.SetStateAction<ActiveElectrolytes>>;
    electrolyteSources: ElectrolyteSource[];
    manualTargets: ManualElectrolyteTargets;
    targetAmountsPerHour: ManualElectrolyteTargets;
    electrolyteAnalysis: ElectrolyteAnalysisItem[];
    calculateTotalContribution: (electrolyte: string) => number;
    handleElectrolyteSourceChange: (value: string, index: number) => void;
    handleElectrolyteAmountChange: (value: number, index: number) => void;
    addElectrolyteSource: () => void;
    removeElectrolyteSource: (index: number) => void;
    handleManualTargetChange: (electrolyte: ElectrolyteType, value: number) => void;
    handleAutoCalculateElectrolytes: () => void;
}


const ElectrolyteSection: React.FC<ElectrolyteSectionProps> = ({
    hours,
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
}) => {
    const canAutoCalculate = hours > 0 && Object.values(activeElectrolytes).some(isActive => isActive);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex flex-col gap-4">
                    <span>Electrolytes (Total for {hours}h)</span>
                    <Tabs
                        value={isSweatRate ? "sweat-rate" : "manual"}
                        onValueChange={(value) => setIsSweatRate(value === "sweat-rate")}
                        className="w-full"
                    >
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="sweat-rate">Sweat Profile</TabsTrigger>
                            <TabsTrigger value="manual">Manual Target (mg/h)</TabsTrigger>
                        </TabsList>
                        <TabsContent value="sweat-rate" className="space-y-4 pt-4">
                            <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                    <span className="whitespace-nowrap sm:w-32 text-sm font-medium">Sweat Rate (L/h)</span>
                                    <Select
                                        value={sweatRate.toString()}
                                        onValueChange={(value) => setSweatRate(Number(value))}
                                    >
                                        <SelectTrigger className="w-full sm:flex-1">
                                            <SelectValue placeholder="Select rate">
                                                {(sweatRate >= 0 && sweatRate < SWEAT_RATES.length)
                                                    ? `${SWEAT_RATES[sweatRate].toFixed(2)} L/h`
                                                    : null}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SWEAT_RATES.map((rate, index) => (
                                                <SelectItem key={rate} value={index.toString()} className="py-2">
                                                    <div>{rate.toFixed(2)} L/h</div>
                                                    <div className="text-xs text-muted-foreground mt-1 whitespace-normal">
                                                        {SWEAT_RATE_DESCRIPTIONS[index]}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                    <span className="whitespace-nowrap sm:w-32 text-sm font-medium">Sweat Saltiness</span>
                                    <Select
                                        value={saltiness.toString()}
                                        onValueChange={(value) => setSaltiness(Number(value))}
                                    >
                                        <SelectTrigger className="w-full sm:flex-1">
                                            <SelectValue placeholder="Select level">
                                                {(saltiness >= 0 && saltiness < SALTINESS_DESCRIPTIONS.length)
                                                    ? `Level ${saltiness + 1}`
                                                    : null}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SALTINESS_DESCRIPTIONS.map((desc, index) => (
                                                <SelectItem key={index} value={index.toString()} className="py-2">
                                                    <div>Level {index + 1}</div>
                                                    <div className="text-xs text-muted-foreground mt-1 whitespace-normal">
                                                        {desc}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="manual" className="pt-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                                {(Object.keys(manualTargets) as ElectrolyteType[]).map((electrolyte) => (
                                    <div key={electrolyte} className="flex flex-col">
                                        <label htmlFor={`manual-${electrolyte}`} className={cn(
                                            "text-sm font-medium mb-1",
                                            !activeElectrolytes[electrolyte] && "text-muted-foreground"
                                        )}>
                                            {electrolyte} (mg/h)
                                        </label>
                                        <input
                                            id={`manual-${electrolyte}`}
                                            type="number"
                                            value={manualTargets[electrolyte]}
                                            onChange={(e) => handleManualTargetChange(electrolyte, Number(e.target.value))}
                                            className={cn(
                                                "input-number w-full",
                                                !activeElectrolytes[electrolyte] && "opacity-50 bg-muted cursor-not-allowed"
                                            )}
                                            min="0"
                                            step="1"
                                            disabled={!activeElectrolytes[electrolyte]}
                                        />
                                    </div>
                                ))}
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="mb-6">
                    <ElectrolytesGrid
                        targetAmounts={targetAmountsPerHour}
                        activeElectrolytes={activeElectrolytes}
                        setActiveElectrolytes={setActiveElectrolytes}
                        calculateTotalContribution={calculateTotalContribution}
                    />
                </div>

                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-base">Electrolyte Sources (Total Amount for {hours}h)</h4>
                    <button
                        type="button"
                        onClick={handleAutoCalculateElectrolytes}
                        disabled={!canAutoCalculate}
                        title={canAutoCalculate ? "Automatically add sources to meet targets" : "Set duration and select active electrolytes first"}
                        className={cn(
                            "px-3 py-1 text-sm border rounded flex items-center gap-2",
                            "hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                    >
                        <Zap className="w-4 h-4" />
                        Auto-Calculate
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th className="text-left py-2 pr-2 whitespace-nowrap">Source</th>
                                <th className="text-left py-2 px-2 whitespace-nowrap">Amount (mg)</th>
                                <th className="text-left py-2 px-2 whitespace-nowrap">Provides (mg)</th>
                                <th className="text-left py-2 pl-2 whitespace-nowrap">Absorption</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {electrolyteSources.map((source, index) => (
                                <tr key={`electrolyte-${index}-${source.source || index}`}>
                                    <td className="py-2 pr-2 align-top">
                                        <Select
                                            value={source.source}
                                            onValueChange={(value) => handleElectrolyteSourceChange(value, index)}
                                        >
                                            <SelectTrigger className="w-48">
                                                <SelectValue placeholder="Select source" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {electrolyteSourceOptions.map((option) => (
                                                    <SelectItem key={option.label} value={option.label}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="py-2 px-2 align-top">
                                        <input
                                            type="number"
                                            value={source.amount}
                                            onChange={(e) => handleElectrolyteAmountChange(Number(e.target.value), index)}
                                            className="input-number w-24"
                                            min="0"
                                            step="1"
                                            disabled={!source.source}
                                        />
                                    </td>
                                    <td className="py-2 px-2 align-top">
                                        <div className="text-xs space-y-1">
                                            {source.components.map((comp, i) => (
                                                <div key={i}>
                                                    {comp.name}: {comp.amount?.toFixed(1) ?? '0.0'}mg
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="py-2 pl-2 align-top">
                                        <div className="text-xs space-y-1">
                                            {source.components.map((comp, i) => (
                                                <div key={i}>
                                                    {comp.name}: {(comp.absorptionRate * 100).toFixed(0)}%
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="py-2 text-right align-top">
                                        <button
                                            type="button"
                                            onClick={() => removeElectrolyteSource(index)}
                                            className="btn-icon btn-danger"
                                            aria-label="Remove Electrolyte Source"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <button
                    type="button"
                    onClick={addElectrolyteSource}
                    className="mt-4 btn-icon border rounded hover:bg-accent"
                    aria-label="Add Electrolyte Source"
                >
                    <Plus className="w-4 h-4" />
                </button>

                <div className="mt-6 p-4 bg-muted/50 rounded border">
                    <h4 className="font-medium mb-3 text-base">Electrolyte Balance Analysis (Total for {hours}h)</h4>
                    <ul className="space-y-2">
                        {electrolyteAnalysis.map((analysis) => (
                            <li key={analysis.electrolyte} className="flex flex-col sm:flex-row sm:justify-between gap-1 border-b pb-1 last:border-b-0">
                                <span className="font-medium text-sm">{analysis.electrolyte}:</span>
                                <div className="flex flex-col sm:items-end">
                                    <span className="text-sm">
                                        Target: {analysis.target.toFixed(1)}mg, Absorbed: {analysis.absorbed.toFixed(1)}mg
                                    </span>
                                    <span className={cn(
                                        "text-xs",
                                        analysis.message.includes("Short by") ? 'text-red-600' :
                                            analysis.message.includes("Excess of") ? 'text-orange-600' :
                                                analysis.message.includes("Target met") ? 'text-green-600' :
                                                    'text-muted-foreground'
                                    )}>
                                        {analysis.message}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
};

export default ElectrolyteSection;
