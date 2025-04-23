import type { Metadata } from 'next';

import GelCalculator from '@/app/components/GelCalculator';
import { CalculatedCarbData, ElectrolyteSource } from '@/types/gelCalculator';

const siteUrl = 'https://eikekarbe.com';
const pageUrl = `${siteUrl}/`;
const title = 'DIY Energy Gel & Sports Drink Calculator | Optimize Your Fuel';
const description = 'Calculate precise carb ratios (glucose:fructose) and electrolyte needs for your endurance activity. Create custom DIY energy gel or sports drink recipes.';
const imageUrl = `${siteUrl}/favicon.svg`;

export const metadata: Metadata = {
  title: title,
  description: description,
  keywords: ['energy gel calculator', 'diy sports drink', 'sports nutrition', 'endurance fuel', 'electrolytes', 'carbohydrates', 'homemade gel', 'cycling', 'running', 'triathlon'],
  alternates: {
    canonical: pageUrl,
  },

  openGraph: {
    title: title,
    description: description,
    url: pageUrl,
    siteName: 'Gel Calculator',
    images: [
      {
        url: imageUrl,
        width: 24,
        height: 24,
        alt: 'Gel Calculator Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },

  twitter: {
    card: 'summary',
    title: title,
    description: description,
    images: [imageUrl],
  },
};

const generateStructuredData = (
  calculatedCarbData: CalculatedCarbData,
  electrolyteSources: ElectrolyteSource[],
  isBatchMode: boolean,
  hours: number,
  gelsPerHour: number
) => {
  const siteUrl = 'https://eikekarbe.com';
  const pageUrl = `${siteUrl}/gel-calculator`;
  const totalGels = gelsPerHour * hours;
  const divisor = isBatchMode ? 1 : (totalGels > 0 ? totalGels : 1);
  const modeLabel = isBatchMode
    ? `Full Batch (${hours} hour${hours !== 1 ? 's' : ''})`
    : `Per Gel (${totalGels} total gels)`;

  const webApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "DIY Energy Gel & Sports Drink Calculator",
    "url": pageUrl,
    "description": metadata.description,
    "applicationCategory": "HealthApplication",
    "operatingSystem": "All",
    "browserRequirements": "Requires JavaScript",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "EUR"
    },
    "creator": {
      "@type": "Person",
      "name": "Eike Karbe",
      "url": siteUrl
    }
  };

  const carbIngredients = Object.entries(calculatedCarbData.finalGrams)
    .filter(([key, grams]) => key !== 'totalGrams' && typeof grams === 'number' && grams > 0.01)
    .map(([sourceName, totalGrams]) => `${sourceName}: ${(totalGrams / divisor).toFixed(1)}g`);

  const electrolyteIngredients = electrolyteSources
    .filter(source => source.source && source.amount > 0.01)
    .map(source => `${source.source}: ${(source.amount / divisor).toFixed(1)}mg`);

  const allIngredients = [...carbIngredients, ...electrolyteIngredients];

  const recipeInstructionsText = [
    "1. Gather Ingredients: Collect calculated carbohydrates and electrolytes.",
    "2. Prepare Container: Use a clean, dry bottle or shaker.",
    "3. Add Glucose Sources: Add glucose-based powders to the container.",
    "4. Initial Mixing: Add a small amount of warm water and shake to form a paste.",
    "5. Add Remaining Ingredients: Add fructose sources and electrolytes.",
    "6. Final Mixing & Consistency: Gradually add more water while shaking to desired consistency.",
    ...(isBatchMode ? [] : ["7. Fill Gel Sachets: Transfer mixture to individual flasks/sachets."]),
    `${isBatchMode ? 7 : 8}. Storage: Refrigerate and consume within 3-5 days. Shake well before use.`
  ].join('\n');

  const recipeSchema = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    "name": `Custom DIY Energy Gel/Drink Mix (${modeLabel})`,
    "description": `Personalized recipe for ${modeLabel.toLowerCase()} based on calculated carb and electrolyte needs.`,
    "recipeYield": isBatchMode ? `1 Batch (${hours}h)` : `${totalGels} Gel(s)`,
    "recipeIngredient": allIngredients.length > 0 ? allIngredients : ["No ingredients calculated."],
    "recipeInstructions": allIngredients.length > 0 ? recipeInstructionsText : "No recipe generated.",
    "author": {
      "@type": "Person",
      "name": "Eike Christian Karbe",
      "url": siteUrl
    },
    "keywords": "diy energy gel, diy sports drink, homemade gel, endurance fuel recipe",
  };

  const combinedSchema = [
    webApplicationSchema,
    ...(allIngredients.length > 0 ? [recipeSchema] : [])
  ];

  return JSON.stringify(combinedSchema, null, 2);
};

export default function GelCalculatorPage() {
  return (
    <main className="min-h-screen p-4">
      <GelCalculator />
    </main>
  );
}

