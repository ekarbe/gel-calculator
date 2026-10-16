# Gel-Calculator 🧪⚡

A web application designed for endurance athletes to calculate personalized energy gel or drink mix recipes. Determine the right mix of carbohydrates (controlling the glucose-to-fructose ratio), electrolytes and water based on your activity, the conditions and your sweat rate.

**Live App:** [https://eikekarbe.com/gel-calculator](https://eikekarbe.com/gel-calculator)

![Gel-Calculator Screenshot](https://raw.githubusercontent.com/ekarbe/gel-calculator/refs/heads/main/assets/APP.PNG)

## Key Features

* **Evidence-Based Targets:** Carbohydrate (g/h), glucose:fructose ratio, sodium (mg/h) and fluid (ml/h) are recommended from your duration, intensity and sweat rate. Each shows its range and a "Why?" explanation with links to the studies, and each can be adjusted by hand.
* **Sweat Rate Three Ways:** Enter a sweat test (body mass before and after, fluid and urine), use a heat-balance estimate from your sport, speed or power, body size, temperature, humidity, sun and air flow, or pick a self-assessed preset. A test can be scaled to race-day conditions.
* **Body-Mass Projection:** See how much water you will lose (or gain) and what the scale will show after the activity, with warnings above 2–3% loss and for any gain.
* **One Ingredient List:** Pick powders and syrups (maltodextrin, dextrose, fructose, sucrose, honey, maple syrup and more), give each a preference weight, or add your own ingredient from its label. The calculator finds the amounts that hit the ratio and shows which ratios your ingredients can make.
* **Electrolytes:** Potassium, magnesium and calcium are optional. Let the calculator choose table salt, sodium citrate or a mix, or enter your own salt amounts in grams, including salts typed in from a label.
* **Gel, Drink or Both:** Choose the gel consistency (isotonic-style, liquid, standard, thick) or the bottle size. The recipe includes the water to add, the volume per gel or bottle and an osmolality estimate with a tonicity chip, and warns when a drink is too strong or a gel needs water.
* **Caffeine & Sodium Bicarbonate:** Optional dose plans with safety limits, including caffeine tablets added to specific gels.
* **Templates:** Start from the ratio, sources and sodium of eight commercial gels, with label sources.
* **Safety Warnings:** Clear warnings when a value goes beyond the studied or recommended range.
* **Total / Per Serving View:** Toggle the recipe between amounts for the whole activity and per gel or bottle.
* **Mixing Instructions:** Step-by-step mixing for each gel batch and drink bottle.
* **Autosave & My Recipes:** Your plan is saved in the browser as you go. Save named recipes, then open, rename, duplicate, delete or share them.
* **Print / Save as PDF:** A clean printout with the plan summary, recipe, mixing steps, schedule, warnings and references.
* **Light & Dark Mode:** Adapts to your system's theme preference.
* **Responsive Design:** Usable across different screen sizes.

## Getting Started

Prerequisite: Node.js 24 (current LTS; CI builds with it). Follow these steps to set up and run the project locally:

1. **Clone the repository:**

    ```bash
    git clone https://github.com/ekarbe/gel-calculator.git
    cd gel-calculator
    ```

2. **Install dependencies:**

    ```bash
    npm install
    # or
    # yarn install
    # or
    # pnpm install
    # or
    # bun install
    ```

3. **Run the development server:**

    ```bash
    npm run dev
    # or
    # yarn dev
    # or
    # pnpm dev
    # or
    # bun dev
    ```

4. **Open your browser:**
    Navigate to [http://localhost:3000/gel-calculator](http://localhost:3000/gel-calculator)

The main application page is located at `src/app/page.jsx`.

5. **Run the checks** (CI runs the same before every deploy):

    ```bash
    npm run lint
    npm test -- --run
    npm run build                     # static export to ./out
    npx playwright install chromium   # once
    npm run test:e2e                  # smoke tests against ./out
    ```

    To use a Chromium you already have, set `PW_CHROMIUM_EXECUTABLE=/path/to/chromium` for `npm run test:e2e`.

## How It Works

1. **Activity Basics:** Enter the duration (hours and minutes), intensity and sport. Running takes your speed (the pace is shown), cycling your power (or the speed, from which the power is estimated), other sports an effort in METs. Add your body mass (kg or lb), height and whether you are heat acclimatised, then the temperature (°C or °F), humidity, setting (outdoors, indoors with or without a fan) and sun. The calculator picks a carbohydrate target from the duration and places it by intensity. For example, 3 h at moderate intensity gives 75 g/h in a 60–90 g/h range, and 1 h gives 15 g/h or a mouth rinse. Events under 45 min need no carbs, so the plan has no gels. Events over 2.5 h offer a "Gut-trained" option for 90–120 g/h.
2. **Why? and Adjust:** The carb target, ratio, sodium and fluid each show the recommended value, the evidence range and a "Why?" button that explains the rule and links to the studies. Switch to **Adjust** to set your own value. You still get the same safety warnings.
3. **Caffeine and bicarbonate (optional):** Turn on caffeine (1–6 mg/kg) for a pre-race dose and, in longer events, late doses. The plan keeps caffeine in your body under 6 mg/kg. "Add to gels as tablets" puts the in-race doses into specific gels as half or whole 100 or 200 mg tablets. Sodium bicarbonate is meant for short, hard events; for events over 90 min it sits behind a "Show" link.
4. **Sweat rate:** Choose **Test**, **Estimate** or **Presets**. A sweat test uses your body mass before and after a session, what you drank and any urine, corrected for the mass you lose by burning fuel. With "Scale the test to this event" on, the heat-balance model scales your measured rate by how much it predicts the race conditions change it (0.5 to 2 times); a test in the race's own conditions keeps your measured rate. The estimate works out the heat your body must lose by sweating (typical error ±0.5 L/h) and warns when the heat cannot be lost at all. In cool weather it can predict almost no sweat, because it assumes light race kit and a steady pace: the app then says so and suggests drinking to thirst or a sweat test. Your saltiness preset gives the sweat sodium for every source.
5. **Electrolytes & Hydration:** Sodium starts at about half your estimated sweat sodium loss, within the guideline range for the duration. Fluid is about 80% of your sweat loss and at most 800 ml/h, so you never plan to drink more than you sweat. Next to the fluid target you see the projected change on the scale and the water deficit as a share of body mass. Potassium, magnesium and calcium are optional under "Advanced". Salts are worked out for you (table salt, sodium citrate or a mix), or you can enter your own amounts in grams and add salts from a label.
6. **Carb Ratio and Ingredients:** The glucose:fructose ratio follows your carb target: 1:0.5 up to 90 g/h, rising to 1:0.8 at 120 g/h. Up to 60 g/h glucose alone also works. Add ingredients to one list and set a weight for each: the calculator keeps the amounts as close to your weights as the ratio allows. A bar shows which ratios your ingredients can make, and you get a warning when they cannot make the target. Custom ingredients take their carbs per 100 g and fructose share from the label.
7. **Recipe:** "Final Recipe" lets you pick a gel, a drink or both, the gel consistency, the bottle size and the drink's share of the carbs. Each part lists its ingredients and the water to add, for the whole activity or per gel or bottle, with the gel mass and volume or the bottle fill, the osmolality and any warnings. With 0 gels per hour (or no carbs for gels) everything goes into the drink, and the drink's strength and osmolality checks cover all of it. It shows a rough cost, opens step-by-step mixing instructions and prints a clean copy ("Print / save as PDF").
8. **Analysis and Schedule:** "Balance Analysis" compares carbs, sodium, fluid and energy with the plan, shows your sweat rate with its source and uncertainty, the projected body-mass change and the delivered ratio. The timeline lists every gel, drink sip, caffeine and bicarbonate dose with its time (T−1h 30m, T+20m, …).
9. **Templates:** Load the sugar ratio, carb sources and sodium salt of a commercial gel (GU, Honey Stinger, Maurten, BPN, SiS, Precision Fuel & Hydration, GU Roctane, UnTapped). Your carb and sodium targets stay the same. Each template links to its label sources and says whether every value was verified.
10. **Saving and sharing:** Your inputs are autosaved in this browser and come back when you reload. "My recipes" saves named plans you can open, rename, duplicate, delete or copy as a link. Share a link that restores your inputs, or download an image of the recipe. Links from the previous version (v3) still open; older links cannot be loaded, and the app says so.

See [CORE.md](CORE.md) for every rule, number and citation.

![Gel-Recipe](https://raw.githubusercontent.com/ekarbe/gel-calculator/refs/heads/main/assets/RECIPE.PNG)

## Configuration & Data

* **Ingredients:** Carbohydrate sources (carbs per gram, glucose/fructose split, osmoles per gram, water content, powder or syrup) and salts (ion shares, osmoles per gram) are defined in `src/constants/constants.js`. Salt ratios are the ion's share of the salt **as sold**, including hydrate water (e.g. Epsom salt is the heptahydrate), so check that the form named in the app matches your product. There are no absorption factors: targets are amounts you take in, as guidelines state them.
* **Sweat presets:** The six sweat rates, six sweat sodium levels and their descriptions are in the same file.
* **Templates:** Commercial gel data, with label source links, the month checked and a `verified` flag, is in `src/constants/templates.js`.
* **Rules:** Each topic has a pure module in `src/domain/` (`carbs`, `solver`, `heatBalance`, `sweat`, `hydration`, `electrolytes`, `concentration`, `caffeine`, `bicarbonate`, `schedule`, `recipe`). Thresholds are named constants in each module. `src/domain/plan.js` holds the input defaults and limits (`DEFAULT_INPUTS`, `INPUT_LIMITS`) and `computePlan`, which builds the whole plan the UI shows.
* **Evidence:** The citation registry (authors, year, title, journal, DOI) is `src/domain/evidence.js`.
* **Text:** Explanations and warnings are message keys. Their English text is in `src/i18n/en/<module>.js`.
* **State:** `src/state/` holds the plan provider (with the autosave), the UI provider, the share link codec (version 4; version 3 links are migrated, older links are not loaded and the app tells the visitor) and the browser storage for the autosave and saved recipes (`localStorage` keys `gel-calculator:autosave` and `gel-calculator:recipes`).

## Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the issues page or submit a pull request.

## License

See the [LICENSE](LICENSE.md) file for license rights and limitations (GPLv3).

    Gel-Calculator - Personalized fuel calculator for endurance athletes.
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
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

## Acknowledgements

* Built by Eike Christian Karbe.