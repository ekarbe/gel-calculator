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
 * Citation registry. Every evidence rule in `src/domain/**` names the ids of
 * the studies and position stands it is based on; the UI turns those ids into
 * short labels ("Jeukendrup 2014") and links with `citationLabel` and
 * `citationUrl`.
 *
 * Pure module: no I/O, no globals. The registry is deeply frozen so callers
 * cannot mutate it by accident.
 */

/**
 * One bibliographic entry.
 *
 * @typedef {Object} Citation
 * @property {string} authors  Author list as printed, e.g. "Thomas DT, Erdman KA, Burke LM" or "Burke LM et al.".
 * @property {number} year     Publication year.
 * @property {string} title    Article title.
 * @property {string} journal  Journal with volume and pages, e.g. "Sports Med 44(S1):S25–33".
 * @property {string} [doi]    DOI without the resolver prefix, e.g. "10.1007/s40279-014-0148-z".
 * @property {string} [url]    Fallback link when there is no DOI.
 */

/**
 * Bibliography data, keyed by citation id. Kept as a flat literal so it reads
 * like a reference list; `CITATIONS` below is the frozen public copy.
 *
 * @type {Record<string, Citation>}
 */
const RAW_CITATIONS = {
  jeukendrup2014: {
    authors: 'Jeukendrup AE',
    year: 2014,
    title: 'A step towards personalized sports nutrition: carbohydrate intake during exercise',
    journal: 'Sports Med 44(S1):S25–33',
    doi: '10.1007/s40279-014-0148-z',
  },
  thomas2016: {
    authors: 'Thomas DT, Erdman KA, Burke LM',
    year: 2016,
    title: 'Nutrition and athletic performance (ACSM/AND/DC position stand)',
    journal: 'Med Sci Sports Exerc 48:543–568',
    doi: '10.1249/MSS.0000000000000852',
  },
  burke2011: {
    authors: 'Burke LM et al.',
    year: 2011,
    title: 'Carbohydrates for training and competition',
    journal: 'J Sports Sci 29(S1):S17–27',
    doi: '10.1080/02640414.2011.585473',
  },
  smith2013: {
    authors: 'Smith JW et al.',
    year: 2013,
    title: 'Curvilinear dose-response relationship of carbohydrate (0–120 g/h) and performance',
    journal: 'Med Sci Sports Exerc 45:336–341',
    doi: '10.1249/MSS.0b013e31827205d1',
  },
  podlogar2022: {
    authors: 'Podlogar T et al.',
    year: 2022,
    title: 'Increased exogenous but unaltered endogenous carbohydrate oxidation with combined fructose-maltodextrin ingested at 120 g/h',
    journal: 'Eur J Appl Physiol 122:2393–2401',
    doi: '10.1007/s00421-022-05019-w',
  },
  hearris2022: {
    authors: 'Hearris MA et al.',
    year: 2022,
    title: '13C-glucose-fructose labeling reveals comparable exogenous CHO oxidation during exercise when consuming 120 g/h in fluid, gel, jelly chew, or coingestion',
    journal: 'J Appl Physiol 132:1394–1406',
    doi: '10.1152/japplphysiol.00091.2022',
  },
  rowlands2015: {
    authors: 'Rowlands DS et al.',
    year: 2015,
    title: 'Fructose–glucose composite carbohydrates and endurance performance: critical review and future perspectives',
    journal: 'Sports Med 45:1561–1576',
    doi: '10.1007/s40279-015-0381-0',
  },
  obrien2013: {
    authors: "O'Brien WJ et al.",
    year: 2013,
    title: 'Fructose-maltodextrin ratio governs exogenous and other CHO oxidation and performance',
    journal: 'Med Sci Sports Exerc 45:1814–1824',
    doi: '10.1249/MSS.0b013e31828e12d4',
  },
  wallis2005: {
    authors: 'Wallis GA et al.',
    year: 2005,
    title: 'Oxidation of combined ingestion of maltodextrins and fructose during exercise',
    journal: 'Med Sci Sports Exerc 37:426–432',
    doi: '10.1249/01.MSS.0000155399.23358.82',
  },
  jeukendrup2017: {
    authors: 'Jeukendrup AE',
    year: 2017,
    title: 'Training the gut for athletes',
    journal: 'Sports Med 47(S1):101–110',
    doi: '10.1007/s40279-017-0690-6',
  },
  cox2010: {
    authors: 'Cox GR et al.',
    year: 2010,
    title: 'Daily training with high carbohydrate availability increases exogenous carbohydrate oxidation during endurance cycling',
    journal: 'J Appl Physiol 109:126–134',
    doi: '10.1152/japplphysiol.00950.2009',
  },
  carter2004: {
    authors: 'Carter JM, Jeukendrup AE, Jones DA',
    year: 2004,
    title: 'The effect of carbohydrate mouth rinse on 1-h cycle time trial performance',
    journal: 'Med Sci Sports Exerc 36:2107–2111',
    doi: '10.1249/01.MSS.0000147585.65709.6F',
  },
  brietzke2019: {
    authors: 'Brietzke C et al.',
    year: 2019,
    title: 'Effects of carbohydrate mouth rinse on cycling time trial performance: a systematic review and meta-analysis',
    journal: 'Sports Med 49:57–66',
    doi: '10.1007/s40279-018-1029-7',
  },
  baker2017: {
    authors: 'Baker LB',
    year: 2017,
    title: 'Sweating rate and sweat sodium concentration in athletes',
    journal: 'Sports Med 47(S1):111–128',
    doi: '10.1007/s40279-017-0691-5',
  },
  baker2019: {
    authors: 'Baker LB',
    year: 2019,
    title: 'Physiology of sweat gland function',
    journal: 'Temperature 6:211–259',
    doi: '10.1080/23328940.2019.1632145',
  },
  barnes2019: {
    authors: 'Barnes KA et al.',
    year: 2019,
    title: 'Normative data for sweating rate, sweat sodium concentration, and sweat sodium loss in athletes',
    journal: 'J Sports Sci 37:2356–2366',
    doi: '10.1080/02640414.2019.1633159',
  },
  montain2007: {
    authors: 'Montain SJ, Cheuvront SN, Lukaski HC',
    year: 2007,
    title: 'Sweat mineral-element responses during 7 h of exercise-heat stress',
    journal: 'Int J Sport Nutr Exerc Metab 17:574–582',
    doi: '10.1123/ijsnem.17.6.574',
  },
  sawka2007: {
    authors: 'Sawka MN et al.',
    year: 2007,
    title: 'Exercise and fluid replacement (ACSM position stand)',
    journal: 'Med Sci Sports Exerc 39:377–390',
    doi: '10.1249/mss.0b013e31802ca597',
  },
  mccubbin2023: {
    authors: 'McCubbin AJ',
    year: 2023,
    title: 'Modelling sodium requirements of athletes across a variety of exercise scenarios',
    journal: 'Eur J Sport Sci 23:992–1000',
    doi: '10.1080/17461391.2022.2083526',
  },
  hoffman2015: {
    authors: 'Hoffman MD, Stuempfle KJ',
    year: 2015,
    title: 'Sodium supplementation and exercise-associated hyponatremia during prolonged exercise',
    journal: 'Med Sci Sports Exerc 47:1781–1787',
    doi: '10.1249/MSS.0000000000000599',
  },
  hewbutler2015: {
    authors: 'Hew-Butler T et al.',
    year: 2015,
    title: 'Statement of the 3rd International Exercise-Associated Hyponatremia Consensus Development Conference',
    journal: 'Clin J Sport Med 25:303–320',
    doi: '10.1097/JSM.0000000000000221',
  },
  delcoso2016: {
    authors: 'Del Coso J et al.',
    year: 2016,
    title: 'Effects of oral salt supplementation on physical performance during a half-ironman',
    journal: 'Scand J Med Sci Sports 26:156–164',
    doi: '10.1111/sms.12427',
  },
  almond2005: {
    authors: 'Almond CSD et al.',
    year: 2005,
    title: 'Hyponatremia among runners in the Boston Marathon',
    journal: 'N Engl J Med 352:1550–1556',
    doi: '10.1056/NEJMoa043901',
  },
  kenefick2018: {
    authors: 'Kenefick RW',
    year: 2018,
    title: 'Drinking strategies: planned drinking versus drinking to thirst',
    journal: 'Sports Med 48(S1):31–37',
    doi: '10.1007/s40279-017-0844-6',
  },
  efsa2011: {
    authors: 'EFSA NDA Panel',
    year: 2011,
    title: 'Scientific opinion on the substantiation of health claims related to carbohydrate-electrolyte solutions',
    journal: 'EFSA J 9(6):2211',
    doi: '10.2903/j.efsa.2011.2211',
  },
  fine1991: {
    authors: 'Fine KD et al.',
    year: 1991,
    title: 'Intestinal absorption of magnesium from food and supplements',
    journal: 'J Clin Invest 88:396–402',
    doi: '10.1172/JCI115317',
  },
  guest2021: {
    authors: 'Guest NS et al.',
    year: 2021,
    title: 'International Society of Sports Nutrition position stand: caffeine and exercise performance',
    journal: 'J Int Soc Sports Nutr 18:1',
    doi: '10.1186/s12970-020-00383-4',
  },
  carvalho2022: {
    authors: 'Carvalho A et al.',
    year: 2022,
    title: 'Can I have my coffee and drink it? A systematic review and meta-analysis to determine whether habitual caffeine consumption affects the ergogenic effect of caffeine',
    journal: 'Sports Med 52:2209–2220',
    doi: '10.1007/s40279-022-01685-0',
  },
  efsa2015: {
    authors: 'EFSA NDA Panel',
    year: 2015,
    title: 'Scientific opinion on the safety of caffeine',
    journal: 'EFSA J 13(5):4102',
    doi: '10.2903/j.efsa.2015.4102',
  },
  talanian2016: {
    authors: 'Talanian JL, Spriet LL',
    year: 2016,
    title: 'Low and moderate doses of caffeine late in exercise improve performance in trained cyclists',
    journal: 'Appl Physiol Nutr Metab 41:850–855',
    doi: '10.1139/apnm-2016-0053',
  },
  grgic2021: {
    authors: 'Grgic J et al.',
    year: 2021,
    title: 'International Society of Sports Nutrition position stand: sodium bicarbonate and exercise performance',
    journal: 'J Int Soc Sports Nutr 18:61',
    doi: '10.1186/s12970-021-00458-w',
  },
  deoliveira2022: {
    authors: 'de Oliveira LF et al.',
    year: 2022,
    title: 'Extracellular buffering supplements to improve exercise capacity and performance',
    journal: 'Sports Med 52:505–526',
    doi: '10.1007/s40279-021-01575-x',
  },
};

/**
 * Citation registry keyed by id (`'jeukendrup2014'`, `'sawka2007'`, ...).
 * Deeply frozen: the outer object and every entry are read-only.
 *
 * @type {Readonly<Record<string, Readonly<Citation>>>}
 */
export const CITATIONS = Object.freeze(
  Object.fromEntries(
    Object.entries(RAW_CITATIONS).map(([id, citation]) => [id, Object.freeze({ ...citation })]),
  ),
);

const ET_AL = /\s*,?\s*et al\.?\s*$/i;
// Trailing initials after a surname: "AE", "CSD", "J", "J-P", "A.E.".
const TRAILING_INITIALS = /\s+[A-Z][A-Z.-]{0,5}$/;

/**
 * Look up a citation id in `CITATIONS`, ignoring inherited keys such as
 * `toString` so a stray id never resolves to a prototype member.
 *
 * @param {unknown} id
 * @returns {Readonly<Citation>|null}
 */
function lookup(id) {
  if (typeof id !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(CITATIONS, id) ? CITATIONS[id] : null;
}

/**
 * Surname of the first author in an author list. Strips a trailing
 * "et al." and the author's initials; group authors without initials
 * ("EFSA NDA Panel") are kept whole.
 *
 * @param {string} authors
 * @returns {string}
 */
function firstSurname(authors) {
  const first = authors.split(',')[0].replace(ET_AL, '').trim();
  return first.replace(TRAILING_INITIALS, '').trim() || first;
}

/**
 * Whether an author list names more than one author, either by listing
 * several comma-separated names or by ending in "et al.".
 *
 * @param {string} authors
 * @returns {boolean}
 */
function hasMultipleAuthors(authors) {
  return ET_AL.test(authors) || authors.split(',').filter((part) => part.trim() !== '').length > 1;
}

/**
 * Short label for one citation entry ("Jeukendrup 2014",
 * "Podlogar et al. 2022", "EFSA NDA Panel 2011").
 *
 * Internal helper behind `citationLabel`. It is exported as `_labelFor` only
 * so tests can check author formats that no registry entry uses; app code
 * calls `citationLabel(id)`.
 *
 * @param {Citation} citation
 * @returns {string}
 */
function labelFor(citation) {
  const authors = String(citation.authors ?? '');
  const surname = firstSurname(authors);
  const name = hasMultipleAuthors(authors) ? `${surname} et al.` : surname;
  return `${name} ${citation.year ?? ''}`.trim();
}

/**
 * Link for one citation entry: `https://doi.org/<doi>` when it has a DOI,
 * otherwise its `url`, otherwise `null`.
 *
 * Internal helper behind `citationUrl`. It is exported as `_urlFor` only so
 * tests can check the `url` and `null` fallbacks, which no registry entry
 * uses; app code calls `citationUrl(id)`.
 *
 * @param {Citation} citation
 * @returns {string|null}
 */
function urlFor(citation) {
  if (typeof citation.doi === 'string' && citation.doi.trim() !== '') {
    return `https://doi.org/${citation.doi.trim()}`;
  }
  if (typeof citation.url === 'string' && citation.url.trim() !== '') {
    return citation.url.trim();
  }
  return null;
}

/**
 * Short in-text label for a citation: first author's surname and year.
 * One author → "Jeukendrup 2014"; two or more authors (listed or "et al.")
 * → "Podlogar et al. 2022", "Thomas et al. 2016". Group authors are kept
 * whole ("EFSA NDA Panel 2011").
 *
 * Unknown ids return the id itself (or `''` for a non-string id) so the UI
 * never shows a blank label. Takes exactly one argument, so it is safe to
 * pass straight to `Array.prototype.map` (`ids.map(citationLabel)`).
 *
 * @param {string} id Citation id, e.g. `'jeukendrup2014'`.
 * @returns {string}
 */
export function citationLabel(id) {
  const citation = lookup(id);
  if (!citation) return typeof id === 'string' ? id : '';
  return labelFor(citation);
}

/**
 * Link for a citation: the DOI resolver URL when the entry has a DOI
 * (`https://doi.org/<doi>`), otherwise its `url`, otherwise `null`.
 * Unknown ids return `null`. Takes exactly one argument, so it is safe to
 * pass straight to `Array.prototype.map` (`ids.map(citationUrl)`).
 *
 * @param {string} id Citation id, e.g. `'jeukendrup2014'`.
 * @returns {string|null}
 */
export function citationUrl(id) {
  const citation = lookup(id);
  return citation ? urlFor(citation) : null;
}

// Test-only exports. Not part of the module's public API; do not import them
// from app code.
export { labelFor as _labelFor, urlFor as _urlFor };
