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
 * English text for message keys returned by `src/domain/schedule.js`
 * (`buildSchedule`), plus one title per event type (`schedule.title.<type>`)
 * for the UI. Placeholders use `{name}` syntax.
 * @type {Record<string, string>}
 */
const schedule = {
  // Event titles, one per ScheduleEvent.type
  'schedule.title.bicarb': 'Bicarbonate',
  'schedule.title.caffeine': 'Caffeine',
  'schedule.title.start': 'Start',
  'schedule.title.fuel': 'Fuel',
  'schedule.title.hydration': 'Hydration',
  'schedule.title.finish': 'Finish',

  // Before the start
  'schedule.bicarb': 'Take {doseG} g sodium bicarbonate. It adds {sodiumG} g sodium.',
  'schedule.caffeine': 'Take {mg} mg caffeine.',
  'schedule.caffeineTablets': 'Take {mg} mg caffeine. Tablets: {tablets}.',

  // Start
  'schedule.start': 'Start your activity.',
  'schedule.startWithGel': 'Start your activity and take gel 1.',
  'schedule.startWithGelAndCaffeine':
    'Start your activity and take gel 1. It contains {caffeineMg} mg caffeine.',

  // During the activity
  'schedule.fuel': 'Take gel {gel}.',
  'schedule.fuelWithFluid': 'Take gel {gel} with about {fluidMl} ml fluid.',
  'schedule.fuelWithCaffeine': 'Take gel {gel}. It contains {caffeineMg} mg caffeine.',
  'schedule.fuelWithFluidAndCaffeine':
    'Take gel {gel} with about {fluidMl} ml fluid. It contains {caffeineMg} mg caffeine.',
  'schedule.hydrationOnly': 'No gels in this plan. Drink about {mlPerHour} ml/h throughout.',

  // Finish
  'schedule.finish': 'Finish. Begin your recovery.',
};

export default schedule;
