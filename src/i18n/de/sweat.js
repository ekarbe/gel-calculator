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
 * German text for message keys returned by `src/domain/sweat.js`, plus the
 * sweat-test help texts the UI shows next to the test form.
 * Same keys and placeholders as `../en/sweat.js` (a parity test checks it).
 * @type {Record<string, string>}
 */
const sweat = {
  // resolveSweat: summary by source
  'sweat.why.test':
    'Dein Schweißtest ergibt {rateLph:volumeL}/h für dieses Event. Ein sorgfältiger Test ist auf etwa ±{uncertaintyLph:volumeL}/h genau, deine Rate liegt also wahrscheinlich bei {lo:volumeL:nounit}–{hi:volumeL}/h.',
  'sweat.why.estimate':
    'Deine geschätzte Schweißrate liegt bei {rateLph:volumeL}/h. Die Schätzung vergleicht die Wärme, die dein Körper erzeugt, mit der Wärme, die er an die Luft abgibt. Deine tatsächliche Rate liegt wahrscheinlich bei {lo:volumeL:nounit}–{hi:volumeL}/h.',
  'sweat.why.preset':
    'Du hast eine Schweißrate von {rateLph:volumeL}/h gewählt. Eine Selbsteinschätzung ist grob, deine tatsächliche Rate liegt also wahrscheinlich bei {lo:volumeL:nounit}–{hi:volumeL}/h.',

  // resolveSweat: details for a sweat test
  'sweat.why.testCorrection':
    'Das Testergebnis rechnet {correctionL:mass} Gewichtsverlust heraus, der durch das Verbrennen von etwa {energyKcal} kcal entsteht. Dieser Verlust kommt von verbrauchten Energiespeichern und der Atmung, nicht vom Schweiß.',
  'sweat.why.testCalibrated':
    'Du hast {testRateLph:volumeL}/h gemessen. Das Modell sagt für die Testbedingungen {testModelLph:volumeL}/h und für dieses Event {estimateLph:volumeL}/h voraus. Daher skaliert der Plan deine gemessene Rate mit dem Faktor {factor}.',
  'sweat.why.calibrationClamped':
    'Laut Modell ändert dieses Event deine Schweißrate um das {ratio}-Fache. Der Plan begrenzt die Skalierung auf das {min}- bis {max}-Fache und nutzt {factor}.',
  'sweat.why.calibrationCapped':
    'Auf dieses Event skaliert ergibt dein Test {scaledLph:volumeL}/h. Das ist mehr, als das Modell für deine Körpermaße zulässt, und mehr, als du gemessen hast. Daher nutzt der Plan {maxLph:volumeL}/h.',
  'sweat.why.calibrationUnavailable':
    'Das Modell sagt für die Testbedingungen fast keinen Schweiß voraus, daher kann der Plan deinen Test nicht auf dieses Event skalieren. Er nutzt deine gemessenen {testRateLph:volumeL}/h.',
  'sweat.why.testDirect':
    'Der Plan nutzt deine gemessenen {testRateLph:volumeL}/h unverändert. Das klappt am besten, wenn die Bedingungen beim Event denen beim Test entsprechen.',

  // resolveSweat: details for the estimate
  'sweat.why.estimateDrivers':
    'Bei dieser Belastung verbrennst du etwa {energyKcalPerHour} kcal/h, und dein Körper erzeugt etwa {heatW} W Wärme. Temperatur, Luftfeuchtigkeit, Sonne und Luftstrom bestimmen, wie viel davon der Schweiß abführen muss.',
  'sweat.why.estimateCapped':
    'Die Schätzung hat die Grenze von {maxLph:volumeL}/h erreicht. Nur wenige schwitzen mehr.',

  // resolveSweat: details for every source
  'sweat.why.sodium':
    'Du hast einen Natriumgehalt im Schweiß von {sodiumMmolL} mmol/L gewählt. Bei den meisten liegt er im Bereich von 10–90 mmol/L.',
  'sweat.why.measure':
    'Schweißraten unterscheiden sich stark von Person zu Person, ein Schweißtest liefert daher einen besseren Wert. Wiege dich vor und nach etwa 60 min bei Wettkampfintensität mit wenig oder ohne Kleidung auf derselben Waage. Trockne dich vor dem zweiten Wiegen ab. Rechne hinzu, was du getrunken hast, und zieh den Urin ab. {lossKg:mass} entspricht {sweatL:volumeL}.',

  // resolveSweat: warnings
  'sweat.warn.noTest':
    'Du hast noch keinen Schweißtest. Füge einen hinzu, um deine gemessene Rate zu nutzen. Bis dahin nutzt der Plan die Schätzung.',
  'sweat.warn.testUnusable':
    'Dein gewählter Schweißtest lässt sich nicht verwenden. Prüfe seine Werte. Bis dahin nutzt der Plan die Schätzung.',
  'sweat.warn.calibrationLimited':
    'Dein Schweißtest fand unter ganz anderen Bedingungen statt als dieses Event. Der Plan skaliert ihn höchstens um das {min}- bis {max}-Fache, deine Rate ist also unsicherer (±{uncertaintyLph:volumeL}/h). Ein Test unter Bedingungen, die näher am Event liegen, liefert einen besseren Wert.',
  'sweat.warn.estimateLow':
    'Das Modell sagt hier sehr wenig Schweiß voraus ({rateLph:volumeL}/h). Es geht von leichter Wettkampfkleidung und gleichmäßiger Belastung aus, deine tatsächliche Rate kann also höher sein, bis etwa {hi:volumeL}/h. Trink nach Durst und mach einen Schweißtest, um deine eigene Rate zu ermitteln.',
  'sweat.warn.uncompensable':
    'Unter diesen Bedingungen kann dein Körper nicht die gesamte erzeugte Wärme abgeben, selbst wenn du maximal schwitzt. Deine Körperkerntemperatur steigt weiter. Nimm Tempo raus, kühl dich mit Wasser oder Eis und hör auf, wenn dir schwindelig wird oder du dich verwirrt fühlst.',

  // sweatTestRate: problems
  'sweat.test.problem.duration': 'Gib eine Dauer über 0 min ein.',
  'sweat.test.problem.mass': 'Gib dein Körpergewicht vor und nach der Einheit ein.',
  'sweat.test.problem.noLoss':
    'Dieser Test ergibt {rateLph:volumeL}/h. Eine Schweißrate muss über 0 liegen. Prüfe die Gewichte und die getrunkene Flüssigkeit.',
  'sweat.test.problem.tooHigh':
    'Dieser Test ergibt {rateLph:volumeL}/h. Raten über {maxLph:volumeL}/h sind nicht realistisch. Prüfe die Gewichte, die Flüssigkeit und die Dauer.',

  // Sweat test form help (UI)
  'sweat.test.protocol':
    'Geh vorher auf die Toilette. Wiege dich mit wenig oder ohne Kleidung. Trainiere etwa 60 min bei Wettkampfintensität unter wettkampfähnlichen Bedingungen. Trockne dich ab und wiege dich erneut auf derselben Waage. Notiere, was du getrunken hast und wie viel Urin du gelassen hast. Wiederhole den Test 2- bis 3-mal für einen verlässlichen Wert.',
  'sweat.test.calibrateHelp':
    'Skaliert den Test auf die Bedingungen des Events. Das Modell sagt deine Schweißrate für die Testbedingungen und für das Event voraus. Der Plan skaliert deine gemessene Rate mit dem Verhältnis der beiden Werte, vom 0,5- bis zum 2-Fachen. Unter gleichen Bedingungen bekommst du deine gemessene Rate.',
};

export default sweat;
