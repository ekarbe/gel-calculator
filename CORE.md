# Gel Calculator: Systems & Logic

This document describes how the calculator works **as implemented** at the end
of Phase 3. Every number below is the value the code uses. Where a rule is an
interim simplification, it says so and names the phase that replaces it.

## 1. Architecture

The app is a single-page Next.js app exported as static HTML (`output: 'export'`,
`basePath: '/gel-calculator'`) and deployed to GitHub Pages. All calculation
happens in the browser. There is no server. The inputs are autosaved in the
browser's `localStorage`, next to any recipes the user saves.

| Layer | Files | Role |
| --- | --- | --- |
| Data | `src/constants/constants.js`, `src/constants/templates.js` | Carb sources and salts (with osmolality and water data), sweat presets, commercial gel templates |
| Evidence | `src/domain/evidence.js` | Citation registry (`CITATIONS`, `citationLabel`, `citationUrl`) |
| Domain | `src/domain/{carbs,solver,heatBalance,sweat,hydration,electrolytes,concentration,caffeine,bicarbonate,schedule,recipe}.js` | One pure module per topic (plus `objects.js`, a plain-object check shared with the state layer) |
| Units, cost | `src/domain/units.js`, `src/domain/cost.js` | Metric ↔ imperial conversions; the cost estimate per currency (section 10.3) |
| Plan | `src/domain/plan.js` | Inputs schema v4 (with the v3 migration), `normalizeInputs`, `computePlan`, `templateToInputs` |
| Text | `src/i18n/{en,de}/*.js`, `src/i18n/{index,locales,formatters,format,useT}.js` | English and German catalogs, `createT`/`useT()`, locale- and unit-aware formatting (section 10.1) |
| State | `src/state/{PlanProvider.jsx,UiProvider.jsx,prefs.js,shareCodec.js,storage.js}` | Inputs reducer with autosave, memoised plan, UI state and prefs, share links, saved recipes |
| UI | `src/app/*`, `src/components/{ui,shell,setup,board,schedule,print,dialogs,guided}` | Primitives, the app shell, setup sections, race board, schedule, print view, dialogs, guided flow (section 10.4) |

### Data flow

```
                ┌──────── ?s= link / autosave (on mount) ────────┐
                ▼                                                │
inputs ──normalizeInputs──▶ PlanProvider state ──computePlan (useMemo)──▶ plan ──▶ components
   ▲                              │                                                  │
   │                              └── saveAutosave (400 ms after the last change)    │
   └──────── set(path, value) / apply(partial) / replace / reset / loadInputs ◀──────┘
```

`src/app/page.jsx` renders `PlanProvider > UiProvider > App`, and `App`
renders the shell (`src/components/shell/AppShell.jsx`). Components read
the inputs with `usePlanInputs()`, the plan with `usePlan()`, the UI state
and prefs with `useUi()`, text with `useT()` and number formatting with
`useFormat()`. They never compute nutrition themselves: every target, amount,
water volume, osmolality and comparison they show comes from the plan.
Components only format those numbers, convert units for display (lb, in,
°F, mph, fl oz) and draw bars. Every string a component shows, aria labels
included, comes from a catalog through `t()`; every number goes through the
locale's formatter (`createFormat` in `src/i18n/formatters.js`, which also
writes ratios with `formatRatio` from `src/domain/carbs.js`), so a value reads
the same on the board, in the dialogs, the share image and the printout.

### Domain rules

- `src/domain/**` is pure: no React, no DOM, no `window`, no clocks, no
  randomness, no I/O. The same input always gives the same output, and
  arguments are never mutated.
- Domain functions never return English text. They return message
  descriptors that `t()` turns into text:

  ```js
  /** @typedef {{ key: string, params?: Record<string, string|number> }} Message */
  /** @typedef {{ summary: Message, details?: Message[], citations: string[] }} Explanation */
  /** @typedef {{ id: string, level: 'info'|'warning'|'danger', message: Message, citations?: string[] }} Warning */
  ```

  Ingredient and salt labels are the exception: they are plain strings (the
  English source label, or the name the user typed for a custom one).
- Every recommendation carries a `why` (Explanation) with citation ids. The UI
  shows it behind a "Why?" disclosure (`src/components/ui/Why.jsx`) with links
  to the studies.
- Warning ids are stable (`carbs.aboveStudied`). Message keys are namespaced by
  module (`carbs.warn.aboveStudied`).
- Units: minutes for time, g, mg, ml, L/h, W, kcal, °C, kg, cm, km/h, %
  humidity. Rounding happens only where a rule says so: `round5` for g/h,
  `round10` for mg/h, `round50` for ml/h. Unit conversion (lb, °F, in) is a UI
  concern.
- Bad numbers never throw. Missing, NaN or negative values count as 0 (or the
  documented default) in every module.

## 2. Data

### Carbohydrate sources (`constants.js`)

```js
{ id, label, carbsPerGram, glucoseContent, fructoseContent, osmPerG, waterFraction, group }
```

- `carbsPerGram` is the available carbohydrate per gram *as purchased*
  (dextrose monohydrate 0.91, honey 0.82).
- `glucoseContent` and `fructoseContent` split that carbohydrate between the
  glucose (SGLT1) and fructose (GLUT5) pathways and always sum to 1. Sucrose is
  50/50; maltose and maltodextrin count as glucose.
- `osmPerG` is mOsm per gram as purchased (osmotic coefficient 1). Sugars:
  1000 ÷ molar mass (dextrose and fructose 5.55, sucrose 2.92). Starch
  hydrolysates: `DE ÷ 18.016` per dry gram (Mn = 18016 ÷ DE), so maltodextrin
  (DE 18) is 0.95, glucose syrup (DE 42, 80% dry solids) 1.86, HBCD 0.02.
- `waterFraction` is the water per gram as purchased (dextrose monohydrate
  0.091, honey 0.17, maple syrup 0.32). It dilutes a gel or drink like added
  water.
- `group` is `'powder'` (dextrose ×2, maltodextrin, maltose, HBCD, fructose,
  sucrose, coconut sugar) or `'syrup'` (the rest).
- `carbSourceOptions` lists every source once, powders first, for the
  ingredient picker. The Phase 1 lists `glucoseSourceOptions` (ids 1–8) and
  `fructoseSourceOptions` (ids 11–20) stay exported: the v3 migration and the
  templates still read them. A data test checks every source: finite
  `osmPerG ≥ 0`, `waterFraction` in [0, 1), contents summing to 1.

### Electrolyte sources (`constants.js`)

```js
{ id, label, components: [{ name, ratio }], osmPerG }
```

`ratio` is the mass fraction of the ion in the salt **as sold**, including
hydrate water (Epsom salt is MgSO₄·7H₂O, so Mg = 9.86%). There are no
absorption factors: guidance is stated as ingested amounts (sawka2007,
efsa2011), and mineral absorption varies too much to model per salt
(fine1991). `osmPerG` is the effective mOsm per gram (ions per formula unit ×
osmotic coefficient ÷ molar mass): table salt 31.8, potassium chloride 24.7,
sodium citrate 10.9, magnesium citrate 5.5, calcium citrate 0 (it barely
dissolves, about 1 g/L). Salt ids used by the rules: table salt 31, sodium
citrate dihydrate 33, magnesium citrate 34, calcium citrate 35, potassium
citrate 39.

### Sweat presets (`constants.js`)

- `SWEAT_RATES`: six self-assessed rates, 0.25–2.75 L/h.
- `ELECTROLYTE_CONCENTRATIONS.Sodium`: six saltiness levels, 15–90 mmol/L
  (measured range 10–90, mean about 40). Every sweat source uses the
  saltiness preset for sweat sodium.
- `SWEAT_RATE_DESCRIPTIONS`, `SALTINESS_DESCRIPTIONS`: the English hints shown
  next to each preset.

IDs are stable. Share links, autosaves, saved recipes and templates store ids;
labels are display text.

## 3. Inputs (schema v4)

`DEFAULT_INPUTS` in `src/domain/plan.js` (deep-frozen): a 3 h moderate ride at
30 km/h in 20 °C shade for a 70 kg, 175 cm athlete, with the heat-balance sweat
estimate and a 2:1 maltodextrin/fructose gel.

| Section | Field | Default | Allowed |
| --- | --- | --- | --- |
| `event` | `durationMin` | 180 | 0–2880 |
| | `intensity` | `'moderate'` | `easy`, `moderate`, `hard`, `race` |
| | `highCarb` | `false` | boolean |
| | `sport` | `'cycling'` | `running`, `cycling`, `other` |
| | `speedKmh` | 30 | 3–70 (running and cycling) |
| | `powerW` | 0 | 0–2000 (cycling; 0 = derive from the speed) |
| | `mets` | 8 | 1–20 (other sports; Compendium METs) |
| | `setting` | `'outdoor'` | `outdoor`, `indoorFan`, `indoorNoFan` |
| `athlete` | `massKg` | 70 | 30–200 |
| | `heightCm` | 175 | 120–220 |
| | `acclimatised` | `false` | boolean |
| `environment` | `tempC` | 20 | −20–50 |
| | `humidity` | 50 | 0–100 |
| | `sun` | `'none'` | `none`, `partly`, `full` |
| `sweat` | `source` | `'estimate'` | `test`, `estimate`, `preset` |
| | `rateIndex`, `saltinessIndex` | 2, 2 | integers 0–5 |
| | `tests` | `[]` | up to 20 `SweatTest` |
| | `selectedTestId` | `null` | id of a test; `null` = the last test |
| | `calibrate` | `true` | boolean |
| `carbs` | `mode`, `ratioMode` | `'auto'` | `auto`, `manual` |
| | `manualGPerHour` | 60 | 0–200 |
| | `manualRatio` | `{ glucose: 1, fructose: 0.8 }` | parts 0–5 |
| | `ingredients` | `[{ ref: 3, weight: 67 }, { ref: 11, weight: 33 }]` | carb source id or custom key; weight 0–100 |
| | `custom` | `[]` | up to 10 `CustomCarb` |
| `sodium` | `mode` / `manualMgPerHour` | `'auto'` / 500 | 0–5000 |
| `extras` | `potassium`, `magnesium`, `calcium` | `false` | boolean |
| `salts` | `mode` | `'auto'` | `auto`, `manual` |
| | `sodiumSalt` | `'table'` | `table`, `citrate`, `mix` |
| | `manual` | `[]` | `[{ ref, amountMg }]`, salt id or custom key, 0–1,100,000 mg for the whole activity |
| | `custom` | `[]` | up to 10 `CustomSalt` |
| `fluid` | `mode` / `manualMlPerHour` | `'auto'` / 500 | 0–3000, rounded to 0.01 |
| `format` | `type` | `'gel'` | `gel`, `drink`, `both` |
| | `gelsPerHour` | 3 | 0–12, rounded to 0.01 |
| | `view` | `'total'` | `total`, `perServing` |
| | `gelConsistency` | `'standard'` | `isotonic`, `liquid`, `standard`, `thick` |
| | `bottleMl` | 750 | 250–1500 |
| | `drinkCarbSharePct` | 50 | 0–100 (`both` only: % of the carbs in the drink) |
| `caffeine` | `enabled`, `asIngredient` | `false` | boolean |
| | `mgPerKg` | 3 | 1–6 |
| | `tabletMg` | 100 | 100 or 200 |
| `bicarb` | `enabled` / `gPerKg` | `false` / 0.3 | 0.2–0.3 |

List entries:

```js
SweatTest  = { id, date /* 'YYYY-MM-DD' or '' */, label /* ≤ 60 */, preKg, postKg, fluidL, urineL, durationMin,
               conditions: { sport, speedKmh, powerW, mets, setting, tempC, humidity, sun } }
CustomCarb = { key /* 'c1'..'c10' */, name /* ≤ 40 */, carbsPer100g, fructoseSharePct, waterPct? }   // % 0–100
CustomSalt = { key /* 's1'..'s10' */, name /* ≤ 40 */, sodiumPct, potassiumPct, magnesiumPct, calciumPct, chloridePct }
```

`INPUT_LIMITS` and `INPUT_OPTIONS` export these bounds (plus the test ranges
`testMassKg` 0–300, `testFluidL` and `testUrineL` 0–20, `testDurationMin`
0–1440, `labelPct` 0–100 and the list and text lengths) so the UI controls use
the same limits. The manual salt limit covers the largest amount the auto salts
can ask for (48 h at the 5000 mg/h manual sodium limit, all from sodium
citrate: about 1,023 g), so switching salts to Manual always starts from the
auto amounts unchanged.

`normalizeInputs(partial)` deep-merges any value onto the defaults and returns
a fresh, complete, valid object:

- Unknown keys are dropped. Numbers and numeric strings are clamped to the
  limits. Non-finite numbers and values of the wrong type fall back to the
  default for that field. Enums outside the allowed set fall back to the
  default.
- Ingredients whose `ref` is neither a carb source id nor the key of a custom
  ingredient are dropped, as are manual salts whose `ref` is neither a salt id
  nor a custom salt key. A kept entry with a non-finite weight or amount gets
  0, so a row never vanishes while someone is typing. A list that is not an
  array falls back to the default list.
- Custom keys must be `c1`–`c10` / `s1`–`s10` and unique. Names and labels are
  cut to length but not trimmed (they are normalized on every keystroke);
  labels are trimmed where they are shown.
- Sweat tests: at most 20; a missing, invalid or repeated id gets the first
  free `t<n>`; dates must look like `YYYY-MM-DD` (else `''`); missing or
  invalid conditions are filled from the event and environment; durations are
  rounded to 0.01 min. A `selectedTestId` that names no test becomes `null`.
- **v3 → v4 migration** (v3 share links and autosaves keep working): when the
  partial has no `ingredients` array but has v3 `glucoseSources` /
  `fructoseSources`, they become one ingredient list with `weight = percentage
  × poolShare`, the share of the carbs their list covered under the v3 ratio
  (the manual ratio in manual ratio mode, else 2:1). Weights are rounded to
  0.01 and scaled down together so the largest is at most 100
  (`ingredientsFromV3Sources`). `salts.manual[].id` is read as `ref`,
  `format.view 'perGel'` becomes `'perServing'` and `athlete.sex` is dropped.
- `-0` becomes 0. The result is idempotent and survives a JSON round trip
  unchanged.

## 4. The plan (`computePlan`)

`computePlan(inputs)` normalizes its input first, so it accepts any value and
never throws (a fast-check property test runs it on arbitrary values; only the
documented `Infinity` fields, the heat-balance wettedness and the osmolality
of a mix with no water, may be non-finite). It returns:

| Field | Content |
| --- | --- |
| `inputs`, `durationMin`, `durationH` | The normalized inputs and the duration |
| `sweat` | `resolveSweat(...)`: `rateLph`, `sodiumMmolL`, `source`, `uncertaintyLph`, `estimate` (the heat-balance result for the event), `test`, `tests` (one result per stored test), `calibration`, `why`, `warnings` |
| `hydration` | `projectBodyMass(...)`: `waterDeficitL`, `deficitPct`, `scaleChangeKg`, `level`, `warnings` |
| `carbs` | `mode`, `recommended`, `gPerHour`, `totalG`, `deliveredG`, `warnings`, `ratio` (`mode`, `recommended`, `value`, `share` (the target), `allowedShare`, `glucoseGPerHour`, `fructoseGPerHour`, `warnings`), `ingredients` (`solveIngredients` with its items merged with their profiles), `mouthRinse`, `mouthRinseHowTo` |
| `sodium` | `mode`, `recommended` (`recommendSodium`), `mgPerHour`, `totalMg`, `warnings` |
| `extras` | `recommendExtras(...)`; each ion also has `totalMg` |
| `fluid` | `mode`, `recommended` (`recommendFluid`), `mlPerHour`, `totalMl`, `warnings` |
| `salts` | `mode`, `sodiumSalt`, `items` (`[{ ref, amountMg }]`), `delivered`, `comparison`, `warnings` |
| `format` | `{ type, requestedType, drinkCarbShare }`: `requestedType` is `inputs.format.type`, `type` the format the recipe uses (`'drink'` when a gel or both plan has no gels but something to mix); `drinkCarbShare` 0 for gels, 1 for a drink, `drinkCarbSharePct ÷ 100` for both |
| `concentration` | `{ gel: gelBatch(...) \| null, drink: drinkBottles(...) \| null }` |
| `caffeine`, `bicarb` | `planCaffeine(...)`, `planBicarbonate(...)` |
| `gels` | `{ perHour, count, times }` |
| `schedule` | `buildSchedule(...)` |
| `recipe` | `buildRecipe(...)`: `{ sections, view }` |
| `energy`, `cost` | `{ kcal, deliveredKcal, expenditureKcalPerHour, expenditureKcal }`, `{ diy, commercial, savings }` |
| `warnings` | Every warning above, de-duplicated by id, sorted danger > warning > info |

How the parts connect:

1. **Effective values.** `auto` uses the recommendation; `manual` uses the
   manual value. Manual values get the same evidence warnings as recommended
   ones (`carbIntakeWarnings`, `sodiumWarnings`, `fluidWarnings`).
2. **Sweat.** `resolveSweat(inputs.sweat, { event, athlete, environment })`
   (section 5.5). Its warnings (`sweat.testUnusable`, `sweat.uncompensable`)
   are plan warnings.
3. **Carbs.** `totalG = gPerHour × hours`. Auto mode adds the
   recommendation's own warnings; both modes add `carbIntakeWarnings`.
4. **Ratio and ingredients.** `solveIngredients` for the whole activity
   (section 5.4). Auto ratio: target = `recommendRatio(gPerHour)
   .recommendedShare`, allowed = `[minShare, maxShare]`. Manual ratio: target =
   the manual share, allowed = that share only, plus `checkRatio` warnings. A
   manual 0:0 ratio (danger `carbs.noRatio`) sends 0 g to the solver, so the
   recipe has no carbs. The solver's warnings (`carbs.ratioNotReachable`,
   `carbs.noIngredients`) go to `carbs.warnings`. `glucoseGPerHour` and
   `fructoseGPerHour` split the carbs the recipe delivers per hour by the
   share it delivers; both are 0 when it delivers none (no ingredient, 0:0).
5. **Fluid** is computed before sodium, because the sodium concentration check
   needs the effective fluid intake. `hydration = projectBodyMass(...)` with the
   sweat rate, the effective fluid and the estimate's energy expenditure.
6. **Salts.** Auto: `saltsForTargets` from the sodium and extras totals and the
   chosen sodium salt. Manual: `inputs.salts.manual` (salt ids or custom
   salts), plus `sodiumWarnings` for the sodium those salts deliver per hour.
   `comparison` covers sodium, potassium, magnesium and calcium; chloride has
   no target and stays only in `delivered`. A manual sodium target below the
   evidence range of an event of 120 min or more gets info
   `plan.sodiumBelowRange`.
7. **Format.** `'gel'` puts all carbs and salts in gels; `'drink'` in drink
   bottles; `'both'` puts `drinkCarbSharePct` % of each ingredient and all
   salts in the drink and the rest of the carbs in gels.
8. **Gels.** `getGelTimes(durationMin, gelsPerHour)` when the gel part of the
   recipe delivers carbs. The carbs the solver delivers count, not the
   target, so a gel never holds only salt. A plan with no carbs (0 g: under
   45 min, 45–75 min at easy intensity, a manual 0 g/h), a plan whose
   ingredients deliver none (no carb ingredient, a 0:0 ratio), a drink, or
   `'both'` at 100 % drink has no gels. Caffeine is planned on the gel times.
9. **No gels.** When a gel or both plan has no gels (0 gels per hour, or no
   carbs for gels), what the gels would hold goes into the drink:
   `format.type` becomes `'drink'`, so the drink's strength, osmolality and
   warnings cover everything the athlete mixes, and the schedule lists drink
   sips. Info `plan.noGels` says so (`plan.warn.noGelsCarbsInDrink`, or
   `plan.warn.noGelsSaltsInDrink` when only salts moved); not for `'both'` at
   100 % drink, which the athlete chose. A gel plan with nothing to mix (no
   carbs, no salts) stays an empty gel recipe.
10. **Concentration.** `gelBatch` for the gel part when there are gels
   (servings = gel count, the chosen consistency); `drinkBottles` for the
   drink part (the plan's whole fluid, the chosen bottle size).
11. **Recipe and schedule.** `buildRecipe` with the whole-activity
    ingredients and salts, the concentration results and `inputs.format.view`;
    `buildSchedule` with `format.type` and the drink bottles.
12. **Energy** is 4 kcal per g of the carb target (`kcal`) and of the carbs
    the recipe delivers (`deliveredKcal`). `expenditureKcalPerHour` is the
    heat-balance estimate's energy use for the event (`metabolicW × 3600 ÷
    4184`), `expenditureKcal` that times the hours. **Cost** is a rough
    estimate: 0.015 per g of carbs for DIY powder and 0.10 per g for commercial
    gels (about 2.50 per 25 g gel).

**Golden default plan** (tested in `plan.test.js`):

- Sweat: cycling at 30 km/h on the flat needs about 158 W (derived from the
  speed), 678 kcal/h. In 20 °C shade the air flow carries most of the heat
  away, so the estimate is **0.15 L/h** (± 0.5; `final_model.py` gives the
  same 0.1504).
- Carbs 75 g/h at 1:0.5: 225 g (157.9 g maltodextrin, 75 g fructose).
- Fluid 100 ml/h (300 ml). Sodium 300 mg/h (900 mg) from 2,290 mg table salt.
  Projected scale change −0.56 kg (water deficit 0.15 L, 0.2 % of body mass).
- 9 gels at 0, 20, …, 160 min; the schedule lists 30, 30, 40, … ml with them.
- Gel batch: 375 g at 60 % carbohydrate with 139.8 ml warm water, 290 ml,
  about 4,330 mOsm/kg (shown "≈ 4,300 mOsm/kg, likely higher"); each gel
  42 g with 25 g carbs.
- Energy 900 kcal from carbs; expenditure 2,035 kcal (shown rounded to 10:
  "about 2,040 kcal").
- Warnings: `electrolytes.concentrationHigh` (900 mg sodium in 300 ml of
  fluid is 3,000 mg/L) and info `concentration.gelTakeWithWater` (about 210 ml
  of water with each gel). See section 13.
- The defaults encode to the share payload `{"v":4}`.

With the preset sweat source (`sweat.source: 'preset'`, 1.25 L/h) the plan
keeps the Phase 1 numbers: sodium 570 mg/h, fluid 800 ml/h.

`templateToInputs(template, { gPerHour })` returns a partial for `apply()`: the
template's manual ratio, its glucose and fructose source lists as one
ingredient list (`ingredientsFromV3Sources` with the template's ratio),
`gelsPerHour = gPerHour ÷ carbsPerGelG` rounded to 0.5 (1–12), and auto salts
with the template's sodium salt. The carb and sodium targets and the custom
ingredients stay the same: a gel label's sodium (often 0–60 mg) is far below
what most events need, so the plan keeps its evidence-based target and the
salts cover it.

## 5. Evidence rules

Citation ids in brackets refer to `src/domain/evidence.js` (section 11).

### 5.1 Carbohydrate target (`recommendCarbs`)

Duration picks a band:

| Band | Duration | Range g/h | Citations |
| --- | --- | --- | --- |
| `none` | < 45 min | 0 | thomas2016, jeukendrup2014 |
| `rinse` | 45 to < 75 min | 0–30, mouth rinse | jeukendrup2014, carter2004, brietzke2019 |
| `short` | 75 to < 120 min | 30–45 | jeukendrup2014, thomas2016 |
| `medium` | 120–150 min | 45–60 | jeukendrup2014, thomas2016, burke2011 |
| `long` | > 150 min | 60–90 | jeukendrup2014, burke2011, smith2013 |
| `veryHigh` | > 150 min with `highCarb` | 90–120 | podlogar2022, hearris2022, jeukendrup2017 |

- Intensity places the target inside the band and never pushes it above:
  easy → `lo × 0.8`, moderate → midpoint, hard and race → `hi`. Then `round5`.
  Unknown intensity counts as moderate. [jeukendrup2014] says to adjust *down*
  when absolute intensity is low.
- Examples: 60 min moderate → 15 (mouth rinse); 90 min moderate → 40;
  120 min moderate → 55; 180 min easy → 50; 180 min moderate → 75;
  180 min race → 90; 180 min race with `highCarb` → 120.
- `highCarb` at 150 min or less is ignored, with info `carbs.highCarbLongOnly`.
  The UI shows the "Gut-trained" switch above 150 min (`HIGH_CARB_MIN_DURATION_MIN`)
  and keeps it while it is on, so a shorter event can always turn it off.
- A target above 90 g/h adds warning `carbs.gutTraining` [jeukendrup2017,
  cox2010]: it needs 2–4 weeks of gut training, and the benefit over 90 g/h is
  unproven. In the `veryHigh` band that is every intensity except easy, which
  stays at 70 g/h (80% of 90).
- In the `rinse` band `mouthRinseHowTo` carries the protocol (message
  `carbs.mouthRinse.howTo`: 25 ml of a 6–8% maltodextrin drink, swish 5–10 s,
  every 5–10 min) and its studies [carter2004, brietzke2019]. The carbs
  target in the setup, the mixing steps and the printout show this one text.

### 5.2 Glucose:fructose ratio (`recommendRatio`, `checkRatio`, `formatRatio`)

Fructose share = fructose-pathway carbs ÷ total carbs. The maximum share is
always 0.5 (never more fructose than glucose).
[jeukendrup2014, rowlands2015, obrien2013, podlogar2022, wallis2005]

| Intake | Minimum share | Recommended |
| --- | --- | --- |
| ≤ 60 g/h | 0 (glucose alone works) | 1/3 (1:0.5) |
| 60–90 g/h | 1/3 | 1/3 (1:0.5) |
| > 90 g/h | rises linearly to 0.444 at 120 g/h | same as minimum (1:0.8 at 120 g/h) |

In auto ratio mode the allowed range `[minShare, 0.5]` is what the solver may
use when the ingredients cannot make the recommended share.

`formatRatio({ glucose, fructose })` writes every ratio the app shows as `1:x`
with glucose normalised to 1 and `x` rounded to 2 decimals (`2:1` → `1:0.5`,
a manual 0.95:0.85 → `1:0.89`); no glucose → `0:1`, neither → `0:0`.
`checkRatio` (manual ratios only): 0:0 → danger `carbs.noRatio`; share below
`minShare − 0.02` → warning `carbs.tooLittleFructose`; share above 0.52 →
warning `carbs.tooMuchFructose`.

### 5.3 Carb intake warnings (`carbIntakeWarnings`)

- Above 120 g/h → danger `carbs.aboveStudied` [podlogar2022, hearris2022].
- Above 90 g/h → warning `carbs.gutTraining` [jeukendrup2017, cox2010].

These apply to manual targets too.

### 5.4 Ingredient solver (`solver.js`)

One ingredient list replaces the Phase 1 glucose and fructose lists. Each
entry is a built-in source or a custom ingredient with a **preference weight**
0–100.

- `ingredientProfile(ref, custom)`: built-in sources use their table values.
  Custom ingredients: `carbsPerGram = carbsPer100g ÷ 100`, `fructoseShare =
  fructoseSharePct ÷ 100`, `waterFraction = (waterPct ?? 100 − carbsPer100g) ÷
  100` clamped to [0, min(0.95, 1 − carbsPerGram)], `osmPerG = carbsPerGram ×
  5.55` (all their carbs counted as simple sugars: the cautious, highest
  osmolality).
- `feasibleShareRange`: the lowest and highest fructose share among the
  ingredients that carry carbs; `null` without one.
- `solveIngredients({ totalCarbsG, targetShare, allowedShare, ingredients, custom })`
  finds the carbs per ingredient `c_i ≥ 0` with `Σ c = T` and `Σ c_i f_i = s·T`
  that minimise `Σ (c_i − p_i·T)²`, with `p_i` the normalised weights (all zero
  → equal). It is solved exactly with an active-set method on the KKT system
  (equality-constrained least squares; a negative amount is fixed at 0 and the
  rest re-solved; when all free shares are equal the share constraint is
  dropped). Repeated refs are merged. `grams = c_i ÷ carbsPerGram`.
- **Share used** (`usedShare`): the target if the ingredients can make it;
  else the point of `allowedShare ∩ feasibleRange` closest to the target,
  without a warning (glucose-only ingredients at ≤ 60 g/h give a 1:0 recipe,
  honey alone gives 1:1); else the end of the feasible range closest to the
  target with warning `carbs.ratioNotReachable` (params: achievable and target
  ratio text). No carb ingredient → warning `carbs.noIngredients`.
- A property test (fast-check, 1–6 random ingredients including custom ones)
  checks `c_i ≥ −1e-9`, `Σ c ≈ T`, the achieved share inside the feasible
  range, `|achieved − s| < 1e-6` when `s` is feasible, and determinism.

Phase 1's rule that mixed and pure sources read their percentages differently
is gone: a weight always means the same thing.

### 5.5 Sweat (`heatBalance.js`, `sweat.js`)

**Heat-balance estimate** (`estimateSweatRate`) [gagnon2013, cramer2019,
jay2024; ISO 7933 for skin temperature and sweat efficiency]. The body must
lose the heat it produces; what dry heat loss and breathing cannot remove has
to be evaporated.

```
A    = 0.007184 × kg^0.425 × cm^0.725                    DuBois body surface area, m²
pa   = rh/100 × psat(Ta);  psat(T) = 0.6108 × exp(17.27 T / (T + 237.3))    kPa
M, W running: M = kg × (3.5 + 3.333 × km/h) × 20.9 / 60, W = 0          ACSM gross running cost
     cycling: M = P / 0.20, W = P;  P = 0 → 0.5 × 1.2 × 0.36 × v³ + 0.005 × (kg + 10) × 9.81 × v
     other:   M = 1.163 × METs × kg, W = 0                               Compendium METs
v    = run/cycle outdoors: km/h ÷ 3.6; other outdoors 1.0; indoors with a fan 1.5, without 0.2; at least 0.2 m/s
clo  = 0.15 (race kit) for running and cycling, 0.3 otherwise
Tsk  = clamp(30.78 + 0.125 Ta + 0.198 pa − 0.348 min(v, 3), 30, 36)
hc   = 8.3 v^0.6;  Rcl = 0.155 clo;  fcl = 1 + 0.28 clo;  Ra = 1 / (fcl (hc + 4.7))
CR   = A (Tsk − Ta) / (Rcl + Ra)                                         dry heat loss, W
Resp = 0.0173 M (5.87 − pa) + 0.0014 M (34 − Ta)                         breathing, W
S    = ERF × A × Ra / (Ra + Rcl);  ERF 0 shade/indoors, 75 partly sunny, 150 full sun (W/m²)
Ereq = (M − W) − CR − Resp + S
Emax = A (psat(Tsk) − pa) / (1 / (16.5 hc fcl))                          (clo ≤ 0.3)
SR   = Ereq ≤ 0 → 0;  Emax ≤ 0 → SR_MAX;  else w = Ereq / Emax,
       r = w ≤ 1 ? 1 − w²/2 : w < 1.7 ? max(0.05, (2 − w)²/2) : none,
       SR = r ? min(SR_MAX, Ereq / (673.9 r)) : SR_MAX                   L/h (2426 J/g)
SR_MAX = min(3.0, 1.5 A) L/h
```

- `uncompensable` when `w > 0.85` (`> 1.0` when acclimatised): danger
  `sweat.uncompensable` for every sweat source, because heat stress does not
  depend on how the rate was found. Acclimatisation changes only this limit,
  not the rate.
- `energyKcalPerHour = M × 3600 ÷ 4184`. Uncertainty ±0.5 L/h (jay2024: limits
  of agreement about ±0.4 L/h).
- Reference values (tested to ±0.03 L/h against `final_model.py`): run 70 kg /
  175 cm at 12 km/h, 20 °C / 50 % shade → 0.95 L/h (full sun 1.27); 30 °C /
  60 % → 1.59; cycling 75 kg / 180 cm at 200 W and 30 km/h, 25 °C / 50 % →
  0.60; other sport at 8 METs, 25 °C / 50 % → 0.75 (the research table's 0.70
  used race-kit clothing; the spec's 0.3 clo for other sports gives 0.751).
- Property tests: the rate is finite, ≥ 0 and ≤ SR_MAX, and never falls as the
  temperature rises from 10 to 40 °C.

**Sweat test** (`sweatTestRate`) [baker2017, sawka2007, cheuvront2017]:

```
rawLph      = (preKg − postKg + fluidL − urineL) / h          1 kg = 1 L
energyKcal  = estimateSweatRate(test conditions).energyKcalPerHour × h
correctionL = 0.0002 × energyKcal                             0.2 g per kcal is lost burning fuel and breathing
rateLph     = rawLph − correctionL / h
```

A test is invalid when the duration or a body mass is not above 0, or the
rate is not above 0 or above 5 L/h; `problems` says why
(`sweat.test.problem.*`). The UI shows the protocol (`sweat.test.protocol`:
empty bladder, towel dry, weigh nude on the same scale, about 60 min at race
intensity, weigh bottles, record urine, repeat 2–3 times).

**Resolving the rate** (`resolveSweat`):

- `test`: the selected test (`selectedTestId`, else the last). No test or an
  invalid one → the estimate, with warning `sweat.testUnusable` (message
  `sweat.warn.noTest` when there is none). With `calibrate` (default on):
  `factor = clamp(model(event) ÷ model(test conditions), 0.5, 2)` and
  `rateLph = min(factor × testRate, max(estimate.maxRateLph, testRate))`.
  Unclamped this is the spec's `testRate ÷ model(test) × model(event)`; the
  clamp limits how far the model may carry the measurement to new
  conditions, never how far the athlete may differ from the model, so a test
  in the event's own conditions gives exactly the measured rate. (Deviation
  from spec section 2, which clamped `testRate ÷ model(test)`: on the default
  ride the model says 0.15 L/h, so a measured 1.36 L/h was cut to 0.3 L/h.)
  When the factor hits a limit: warning `sweat.calibrationLimited`, a note,
  and the uncertainty widens to the model's ±0.5 L/h. A note also says when
  the ceiling applied. Without `calibrate`: `rateLph = testRate`.
  Uncertainty ±0.15 L/h.
- `estimate`: the heat-balance estimate, ±0.5 L/h [gagnon2013, cramer2019,
  jay2024]. Below 0.1 L/h info `sweat.estimateLow` says the model predicts
  very little sweat (it assumes race kit and a steady effort), gives the
  upper end of the uncertainty and suggests drinking to thirst and a sweat
  test [jay2024, kenefick2018].
- `preset`: `SWEAT_RATES[rateIndex]`, ±0.5 L/h [baker2017, barnes2019].
- Sweat sodium always comes from the saltiness preset.

### 5.6 Fluid and body mass (`recommendFluid`, `fluidWarnings`, `projectBodyMass`)

- `mlPerHour = min(round50(min(sweatRate × 1000 × 0.8, 800)), floor50(sweat
  loss in whole ml/h))`; 0 when the sweat rate is 0. Replacing about 80% of
  sweat loss avoids weight gain, and rounding never lifts the plan above the
  sweat loss (the heat-balance estimate gives rates under 0.125 L/h in cool
  conditions, where round50 alone would). [sawka2007, hewbutler2015]
- The guideline range shown is 400–800 ml/h [sawka2007].
- `drinkToThirst` when the event is under 90 min or colder than 15 °C
  [kenefick2018]; the explanation then adds the drink-to-thirst hint.
- Warnings: intake above the sweat rate → danger `fluid.aboveSweat` (weight
  gain is the main risk factor for exercise-associated hyponatremia)
  [almond2005, hewbutler2015]; otherwise above 800 ml/h → warning
  `fluid.aboveCeiling` [sawka2007].
- **Body-mass projection**: `waterDeficitL = (SR − F/1000) × h`, `deficitPct =
  100 × waterDeficitL ÷ massKg`, `scaleChangeKg = −waterDeficitL − 0.0002 ×
  kcal/h × h` [cheuvront2017] (the scale also drops by the fuel burned, so a
  small water gain can still read as a loss). Levels: intake above the sweat
  loss (the same whole-ml/h rule as `fluid.aboveSweat`) → `gain`, danger
  `fluid.projectedGain` [hewbutler2015]; deficit above 3 % → `high`, warning
  `fluid.deficitHigh` [sawka2007]; above 2 % → `mild`, info `fluid.deficitMild`;
  else `ok`. Both overdrinking dangers stay in `plan.warnings`; the fluid
  target in the setup shows only `fluid.aboveSweat` when both apply.

### 5.7 Sodium (`recommendSodium`, `sodiumWarnings`)

`loss = sweatRate × sweatSodium (mmol/L) × 22.99`. The plan starts from half
of it (`base = 0.5 × loss`), because no guideline recommends replacing all
sweat sodium. [sawka2007, mccubbin2023, hoffman2015, delcoso2016, baker2017]

| Duration | Range mg/h | Target |
| --- | --- | --- |
| < 120 min | 0–300, optional | `min(base, 300)` |
| 120–240 min | 300–600, or 300–1000 for heavy (≥ 1.5 L/h) or salty (≥ 55 mmol/L) sweaters | `clamp(base, 300, hi)` |
| > 240 min | 300–1000 | `clamp(base, 300, 1000)` |

Rounded to 10 mg/h and never above 1500 mg/h. Example: 180 min, 1.25 L/h,
40 mmol/L → loss 1149.5, base 574.75 → 570 mg/h.

Warnings (also for manual targets and manual salts):

- Above 1500 mg/h → danger `electrolytes.sodiumFarAbove`; otherwise above
  1000 mg/h → warning `electrolytes.sodiumHigh` [mccubbin2023, hoffman2015].
  The message shows the mg/h rounded to whole mg; the thresholds use the
  unrounded value.
- Sodium per litre of planned fluid above 1725 mg/L (75 mmol/L) → warning
  `electrolytes.concentrationHigh` [efsa2011, range 460–1150 mg/L]. This
  divides all the plan's sodium by all its fluid. A drink also gets its own
  per-bottle check (section 5.10).

### 5.8 Potassium, magnesium, calcium (`recommendExtras`)

Optional, off by default, under "Advanced" in the UI. Each enabled ion
replaces half of a typical sweat loss: `0.5 × sweatRate × mmol/L × mg/mmol`
with 4.5 (K), 0.05 (Mg) and 0.5 (Ca) mmol/L, capped at 300, 50 and 100 mg/h.
Potassium is rounded to 10 mg/h, magnesium and calcium to whole mg. The
explanation says there is no evidence they prevent cramps.
[baker2017, montain2007]

### 5.9 Salts (`saltsForTargets`, `saltProfile`, `deliveredIons`, `compareIons`)

- `saltsForTargets`: sodium from table salt (`table`), sodium citrate
  (`citrate`) or half from each (`mix`); potassium, magnesium and calcium from
  their citrates. Amounts are whole-activity mg, rounded to whole mg; zero
  amounts are left out.
- `saltProfile(ref, custom)`: a built-in salt, or a custom salt typed in from
  a label. A custom salt's percentages become its components; its osmolality
  is estimated as every listed ion plus one monovalent anion per unit of
  positive charge that chloride does not balance (exact for chlorides, high
  for citrates, so it errs on the cautious side).
- `deliveredIons(salts, custom)`: `Σ amount × ratio` per ion, no absorption
  factors.
- `compareIons`: `|diff| ≤ max(1 mg, 2% of target)` → `met`; otherwise
  `short` or `over`.

### 5.10 Water, concentration and osmolality (`concentration.js`)

- **Osmolality** (`osmolality`): `mOsm/kg = 1000 × Σ(g_i × q_i) ÷ (added water
  g + Σ g_i × waterFraction_i)`. Sugars count as ideal (φ = 1), which matches
  Vist & Maughan at 40 g/L [vist1995] and reads about 10 % low at gel
  strength. Every view and message shows `roundOsmolality`: whole mOsm/kg,
  from 1,000 rounded to 100 (a drink warning and its chip both read "4,200");
  gels from 1,000 mOsm/kg also say "likely
  higher". Tonicity bands: hypotonic < 270, isotonic 270–330, hypertonic
  > 330 mOsm/kg.
- **Density** (`solutionDensity`): `ρ = 1 ÷ ((1 − w) ÷ 0.9982 + 0.625 w)` with
  `w` the dissolved-solids mass fraction (10 % → 1.037, 60 % → 1.289 g/ml).
- **Gel batch** (`gelBatch`): consistency presets (% carbohydrate w/w)
  isotonic-style 33, liquid 45, standard 60, thick 70. Target mass = carbs ÷
  pct; added water = target − ingredients as purchased (syrup water counts);
  when the ingredients alone are heavier, no water is added and info
  `concentration.syrupsThinner` says how thin the gel gets. Solids = dry carbs
  + salts; volume = mass ÷ density; per serving = totals ÷ gels. Water with
  each gel = `round10(carbs per gel ÷ 0.10 − gel mass)` so gel plus water is
  about 10 % carbohydrate [pfeiffer2010]. Osmolality above 600 → info
  `concentration.gelTakeWithWater` [vist1995, pfeiffer2010]. Dextrose (ids 1
  and 8) above 45 % of the solution it makes with the gel's water → warning
  `concentration.crystallise`.
- **Drink bottles** (`drinkBottles`): `bottles = max(1, ceil(fluid ÷ bottle
  size))`; each bottle is filled to `fluid ÷ bottles` (at most the bottle
  size), so drinking the plan's fluid finishes every bottle and delivers all
  of its carbs and salts. No fluid → 0 bottles and warning
  `concentration.noFluidForDrink`. Added water per bottle = `fill − 0.625 ×
  dry solids − ingredient water`; when the ingredients alone take up the whole
  fill, warning `concentration.drinkDoesNotFit`. Then: carbs above 12 % w/v →
  warning `concentration.drinkTooStrong`, above 8 % → info
  `concentration.drinkStrong`; osmolality ≥ 600 → warning
  `concentration.veryHypertonic`, above 330 → info `concentration.hypertonic`
  [vist1995, shi1995]; sodium outside 460–1150 mg/L → info
  `concentration.sodiumOutsideEfsa` [efsa2011].
- Golden tests: 40 g glucose made up to 1 L → 228 ± 5 mOsm/kg (measured 230,
  vist1995); 6 % w/v sucrose → 182 ± 5; the density table ± 0.005; a 60 %
  maltodextrin/fructose gel as in `osmo.py`.

### 5.11 Caffeine (`planCaffeine`)

Off by default. `D = mgPerKg × massKg` (1–6 mg/kg). Habitual intake does not
change the dose [carvalho2022], so there is no habituation input.
[guest2021, carvalho2022, efsa2015, talanian2016]

| Duration | Doses |
| --- | --- |
| ≤ 75 min | `pre` D at −60 min |
| 75–180 min | `pre` D × 2/3 at −60 min, `intra` D × 1/3 at `round(d × 2/3)` (late doses work [talanian2016]) |
| > 180 min | `pre` D × 2/3 at −60 min, then `intra` top-ups of `min(1.5, mgPerKg ÷ 2) × massKg` from `round(d ÷ 2)` every 150 min while `t ≤ d − 30` |

- Rounding: to 5 mg, or with "Add to gels as tablets" to whole half tablets
  (at least one half; tablets of 100 or 200 mg). A tablet intra dose rides on
  the last gel at or before its time when that gel is at most 30 min earlier,
  else on the first later gel when that is at most 30 min later and at least
  30 min before the finish. Otherwise it stays a separate tablet at its own
  time, so a late dose is never moved to the start [talanian2016]. Doses are
  150 min apart, so no two share a gel. In a drink-only plan every dose is a
  separate schedule event.
- Body-load cap: caffeine in the body is `Σ mg × 0.5^((t − tᵢ) / 300)` (5 h
  half-life). Walking the doses in time order, a dose that would lift the load
  above 6 mg/kg is reduced to the largest rounded amount that fits, or
  dropped, with warning `caffeine.capped`. A property test checks the cap over
  40–120 kg, 1–6 mg/kg and 0–1440 min.
- Examples: 70 kg, 3 mg/kg, 60 min → 210 mg pre. 180 min → 140 mg pre, 70 mg
  at 120 min. With tablets of 100 mg → 150 mg (1.5) pre, 50 mg (0.5) in the gel
  at or before 120 min. 100 min at 0.5 gels/h (one gel, at the start) → the
  50 mg dose stays a separate tablet at 67 min.
- Warnings when enabled: info `caffeine.exclusions` (pregnancy, under 18,
  heart conditions, caffeine sensitivity) [efsa2015]; info
  `caffeine.tryInTraining` [guest2021]; danger `caffeine.noPowder` with tablets
  (never use pure caffeine powder, where a dosing error can be fatal); info
  `caffeine.singleDoseAbove200` [efsa2015]; warning `caffeine.highTotal` above
  9 mg/kg in total.

### 5.12 Sodium bicarbonate (`planBicarbonate`)

Off by default. `doseG = gPerKg × massKg` (0.2–0.3 g/kg), `sodiumMg = doseG ×
1000 × 0.2737`. Taken 60–180 min before the start, 90 min recommended.
[grgic2021, deoliveira2022]

- `eligible` when the event is ≤ 60 min (a product rule: the evidence is for
  hard efforts of 30 s to 12 min). `visibleByDefault` when ≤ 90 min; longer
  events hide the section behind a "Show sodium bicarbonate" link.
- Warnings when enabled: warning `bicarb.gi` (GI distress is common; split
  doses or enteric forms help); info `bicarb.sodiumLoad`; warning
  `bicarb.medical` (hypertension, kidney disease); info `bicarb.notInRace`
  (does not count toward in-race sodium); warning `bicarb.longEvent` above
  90 min or info `bicarb.limitedEvidence` for 60–90 min.

### 5.13 Schedule (`buildSchedule`)

- **Gels** (`'gel'`, and the gel part of `'both'`): the first at the start,
  then one every `60 ÷ gelsPerHour` min while the activity lasts
  (`getGelTimes`). The per-gel recipe divides by the same count, so recipe and
  schedule always agree (75 min at 2/h = 3 gels).
- **Drink** (`'drink'`): a `drink` event every 20 min from the start
  (`schedule.drinkSip`, params `{ ml, bottle }`), with the plan's fluid until
  the next sip and the bottle being finished. The bottles are drunk one after
  the other; a sip that finishes one bottle and starts the next says so.
  `'both'` lists the fluid with the gels as in gel mode (the drink holds the
  electrolytes and part of the carbs), or as drink sips when no gel carries
  fluid.
- Events, sorted by time: `bicarb` at −90 min; pre-race `caffeine`; `start`
  (with the first gel when there are gels); one `fuel` per later gel, with
  `caffeineMg` when a tablet dose rides on that gel; `drink` sips; intra
  `caffeine` doses without a gel; a single `hydration` event when there is
  fluid but no gel or sip carries it; `finish` at the end.
- Fluid per gel or sip: the fluid for the time until the next one, or until
  the finish. Amounts are rounded down to 10 ml on the running total, so each
  is within 10 ml of its exact share and together they are the plan's fluid
  rounded down to 10 ml: the schedule never lists more than the plan. When a
  full interval would carry under 5 ml, a `hydration` event states the rate
  instead. The mixing steps take their fluid from these events.
- Times show as `formatElapsed`: `T+1h 20m`, and `T−1h 30m` before the start.

### 5.14 Recipe (`buildRecipe`, `formatAmount`)

- `buildRecipe({ type, carbItems, saltItems, caffeine, gel, drink, view,
  drinkCarbShare })` → `{ sections, view }`. `'gel'`: one gel section with all
  carbs and salts. `'drink'`: one drink section with all carbs and salts.
  `'both'`: a gel section with `1 − drinkCarbShare` of each carb ingredient,
  then a drink section with the rest and all salts.
- Each section: `{ kind, servings, servingLabelKey, items, water: { totalMl,
  perServingMl }, perServing, osmolality, warnings }`. Items, in order: carbs,
  salts, the water to add (`recipe.water.gel` "Warm water", or
  `recipe.water.drink` "Water, to fill each bottle to X ml"), then caffeine
  tablets (gel section only, one line per gel that carries a dose). Each item
  has `amount` / `display` for the whole section and `perServing` /
  `perServingDisplay` per gel or bottle; carbs also carry their glucose and
  fructose grams.
- `formatAmount(amount, unit)`: `'g'` from 10 g whole grams ("53 g"), below
  one decimal ("4.5 g"); `'mg'` (salts) from 1000 mg grams with one decimal
  ("3.8 g"), 100–999 mg grams with two decimals ("0.42 g"), below whole mg
  ("60 mg"); `'ml'` whole ml; `'tablet'` up to two decimals ("1.5 tablets").
  Whole numbers from 1,000 have thousands separators ("1,200 ml"), like every
  other number in the app.
  A positive amount that would round to zero reads "<0.1 g", so an ingredient
  in the recipe never shows as zero.

## 6. Guard rails

| Rule | Value | Where |
| --- | --- | --- |
| Carb intake | warning above 90 g/h, danger above 120 g/h | `carbIntakeWarnings` |
| High-carb band | only for events over 150 min; gut-training warning above 90 g/h | `recommendCarbs` |
| Ratio | never recommends more fructose than glucose; 0:0 is a danger; unreachable ratios warn and use the closest | `recommendRatio`, `checkRatio`, `solveIngredients` |
| Heat stress | danger when the skin wettedness needed is above 0.85 (1.0 acclimatised) | `estimateSweatRate`, `resolveSweat` |
| Sweat test | invalid below 0 or above 5 L/h; calibration factor 0.5–2 | `sweatTestRate`, `resolveSweat` |
| Sodium target | never recommended above 1500 mg/h; warning above 1000, danger above 1500 | `recommendSodium`, `sodiumWarnings` |
| Sodium concentration | warning above 1725 mg/L of planned fluid; drink note outside 460–1150 mg/L | `sodiumWarnings`, `drinkBottles` |
| Fluid | ≈ 0.8 × sweat rate (rounded to 50 ml/h), ≤ 800 ml/h; danger above sweat rate | `recommendFluid`, `fluidWarnings` |
| Body mass | danger on a projected gain; warning above 3 % loss, note above 2 % | `projectBodyMass` |
| Drink strength | note above 8 %, warning above 12 % carbohydrate; note above 330, warning from 600 mOsm/kg | `drinkBottles` |
| Gels | "take with water" above 600 mOsm/kg; crystallisation warning above 45 % dextrose | `gelBatch` |
| Schedule fluid | the fluid listed with gels or sips never exceeds the planned total | `buildSchedule` |
| Caffeine | 1–6 mg/kg; body load never above 6 mg/kg; tablets only, never powder | `planCaffeine` |
| Bicarbonate | 0.2–0.3 g/kg; hidden for events over 90 min; warns about GI, sodium and medical conditions | `planBicarbonate` |
| Inputs | every field clamped or validated; share links, autosaves and saved recipes pass the same check | `normalizeInputs` |

Warnings render through `src/components/ui/WarningList.jsx` (`role="list"`):
danger first, then warnings, then notes; one box per warning in its status
colour with an icon per level (danger an octagon, warning a triangle, info an
"i"), a screen-reader prefix ("Danger:", "Warning:", "Note:", translated) and
the citation links. The race board lists every plan warning; the setup
sections show the ones about their own inputs. The printout writes the level
out, so a printed warning never depends on colour.

## 7. Templates (`src/constants/templates.js`)

Eight commercial gels, researched from manufacturer pages and nutrition
panels (checked 2026-10). Each records carbs, sodium and caffeine per gel, the
glucose:fructose ratio, the matching source ids (as v3-style glucose and
fructose lists), the sodium salt, other ingredients, source URLs and notes.

| Template | Carbs/gel | Sodium/gel | Ratio | Label verified |
| --- | --- | --- | --- | --- |
| GU Energy Gel | 23 g | 55 mg | 1:0.33 | no |
| Honey Stinger Organic Energy Gel | 24 g | 50 mg | 1:0.15 | no |
| Maurten Gel 100 | 25 g | 20 mg | 1:0.8 | yes |
| BPN Go Gel Endurance | 24 g | 110 mg | 1:0.8 | no |
| SiS GO Isotonic Energy Gel | 22 g | 4 mg | 1:0 | yes |
| Precision Fuel & Hydration PF 30 Gel | 30 g | 0 mg | 1:0.5 | yes |
| GU Roctane Ultra Endurance Energy Gel | 21 g | 125 mg | 1:0.33 | no |
| UnTapped Maple Syrup Energy Gel | 26 g | 5 mg | 1:1 | yes |

`verified: false` means at least one value is an estimate; the Templates
dialog says so ("Label not verified") and shows the notes. It states that
each template is inspired by the brand and not affiliated with it. The
template prose (description, notes, other ingredients, source labels) is in
the `ui-dialogs.templates.data.*` catalog keys, so German has its own text; a
test keeps the English keys identical to `templates.js`. Applying a template uses `templateToInputs`
(section 4): Maurten's dextrose and fructose at 1:0.8 become weights 55.56 and
44.44.

## 8. Share links (v4)

- `?s=` holds base64url (UTF-8, no padding) JSON `{ v: 4, ...diff }`, where
  `diff` holds only the input fields that differ from `DEFAULT_INPUTS`. Objects
  are compared field by field; arrays and values are stored whole. The defaults
  encode to `{"v":4}`; a 4 h event is `{"v":4,"event":{"durationMin":240}}`.
- Decoding runs the payload through `normalizeInputs`, so a link can never put
  invalid values into the app. **v3 links still open**: a v3 payload stored its
  differences from the v3 defaults, so it is merged onto a frozen copy of those
  defaults first and then migrated (section 3). A v3 default link therefore
  still means the Phase 1 plan (preset sweat rate 1.25 L/h, 570 mg/h sodium,
  800 ml/h fluid). A payload that is not base64url, UTF-8 JSON or an object, or
  has any other version (v2 included), decodes to `null`.
- `PlanProvider` reads `?s=` once on mount (section 10). An unreadable link
  logs `Ignoring unreadable share link`, removes `s` from the address bar and
  sets `shareLinkFailed`; the app then shows a toast saying the link could not
  be opened (once, for 8 s, in the visitor's language), and the autosave (or
  the defaults) is shown. The URL is not rewritten while you edit; the Share
  dialog and My recipes build fresh links.
- Language, unit system, currency, theme and mode are not part of the link:
  each visitor keeps their own prefs. A first visit with a readable link
  opens in expert mode (the link is a finished plan).

## 9. Storage: autosave and saved recipes (`src/state/storage.js`)

Inputs are stored as share strings (`encodeShareState`), so stored data is
small, versioned and read back through `decodeShareState`, which normalizes it
and migrates v3. Every `localStorage` access is in try/catch: when storage is
missing, blocked, full or throws, the functions return `null`, `[]` or `false`
and never throw. Stored JSON that cannot be parsed counts as empty.

| Key | Content |
| --- | --- |
| `gel-calculator:autosave` | One share string: the last inputs (`loadAutosave`, `saveAutosave`) |
| `gel-calculator:recipes` | JSON array of `{ id, name, savedAt, encoded }`, newest first |
| `gel-calculator:prefs` | JSON `{ locale, unitSystem, currency, mode }` (`src/state/prefs.js`, section 10.2) |
| `theme` | `system`, `light` or `dark` (kept by `next-themes`) |

- `saveRecipe(name, inputs)`: id `'r' + Date.now().toString(36) + counter`,
  `savedAt` an ISO time strictly after every stored recipe. Names are trimmed
  to 1–60 characters; an empty name is "Untitled recipe". At most 50 recipes:
  the oldest are dropped and returned in `dropped`, so the UI can say so.
- `renameRecipe`, `duplicateRecipe` (the copy gets " (copy)" and goes to the
  top), `deleteRecipe`, `loadRecipe(id)` (→ inputs or `null`), `listRecipes`.

## 10. Text, state and UI

### 10.1 Text and languages (`src/i18n/`)

- **Catalogs.** `src/i18n/<locale>/<namespace>.js`, locales `en` (default)
  and `de`. One namespace per domain module (bicarb, caffeine, carbs,
  concentration, electrolytes, fluid, plan, recipe, schedule, sweat) and one
  per UI area (`ui-common`, `ui-setup`, `ui-setup-event`, `ui-setup-sweat`,
  `ui-setup-targets`, `ui-setup-recipe`, `ui-recipe`, `ui-board`,
  `ui-schedule`, `ui-print`, `ui-dialogs`, `ui-guided`, `ui-shell`).
  `ui-recipe` holds what the board, the dialogs, the print view and the
  setup share about a recipe: the built-in ingredient and salt names (German
  names in `de`; a renamed ingredient keeps its own name), amounts, servings,
  osmolality and the mixing steps; `ui-common` holds the sport, intensity,
  setting and sun names. Every key starts with
  its namespace (`ui-board.kpi.carbs`). `index.js` imports each catalog by
  name (Turbopack has no glob import): a new catalog is registered in
  `EN_CATALOGS` and `DE_CATALOGS`. No component has an English literal; aria
  labels, page metadata and the template prose come from catalogs too.
- **Translate.** `createT(locale, { unitSystem, currency })` returns
  `t(messageOrKey, params)`; `useT()` (`useT.js`) gives the one for the
  UI prefs, and the module-level `t` is English and metric (page metadata,
  non-React callers, tests). A key missing in German falls back to English
  and warns once per key outside production; an unknown key returns the key.
- **Placeholders.** `{name}` writes a number in the locale's format (up to 3
  decimals, grouping, a real minus "−") or a string as it is.
  `{name:type}` is a typed quantity, given in the plan's metric unit and
  converted to the unit system: `volume` (ml → "800 ml" / "27 fl oz"),
  `volumeL` (L), `mass` (kg → "70 kg" / "154.3 lb"), `temp` (°C → "20 °C" /
  "68 °F"), `speed` (km/h → "30 km/h" / "18.6 mph"), `pace` (min/km →
  "4:30 min/km" / "7:15 min/mi"), `height` (cm → "175 cm" / "5 ft 9 in"),
  `percent` ("60%" in English, "60 %" with a no-break space in German),
  `ratio` ("1:0.5" / "1:0,5"), `integer` and `currency`. `{name:type:nounit}`
  drops the unit for the first value of a range. Nutrients (g, mg, mg/L,
  kcal) are plain numbers with the unit in the text: they stay in g and mg
  in every unit system, as in sports nutrition. Plural forms use `.one` /
  `.other` keys, picked by `pluralOf(count)` / `countText(t, f, key, count)`
  (`plural.js`).
- **German.** Du-form, short, the sport-nutrition terms of the design doc
  (Kohlenhydrate, Glukose/Fruktose, Natrium, Schweißrate, Trinkmenge,
  Natron, Zubereitung, „Warum?“). German numbers use a decimal comma and a
  dot for thousands ("1.710 mg", "1,25 L/h"), currency after the amount
  ("3,15 €"), dates "17.10.2026". Dates follow the browser's region within
  the UI language (`dateTagFor`): an en-GB browser reads "17 October 2026",
  en-US "October 17, 2026"; numbers keep the UI language's format.
  `index.test.js` checks that every `de`
  catalog has exactly the keys and the placeholders of its `en` twin, and
  pins a few German sentences.
- **Formatting.** `createFormat(locale, { unitSystem, currency })`
  (`formatters.js`, pure) and `useFormat()` (`format.js`, for components)
  return `{ number, integer, mass, height, temp, speed, pace, volume,
  volumeL, percent, currency, date, ratio, duration }` plus `toDisplay` /
  `fromDisplay` for number fields and `parseNumber` (reads "72,5" in
  German). Missing or
  non-finite numbers count as 0; values are rounded before the sign, so a
  zero never shows as "−0". Imperial values are rounded per kind (154.3 lb,
  68.9 in, 68 °F, 18.6 mph, 25.4 fl oz); metric values show as stored (up to
  3 decimals), so a value the app computes (a body mass from a dose, a
  temperature from °F, a fluid rate) is rounded to what its field shows
  before it is written, in metric only: imperial converts the exact value.
- **Page language.** The shell sets `<html lang>` and `document.title` from
  the UI language. The static HTML (and its Open Graph data) is English.

### 10.2 State (`src/state/`)

- **`PlanProvider`** (`{ children, initialInputs?, persist = true }`). A reducer
  over the inputs with actions `set(path, value)` (dot path or key array,
  numeric segments index arrays, value may be an updater), `apply(partial)`
  (deep merge, arrays replace), `replace(inputs)` (onto the defaults),
  `reset()` and `loadInputs(inputs)` (replace, and drop `?s=` from the address
  bar, for My recipes). Every action goes through `normalizeInputs`; a no-op
  keeps the same state object, so the plan is not recomputed.
  - Mount restore, once: the `?s=` link first, else the autosave. `restored`
    turns true after it, and `restoredFrom` says what it restored
    (`'link'`, `'autosave'` or `null`). `initialInputs` (tests) skips the
    autosave restore; `persist={false}` turns autosave off.
  - Autosave: after the restore, every change is saved 400 ms
    (`AUTOSAVE_DELAY_MS`) after the last one. The restored inputs are not
    written back, nothing is saved before the restore (so the defaults never
    overwrite a stored plan), a pending save is written on `pagehide` and
    dropped on unmount.
  - `usePlanInputs()` returns `{ inputs, set, apply, replace, reset,
    loadInputs, shareLinkFailed, restored, restoredFrom }`; `usePlan()` the
    plan. Both throw outside the provider.
- **`UiProvider`.** One open dialog at a time (`MIXING_MODAL`,
  `TEMPLATE_MODAL`, `SHARE_MODAL`, `RECIPES_MODAL`, `SETTINGS_MODAL`, used by
  openers and dialogs alike), the share view, a toast (`showToast(message,
  { tone, durationMs })`, tones `neutral`/`ok`/`warn`/`danger`, 3 s by
  default), the prefs and the layout state: `guidedStep` (0–3) and
  `boardTab` (`board`/`setup`/`schedule`, the phone tab), neither persisted.
- **Prefs** (`prefs.js`): `{ locale: 'en'|'de', unitSystem:
  'metric'|'imperial', currency: 'EUR'|'USD'|'GBP', mode: 'guided'|'expert' }`
  in `localStorage` key `gel-calculator:prefs` (every access in try/catch;
  unknown values are dropped field by field). Defaults come from
  `navigator.language`: `de*` → German, metric, EUR; `en-US` → English,
  imperial, USD; `en-GB` → English, metric, GBP; anything else → English,
  metric, EUR. The mode defaults to `guided` on a first visit (no stored
  prefs, and the plan restored neither a link nor an autosave), else
  `expert`. The prefs resolve after the plan's mount restore; until then
  `prefsReady` is false, the prefs are the defaults and the shell keeps
  `<main>` empty and `aria-busy`, so no layout flashes. The theme (System,
  Light, Dark) is kept by `next-themes` (`localStorage` key `theme`, class
  `dark` on `<html>`). The inputs always stay metric (kg, cm, °C, km/h, ml).

### 10.3 Units and cost

- **`src/domain/units.js`** (pure): kg ↔ lb, cm ↔ in (and ft + in for
  display), °C ↔ °F, km/h ↔ mph, min/km ↔ min/mi (pace from speed and back),
  ml ↔ US fl oz, L ↔ fl oz, `toUnitSystem(kind, value, system)` /
  `fromUnitSystem(…)` for the quantity kinds, and rounding helpers. Round
  trips are property-tested.
- **At the edge.** Number fields show the converted value (`toInput`) and
  convert what is typed back to metric (`fromInput`) before it reaches the
  plan, without rounding: 160 lb is stored as 72.57 kg and shows as 160 lb
  again. Converted values shown in lb, in, °F, mph or fl oz are rounded per
  kind (section 10.1); the bottle-size presets keep one decimal
  (25.4 fl oz).
- **Cost** (`src/domain/cost.js`): `estimateCost(totalCarbsG, currency)`
  with rough per-gram prices of carbohydrate, home-mixed vs commercial gels:
  USD 0.015 / 0.10, EUR 0.014 / 0.09, GBP 0.012 / 0.08 →
  `{ diy, commercial, savings, currency, approximate: true }`. The board shows
  it labelled "approximate", in the chosen currency. The plan's own
  currency-less `cost` field is unchanged.

### 10.4 UI (`src/components/`)

The race-day design (design doc, direction C): flat panels with a 1 px
hairline, condensed display type (Barlow Condensed) for numbers and titles,
IBM Plex Sans for text, IBM Plex Mono for tables and times, tabular figures
for every number, one colour per substance (glucose, fructose, sodium, fluid,
caffeine) everywhere and status colours that always come with an icon and
text. The tokens are CSS custom properties in `src/app/globals.css` (light
and the class-based dark theme), exposed to Tailwind through `@theme`;
components use the tokens only. Fonts load with `next/font/google`
(self-hosted at build). Motion is limited to 150–200 ms and off under
`prefers-reduced-motion`.

- **Primitives** (`ui/`, one file each with tests): `Button`, `Panel`,
  `PanelHeader` (collapsible panels: the chevron right after the title, the
  actions wrapping under it on narrow panels, the summary line under the
  row), `Stat` (KPI tile; its "Why?" shrinks to an icon in a narrow tile),
  `Lane`, `Segmented` (radio group with arrow keys), `Field`, `NumberField`
  (−/+ steppers, unit suffix, min/max/step, locale-aware typing, keeps the
  typed text while focused, `toInput`/`fromInput`), `Select`, `Switch`
  (`role="switch"`), `Chip` (wraps its text unless told to truncate; an
  interactive chip keeps a 36 px hit area, 44 px on touch), `Dialog`
  (native `<dialog>` with
  `showModal()`), `Disclosure`, `Tabs` (roving tab index), `Toast`
  (`role="status"`, polite), `WarningList`, `Why`, `SkipLink`, `Icon`
  (lucide icons, decorative unless named) and `icons/` (logo, Strava and
  GitHub). Hooks: `useFocusAfterRender` (focus an element once React has
  rendered it) and `usePinnedHeight` (below).
- **Shell** (`shell/`). `AppShell` holds the skip link, the sticky header,
  `<main>`, the footer, the phone tab bar, the toast, the dialogs and the
  print host. `ShellHeader`: logo and the "Gel Calculator" wordmark (the
  page's `h1`; below 640 px only the logo shows, the names stay for screen
  readers), the Guided / Expert switch, My recipes, Share and Settings.
  `ShellTabBar` (phones, expert mode): Board, Setup, Schedule, at least
  56 px tall and safe-area aware; the current tab is marked by a top bar,
  bold text and `aria-pressed`, and each tab keeps its own scroll position.
  The header, the tab bar and the guided dock publish their height while
  they are pinned (`usePinnedHeight` → `--pinned-top` / `--pinned-bottom`),
  and the page's `scroll-padding` keeps a focused or revealed element clear
  of them. In a viewport under 32 rem tall (a 1280 × 1024 screen at 400 %
  zoom, a phone in landscape) the header and the tab bar scroll with the
  page instead of covering half of it.
  `ShellFooter`: author line, Strava and GitHub links ("opens in a new tab").
- **Expert layout.** From 1024 px two columns: the setup sections on the
  left (up to 420 px) and the race board on the right, sticky 1 rem under
  the header (`sticky-below-header`) and scrolling on its own when taller
  than the screen. The two columns end before the full schedule, which
  spans the width below them, so the sticky board never covers it; "Full
  schedule" in Next up scrolls to it. Below 1024 px one view at a time,
  picked in the tab bar (Board by default).
- **Mode switch.** Leaving a mode unmounts its layout and any open form (a
  sweat test, a custom ingredient). So the first press of the header switch
  while a form is open stays, shows the form (the Setup tab on phones),
  moves the focus into it and says so in a toast; the second press leaves
  without it. From guided mode the switch goes through the flow's own
  check (`GuidedFlow`'s `ref.leave()`). A mode change scrolls to the top.
- **Setup** (`setup/`), as collapsible panels in this order: *Event* (sport,
  duration in h + min, intensity, speed with the pace for running, power
  with the estimate from the speed for cycling, METs for other sports,
  setting; a sport change replaces a speed that does not fit the new sport,
  and a pace faster than the marathon world record gets a note), *Body &
  weather* (the unit switch for the whole app, body mass, height,
  acclimatised, temperature, humidity, sun), *Sweat* (Test / Estimate /
  Presets tabs: the sweat-test list with add, edit, select, delete and the
  calibrate switch; the estimate with its drivers and the heat-balance
  details; the presets; saltiness; the sweat summary and the projected
  body-mass change), *Targets* (carbs and ratio with Auto / Adjust, the
  evidence band, gut-trained opt-in, mouth rinse; sodium; fluid; the
  advanced extras), *Ingredients* (the list with weights as number and
  slider, the reach bar of the ratios the ingredients can make, the grouped
  add menu, custom ingredients from a label), *Salts* (auto with the sodium
  salt choice, or manual amounts in grams for the whole activity, custom
  salts, delivered vs target), *Format* (gel / drink / both, gels per hour,
  gel consistency, bottle size, the drink's carb share) and *Caffeine &
  bicarbonate* (bicarbonate behind a "Show" button for events over 90 min).
  The field groups are exported, so the guided flow reuses them.
- **Race board** (`board/`). Title row: the "Race board" heading, the event
  summary ("3:00 h · Cycling · Moderate"), the sweat chip ("Sweat 1.25 L/h
  ±0.5" and its source) and the warnings-count chip, which opens the
  warnings panel and moves the focus to it. KPI row: carbs g/h (ratio and
  total), sodium mg/h (total), fluid ml/h (total and the body-mass change),
  caffeine mg (or "Off"); 2 × 2 on a phone, one row from 42 rem, each tile a
  group with its substance colour bar and a "Why?". Under the KPIs, from a
  48 rem wide board, two columns: the recipe on the left, Next up, the
  warnings and the cost estimate on the right (one column below that, in
  this order). Recipe: Total ↔ Per serving (the `format.view` input), one
  flat block per gel batch ("Gels ×9") or drink ("Bottles ×4"), a lane per
  ingredient whose bar is its share of the block's carbs, salts and water
  as plain rows; then Start mixing (the one accent button), Print plan and
  Share plan; then each block's per-serving facts and osmolality with a
  tonicity chip. So on a 390 × 844 phone the lanes and Start mixing are on
  the first screen. Next up: the first four schedule events, how many
  follow and "Full schedule". Warnings: every plan warning, danger first; a
  polite live region announces when the number of warnings or dangers
  changes (`BoardAnnouncer`, after the plan settles). The warnings chip
  shows only its icon and count on a narrow board; its name always says it
  in full.
- **Schedule** (`schedule/`): every gel, sip, caffeine and bicarbonate dose
  as a list or a table, with compact times (T−1h 30m, T+20m) and the same
  time in words for screen readers ("1 hour 30 minutes before the start"),
  the bottle note for drinks, and the fluid advice.
- **Print** (`print/`): the print host is `hidden print:block` and the app
  `print:hidden`, so printing (Print plan calls `window.print()`) gives a
  black-on-white page; under `@media print` every colour token is flattened
  to black or white. Title and date of printing, a plan summary, every
  recipe section as a table (whole amount and per serving) with its facts,
  the mixing steps, the schedule table, every warning with its level
  written out and the references. Block headings never end a page on their
  own (`break-after: avoid`).
- **Dialogs** (`dialogs/`, all on `Dialog`): *Mixing steps* per section (gel:
  weigh, dissolve in the warm water, divide into N flasks, caffeine tablets;
  drink: per bottle add the powders, fill to the mark, shake; then what to
  drink during the activity). *Share*: the link (copy) and a picture of the
  targets and the recipe (`html-to-image`). *Gel templates*: the eight
  templates with their ratio, verified badge, per-gel facts, carb sources,
  other ingredients, label sources and "Inspired by …; not affiliated".
  *My recipes*: save the current plan under a name, then open, rename,
  duplicate, copy the link or delete (with an in-dialog confirm); "Start
  from a gel template". Escape in an inline rename or delete confirmation
  cancels it and keeps the dialog open. *Settings*: theme, language, units
  and currency, applied at once.
- **Guided flow** (`guided/`): four steps on five screens, phone first:
  *Event*; *Body & weather* (the body and weather fields with the setting,
  then "Have you done a sweat test?" with the sweat-test list and form or
  the estimate); *Ingredients* (a pantry grid of carb tiles to toggle, with
  "More ingredients" and "Add your own from a label", the reach bar, and the
  salt you have); *Recipe & plan* (the race board and the full schedule).
  Each screen has a one-line reason and a "Why?". The step list doubles as
  the progress bar (`aria-current="step"`) and jumps to a step; Back and
  Next name where they go; after a move the focus lands on the new screen's
  heading. The dock pinned to the bottom shows the live carbs, sodium and
  fluid per hour and the warnings count, which opens the list; on a narrow
  phone its captions are short ("KH", "Natrium", "Trinken" in German, the
  full names for screen readers) and never break inside a word. "Switch to
  expert" is on every step; expert mode keeps everything the flow set, and
  the flow keeps its step when you come back. An open form blocks the first
  "Switch to expert" the same way as the header switch.

### 10.5 Accessibility

- Landmarks: banner (header), `main` (with the skip link as the first tab
  stop), contentinfo (footer), the phone tab bar ("Sections") and the
  guided step list ("Guided setup") as navigation. The setup column and the
  race board are named regions inside `main`; panels are regions named by
  their headings, recipe sections and KPI tiles are groups. One `h1` (the
  wordmark), then a logical heading order.
- Every control has a visible label (or an accessible name for icon
  buttons), hints and errors through `aria-describedby`, and a visible 2 px
  focus ring in `--focus` with a 2 px offset (number fields draw it around
  the whole stepper group). Touch targets are at least 44 px on touch
  screens.
- Dialogs are native modal `<dialog>`s with a labelled title: the page
  behind is inert, the focus starts inside, Escape and the backdrop close
  them, and the focus returns to the opener. Openers say
  `aria-haspopup="dialog"`.
- "Why?" and the other explanations are disclosures (`aria-expanded`,
  `aria-controls`), not hover tooltips. The toast and the board's warning
  count are announced politely; the warnings under a setup field are not a
  live region (a value typed digit by digit would read out each step);
  nothing depends on colour alone (icons, words, bars with text, the
  current tab in bold with a bar).
- Focus not obscured (SC 2.4.11): the page's `scroll-padding` follows the
  pinned header, tab bar and dock, so a focused control scrolls clear of
  them; under 32 rem of height they stop being pinned.
- Forced colours (Windows high contrast): the switch, the segmented choice,
  the tabs, the progress markers and the primary button keep their state
  with system colours (`forced-colors:` variants), not with fills the
  browser drops.
- Reflow and text spacing: every view fits 320 px (and the WCAG text
  spacing at 320 px in German) without horizontal scrolling; chips and
  captions wrap instead of being cut.
- Contrast: `scripts/check-contrast.mjs` reads the tokens from
  `globals.css` and checks every text/background pair of the design doc
  (≥ 4.5:1 for text, ≥ 3:1 for the focus ring and control borders) in both
  themes; its Vitest test runs in `npm test`. A failure is fixed in the
  token, not per component.
- `<html lang>` follows the language; language names in Settings carry
  their own `lang`, and the built-in ingredient names are translated, so a
  German page has no untagged English names.

## 11. Citation registry

`src/domain/evidence.js` holds 39 citations (authors, year, title, journal,
DOI). `citationLabel(id)` gives "Jeukendrup 2014" for one author and
"Podlogar et al. 2022" for two or more; `citationUrl(id)` gives
`https://doi.org/<doi>`. Tests check that every citation id the plan can
return exists in the registry.

| Topic | Citation ids |
| --- | --- |
| Carb target | jeukendrup2014, thomas2016, burke2011, smith2013 |
| High carb, gut training | podlogar2022, hearris2022, jeukendrup2017, cox2010 |
| Ratio | rowlands2015, obrien2013, wallis2005 (plus jeukendrup2014, podlogar2022) |
| Mouth rinse | carter2004, brietzke2019 |
| Sweat estimate | gagnon2013, cramer2019, jay2024 |
| Sweat test, body mass | baker2017, sawka2007, cheuvront2017 |
| Sweat presets | baker2017, barnes2019 (baker2019 backs the preset data) |
| Fluid | sawka2007, hewbutler2015, kenefick2018, almond2005 |
| Sodium | sawka2007, mccubbin2023, hoffman2015, delcoso2016, baker2017, efsa2011 |
| Concentration, osmolality | vist1995, shi1995, pfeiffer2010, efsa2011 |
| Extras, salts | montain2007, baker2017 (fine1991 backs "no absorption factors") |
| Caffeine | guest2021, carvalho2022, efsa2015, talanian2016 |
| Bicarbonate | grgic2021, deoliveira2022 |

## 12. Tests

- **Unit and golden tests** (Vitest, colocated `*.test.js`). Every evidence
  rule has a test whose comment names its citation, e.g.
  `// [jeukendrup2014] >2.5 h: up to 90 g/h`. Golden values come from the
  research scripts (`final_model.py`, `osmo.py`).
- **Property tests** (fast-check): the ingredient solver, the heat-balance
  model (bounds, monotonic in temperature), the caffeine body-load cap,
  `normalizeInputs` idempotence, the recipe totals, `computePlan` never
  throwing or returning NaN, and the unit round trips.
- **i18n tests**: every key the plan can return exists and every
  placeholder is filled (random v4 inputs); every `de` catalog has the keys
  and placeholders of its `en` twin; the typed placeholders and formatters
  in both languages and unit systems.
- **Component tests** render the real providers (with `persist={false}`) and
  assert real plan numbers, unique ids, accessible names, keyboard
  behaviour, the German text with German numbers (and no English fallback)
  and imperial units. `vitest.setup.js` clears `localStorage` after every
  test, runs every test as a neutral English visitor (`navigator.language`
  `en`) and polyfills `<dialog>` (`showModal`, `close`, Escape) for jsdom.
  `RecipesDialog.document.test.jsx` mounts React on `document`, as the App
  Router does. `scripts/check-contrast.test.mjs` checks the token contrast
  (section 10.5). `recipeText.test.js` checks the shared recipe text (names,
  amounts, the bottle fill and the mixing steps in both languages and unit
  systems) that the board, the dialogs and the print view use.
- **End-to-end tests** (Playwright against the static export, desktop
  Chrome and a 390 × 844 phone; `e2e/`, helpers in `e2e/helpers.js`; every
  context starts as an `en-GB` visitor; tags `@phone` and `@desktop` limit a
  test to one project):
  - `smoke.spec.js`: no console errors in either mode; the `h1`; the default
    plan (75 g/h, the recipe lines); a duration change to 1 h giving
    15 g/h; a "Why?" revealing its citation; a v4 link restoring 240 min in
    expert mode; a v3 link opening migrated (dextrose, the preset sweat rate,
    the per-gel view); a v2 link showing the notice and leaving the address;
    the autosave after a reload; guided on the first visit and the mode
    remembered; the drink format with 4 bottles of 600 ml; a custom
    ingredient joining the recipe; Escape in My recipes' inline editors; the
    board numbers equal to `computePlan`.
  - `guided.spec.js`: the whole guided flow on a phone (event, body and
    weather, sweat, pantry with honey and sodium citrate, the board, mixing,
    Back and the step list, "Switch to expert" keeping every value, the
    autosave and the remembered mode), the dock's warnings, and the header
    switch returning to the same step.
  - `board.spec.js`: the four KPI tiles (caption, value, sub-line, "Why?"
    with its citation) in the first screen (2 × 2 on a phone, one row on a
    desktop), the gel lanes, Start mixing and the one-row chips on the first
    screen of a 390 × 844 phone and a 1440 × 900 desktop (with Next up
    beside the recipe there), in English and German, the caffeine tile,
    Total ↔ Per serving, Next up and the warnings panel in level order.
  - `i18n.spec.js`: switching to German (text, `lang`, title, number,
    percent and currency formats, the tab bar, remembered after a reload,
    and back, German ingredient names), German decimal input, the browser
    defaults for `de-DE` and `en-US` (with the short dock captions), and
    imperial units (lb, in and ft + in, °F, mph, fl oz on the
    board and in the fields, typed values stored in metric and shown again
    unchanged after a reload, back to metric).
  - `keyboard.spec.js`: every dialog opens with Enter, is a native modal
    with the focus inside and Tab kept in it, closes with Escape and with its
    Close button and gives the focus back; templates from My recipes;
    applying a template; the skip link; the phone tab bar; Print plan; the
    focus ring (2 px, `--focus`) on the first 40 tab stops in both themes;
    no tab stop hidden behind the header, the tab bar or the dock (the phone
    setup, the guided flow, the desktop page walked backwards).
  - `a11y.spec.js`: `@axe-core/playwright` (WCAG 2.0–2.2 A/AA and best
    practices) finds no serious or critical violation in light and dark,
    English and German, on every guided screen (and the open dock list),
    every expert view and every dialog, on both projects, and in the print
    view; in forced colours a switch and a segmented choice still show their
    state.
  - `layout.spec.js`: no horizontal overflow at 360, 390, 768, 1024 and
    1440 px (phone emulation below 1024) on every guided screen, every
    expert view and two dialogs, in English and German; two columns from
    1024 px with the sticky board, which never covers the full schedule
    (1024, 1280 and 1440 px); the German dock captions on one line from 320
    to 414 px; every German view at 320 px with the WCAG text spacing; the
    header and the tab bar not pinned in a 320 × 256 viewport (400 % zoom);
    print media showing the print layout black on white (also from the dark
    theme, in German) with a British date for an en-GB visitor.
- **Images.** `node scripts/render-images.mjs [og|screenshots|all]`
  renders `public/og.png` (from `scripts/og-card.html`, with the built
  fonts) and the README screenshots in `assets/` from the static export
  (`npm run build` first; Playwright's Chromium, `PW_CHROMIUM_EXECUTABLE`
  to point at another one).

## 13. Known limitations

- **The default plan warns.** The spec defaults (a 30 km/h ride in 20 °C
  shade) give a heat-balance estimate of 0.15 L/h, so the plan asks for only
  100 ml/h of fluid. The 900 mg of sodium in 300 ml then triggers
  `electrolytes.concentrationHigh` (3,000 mg/L), and the gel note asks for
  about 210 ml of water with each gel while the schedule lists 30–40 ml per
  gel. Both are correct for their own rule; choosing other defaults (for
  example the preset sweat source) is an open product decision.
- **Reload after a share link.** On mount the `?s=` link wins over the
  autosave. After opening a link and editing it, a reload restores the link
  again (the edits are in the autosave but not shown) until `s` is removed
  from the address bar. Opening a saved recipe removes it.
- **Sweat rate.** The estimate's typical error is ±0.5 L/h, a sweat test's
  ±0.15 L/h. The uncertainty is shown, not propagated into the targets.
- **No sweat in cool weather.** The heat-balance model is steady state with
  race-kit clothing (0.15 clo) for running and cycling. At speed the air flow
  then carries all the heat away in cool conditions (`Ereq ≤ 0`), so the
  estimate is 0 L/h: the default 3 h ride at 30 km/h gives 0.003 L/h at
  17 °C and 0 L/h from about 16.9 °C down (0.15 L/h at 20 °C). The plan then
  asks for 0 ml/h of fluid for the whole ride, a drink format reports
  `concentration.noFluidForDrink`, and the gel note still asks for water
  with each gel. Real athletes still sweat a little, so below 0.1 L/h the
  plan shows `sweat.estimateLow` (drink to thirst, do a sweat test) and the
  ±0.5 L/h range ("likely 0–0.5 L/h"). A sweat test or the presets avoid it.
- **Osmolality** treats sugars as ideal and reads about 10 % low at gel
  strength (shown as "likely higher"). Custom ingredients count as simple
  sugars and custom salts as fully dissociated with one balancing anion, both
  on the high side.
- **Sodium concentration** (`electrolytes.concentrationHigh`) still divides
  all planned sodium by all planned fluid; the drink has its own per-bottle
  check.
- **Energy** has three values: from the carb target (`energy.kcal`), from the
  carbs the recipe delivers (`energy.deliveredKcal`) and the estimated burn
  (`energy.expenditureKcal`).
- **Cost** uses fixed rough per-gram prices per currency (section 10.3), not
  live prices or the user's own products.
- **Templates:** four of eight labels are not fully verified.
- **Citations** with two authors read "et al." (Vist & Maughan 1995 shows as
  "Vist et al. 1995"), the Phase 1 label rule.
- **Compact schedule times** (T−1h 30m) read the same in both languages;
  screen readers get the time in words.
- **The static page** (its `<title>` and Open Graph data before the app
  starts) is English; the app then sets the title and `lang` for German.
- **One view.** On a 390 × 844 phone the title row, the four KPI tiles,
  the gel lanes and Start mixing fit the first screen; Next up, the
  warnings and the per-serving facts need a scroll (a desktop shows Next up
  beside the recipe).

## 14. Open work

- **Cycling sweat estimate.** The heat-balance estimate for the default ride
  (0.15 L/h at 30 km/h and 20 °C) is low for cycling (section 13); an
  evidence-based correction is the next planned change.
