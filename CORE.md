Gel Calculator: Systems & Logic Analysis
1. Data Structures & Schema
The domain is split into two primary areas: Carbohydrates and Electrolytes. Below are the TypeScript interfaces that define the application's underlying schema:

Carbohydrate Entities
// Core definition of a carbohydrate source in the database (constants)
interface CarbSourceOption {
    label: string;
    carbsPerGram: number;     // e.g., 0.98 for Maltodextrin, 1.00 for Dextrose
    glucoseContent: number;   // Percentage of glucose (e.g., 1.0 for Dextrose, 0.5 for Sucrose)
    fructoseContent: number;  // Percentage of fructose (e.g., 1.0 for Crystalline Fructose, 0.5 for Sucrose)
}

// User's active selection of a carbohydrate source
interface CarbSource {
    source: string;       /`/ Matches CarbSourceOption.label`
    carbsPerGram: number; /`/ Derived from CarbSourceOption`
    percentage: number;   /`/ User-defined allocation `(0-100)
}

/`/ The calculated output for the recipe`
interface CalculatedCarbData {
    finalGrams: {
        totalGrams: number;
        [sourceName: string]: number; /`/ e.g.`, "Maltodextrin": 60, "Fructose": 30
    };
    glucoseAccountedByMixed: number;  /`/ Total glucose provided by mixed sources `(`e.g`., Sucrose)
    fructoseAccountedByMixed: number; /`/ Total fructose provided by mixed sources`
}
Electrolyte Entities
type ElectrolyteType = 'Sodium' | 'Chloride' | 'Potassium' | 'Magnesium' | 'Calcium';

/`/ A single constituent part of an electrolyte salt`
interface ElectrolyteComponent {
    name: ElectrolyteType | string;
    ratio: number;          /`/ How much of the raw salt is this specific electrolyte`? (`e.g`., Sodium in NaCl is `0.393`)
    absorptionRate: number; /`/ Biological bioavailability `(`e.g`., Sodium in NaCl is `0.975`)
    amount?: number;        /`/ The calculated mass `(mg) of this component based on user input
}

/`/ Core definition of an electrolyte salt in the database`
interface ElectrolyteSourceOption {
    label: string; /`/ e.g.`, "Sodium Chloride (Table Salt)"
    components: Omit<ElectrolyteComponent, 'amount'>[];
}

/`/ User`'s active selection of an electrolyte salt
interface ElectrolyteSource {
    source: string; // Matches ElectrolyteSourceOption.label
    amount: number; // User-defined raw mass (mg) of the salt
    components: ElectrolyteComponent[]; // Recalculated component amounts based on the raw mass
}

// The calculated output/analysis for a specific electrolyte target
interface ElectrolyteAnalysisItem {
    electrolyte: ElectrolyteType;
    target: number;        // The calculated need in mg (absorbed)
    absorbed: number;      // How much the user's recipe currently provides (absorbed)
    percentage: number;    /`/ `(`absorbed / target`) * 100
    message: string;       /`/ UI feedback string `(`e.g`., "Short by 50mg...")
    hasAnySources: boolean; /`/ True if the user has added a source containing this electrolyte`
}
2. Core Calculations & Domain Logic
The application performs two highly distinct sets of calculations: one for complex carbohydrate balancing, and another for biological electrolyte absorption.

A. Carbohydrate Calculations
1. Target Calculation

Total Carbs Needed (g) = carbsPerHour * hours
The user sets a ratio (e.g., 100:80 for Glucose:Fructose).
Target Glucose (g) = (glucoseRatio / (glucoseRatio + fructoseRatio)) * Total Carbs Needed
Target Fructose (g) = (fructoseRatio / (glucoseRatio + fructoseRatio)) * Total Carbs Needed
2. The Balancing Algorithm (useCarbCalculation.ts) The application uses a specific sequence to calculate source weights to satisfy the ratio:

Process Mixed Sources First: It iterates through user-selected sources that contain both glucose and fructose (e.g., Sucrose, Agave). It calculates how many grams of these sources are needed based on their user-assigned percentage.
Target Carbs for Source = Overall Target (Glucose or Fructose) * (userPercentage / 100)
Raw Grams Needed = ``Target Carbs for Source / (sourceContentRatio * carbsPerGram)
Account for "Bleed": It sums up the glucose and fructose inherently provided by those mixed sources (glucoseAccountedByMixed, fructoseAccountedByMixed).
Process Pure Sources: It calculates the remaining pure glucose and pure fructose needed.
Remaining Pure Need = max(0, Target - AccountedByMixed)
It then iterates through the pure sources (e.g., Maltodextrin, Crystalline Fructose) and distributes the remaining need according to their relative user percentages.
Raw Grams Needed = Remaining Pure Need * relativePercentage / (contentRatio * carbsPerGram)
B. Electrolyte Calculations
1. Target Need Calculation (useElectrolyteCalculation.ts) Electrolyte targets are generated dynamically based on estimated sweat loss.

Constants:
SWEAT_RATES: [0.25,0.75,1.25,1.75,2.25,2.75] (Liters/hour based on a 0-5 index slider).
ELECTROLYTE_CONCENTRATIONS (mmol/L): e.g., Sodium [10, 30, 50, 70, 90, 110] based on a 0-5 "saltiness" index.
CONVERSION_FACTORS (mg/mmol): e.g., Sodium 23.
Formula: Target (mg/hr) = Sweat Rate (L/hr) * Concentration (mmol/L) * Conversion Factor (mg/mmol)
Total Target (mg) = Target (mg/hr) * hours
2. Absorption & Bioavailability The application strictly differentiates between Raw Mass and Absorbed Mass.

Absorbed Mass (mg) = Raw Mass of Salt (mg) * Component Ratio * Component Absorption Rate
Example: 1000mg of Table Salt (NaCl).
Sodium Ratio = 0.393, Absorption = 0.975.
Absorbed Sodium = 1000 *0.393*0.975`` = 383.17mg
3. Auto-Calculate Logic (The "Magic" Button) The app features an auto-solver that attempts to fulfill electrolyte needs using preferred sources:

Order of Operations: It solves in a strict sequence: Sodium -> Potassium -> Magnesium -> Calcium -> Chloride. (Chloride is last because it is usually overwhelmingly fulfilled by the Sodium salt).
Pass 1 (Primary Needs): It calculates the required raw mass of the preferred salt (e.g., Sodium Chloride for Sodium) to meet the absorbed target of the primary electrolyte. It then deducts the secondary electrolytes provided by that salt (e.g., Chloride) from the remaining targets.
Pass 2 (Deficit Filling): It does a second pass to top up any remaining deficits, strictly preventing the addition of a salt if it would push a secondary electrolyte into a massive excess (defined as <-1.0mg`` deficit).
3. State Management & Data Flow
User Inputs (State)
The application relies heavily on React component state, primarily lifted to the parent GelCalculator component:

Global Parameters: hours, carbsPerHour, isBatchMode (boolean), gelsPerHour.
Carb State: glucoseRatioSlider (number), fructoseRatioSlider (number), glucoseSources (array), fructoseSources (array).
Electrolyte State: isSweatRate (toggle for manual vs calculated), sweatRate (0-5 index), saltiness (0-5 index), activeElectrolytes (boolean map), manualTargets (map), electrolyteSources (array of manually added salts/amounts).
In-Memory Processing
Calculations are heavily memoized (useMemo) to prevent unnecessary recalculations.

calculatedSourceGrams: The core engine output for carbs (re-runs when ratios, sources, or global hours/targets change).
targetAmountsPerHour: The core engine output for electrolyte targets (re-runs when sweat/saltiness indices change).
electrolyteAnalysis: Re-evaluates whenever targets change OR the user manually adjusts the raw mg of an added salt.
Outputs generated
UI Feedback: Real-time warnings (e.g., "Percentages must sum to 100%", "Short by X mg").
Recipe Generation: formatRecipeForCopy and formatInstructionsForCopy (in recipeUtils.ts) take the finalized state and generate plain-text Markdown/lists for the user to copy. The math is simply divided by (gelsPerHour * hours) if the user toggles out of "Batch Mode".
4. Edge Cases & Hidden Logic
When rewriting, pay special attention to these constraints currently built into the hooks:

Percentage Validation Lock: The carbohydrate calculator immediately halts (finalGrams: 0) if the sum of the percentage properties in either the glucoseSources or fructoseSources array does not equal exactly 100 (with a 0.01 floating-point tolerance).
Unachievable Ratio Warning: If a user requests a 1:0.8 ratio, but selects ONLY "Sucrose" (which is fixed at 1:1), the math cannot solve the equation. The app detects this by checking if the calculated totalActualCarbs deviates from totalCarbsNeeded by more than a dynamic tolerance (max(0.5, totalCarbsNeeded *0.01)). If it fails, it flags canAchieveRatio = false and specifically prompts the user to "Consider adding a pure glucose/fructose source."
Infinite Ratios: The app safely handles divide-by-zero scenarios when displaying actual ratios in the UI. If fructose is 0, the ratio display string defaults to "Inf".
Electrolyte Tolerance: A floating-point tolerance of 1.0mg is used universally in the electrolyte analysis. If the user is within 1.0mg of the target, the UI treats it as "Target met" to prevent frustrating micro-adjustments by the user.
Weighted Absorption Rates: If a user adds two different sources of Magnesium (e.g., Citrate at 40% absorption, Sulfate at 25% absorption), the app calculates a WeightedAbsorptionRate. It uses this weighted average to tell the user exactly how many raw milligrams of mixed powder they need to add to cover the remaining deficit.