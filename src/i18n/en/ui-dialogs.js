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
 * English UI text for the dialogs (`src/components/dialogs/*`): mixing
 * steps, share (link and recipe image), gel templates, My recipes and
 * settings. Keys start with `ui-dialogs.`; placeholders follow
 * `src/i18n/index.js`. Plain `{x}` placeholders that hold an amount get a
 * text the dialog already formatted ("158 g", "0.5 tablets"), so the amount
 * bands of the recipe apply; volumes are typed (`{x:volume}`) and follow the
 * unit system. Counts that read differently for one and many have `.one`
 * and `.other` keys.
 *
 * The `ui-dialogs.templates.data.*` keys are the prose of the gel templates
 * in `src/constants/templates.js` (description, other ingredients, label
 * notes, source names), so they can be translated. Their English text must
 * stay identical to the constants; a test in
 * `src/components/dialogs/TemplatesDialog.test.jsx` checks it.
 * @type {Record<string, string>}
 */
const uiDialogs = {
  // Dialog titles (headings and accessible names)
  'ui-dialogs.mixing.title': 'Mixing steps',
  'ui-dialogs.share.title': 'Share',
  'ui-dialogs.share.imageTitle': 'Recipe image',
  'ui-dialogs.templates.title': 'Gel templates',
  'ui-dialogs.recipes.title': 'My recipes',
  'ui-dialogs.settings.title': 'Settings',

  // Unit after a big number (the delivered carbs)
  'ui-dialogs.unit.g': 'g',
  // Recipe section headings
  'ui-dialogs.section.gel': 'Gels',
  'ui-dialogs.section.drink': 'Drink',
  // What a section's servings are; {bottles} is a bottle count (ui-recipe.servings.bottles)
  'ui-dialogs.servings.gelNone': 'No gels planned',
  'ui-dialogs.servings.drinkNone': 'No bottles: no fluid planned',
  'ui-dialogs.servings.drinkFull': '{bottles} of {fill:volume}',
  'ui-dialogs.servings.drinkPartial': '{bottles}, {fill:volume} each ({size:volume} bottle)',
  // Caption of the amounts shown for a section (the per-serving captions come from the recipe catalog)
  'ui-dialogs.amounts.batch': 'Whole batch',
  'ui-dialogs.amounts.allBottles': 'All bottles',
  'ui-dialogs.amounts.activity': 'Whole activity',
  // Osmolality and its tonicity band ({tonicity} from the concentration catalog)
  'ui-dialogs.osmo.withTonicity': '{value} · {tonicity}',
  'ui-dialogs.nothingToMix': 'Nothing to mix for this plan.',
  // Recipe formats (`format.type`)
  'ui-dialogs.format.gel': 'Gel',
  'ui-dialogs.format.drink': 'Drink',
  'ui-dialogs.format.both': 'Gel + drink',

  // Mixing steps dialog
  // Accessible name of the dialog's content (a focusable group, so the keyboard can scroll it)
  'ui-dialogs.mixing.content': 'Recipe and steps',
  'ui-dialogs.mixing.totalCarbs': 'Total carbs',
  // Under the delivered carbs when the ingredients cannot reach the target; {target} is a number of grams
  'ui-dialogs.mixing.ofTarget': 'of {target} g target',
  'ui-dialogs.mixing.noCarbs': 'This plan has no carbs, so there are no gels to make.',
  'ui-dialogs.mixing.rinse': 'Mouth rinse option.',
  // Screen-reader prefix of a step heading ("Step 1: Weigh the Ingredients"); the number shows as a badge
  'ui-dialogs.mixing.step': 'Step {number}:',
  // Accessible name of a section's list of steps; {title} is the section heading
  'ui-dialogs.mixing.steps': '{title} steps',
  // What to drink during the activity, from the plan and the schedule. {rate} is one of the two rate texts.
  'ui-dialogs.mixing.during.title': 'During the Activity',
  'ui-dialogs.mixing.during.rate': 'Drink about {mlPerHour:volume}/h',
  'ui-dialogs.mixing.during.rateBottles': 'Drink about {mlPerHour:volume}/h from your bottles',
  'ui-dialogs.mixing.during.withGel': '{rate}: about {ml:volume} with each gel. The schedule lists the amount for every gel.',
  // {interval} is the minutes between two sips of the schedule
  'ui-dialogs.mixing.during.withSip': '{rate}: about {ml:volume} every {interval} min. The schedule lists every sip.',
  'ui-dialogs.mixing.during.plain': '{rate}.',
  'ui-dialogs.mixing.during.takeGels': 'Take each gel at the time the schedule lists.',
  'ui-dialogs.mixing.during.noFluid': 'This plan has no fluid target.',
  'ui-dialogs.mixing.during.thirst': 'Drinking to thirst also works for this event.',
  'ui-dialogs.mixing.done': 'Got it',

  // Share dialog: link
  'ui-dialogs.share.description': 'Send this plan as a link, or save a picture of the recipe.',
  'ui-dialogs.share.link.heading': 'Link',
  'ui-dialogs.share.link.label': 'Share link',
  'ui-dialogs.share.link.hint': 'Opens this plan with all its inputs. Language, units and currency stay as each person set them.',
  'ui-dialogs.share.copy': 'Copy link',
  // Share dialog: image
  'ui-dialogs.share.image.heading': 'Image',
  'ui-dialogs.share.image.text': 'A picture of the targets and the recipe, to save or send.',
  'ui-dialogs.share.image.open': 'Make an image',
  'ui-dialogs.share.back': 'Back',
  'ui-dialogs.share.download': 'Download',
  // File name of the downloaded image
  'ui-dialogs.share.fileName': 'gel-recipe.png',
  'ui-dialogs.share.toast.copied': 'Recipe link copied.',
  'ui-dialogs.share.toast.copyFailed': 'Could not copy the link.',
  'ui-dialogs.share.toast.downloaded': 'Image downloaded.',
  'ui-dialogs.share.toast.imageFailed': 'Could not make the image.',
  // The recipe image (its event line is the board's summary, ui-board.summary)
  'ui-dialogs.share.image.label': 'Recipe image preview',
  'ui-dialogs.share.image.wordmark': 'Gel Calculator',
  'ui-dialogs.share.image.totalCarbs': 'Total carbs',
  'ui-dialogs.share.image.carbsPerHour': 'Carbs per hour',
  'ui-dialogs.share.image.ratio': 'Ratio',
  'ui-dialogs.share.image.gramsPerHour': '{value} g/h',
  'ui-dialogs.share.image.sodium': 'Sodium',
  // {value} is a number in the locale's format
  'ui-dialogs.share.image.mgPerHour': '{value} mg/h',
  'ui-dialogs.share.image.fluid': 'Fluid',
  'ui-dialogs.share.image.mlPerHour': '{mlPerHour:volume}/h',
  // The caffeine of the whole activity (its amount is an `amount.mg`)
  'ui-dialogs.share.image.caffeine': 'Caffeine',
  'ui-dialogs.share.image.viewTotal': 'Total · {hours} h',
  'ui-dialogs.share.image.viewPerServing': 'Per serving',
  // Accessible name of a section's lines; {title} is the section heading
  'ui-dialogs.share.image.lines': '{title} recipe',
  // Screen-reader text of a carb line's bar
  'ui-dialogs.share.image.share': '{pct:percent} of the carbs',
  'ui-dialogs.share.image.footer': 'eikekarbe.com/gel-calculator',

  // Gel templates dialog
  'ui-dialogs.templates.description':
    'A template copies a commercial gel’s sugar ratio, carb sources and sodium salt. Your carb and sodium targets stay the same.',
  'ui-dialogs.templates.list': 'Templates',
  'ui-dialogs.templates.ratio': 'Ratio {ratio:ratio}',
  'ui-dialogs.templates.inspired': 'Inspired by {brand}; not affiliated',
  'ui-dialogs.templates.verified': 'Label verified',
  'ui-dialogs.templates.notVerified': 'Label not verified',
  'ui-dialogs.templates.estimates': 'Some values are estimates. The label notes say which.',
  'ui-dialogs.templates.perGel': 'Per gel',
  'ui-dialogs.templates.carbs': 'Carbs',
  'ui-dialogs.templates.sodium': 'Sodium',
  'ui-dialogs.templates.caffeine': 'Caffeine',
  'ui-dialogs.templates.carbSources': 'Carb sources',
  'ui-dialogs.templates.otherIngredients': 'Other ingredients',
  'ui-dialogs.templates.none': 'None',
  'ui-dialogs.templates.notes': 'Label notes',
  'ui-dialogs.templates.sources': 'Sources',
  // After a source link: when it was checked; {date} is a month ("Oct 2026")
  'ui-dialogs.templates.checked': '(checked {date})',
  // {gPerHour} is the plan's carb target, {count} the gels per hour the template gives
  'ui-dialogs.templates.rate.one': 'At {gPerHour} g/h: {count} gel per hour',
  'ui-dialogs.templates.rate.other': 'At {gPerHour} g/h: {count} gels per hour',
  'ui-dialogs.templates.use': 'Use template',
  // Accessible name of the "Use template" button
  'ui-dialogs.templates.useNamed': 'Use template: {name}',
  'ui-dialogs.templates.applied': '{name} template applied.',

  // My recipes dialog
  'ui-dialogs.recipes.description':
    'Recipes are saved in this browser only, and Safari deletes them after about a week without a visit. Copy a link to keep a recipe or to use it on another device.',
  'ui-dialogs.recipes.save.heading': 'Save the current plan',
  // {summary} is a recipe summary (below)
  'ui-dialogs.recipes.current': 'Current plan: {summary}',
  'ui-dialogs.recipes.name': 'Name',
  'ui-dialogs.recipes.namePlaceholder': 'e.g. Long ride, hot day',
  'ui-dialogs.recipes.nameHint': 'Up to {max} characters. Without a name it is saved as “{untitled}”.',
  'ui-dialogs.recipes.save': 'Save',
  // Name of a recipe saved or renamed without a name
  'ui-dialogs.recipes.untitled': 'Untitled recipe',
  // Name of a duplicated recipe; {name} is the original name
  'ui-dialogs.recipes.copyName': '{name} (copy)',
  'ui-dialogs.recipes.list.heading': 'Saved recipes',
  'ui-dialogs.recipes.count': '{count} of {max}',
  'ui-dialogs.recipes.empty': 'No saved recipes yet. Save the current plan to find it here later.',
  // One-line summary of a plan: "3:00 h · 75 g/h · Gel" ({duration} as on the board)
  'ui-dialogs.recipes.summary': '{duration} · {gPerHour} g/h · {format}',
  'ui-dialogs.recipes.unreadable': 'This recipe cannot be read. It may come from a newer version of the app.',
  // When a recipe was saved; {time} is a date and time
  'ui-dialogs.recipes.saved': 'Saved {time}',
  // Row actions: visible text and the accessible name with the recipe's name
  'ui-dialogs.recipes.actions': 'Actions for {name}',
  'ui-dialogs.recipes.open': 'Open',
  'ui-dialogs.recipes.openNamed': 'Open: {name}',
  'ui-dialogs.recipes.rename': 'Rename',
  'ui-dialogs.recipes.renameNamed': 'Rename: {name}',
  'ui-dialogs.recipes.duplicate': 'Duplicate',
  'ui-dialogs.recipes.duplicateNamed': 'Duplicate: {name}',
  'ui-dialogs.recipes.copyLink': 'Copy link',
  'ui-dialogs.recipes.copyLinkNamed': 'Copy link: {name}',
  'ui-dialogs.recipes.delete': 'Delete',
  'ui-dialogs.recipes.deleteNamed': 'Delete: {name}',
  // Inline rename form
  'ui-dialogs.recipes.newName': 'New name',
  'ui-dialogs.recipes.newNameFor': 'New name for {name}',
  'ui-dialogs.recipes.saveName': 'Save name',
  'ui-dialogs.recipes.cancel': 'Cancel',
  'ui-dialogs.recipes.cancelRename': 'Cancel renaming',
  // Inline delete confirmation
  'ui-dialogs.recipes.confirmDelete': 'Delete “{name}”? This cannot be undone.',
  'ui-dialogs.recipes.yesDelete': 'Yes, delete',
  'ui-dialogs.recipes.keep': 'Keep it',
  // Opens the gel templates dialog
  'ui-dialogs.recipes.templates': 'Start from a gel template',
  // Toasts
  'ui-dialogs.recipes.toast.saved': 'Saved “{name}”.',
  'ui-dialogs.recipes.toast.saveFailed': 'Could not save the recipe. Your browser may block storage, or it is full.',
  // Added after a saved or copied recipe when the oldest were removed; {max} is the limit
  'ui-dialogs.recipes.toast.dropped.one': 'The oldest recipe was removed. At most {max} recipes are kept.',
  'ui-dialogs.recipes.toast.dropped.other': 'The {count} oldest recipes were removed. At most {max} recipes are kept.',
  'ui-dialogs.recipes.toast.opened': 'Opened “{name}”.',
  'ui-dialogs.recipes.toast.openFailed': 'This recipe could not be opened.',
  'ui-dialogs.recipes.toast.renamed': 'Renamed to “{name}”.',
  'ui-dialogs.recipes.toast.renameFailed': 'Could not rename the recipe.',
  'ui-dialogs.recipes.toast.duplicated': 'Saved a copy as “{name}”.',
  'ui-dialogs.recipes.toast.duplicateFailed': 'Could not copy the recipe. Your browser may block storage, or it is full.',
  'ui-dialogs.recipes.toast.deleted': 'Deleted “{name}”.',
  'ui-dialogs.recipes.toast.deleteFailed': 'Could not delete the recipe.',
  'ui-dialogs.recipes.toast.readFailed': 'This recipe could not be read.',
  'ui-dialogs.recipes.toast.linkCopied': 'Link to “{name}” copied.',
  'ui-dialogs.recipes.toast.linkFailed': 'Could not copy the link.',

  // Settings dialog
  'ui-dialogs.settings.description': 'Changes apply at once and are remembered in this browser.',
  'ui-dialogs.settings.theme': 'Theme',
  'ui-dialogs.settings.theme.system': 'System',
  'ui-dialogs.settings.theme.light': 'Light',
  'ui-dialogs.settings.theme.dark': 'Dark',
  'ui-dialogs.settings.theme.hint': 'System follows the light or dark setting of your device.',
  'ui-dialogs.settings.language': 'Language',
  // Language names, each in its own language (not translated)
  'ui-dialogs.settings.language.en': 'English',
  'ui-dialogs.settings.language.de': 'Deutsch',
  'ui-dialogs.settings.units': 'Units',
  'ui-dialogs.settings.units.metric': 'Metric',
  'ui-dialogs.settings.units.imperial': 'Imperial',
  'ui-dialogs.settings.units.hint.metric': 'Body mass in kg, height in cm, temperature in °C, speed in km/h, fluid in ml.',
  'ui-dialogs.settings.units.hint.imperial': 'Body mass in lb, height in ft and in, temperature in °F, speed in mph, fluid in US fl oz.',
  'ui-dialogs.settings.units.nutrients': 'Carbs, sodium and caffeine stay in g and mg, as in sports nutrition.',
  'ui-dialogs.settings.currency': 'Currency',
  // Short currency labels (visible), then the full names, added for screen readers after the label
  // ("€ EUR (Euro)"), so the accessible name starts with the visible text
  'ui-dialogs.settings.currency.EUR': '€ EUR',
  'ui-dialogs.settings.currency.USD': '$ USD',
  'ui-dialogs.settings.currency.GBP': '£ GBP',
  'ui-dialogs.settings.currency.name.EUR': 'Euro',
  'ui-dialogs.settings.currency.name.USD': 'US dollar',
  'ui-dialogs.settings.currency.name.GBP': 'Pound sterling',
  // Screen-reader text after a short label; {name} is one of the full names above
  'ui-dialogs.settings.currency.spoken': '({name})',
  'ui-dialogs.settings.currency.hint': 'Used for the rough cost estimate.',
  'ui-dialogs.settings.done': 'Done',

  // Gel template prose from src/constants/templates.js (see the module comment), by template id
  // GU Energy Gel
  'ui-dialogs.templates.data.gu-energy-gel.description':
    'Maltodextrin and fructose with 450 mg amino acids. Numbers for Strawberry Banana, a caffeine-free flavor.',
  'ui-dialogs.templates.data.gu-energy-gel.otherIngredients':
    'Water, L-leucine, potassium citrate, sodium citrate, citric acid, malic acid, calcium carbonate, sea salt, L-valine, natural flavors, gellan gum, L-isoleucine, sunflower oil, sodium benzoate (preservative), potassium sorbate (preservative), fruit and vegetable juice (for color)',
  'ui-dialogs.templates.data.gu-energy-gel.notes':
    'Carbohydrates in label order: maltodextrin, fructose. Water sits between them on the label. GU does not publish the maltodextrin to fructose split. The 1:0.33 ratio is an estimate. Retailers quote a blend of 70–80% maltodextrin and 20–30% fructose, and the label shows only 7–8 g sugars per gel, so fructose is at most about 7 g of 23 g. Sodium and carbs differ by label version. The Flavor Mix panel shows 23 g and 55 mg; the single-flavor panels show 22–23 g and 55–65 mg. The GU product page states 60–125 mg sodium across flavors, with salted flavors at the top. The label lists sodium citrate and sea salt, so the sodium salt setting is a mix. Carbs are 21–23 g depending on flavor. Caffeinated flavors add 20–40 mg. The ingredient list comes from retailer listings of the Strawberry Banana label.',
  'ui-dialogs.templates.data.gu-energy-gel.source.0': 'Manufacturer product page',
  'ui-dialogs.templates.data.gu-energy-gel.source.1': 'Running Warehouse nutrition panels (Strawberry Banana 24-pack)',
  'ui-dialogs.templates.data.gu-energy-gel.source.2': 'Running Warehouse nutrition panel (Flavor Mix, Strawberry Banana)',
  'ui-dialogs.templates.data.gu-energy-gel.source.3': 'REI ingredient list (Strawberry Banana)',
  'ui-dialogs.templates.data.gu-energy-gel.source.4': 'Bicycle Warehouse ingredient list (Strawberry Banana)',
  // Honey Stinger Organic Energy Gel
  'ui-dialogs.templates.data.honey-stinger-organic-energy-gel.description':
    'Organic tapioca syrup and honey. Numbers for Fruit Smoothie, a caffeine-free flavor.',
  'ui-dialogs.templates.data.honey-stinger-organic-energy-gel.otherIngredients':
    'Potassium citrate, salt, organic natural flavor, citric acid, water',
  'ui-dialogs.templates.data.honey-stinger-organic-energy-gel.notes':
    'Carbohydrates in label order: organic tapioca syrup, organic honey. Honey Stinger does not state a ratio. Tapioca syrup is a glucose syrup, so only the honey adds fructose. With 11 g sugars in 24 g carbs, honey supplies roughly 4–8 g of the carbs, which puts fructose near 2–4 g per gel. The 1:0.15 ratio is the middle of that estimate. The nutrition panel was read from a retailer; the manufacturer page confirmed the ingredients only. Caffeinated flavors add 32–70 mg. Electrolyte flavors add about 100 mg sodium.',
  'ui-dialogs.templates.data.honey-stinger-organic-energy-gel.source.0': 'Manufacturer product page (Fruit Smoothie)',
  'ui-dialogs.templates.data.honey-stinger-organic-energy-gel.source.1': 'H-E-B nutrition panel (Fruit Smoothie)',
  // Maurten Gel 100
  'ui-dialogs.templates.data.maurten-gel-100.description':
    'Hydrogel of glucose and fructose at 1:0.8. No flavors, colors or preservatives.',
  'ui-dialogs.templates.data.maurten-gel-100.otherIngredients':
    'Water, sodium alginate, gluconic acid, calcium carbonate',
  'ui-dialogs.templates.data.maurten-gel-100.notes':
    'Carbohydrates in label order: glucose, fructose. Maurten states the 0.8:1 fructose to glucose ratio. Sodium is 20 mg on the US label. EU labels list 0.085 g salt per 40 g gel, which is about 34 mg sodium. The sodium comes from sodium alginate. There is no added salt, so the sodium salt setting is only a default. Gel 100 Caf 100 adds 100 mg caffeine.',
  'ui-dialogs.templates.data.maurten-gel-100.source.0': 'Manufacturer product page',
  'ui-dialogs.templates.data.maurten-gel-100.source.1': 'Manufacturer product FAQ',
  'ui-dialogs.templates.data.maurten-gel-100.source.2': 'Running Warehouse nutrition panel (US label)',
  'ui-dialogs.templates.data.maurten-gel-100.source.3': 'Bikable nutrition panel (EU label)',
  // BPN Go Gel Endurance
  'ui-dialogs.templates.data.bpn-go-gel-endurance.description':
    'Apple juice concentrate and brown rice syrup. Numbers for Apple Cinnamon.',
  'ui-dialogs.templates.data.bpn-go-gel-endurance.otherIngredients':
    'Purified water, lemon juice concentrate, sea salt, ground cinnamon',
  'ui-dialogs.templates.data.bpn-go-gel-endurance.notes':
    'Carbohydrates in label order: apple juice concentrate, brown rice syrup, apple puree. BPN does not state a ratio. The 1:0.8 ratio is derived from the label. 20 g of the 24 g carbs are sugars, and brown rice syrup is about half sugars, so fruit supplies about 16 g and rice syrup about 8 g. Apple sugars are roughly two thirds fructose, which gives about 10–11 g fructose per gel (1:0.7–0.9). Apple puree is counted with the juice concentrate. The manufacturer page could not be found, so all values come from retailer panels. The caffeinated version adds 75 mg. Other flavors use other fruit juices, so their ratio may differ.',
  'ui-dialogs.templates.data.bpn-go-gel-endurance.source.0': 'Vitacost listing (Apple Cinnamon panel and ingredients)',
  'ui-dialogs.templates.data.bpn-go-gel-endurance.source.1': 'H-E-B nutrition panel (Apple Cinnamon)',
  // SiS GO Isotonic Energy Gel
  'ui-dialogs.templates.data.sis-go-isotonic-energy-gel.description':
    'Isotonic 60 ml gel. Maltodextrin only, no fructose. Numbers for Orange.',
  'ui-dialogs.templates.data.sis-go-isotonic-energy-gel.otherIngredients':
    'Water, gelling agents (gellan gum, xanthan gum), natural flavouring, acidity regulators (citric acid, sodium citrate), preservatives (sodium benzoate, potassium sorbate), sweetener (acesulfame K), sodium chloride',
  'ui-dialogs.templates.data.sis-go-isotonic-energy-gel.notes':
    'Carbohydrates in label order: maltodextrin (33%). Water comes first on the label. Maltodextrin is the only carbohydrate, so the ratio is glucose only. Sodium is a trace. UK panels list 0.01 g salt per gel, which is about 4 mg sodium. Some flavors list 0.04 g salt, about 16 mg sodium. Minor ingredients vary by flavor. The separate GO Energy + Electrolyte gel has about 118 mg sodium.',
  'ui-dialogs.templates.data.sis-go-isotonic-energy-gel.source.0': 'Manufacturer product page',
  'ui-dialogs.templates.data.sis-go-isotonic-energy-gel.source.1': 'Tesco nutrition panel (Orange)',
  'ui-dialogs.templates.data.sis-go-isotonic-energy-gel.source.2': 'Snow+Rock ingredient list (Orange)',
  // Precision Fuel & Hydration PF 30 Gel
  'ui-dialogs.templates.data.pf-30-gel.description':
    '30 g carbs in a 51 g gel. Maltodextrin and fructose at 2:1, no electrolytes.',
  'ui-dialogs.templates.data.pf-30-gel.otherIngredients':
    'Water, pectin, citric acid, potassium sorbate, calcium lactate',
  'ui-dialogs.templates.data.pf-30-gel.notes':
    'Carbohydrates in label order: maltodextrin, fructose. Water sits between them on the label. PF&H states the 2:1 glucose to fructose ratio. The Feed panel lists 30 g carbs, 0 mg sodium and 0 mg caffeine. The ingredients contain no sodium source, and PF&H sells the gel to be paired with separate electrolytes. The sodium salt setting is only a default. The PF 30 Caffeine Gel adds 100 mg caffeine.',
  'ui-dialogs.templates.data.pf-30-gel.source.0': 'Manufacturer product page',
  'ui-dialogs.templates.data.pf-30-gel.source.1': 'Steed Cycles nutrition panel and ingredients',
  'ui-dialogs.templates.data.pf-30-gel.source.2': 'The Feed nutrition panel',
  // GU Roctane Ultra Endurance Energy Gel
  'ui-dialogs.templates.data.gu-roctane-energy-gel.description':
    'Higher-sodium GU with 1425 mg amino acids, taurine and beta-alanine. Numbers for Strawberry Kiwi, a caffeine-free flavor.',
  'ui-dialogs.templates.data.gu-roctane-energy-gel.otherIngredients':
    'Water, amino acids (leucine, valine, isoleucine), taurine, sodium citrate, natural flavors, malic acid, citric acid, calcium carbonate, beta-alanine, sea salt, potassium citrate, medium-chain triglycerides, gellan gum, preservatives (sodium benzoate, potassium sorbate)',
  'ui-dialogs.templates.data.gu-roctane-energy-gel.notes':
    'Carbohydrates in label order: maltodextrin, fructose. Water sits between them on the label. GU does not publish the maltodextrin to fructose split. The 1:0.33 ratio is an estimate based on the same blend as GU Energy Gel. About 6 g of the 21 g carbs are sugars, so fructose is at most about 6 g. GU now states 19–21 g carbs and 125–180 mg sodium across flavors. Caffeinated flavors add 35 or 70 mg. Retailer listings disagree on the minor ingredients, so their order is not confirmed.',
  'ui-dialogs.templates.data.gu-roctane-energy-gel.source.0': 'Manufacturer product page',
  'ui-dialogs.templates.data.gu-roctane-energy-gel.source.1': 'MEC nutrition panel (Strawberry Kiwi)',
  'ui-dialogs.templates.data.gu-roctane-energy-gel.source.2': 'REI ingredient list',
  // UnTapped Maple Syrup Energy Gel
  'ui-dialogs.templates.data.untapped-maple-syrup-gel.description':
    'One ingredient: organic Vermont maple syrup. Numbers for the original Maple flavor.',
  'ui-dialogs.templates.data.untapped-maple-syrup-gel.notes':
    'Carbohydrates in label order: organic pure Vermont maple syrup. Maple syrup sugar is mostly sucrose, which splits evenly into glucose and fructose, so the ratio is 1:1. That is the most fructose the calculator accepts. Sodium is 5 mg and potassium 80–85 mg per 38 g packet, depending on the panel. There is no added salt, so the sodium salt setting is only a default. Salted flavors have 60–100 mg sodium from sea salt. The Coffee flavor adds 27 mg caffeine.',
  'ui-dialogs.templates.data.untapped-maple-syrup-gel.source.0': 'Manufacturer product page (Maple)',
  'ui-dialogs.templates.data.untapped-maple-syrup-gel.source.1': 'The Feed nutrition panel (Maple)',
  'ui-dialogs.templates.data.untapped-maple-syrup-gel.source.2': 'Manufacturer product page (Salted Raspberry, 60 mg sodium)',
  'ui-dialogs.templates.data.untapped-maple-syrup-gel.source.3': 'Manufacturer product page (Salted Citrus, 100 mg sodium)',
};

export default uiDialogs;
