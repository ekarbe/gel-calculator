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
 * German UI text for the dialogs (`src/components/dialogs/*`): mixing
 * steps, share (link and recipe image), gel templates, My recipes and
 * settings. Same keys and placeholders as `../en/ui-dialogs.js` (a parity
 * test checks it); see there for what each placeholder holds.
 *
 * The `ui-dialogs.templates.data.*` keys translate the prose of the gel
 * templates in `src/constants/templates.js`. Product, flavour, brand and
 * retailer names stay as they are.
 * @type {Record<string, string>}
 */
const uiDialogs = {
  // Dialog titles (headings and accessible names)
  'ui-dialogs.mixing.title': 'Zubereitung',
  'ui-dialogs.share.title': 'Teilen',
  'ui-dialogs.share.imageTitle': 'Rezeptbild',
  'ui-dialogs.templates.title': 'Gelvorlagen',
  'ui-dialogs.recipes.title': 'Meine Rezepte',
  'ui-dialogs.settings.title': 'Einstellungen',

  // Unit after a big number (the delivered carbs)
  'ui-dialogs.unit.g': 'g',
  // Recipe section headings
  'ui-dialogs.section.gel': 'Gels',
  'ui-dialogs.section.drink': 'Getränk',
  // What a section's servings are; {bottles} is a bottle count (ui-recipe.servings.bottles)
  'ui-dialogs.servings.gelNone': 'Keine Gels geplant',
  'ui-dialogs.servings.drinkNone': 'Keine Flaschen: keine Trinkmenge geplant',
  'ui-dialogs.servings.drinkFull': '{bottles} à {fill:volume}',
  'ui-dialogs.servings.drinkPartial': '{bottles} à {fill:volume} (Flaschengröße {size:volume})',
  // Caption of the amounts shown for a section (the per-serving captions come from the recipe catalog)
  'ui-dialogs.amounts.batch': 'Alle Gels',
  'ui-dialogs.amounts.allBottles': 'Alle Flaschen',
  'ui-dialogs.amounts.activity': 'Gesamte Dauer',
  // Osmolality and its tonicity band ({tonicity} from the concentration catalog)
  'ui-dialogs.osmo.withTonicity': '{value} · {tonicity}',
  'ui-dialogs.nothingToMix': 'Für diesen Plan gibt es nichts zu mischen.',
  // Recipe formats (`format.type`)
  'ui-dialogs.format.gel': 'Gel',
  'ui-dialogs.format.drink': 'Getränk',
  'ui-dialogs.format.both': 'Gel + Getränk',

  // Mixing steps dialog
  // Accessible name of the dialog's content (a focusable group, so the keyboard can scroll it)
  'ui-dialogs.mixing.content': 'Rezept und Schritte',
  'ui-dialogs.mixing.totalCarbs': 'Kohlenhydrate gesamt',
  // Under the delivered carbs when the ingredients cannot reach the target; {target} is a number of grams
  'ui-dialogs.mixing.ofTarget': 'von {target} g Ziel',
  'ui-dialogs.mixing.noCarbs': 'Dieser Plan hat keine Kohlenhydrate, daher gibt es keine Gels zu machen.',
  'ui-dialogs.mixing.rinse': 'Mundspülung als Option.',
  // Screen-reader prefix of a step heading ("Schritt 1: Zutaten abwiegen"); the number shows as a badge
  'ui-dialogs.mixing.step': 'Schritt {number}:',
  // Accessible name of a section's list of steps; {title} is the section heading
  'ui-dialogs.mixing.steps': 'Schritte: {title}',
  // What to drink during the activity, from the plan and the schedule. {rate} is one of the two rate texts.
  'ui-dialogs.mixing.during.title': 'Während der Belastung',
  'ui-dialogs.mixing.during.rate': 'Trink etwa {mlPerHour:volume}/h',
  'ui-dialogs.mixing.during.rateBottles': 'Trink etwa {mlPerHour:volume}/h aus deinen Flaschen',
  'ui-dialogs.mixing.during.withGel':
    '{rate}: etwa {ml:volume} zu jedem Gel. Der Zeitplan nennt die Menge für jedes Gel.',
  // {interval} is the minutes between two sips of the schedule
  'ui-dialogs.mixing.during.withSip': '{rate}: etwa {ml:volume} alle {interval} min. Der Zeitplan führt jeden Schluck auf.',
  'ui-dialogs.mixing.during.plain': '{rate}.',
  'ui-dialogs.mixing.during.takeGels': 'Nimm jedes Gel zu der Zeit, die im Zeitplan steht.',
  'ui-dialogs.mixing.during.noFluid': 'Dieser Plan hat keine Trinkmenge.',
  'ui-dialogs.mixing.during.thirst': 'Bei diesem Event klappt auch Trinken nach Durst.',
  'ui-dialogs.mixing.done': 'Verstanden',

  // Share dialog: link
  'ui-dialogs.share.description': 'Schick diesen Plan als Link oder speichere ein Bild des Rezepts.',
  'ui-dialogs.share.link.heading': 'Link',
  'ui-dialogs.share.link.label': 'Link zum Teilen',
  'ui-dialogs.share.link.hint':
    'Öffnet diesen Plan mit allen Eingaben. Sprache, Einheiten und Währung bleiben so, wie jede Person sie eingestellt hat.',
  'ui-dialogs.share.copy': 'Link kopieren',
  // Share dialog: image
  'ui-dialogs.share.image.heading': 'Bild',
  'ui-dialogs.share.image.text': 'Ein Bild der Ziele und des Rezepts zum Speichern oder Verschicken.',
  'ui-dialogs.share.image.open': 'Bild erstellen',
  'ui-dialogs.share.back': 'Zurück',
  'ui-dialogs.share.download': 'Herunterladen',
  // File name of the downloaded image
  'ui-dialogs.share.fileName': 'gel-rezept.png',
  'ui-dialogs.share.toast.copied': 'Rezeptlink kopiert.',
  'ui-dialogs.share.toast.copyFailed': 'Der Link ließ sich nicht kopieren.',
  'ui-dialogs.share.toast.downloaded': 'Bild heruntergeladen.',
  'ui-dialogs.share.toast.imageFailed': 'Das Bild ließ sich nicht erstellen.',
  // The recipe image (its event line is the board's summary, ui-board.summary)
  'ui-dialogs.share.image.label': 'Vorschau des Rezeptbilds',
  'ui-dialogs.share.image.wordmark': 'Gel Calculator',
  'ui-dialogs.share.image.totalCarbs': 'Kohlenhydrate gesamt',
  'ui-dialogs.share.image.carbsPerHour': 'Kohlenhydrate pro Stunde',
  'ui-dialogs.share.image.ratio': 'Verhältnis',
  'ui-dialogs.share.image.gramsPerHour': '{value} g/h',
  'ui-dialogs.share.image.sodium': 'Natrium',
  // {value} is a number in the locale's format
  'ui-dialogs.share.image.mgPerHour': '{value} mg/h',
  'ui-dialogs.share.image.fluid': 'Trinkmenge',
  'ui-dialogs.share.image.mlPerHour': '{mlPerHour:volume}/h',
  // The caffeine of the whole activity (its amount is an `amount.mg`)
  'ui-dialogs.share.image.caffeine': 'Koffein',
  'ui-dialogs.share.image.viewTotal': 'Gesamt · {hours} h',
  'ui-dialogs.share.image.viewPerServing': 'Pro Portion',
  // Accessible name of a section's lines; {title} is the section heading
  'ui-dialogs.share.image.lines': 'Rezept: {title}',
  // Screen-reader text of a carb line's bar
  'ui-dialogs.share.image.share': '{pct:percent} der Kohlenhydrate',
  'ui-dialogs.share.image.footer': 'eikekarbe.com/gel-calculator',

  // Gel templates dialog
  'ui-dialogs.templates.description':
    'Eine Vorlage übernimmt Zuckerverhältnis, Kohlenhydratquellen und Natriumsalz eines Fertiggels. Deine Ziele für Kohlenhydrate und Natrium bleiben gleich.',
  'ui-dialogs.templates.list': 'Vorlagen',
  'ui-dialogs.templates.ratio': 'Verhältnis {ratio:ratio}',
  'ui-dialogs.templates.inspired': 'Inspiriert von {brand}; keine Verbindung zur Marke',
  'ui-dialogs.templates.verified': 'Etikett geprüft',
  'ui-dialogs.templates.notVerified': 'Etikett nicht geprüft',
  'ui-dialogs.templates.estimates': 'Einige Werte sind Schätzungen. Welche, steht in den Hinweisen zum Etikett.',
  'ui-dialogs.templates.perGel': 'Pro Gel',
  'ui-dialogs.templates.carbs': 'Kohlenhydrate',
  'ui-dialogs.templates.sodium': 'Natrium',
  'ui-dialogs.templates.caffeine': 'Koffein',
  'ui-dialogs.templates.carbSources': 'Kohlenhydratquellen',
  'ui-dialogs.templates.otherIngredients': 'Weitere Zutaten',
  'ui-dialogs.templates.none': 'Keine',
  'ui-dialogs.templates.notes': 'Hinweise zum Etikett',
  'ui-dialogs.templates.sources': 'Quellen',
  // After a source link: when it was checked; {date} is a month ("Okt. 2026")
  'ui-dialogs.templates.checked': '(geprüft {date})',
  // {gPerHour} is the plan's carb target, {count} the gels per hour the template gives
  'ui-dialogs.templates.rate.one': 'Bei {gPerHour} g/h: {count} Gel pro Stunde',
  'ui-dialogs.templates.rate.other': 'Bei {gPerHour} g/h: {count} Gels pro Stunde',
  'ui-dialogs.templates.use': 'Vorlage nutzen',
  // Accessible name of the "Use template" button
  'ui-dialogs.templates.useNamed': 'Vorlage nutzen: {name}',
  'ui-dialogs.templates.applied': 'Vorlage {name} übernommen.',

  // My recipes dialog
  'ui-dialogs.recipes.description':
    'Rezepte werden nur in diesem Browser gespeichert, und Safari löscht sie nach etwa einer Woche ohne Besuch. Kopiere einen Link, um ein Rezept zu behalten oder auf einem anderen Gerät zu nutzen.',
  'ui-dialogs.recipes.save.heading': 'Aktuellen Plan speichern',
  // {summary} is a recipe summary (below)
  'ui-dialogs.recipes.current': 'Aktueller Plan: {summary}',
  'ui-dialogs.recipes.name': 'Name',
  'ui-dialogs.recipes.namePlaceholder': 'z. B. Lange Ausfahrt, heißer Tag',
  'ui-dialogs.recipes.nameHint': 'Bis zu {max} Zeichen. Ohne Namen wird es als „{untitled}“ gespeichert.',
  'ui-dialogs.recipes.save': 'Speichern',
  // Name of a recipe saved or renamed without a name
  'ui-dialogs.recipes.untitled': 'Rezept ohne Namen',
  // Name of a duplicated recipe; {name} is the original name
  'ui-dialogs.recipes.copyName': '{name} (Kopie)',
  'ui-dialogs.recipes.list.heading': 'Gespeicherte Rezepte',
  'ui-dialogs.recipes.count': '{count} von {max}',
  'ui-dialogs.recipes.empty': 'Noch keine gespeicherten Rezepte. Speichere den aktuellen Plan, um ihn später hier zu finden.',
  // One-line summary of a plan: "3:00 h · 75 g/h · Gel" ({duration} as on the board)
  'ui-dialogs.recipes.summary': '{duration} · {gPerHour} g/h · {format}',
  'ui-dialogs.recipes.unreadable': 'Dieses Rezept lässt sich nicht lesen. Es stammt vielleicht aus einer neueren Version der App.',
  // When a recipe was saved; {time} is a date and time
  'ui-dialogs.recipes.saved': 'Gespeichert am {time}',
  // Row actions: visible text and the accessible name with the recipe's name
  'ui-dialogs.recipes.actions': 'Aktionen für {name}',
  'ui-dialogs.recipes.open': 'Öffnen',
  'ui-dialogs.recipes.openNamed': 'Öffnen: {name}',
  'ui-dialogs.recipes.rename': 'Umbenennen',
  'ui-dialogs.recipes.renameNamed': 'Umbenennen: {name}',
  'ui-dialogs.recipes.duplicate': 'Duplizieren',
  'ui-dialogs.recipes.duplicateNamed': 'Duplizieren: {name}',
  'ui-dialogs.recipes.copyLink': 'Link kopieren',
  'ui-dialogs.recipes.copyLinkNamed': 'Link kopieren: {name}',
  'ui-dialogs.recipes.delete': 'Löschen',
  'ui-dialogs.recipes.deleteNamed': 'Löschen: {name}',
  // Inline rename form
  'ui-dialogs.recipes.newName': 'Neuer Name',
  'ui-dialogs.recipes.newNameFor': 'Neuer Name für {name}',
  'ui-dialogs.recipes.saveName': 'Namen speichern',
  'ui-dialogs.recipes.cancel': 'Abbrechen',
  'ui-dialogs.recipes.cancelRename': 'Umbenennen abbrechen',
  // Inline delete confirmation
  'ui-dialogs.recipes.confirmDelete': '„{name}“ löschen? Das lässt sich nicht rückgängig machen.',
  'ui-dialogs.recipes.yesDelete': 'Ja, löschen',
  'ui-dialogs.recipes.keep': 'Behalten',
  // Opens the gel templates dialog
  'ui-dialogs.recipes.templates': 'Mit einer Gelvorlage starten',
  // Toasts
  'ui-dialogs.recipes.toast.saved': '„{name}“ gespeichert.',
  'ui-dialogs.recipes.toast.saveFailed':
    'Das Rezept ließ sich nicht speichern. Dein Browser blockiert vielleicht den Speicher, oder er ist voll.',
  // Added after a saved or copied recipe when the oldest were removed; {max} is the limit
  'ui-dialogs.recipes.toast.dropped.one': 'Das älteste Rezept wurde entfernt. Es werden höchstens {max} Rezepte gespeichert.',
  'ui-dialogs.recipes.toast.dropped.other':
    'Die {count} ältesten Rezepte wurden entfernt. Es werden höchstens {max} Rezepte gespeichert.',
  'ui-dialogs.recipes.toast.opened': '„{name}“ geöffnet.',
  'ui-dialogs.recipes.toast.openFailed': 'Dieses Rezept ließ sich nicht öffnen.',
  'ui-dialogs.recipes.toast.renamed': 'Umbenannt in „{name}“.',
  'ui-dialogs.recipes.toast.renameFailed': 'Das Rezept ließ sich nicht umbenennen.',
  'ui-dialogs.recipes.toast.duplicated': 'Kopie als „{name}“ gespeichert.',
  'ui-dialogs.recipes.toast.duplicateFailed':
    'Das Rezept ließ sich nicht kopieren. Dein Browser blockiert vielleicht den Speicher, oder er ist voll.',
  'ui-dialogs.recipes.toast.deleted': '„{name}“ gelöscht.',
  'ui-dialogs.recipes.toast.deleteFailed': 'Das Rezept ließ sich nicht löschen.',
  'ui-dialogs.recipes.toast.readFailed': 'Dieses Rezept ließ sich nicht lesen.',
  'ui-dialogs.recipes.toast.linkCopied': 'Link zu „{name}“ kopiert.',
  'ui-dialogs.recipes.toast.linkFailed': 'Der Link ließ sich nicht kopieren.',

  // Settings dialog
  'ui-dialogs.settings.description': 'Änderungen gelten sofort und werden in diesem Browser gespeichert.',
  'ui-dialogs.settings.theme': 'Design',
  'ui-dialogs.settings.theme.system': 'System',
  'ui-dialogs.settings.theme.light': 'Hell',
  'ui-dialogs.settings.theme.dark': 'Dunkel',
  'ui-dialogs.settings.theme.hint': '„System“ folgt der Hell- oder Dunkel-Einstellung deines Geräts.',
  'ui-dialogs.settings.language': 'Sprache',
  // Language names, each in its own language (not translated)
  'ui-dialogs.settings.language.en': 'English',
  'ui-dialogs.settings.language.de': 'Deutsch',
  'ui-dialogs.settings.units': 'Einheiten',
  'ui-dialogs.settings.units.metric': 'Metrisch',
  'ui-dialogs.settings.units.imperial': 'Imperial',
  'ui-dialogs.settings.units.hint.metric':
    'Körpergewicht in kg, Körpergröße in cm, Temperatur in °C, Geschwindigkeit in km/h, Flüssigkeit in ml.',
  'ui-dialogs.settings.units.hint.imperial':
    'Körpergewicht in lb, Körpergröße in ft und in, Temperatur in °F, Geschwindigkeit in mph, Flüssigkeit in US fl oz.',
  'ui-dialogs.settings.units.nutrients': 'Kohlenhydrate, Natrium und Koffein bleiben in g und mg, wie in der Sporternährung üblich.',
  'ui-dialogs.settings.currency': 'Währung',
  // Short currency labels (visible), then the full names, added for screen readers after the label
  'ui-dialogs.settings.currency.EUR': '€ EUR',
  'ui-dialogs.settings.currency.USD': '$ USD',
  'ui-dialogs.settings.currency.GBP': '£ GBP',
  'ui-dialogs.settings.currency.name.EUR': 'Euro',
  'ui-dialogs.settings.currency.name.USD': 'US-Dollar',
  'ui-dialogs.settings.currency.name.GBP': 'Britisches Pfund',
  // Screen-reader text after a short label; {name} is one of the full names above
  'ui-dialogs.settings.currency.spoken': '({name})',
  'ui-dialogs.settings.currency.hint': 'Für die grobe Kostenschätzung.',
  'ui-dialogs.settings.done': 'Fertig',

  // Gel template prose from src/constants/templates.js, by template id
  // GU Energy Gel
  'ui-dialogs.templates.data.gu-energy-gel.description':
    'Maltodextrin und Fruktose mit 450 mg Aminosäuren. Werte für Strawberry Banana, eine Sorte ohne Koffein.',
  'ui-dialogs.templates.data.gu-energy-gel.otherIngredients':
    'Wasser, L-Leucin, Kaliumcitrat, Natriumcitrat, Zitronensäure, Äpfelsäure, Calciumcarbonat, Meersalz, L-Valin, natürliche Aromen, Gellan, L-Isoleucin, Sonnenblumenöl, Natriumbenzoat (Konservierungsstoff), Kaliumsorbat (Konservierungsstoff), Frucht- und Gemüsesaft (zur Färbung)',
  'ui-dialogs.templates.data.gu-energy-gel.notes':
    'Kohlenhydrate in der Reihenfolge des Etiketts: Maltodextrin, Fruktose. Auf dem Etikett steht Wasser dazwischen. GU veröffentlicht die Aufteilung zwischen Maltodextrin und Fruktose nicht. Das Verhältnis 1:0,33 ist eine Schätzung. Händler nennen eine Mischung aus 70–80\u00a0% Maltodextrin und 20–30\u00a0% Fruktose, und das Etikett weist nur 7–8 g Zucker pro Gel aus, also sind höchstens etwa 7 g der 23 g Fruktose. Natrium und Kohlenhydrate unterscheiden sich je nach Etikettversion. Die Nährwerttabelle des Flavor Mix zeigt 23 g und 55 mg, die Tabellen der einzelnen Sorten 22–23 g und 55–65 mg. Die GU-Produktseite nennt je nach Sorte 60–125 mg Natrium, gesalzene Sorten am oberen Ende. Das Etikett nennt Natriumcitrat und Meersalz, daher steht die Einstellung für das Natriumsalz auf Mischung. Die Kohlenhydrate liegen je nach Sorte bei 21–23 g. Sorten mit Koffein enthalten zusätzlich 20–40 mg. Die Zutatenliste stammt aus Händlerangaben zum Etikett von Strawberry Banana.',
  'ui-dialogs.templates.data.gu-energy-gel.source.0': 'Produktseite des Herstellers',
  'ui-dialogs.templates.data.gu-energy-gel.source.1': 'Nährwerttabellen bei Running Warehouse (Strawberry Banana, 24er-Pack)',
  'ui-dialogs.templates.data.gu-energy-gel.source.2': 'Nährwerttabelle bei Running Warehouse (Flavor Mix, Strawberry Banana)',
  'ui-dialogs.templates.data.gu-energy-gel.source.3': 'Zutatenliste bei REI (Strawberry Banana)',
  'ui-dialogs.templates.data.gu-energy-gel.source.4': 'Zutatenliste bei Bicycle Warehouse (Strawberry Banana)',
  // Honey Stinger Organic Energy Gel
  'ui-dialogs.templates.data.honey-stinger-organic-energy-gel.description':
    'Bio-Tapiokasirup und Honig. Werte für Fruit Smoothie, eine Sorte ohne Koffein.',
  'ui-dialogs.templates.data.honey-stinger-organic-energy-gel.otherIngredients':
    'Kaliumcitrat, Salz, natürliches Bio-Aroma, Zitronensäure, Wasser',
  'ui-dialogs.templates.data.honey-stinger-organic-energy-gel.notes':
    'Kohlenhydrate in der Reihenfolge des Etiketts: Bio-Tapiokasirup, Bio-Honig. Honey Stinger nennt kein Verhältnis. Tapiokasirup ist ein Glukosesirup, also liefert nur der Honig Fruktose. Bei 11 g Zucker in 24 g Kohlenhydraten stammen etwa 4–8 g der Kohlenhydrate aus Honig, damit liegt die Fruktose bei etwa 2–4 g pro Gel. Das Verhältnis 1:0,15 ist die Mitte dieser Schätzung. Die Nährwerttabelle stammt von einem Händler; die Herstellerseite bestätigt nur die Zutaten. Sorten mit Koffein enthalten zusätzlich 32–70 mg. Elektrolyt-Sorten enthalten zusätzlich etwa 100 mg Natrium.',
  'ui-dialogs.templates.data.honey-stinger-organic-energy-gel.source.0': 'Produktseite des Herstellers (Fruit Smoothie)',
  'ui-dialogs.templates.data.honey-stinger-organic-energy-gel.source.1': 'Nährwerttabelle bei H-E-B (Fruit Smoothie)',
  // Maurten Gel 100
  'ui-dialogs.templates.data.maurten-gel-100.description':
    'Hydrogel aus Glukose und Fruktose im Verhältnis 1:0,8. Ohne Aromen, Farbstoffe und Konservierungsstoffe.',
  'ui-dialogs.templates.data.maurten-gel-100.otherIngredients':
    'Wasser, Natriumalginat, Gluconsäure, Calciumcarbonat',
  'ui-dialogs.templates.data.maurten-gel-100.notes':
    'Kohlenhydrate in der Reihenfolge des Etiketts: Glukose, Fruktose. Maurten nennt ein Verhältnis von 0,8:1 Fruktose zu Glukose. Das US-Etikett weist 20 mg Natrium aus. EU-Etiketten nennen 0,085 g Salz pro 40-g-Gel, das sind etwa 34 mg Natrium. Das Natrium stammt aus Natriumalginat. Es ist kein Salz zugesetzt, daher ist die Einstellung für das Natriumsalz nur ein Standardwert. Gel 100 Caf 100 enthält zusätzlich 100 mg Koffein.',
  'ui-dialogs.templates.data.maurten-gel-100.source.0': 'Produktseite des Herstellers',
  'ui-dialogs.templates.data.maurten-gel-100.source.1': 'Produkt-FAQ des Herstellers',
  'ui-dialogs.templates.data.maurten-gel-100.source.2': 'Nährwerttabelle bei Running Warehouse (US-Etikett)',
  'ui-dialogs.templates.data.maurten-gel-100.source.3': 'Nährwerttabelle bei Bikable (EU-Etikett)',
  // BPN Go Gel Endurance
  'ui-dialogs.templates.data.bpn-go-gel-endurance.description':
    'Apfelsaftkonzentrat und brauner Reissirup. Werte für Apple Cinnamon.',
  'ui-dialogs.templates.data.bpn-go-gel-endurance.otherIngredients':
    'Gereinigtes Wasser, Zitronensaftkonzentrat, Meersalz, gemahlener Zimt',
  'ui-dialogs.templates.data.bpn-go-gel-endurance.notes':
    'Kohlenhydrate in der Reihenfolge des Etiketts: Apfelsaftkonzentrat, brauner Reissirup, Apfelmark. BPN nennt kein Verhältnis. Das Verhältnis 1:0,8 ist aus dem Etikett abgeleitet. 20 g der 24 g Kohlenhydrate sind Zucker, und brauner Reissirup besteht etwa zur Hälfte aus Zucker, also liefert das Obst etwa 16 g und der Reissirup etwa 8 g. Apfelzucker ist etwa zu zwei Dritteln Fruktose, das ergibt etwa 10–11 g Fruktose pro Gel (1:0,7–0,9). Das Apfelmark ist beim Saftkonzentrat mitgezählt. Die Herstellerseite war nicht auffindbar, daher stammen alle Werte aus Händlerangaben. Die Version mit Koffein enthält zusätzlich 75 mg. Andere Sorten nutzen andere Fruchtsäfte, ihr Verhältnis kann also abweichen.',
  'ui-dialogs.templates.data.bpn-go-gel-endurance.source.0': 'Angebot bei Vitacost (Nährwerttabelle und Zutaten von Apple Cinnamon)',
  'ui-dialogs.templates.data.bpn-go-gel-endurance.source.1': 'Nährwerttabelle bei H-E-B (Apple Cinnamon)',
  // SiS GO Isotonic Energy Gel
  'ui-dialogs.templates.data.sis-go-isotonic-energy-gel.description':
    'Isotones 60-ml-Gel. Nur Maltodextrin, keine Fruktose. Werte für Orange.',
  'ui-dialogs.templates.data.sis-go-isotonic-energy-gel.otherIngredients':
    'Wasser, Geliermittel (Gellan, Xanthan), natürliches Aroma, Säureregulatoren (Zitronensäure, Natriumcitrat), Konservierungsstoffe (Natriumbenzoat, Kaliumsorbat), Süßungsmittel (Acesulfam K), Natriumchlorid',
  'ui-dialogs.templates.data.sis-go-isotonic-energy-gel.notes':
    'Kohlenhydrate in der Reihenfolge des Etiketts: Maltodextrin (33\u00a0%). Auf dem Etikett steht Wasser an erster Stelle. Maltodextrin ist das einzige Kohlenhydrat, daher besteht das Verhältnis nur aus Glukose. Natrium ist nur in Spuren enthalten. Britische Nährwerttabellen nennen 0,01 g Salz pro Gel, das sind etwa 4 mg Natrium. Einige Sorten nennen 0,04 g Salz, etwa 16 mg Natrium. Kleinere Zutaten unterscheiden sich je nach Sorte. Das separate GO Energy + Electrolyte Gel enthält etwa 118 mg Natrium.',
  'ui-dialogs.templates.data.sis-go-isotonic-energy-gel.source.0': 'Produktseite des Herstellers',
  'ui-dialogs.templates.data.sis-go-isotonic-energy-gel.source.1': 'Nährwerttabelle bei Tesco (Orange)',
  'ui-dialogs.templates.data.sis-go-isotonic-energy-gel.source.2': 'Zutatenliste bei Snow+Rock (Orange)',
  // Precision Fuel & Hydration PF 30 Gel
  'ui-dialogs.templates.data.pf-30-gel.description':
    '30 g Kohlenhydrate in einem 51-g-Gel. Maltodextrin und Fruktose im Verhältnis 2:1, keine Elektrolyte.',
  'ui-dialogs.templates.data.pf-30-gel.otherIngredients':
    'Wasser, Pektin, Zitronensäure, Kaliumsorbat, Calciumlactat',
  'ui-dialogs.templates.data.pf-30-gel.notes':
    'Kohlenhydrate in der Reihenfolge des Etiketts: Maltodextrin, Fruktose. Auf dem Etikett steht Wasser dazwischen. PF&H nennt ein Verhältnis von 2:1 Glukose zu Fruktose. Die Nährwerttabelle bei The Feed nennt 30 g Kohlenhydrate, 0 mg Natrium und 0 mg Koffein. Die Zutaten enthalten keine Natriumquelle, und PF&H verkauft das Gel zur Kombination mit separaten Elektrolyten. Die Einstellung für das Natriumsalz ist nur ein Standardwert. Das PF 30 Caffeine Gel enthält zusätzlich 100 mg Koffein.',
  'ui-dialogs.templates.data.pf-30-gel.source.0': 'Produktseite des Herstellers',
  'ui-dialogs.templates.data.pf-30-gel.source.1': 'Nährwerttabelle und Zutaten bei Steed Cycles',
  'ui-dialogs.templates.data.pf-30-gel.source.2': 'Nährwerttabelle bei The Feed',
  // GU Roctane Ultra Endurance Energy Gel
  'ui-dialogs.templates.data.gu-roctane-energy-gel.description':
    'GU mit mehr Natrium, 1425 mg Aminosäuren, Taurin und Beta-Alanin. Werte für Strawberry Kiwi, eine Sorte ohne Koffein.',
  'ui-dialogs.templates.data.gu-roctane-energy-gel.otherIngredients':
    'Wasser, Aminosäuren (Leucin, Valin, Isoleucin), Taurin, Natriumcitrat, natürliche Aromen, Äpfelsäure, Zitronensäure, Calciumcarbonat, Beta-Alanin, Meersalz, Kaliumcitrat, mittelkettige Triglyceride, Gellan, Konservierungsstoffe (Natriumbenzoat, Kaliumsorbat)',
  'ui-dialogs.templates.data.gu-roctane-energy-gel.notes':
    'Kohlenhydrate in der Reihenfolge des Etiketts: Maltodextrin, Fruktose. Auf dem Etikett steht Wasser dazwischen. GU veröffentlicht die Aufteilung zwischen Maltodextrin und Fruktose nicht. Das Verhältnis 1:0,33 ist eine Schätzung auf Basis derselben Mischung wie beim GU Energy Gel. Etwa 6 g der 21 g Kohlenhydrate sind Zucker, also sind höchstens etwa 6 g Fruktose. GU nennt inzwischen je nach Sorte 19–21 g Kohlenhydrate und 125–180 mg Natrium. Sorten mit Koffein enthalten zusätzlich 35 oder 70 mg. Händlerangaben zu den kleineren Zutaten widersprechen sich, ihre Reihenfolge ist daher nicht bestätigt.',
  'ui-dialogs.templates.data.gu-roctane-energy-gel.source.0': 'Produktseite des Herstellers',
  'ui-dialogs.templates.data.gu-roctane-energy-gel.source.1': 'Nährwerttabelle bei MEC (Strawberry Kiwi)',
  'ui-dialogs.templates.data.gu-roctane-energy-gel.source.2': 'Zutatenliste bei REI',
  // UnTapped Maple Syrup Energy Gel
  'ui-dialogs.templates.data.untapped-maple-syrup-gel.description':
    'Eine Zutat: Bio-Ahornsirup aus Vermont. Werte für die Originalsorte Maple.',
  'ui-dialogs.templates.data.untapped-maple-syrup-gel.notes':
    'Kohlenhydrate in der Reihenfolge des Etiketts: reiner Bio-Ahornsirup aus Vermont. Der Zucker im Ahornsirup ist größtenteils Saccharose, die sich zu gleichen Teilen in Glukose und Fruktose aufspaltet, daher ist das Verhältnis 1:1. Das ist der höchste Fruktoseanteil, den der Rechner akzeptiert. Pro 38-g-Beutel sind es je nach Nährwerttabelle 5 mg Natrium und 80–85 mg Kalium. Es ist kein Salz zugesetzt, daher ist die Einstellung für das Natriumsalz nur ein Standardwert. Gesalzene Sorten enthalten 60–100 mg Natrium aus Meersalz. Die Sorte Coffee enthält zusätzlich 27 mg Koffein.',
  'ui-dialogs.templates.data.untapped-maple-syrup-gel.source.0': 'Produktseite des Herstellers (Maple)',
  'ui-dialogs.templates.data.untapped-maple-syrup-gel.source.1': 'Nährwerttabelle bei The Feed (Maple)',
  'ui-dialogs.templates.data.untapped-maple-syrup-gel.source.2': 'Produktseite des Herstellers (Salted Raspberry, 60 mg Natrium)',
  'ui-dialogs.templates.data.untapped-maple-syrup-gel.source.3': 'Produktseite des Herstellers (Salted Citrus, 100 mg Natrium)',
};

export default uiDialogs;
