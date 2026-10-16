# Gel Calculator: Systems & Logic

This document describes how the calculator works **as implemented** at the end
of Phase 1. Every number below is the value the code uses. Where a rule is an
interim simplification, it says so and names the phase that replaces it.

## 1. Architecture

The app is a single-page Next.js app exported as static HTML (`output: 'export'`,
`basePath: '/gel-calculator'`) and deployed to GitHub Pages. All calculation
happens in the browser. There is no server and no storage.

| Layer | Files | Role |
| --- | --- | --- |
| Data | `src/constants/constants.js`, `src/constants/templates.js` | Carb sources, salts, sweat presets, commercial gel templates |
| Evidence | `src/domain/evidence.js` | Citation registry (`CITATIONS`, `citationLabel`, `citationUrl`) |
| Domain | `src/domain/{carbs,sweat,hydration,electrolytes,caffeine,bicarbonate,schedule,recipe}.js` | One pure module per topic (plus `objects.js`, a plain-object check shared with the state layer) |
| Plan | `src/domain/plan.js` | Inputs schema v3, `normalizeInputs`, `computePlan`, `templateToInputs` |
| Text | `src/i18n/en/*.js`, `src/i18n/index.js` | English message catalogs and `t()` |
| State | `src/state/PlanProvider.jsx`, `src/state/UiProvider.jsx`, `src/state/shareCodec.js` | Inputs reducer, memoised plan, UI state, share links |
| UI | `src/app/*`, `src/components/{feature,modal,shared}` | Cards, modals, `Why` and `Warnings` |

### Data flow

```
inputs ──normalizeInputs──▶ PlanProvider state ──computePlan (useMemo)──▶ plan ──▶ components
   ▲                                                                                  │
   └──────────── set(path, value) / apply(partial) / replace / reset ◀───────────────┘
```

`src/app/page.jsx` renders `PlanProvider > UiProvider > App`. Components read
the inputs with `usePlanInputs()`, the plan with `usePlan()` and the UI state
with `useUi()`. They never compute nutrition themselves: every target, amount
and comparison they show comes from the plan (delivered carbs and energy, the
g/h on each pathway, the fluid per gel in the schedule, the mouth rinse
protocol). Components only format those numbers, convert units for display
(lb, °F, L) and draw progress rings. Every explanation or warning from the
domain goes through `t()`. Number, range and ratio formatting is shared
(`src/components/shared/format.js`), so a value reads the same in every card.

### Domain rules

- `src/domain/**` is pure: no React, no DOM, no `window`, no clocks, no
  randomness, no I/O. The same input always gives the same output, and
  arguments are never mutated.
- Domain functions never return English text. They return message descriptors
  that `t()` turns into text:

  ```js
  /** @typedef {{ key: string, params?: Record<string, string|number> }} Message */
  /** @typedef {{ summary: Message, details?: Message[], citations: string[] }} Explanation */
  /** @typedef {{ id: string, level: 'info'|'warning'|'danger', message: Message, citations?: string[] }} Warning */
  ```

- Every recommendation carries a `why` (Explanation) with citation ids. The UI
  shows it behind a "Why?" button (`src/components/shared/Why.jsx`) with links
  to the studies.
- Warning ids are stable (`carbs.aboveStudied`). Message keys are namespaced by
  module (`carbs.warn.aboveStudied`).
- Units: minutes for time, g, mg, ml, L/h, °C, kg, % humidity. Rounding happens
  only where a rule says so: `round5` for g/h, `round10` for mg/h, `round50` for
  ml/h. Unit conversion (lb, °F) is a UI concern.
- Bad numbers never throw. Missing, NaN or negative values count as 0 (or the
  documented default) in every module.

## 2. Data

### Carbohydrate sources (`constants.js`)

```js
{ id, label, carbsPerGram, glucoseContent, fructoseContent }
```

- `carbsPerGram` is the available carbohydrate per gram *as purchased*
  (dextrose monohydrate 0.91, honey 0.82).
- `glucoseContent` and `fructoseContent` split that carbohydrate between the
  glucose (SGLT1) and fructose (GLUT5) pathways and always sum to 1. Sucrose is
  50/50; maltose and maltodextrin count as glucose. A test enforces this.
- Glucose-list ids are 1–8, fructose-list ids 11–20. A source with both
  contents (sucrose, honey, maple syrup) is a *mixed* source.

### Electrolyte sources (`constants.js`)

```js
{ id, label, components: [{ name, ratio }] }
```

`ratio` is the mass fraction of the ion in the salt **as sold**, including
hydrate water (Epsom salt is MgSO₄·7H₂O, so Mg = 9.86%). There are no
absorption factors: guidance is stated as ingested amounts (sawka2007,
efsa2011), and mineral absorption varies too much to model per salt
(fine1991). Salt ids used by the rules: table salt 31, sodium citrate dihydrate
33, magnesium citrate 34, calcium citrate 35, potassium citrate 39.

### Sweat presets (`constants.js`)

- `SWEAT_RATES`: six self-assessed rates, 0.25–2.75 L/h.
- `ELECTROLYTE_CONCENTRATIONS.Sodium`: six saltiness levels, 15–90 mmol/L
  (measured range 10–90, mean about 40).
- `SWEAT_RATE_DESCRIPTIONS`, `SALTINESS_DESCRIPTIONS`: the English hints shown
  next to each preset.

IDs are stable. Share links and templates store ids; labels are display text.

## 3. Inputs (schema v3)

`DEFAULT_INPUTS` in `src/domain/plan.js` (deep-frozen):

| Section | Field | Default | Allowed |
| --- | --- | --- | --- |
| `event` | `durationMin` | 180 | 0–2880 |
| | `intensity` | `'moderate'` | `easy`, `moderate`, `hard`, `race` |
| | `highCarb` | `false` | boolean |
| `athlete` | `massKg` | 70 | 30–200 |
| | `sex` | `'unspecified'` | `unspecified`, `female`, `male` |
| `environment` | `tempC` | 20 | −20–50 |
| | `humidity` | 50 | 0–100 |
| `sweat` | `source` | `'preset'` | `preset`, `estimate` |
| | `rateIndex`, `saltinessIndex` | 2, 2 | integers 0–5 |
| `carbs` | `mode`, `ratioMode` | `'auto'` | `auto`, `manual` |
| | `manualGPerHour` | 60 | 0–200 |
| | `manualRatio` | `{ glucose: 1, fructose: 0.8 }` | parts 0–5 |
| | `glucoseSources` | `[{ id: 3, percentage: 100 }]` (maltodextrin) | glucose-list ids, percentage 0–1000 |
| | `fructoseSources` | `[{ id: 11, percentage: 100 }]` (fructose) | fructose-list ids, percentage 0–1000 |
| `sodium` | `mode` / `manualMgPerHour` | `'auto'` / 500 | 0–5000 |
| `extras` | `potassium`, `magnesium`, `calcium` | `false` | boolean |
| `salts` | `mode` | `'auto'` | `auto`, `manual` |
| | `sodiumSalt` | `'table'` | `table`, `citrate`, `mix` |
| | `manual` | `[]` | `[{ id, amountMg }]`, electrolyte ids, 0–1,100,000 mg for the whole activity |
| `fluid` | `mode` / `manualMlPerHour` | `'auto'` / 500 | 0–3000 |
| `format` | `gelsPerHour` | 3 | 0–12, rounded to 0.01 |
| | `view` | `'total'` | `total`, `perGel` |
| `caffeine` | `enabled`, `asIngredient` | `false` | boolean |
| | `mgPerKg` | 3 | 1–6 |
| | `tabletMg` | 100 | 100 or 200 |
| `bicarb` | `enabled` / `gPerKg` | `false` / 0.3 | 0.2–0.3 |

`INPUT_LIMITS` and `INPUT_OPTIONS` export these bounds so the UI controls use
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
- Source entries whose id is not in the matching list are dropped, as are
  manual salts whose id is not an electrolyte. A kept entry with a non-finite
  percentage or amount gets 0, so a row never vanishes while someone is typing.
  A list that is not an array falls back to the default list.
- `-0` becomes 0. The result is idempotent and survives a JSON round trip
  unchanged.

## 4. The plan (`computePlan`)

`computePlan(inputs)` normalizes its input first, so it accepts any value and
never throws (a fast-check property test runs it on arbitrary values). It
returns:

| Field | Content |
| --- | --- |
| `inputs`, `durationMin`, `durationH` | The normalized inputs and the duration |
| `sweat` | `resolveSweat(...)`: `rateLph`, `sodiumMmolL`, `source`, `uncertaintyLph`, `why` |
| `carbs` | `mode`, `recommended` (`recommendCarbs`), `gPerHour`, `totalG`, `deliveredG` (carbs in the recipe; 0 when the sources cannot make the ratio), `warnings`, `ratio` (`mode`, `recommended`, `value`, `share`, `glucoseGPerHour`, `fructoseGPerHour`, `warnings`), `sources` (`solveCarbSources`), `mouthRinse`, `mouthRinseHowTo` |
| `sodium` | `mode`, `recommended` (`recommendSodium`), `mgPerHour`, `totalMg`, `warnings` |
| `extras` | `recommendExtras(...)`; each ion also has `totalMg` |
| `fluid` | `mode`, `recommended` (`recommendFluid`), `mlPerHour`, `totalMl`, `warnings` |
| `salts` | `mode`, `sodiumSalt`, `items` (`[{ id, amountMg }]`), `delivered`, `comparison`, `warnings` |
| `caffeine`, `bicarb` | `planCaffeine(...)`, `planBicarbonate(...)` |
| `gels` | `{ perHour, count, times }` |
| `schedule` | `buildSchedule(...)` |
| `recipe` | `{ view, items }` from `buildRecipeItems` |
| `energy`, `cost` | `{ kcal, deliveredKcal }`, `{ diy, commercial, savings }` |
| `warnings` | Every warning above, de-duplicated by id, sorted danger > warning > info |

How the parts connect:

1. **Effective values.** `auto` uses the recommendation; `manual` uses the
   manual value. Manual values get the same evidence warnings as recommended
   ones (`carbIntakeWarnings`, `sodiumWarnings`, `fluidWarnings`).
2. **Carbs.** `totalG = gPerHour × hours`. Auto mode adds the
   recommendation's own warnings; both modes add `carbIntakeWarnings`.
3. **Ratio.** Auto uses `recommendRatio(gPerHour).ratio`. Manual uses
   `manualRatio` and adds `checkRatio` warnings.
4. **Sources.** `solveCarbSources` for the whole activity. In auto ratio mode,
   when the sources cannot make the recommended ratio, the plan tries the ends
   of the allowed range (the minimum share, then 0.5) and uses the first the
   sources can make, with info `plan.ratioSubstituted` in `carbs.ratio.warnings`.
   So at ≤ 60 g/h glucose sources alone give a 1:0 recipe, and a mixed source
   alone (honey) gives 1:1. When the sources still cannot deliver the ratio
   (and the ratio is not 0:0, which `checkRatio` already flags),
   `carbs.warnings` gets `plan.carbSourcesInfeasible`.
5. **Fluid** is computed before sodium, because the sodium concentration
   check needs the effective fluid intake.
6. **Salts.** Auto: `saltsForTargets` from the sodium and extras totals and the
   chosen sodium salt. Manual: `inputs.salts.manual`, plus `sodiumWarnings` for
   the sodium those salts deliver per hour. `comparison` covers sodium,
   potassium, magnesium and calcium. Chloride has no target, so it is left out
   of the comparison (it stays in `delivered`). A manual sodium target below
   the evidence range of an event of 120 min or more gets info
   `plan.sodiumBelowRange`.
7. **Gels.** `getGelTimes(durationMin, gelsPerHour)`. Caffeine is planned on
   those gel times, and the schedule and recipe use the same count. A plan with
   no carbs (0 g, e.g. under 45 min, 45–75 min at easy intensity or a manual
   0 g/h) has no gels: `gels.perHour` is 0, the schedule shows the start, the
   fluid and the finish, and any salt goes into the drink.
8. **Energy** is 4 kcal per g of the carb target (`kcal`) and of the carbs the
   recipe delivers (`deliveredKcal`). **Cost** is a rough estimate: 0.015 per g
   of carbs for DIY powder and 0.10 per g for commercial gels (about 2.50 per
   25 g gel).

Golden default plan (tested): 75 g/h, ratio 1:0.5, 225 g carbs (158 g
maltodextrin, 75 g fructose), sodium 570 mg/h (1,710 mg, from 4,351 mg table
salt), fluid 800 ml/h, 9 gels at 0, 20, …, 160 min with 260 or 270 ml each
(2,400 ml in total), 900 kcal, no warnings. The defaults encode to the share
payload `{"v":3}`.

`templateToInputs(template, { gPerHour })` returns a partial for `apply()`:
the template's manual ratio and sources, `gelsPerHour = gPerHour ÷
carbsPerGelG` rounded to 0.5 (1–12), and auto salts with the template's sodium
salt. The carb and sodium targets stay the same: a gel label's sodium (often
0–60 mg) is far below what most events need, so the plan keeps its
evidence-based target and the salts cover it.

## 5. Evidence rules

Citation ids in brackets refer to `src/domain/evidence.js` (section 10).

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
  every 5–10 min) and its studies [carter2004, brietzke2019]. The carb card and
  the mixing steps both show this one text.

### 5.2 Glucose:fructose ratio (`recommendRatio`, `checkRatio`)

Fructose share = fructose-pathway carbs ÷ total carbs. The maximum share is
always 0.5 (never more fructose than glucose).
[jeukendrup2014, rowlands2015, obrien2013, podlogar2022, wallis2005]

| Intake | Minimum share | Recommended |
| --- | --- | --- |
| ≤ 60 g/h | 0 (glucose alone works) | 1/3 (1:0.5) |
| 60–90 g/h | 1/3 | 1/3 (1:0.5) |
| > 90 g/h | rises linearly to 0.444 at 120 g/h | same as minimum (1:0.8 at 120 g/h) |

The ratio is shown as `1:x` with `x = round2(share / (1 − share))`, in every
card (a manual 0.95:0.85 reads `1:0.89` everywhere).
`checkRatio` (manual ratios only): 0:0 → danger `carbs.noRatio`; share below
`minShare − 0.02` → warning `carbs.tooLittleFructose`; share above 0.52 →
warning `carbs.tooMuchFructose`.

### 5.3 Carb intake warnings (`carbIntakeWarnings`)

- Above 120 g/h → danger `carbs.aboveStudied` [podlogar2022, hearris2022].
- Above 90 g/h → warning `carbs.gutTraining` [jeukendrup2017, cox2010].

These apply to manual targets too.

### 5.4 Carb source solver (`solveCarbSources`)

1. Targets: glucose and fructose pathway carbs from the ratio parts.
2. **Mixed sources first.** Each covers `percentage`% of the target of the list
   it sits in: grams = `target × pct ÷ (content × carbsPerGram)`. Its share of
   the other pathway is counted.
3. **Pure sources** fill what each pathway still needs, split in proportion to
   their percentages (pure-source percentages are normalised, so they need not
   add up to 100).
4. **Feasibility.** If delivered glucose, fructose or total misses the target by
   more than `max(0.5 g, 1% of total)`, the ratio is unreachable:
   `canAchieveRatio: false`, no items, and the plan warns
   (`plan.carbSourcesInfeasible`). The source list and the recipe card show
   that warning.

Unknown ids are ignored. Each item reports `grams`, `carbsG`, `glucoseG`,
`fructoseG` and the list it came from (`pathway`). A property test checks that
grams are finite and non-negative and that feasible results hit the targets.

### 5.5 Sweat (`resolveSweat`, interim)

- `preset`: `SWEAT_RATES[rateIndex]`, uncertainty ±0.5 L/h.
- `estimate`: the legacy formula `base(sex) × factor(intensity) + (tempC − 15)
  × 0.03 + (humidity − 50) × 0.005`, clamped to 0.3–3.5 L/h, uncertainty
  ±0.4 L/h. Base: male 0.8, female 0.5, unspecified 0.65. Factor: easy 0.8,
  moderate 1.2, hard 1.5, race 1.8. This is a rough proxy, not a validated
  model.
- Sweat sodium always comes from the saltiness preset.
- Citations: baker2017, barnes2019.

### 5.6 Fluid (`recommendFluid`, `fluidWarnings`)

- `mlPerHour = round50(min(sweatRate × 1000 × 0.8, 800))`; 0 when the sweat
  rate is 0. Replacing about 80% of sweat loss avoids weight gain.
  [sawka2007, hewbutler2015]
- The guideline range shown is 400–800 ml/h [sawka2007].
- `drinkToThirst` when the event is under 90 min or colder than 15 °C
  [kenefick2018]; the explanation then adds the drink-to-thirst hint.
- Warnings: intake above the sweat rate → danger `fluid.aboveSweat` (weight
  gain is the main risk factor for exercise-associated hyponatremia)
  [almond2005, hewbutler2015]; otherwise above 800 ml/h → warning
  `fluid.aboveCeiling` [sawka2007].

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
  The message shows the mg/h rounded to whole mg (manual salts give any
  per-hour amount); the thresholds use the unrounded value.
- Sodium per litre of planned fluid above 1725 mg/L (75 mmol/L) → warning
  `electrolytes.concentrationHigh` [efsa2011, range 460–1150 mg/L]. This
  divides all the plan's sodium by all its fluid, so it is not the
  concentration of any one drink.

### 5.8 Potassium, magnesium, calcium (`recommendExtras`)

Optional, off by default, under "Advanced" in the UI. Each enabled ion
replaces half of a typical sweat loss: `0.5 × sweatRate × mmol/L × mg/mmol`
with 4.5 (K), 0.05 (Mg) and 0.5 (Ca) mmol/L, capped at 300, 50 and 100 mg/h.
Potassium is rounded to 10 mg/h, magnesium and calcium to whole mg. The
explanation says there is no evidence they prevent cramps.
[baker2017, montain2007]

### 5.9 Salts (`saltsForTargets`, `deliveredIons`, `compareIons`)

- `saltsForTargets`: sodium from table salt (`table`), sodium citrate
  (`citrate`) or half from each (`mix`); potassium, magnesium and calcium from
  their citrates. Amounts are whole-activity mg, rounded to whole mg; zero
  amounts are left out.
- `deliveredIons`: `Σ amount × ratio` per ion, no absorption factors.
- `compareIons`: `|diff| ≤ max(1 mg, 2% of target)` → `met`; otherwise
  `short` or `over`.

### 5.10 Caffeine (`planCaffeine`)

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
  150 min apart, so no two share a gel.
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

### 5.11 Sodium bicarbonate (`planBicarbonate`)

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

### 5.12 Schedule (`buildSchedule`)

- Gels: the first at the start, then one every `60 ÷ gelsPerHour` min while the
  activity lasts (`getGelTimes`). The per-gel recipe divides by the same count,
  so recipe and schedule always agree (75 min at 2/h = 3 gels).
- Events, sorted by time: `bicarb` at −90 min; pre-race `caffeine`; `start`
  (with the first gel when there are gels); one `fuel` per later gel, with
  `caffeineMg` when a tablet dose rides on that gel; intra `caffeine` doses
  without a gel; a single `hydration` event when there is fluid but no gel
  carries it; `finish` at the end.
- Fluid per gel (`fluidMl`, on the start gel and every fuel event): the fluid
  for the time until the next gel, or until the finish for the last gel. A full
  interval is `fluidMlPerHour × interval ÷ 60`. Amounts are rounded down to
  10 ml on the running total, so each is within 10 ml of its exact share and
  together they are the plan's fluid rounded down to 10 ml: the schedule never
  lists more than the plan (61 min at 1 gel/h and 800 ml/h → 800 + 10 ml, not
  2 × 800). When a full interval would carry under 5 ml, a `hydration` event
  states the rate instead. The mixing steps take their fluid from these
  events.
- Times show as `formatElapsed`: `T+1h 20m`, and `T−1h 30m` before the start.

### 5.13 Recipe (`buildRecipeItems`)

One list feeds the recipe card, the mixing steps and the share image. Order:
glucose-list carbs, fructose-list carbs, salts, caffeine tablets (one item per
gel with caffeine). Pre-race caffeine is in the schedule, not the recipe. The
`perGel` view divides by the gel count (at least 1). `formatAmount`: grams as
whole g ("53 g"); mg below 1000 as mg ("870 mg"), from 1000 as g with one
decimal ("4.4 g").

## 6. Guard rails

| Rule | Value | Where |
| --- | --- | --- |
| Carb intake | warning above 90 g/h, danger above 120 g/h | `carbIntakeWarnings` |
| High-carb band | only for events over 150 min; gut-training warning above 90 g/h | `recommendCarbs` |
| Ratio | never recommends more fructose than glucose; 0:0 is a danger | `recommendRatio`, `checkRatio` |
| Sodium target | never recommended above 1500 mg/h; warning above 1000, danger above 1500 | `recommendSodium`, `sodiumWarnings` |
| Sodium concentration | warning above 1725 mg/L of planned fluid | `sodiumWarnings` |
| Fluid | ≈ 0.8 × sweat rate (rounded to 50 ml/h), ≤ 800 ml/h; danger above sweat rate | `recommendFluid`, `fluidWarnings` |
| Schedule fluid | the fluid listed with the gels never exceeds the planned total | `buildSchedule` |
| Caffeine | 1–6 mg/kg; body load never above 6 mg/kg; tablets only, never powder | `planCaffeine` |
| Bicarbonate | 0.2–0.3 g/kg; hidden for events over 90 min; warns about GI, sodium and medical conditions | `planBicarbonate` |
| Inputs | every field clamped or validated; share links pass the same check | `normalizeInputs` |

Warnings render through `src/components/shared/Warnings.jsx`: one box per
warning, coloured and iconed by level (danger red with an octagon, warning
amber with a triangle, info blue with an "i"), a screen-reader prefix
("Danger:", "Warning:", "Note:") and the citation links.

## 7. Templates (`src/constants/templates.js`)

Eight commercial gels, researched from manufacturer pages and nutrition
panels (checked 2026-10). Each records carbs, sodium and caffeine per gel, the
glucose:fructose ratio, the matching source ids, the sodium salt, other
ingredients, source URLs and notes.

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
(section 4).

## 8. Share links (v3)

- `?s=` holds base64url (UTF-8, no padding) JSON `{ v: 3, ...diff }`, where
  `diff` holds only the input fields that differ from `DEFAULT_INPUTS`. Objects
  are compared field by field; arrays and values are stored whole. The defaults
  encode to `{"v":3}`; a 4 h event is `{"v":3,"event":{"durationMin":240}}`.
- Decoding runs the payload through `normalizeInputs`, so a link can never put
  invalid values into the app. A payload that is not base64url, UTF-8 JSON or
  an object, or has any other version (v2 included), decodes to `null`.
- `PlanProvider` reads `?s=` once on mount. An unreadable link (damaged, or
  from an older version) logs `Ignoring unreadable share link`, keeps the
  defaults, removes `s` from the address bar and sets `shareLinkFailed`; the
  app then shows a toast saying the shared plan could not be loaded. The URL is
  not rewritten while you edit; the Share modal builds a fresh link.
- Display units (kg/lb, °C/°F) are not part of the link.

## 9. Text, state and UI

- **i18n.** `src/i18n/en/<module>.js` holds the English text per domain module
  (bicarb, caffeine, carbs, electrolytes, fluid, plan, recipe, schedule,
  sweat). `t(messageOrKey, params)` fills `{name}` placeholders (numbers with
  `toLocaleString('en-US')`). A missing key returns the key and warns once in
  development. Tests walk the plan over random inputs and check that every key
  it can return exists and every placeholder is filled. UI labels are still
  English literals in the components.
- **`PlanProvider`.** A reducer over the inputs with actions `set(path,
  value)` (dot path or key array, numeric segments index arrays, value may be an
  updater), `apply(partial)` (deep merge, arrays replace), `replace(inputs)`
  (onto the defaults) and `reset()`. Every action goes through
  `normalizeInputs`; a no-op keeps the same state object, so the plan is not
  recomputed. `usePlanInputs()` and `usePlan()` throw outside the provider.
- **`UiProvider`.** One open modal at a time (`TEMPLATE_MODAL`,
  `SHARE_MODAL`, `MIXING_MODAL`, exported so openers and modals use the same
  names), the share view, a toast with a 3 s timer, the recipe ref for PDF
  export, and the display units `massUnit` (`kg`/`lb`) and `tempUnit`
  (`C`/`F`). The inputs always store kg and °C.
- **Shared controls.** `src/components/shared/`: `Segmented` (with the
  Auto/Adjust options), `NumberInput` (keeps typed text while focused, commits
  in-range values live and any value on blur), `format.js` (`fmt`,
  `formatRange`, `formatRatio`, `shareToRatio`), `recipe.js` (recipe item
  labels and the warnings that explain a recipe without carbs) and `labels.js`.
  Amber and green text uses the `apple-amber-ink` / `apple-green-ink` colors,
  dark in the light theme so it stays readable (at least 6:1).
- **Cards.** Activity Basics (duration, intensity, mass, temperature,
  humidity, carb target, caffeine, bicarbonate), Electrolytes & Hydration
  (sweat, sodium, extras, salts, fluid), Carb Matrix (ratio and sources), Final
  Recipe, Balance Analysis (carbs, sodium, fluid and energy rings plus the
  ratio bar) and the Timeline. The carb target, ratio, sodium and fluid each
  show their value, range, a "Why?" control and an Auto/Adjust switch.
  Switching to Adjust starts from the current value, so nothing jumps.
  Caffeine and bicarbonate have an on/off switch and a "Why?" control. The
  recipe card, the mixing steps and the share image show the carbs the recipe
  delivers and, when it has none, the warning that says why.

## 10. Citation registry

`src/domain/evidence.js` holds 32 citations (authors, year, title, journal,
DOI). `citationLabel(id)` gives "Jeukendrup 2014" or "Podlogar et al. 2022";
`citationUrl(id)` gives `https://doi.org/<doi>`. Tests check that every
citation id the plan can return exists in the registry.

| Topic | Citation ids |
| --- | --- |
| Carb target | jeukendrup2014, thomas2016, burke2011, smith2013 |
| High carb, gut training | podlogar2022, hearris2022, jeukendrup2017, cox2010 |
| Ratio | rowlands2015, obrien2013, wallis2005 (plus jeukendrup2014, podlogar2022) |
| Mouth rinse | carter2004, brietzke2019 |
| Sweat | baker2017, barnes2019 (baker2019 backs the preset data) |
| Fluid | sawka2007, hewbutler2015, kenefick2018, almond2005 |
| Sodium | sawka2007, mccubbin2023, hoffman2015, delcoso2016, baker2017, efsa2011 |
| Extras, salts | montain2007, baker2017 (fine1991 backs "no absorption factors") |
| Caffeine | guest2021, carvalho2022, efsa2015, talanian2016 |
| Bicarbonate | grgic2021, deoliveira2022 |

## 11. Tests

- **Unit and golden tests** (Vitest, colocated `*.test.js`). Every evidence
  rule has a test whose comment names its citation, e.g.
  `// [jeukendrup2014] >2.5 h: up to 90 g/h`.
- **Property tests** (fast-check): the carb solver, the caffeine body-load cap,
  `normalizeInputs` idempotence, and `computePlan` never throwing or returning
  NaN or Infinity.
- **Component tests** render the real providers and assert real plan numbers.
- **Smoke tests** (Playwright, `e2e/smoke.spec.js`, desktop and phone) run
  against the static export: no console errors, header and recipe present, no
  horizontal overflow on a phone, the default plan (75 g/h, non-empty recipe),
  a duration change to 1 h giving 15 g/h, a "Why?" control revealing a
  citation link, a v3 share link restoring a 240 min event, and a v2 link
  showing the "could not be loaded" notice without overflowing a phone.

## 12. Known limitations

- **Sweat rate** is a self-assessed preset or a linear estimate that ignores
  body mass and metabolic rate. The ±0.4–0.5 L/h uncertainty is shown, not
  propagated.
- **No water or concentration output.** The recipe lists powders and salts but
  not how much water to mix them with, and there is no osmolality check.
- **Carb source percentages** mean different things for mixed sources
  (absolute share of their list's target) and pure sources (normalised).
- **Sodium concentration** is checked as all planned sodium over all planned
  fluid, not per drink or gel.
- **Energy** has two values: from the carb target (`energy.kcal`, used for the
  plan) and from the carbs the recipe delivers (`energy.deliveredKcal`); the
  Balance Analysis ring compares them.
- **Cost** uses two fixed per-gram prices in an unnamed currency.
- **Templates:** four of eight labels are not fully verified.
- **Nothing is saved.** Reloading the page loses changes unless they are in a
  share link.
- **UI text** outside domain messages is hard-coded English; only kg/lb and
  °C/°F conversion exist.

## 13. What the next phases change

- **Phase 2:** a sweat test (body mass before and after) and a heat-balance
  sweat estimate replace `estimateSweatRateLegacy`; water amounts, drink
  concentration and osmolality; one ingredient list with a single solver for
  carbs and salts (removing the glucose/fructose list split and the mixed vs
  pure percentage rule); autosave, saved recipes and a print view (fed by
  `buildRecipeItems`). Input changes bump the share link version.
- **Phase 3:** the race-day redesign (layout C: the key numbers, schedule and
  recipe in one view), a guided mode, an accessibility pass, German text with
  all UI labels moved to i18n, more units (oz) and a chosen currency for cost.
