# Gel-Calculator 🧪⚡

A web application designed for endurance athletes to calculate personalized energy gel or drink mix recipes. Determine the right mix of carbohydrates (controlling the glucose-to-fructose ratio) and electrolytes based on your activity duration and sweat profile.

**Live App:** [https://eikekarbe.com/gel-calculator](https://eikekarbe.com/gel-calculator)

![Gel-Calculator Screenshot](https://raw.githubusercontent.com/ekarbe/gel-calculator/refs/heads/main/assets/APP.PNG)

## Key Features

* **Evidence-Based Targets:** Carbohydrate (g/h), glucose:fructose ratio, sodium (mg/h) and fluid (ml/h) are recommended from your duration, intensity and sweat profile. Each shows its range and a "Why?" explanation with links to the studies, and each can be adjusted by hand.
* **Glucose/Fructose Ratio Control:** Follow the recommended ratio or set your own with sliders.
* **Multiple Carb Sources:** Select from various glucose and fructose sources (e.g., Maltodextrin, Dextrose, Sucrose, Fructose, Maple Syrup) and define their percentage contribution.
* **Electrolytes:** Pick your sweat rate and saltiness (or use a rough estimate). Potassium, magnesium and calcium are optional.
* **Salts:** Let the calculator choose table salt, sodium citrate or a mix, or enter your own salt amounts and compare delivered vs target.
* **Caffeine & Sodium Bicarbonate:** Optional dose plans with safety limits, including caffeine tablets added to specific gels.
* **Templates:** Start from the ratio, sources and sodium of eight commercial gels, with label sources.
* **Safety Warnings:** Clear warnings when a value goes beyond the studied or recommended range.
* **Recipe Generation:** Calculates the required grams/milligrams of each selected carb and electrolyte source.
* **Per Gel / Full Batch View:** Toggle the recipe view between amounts needed for the entire duration or per individual gel (based on configurable gels per hour).
* **Mixing Instructions:** Provides a step-by-step guide for mixing the calculated recipe in a modal.
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

## How It Works

1. **Activity Basics:** Enter the duration (hours and minutes), intensity, body mass (kg or lb), temperature (°C or °F) and humidity. The calculator picks a carbohydrate target from the duration and places it by intensity. For example, 3 h at moderate intensity gives 75 g/h in a 60–90 g/h range, and 1 h gives 15 g/h or a mouth rinse. Events under 45 min need no carbs, so the plan has no gels. Events over 2.5 h offer a "Gut-trained" option for 90–120 g/h.
2. **Why? and Adjust:** The carb target, ratio, sodium and fluid each show the recommended value, the evidence range and a "Why?" button that explains the rule and links to the studies. Switch to **Adjust** to set your own value. You still get the same safety warnings.
3. **Caffeine and bicarbonate (optional):** Turn on caffeine (1–6 mg/kg) for a pre-race dose and, in longer events, late doses. The plan keeps caffeine in your body under 6 mg/kg. "Add to gels as tablets" puts the in-race doses into specific gels as half or whole 100 or 200 mg tablets. Sodium bicarbonate is meant for short, hard events; for events over 90 min it sits behind a "Show" link.
4. **Electrolytes & Hydration:** Pick your sweat rate and saltiness, or use the rough estimate. Sodium starts at about half your estimated sweat sodium loss, within the guideline range for the duration. Fluid is about 80% of your sweat loss and at most 800 ml/h, so you never plan to drink more than you sweat. The schedule splits that fluid across the gels by the time each one covers, so the amounts it lists add up to the plan and never more. Potassium, magnesium and calcium are optional under "Advanced". Salts are worked out for you (table salt, sodium citrate or a mix), or you can enter your own amounts and compare delivered vs target.
5. **Carb Ratio and Sources:** The glucose:fructose ratio follows your carb target: 1:0.5 up to 90 g/h, rising to 1:0.8 at 120 g/h. Up to 60 g/h glucose alone also works, so glucose-only sources still give a recipe. Add glucose and fructose sources with their percentages. The calculator works out the grams and warns when the sources cannot make the ratio.
6. **Recipe:** "Final Recipe" lists every ingredient for the whole batch or per gel, using your gels per hour. It also shows a rough cost, exports a PDF and opens step-by-step mixing instructions, including how much to drink with each gel.
7. **Analysis and Schedule:** "Balance Analysis" compares carbs, sodium, fluid and energy with the plan and shows the ratio. The timeline lists every gel, drink, caffeine and bicarbonate dose with its time (T−1h 30m, T+20m, …).
8. **Templates:** Load the sugar ratio, carb sources and sodium salt of a commercial gel (GU, Honey Stinger, Maurten, BPN, SiS, Precision Fuel & Hydration, GU Roctane, UnTapped). Your carb and sodium targets stay the same. Each template links to its label sources and says whether every value was verified.
9. **Sharing:** Copy a link that restores your inputs, or download an image of the recipe. A link from an older version cannot be loaded; the app says so and shows the default plan.

See [CORE.md](CORE.md) for every rule, number and citation.

![Gel-Recipe](https://raw.githubusercontent.com/ekarbe/gel-calculator/refs/heads/main/assets/RECIPE.PNG)

## Configuration & Data

* **Ingredients:** Carbohydrate sources (carbs per gram, glucose/fructose split) and salts are defined in `src/constants/constants.js`. Salt ratios are the ion's share of the salt **as sold**, including hydrate water (e.g. Epsom salt is the heptahydrate), so check that the form named in the app matches your product. There are no absorption factors: targets are amounts you take in, as guidelines state them.
* **Sweat presets:** The six sweat rates, six sweat sodium levels and their descriptions are in the same file.
* **Templates:** Commercial gel data, with label source links, the month checked and a `verified` flag, is in `src/constants/templates.js`.
* **Rules:** Each topic has a pure module in `src/domain/` (`carbs`, `sweat`, `hydration`, `electrolytes`, `caffeine`, `bicarbonate`, `schedule`, `recipe`). Thresholds are named constants in each module. `src/domain/plan.js` holds the input defaults and limits (`DEFAULT_INPUTS`, `INPUT_LIMITS`) and `computePlan`, which builds the whole plan the UI shows.
* **Evidence:** The citation registry (authors, year, title, journal, DOI) is `src/domain/evidence.js`.
* **Text:** Explanations and warnings are message keys. Their English text is in `src/i18n/en/<module>.js`.
* **State:** `src/state/` holds the plan provider, the UI provider and the share link codec (version 3; older links are not loaded, and the app tells the visitor).

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