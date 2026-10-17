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
 * German UI text for the Ingredients, Salts and Format sections.
 * Same keys and placeholders as `../en/ui-setup-recipe.js` (a parity test
 * checks it); see there for what each placeholder holds. Ingredient and
 * salt names stay the plain source labels (or the names people typed).
 * @type {Record<string, string>}
 */
const uiSetupRecipe = {
  // Section titles
  'ui-setup-recipe.ingredients.title': 'Zutaten',
  'ui-setup-recipe.salts.title': 'Salze',
  'ui-setup-recipe.format.title': 'Format',

  // Unit suffixes of number fields
  'ui-setup-recipe.unit.g': 'g',
  'ui-setup-recipe.unit.percent': '%',

  // Ingredients: one-line summary of a collapsed section
  'ui-setup-recipe.ingredients.summary': '{names} · Rezept {ratio:ratio}',
  'ui-setup-recipe.ingredients.summaryEmpty': 'Keine Zutaten',
  'ui-setup-recipe.ingredients.intro':
    'Die Gewichtung gibt an, wie viel du von jeder Zutat bevorzugst. Die Mischung bleibt so nah daran, wie es das Verhältnis zulässt.',
  // The ingredient list
  'ui-setup-recipe.ingredients.listLabel': 'Zutatenliste',
  'ui-setup-recipe.ingredients.empty': 'Noch keine Zutaten. Füge unten eine hinzu.',
  'ui-setup-recipe.ingredients.kind.powder': 'Pulver',
  'ui-setup-recipe.ingredients.kind.syrup': 'Sirup',
  'ui-setup-recipe.ingredients.kind.custom': 'Eigene',
  // {carbs} g carbs per 100 g of the ingredient; {glucose} and {fructose} split those carbs
  'ui-setup-recipe.ingredients.facts':
    '{carbs} g Kohlenhydrate pro 100 g · Glukose {glucose:percent} · Fruktose {fructose:percent}',
  // What the recipe uses of an ingredient
  'ui-setup-recipe.ingredients.usage.used': 'Im Rezept: {amount}, {share:percent} der Kohlenhydrate.',
  'ui-setup-recipe.ingredients.usage.noCarbs': 'Enthält keine Kohlenhydrate, daher lässt das Rezept sie weg.',
  'ui-setup-recipe.ingredients.usage.duplicate': 'Steht auch weiter oben. Die beiden Gewichtungen werden addiert.',
  'ui-setup-recipe.ingredients.usage.notNeeded': 'Nicht verwendet. Die Mischung erreicht das Verhältnis auch ohne sie.',
  'ui-setup-recipe.ingredients.usage.noPlanCarbs': 'Nicht verwendet. Der Plan hat keine Kohlenhydrate zum Aufteilen.',
  'ui-setup-recipe.ingredients.remove': '{name} entfernen',
  // Preference weight 0–100: the visible label, and the full names of the number field and slider
  'ui-setup-recipe.ingredients.weight': 'Gewichtung',
  'ui-setup-recipe.ingredients.weightOf': 'Gewichtung von {name}',
  'ui-setup-recipe.ingredients.weightSlider': 'Gewichtung von {name} (Schieberegler)',
  // The add menu
  'ui-setup-recipe.ingredients.add.label': 'Zutat hinzufügen',
  'ui-setup-recipe.ingredients.add.button': 'Hinzufügen',
  'ui-setup-recipe.ingredients.add.powders': 'Pulver',
  'ui-setup-recipe.ingredients.add.syrups': 'Sirupe',
  'ui-setup-recipe.ingredients.add.custom': 'Deine Zutaten',
  'ui-setup-recipe.ingredients.add.allListed': 'Alle Zutaten sind schon in der Liste.',

  // The bar of ratios the ingredients can make (1:0 glucose only … 0:1 fructose only)
  'ui-setup-recipe.reach.title': 'Verhältnisse, die mit deinen Zutaten möglich sind',
  'ui-setup-recipe.reach.reachable': 'Erreichbar',
  'ui-setup-recipe.reach.allowed': 'Erlaubt',
  'ui-setup-recipe.reach.target': 'Ziel',
  'ui-setup-recipe.reach.recipe': 'Dein Rezept',
  'ui-setup-recipe.reach.range': '{lo:ratio}–{hi:ratio}',
  'ui-setup-recipe.reach.only': 'nur {ratio:ratio}',
  'ui-setup-recipe.reach.none': 'Keines',
  'ui-setup-recipe.reach.noCarbs': 'Noch keine Kohlenhydrate',
  // Auto ratio: the solver used another ratio inside the allowed range ({gPerHour} the carb target)
  'ui-setup-recipe.reach.substituted':
    'Mit deinen Zutaten ist {target:ratio} nicht möglich. Das Rezept nutzt {recipe:ratio}, das bei {gPerHour} g/h noch im erlaubten Bereich liegt.',

  // Your own ingredients, typed in from a label
  'ui-setup-recipe.custom.title': 'Deine Zutaten',
  'ui-setup-recipe.custom.intro': 'Gib ein Gel, einen Getränkemix oder einen Sirup anhand des Etiketts ein.',
  'ui-setup-recipe.custom.listLabel': 'Deine Zutaten',
  'ui-setup-recipe.custom.new': 'Neue Zutat',
  'ui-setup-recipe.custom.full':
    'Du hast {max} eigene Zutaten, mehr speichert die App nicht. Lösche eine, um eine neue hinzuzufügen.',
  // Name of a custom ingredient without a name (only a share link can give one)
  'ui-setup-recipe.custom.facts': '{carbs} g Kohlenhydrate pro 100 g · Fruktose {fructose:percent} der Kohlenhydrate',
  'ui-setup-recipe.custom.factsWater':
    '{carbs} g Kohlenhydrate pro 100 g · Fruktose {fructose:percent} der Kohlenhydrate · Wasser {water} g pro 100 g',
  'ui-setup-recipe.custom.edit': '{name} bearbeiten',
  'ui-setup-recipe.custom.delete': '{name} löschen',
  'ui-setup-recipe.custom.deleteQuestion': '{name} löschen? Die Zutat verschwindet auch aus der Zutatenliste.',
  'ui-setup-recipe.custom.confirmDelete': 'Ja, löschen',
  'ui-setup-recipe.custom.keep': 'Behalten',
  // The add/edit form
  'ui-setup-recipe.custom.form.newTitle': 'Neue Zutat',
  'ui-setup-recipe.custom.form.editTitle': '{name} bearbeiten',
  'ui-setup-recipe.custom.form.name': 'Name',
  'ui-setup-recipe.custom.form.carbs': 'Kohlenhydrate pro 100 g',
  'ui-setup-recipe.custom.form.carbsHint': 'Kohlenhydrate gesamt laut Etikett.',
  'ui-setup-recipe.custom.form.fructose': 'Fruktoseanteil der Kohlenhydrate',
  'ui-setup-recipe.custom.form.fructoseHint': 'Fruktose plus die Hälfte der Saccharose. Maltodextrin: 0\u00a0%. Honig: etwa 50\u00a0%.',
  'ui-setup-recipe.custom.form.water': 'Wasser pro 100 g (optional)',
  'ui-setup-recipe.custom.form.waterHint': 'Leer lassen, um den Rest der Masse als Wasser zu zählen.',
  'ui-setup-recipe.custom.form.save': 'Zutat speichern',
  'ui-setup-recipe.custom.form.cancel': 'Abbrechen',
  'ui-setup-recipe.custom.error.name': 'Gib einen Namen ein.',
  'ui-setup-recipe.custom.error.carbs': 'Gib mehr als 0 und höchstens 100 g ein.',
  'ui-setup-recipe.custom.error.fructose': 'Gib 0 bis 100\u00a0% ein.',
  'ui-setup-recipe.custom.error.water': 'Gib 0 bis 100 g ein oder lass das Feld leer.',
  'ui-setup-recipe.custom.error.waterSum': 'Kohlenhydrate und Wasser ergeben zusammen mehr als 100 g.',

  // Salts: Auto follows the sodium (and extras) targets, Manual lists the salts and amounts
  'ui-setup-recipe.salts.mode.label': 'Salzmodus',
  'ui-setup-recipe.salts.mode.auto': 'Auto',
  'ui-setup-recipe.salts.mode.manual': 'Manuell',
  // One-line summary of a collapsed section ({salt} the sodium salt; {salts} a list of names)
  'ui-setup-recipe.salts.summary.auto': 'Auto · {salt}',
  'ui-setup-recipe.salts.summary.manual': 'Manuell · {salts}',
  'ui-setup-recipe.salts.summary.manualEmpty': 'Manuell · keine Salze',
  // Auto mode
  'ui-setup-recipe.salts.sodiumSalt.label': 'Natriumsalz',
  'ui-setup-recipe.salts.sodiumSalt.table': 'Kochsalz',
  'ui-setup-recipe.salts.sodiumSalt.citrate': 'Natriumcitrat',
  'ui-setup-recipe.salts.sodiumSalt.mix': 'Mischung 50:50',
  'ui-setup-recipe.salts.sodiumSalt.hint': 'Kalium, Magnesium und Calcium kommen aus ihren Citraten.',
  'ui-setup-recipe.salts.auto.listLabel': 'Salzmengen für die gesamte Dauer',
  'ui-setup-recipe.salts.auto.none': 'Für diesen Plan sind keine Salze nötig.',
  'ui-setup-recipe.salts.auto.note': 'Die Mengen gelten für die gesamte Dauer.',
  // Manual mode
  'ui-setup-recipe.salts.manual.hint': 'Gib die Mengen in Gramm für die gesamte Dauer ein.',
  'ui-setup-recipe.salts.manual.listLabel': 'Deine Salzmengen',
  'ui-setup-recipe.salts.manual.empty': 'Keine Salze hinzugefügt.',
  'ui-setup-recipe.salts.manual.add': 'Salz hinzufügen',
  'ui-setup-recipe.salts.manual.salt': 'Salz {number}',
  'ui-setup-recipe.salts.manual.builtIn': 'Salze',
  'ui-setup-recipe.salts.manual.custom': 'Deine Salze',
  'ui-setup-recipe.salts.manual.amount': 'Menge',
  'ui-setup-recipe.salts.manual.amountOf': 'Menge von {name} für die gesamte Dauer',
  'ui-setup-recipe.salts.manual.remove': '{name} entfernen',
  // What a salt holds: "Enthält 39,3 % Natrium, 60,7 % Chlorid" ({parts} a list of salts.part)
  'ui-setup-recipe.salts.contains': 'Enthält {parts}',
  'ui-setup-recipe.salts.part': '{pct:percent} {ion}',
  'ui-setup-recipe.salts.noValues': 'Noch keine Werte eingegeben.',
  // Name of a custom salt without a name, and of a salt the app does not know
  'ui-setup-recipe.salts.unknownName': 'Salz {ref}',
  // Salts typed in from a label (Manual mode)
  'ui-setup-recipe.salts.custom.title': 'Salze vom Etikett',
  'ui-setup-recipe.salts.custom.intro':
    'Für ein Produkt, das nicht in der Liste steht: Gib jedes Element vom Etikett als % der Produktmasse ein. 39 g Natrium pro 100 g sind zum Beispiel 39\u00a0%.',
  'ui-setup-recipe.salts.custom.listLabel': 'Salze vom Etikett',
  'ui-setup-recipe.salts.custom.name': 'Name des Salzes',
  'ui-setup-recipe.salts.custom.delete': '{name} aus deinen Salzen löschen',
  // Label fields: the element name (an uppercase caption) and its chemical symbol after it
  'ui-setup-recipe.salts.custom.sodiumPct': 'Natrium',
  'ui-setup-recipe.salts.custom.potassiumPct': 'Kalium',
  'ui-setup-recipe.salts.custom.magnesiumPct': 'Magnesium',
  'ui-setup-recipe.salts.custom.calciumPct': 'Calcium',
  'ui-setup-recipe.salts.custom.chloridePct': 'Chlorid',
  'ui-setup-recipe.salts.custom.symbol.sodiumPct': '(Na)',
  'ui-setup-recipe.salts.custom.symbol.potassiumPct': '(K)',
  'ui-setup-recipe.salts.custom.symbol.magnesiumPct': '(Mg)',
  'ui-setup-recipe.salts.custom.symbol.calciumPct': '(Ca)',
  'ui-setup-recipe.salts.custom.symbol.chloridePct': '(Cl)',
  'ui-setup-recipe.salts.custom.overTotal':
    'Diese Werte ergeben zusammen {total:percent}, mehr als das ganze Salz. Prüfe das Etikett.',
  'ui-setup-recipe.salts.custom.empty': 'Gib mindestens einen Wert vom Etikett ein.',
  'ui-setup-recipe.salts.custom.add': 'Salz vom Etikett hinzufügen',
  'ui-setup-recipe.salts.custom.full': 'Du hast {max} Salze vom Etikett, mehr speichert die App nicht.',
  // Delivered vs target table ({mg} a locale number of mg); a no-break space keeps "{mg} mg" together
  'ui-setup-recipe.salts.compare.caption': 'Geliefert vs. Ziel (gesamte Dauer)',
  'ui-setup-recipe.salts.compare.ion': 'Ion',
  'ui-setup-recipe.salts.compare.target': 'Ziel',
  'ui-setup-recipe.salts.compare.delivered': 'Geliefert',
  'ui-setup-recipe.salts.compare.mg': '{mg} mg',
  'ui-setup-recipe.salts.compare.met': 'Ziel erreicht',
  'ui-setup-recipe.salts.compare.short': '{mg} mg zu wenig',
  'ui-setup-recipe.salts.compare.over': '{mg} mg zu viel',
  // Ion names (comparison rows and salt contents)
  'ui-setup-recipe.ion.Sodium': 'Natrium',
  'ui-setup-recipe.ion.Potassium': 'Kalium',
  'ui-setup-recipe.ion.Magnesium': 'Magnesium',
  'ui-setup-recipe.ion.Calcium': 'Calcium',
  'ui-setup-recipe.ion.Chloride': 'Chlorid',
  'ui-setup-recipe.ion.Citrate': 'Citrat',
  'ui-setup-recipe.ion.Bicarbonate': 'Bicarbonat',
  'ui-setup-recipe.ion.Sulfate': 'Sulfat',

  // Format: gels, a drink, or both
  'ui-setup-recipe.format.type.label': 'Format',
  'ui-setup-recipe.format.type.gel': 'Gel',
  'ui-setup-recipe.format.type.drink': 'Getränk',
  'ui-setup-recipe.format.type.both': 'Beides',
  // One-line summary of a collapsed section ({bottle} the bottle size with its unit)
  'ui-setup-recipe.format.summary.gel': 'Gel · {gels} pro Stunde · {consistency}',
  'ui-setup-recipe.format.summary.drink': 'Getränk · Flaschen à {bottle}',
  'ui-setup-recipe.format.summary.both': 'Beides · {share:percent} der Kohlenhydrate im Getränk',
  // Gels per hour, with what that gives (or why there are no gels)
  'ui-setup-recipe.format.gels.label': 'Gels pro Stunde',
  'ui-setup-recipe.format.gels.total.one': '{count} Gel insgesamt',
  'ui-setup-recipe.format.gels.total.other': '{count} Gels insgesamt',
  'ui-setup-recipe.format.gels.noCarbs': 'Keine Gels nötig: Dieser Plan hat keine Kohlenhydrate',
  'ui-setup-recipe.format.gels.noIngredients': 'Keine Gels: Deine Zutaten liefern keine Kohlenhydrate',
  'ui-setup-recipe.format.gels.allInDrink': 'Keine Gels: Alle Kohlenhydrate sind im Getränk',
  'ui-setup-recipe.format.gels.none': 'Keine Gels geplant: Die Kohlenhydrate kommen in dein Getränk',
  // Gel consistency: option text "{name} {pct}" ("Standard 60 %"); the names come from the concentration catalog
  'ui-setup-recipe.format.consistency.label': 'Gelkonsistenz',
  'ui-setup-recipe.format.consistency.option': '{name} {pct:percent}',
  'ui-setup-recipe.format.consistency.hint':
    'Kohlenhydratanteil in % der Gelmasse. Je höher, desto dickflüssiger das Gel und desto mehr Wasser brauchst du dazu.',
  // Bottle size: presets or a custom size
  'ui-setup-recipe.format.bottle.label': 'Flaschengröße',
  'ui-setup-recipe.format.bottle.custom': 'Eigene',
  'ui-setup-recipe.format.bottle.customLabel': 'Eigene Flaschengröße',
  // {min} is the smallest size as a number, {max} the largest with its unit
  'ui-setup-recipe.format.bottle.customHint': 'Jede Größe von {min} bis {max}.',
  // Both: the drink's share of the carbs (number field and slider)
  'ui-setup-recipe.format.share.label': 'Kohlenhydrate im Getränk',
  'ui-setup-recipe.format.share.hint': 'Der Rest kommt in die Gels. Das Getränk enthält alle Salze.',
  'ui-setup-recipe.format.share.slider': 'Kohlenhydrate im Getränk, Schieberegler',
  'ui-setup-recipe.format.share.sliderValue': '{pct:percent} im Getränk',
};

export default uiSetupRecipe;
