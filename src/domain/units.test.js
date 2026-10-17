import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  UNIT_SYSTEMS,
  QUANTITY_KINDS,
  KG_PER_LB,
  LB_PER_KG,
  CM_PER_IN,
  KM_PER_MI,
  ML_PER_FL_OZ,
  isImperial,
  kgToLb,
  lbToKg,
  cmToIn,
  inToCm,
  cToF,
  fToC,
  kmhToMph,
  mphToKmh,
  mlToFlOz,
  flOzToMl,
  lToFlOz,
  flOzToL,
  minPerKmToMinPerMi,
  minPerMiToMinPerKm,
  paceFromSpeed,
  speedFromPace,
  roundTo,
  roundToStep,
  cmToFtIn,
  ftInToCm,
  splitMinutes,
  toUnitSystem,
  fromUnitSystem,
} from './units';

const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const finite = fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true });

describe('constants', () => {
  it('uses the exact definitions', () => {
    expect(KG_PER_LB).toBe(0.45359237);
    expect(LB_PER_KG * KG_PER_LB).toBeCloseTo(1, 15);
    expect(CM_PER_IN).toBe(2.54);
    expect(KM_PER_MI).toBe(1.609344);
    expect(ML_PER_FL_OZ).toBe(29.5735295625);
    expect(UNIT_SYSTEMS).toEqual(['metric', 'imperial']);
    expect(QUANTITY_KINDS).toEqual(['mass', 'height', 'temp', 'speed', 'pace', 'volume', 'volumeL']);
    expect(Object.isFrozen(UNIT_SYSTEMS)).toBe(true);
  });

  it('knows the imperial system only by its name', () => {
    expect(isImperial('imperial')).toBe(true);
    expect(isImperial('metric')).toBe(false);
    expect(isImperial(undefined)).toBe(false);
  });
});

describe('conversions', () => {
  it('converts reference values', () => {
    expect(kgToLb(70)).toBeCloseTo(154.324, 3);
    expect(lbToKg(154.324)).toBeCloseTo(70, 3);
    expect(cmToIn(175)).toBeCloseTo(68.898, 3);
    expect(inToCm(69)).toBeCloseTo(175.26, 9);
    expect(cToF(20)).toBe(68);
    expect(cToF(-40)).toBe(-40);
    expect(cToF(100)).toBe(212);
    expect(fToC(68)).toBe(20);
    expect(fToC(32)).toBe(0);
    expect(kmhToMph(30)).toBeCloseTo(18.641, 3);
    expect(mphToKmh(10)).toBeCloseTo(16.09344, 9);
    expect(mlToFlOz(800)).toBeCloseTo(27.051, 3);
    expect(flOzToMl(1)).toBe(ML_PER_FL_OZ);
    expect(lToFlOz(1)).toBeCloseTo(33.814, 3);
    expect(flOzToL(33.814)).toBeCloseTo(1, 4);
    // 5:00 min/km is 8:03 min/mi.
    expect(minPerKmToMinPerMi(5)).toBeCloseTo(8.04672, 9);
    expect(minPerMiToMinPerKm(8.04672)).toBeCloseTo(5, 9);
  });

  it('treats missing and non-finite values as 0', () => {
    for (const bad of [undefined, null, NaN, Infinity, -Infinity, '70']) {
      expect(kgToLb(bad)).toBe(0);
      expect(cmToIn(bad)).toBe(0);
      expect(cToF(bad)).toBe(32);
      expect(fToC(bad)).toBeCloseTo(-17.778, 3);
      expect(mlToFlOz(bad)).toBe(0);
      expect(kmhToMph(bad)).toBe(0);
    }
  });

  it('round-trips every pair', () => {
    const pairs = [
      [kgToLb, lbToKg],
      [cmToIn, inToCm],
      [cToF, fToC],
      [kmhToMph, mphToKmh],
      [mlToFlOz, flOzToMl],
      [lToFlOz, flOzToL],
      [minPerKmToMinPerMi, minPerMiToMinPerKm],
    ];
    fc.assert(
      fc.property(finite, (x) => {
        for (const [to, from] of pairs) {
          expect(close(from(to(x)), x)).toBe(true);
          expect(close(to(from(x)), x)).toBe(true);
        }
      }),
    );
  });

  it('round-trips through toUnitSystem and fromUnitSystem for every kind', () => {
    fc.assert(
      fc.property(fc.constantFrom(...QUANTITY_KINDS), fc.constantFrom(...UNIT_SYSTEMS), finite, (kind, system, x) => {
        expect(close(fromUnitSystem(kind, toUnitSystem(kind, x, system), system), x)).toBe(true);
      }),
    );
  });

  it('passes metric values and unknown kinds through', () => {
    expect(toUnitSystem('mass', 70, 'metric')).toBe(70);
    expect(fromUnitSystem('temp', 20, 'metric')).toBe(20);
    expect(toUnitSystem('mass', 70, undefined)).toBe(70);
    expect(toUnitSystem('energy', 70, 'imperial')).toBe(70);
    expect(fromUnitSystem('energy', 70, 'imperial')).toBe(70);
    expect(toUnitSystem('mass', NaN, 'metric')).toBe(0);
  });

  it('maps each kind to its imperial unit', () => {
    expect(toUnitSystem('mass', 70, 'imperial')).toBeCloseTo(154.32, 2);
    expect(toUnitSystem('height', 175, 'imperial')).toBeCloseTo(68.9, 1);
    expect(toUnitSystem('temp', 20, 'imperial')).toBe(68);
    expect(toUnitSystem('speed', 30, 'imperial')).toBeCloseTo(18.64, 2);
    expect(toUnitSystem('pace', 5, 'imperial')).toBeCloseTo(8.05, 2);
    expect(toUnitSystem('volume', 750, 'imperial')).toBeCloseTo(25.36, 2);
    expect(toUnitSystem('volumeL', 1.25, 'imperial')).toBeCloseTo(42.27, 2);
    expect(fromUnitSystem('volume', 25.36, 'imperial')).toBeCloseTo(750, 0);
  });
});

describe('pace and speed', () => {
  it('converts between km/h and min/km', () => {
    expect(paceFromSpeed(12)).toBe(5);
    expect(speedFromPace(5)).toBe(12);
    expect(paceFromSpeed(0)).toBe(0);
    expect(paceFromSpeed(-3)).toBe(0);
    expect(speedFromPace(0)).toBe(0);
    expect(speedFromPace(NaN)).toBe(0);
  });

  it('splits minutes into minutes and seconds without a 60th second', () => {
    expect(splitMinutes(4.5)).toEqual({ min: 4, sec: 30 });
    expect(splitMinutes(4.999)).toEqual({ min: 5, sec: 0 });
    expect(splitMinutes(8.04672)).toEqual({ min: 8, sec: 3 });
    expect(splitMinutes(-2)).toEqual({ min: 0, sec: 0 });
    expect(splitMinutes(NaN)).toEqual({ min: 0, sec: 0 });
  });
});

describe('feet and inches', () => {
  it('rounds to whole inches before splitting', () => {
    expect(cmToFtIn(175)).toEqual({ ft: 5, in: 9 });
    expect(cmToFtIn(182.8)).toEqual({ ft: 6, in: 0 });
    expect(cmToFtIn(152.4)).toEqual({ ft: 5, in: 0 });
    expect(cmToFtIn(0)).toEqual({ ft: 0, in: 0 });
  });

  it('converts feet and inches back to cm', () => {
    expect(ftInToCm(5, 9)).toBeCloseTo(175.26, 9);
    expect(ftInToCm(6)).toBeCloseTo(182.88, 9);
  });

  it('round-trips heights to the nearest inch', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 120 }), (inches) => {
        const { ft, in: rest } = cmToFtIn(inToCm(inches));
        expect(ft * 12 + rest).toBe(inches);
        expect(rest).toBeLessThan(12);
      }),
    );
  });
});

describe('rounding', () => {
  it('rounds half away from zero without binary drift', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(2.675, 2)).toBe(2.68);
    expect(roundTo(0.5)).toBe(1);
    expect(roundTo(-0.5)).toBe(-1);
    expect(roundTo(-1.25, 1)).toBe(-1.3);
    expect(roundTo(154.3236, 1)).toBe(154.3);
    expect(roundTo(1234, -2)).toBe(1200);
    expect(roundTo(1e-7, 2)).toBe(0);
    expect(roundTo(1.5e21, 0)).toBe(1.5e21);
  });

  it('never returns −0 and treats bad numbers as 0', () => {
    expect(Object.is(roundTo(-0.001, 1), 0)).toBe(true);
    expect(Object.is(roundTo(-0), 0)).toBe(true);
    expect(roundTo(NaN, 1)).toBe(0);
    expect(roundTo(5.55, 1.5)).toBe(6);
  });

  it('stays within half a unit of the last digit', () => {
    fc.assert(
      fc.property(finite, fc.integer({ min: 0, max: 4 }), (x, d) => {
        expect(Math.abs(roundTo(x, d) - x)).toBeLessThanOrEqual(0.5 * 10 ** -d + 1e-9 * Math.max(1, Math.abs(x)));
      }),
    );
  });

  it('rounds to a step', () => {
    expect(roundToStep(2.26, 0.5)).toBe(2.5);
    expect(roundToStep(0.1 * 3, 0.1)).toBe(0.3);
    expect(roundToStep(677, 50)).toBe(700);
    expect(roundToStep(12.3, 0)).toBe(12.3);
    expect(roundToStep(12.3, -1)).toBe(12.3);
  });
});
