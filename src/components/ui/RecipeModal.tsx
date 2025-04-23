import React, { useState, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Beaker, Package, Droplet, CircleDashed, PackagePlus, Waves, ThermometerSnowflake, ClipboardCopy } from 'lucide-react';
import { cn } from "@/lib/utils";
import type { CalculatedCarbData, ElectrolyteSource } from '@/types/gelCalculator';
import { sourceDataMap } from '@/constants/gelCalculator';
import { formatRecipeForCopy, formatInstructionsForCopy } from '@/lib/recipeUtils';

interface RecipeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isBatchMode: boolean;
  gelsPerHour: number;
  hours: number;
  calculatedCarbData: CalculatedCarbData;
  electrolyteSources: ElectrolyteSource[];
}

const IngredientItem = ({ name, amount, unit }: { name: string; amount: number; unit: string }) => (
  <li className="text-sm">
    <span className="font-medium">{name}:</span> {amount.toFixed(1)}{unit}
  </li>
);

const RecipeStep = ({ number, title, children, Icon }: {
  number: number;
  title: string;
  children: React.ReactNode;
  Icon: React.ElementType;
}) => (
  <div className="flex gap-4 items-start mb-6">
    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
      <Icon className="w-6 h-6" />
    </div>
    <div className="flex-1">
      <h3 className="font-medium mb-2">{number}. {title}</h3>
      <div className="text-muted-foreground space-y-2">{children}</div>
    </div>
  </div>
);


const RecipeModal = ({
  open,
  onOpenChange,
  isBatchMode,
  gelsPerHour,
  hours,
  calculatedCarbData,
  electrolyteSources
}: RecipeModalProps) => {

  const carbIngredients = Object.entries(calculatedCarbData.finalGrams)
    .filter(([key, value]) => key !== 'totalGrams' && typeof value === 'number' && value > 0.01)
    .map(([name, grams]) => ({ name, amount: grams, unit: 'g' }));

  const electrolyteIngredients = electrolyteSources
    .filter(source => source.amount > 0.01)
    .map(source => ({ name: source.source, amount: source.amount, unit: 'mg' }));

  const glucoseBasedCarbs = carbIngredients.filter(item => {
    const data = sourceDataMap.get(item.name);
    return data && data.glucoseContent > 0;
  });

  const fructoseBasedCarbs = carbIngredients.filter(item => {
    const data = sourceDataMap.get(item.name);
    return data && data.fructoseContent > 0 && data.glucoseContent === 0;
  });

  const totalGels = gelsPerHour * hours;
  const totalCarbs = calculatedCarbData.finalGrams.totalGrams;

  const [isCopied, setIsCopied] = useState(false);

  const handleCopyRecipe = useCallback(async () => {
    const instructionsText = formatInstructionsForCopy(
      carbIngredients,
      electrolyteIngredients,
      glucoseBasedCarbs,
      fructoseBasedCarbs,
      totalCarbs,
      isBatchMode,
      hours,
      gelsPerHour
    );
    try {
      await navigator.clipboard.writeText(instructionsText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy instructions: ", err);
    }
  }, [
    carbIngredients,
    electrolyteIngredients,
    glucoseBasedCarbs,
    fructoseBasedCarbs,
    totalCarbs,
    isBatchMode,
    hours,
    gelsPerHour
  ]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-40" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 max-h-[85vh] w-[90vw] max-w-[700px] translate-x-[-50%] translate-y-[-50%] rounded-lg border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <div className="overflow-y-auto max-h-[calc(85vh-8rem)] pr-3">
            <div className="flex justify-between items-start mb-4">
              <Dialog.Title className="text-xl sm:text-2xl font-semibold">
                DIY Gel/Drink Mix Recipe
              </Dialog.Title>
              <button
                type="button"
                onClick={handleCopyRecipe}
                className={cn(
                  "px-3 py-1.5 border rounded-md text-sm flex items-center gap-2 transition-colors flex-shrink-0",
                  isCopied
                    ? "bg-green-100 text-green-700 border-green-300"
                    : "hover:bg-accent"
                )}
                disabled={isCopied}
                title="Copy mixing instructions"
              >
                <ClipboardCopy className="w-4 h-4" />
                {isCopied ? 'Copied!' : 'Copy Instructions'}
              </button>
            </div>

            <Dialog.Description asChild>
              <div className="space-y-1 mb-6 text-sm text-muted-foreground">
                <div>Recipe makes: {isBatchMode
                  ? `One batch for ${hours} hour${hours !== 1 ? 's' : ''}`
                  : `${totalGels} individual gel sachet${totalGels !== 1 ? 's' : ''} (${hours} hour${hours !== 1 ? 's' : ''})`
                }</div>
                <div>Total Carbs: {totalCarbs.toFixed(1)}g</div>
              </div>
            </Dialog.Description>


            <div className="space-y-6">
              <RecipeStep number={1} title="Gather Ingredients" Icon={Package}>
                <p>Collect all your measured ingredients. Ensure you have:</p>
                {carbIngredients.length > 0 && (
                  <>
                    <p className="font-medium text-foreground mt-2">Carbohydrates:</p>
                    <ul className="list-disc list-inside pl-2">
                      {carbIngredients.map(item => <IngredientItem key={item.name} {...item} />)}
                    </ul>
                  </>
                )}
                {electrolyteIngredients.length > 0 && (
                  <>
                    <p className="font-medium text-foreground mt-2">Electrolytes:</p>
                    <ul className="list-disc list-inside pl-2">
                      {electrolyteIngredients.map(item => <IngredientItem key={item.name} {...item} />)}
                    </ul>
                  </>
                )}
                {(carbIngredients.length === 0 && electrolyteIngredients.length === 0) && (
                  <p>No ingredients calculated yet.</p>
                )}
                <p className="mt-2">Also prepare water (amount depends on desired consistency).</p>
              </RecipeStep>

              <RecipeStep number={2} title="Prepare Container" Icon={Beaker}>
                <p>Use a clean bottle or container with a secure lid, large enough for all ingredients and mixing water. A shaker bottle works well.</p>
                <p>Ensure it's completely dry before starting.</p>
              </RecipeStep>

              <RecipeStep number={3} title="Add Glucose Sources" Icon={PackagePlus}>
                <p>Add the following glucose-based carbohydrates to the empty container:</p>
                {glucoseBasedCarbs.length > 0 ? (
                  <ul className="list-disc list-inside pl-2">
                    {glucoseBasedCarbs.map(item => <IngredientItem key={item.name} {...item} />)}
                  </ul>
                ) : (
                  <p>No glucose-based sources selected or calculated.</p>
                )}
              </RecipeStep>

              <RecipeStep number={4} title="Initial Mixing (Gel Base)" Icon={Droplet}>
                <p>Add a small amount of WARM (not hot) water - just enough to wet the powders.</p>
                <p>Seal the container and shake thoroughly until the mixture forms a thick, smooth gel-like paste. Break up any clumps.</p>
              </RecipeStep>

              <RecipeStep number={5} title="Add Remaining Ingredients" Icon={PackagePlus}>
                <p>Add the following ingredients to the gel base:</p>
                {fructoseBasedCarbs.length > 0 && (
                  <>
                    <p className="font-medium text-foreground mt-2">Fructose Sources:</p>
                    <ul className="list-disc list-inside pl-2">
                      {fructoseBasedCarbs.map(item => <IngredientItem key={item.name} {...item} />)}
                    </ul>
                  </>
                )}
                {electrolyteIngredients.length > 0 && (
                  <>
                    <p className="font-medium text-foreground mt-2">Electrolytes:</p>
                    <ul className="list-disc list-inside pl-2">
                      {electrolyteIngredients.map(item => <IngredientItem key={item.name} {...item} />)}
                    </ul>
                  </>
                )}
                {(fructoseBasedCarbs.length === 0 && electrolyteIngredients.length === 0) && (
                  <p>No remaining fructose or electrolyte sources to add.</p>
                )}
              </RecipeStep>

              <RecipeStep number={6} title="Final Mixing & Consistency" Icon={Waves}>
                <p>Gradually add more water (cold or room temp) while shaking until you reach your desired consistency.</p>
                <ul className="list-disc list-inside pl-2 text-sm">
                  <li>For thick gels: Use minimal water.</li>
                  <li>For drink mix: Add more water (e.g., 500-750ml per hour of fuel).</li>
                </ul>
                <p>Shake vigorously until everything is fully dissolved and homogenous.</p>
              </RecipeStep>

              {!isBatchMode && (
                <RecipeStep number={7} title="Fill Gel Sachets" Icon={CircleDashed}>
                  <p>Carefully transfer the mixture into individual reusable gel flasks or disposable sachets.</p>
                  <p>Leave a small air gap and seal them properly.</p>
                </RecipeStep>
              )}

              <RecipeStep number={isBatchMode ? 7 : 8} title="Storage" Icon={ThermometerSnowflake}>
                <p>Store the mixture in the refrigerator.</p>
                <p>Consume within 3-5 days for best results. The mixture may thicken when cold.</p>
                <p>Shake well before use.</p>
              </RecipeStep>
            </div>
          </div>

          <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default RecipeModal;
