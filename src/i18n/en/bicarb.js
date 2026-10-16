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
 * English text for message keys returned by `src/domain/bicarbonate.js`.
 * Placeholders use `{name}` syntax.
 * @type {Record<string, string>}
 */
const bicarb = {
  // planBicarbonate: summary by event length
  'bicarb.why.short':
    'Sodium bicarbonate buffers acid in hard efforts. Doses of 0.2–0.3 g/kg improve performance in high-intensity events of up to about 1 h.',
  'bicarb.why.medium':
    'Sodium bicarbonate buffers acid in hard efforts. Doses of 0.2–0.3 g/kg help in events of up to about 1 h. Evidence for 60–90 min is limited.',
  'bicarb.why.long':
    'Sodium bicarbonate buffers acid in hard efforts. Doses of 0.2–0.3 g/kg help in events of up to about 1 h. There is no evidence of a benefit in multi-hour events.',

  // planBicarbonate: details
  'bicarb.why.dose': 'Your dose is {gPerKg} g/kg for {massKg} kg, or {doseG} g.',
  'bicarb.why.timing':
    'Take it 60–180 min before the start, ideally about 90 min. Split it into smaller portions with a carb-rich meal to ease the stomach.',

  // planBicarbonate: warnings
  'bicarb.warn.gi':
    'Stomach upset is common with bicarbonate. Split doses, enteric-coated capsules or a hydrogel form help. Try it in training first.',
  'bicarb.warn.sodiumLoad':
    'This dose contains about {sodiumG} g of sodium. That is a large salt load on top of your normal diet.',
  'bicarb.warn.medical':
    'Ask a doctor first if you have high blood pressure or kidney disease.',
  'bicarb.warn.notInRace':
    'The sodium in bicarbonate does not count toward your in-race sodium target.',
  'bicarb.warn.longEvent':
    'There is no evidence that bicarbonate helps in events longer than about 90 min. Side effects may outweigh any gain.',
  'bicarb.warn.limitedEvidence':
    'Evidence for events of 60–90 min is limited. Most studies tested hard efforts of 30 s to 12 min.',
};

export default bicarb;
