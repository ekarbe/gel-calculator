# Gel Calculator: Systems & Logic

This document describes how the calculator works **as implemented** at the end
of Phase 2. Every number below is the value the code uses. Where a rule is an
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
| Plan | `src/domain/plan.js` | Inputs schema v4 (with the v3 migration), `normalizeInputs`, `computePlan`, `templateToInputs` |
| Text | `src/i18n/en/*.js`, `src/i18n/index.js` | English message catalogs and `t()` |
| State | `src/state/{PlanProvider.jsx,UiProvider.jsx,shareCodec.js,storage.js}` | Inputs reducer with autosave, memoised plan, UI state, share links, saved recipes |
| UI | `src/app/*`, `src/components/{feature,modal,shared}` | Cards, modals, the print view, `Why` and `Warnings` |

### Data flow

```
                ┌──────── ?s= link / autosave (on mount) ────────┐
                ▼                                                │
inputs ──normalizeInputs──▶ PlanProvider state ──computePlan (useMemo)──▶ plan ──▶ components
   ▲                              │                                                  │
   │                              └── saveAutosave (400 ms after the last change)    │
   └──────── set(path, value) / apply(partial) / replace / reset / loadInputs ◀──────┘
```

`src/app/page.jsx` renders `PlanProvider > UiProvider > App`. Components read
the inputs with `usePlanInputs()`, the plan with `usePlan()` and the UI state
with `useUi()`. They never compute nutrition themselves: every target, amount,
water volume, osmolality and comparison they show comes from the plan.
Components only format those numbers, convert units for display (lb, °F, in,
L) and draw progress rings and bars. Every explanation or warning from the
domain goes through `t()`. Number formatting (`src/components/shared/format.js`),
ratio text (`formatRatio` in `src/domain/carbs.js`) and the recipe helpers
(`src/components/shared/recipe.js`) are shared, so a value reads the same in
every card, modal, share image and printout.

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
  shows it behind a "Why?" button (`src/components/shared/Why.jsx`) with links
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
  every 5–10 min) and its studies [carter2004, brietzke2019]. The carb card,
  the mixing steps and the printout show this one text.

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
  else `ok`. Both overdrinking dangers stay in `plan.warnings`; the
  electrolytes card shows only `fluid.aboveSweat` when both apply.

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

Warnings render through `src/components/shared/Warnings.jsx`: one box per
warning, coloured and iconed by level (danger red with an octagon, warning
amber with a triangle, info blue with an "i"), a screen-reader prefix
("Danger:", "Warning:", "Note:") and the citation links. The printout writes
the level out.

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

`verified: false` means at least one value is an estimate; the modal says so
and shows the notes. The modal states that each template is inspired by the
brand and not affiliated with it. Applying a template uses `templateToInputs`
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
  be opened, and the autosave (or the defaults) is shown. The URL is not
  rewritten while you edit; the Share modal and the recipes modal build fresh
  links.
- Display units (kg/lb, °C/°F) are not part of the link.

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

- `saveRecipe(name, inputs)`: id `'r' + Date.now().toString(36) + counter`,
  `savedAt` an ISO time strictly after every stored recipe. Names are trimmed
  to 1–60 characters; an empty name is "Untitled recipe". At most 50 recipes:
  the oldest are dropped and returned in `dropped`, so the UI can say so.
- `renameRecipe`, `duplicateRecipe` (the copy gets " (copy)" and goes to the
  top), `deleteRecipe`, `loadRecipe(id)` (→ inputs or `null`), `listRecipes`.

## 10. Text, state and UI

- **i18n.** `src/i18n/en/<module>.js` holds the English text per domain module
  (bicarb, caffeine, carbs, concentration, electrolytes, fluid, plan, recipe,
  schedule, sweat). `t(messageOrKey, params)` fills `{name}` placeholders
  (numbers with `toLocaleString('en-US')`, negative ones with a real minus
  sign "−"). A missing key returns the key and
  warns once in development. Tests walk the plan over random v4 inputs (every
  format, sweat source, custom ingredient and salt) and check that every key
  it can return exists and every placeholder is filled. UI labels are still
  English literals in the components.
- **`PlanProvider`** (`{ children, initialInputs?, persist = true }`). A reducer
  over the inputs with actions `set(path, value)` (dot path or key array,
  numeric segments index arrays, value may be an updater), `apply(partial)`
  (deep merge, arrays replace), `replace(inputs)` (onto the defaults),
  `reset()` and `loadInputs(inputs)` (replace, and drop `?s=` from the address
  bar, for the recipes modal). Every action goes through `normalizeInputs`; a
  no-op keeps the same state object, so the plan is not recomputed.
  - Mount restore, once: the `?s=` link first, else the autosave. `restored`
    turns true after it. `initialInputs` (tests) skips the autosave restore;
    `persist={false}` turns autosave off.
  - Autosave: after the restore, every change is saved 400 ms
    (`AUTOSAVE_DELAY_MS`) after the last one. The restored inputs are not
    written back, nothing is saved before the restore (so the defaults never
    overwrite a stored plan), a pending save is written on `pagehide` and
    dropped on unmount.
  - `usePlanInputs()` returns `{ inputs, set, apply, replace, reset,
    loadInputs, shareLinkFailed, restored }`; `usePlan()` the plan. Both throw
    outside the provider.
- **`UiProvider`.** One open modal at a time (`TEMPLATE_MODAL`, `SHARE_MODAL`,
  `MIXING_MODAL`, `RECIPES_MODAL`, exported so openers and modals use the same
  names), the share view, a toast with a 3 s timer, and the display units
  `massUnit` (`kg`/`lb`) and `tempUnit` (`C`/`F`). The inputs always store kg,
  cm and °C.
- **Shared helpers.** `src/components/shared/`: `Segmented` (with the
  Auto/Adjust options), `NumberInput` (keeps typed text while focused, commits
  in-range values live and any value on blur), `format.js` (`fmt`,
  `formatRange`, `signed` with a real minus and rounding before the sign,
  `formatDuration`, `aboutKcal` for estimated burns), `units.js` (`LB_PER_KG`,
  `CM_PER_IN`), `labels.js` (intensity, sport, setting and sun names),
  `recipe.js` (section titles, line labels including "Custom salt N" for an
  unnamed custom salt, servings text, the delivered ratio (0:0 when the
  recipe delivers no carbs), the warnings that explain the recipe,
  osmolality display), `mixing.js` (`mixingSteps`: the one step builder for
  the mixing modal and the print view; water only when the recipe lists a
  water line), `bodyMass.js` and `BodyMassLevel.jsx` (the body-mass
  projection text and level chip for the activity summary, the electrolytes
  card and the print view: "Water gained" for a gain, never a negative
  deficit; the ok level reads "Up to 2% loss" to match the domain's "> 2 %"
  rule), `share.js` (`shareUrl`, `copyText`) and `useFocusAfterRender` (moves
  focus to a stable target after an inline form or row goes away). Amber and
  green text uses the `apple-amber-ink` / `apple-green-ink` colors, dark in
  the light theme so it stays readable (at least 6:1); salt lines on the share
  image use teal-700 in light mode for the same reason, and the format
  panel's unpicked choices use the primary text at 75 %.
- **Cards.**
  - *Activity Basics*: Session (duration, intensity, sport; speed with pace
    for running, power with the power estimated from the speed for cycling,
    METs for other sports; running and cycling share one speed, so a sport
    change replaces a speed that does not fit the new sport with its typical
    speed, `speedForSport`, and a running pace faster than the marathon world
    record gets a note), You (body mass, height in cm or in, heat
    acclimatised), Conditions (temperature, humidity, setting, sun), then the
    carb target, caffeine and bicarbonate.
  - *Electrolytes & Hydration*: sweat source Test | Estimate | Presets. Test
    lists the sweat tests (measured L/h or the problem), with add/edit
    (protocol note, live preview), select, delete with an in-page confirm and
    the calibrate switch. Estimate shows the rate ± 0.5 L/h, the heat
    production, energy use, heat to lose by sweating and the conditions.
    Then sodium, extras, salts (manual amounts in grams, salts from a label)
    and fluid with the projected body-mass change and its level.
  - *Carb Matrix*: ratio (Auto/Adjust) and the Ingredients section: a bar of
    the ratios the ingredients can make with the allowed range, the target and
    the recipe ratio; the list with a weight per ingredient (number and
    slider); grouped add menu; custom ingredients from a label.
  - *Final Recipe*: format (Gel / Drink / Both, gels per hour, gel consistency
    with its %, bottle size 500/750/950/custom, the drink's carb share), the
    Total / Per serving view, one block per section with its lines, servings,
    per-serving facts, osmolality ≈ with a tonicity chip and its warnings, a
    rough cost, "View Mixing Instructions" and "Print / save as PDF".
  - *Balance Analysis*: carbs, sodium, fluid and energy rings (with the
    estimated burn), sweat rate with its source and uncertainty, the body-mass
    projection and the ratio bar of the delivered ratio.
  - *Timeline*: every gel, drink sip, caffeine and bicarbonate dose with its
    time, plus how many bottles to drink from.
- **Modals.** Mixing steps per section (gel: weigh, dissolve in the warm
  water, divide into N flasks of about X ml, caffeine tablets; drink: per
  bottle add the powders, fill to the mark, shake), templates, share (link and
  recipe image with every section) and **My recipes** (save the current plan
  under a name, then open, rename, duplicate, delete with an in-page confirm,
  or copy its link; problems such as blocked storage or the 50-recipe limit
  show as a toast). Escape in an inline rename or delete confirmation cancels
  it and keeps the modal open: the inline handler calls `preventDefault`, and
  the modal's `document` listener ignores handled events (in the app React
  listens on `document` itself, so `stopPropagation` alone cannot stop it).
- **Print view.** `src/components/feature/PrintRecipe.jsx` renders with
  `hidden print:block`, and the app content is `print:hidden`, so printing
  (the recipe card's "Print / save as PDF" calls `window.print()`) gives a
  black-on-white page: title and date of printing, a plan summary, every
  recipe section as a table (whole amount and per serving), the mixing steps,
  the schedule table, every warning with its level written out, and the full
  references. Block headings never end a page on their own
  (`break-after: avoid`). The conditions name the sun only outdoors, as the
  sweat model uses it. The jsPDF export is gone.

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
  `normalizeInputs` idempotence, the recipe totals, and `computePlan` never
  throwing or returning NaN.
- **Component tests** render the real providers (with `persist={false}`) and
  assert real plan numbers, unique ids and accessible names. `vitest.setup.js`
  clears `localStorage` after every test, so no test sees another's autosave.
  `RecipesModal.document.test.jsx` mounts React on `document`, as the App
  Router does, because React Testing Library's div container hides how
  `document` listeners behave.
- **Smoke tests** (Playwright, `e2e/smoke.spec.js`, desktop and phone) run
  against the static export: no console errors, header and recipe present, no
  horizontal overflow on a phone, the default plan (75 g/h, non-empty recipe),
  a duration change to 1 h giving 15 g/h, a "Why?" control revealing a
  citation link, a v4 link restoring a 240 min event, a v3 link opening
  migrated (dextrose instead of maltodextrin, the preset sweat rate, the per-gel
  view), a v2 link showing the "could not be opened" notice without
  overflowing a phone, the autosave restoring the plan after a reload, the
  print view replacing the app under print media (with block headings kept
  with their content), the drink format showing 4 bottles of 600 ml, Escape
  in a My recipes rename or delete cancelling it without closing the modal,
  and a custom ingredient joining the recipe.

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
- **Cost** uses two fixed per-gram prices in an unnamed currency.
- **Templates:** four of eight labels are not fully verified.
- **Citations** with two authors read "et al." (Vist & Maughan 1995 shows as
  "Vist et al. 1995"), the Phase 1 label rule.
- **UI text** outside domain messages is hard-coded English; only kg/lb,
  cm/in and °C/°F conversion exist.

## 14. What the next phase changes

- **Phase 3:** the race-day redesign (layout C: the key numbers, schedule and
  recipe in one view), a guided mode, an accessibility pass, German text with
  all UI labels moved to i18n, more units (oz) and a chosen currency for
  cost.
