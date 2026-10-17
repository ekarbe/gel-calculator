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
 * What to drink during the activity, as the mixing dialog's last part says
 * it, in the UI language and unit system (`ui-dialogs.mixing.during.*`).
 * The mixing steps themselves are shared with the print view
 * (`../recipe/recipeText.js`). Display only. No React.
 */

import { DRINK_INTERVAL_MIN } from '../../domain/schedule';
import { finite } from '../../i18n/formatters';

/** @typedef {import('../../i18n/index').TranslateFn} TranslateFn */
/** @typedef {import('../../domain/plan').Plan} Plan */

/**
 * What to drink during the activity, from the plan: the hourly fluid target
 * and the fluid the schedule lists with the first gel or the first drink sip
 * (`plan.schedule`), so the steps never disagree with the schedule. Never a
 * fixed amount of water per gel [almond2005, hewbutler2015].
 *
 * @param {TranslateFn} t
 * @param {Plan} plan
 * @returns {string}
 */
export function fluidInstruction(t, plan) {
  const mlPerHour = finite(plan.fluid?.mlPerHour);
  const hasGels = finite(plan.gels?.count) > 0;
  const fromBottles = plan.format?.type !== 'gel' && finite(plan.concentration?.drink?.bottles) > 0;
  const schedule = Array.isArray(plan.schedule) ? plan.schedule : [];
  const firstGelFluid = schedule.find((event) => (event.type === 'start' || event.type === 'fuel') && event.fluidMl > 0)?.fluidMl;
  const firstSip = schedule.find((event) => event.type === 'drink' && event.fluidMl > 0)?.fluidMl;
  const thirst = plan.fluid?.recommended?.drinkToThirst ? [t('ui-dialogs.mixing.during.thirst')] : [];

  if (!(mlPerHour > 0)) {
    return [hasGels ? t('ui-dialogs.mixing.during.takeGels') : null, t('ui-dialogs.mixing.during.noFluid')]
      .filter(Boolean)
      .join(' ');
  }
  // Whole ml, as the board and the print view show the rate (a manual rate typed in fl oz keeps decimals).
  const rate = t(fromBottles ? 'ui-dialogs.mixing.during.rateBottles' : 'ui-dialogs.mixing.during.rate', {
    mlPerHour: Math.round(mlPerHour),
  });
  if (firstGelFluid) {
    return [t('ui-dialogs.mixing.during.withGel', { rate, ml: Math.round(firstGelFluid) }), ...thirst].join(' ');
  }
  if (firstSip) {
    return [
      t('ui-dialogs.mixing.during.withSip', { rate, ml: Math.round(firstSip), interval: DRINK_INTERVAL_MIN }),
      ...thirst,
    ].join(' ');
  }
  return [t('ui-dialogs.mixing.during.plain', { rate }), hasGels ? t('ui-dialogs.mixing.during.takeGels') : null, ...thirst]
    .filter(Boolean)
    .join(' ');
}
