# Gel Calculator: Systems & Logic

This document describes how the calculator works **as implemented**. Where the
logic is a known simplification that is scheduled for revision, it says so.

## 1. Architecture

The app is a single-page Next.js app exported as static HTML (`output: 'export'`,
`basePath: '/gel-calculator'`) and deployed to GitHub Pages. All calculation
happens in the browser.

| Layer | Files | Role |
| --- | --- | --- |
| Data | `src/constants/constants.js` | Carb sources, salts, sweat tables, templates |
| Pure logic | `src/lib/shareCodec.js`, `src/lib/schedule.js`, `src/lib/safety.js` | Share links, gel timing, guard rails (unit-tested) |
| State hooks | `src/hooks/useCalculator.js` and `useCarbCalculation`, `useElectrolyteCalculation`, `useStrategyCalculation` | React state plus memoised calculations |
| Context | `src/context/CalculatorContext.jsx` | Exposes `useCalculator()` to all components |
| UI | `src/components/{feature,modal,shared}` | Cards, modals, shared widgets |

## 2. Data

### Carbohydrate sources

```js
{ id, label, carbsPerGram, glucoseContent, fructoseContent }
```

- `carbsPerGram` is the available carbohydrate per gram *as purchased* (e.g.
  dextrose monohydrate 0.91, honey 0.82).
- `glucoseContent` and `fructoseContent` split that carbohydrate between the
  glucose (SGLT1) and fructose (GLUT5) pathways and **always sum to 1**. Sucrose
  counts 50/50; maltose and maltodextrin count as glucose. A test enforces this.

Sources are listed under "glucose" or "fructose" for the UI; a source with both
contents (sucrose, honey, …) is a *mixed* source.

### Electrolyte sources

```js
{ id, label, components: [{ name, ratio, absorptionRate }] }
```

- `ratio` is the mass fraction of the ion in the salt **as sold**, including
  hydrate water, and the label names the form, e.g. Epsom salt is
  MgSO₄·7H₂O, so Mg = 9.86%.
- `absorptionRate` is a rough intestinal-absorption estimate. Published
  guidance expresses electrolyte targets as *ingested* amounts, so this factor
  is slated for removal (see the proposals).

### Sweat tables

- `SWEAT_RATES`: six presets from 0.25 to 2.75 L/h.
- `ELECTROLYTE_CONCENTRATIONS` (mmol/L) per saltiness level: sodium and
  chloride 15–90 (measured range 10–90, mean ≈ 40); potassium 4.5, magnesium
  0.05 and calcium 0.5 at every level, because they do not track sodium.
- `CONVERSION_FACTORS`: mg per mmol (Na 23, Cl 35.5, K 39.1, Mg 24.3, Ca 40.1).

IDs are stable and used by share links and templates; labels are display text.

## 3. Carbohydrate calculation (`useCarbCalculation`)

1. `totalCarbs = carbsPerHour × hours`.
2. The glucose:fructose parts set the targets:
   `targetGlucose = G / (G + F) × totalCarbs`, likewise for fructose.
3. **Mixed sources first.** Each mixed source covers `percentage`% of the target
   of the list it sits in. Grams = `target × pct / (content × carbsPerGram)`.
   Its "bleed" into the other pathway is accounted for.
4. **Pure sources** fill what is left of each pathway, split in proportion to
   their percentages (pure-source percentages are normalised, so they need not
   add up to 100).
5. **Feasibility.** If the delivered glucose, fructose or total differs from the
   target by more than `max(0.5 g, 1%)`, the ratio is unreachable with the
   chosen sources: `canAchieveRatio = false`, the recipe is emptied and the UI
   asks for another source.

Calories are `totalCarbs × 4 kcal`.

## 4. Electrolyte targets (`useElectrolyteCalculation`)

Targets are mg per hour and come from one of three modes:

| Mode | Source of the target |
| --- | --- |
| Sweat profile | `sweatRate (L/h) × concentration (mmol/L) × mg/mmol` for each active electrolyte |
| Manual | The user's mg/h values for each active electrolyte |
| Smart suggestions | Estimated sweat rate × 20/40/60 mmol/L sodium (and chloride); K, Mg, Ca are 0 |

**Safety cap.** Estimated (non-manual) sodium targets are capped at
1,500 mg/h; chloride is scaled by the same factor. Manual targets are never
capped but trigger the same warnings (`lib/safety.js`). Typical guidance is
300–600 mg/h, up to ~1,000 mg/h for heavy, salty sweaters in long events.

**Analysis.** For each electrolyte, the delivered amount is
`Σ amount × ratio × absorptionRate` over the added salts, compared with
`target × hours`. Differences within 1 mg count as "Target met".

**Auto-fill** replaces the electrolyte list:

1. Table salt covers chloride, limited so it does not exceed sodium.
2. Any remaining sodium comes from sodium citrate; potassium, magnesium and
   calcium come from their citrates.

Each amount is `remaining target / (ratio × absorptionRate)`, rounded to whole mg.
Salt amounts in the list are **totals for the whole activity**.

## 5. Smart suggestions (`useStrategyCalculation`)

The current model, which the proposals replace with evidence-based rules:

- **Carbs:** a base by duration (<1 h: 30 g/h glucose only; 1–2.5 h: 45 g/h at
  2:1; >2.5 h: 75 g/h at 2:1, or 90 g/h at 1:0.8 in ultra mode), multiplied by
  intensity (0.8 / 1.2 / 1.5 / 1.8) and clamped to 30–120 g/h.
- **Sweat rate:** `base (0.8 male / 0.5 female) × intensity + (T − 15 °C) × 0.03
  + (RH − 50) × 0.005`, clamped to 0.3–3.5 L/h.
- **Caffeine:** <2 h: one pre-race dose of 2 mg/kg (naive) or 5 mg/kg
  (habituated); 2–5 h: 100 mg pre plus 1 mg/kg/h; >5 h: 75 mg/h from halfway.
  A dose above 6 mg/kg in any 2 h window is capped with a warning.
- **Bicarbonate:** 300 mg/kg 90 min before; its sodium load (27.4%) is shown.

## 6. Schedule and hydration

- Gels are taken at `0, interval, 2·interval, …` while the activity lasts
  (`lib/schedule.js`). The per-gel recipe divides the batch by the same count,
  so the recipe and the schedule always agree (e.g. 75 min at 2/h = 3 gels).
- Suggested drinking is `min(0.8 × sweat rate, 800 ml/h)`, always below the
  sweat-rate estimate, together with "drink to thirst / never gain weight"
  advice to avoid exercise-associated hyponatremia.

## 7. Share links

`?s=` holds base64url-encoded JSON `{ v: 2, … }` containing only fields that
differ from `DEFAULT_SHARE_STATE`. Sources are `[id, value]` pairs. Decoding
validates every field (known source IDs, finite non-negative numbers, enum
values) and ignores anything else. Links from before v2 are not supported.

## 8. Guard rails (`lib/safety.js`)

| Rule | Value |
| --- | --- |
| Estimated sodium target cap | 1,500 mg/h (warning above 1,000 mg/h) |
| Suggested fluid | ≤ 0.8 × sweat rate and ≤ 800 ml/h |
| Carb warnings | above 90 g/h (gut training), above 120 g/h (beyond studied intakes) |

## 9. Known limitations

- The `absorptionRate` factors inflate salt amounts and are not how guidance is
  expressed.
- Smart-mode carbs scale *up* with intensity; the evidence supports duration
  bands and, if anything, scaling *down* at low intensity.
- The sweat-rate model ignores body mass and metabolic rate.
- Mixed and pure carb sources treat percentages differently (absolute vs
  normalised).
- No water or concentration output yet.
