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
 * Commercial gel templates. Picking one loads its carbohydrate blend, ratio
 * and sodium source into the calculator so the athlete can make a DIY copy.
 *
 * How the values were checked (October 2026):
 * - Per-gel carbs, sodium and caffeine are for the base flavor, or for the
 *   most common caffeine-free flavor when there is no base flavor. The
 *   flavor is named in `description`.
 * - Sources are the manufacturer product page (BPN: none found) plus at
 *   least one retailer nutrition panel. Direct page downloads were blocked in
 *   the research environment, so the pages were read through web-search
 *   excerpts of the listed URLs. Re-check against the printed label when
 *   updating.
 * - `verified: true` means carbs, sodium, caffeine and the carbohydrate
 *   ingredients agree across the listed sources (regional label differences
 *   are given in `notes`), and the glucose:fructose
 *   ratio is either stated by the manufacturer or follows directly from the
 *   ingredients (one sugar, or glucose only). `verified: false` means at least
 *   one value is an estimate; `notes` says which one and how it was derived.
 * - `notes` starts with the carbohydrate ingredients in label order.
 * - Sugar splits follow `src/constants/constants.js`: sucrose, honey and maple
 *   syrup count half glucose, half fructose; maltodextrin and glucose syrups
 *   count as glucose.
 *
 * Source ids point at `glucoseSourceOptions` (1–8) and `fructoseSourceOptions`
 * (11–20) in `constants.js`. Each list's percentages sum to 100 or the list is
 * empty, matching how the carb solver splits the per-pathway targets.
 */

/**
 * Share of one pathway target covered by a carbohydrate source.
 *
 * @typedef {Object} TemplateSourceShare
 * @property {number} id          Carb source id from `constants.js`.
 * @property {number} percentage  Percent of that pathway's target (0–100).
 */

/**
 * Where a template value was checked.
 *
 * @typedef {Object} TemplateReference
 * @property {string} label    Short description of the page, e.g. "Manufacturer product page".
 * @property {string} url      Absolute https URL.
 * @property {string} checked  Month the page was checked, `YYYY-MM`.
 */

/**
 * One commercial gel template.
 *
 * @typedef {Object} ProductTemplate
 * @property {string} id                 Stable kebab-case id.
 * @property {string} name               Product name as sold.
 * @property {string} brand              Brand name.
 * @property {string} description        One or two short sentences, naming the flavor the numbers are for.
 * @property {number} carbsPerGelG       Carbohydrate per gel, g.
 * @property {number} sodiumPerGelMg     Sodium per gel, mg.
 * @property {number} caffeinePerGelMg   Caffeine per gel in the caffeine-free base variant, mg.
 * @property {{ glucose: number, fructose: number }} ratio  Glucose:fructose parts (glucose-pathway : fructose-pathway).
 * @property {TemplateSourceShare[]} glucoseSources   Sources from the glucose list.
 * @property {TemplateSourceShare[]} fructoseSources  Sources from the fructose list.
 * @property {'table'|'citrate'|'mix'} sodiumSalt     Sodium source on the label; `'table'` is the default when no salt is added.
 * @property {string} otherIngredients   Non-carbohydrate ingredients, label order where known.
 * @property {boolean} verified          See the module comment.
 * @property {TemplateReference[]} sources  At least one reference.
 * @property {string} notes              Label order of the carbs, how the ratio was found, caveats.
 */

const CHECKED = '2026-10';

/** @type {ProductTemplate[]} */
const RAW_TEMPLATES = [
  {
    id: 'gu-energy-gel',
    name: 'GU Energy Gel',
    brand: 'GU Energy Labs',
    description: 'Maltodextrin and fructose with 450 mg amino acids. Numbers for Strawberry Banana, a caffeine-free flavor.',
    carbsPerGelG: 23,
    sodiumPerGelMg: 55,
    caffeinePerGelMg: 0,
    ratio: { glucose: 1, fructose: 0.33 },
    glucoseSources: [{ id: 3, percentage: 100 }],
    fructoseSources: [{ id: 11, percentage: 100 }],
    sodiumSalt: 'citrate',
    otherIngredients:
      'Water, amino acids (leucine, valine, isoleucine, histidine), potassium citrate, sodium citrate, citric acid, malic acid, natural flavors, calcium carbonate, preservatives (sodium benzoate, potassium sorbate)',
    verified: false,
    sources: [
      { label: 'Manufacturer product page', url: 'https://guenergy.com/products/energy-gel', checked: CHECKED },
      { label: 'Running Warehouse nutrition panel (Strawberry Banana)', url: 'https://www.runningwarehouse.com/descpage-GU24TB.html', checked: CHECKED },
      { label: 'REI ingredient list', url: 'https://www.rei.com/product/610028', checked: CHECKED },
    ],
    notes:
      'Carbohydrates in label order: maltodextrin, water, fructose. GU does not publish the maltodextrin to fructose split. ' +
      'The 1:0.33 ratio is an estimate. Retailers quote a blend of 70–80% maltodextrin and 20–30% fructose, and the label shows only 7–8 g sugars per gel, so fructose is at most about 7 g of 23 g. ' +
      'Sodium differs by source. The Strawberry Banana panel shows 55 mg; the GU product page states 60–125 mg across flavors, with salted flavors at the top. ' +
      'Carbs are 21–23 g depending on flavor. Caffeinated flavors add 20–40 mg. The order of the minor ingredients comes from retailer listings.',
  },
  {
    id: 'honey-stinger-organic-energy-gel',
    name: 'Honey Stinger Organic Energy Gel',
    brand: 'Honey Stinger',
    description: 'Organic tapioca syrup and honey. Numbers for Fruit Smoothie, a caffeine-free flavor.',
    carbsPerGelG: 24,
    sodiumPerGelMg: 50,
    caffeinePerGelMg: 0,
    ratio: { glucose: 1, fructose: 0.15 },
    glucoseSources: [{ id: 2, percentage: 100 }],
    fructoseSources: [{ id: 14, percentage: 100 }],
    sodiumSalt: 'table',
    otherIngredients: 'Potassium citrate, salt, organic natural flavor, citric acid, water',
    verified: false,
    sources: [
      { label: 'Manufacturer product page (Fruit Smoothie)', url: 'https://honeystinger.com/products/fruit-smoothie-energy-gel', checked: CHECKED },
      { label: 'H-E-B nutrition panel (Fruit Smoothie)', url: 'https://www.heb.com/product-detail/honey-stinger-energy-gel-fruit-smoothie/15300520', checked: CHECKED },
    ],
    notes:
      'Carbohydrates in label order: organic tapioca syrup, organic honey. Honey Stinger does not state a ratio. ' +
      'Tapioca syrup is a glucose syrup, so only the honey adds fructose. With 11 g sugars in 24 g carbs, honey supplies roughly 4–8 g of the carbs, which puts fructose near 2–4 g per gel. ' +
      'The 1:0.15 ratio is the middle of that estimate. The nutrition panel was read from a retailer; the manufacturer page confirmed the ingredients only. ' +
      'Caffeinated flavors add 32–70 mg. Electrolyte flavors add about 100 mg sodium.',
  },
  {
    id: 'maurten-gel-100',
    name: 'Maurten Gel 100',
    brand: 'Maurten',
    description: 'Hydrogel of glucose and fructose at 1:0.8. No flavors, colors or preservatives.',
    carbsPerGelG: 25,
    sodiumPerGelMg: 20,
    caffeinePerGelMg: 0,
    ratio: { glucose: 1, fructose: 0.8 },
    glucoseSources: [{ id: 1, percentage: 100 }],
    fructoseSources: [{ id: 11, percentage: 100 }],
    sodiumSalt: 'table',
    otherIngredients: 'Water, sodium alginate, gluconic acid, calcium carbonate',
    verified: true,
    sources: [
      { label: 'Manufacturer product page', url: 'https://www.maurten.com/products/gel-100-box-us', checked: CHECKED },
      { label: 'Manufacturer product FAQ', url: 'https://www.maurten.com/faq/general-product', checked: CHECKED },
      { label: 'Running Warehouse nutrition panel (US label)', url: 'https://www.runningwarehouse.com/Maurten_GEL_100/descpage-MAU100.html', checked: CHECKED },
      { label: 'Bikable nutrition panel (EU label)', url: 'https://bikable.com/accessories/energy-bars-and-energy-powder/maurten-gel-100-neutral-12-x-40-g', checked: CHECKED },
    ],
    notes:
      'Carbohydrates in label order: water, glucose, fructose. Maurten states the 0.8:1 fructose to glucose ratio. ' +
      'Sodium is 20 mg on the US label. EU labels list 0.085 g salt per 40 g gel, which is about 34 mg sodium. ' +
      'The sodium comes from sodium alginate. There is no added salt, so the sodium salt setting is only a default. Gel 100 Caf 100 adds 100 mg caffeine.',
  },
  {
    id: 'bpn-go-gel-endurance',
    name: 'BPN Go Gel Endurance',
    brand: 'Bare Performance Nutrition',
    description: 'Apple juice concentrate and brown rice syrup. Numbers for Apple Cinnamon.',
    carbsPerGelG: 24,
    sodiumPerGelMg: 110,
    caffeinePerGelMg: 0,
    ratio: { glucose: 1, fructose: 0.8 },
    glucoseSources: [{ id: 6, percentage: 100 }],
    fructoseSources: [{ id: 20, percentage: 100 }],
    sodiumSalt: 'table',
    otherIngredients: 'Apple puree, purified water, lemon juice concentrate, sea salt, ground cinnamon',
    verified: false,
    sources: [
      { label: 'Vitacost listing (Apple Cinnamon panel and ingredients)', url: 'https://www.vitacost.com/products/bpn-go-gel-endurance-gel-apple-cinnamon-10-packets-1-45-oz-41-g-each-142023', checked: CHECKED },
      { label: 'H-E-B nutrition panel (Apple Cinnamon)', url: 'https://www.heb.com/product-detail/bare-performance-nutrition-go-gel-apple-cinnamon-single/11493546', checked: CHECKED },
    ],
    notes:
      'Carbohydrates in label order: apple juice concentrate, brown rice syrup, apple puree. BPN does not state a ratio. ' +
      'The 1:0.8 ratio is derived from the label. 20 g of the 24 g carbs are sugars, and brown rice syrup is about half sugars, so fruit supplies about 16 g and rice syrup about 8 g. ' +
      'Apple sugars are roughly two thirds fructose, which gives about 10–11 g fructose per gel (1:0.7–0.9). Apple puree is counted with the juice concentrate. ' +
      'The manufacturer page could not be found, so all values come from retailer panels. The caffeinated version adds 75 mg. Other flavors use other fruit juices, so their ratio may differ.',
  },
  {
    id: 'sis-go-isotonic-energy-gel',
    name: 'SiS GO Isotonic Energy Gel',
    brand: 'Science in Sport',
    description: 'Isotonic 60 ml gel. Maltodextrin only, no fructose. Numbers for Orange.',
    carbsPerGelG: 22,
    sodiumPerGelMg: 4,
    caffeinePerGelMg: 0,
    ratio: { glucose: 1, fructose: 0 },
    glucoseSources: [{ id: 3, percentage: 100 }],
    fructoseSources: [],
    sodiumSalt: 'mix',
    otherIngredients:
      'Water, gelling agents (gellan gum, xanthan gum), natural flavouring, acidity regulators (citric acid, sodium citrate), preservatives (sodium benzoate, potassium sorbate), sweetener (acesulfame K), sodium chloride',
    verified: true,
    sources: [
      { label: 'Manufacturer product page', url: 'https://www.scienceinsport.com/sis-go-isotonic-energy-gel-pack', checked: CHECKED },
      { label: 'Tesco nutrition panel (Orange)', url: 'https://www.tesco.com/shop/en-GB/products/274763132', checked: CHECKED },
      { label: 'Snow+Rock ingredient list (Orange)', url: 'https://www.snowandrock.com/p/sis-go-isotonic-gel-orange-60ml-E6314096.html', checked: CHECKED },
    ],
    notes:
      'Carbohydrates in label order: water, maltodextrin (33%). Maltodextrin is the only carbohydrate, so the ratio is glucose only. ' +
      'Sodium is a trace. UK panels list 0.01 g salt per gel, which is about 4 mg sodium. Some flavors list 0.04 g salt, about 16 mg sodium. ' +
      'Minor ingredients vary by flavor. The separate GO Energy + Electrolyte gel has about 118 mg sodium.',
  },
  {
    id: 'pf-30-gel',
    name: 'Precision Fuel & Hydration PF 30 Gel',
    brand: 'Precision Fuel & Hydration',
    description: '30 g carbs in a 51 g gel. Maltodextrin and fructose at 2:1, no electrolytes.',
    carbsPerGelG: 30,
    sodiumPerGelMg: 0,
    caffeinePerGelMg: 0,
    ratio: { glucose: 1, fructose: 0.5 },
    glucoseSources: [{ id: 3, percentage: 100 }],
    fructoseSources: [{ id: 11, percentage: 100 }],
    sodiumSalt: 'table',
    otherIngredients: 'Water, pectin, citric acid, potassium sorbate, calcium lactate',
    verified: true,
    sources: [
      { label: 'Manufacturer product page', url: 'https://www.precisionhydration.com/us/en/products/pf-30-gel/', checked: CHECKED },
      { label: 'Steed Cycles nutrition panel and ingredients', url: 'https://steedcycles.com/products/precision-fuel-pf-30-gel', checked: CHECKED },
    ],
    notes:
      'Carbohydrates in label order: maltodextrin, water, fructose. PF&H states the 2:1 glucose to fructose ratio. ' +
      'The ingredients contain no sodium source and PF&H sells the gel to be paired with separate electrolytes. No panel found lists a sodium value, so 0 mg means none added. ' +
      'The sodium salt setting is only a default. The PF 30 Caffeine Gel adds 100 mg caffeine.',
  },
  {
    id: 'gu-roctane-energy-gel',
    name: 'GU Roctane Ultra Endurance Energy Gel',
    brand: 'GU Energy Labs',
    description: 'Higher-sodium GU with 1425 mg amino acids, taurine and beta-alanine. Numbers for Strawberry Kiwi, a caffeine-free flavor.',
    carbsPerGelG: 21,
    sodiumPerGelMg: 125,
    caffeinePerGelMg: 0,
    ratio: { glucose: 1, fructose: 0.33 },
    glucoseSources: [{ id: 3, percentage: 100 }],
    fructoseSources: [{ id: 11, percentage: 100 }],
    sodiumSalt: 'mix',
    otherIngredients:
      'Water, amino acids (leucine, valine, isoleucine), taurine, sodium citrate, natural flavors, malic acid, citric acid, calcium carbonate, beta-alanine, sea salt, potassium citrate, medium-chain triglycerides, gellan gum, preservatives (sodium benzoate, potassium sorbate)',
    verified: false,
    sources: [
      { label: 'Manufacturer product page', url: 'https://guenergy.com/products/roctane-energy-gel', checked: CHECKED },
      { label: 'MEC nutrition panel (Strawberry Kiwi)', url: 'https://www.mec.ca/en/product/6030-901/gu-roctane-strawberry-kiwi-energy-gel', checked: CHECKED },
      { label: 'REI ingredient list', url: 'https://www.rei.com/product/777986', checked: CHECKED },
    ],
    notes:
      'Carbohydrates in label order: maltodextrin, water, fructose. GU does not publish the maltodextrin to fructose split. ' +
      'The 1:0.33 ratio is an estimate based on the same blend as GU Energy Gel. About 6 g of the 21 g carbs are sugars, so fructose is at most about 6 g. ' +
      'GU now states 19–21 g carbs and 125–180 mg sodium across flavors. Caffeinated flavors add 35 or 70 mg. ' +
      'Retailer listings disagree on the minor ingredients, so their order is not confirmed.',
  },
  {
    id: 'untapped-maple-syrup-gel',
    name: 'UnTapped Maple Syrup Energy Gel',
    brand: 'UnTapped',
    description: 'One ingredient: organic Vermont maple syrup. Numbers for the original Maple flavor.',
    carbsPerGelG: 26,
    sodiumPerGelMg: 5,
    caffeinePerGelMg: 0,
    ratio: { glucose: 1, fructose: 1 },
    glucoseSources: [],
    fructoseSources: [{ id: 17, percentage: 100 }],
    sodiumSalt: 'table',
    otherIngredients: 'None',
    verified: true,
    sources: [
      { label: 'Manufacturer product page', url: 'https://untapped.cc/product/maple-untapped-energy-gel/', checked: CHECKED },
      { label: 'Manufacturer education center (sodium by flavor)', url: 'https://untapped.cc/untapped-education-center/', checked: CHECKED },
    ],
    notes:
      'Carbohydrates in label order: organic pure Vermont maple syrup. Maple syrup sugar is mostly sucrose, which splits evenly into glucose and fructose, so the ratio is 1:1. ' +
      'That is the most fructose the calculator accepts. Sodium is 5 mg and potassium about 82 mg per 38 g packet. ' +
      'There is no added salt, so the sodium salt setting is only a default. Salted flavors have 60–100 mg sodium from sea salt. The Coffee flavor adds 27 mg caffeine.',
  },
];

/**
 * Recursively freezes plain objects and arrays.
 *
 * @template T
 * @param {T} value
 * @returns {T} The same value, frozen.
 */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/**
 * Commercial gel templates, in display order. Deeply frozen; copy before
 * changing anything.
 *
 * @type {ReadonlyArray<ProductTemplate>}
 */
export const TEMPLATES = deepFreeze(RAW_TEMPLATES);
