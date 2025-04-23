import React from 'react';
import { cn } from "@/lib/utils";

type ElectrolyteType = 'Sodium' | 'Chloride' | 'Potassium' | 'Magnesium' | 'Calcium';

interface ElectrolytesGridProps {
  targetAmounts: Record<ElectrolyteType, number>;
  activeElectrolytes: Record<ElectrolyteType, boolean>;
  setActiveElectrolytes: React.Dispatch<React.SetStateAction<Record<ElectrolyteType, boolean>>>;
  calculateTotalContribution: (electrolyte: ElectrolyteType) => number;
}

const ElectrolytesGrid = ({
  targetAmounts,
  activeElectrolytes,
  setActiveElectrolytes,
  calculateTotalContribution
}: ElectrolytesGridProps) => {
  return (
    <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 w-full">
      {(Object.entries(targetAmounts) as [ElectrolyteType, number][]).map(([electrolyte, amount]) => {
        const isActive = activeElectrolytes[electrolyte];
        return (
          <div
            key={electrolyte}
            className={cn(
              "w-full p-4 border rounded transition-all duration-200 cursor-pointer text-sm sm:text-base",
              isActive ? "bg-card" : "bg-muted/50 opacity-50",
              "hover:ring-2 ring-primary/50"
            )}
            onClick={() => setActiveElectrolytes((prev: Record<ElectrolyteType, boolean>) => ({
              ...prev,
              [electrolyte]: !prev[electrolyte]
            }))}
          >
            <div className="font-medium text-card-foreground">{electrolyte}</div>
            {isActive && (
              <>
                <div className="text-sm text-card-foreground/80 mt-2">Target: {amount.toFixed(1)}mg</div>
                <div className="text-sm text-card-foreground/80">
                  Current: {calculateTotalContribution(electrolyte).toFixed(1)}mg
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ElectrolytesGrid;