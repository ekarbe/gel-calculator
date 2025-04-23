# Gel-Calculator 🧪⚡

A web application designed for endurance athletes to calculate personalized energy gel or drink mix recipes. Determine the right mix of carbohydrates (controlling the glucose-to-fructose ratio) and electrolytes based on your activity duration, intensity, and sweat profile.

**Live App:** [https://eikekarbe.com/gel-calculator](https://eikekarbe.com/gel-calculator)

![Gel-Calculator Screenshot](https://github.com/ekarbe/gel-calculator/assets/APP.PNG)

## Key Features

* **Duration & Carb Target:** Input your activity duration and desired carbohydrate intake per hour.
* **Glucose/Fructose Ratio Control:** Adjust the desired ratio between glucose and fructose pathway carbohydrates using sliders.
* **Multiple Carb Sources:** Select from various glucose and fructose sources (e.g., Maltodextrin, Dextrose, Sucrose, Fructose, Maple Syrup) and define their percentage contribution.
* **Electrolyte Targeting:**
  * **Sweat Profile:** Estimate needs based on selectable sweat rate and sweat saltiness levels.
    * **Manual Input:** Directly input target electrolyte amounts (mg per hour) for Sodium, Chloride, Potassium, Magnesium, and Calcium.
* **Multiple Electrolyte Sources:** Add common electrolyte sources (e.g., Sodium Chloride, Potassium Citrate, Magnesium Citrate) and input the total amount needed.
* **Recipe Generation:** Calculates the required grams/milligrams of each selected carb and electrolyte source.
* **Per Gel / Full Batch View:** Toggle the recipe view between amounts needed for the entire duration or per individual gel (based on configurable gels per hour).
* **Mixing Instructions:** Provides a step-by-step guide for mixing the calculated recipe in a modal.
* **Light & Dark Mode:** Adapts to your system's theme preference.
* **Responsive Design:** Usable across different screen sizes.

## Tech Stack

* **Framework:** [Next.js](https://nextjs.org/) (App Router)
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/)
* **UI Components:** [shadcn/ui](https://ui.shadcn.com/) (using Radix UI primitives)
* **Icons:** [Lucide React](https://lucide.dev/)
* **Theming:** [next-themes](https://github.com/pacocoursey/next-themes)

## Getting Started

Follow these steps to set up and run the project locally:

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

The main application page is located at `src/app/page.tsx`.

## How It Works

1. **Basic Inputs:** Enter the planned duration of your activity and your target carbohydrate intake per hour.
2. **Carb Ratio:** Use the sliders in the Glucose and Fructose sections to set the desired ratio parts (e.g., 100 parts Glucose to 50 parts Fructose for a 2:1 ratio).
3. **Carb Sources:** Add carbohydrate sources for each pathway (Glucose/Fructose) and specify the percentage each source should contribute to that pathway's total target carbs. The calculator determines the grams needed for each source.
4. **Electrolyte Targets:** Choose either the "Sweat Profile" tab to estimate needs based on sweat rate and saltiness, or the "Manual Target" tab to input specific mg/hour goals. Toggle which electrolytes you want to target using the grid.
5. **Electrolyte Sources:** Add electrolyte sources (salts, citrates) and input the total amount (in mg) you plan to add for the entire duration. The calculator shows the contribution of each electrolyte based on the source's composition and estimated absorption.
6. **Analysis:** The "Electrolyte Balance Analysis" section compares your target electrolyte needs with the calculated absorbed amount from your sources.
7. **Recipe:** The "Final Recipe" section summarizes the required amounts of each carbohydrate and electrolyte source, viewable as a total batch or per individual gel.
8. **Instructions:** Click "View Mixing Instructions" for a guide on preparing your custom mix.

## Configuration & Data

* Carbohydrate source data (carbs per gram, glucose/fructose content) is defined in `src/constants/gelCalculator.ts`.
* Electrolyte source data (component ratios, estimated absorption rates) is also in `src/constants/gelCalculator.ts`. **Note:** Absorption rates are simplified estimates and can vary significantly between individuals.
* Sweat profile ranges and descriptions are located in the same constants file.

## Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the issues page or submit a pull request.

## License

See the [LICENSE](LICENSE.md) file for license rights and limitations (MIT).

## Acknowledgements

* Built by Eike Christian Karbe.
* With thanks to Christina for input and testing. ❤️
