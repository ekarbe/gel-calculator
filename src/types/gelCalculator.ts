export type ElectrolyteType = 'Sodium' | 'Chloride' | 'Potassium' | 'Magnesium' | 'Calcium';

export interface CarbSourceOption {
    label: string;
    carbsPerGram: number;
    glucoseContent: number;
    fructoseContent: number;
}

export interface CarbSource {
    source: string;
    carbsPerGram: number;
    percentage: number;
}

export interface SourceGrams {
    totalGrams: number;
    [key: string]: number;
}

export interface CalculatedCarbData {
    finalGrams: SourceGrams;
    glucoseAccountedByMixed: number;
    fructoseAccountedByMixed: number;
}

export interface CarbTotals {
    targetGlucoseCarbs: number;
    targetFructoseCarbs: number;
    actualGlucoseCarbs: number;
    actualFructoseCarbs: number;
    canAchieveRatio: boolean;
    message: string;
}

export interface ElectrolyteComponent {
    name: ElectrolyteType | string;
    ratio: number;
    absorptionRate: number;
    amount?: number;
}

export interface ElectrolyteSourceOption {
    label: string;
    components: Omit<ElectrolyteComponent, 'amount'>[];
}

export interface ElectrolyteSource {
    source: string;
    amount: number;
    components: ElectrolyteComponent[];
}

export interface ElectrolyteAnalysisItem {
    electrolyte: ElectrolyteType;
    target: number;
    absorbed: number;
    percentage: number;
    message: string;
    hasAnySources: boolean;
}

export type ActiveElectrolytes = Record<ElectrolyteType, boolean>;
export type ManualElectrolyteTargets = Record<ElectrolyteType, number>; 
