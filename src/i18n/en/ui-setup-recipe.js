/*  Gel-Calculator - Personalized fuel calculator for endurance athletes.
    Copyright (C) 2026  Eike Christian Karbe

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>. */


/**
 * English UI text for the Ingredients, Salts and Format sections.
 * Owned by the setup-recipe area (`src/components/setup/IngredientsSection.jsx`,
 * `SaltsSection.jsx`, `FormatSection.jsx` and their parts `Ingredients*`,
 * `Salts*`, `Format*`). Keys start with `ui-setup-recipe.`; placeholders
 * follow `src/i18n/index.js`: ratios are `{x:ratio}` (locale decimals),
 * shares `{x:percent}`, bottle sizes `{x:volume}` (ml or fl oz) or a size
 * the section formats itself (`{bottle}` in the summary). Nutrient
 * amounts stay in g and mg in every unit system; `{amount}` and `{mg}`
 * placeholders get a number already formatted for the locale.
 * Ingredient and salt names are the plain source labels (or the names
 * people typed), as everywhere else in the app.
 * @type {Record<string, string>}
 */
const uiSetupRecipe = {
  // Section titles
  'ui-setup-recipe.ingredients.title': 'Ingredients',
  'ui-setup-recipe.salts.title': 'Salts',
  'ui-setup-recipe.format.title': 'Format',

  // Unit suffixes of number fields
  'ui-setup-recipe.unit.g': 'g',
  'ui-setup-recipe.unit.percent': '%',

  // Ingredients: one-line summary of a collapsed section ({names} a list of the names; {ratio} the
  // glucose:fructose ratio the recipe makes)
  'ui-setup-recipe.ingredients.summary': '{names} · recipe {ratio:ratio}',
  'ui-setup-recipe.ingredients.summaryEmpty': 'No ingredients',
  'ui-setup-recipe.ingredients.intro':
    'Weights say how much of each you prefer. The mix stays as close to them as the ratio allows.',
  // The ingredient list
  'ui-setup-recipe.ingredients.listLabel': 'Ingredient list',
  'ui-setup-recipe.ingredients.empty': 'No ingredients yet. Add one below.',
  'ui-setup-recipe.ingredients.kind.powder': 'Powder',
  'ui-setup-recipe.ingredients.kind.syrup': 'Syrup',
  'ui-setup-recipe.ingredients.kind.custom': 'Yours',
  // {carbs} g carbs per 100 g of the ingredient; {glucose} and {fructose} split those carbs
  'ui-setup-recipe.ingredients.facts':
    '{carbs} g carbs per 100 g · glucose {glucose:percent} · fructose {fructose:percent}',
  // What the recipe uses of an ingredient ({amount} "158 g"; {share} its part of the recipe's carbs)
  'ui-setup-recipe.ingredients.usage.used': 'In the recipe: {amount}, {share:percent} of the carbs.',
  'ui-setup-recipe.ingredients.usage.noCarbs': 'Has no carbs, so the recipe leaves it out.',
  'ui-setup-recipe.ingredients.usage.duplicate': 'Listed above too. The two weights add up.',
  'ui-setup-recipe.ingredients.usage.notNeeded': 'Not used. The mix reaches the ratio without it.',
  'ui-setup-recipe.ingredients.usage.noPlanCarbs': 'Not used. The plan has no carbs to split.',
  'ui-setup-recipe.ingredients.remove': 'Remove {name}',
  // Preference weight 0–100: the visible label, and the full names of the number field and slider
  'ui-setup-recipe.ingredients.weight': 'Weight',
  'ui-setup-recipe.ingredients.weightOf': 'Weight of {name}',
  'ui-setup-recipe.ingredients.weightSlider': 'Weight of {name} (slider)',
  // The add menu
  'ui-setup-recipe.ingredients.add.label': 'Add an ingredient',
  'ui-setup-recipe.ingredients.add.button': 'Add',
  'ui-setup-recipe.ingredients.add.powders': 'Powders',
  'ui-setup-recipe.ingredients.add.syrups': 'Syrups',
  'ui-setup-recipe.ingredients.add.custom': 'Your ingredients',
  'ui-setup-recipe.ingredients.add.allListed': 'Every ingredient is in the list.',

  // The bar of ratios the ingredients can make (1:0 glucose only … 0:1 fructose only)
  'ui-setup-recipe.reach.title': 'Ratios your ingredients can make',
  'ui-setup-recipe.reach.reachable': 'Reachable',
  'ui-setup-recipe.reach.allowed': 'Allowed',
  'ui-setup-recipe.reach.target': 'Target',
  'ui-setup-recipe.reach.recipe': 'Your recipe',
  'ui-setup-recipe.reach.range': '{lo:ratio}–{hi:ratio}',
  'ui-setup-recipe.reach.only': '{ratio:ratio} only',
  'ui-setup-recipe.reach.none': 'None',
  'ui-setup-recipe.reach.noCarbs': 'No carbs yet',
  // Auto ratio: the solver used another ratio inside the allowed range ({gPerHour} the carb target)
  'ui-setup-recipe.reach.substituted':
    'Your ingredients cannot make {target:ratio}. The recipe uses {recipe:ratio}, which is still in the allowed range at {gPerHour} g/h.',

  // Your own ingredients, typed in from a label
  'ui-setup-recipe.custom.title': 'Your ingredients',
  'ui-setup-recipe.custom.intro': 'Type in a gel, drink mix or syrup from its label.',
  'ui-setup-recipe.custom.listLabel': 'Your ingredients',
  'ui-setup-recipe.custom.new': 'New ingredient',
  'ui-setup-recipe.custom.full':
    'You have {max} of your own ingredients, the most the app keeps. Delete one to add another.',
  // Name of a custom ingredient without a name (only a share link can give one)
  'ui-setup-recipe.custom.facts': '{carbs} g carbs per 100 g · fructose {fructose:percent} of the carbs',
  'ui-setup-recipe.custom.factsWater':
    '{carbs} g carbs per 100 g · fructose {fructose:percent} of the carbs · water {water} g per 100 g',
  'ui-setup-recipe.custom.edit': 'Edit {name}',
  'ui-setup-recipe.custom.delete': 'Delete {name}',
  'ui-setup-recipe.custom.deleteQuestion': 'Delete {name}? It leaves the ingredient list too.',
  'ui-setup-recipe.custom.confirmDelete': 'Yes, delete',
  'ui-setup-recipe.custom.keep': 'Keep',
  // The add/edit form
  'ui-setup-recipe.custom.form.newTitle': 'New ingredient',
  'ui-setup-recipe.custom.form.editTitle': 'Edit {name}',
  'ui-setup-recipe.custom.form.name': 'Name',
  'ui-setup-recipe.custom.form.carbs': 'Carbs per 100 g',
  'ui-setup-recipe.custom.form.carbsHint': 'Total carbohydrate from the label.',
  'ui-setup-recipe.custom.form.fructose': 'Fructose share of the carbs',
  'ui-setup-recipe.custom.form.fructoseHint': 'Fructose plus half the sucrose. Maltodextrin: 0%. Honey: about 50%.',
  'ui-setup-recipe.custom.form.water': 'Water per 100 g (optional)',
  'ui-setup-recipe.custom.form.waterHint': 'Leave empty to count the rest of the mass as water.',
  'ui-setup-recipe.custom.form.save': 'Save ingredient',
  'ui-setup-recipe.custom.form.cancel': 'Cancel',
  'ui-setup-recipe.custom.error.name': 'Enter a name.',
  'ui-setup-recipe.custom.error.carbs': 'Enter more than 0 and at most 100 g.',
  'ui-setup-recipe.custom.error.fructose': 'Enter 0 to 100%.',
  'ui-setup-recipe.custom.error.water': 'Enter 0 to 100 g, or leave it empty.',
  'ui-setup-recipe.custom.error.waterSum': 'Carbs and water add up to more than 100 g.',

  // Salts: Auto follows the sodium (and extras) targets, Manual lists the salts and amounts
  'ui-setup-recipe.salts.mode.label': 'Salt mode',
  'ui-setup-recipe.salts.mode.auto': 'Auto',
  'ui-setup-recipe.salts.mode.manual': 'Manual',
  // One-line summary of a collapsed section ({salt} the sodium salt; {salts} a list of names)
  'ui-setup-recipe.salts.summary.auto': 'Auto · {salt}',
  'ui-setup-recipe.salts.summary.manual': 'Manual · {salts}',
  'ui-setup-recipe.salts.summary.manualEmpty': 'Manual · no salts',
  // Auto mode
  'ui-setup-recipe.salts.sodiumSalt.label': 'Sodium salt',
  'ui-setup-recipe.salts.sodiumSalt.table': 'Table salt',
  'ui-setup-recipe.salts.sodiumSalt.citrate': 'Sodium citrate',
  'ui-setup-recipe.salts.sodiumSalt.mix': '50:50 mix',
  'ui-setup-recipe.salts.sodiumSalt.hint': 'Potassium, magnesium and calcium come from their citrates.',
  'ui-setup-recipe.salts.auto.listLabel': 'Salt amounts for the whole activity',
  'ui-setup-recipe.salts.auto.none': 'No salts needed for this plan.',
  'ui-setup-recipe.salts.auto.note': 'Amounts are for the whole activity.',
  // Manual mode
  'ui-setup-recipe.salts.manual.hint': 'Enter grams for the whole activity.',
  'ui-setup-recipe.salts.manual.listLabel': 'Your salt amounts',
  'ui-setup-recipe.salts.manual.empty': 'No salts added.',
  'ui-setup-recipe.salts.manual.add': 'Add salt',
  'ui-setup-recipe.salts.manual.salt': 'Salt {number}',
  'ui-setup-recipe.salts.manual.builtIn': 'Salts',
  'ui-setup-recipe.salts.manual.custom': 'Your salts',
  'ui-setup-recipe.salts.manual.amount': 'Amount',
  'ui-setup-recipe.salts.manual.amountOf': 'Amount of {name} for the whole activity',
  'ui-setup-recipe.salts.manual.remove': 'Remove {name}',
  // What a salt holds: "Contains 39.3% sodium, 60.7% chloride" ({parts} a list of salts.part)
  'ui-setup-recipe.salts.contains': 'Contains {parts}',
  'ui-setup-recipe.salts.part': '{pct:percent} {ion}',
  'ui-setup-recipe.salts.noValues': 'No values entered yet.',
  // Name of a custom salt without a name, and of a salt the app does not know
  'ui-setup-recipe.salts.unknownName': 'Salt {ref}',
  // Salts typed in from a label (Manual mode)
  'ui-setup-recipe.salts.custom.title': 'Salts from a label',
  'ui-setup-recipe.salts.custom.intro':
    "For a product that is not in the list, enter each element from its label as a % of the product's mass. For example, 39 g of sodium per 100 g is 39%.",
  'ui-setup-recipe.salts.custom.listLabel': 'Salts from a label',
  'ui-setup-recipe.salts.custom.name': 'Salt name',
  'ui-setup-recipe.salts.custom.delete': 'Delete {name} from your salts',
  // Label fields: the element name (an uppercase caption) and its chemical symbol after it, which
  // keeps its case ("SODIUM (Na)"); the field is named "Sodium (Na)"
  'ui-setup-recipe.salts.custom.sodiumPct': 'Sodium',
  'ui-setup-recipe.salts.custom.potassiumPct': 'Potassium',
  'ui-setup-recipe.salts.custom.magnesiumPct': 'Magnesium',
  'ui-setup-recipe.salts.custom.calciumPct': 'Calcium',
  'ui-setup-recipe.salts.custom.chloridePct': 'Chloride',
  'ui-setup-recipe.salts.custom.symbol.sodiumPct': '(Na)',
  'ui-setup-recipe.salts.custom.symbol.potassiumPct': '(K)',
  'ui-setup-recipe.salts.custom.symbol.magnesiumPct': '(Mg)',
  'ui-setup-recipe.salts.custom.symbol.calciumPct': '(Ca)',
  'ui-setup-recipe.salts.custom.symbol.chloridePct': '(Cl)',
  'ui-setup-recipe.salts.custom.overTotal':
    'These values add up to {total:percent}, more than the whole salt. Check the label.',
  'ui-setup-recipe.salts.custom.empty': 'Enter at least one value from the label.',
  'ui-setup-recipe.salts.custom.add': 'Add a salt from a label',
  'ui-setup-recipe.salts.custom.full': 'You have {max} salts from a label, the most the app keeps.',
  // Delivered vs target table ({mg} a locale number of mg). The status sits under the delivered
  // amount; a no-break space (\u00a0) keeps "{mg} mg" together when it wraps on a phone
  'ui-setup-recipe.salts.compare.caption': 'Delivered vs target (whole activity)',
  'ui-setup-recipe.salts.compare.ion': 'Ion',
  'ui-setup-recipe.salts.compare.target': 'Target',
  'ui-setup-recipe.salts.compare.delivered': 'Delivered',
  'ui-setup-recipe.salts.compare.mg': '{mg} mg',
  'ui-setup-recipe.salts.compare.met': 'On target',
  'ui-setup-recipe.salts.compare.short': 'Short by {mg}\u00a0mg',
  'ui-setup-recipe.salts.compare.over': 'Over by {mg}\u00a0mg',
  // Ion names (comparison rows and salt contents)
  'ui-setup-recipe.ion.Sodium': 'Sodium',
  'ui-setup-recipe.ion.Potassium': 'Potassium',
  'ui-setup-recipe.ion.Magnesium': 'Magnesium',
  'ui-setup-recipe.ion.Calcium': 'Calcium',
  'ui-setup-recipe.ion.Chloride': 'Chloride',
  'ui-setup-recipe.ion.Citrate': 'Citrate',
  'ui-setup-recipe.ion.Bicarbonate': 'Bicarbonate',
  'ui-setup-recipe.ion.Sulfate': 'Sulfate',

  // Format: gels, a drink, or both
  'ui-setup-recipe.format.type.label': 'Format',
  'ui-setup-recipe.format.type.gel': 'Gel',
  'ui-setup-recipe.format.type.drink': 'Drink',
  'ui-setup-recipe.format.type.both': 'Both',
  // One-line summary of a collapsed section ({gels} gels per hour; {consistency} its option text;
  // {bottle} the bottle size with its unit, as the bottle presets write it: "750 ml", "25.4 fl oz";
  // {share} the drink's share of the carbs)
  'ui-setup-recipe.format.summary.gel': 'Gel · {gels} per hour · {consistency}',
  'ui-setup-recipe.format.summary.drink': 'Drink · {bottle} bottles',
  'ui-setup-recipe.format.summary.both': 'Both · {share:percent} of the carbs in the drink',
  // Gels per hour, with what that gives (or why there are no gels)
  'ui-setup-recipe.format.gels.label': 'Gels per hour',
  'ui-setup-recipe.format.gels.total.one': '{count} gel in total',
  'ui-setup-recipe.format.gels.total.other': '{count} gels in total',
  'ui-setup-recipe.format.gels.noCarbs': 'No gels needed: this plan has no carbs',
  'ui-setup-recipe.format.gels.noIngredients': 'No gels: your ingredients give no carbs',
  'ui-setup-recipe.format.gels.allInDrink': 'No gels: all carbs are in the drink',
  'ui-setup-recipe.format.gels.none': 'No gels planned: the carbs go in your drink',
  // Gel consistency: option text "{name} {pct}" ("Standard 60%"); the names come from the concentration catalog
  'ui-setup-recipe.format.consistency.label': 'Gel consistency',
  'ui-setup-recipe.format.consistency.option': '{name} {pct:percent}',
  'ui-setup-recipe.format.consistency.hint':
    'Carbohydrate as % of the gel mass. Higher is thicker and needs more water with each gel.',
  // Bottle size: presets (500/750/950 ml, written by the volume formatter) or a custom size
  'ui-setup-recipe.format.bottle.label': 'Bottle size',
  'ui-setup-recipe.format.bottle.custom': 'Custom',
  'ui-setup-recipe.format.bottle.customLabel': 'Custom bottle size',
  // {min} is the smallest size as a number ("250", "8.5"), {max} the largest with its unit ("1,500 ml",
  // "50.7 fl oz"): both as the field rounds them, so the hint matches its limits
  'ui-setup-recipe.format.bottle.customHint': 'Any size from {min} to {max}.',
  // Both: the drink's share of the carbs (number field and slider)
  'ui-setup-recipe.format.share.label': 'Carbs in the drink',
  'ui-setup-recipe.format.share.hint': 'The rest goes into gels. The drink holds all the salts.',
  'ui-setup-recipe.format.share.slider': 'Carbs in the drink, slider',
  'ui-setup-recipe.format.share.sliderValue': '{pct:percent} in the drink',
};

export default uiSetupRecipe;
