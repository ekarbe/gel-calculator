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
 * German UI text of the recipe itself (`src/components/recipe/recipeText.js`).
 * Same keys and placeholders as `../en/ui-recipe.js` (a parity test checks
 * it); see there for what each placeholder holds.
 * @type {Record<string, string>}
 */
const uiRecipe = {
  // Amounts of recipe lines
  'ui-recipe.amount.g': '{value} g',
  'ui-recipe.amount.mg': '{value} mg',
  'ui-recipe.amount.below': '<{value}',
  'ui-recipe.amount.tablets.one': '{value} Tablette',
  'ui-recipe.amount.tablets.other': '{value} Tabletten',

  // Custom ingredients and salts without a name
  'ui-recipe.custom.carb': 'Eigene Zutat {number}',
  'ui-recipe.custom.salt': 'Eigenes Salz {number}',

  // The built-in carb sources, by id
  'ui-recipe.source.1': 'Dextrose (wasserfrei)',
  'ui-recipe.source.2': 'Glukosesirup',
  'ui-recipe.source.3': 'Maltodextrin',
  'ui-recipe.source.4': 'Maltose',
  'ui-recipe.source.5': 'Hochverzweigtes zyklisches Dextrin (HBCD)',
  'ui-recipe.source.6': 'Reissirup',
  'ui-recipe.source.7': 'Gerstenmalzextrakt',
  'ui-recipe.source.8': 'Dextrose (Monohydrat)',
  'ui-recipe.source.11': 'Fruktose (kristallin)',
  'ui-recipe.source.12': 'Fruktose-Glukose-Sirup (HFCS)',
  'ui-recipe.source.13': 'Agavendicksaft',
  'ui-recipe.source.14': 'Honig',
  'ui-recipe.source.15': 'Dattelsirup',
  'ui-recipe.source.16': 'Traubensaftkonzentrat',
  'ui-recipe.source.17': 'Ahornsirup',
  'ui-recipe.source.18': 'Saccharose (Rohrzucker)',
  'ui-recipe.source.19': 'Kokosblütenzucker',
  'ui-recipe.source.20': 'Apfelsaftkonzentrat',
  // The built-in salts, by id
  'ui-recipe.source.31': 'Natriumchlorid (Kochsalz)',
  'ui-recipe.source.32': 'Kaliumchlorid',
  'ui-recipe.source.33': 'Natriumcitrat (Dihydrat)',
  'ui-recipe.source.34': 'Magnesiumcitrat (wasserfrei)',
  'ui-recipe.source.35': 'Calciumcitrat (Tetrahydrat)',
  'ui-recipe.source.36': 'Magnesiumchlorid (Hexahydrat-Flocken)',
  'ui-recipe.source.37': 'Calciumchlorid (wasserfrei)',
  'ui-recipe.source.38': 'Natron (Natriumbicarbonat)',
  'ui-recipe.source.39': 'Kaliumcitrat (Monohydrat)',
  'ui-recipe.source.40': 'Magnesiumsulfat (Bittersalz, Heptahydrat)',

  // Osmolality of a gel or a drink
  'ui-recipe.osmo.value': '≈ {mOsm} mOsm/kg',
  'ui-recipe.osmo.valueHigher': '≈ {mOsm} mOsm/kg, wahrscheinlich höher',

  // Counts of servings
  'ui-recipe.servings.gels.one': '{count} Gel',
  'ui-recipe.servings.gels.other': '{count} Gels',
  'ui-recipe.servings.bottles.one': '{count} Flasche',
  'ui-recipe.servings.bottles.other': '{count} Flaschen',

  // Mixing steps of a gel batch
  'ui-recipe.mix.weigh.title': 'Zutaten abwiegen',
  'ui-recipe.mix.weigh.text': 'Wiege diese Mengen für {gels} ab:',
  'ui-recipe.mix.weigh.list': 'Gelzutaten',
  'ui-recipe.mix.dissolve.title': 'Auflösen',
  'ui-recipe.mix.dissolve.water':
    'Erwärme {water} Wasser. Rühre die Pulver und Sirupe ein, bis sie sich aufgelöst haben und das Gel glatt ist.',
  'ui-recipe.mix.dissolve.noWater':
    'Gib kein Wasser dazu: Deine Sirupe bringen genug mit. Rühre die Pulver in die Sirupe, bis sie sich aufgelöst haben und das Gel glatt ist.',
  'ui-recipe.mix.fill.title': 'In Gelflaschen füllen',
  'ui-recipe.mix.fill.one': 'Fülle die Mischung in 1 Gelflasche.',
  'ui-recipe.mix.fill.oneVolume': 'Fülle die Mischung in 1 Gelflasche mit etwa {volume}.',
  'ui-recipe.mix.fill.oneVolumeMass': 'Fülle die Mischung in 1 Gelflasche mit etwa {volume} ({mass}).',
  'ui-recipe.mix.fill.other': 'Teile die Mischung auf {count} Gelflaschen auf.',
  'ui-recipe.mix.fill.otherVolume': 'Teile die Mischung auf {count} Gelflaschen mit je etwa {volume} auf.',
  'ui-recipe.mix.fill.otherVolumeMass': 'Teile die Mischung auf {count} Gelflaschen mit je etwa {volume} ({mass}) auf.',
  'ui-recipe.mix.fill.keepOne': 'Bewahre sie bis zum Start verschlossen und kühl auf.',
  'ui-recipe.mix.fill.keepOther': 'Bewahre sie bis zum Start verschlossen und kühl auf.',
  'ui-recipe.mix.caffeine.title': 'Koffeintabletten zugeben',
  'ui-recipe.mix.caffeine.text':
    'Zerdrücke jede Tablette zu feinem Pulver und rühre sie in ihr Gel, bis sie sich aufgelöst hat. Verwende nie reines Koffeinpulver. Markiere diese Gels, damit du sie zur richtigen Zeit nimmst. Gel 1 ist das Gel, das du beim Start nimmst:',
  'ui-recipe.mix.caffeine.list': 'Koffeintabletten',
  // Mixing steps of the drink
  'ui-recipe.mix.add.title': 'Pulver einfüllen',
  'ui-recipe.mix.add.text': 'Bereite {bottles} vor. Gib Folgendes in jede Flasche:',
  'ui-recipe.mix.add.list': 'Getränkezutaten',
  'ui-recipe.mix.shake.title': 'Auffüllen und schütteln',
  'ui-recipe.mix.shake.water': 'Bereite {bottles} Wasser vor.',
  'ui-recipe.mix.shake.addWater': 'Gib etwa {water} Wasser dazu, bis zur Markierung bei {mark}.',
  'ui-recipe.mix.shake.toMark': 'Fülle bis zur Markierung bei {mark} auf.',
  'ui-recipe.mix.shake.notFull': 'Deine Flasche ({bottle}) wird nicht voll: Mehr Flüssigkeit braucht der Plan daraus nicht.',
  'ui-recipe.mix.shake.shake': 'Schüttle, bis am Boden nichts mehr liegt.',
};

export default uiRecipe;
