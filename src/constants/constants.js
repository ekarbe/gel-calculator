export const glucoseSourceOptions = [
    { id: 1, label: 'Dextrose', carbsPerGram: 1.00, glucoseContent: 1.00, fructoseContent: 0 },
    { id: 2, label: 'Glucose Syrup', carbsPerGram: 0.80, glucoseContent: 1.00, fructoseContent: 0 },
    { id: 3, label: 'Maltodextrin', carbsPerGram: 0.98, glucoseContent: 1.00, fructoseContent: 0 },
    { id: 4, label: 'Maltose', carbsPerGram: 1.00, glucoseContent: 1.00, fructoseContent: 0 },
    { id: 5, label: 'Highly Branched Cyclic Dextrin (HBCD)', carbsPerGram: 1.00, glucoseContent: 1.00, fructoseContent: 0 },
    { id: 6, label: 'Rice Syrup', carbsPerGram: 0.85, glucoseContent: 1.00, fructoseContent: 0 },
    { id: 7, label: 'Barley Malt Extract', carbsPerGram: 0.80, glucoseContent: 0.95, fructoseContent: 0.05 },
];

export const fructoseSourceOptions = [
    { id: 11, label: 'Crystalline Fructose', carbsPerGram: 1.00, glucoseContent: 0, fructoseContent: 1.00 },
    { id: 12, label: 'High Fructose Corn Syrup', carbsPerGram: 0.76, glucoseContent: 0.45, fructoseContent: 0.55 },
    { id: 13, label: 'Agave Syrup', carbsPerGram: 0.76, glucoseContent: 0.18, fructoseContent: 0.82 },
    { id: 14, label: 'Honey', carbsPerGram: 0.82, glucoseContent: 0.38, fructoseContent: 0.47 },
    { id: 15, label: 'Date Syrup', carbsPerGram: 0.70, glucoseContent: 0.50, fructoseContent: 0.50 },
    { id: 16, label: 'Fruit Juice Concentrate', carbsPerGram: 0.80, glucoseContent: 0.50, fructoseContent: 0.50 },
    { id: 17, label: 'Maple Syrup', carbsPerGram: 0.67, glucoseContent: 0.50, fructoseContent: 0.50 },
    { id: 18, label: 'Sucrose (Cane Sugar)', carbsPerGram: 1.00, glucoseContent: 0.50, fructoseContent: 0.50 },
    { id: 19, label: "Coconut Sugar", carbsPerGram: 1.00, glucoseContent: 0.50, fructoseContent: 0.50 },
];

export const allCarbSourceOptions = [...glucoseSourceOptions, ...fructoseSourceOptions];
export const sourceDataMap = new Map(allCarbSourceOptions.map(opt => [opt.label, opt]));

export const electrolyteSourceOptions = [
    { id: 31, label: 'Sodium Chloride (Table Salt)', components: [{ name: 'Sodium', ratio: 0.393, absorptionRate: 0.975 }, { name: 'Chloride', ratio: 0.607, absorptionRate: 0.975 }] },
    { id: 32, label: 'Potassium Chloride', components: [{ name: 'Potassium', ratio: 0.524, absorptionRate: 0.85 }, { name: 'Chloride', ratio: 0.476, absorptionRate: 0.95 }] },
    { id: 33, label: 'Sodium Citrate', components: [{ name: 'Sodium', ratio: 0.267, absorptionRate: 0.90 }, { name: 'Citrate', ratio: 0.733, absorptionRate: 1.00 }] },
    { id: 34, label: 'Magnesium Citrate', components: [{ name: 'Magnesium', ratio: 0.161, absorptionRate: 0.40 }, { name: 'Citrate', ratio: 0.839, absorptionRate: 1.00 }] },
    { id: 35, label: 'Calcium Citrate', components: [{ name: 'Calcium', ratio: 0.241, absorptionRate: 0.30 }, { name: 'Citrate', ratio: 0.759, absorptionRate: 1.00 }] },
    { id: 36, label: 'Magnesium Chloride', components: [{ name: 'Magnesium', ratio: 0.256, absorptionRate: 0.40 }, { name: 'Chloride', ratio: 0.744, absorptionRate: 0.95 }] },
    { id: 37, label: 'Calcium Chloride', components: [{ name: 'Calcium', ratio: 0.363, absorptionRate: 0.30 }, { name: 'Chloride', ratio: 0.637, absorptionRate: 0.95 }] },
    { id: 38, label: 'Sodium Bicarbonate', components: [{ name: 'Sodium', ratio: 0.274, absorptionRate: 0.85 }, { name: 'Bicarbonate', ratio: 0.726, absorptionRate: 1.00 }] },
    { id: 39, label: 'Potassium Citrate', components: [{ name: 'Potassium', ratio: 0.381, absorptionRate: 0.80 }, { name: 'Citrate', ratio: 0.619, absorptionRate: 1.00 }] },
    { id: 40, label: 'Magnesium Sulfate (Epsom Salt)', components: [{ name: 'Magnesium', ratio: 0.202, absorptionRate: 0.25 }, { name: 'Sulfate', ratio: 0.798, absorptionRate: 0.35 }] }
];

export const allSourcesOptions = [...allCarbSourceOptions, ...electrolyteSourceOptions];
export const sourceDataByIdMap = new Map(allSourcesOptions.map(opt => [opt.id, opt]));

export const SWEAT_RATES = [0.25, 0.75, 1.25, 1.75, 2.25, 2.75];
export const ELECTROLYTE_CONCENTRATIONS = { Sodium: [10, 30, 50, 70, 90, 110], Chloride: [10, 30, 50, 70, 90, 110], Potassium: [1, 3, 5, 7, 9, 11], Magnesium: [0.1, 0.3, 0.5, 0.7, 0.9, 1.1], Calcium: [0.2, 0.6, 1.0, 1.4, 1.8, 2.2] }; // mmol/L
export const CONVERSION_FACTORS = { Sodium: 23, Chloride: 35.5, Potassium: 39.1, Magnesium: 24.3, Calcium: 40.1 };
export const SWEAT_RATE_DESCRIPTIONS = ["Light sweating: Skin feels slightly damp", "Moderate sweating: Noticeable moisture on skin, shirt may show small damp patches", "Active sweating: Clothing shows distinct wet patches, sweat begins to drip occasionally", "Heavy sweating: Clothing widely soaked, continuous dripping of sweat", "Very heavy sweating: Clothes completely saturated, sweat constantly dripping/running", "Extreme sweating: Excessive sweating with clothes completely drenched"];
export const SALTINESS_DESCRIPTIONS = ["Very low salt content: Sweat barely tastes salty, minimal salt marks on clothing", "Low salt content: Slight salty taste, faint white marks may appear on dark clothing", "Moderate salt content: Clearly salty taste, visible white marks on dried clothing", "High salt content: Strong salty taste, prominent white marks after drying", "Very high salt content: Very strong salty taste, thick white residue on clothing", "Extreme salt content: Extremely salty, heavy white crystallization on skin and clothing"];

export const initialActiveElectrolytes = { Sodium: true, Chloride: true, Potassium: true, Magnesium: true, Calcium: true };
export const initialManualTargets = { Sodium: 0, Chloride: 0, Potassium: 0, Magnesium: 0, Calcium: 0 };