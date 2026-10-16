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
 * English text for message keys returned by `src/domain/caffeine.js`.
 * Placeholders use `{name}` syntax.
 * @type {Record<string, string>}
 */
const caffeine = {
  // planCaffeine: summary when caffeine is off
  'caffeine.why.disabled':
    'Caffeine is optional. Doses of 3–6 mg/kg improve endurance performance for most athletes.',

  // planCaffeine: summary by duration band
  'caffeine.why.short':
    'Take {preMg} mg about 60 min before the start. Caffeine peaks in the blood 30–60 min after intake and lasts through a short event.',
  'caffeine.why.medium':
    'Take {preMg} mg about 60 min before the start and {intraMg} mg about two thirds into the event. A late dose still improves performance when fatigue builds.',
  'caffeine.why.long':
    'Take {preMg} mg about 60 min before the start. From halfway, top up every 2.5 h with {intraMg} mg in total. Caffeine has a half-life of about 5 h, so small top-ups keep the effect going.',

  // planCaffeine: details
  'caffeine.why.dose':
    'Your plan uses {mgPerKg} mg/kg for {massKg} kg, or {doseMg} mg in total. Doses of 3–6 mg/kg improve performance in most studies. Lower doses of 1–2 mg/kg can also help.',
  'caffeine.why.habitual':
    'Regular coffee drinkers benefit as much as non-users, so your usual intake does not change the dose.',

  // planCaffeine: warnings
  'caffeine.warn.exclusions':
    'Skip caffeine if you are pregnant, under 18, have a heart condition or are sensitive to caffeine.',
  'caffeine.warn.tryInTraining':
    'Try your caffeine plan in training first. Side effects include jitters, a racing heart, stomach upset and poor sleep.',
  'caffeine.warn.noPowder':
    'Add caffeine as {tabletMg} mg tablets. Never use pure caffeine powder. A small measuring error with powder can be fatal.',
  'caffeine.warn.singleDoseAbove200':
    'Your largest single dose is {mg} mg. Single doses up to 200 mg are considered safe for healthy adults. Above that, side effects are more likely.',
  'caffeine.warn.highTotal':
    'Your total is {totalMg} mg ({totalMgPerKg} mg/kg). Above 9 mg/kg, side effects are common and there is no extra benefit.',
  'caffeine.warn.capped':
    'Some doses were reduced or dropped to keep the caffeine in your body below {maxMgPerKg} mg/kg at all times.',
};

export default caffeine;
