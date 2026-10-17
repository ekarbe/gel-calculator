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
 * German text for message keys returned by `src/domain/schedule.js`
 * (`buildSchedule`), plus one title per event type (`schedule.title.<type>`).
 * Same keys and placeholders as `../en/schedule.js` (a parity test checks it).
 * @type {Record<string, string>}
 */
const schedule = {
  // Event titles, one per ScheduleEvent.type
  'schedule.title.bicarb': 'Natron',
  'schedule.title.caffeine': 'Koffein',
  'schedule.title.start': 'Start',
  'schedule.title.fuel': 'Verpflegung',
  'schedule.title.drink': 'Trinken',
  'schedule.title.hydration': 'Flüssigkeit',
  'schedule.title.finish': 'Ziel',

  // Before the start
  'schedule.bicarb': 'Nimm {doseG} g Natron. Es liefert {sodiumG} g Natrium.',
  'schedule.caffeine': 'Nimm {mg} mg Koffein.',
  'schedule.caffeineTablets': 'Nimm {mg} mg Koffein. Tabletten: {tablets}.',

  // Start
  'schedule.start': 'Starte deine Aktivität.',
  'schedule.startWithGel': 'Starte deine Aktivität und nimm Gel 1.',
  'schedule.startWithGelAndFluid': 'Starte deine Aktivität und nimm Gel 1 mit etwa {fluidMl:volume} Flüssigkeit.',
  'schedule.startWithGelAndCaffeine':
    'Starte deine Aktivität und nimm Gel 1. Es enthält {caffeineMg} mg Koffein.',
  'schedule.startWithGelFluidAndCaffeine':
    'Starte deine Aktivität und nimm Gel 1 mit etwa {fluidMl:volume} Flüssigkeit. Es enthält {caffeineMg} mg Koffein.',

  // During the activity
  'schedule.fuel': 'Nimm Gel {gel}.',
  'schedule.fuelWithFluid': 'Nimm Gel {gel} mit etwa {fluidMl:volume} Flüssigkeit.',
  'schedule.fuelWithCaffeine': 'Nimm Gel {gel}. Es enthält {caffeineMg} mg Koffein.',
  'schedule.fuelWithFluidAndCaffeine':
    'Nimm Gel {gel} mit etwa {fluidMl:volume} Flüssigkeit. Es enthält {caffeineMg} mg Koffein.',
  // Drink sips every 20 min when the drink carries the fluid
  'schedule.drinkSip': 'Trink etwa {ml:volume} aus Flasche {bottle}.',
  // The sip empties bottle {bottle} and runs on into the next one
  'schedule.drinkSipSwitch': 'Trink etwa {ml:volume}. Leere dabei Flasche {bottle} und mach mit Flasche {next} weiter.',
  // The sip empties bottles {bottle} to {finished} and runs on into bottle {next}
  'schedule.drinkSipSpan': 'Trink etwa {ml:volume}. Leere dabei die Flaschen {bottle} bis {finished} und mach mit Flasche {next} weiter.',
  // When no gel or drink sip carries fluid (no gels, or the fluid per gel rounds to 0)
  'schedule.hydrationOnly': 'Trink durchgehend etwa {mlPerHour:volume}/h.',

  // Finish
  'schedule.finish': 'Ziel erreicht. Beginne mit deiner Regeneration.',
};

export default schedule;
