import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { CarbSource, CarbSourceOption } from '@/types/gelCalculator';
import { sourceDataMap } from '@/constants/gelCalculator';

interface CarbSourceSectionProps {
    title: string;
    pathwayName: string;
    ratioSliderValue: number;
    onRatioSliderChange: (value: number) => void;
    targetCarbs: number;
    actualCarbs: number;
    canAchieveRatio: boolean;
    detailedMessage?: string;
    sources: CarbSource[];
    sourceOptions: CarbSourceOption[];
    onSourceChange: (value: string, index: number) => void;
    onPercentageChange: (value: number, index: number) => void;
    onRemoveSource: (index: number) => void;
    onAddSource: () => void;
    getSourceGrams: (sourceName: string) => number;
    isPercentageValid: boolean;
}

const CarbSourceSection: React.FC<CarbSourceSectionProps> = ({
    title,
    pathwayName,
    ratioSliderValue,
    onRatioSliderChange,
    targetCarbs,
    actualCarbs,
    canAchieveRatio,
    detailedMessage,
    sources,
    sourceOptions,
    onSourceChange,
    onPercentageChange,
    onRemoveSource,
    onAddSource,
    getSourceGrams,
    isPercentageValid,
}) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span>{title} ({pathwayName})</span>
                        <span className="text-sm text-muted-foreground">
                            {ratioSliderValue} part(s)
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm min-w-[2rem]">{ratioSliderValue}</span>
                        <Slider
                            value={[ratioSliderValue]}
                            min={0}
                            max={100}
                            step={1}
                            className="w-32 sm:w-48"
                            onValueChange={(value) => onRatioSliderChange(value[0])}
                        />
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="mb-2 text-sm">Target {title} Carbs: {targetCarbs.toFixed(1)}g</div>
                {!canAchieveRatio && (
                    <div className="mb-1 text-sm text-red-600">
                        Actual {title} Carbs: {actualCarbs.toFixed(1)}g
                    </div>
                )}
                {!canAchieveRatio && detailedMessage && (
                     <div className="mb-4 text-xs text-red-600">
                        {detailedMessage}
                    </div>
                )}
                 {!isPercentageValid && sources.length > 0 && (
                     <div className="mb-4 text-xs text-red-600">
                        Source percentages must sum to 100%.
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th className="text-left py-2 pr-2 whitespace-nowrap">Source</th>
                                <th className="text-left py-2 px-2 whitespace-nowrap">Carbs/g</th>
                                <th className="text-left py-2 px-2 whitespace-nowrap">Glucose (g)</th>
                                <th className="text-left py-2 px-2 whitespace-nowrap">Fructose (g)</th>
                                <th className="text-left py-2 px-2 whitespace-nowrap">%</th>
                                <th className="text-left py-2 pl-2 whitespace-nowrap">Grams (Total)</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {sources.map((source, index) => {
                                const sourceData = source.source ? sourceDataMap.get(source.source) : null;
                                const totalGramsForSource = getSourceGrams(source.source);
                                const glucoseGrams = sourceData && totalGramsForSource > 0
                                    ? totalGramsForSource * sourceData.glucoseContent * sourceData.carbsPerGram
                                    : 0;
                                const fructoseGrams = sourceData && totalGramsForSource > 0
                                    ? totalGramsForSource * sourceData.fructoseContent * sourceData.carbsPerGram
                                    : 0;

                                return (
                                    <tr key={`${pathwayName}-${index}-${source.source || index}`}>
                                        <td className="py-2 pr-2">
                                            <Select
                                                value={source.source}
                                                onValueChange={(value) => onSourceChange(value, index)}
                                            >
                                                <SelectTrigger className="w-40">
                                                    <SelectValue placeholder="Select source" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {sourceOptions.map((option) => {
                                                        const isSelected = sources.some(
                                                            (s, i) => s.source === option.label && i !== index
                                                        );
                                                        return (
                                                            <SelectItem
                                                                key={option.label}
                                                                value={option.label}
                                                                disabled={isSelected}
                                                                className={cn(isSelected && "opacity-50")}
                                                            >
                                                                {option.label}
                                                            </SelectItem>
                                                        );
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        <td className="py-2 px-2 text-sm">{sourceData?.carbsPerGram?.toFixed(2) ?? 'N/A'}</td>
                                        <td className="py-2 px-2 text-sm">
                                            {glucoseGrams.toFixed(1)}
                                        </td>
                                        <td className="py-2 px-2 text-sm">
                                            {fructoseGrams.toFixed(1)}
                                        </td>
                                        <td className="py-2 px-2">
                                            <input
                                                type="number"
                                                value={source.percentage}
                                                onChange={(e) => onPercentageChange(Number(e.target.value), index)}
                                                className={cn(
                                                    "input-number w-20",
                                                    !isPercentageValid && sources.length > 0 && 'border-red-500'
                                                )}
                                                min="0"
                                                max="100"
                                                step="0.1"
                                                disabled={!source.source}
                                            />
                                        </td>
                                        <td className="py-2 pl-2 font-medium">
                                            {totalGramsForSource.toFixed(1)}
                                        </td>
                                        <td className="py-2 text-right">
                                            <button
                                                onClick={() => onRemoveSource(index)}
                                                className="btn-icon btn-danger"
                                                aria-label={`Remove ${title} Source`}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <button
                    onClick={onAddSource}
                    className="mt-4 btn-icon border rounded hover:bg-accent"
                    aria-label={`Add ${title} Source`}
                >
                    <Plus className="w-4 h-4" />
                </button>
            </CardContent>
        </Card>
    );
};

export default CarbSourceSection;
