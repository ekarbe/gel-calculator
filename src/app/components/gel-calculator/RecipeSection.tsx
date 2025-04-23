import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardCopy } from 'lucide-react';
import { cn } from "@/lib/utils";
import type { CalculatedCarbData, CarbTotals, ElectrolyteSource } from '@/types/gelCalculator';
import { formatRecipeForCopy } from '@/lib/recipeUtils';

interface RecipeSectionProps {
    hours: number;
    isBatchMode: boolean;
    setIsBatchMode: (value: boolean) => void;
    gelsPerHour: number;
    setGelsPerHour: (value: number) => void;
    setRecipeModalOpen: (open: boolean) => void;
    calculatedCarbData: CalculatedCarbData;
    carbTotals: CarbTotals;
    electrolyteSources: ElectrolyteSource[];
}

const RecipeSection: React.FC<RecipeSectionProps> = ({
    hours,
    isBatchMode,
    setIsBatchMode,
    gelsPerHour,
    setGelsPerHour,
    setRecipeModalOpen,
    calculatedCarbData,
    carbTotals,
    electrolyteSources,
}) => {
    const totalGels = gelsPerHour * hours;
    const divisor = isBatchMode ? 1 : (totalGels > 0 ? totalGels : 1);

    const [isCopied, setIsCopied] = useState(false);

    const handleCopyRecipe = useCallback(async () => {
        const recipeText = formatRecipeForCopy(
            calculatedCarbData,
            electrolyteSources,
            isBatchMode,
            hours,
            gelsPerHour
        );
        try {
            await navigator.clipboard.writeText(recipeText);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy recipe: ", err);
        }
    }, [calculatedCarbData, electrolyteSources, isBatchMode, hours, gelsPerHour]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="space-y-1">
                            <span className="text-lg font-semibold">Final Recipe</span>
                            <span className="block text-sm text-muted-foreground">
                                {isBatchMode
                                    ? `Total ingredients for ${hours} hour${hours !== 1 ? 's' : ''}`
                                    : `Ingredients per gel (${gelsPerHour} gels/h = ${totalGels} total)`
                                }
                            </span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                            <button
                                type="button"
                                onClick={handleCopyRecipe}
                                className={cn(
                                    "px-3 py-2 border rounded-md text-sm flex items-center gap-2 transition-colors",
                                    isCopied
                                        ? "bg-green-100 text-green-700 border-green-300"
                                        : "hover:bg-accent"
                                )}
                                disabled={isCopied}
                            >
                                <ClipboardCopy className="w-4 h-4" />
                                {isCopied ? 'Copied!' : 'Copy Recipe'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setRecipeModalOpen(true)}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm"
                            >
                                View Mixing Instructions
                            </button>
                            <Tabs
                                value={isBatchMode ? "batch" : "gel"}
                                onValueChange={(value) => setIsBatchMode(value === "batch")}
                                className="w-full sm:w-fit"
                            >
                                <TabsList className="grid grid-cols-2 w-full sm:w-auto">
                                    <TabsTrigger value="gel">Per Gel</TabsTrigger>
                                    <TabsTrigger value="batch">Full Batch</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </div>
                    {!isBatchMode && (
                        <div className="flex items-center gap-2 pt-2">
                            <span className="text-sm font-medium">Gels per hour:</span>
                            <input
                                type="number"
                                value={gelsPerHour}
                                onChange={(e) => setGelsPerHour(Math.max(1, Number(e.target.value)))}
                                className="input-number w-16"
                                min="1"
                            />
                            <span className="text-sm text-muted-foreground">({totalGels} total gels)</span>
                        </div>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {(Object.keys(calculatedCarbData.finalGrams).length > 0) && (
                        <div>
                            <h4 className="font-medium mb-2 text-base">Carbohydrates</h4>
                            {carbTotals.canAchieveRatio ? (
                                <div className="pl-4 space-y-1 text-sm">
                                    {Object.entries(calculatedCarbData.finalGrams)
                                        .filter(([key, grams]) => key !== 'totalGrams' && typeof grams === 'number' && grams > 0.01)
                                        .map(([sourceName, totalGrams]) => {
                                            const amount = totalGrams / divisor;
                                            return (
                                                <div key={sourceName} className="flex justify-between">
                                                    <span>{sourceName}:</span>
                                                    <span>{amount.toFixed(1)}g</span>
                                                </div>
                                            );
                                        })}
                                </div>
                            ) : (
                                <p className="text-sm text-red-600 pl-4">Recipe cannot be calculated accurately due to input issues (see warnings above).</p>
                            )}
                        </div>
                    )}

                    {electrolyteSources.filter(s => s.source && s.amount > 0).length > 0 && (
                        <div>
                            <h4 className="font-medium mb-2 text-base">Electrolytes</h4>
                            <div className="pl-4 space-y-1 text-sm">
                                {electrolyteSources
                                    .filter(source => source.source && source.amount > 0.01)
                                    .map((source, index) => {
                                        const amount = source.amount / divisor;
                                        const unit = "mg";
                                        return (
                                            <div key={`${source.source}-${index}`} className="flex justify-between">
                                                <span>{source.source}:</span>
                                                <span>{amount.toFixed(1)}{unit}</span>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                    {Object.values(calculatedCarbData.finalGrams).every(g => g <= 0.01) &&
                        electrolyteSources.filter(s => s.source && s.amount > 0.01).length === 0 && (
                            <p className="text-sm text-muted-foreground pl-4">No ingredients added or calculated yet.</p>
                        )}
                </div>
            </CardContent>
        </Card>
    );
};

export default RecipeSection;
