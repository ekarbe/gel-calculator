import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  SWEAT_MODEL_UNCERTAINTY_LPH,
  SUN_ERF_W_M2,
  MODEL_DEFAULTS,
  SPORTS,
  SETTINGS,
  bodySurfaceArea,
  cyclingPowerFromSpeed,
  metabolicRate,
  airSpeed,
  estimateSweatRate,
} from './heatBalance';

/** Golden tolerance from the Phase 2 spec: ±0.03 L/h. */
const TOL = 0.03;

const RUNNER = { sport: 'running', speedKmh: 12, massKg: 70, heightCm: 175, setting: 'outdoor', sun: 'none' };
const CYCLIST = { sport: 'cycling', speedKmh: 30, powerW: 200, massKg: 75, heightCm: 180, setting: 'outdoor', sun: 'none' };

describe('constants', () => {
  it('uses ±0.5 L/h for the model and ERF 0/75/150 W/m² for the sun', () => {
    // [jay2024] limits of agreement about ±0.4 L/h → ±0.5 L/h shown
    expect(SWEAT_MODEL_UNCERTAINTY_LPH).toBe(0.5);
    // research notes A: ERF 0 shade/indoor/overcast, 75 partly sunny, 150 full sun
    expect(SUN_ERF_W_M2).toEqual({ none: 0, partly: 75, full: 150 });
    expect(Object.isFrozen(SUN_ERF_W_M2)).toBe(true);
  });

  it('lists the v4 sports and settings', () => {
    expect(SPORTS).toEqual(['running', 'cycling', 'other']);
    expect(SETTINGS).toEqual(['outdoor', 'indoorFan', 'indoorNoFan']);
    expect(Object.isFrozen(SPORTS) && Object.isFrozen(SETTINGS)).toBe(true);
  });

  it('defaults to the v4 plan inputs', () => {
    expect(MODEL_DEFAULTS).toEqual({
      sport: 'cycling',
      speedKmh: 30,
      powerW: 0,
      mets: 8,
      setting: 'outdoor',
      massKg: 70,
      heightCm: 175,
      tempC: 20,
      humidity: 50,
      sun: 'none',
      acclimatised: false,
    });
    expect(Object.isFrozen(MODEL_DEFAULTS)).toBe(true);
  });
});

describe('bodySurfaceArea', () => {
  it('uses the DuBois formula', () => {
    // 0.007184 × 70^0.425 × 175^0.725
    expect(bodySurfaceArea(70, 175)).toBeCloseTo(1.8481, 4);
    expect(bodySurfaceArea(75, 180)).toBeCloseTo(1.9424, 4);
    expect(bodySurfaceArea(50, 160)).toBeCloseTo(1.5011, 4);
  });

  it('clamps to the input limits and uses defaults for non-numbers', () => {
    expect(bodySurfaceArea(10, 50)).toBe(bodySurfaceArea(30, 120));
    expect(bodySurfaceArea(500, 300)).toBe(bodySurfaceArea(200, 220));
    expect(bodySurfaceArea(NaN, undefined)).toBe(bodySurfaceArea(70, 175));
    expect(bodySurfaceArea('80', null)).toBe(bodySurfaceArea(70, 175));
  });
});

describe('cyclingPowerFromSpeed', () => {
  it('adds aerodynamic drag and rolling resistance for rider + 10 kg', () => {
    // v = 30/3.6 m/s: 0.5 × 1.2 × 0.36 × v³ + 0.005 × 85 × 9.81 × v = 125.0 + 34.74
    expect(cyclingPowerFromSpeed(30, 75)).toBeCloseTo(159.744, 3);
    expect(cyclingPowerFromSpeed(36, 70)).toBeCloseTo(0.216 * 1000 + 0.005 * 80 * 9.81 * 10, 6);
  });

  it('rises with speed and mass', () => {
    expect(cyclingPowerFromSpeed(35, 70)).toBeGreaterThan(cyclingPowerFromSpeed(30, 70));
    expect(cyclingPowerFromSpeed(30, 90)).toBeGreaterThan(cyclingPowerFromSpeed(30, 70));
  });

  it('clamps the speed to 3–70 km/h and uses defaults for non-numbers', () => {
    expect(cyclingPowerFromSpeed(0, 70)).toBe(cyclingPowerFromSpeed(3, 70));
    expect(cyclingPowerFromSpeed(200, 70)).toBe(cyclingPowerFromSpeed(70, 70));
    expect(cyclingPowerFromSpeed(NaN, NaN)).toBe(cyclingPowerFromSpeed(30, 70));
  });
});

describe('metabolicRate', () => {
  it('uses the ACSM running equation', () => {
    // 70 × (3.5 + 0.2 × 200 m/min) × 20.9 / 60 = 1060.7 W
    expect(metabolicRate({ sport: 'running', speedKmh: 12, massKg: 70 })).toEqual({
      metabolicW: expect.closeTo(1060.675, 6),
      externalWorkW: 0,
      powerW: 0,
      powerFromSpeed: false,
    });
  });

  it('uses 20 % gross efficiency for cycling; the power leaves the body as work', () => {
    expect(metabolicRate({ sport: 'cycling', powerW: 200, massKg: 75 })).toEqual({
      metabolicW: 1000,
      externalWorkW: 200,
      powerW: 200,
      powerFromSpeed: false,
    });
  });

  it('derives the cycling power from the speed when the power is 0 (unknown)', () => {
    const r = metabolicRate({ sport: 'cycling', speedKmh: 30, powerW: 0, massKg: 75 });
    expect(r.powerFromSpeed).toBe(true);
    expect(r.powerW).toBeCloseTo(159.744, 3);
    expect(r.externalWorkW).toBe(r.powerW);
    expect(r.metabolicW).toBeCloseTo(r.powerW / 0.2, 9);
  });

  it('uses Compendium METs for other sports', () => {
    // 1.163 × 8 × 70 = 651.28 W
    expect(metabolicRate({ sport: 'other', mets: 8, massKg: 70 })).toEqual({
      metabolicW: expect.closeTo(651.28, 9),
      externalWorkW: 0,
      powerW: 0,
      powerFromSpeed: false,
    });
  });

  it('treats an unknown sport as cycling and a missing input as the defaults', () => {
    expect(metabolicRate({ sport: 'rowing', speedKmh: 30, massKg: 70 })).toEqual(
      metabolicRate({ sport: 'cycling', speedKmh: 30, massKg: 70 }),
    );
    expect(metabolicRate()).toEqual(metabolicRate(MODEL_DEFAULTS));
    expect(metabolicRate(null)).toEqual(metabolicRate({}));
  });
});

describe('airSpeed', () => {
  it('uses the speed outdoors for running and cycling', () => {
    expect(airSpeed({ sport: 'running', speedKmh: 12, setting: 'outdoor' })).toBeCloseTo(12 / 3.6, 12);
    expect(airSpeed({ sport: 'cycling', speedKmh: 30, setting: 'outdoor' })).toBeCloseTo(30 / 3.6, 12);
  });

  it('uses 1.0 m/s for other sports outdoors, 1.5 with a fan and 0.2 without', () => {
    expect(airSpeed({ sport: 'other', speedKmh: 30, setting: 'outdoor' })).toBe(1.0);
    expect(airSpeed({ sport: 'running', speedKmh: 12, setting: 'indoorFan' })).toBe(1.5);
    expect(airSpeed({ sport: 'cycling', speedKmh: 40, setting: 'indoorNoFan' })).toBe(0.2);
    expect(airSpeed({ sport: 'other', setting: 'indoorFan' })).toBe(1.5);
  });

  it('never goes below 0.2 m/s and treats unknown values as the defaults', () => {
    expect(airSpeed({ sport: 'running', speedKmh: 0, setting: 'outdoor' })).toBeCloseTo(3 / 3.6, 12);
    expect(airSpeed({ sport: 'running', speedKmh: 12, setting: 'garage' })).toBeCloseTo(12 / 3.6, 12);
    expect(airSpeed()).toBeCloseTo(30 / 3.6, 12);
    fc.assert(
      fc.property(
        fc.constantFrom('running', 'cycling', 'other', 'x'),
        fc.double(),
        fc.constantFrom('outdoor', 'indoorFan', 'indoorNoFan', 'x'),
        (sport, speedKmh, setting) => {
          const v = airSpeed({ sport, speedKmh, setting });
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0.2);
        },
      ),
    );
  });
});

describe('estimateSweatRate: golden values', () => {
  // Reference table: research notes section A, recomputed with final_model.py.
  it('run 70 kg/175 cm, 12 km/h, 20 °C/50 %, shade → 0.95 L/h', () => {
    // [gagnon2013] [cramer2019] Ereq 611 W, Emax 2016 W, w 0.30
    const e = estimateSweatRate({ ...RUNNER, tempC: 20, humidity: 50 });
    expect(e.rateLph).toBeCloseTo(0.95, 1);
    expect(Math.abs(e.rateLph - 0.95)).toBeLessThanOrEqual(TOL);
    expect(e.ereqW).toBeCloseTo(611.19, 1);
    expect(e.emaxW).toBeCloseTo(2016.42, 1);
    expect(e.wettedness).toBeCloseTo(0.303, 3);
    expect(e.skinTempC).toBeCloseTo(32.47, 2);
    expect(e.dryHeatLossW).toBeCloseTo(342.44, 1);
    expect(e.respiratoryHeatLossW).toBeCloseTo(107.05, 1);
    expect(e.solarGainW).toBe(0);
    expect(e.uncompensable).toBe(false);
    expect(e.capped).toBe(false);
  });

  it('same run in full sun → 1.27 L/h', () => {
    // [jay2024] outdoor solar load, ERF 150 W/m² → S 181 W
    const e = estimateSweatRate({ ...RUNNER, tempC: 20, humidity: 50, sun: 'full' });
    expect(Math.abs(e.rateLph - 1.27)).toBeLessThanOrEqual(TOL);
    expect(e.solarGainW).toBeCloseTo(181.43, 1);
  });

  it('run at 30 °C/60 % in the shade → 1.59 L/h', () => {
    // [gagnon2013] Ereq 884 W, Emax 1505 W, w 0.59
    const e = estimateSweatRate({ ...RUNNER, tempC: 30, humidity: 60 });
    expect(Math.abs(e.rateLph - 1.59)).toBeLessThanOrEqual(TOL);
    expect(e.ereqW).toBeCloseTo(884.15, 1);
    expect(e.emaxW).toBeCloseTo(1504.69, 1);
  });

  it('run at 30 °C/60 % in full sun → 2.11 L/h', () => {
    const e = estimateSweatRate({ ...RUNNER, tempC: 30, humidity: 60, sun: 'full' });
    expect(Math.abs(e.rateLph - 2.11)).toBeLessThanOrEqual(TOL);
  });

  it('cycle 75 kg/180 cm, 200 W at 30 km/h, 25 °C/50 %, shade → 0.60 L/h', () => {
    // [cramer2019] M = 200/0.20 = 1000 W, W = 200 W; Ereq 403 W
    const e = estimateSweatRate({ ...CYCLIST, tempC: 25, humidity: 50 });
    expect(Math.abs(e.rateLph - 0.6)).toBeLessThanOrEqual(TOL);
    expect(e.ereqW).toBeCloseTo(403.21, 1);
    expect(e.heatProductionW).toBe(800);
    expect(e.externalWorkW).toBe(200);
  });

  it('other sport at 8 METs, 70 kg/175 cm, 25 °C/50 %, outdoors → 0.75 L/h (0.3 clo)', () => {
    // The research table's 0.70 L/h used race-kit clothing (0.15 clo). The spec
    // sets 0.3 clo for other sports; final_model.py predict(1.163×8×70, 0, 70,
    // 175, 25, 0.5, 1.0, clo=0.3) gives 0.751 L/h (Ereq 455 W, Emax 1014 W).
    const e = estimateSweatRate({ sport: 'other', mets: 8, massKg: 70, heightCm: 175, setting: 'outdoor', tempC: 25, humidity: 50 });
    expect(Math.abs(e.rateLph - 0.75)).toBeLessThanOrEqual(TOL);
    expect(e.ereqW).toBeCloseTo(455.21, 1);
    expect(e.emaxW).toBeCloseTo(1014.37, 1);
    expect(e.airSpeedMs).toBe(1);
  });

  it('reports energy expenditure as metabolicW × 3600 / 4184', () => {
    const e = estimateSweatRate({ ...RUNNER, tempC: 20, humidity: 50 });
    expect(e.metabolicW).toBeCloseTo(1060.675, 6);
    expect(e.energyKcalPerHour).toBeCloseTo((1060.675 * 3600) / 4184, 9);
    expect(e.energyKcalPerHour).toBeCloseTo(912.6, 1);
    expect(e.uncertaintyLph).toBe(0.5);
  });
});

describe('estimateSweatRate: branches', () => {
  it('returns 0 when no evaporation is required (cold)', () => {
    const e = estimateSweatRate({ sport: 'other', mets: 1, tempC: -20, humidity: 50 });
    expect(e.ereqW).toBeLessThan(0);
    expect(e.rateLph).toBe(0);
    expect(e.wettedness).toBe(0);
    expect(e.uncompensable).toBe(false);
    expect(e.capped).toBe(false);
  });

  it('returns the ceiling when the air cannot take up sweat (Emax ≤ 0)', () => {
    // 45 °C and 100 % humidity: the vapour pressure of the air exceeds the skin's
    const e = estimateSweatRate({ sport: 'other', mets: 8, tempC: 45, humidity: 100, setting: 'indoorNoFan' });
    expect(e.emaxW).toBeLessThanOrEqual(0);
    expect(e.rateLph).toBe(e.maxRateLph);
    expect(e.wettedness).toBe(Infinity);
    expect(e.uncompensable).toBe(true);
    expect(e.capped).toBe(true);
  });

  it('returns the ceiling when wettedness is 1.7 or more', () => {
    const e = estimateSweatRate({ sport: 'cycling', powerW: 200, setting: 'indoorFan', tempC: 35, humidity: 80 });
    expect(e.wettedness).toBeGreaterThanOrEqual(1.7);
    expect(Number.isFinite(e.wettedness)).toBe(true);
    expect(e.rateLph).toBe(e.maxRateLph);
    expect(e.capped).toBe(true);
  });

  it('caps the rate at min(3, 1.5 × BSA)', () => {
    // 50 kg/160 cm: BSA 1.50 m² → 2.25 L/h
    const small = estimateSweatRate({ sport: 'running', speedKmh: 15, massKg: 50, heightCm: 160, tempC: 35, humidity: 60, sun: 'full' });
    expect(small.maxRateLph).toBeCloseTo(1.5 * 1.5011, 3);
    expect(small.rateLph).toBe(small.maxRateLph);
    expect(small.capped).toBe(true);
    // 100 kg/200 cm: BSA above 2 m² → 3 L/h
    expect(estimateSweatRate({ massKg: 100, heightCm: 200 }).maxRateLph).toBe(3);
  });

  it('flags uncompensable heat above wettedness 0.85, or 1.0 when acclimatised', () => {
    // indoor trainer with a fan, 200 W, 30 °C/80 %: w 0.91
    const base = { sport: 'cycling', powerW: 200, setting: 'indoorFan', tempC: 30, humidity: 80 };
    const e = estimateSweatRate(base);
    expect(e.wettedness).toBeGreaterThan(0.85);
    expect(e.wettedness).toBeLessThan(1.0);
    expect(e.uncompensable).toBe(true);
    const acclimatised = estimateSweatRate({ ...base, acclimatised: true });
    expect(acclimatised.uncompensable).toBe(false);
    // acclimatisation changes the threshold only, not the predicted rate
    expect(acclimatised.rateLph).toBe(e.rateLph);
    // only `true` counts as acclimatised
    expect(estimateSweatRate({ ...base, acclimatised: 'yes' }).uncompensable).toBe(true);
  });

  it('adds no sun load indoors', () => {
    const indoor = { ...RUNNER, setting: 'indoorFan', tempC: 22, humidity: 50 };
    expect(estimateSweatRate({ ...indoor, sun: 'full' })).toEqual(estimateSweatRate({ ...indoor, sun: 'none' }));
    expect(estimateSweatRate({ ...indoor, sun: 'full' }).solarGainW).toBe(0);
  });

  it('rises with the sun outdoors: none < partly < full', () => {
    const at = (sun) => estimateSweatRate({ ...RUNNER, tempC: 22, humidity: 50, sun }).rateLph;
    expect(at('none')).toBeLessThan(at('partly'));
    expect(at('partly')).toBeLessThan(at('full'));
  });

  it('uses 0.3 clo for other sports and 0.15 clo for running and cycling', () => {
    // Same metabolic rate and air speed: more clothing → less dry heat loss → more sweat
    const run = estimateSweatRate({ sport: 'running', speedKmh: 3.6, setting: 'outdoor', tempC: 20, humidity: 50 });
    const mets = run.metabolicW / (1.163 * 70);
    const other = estimateSweatRate({ sport: 'other', mets, setting: 'outdoor', tempC: 20, humidity: 50 });
    expect(other.airSpeedMs).toBe(run.airSpeedMs);
    expect(other.metabolicW).toBeCloseTo(run.metabolicW, 9);
    expect(other.dryHeatLossW).toBeLessThan(run.dryHeatLossW);
  });

  it('derives the power from the speed for cycling with power 0', () => {
    const e = estimateSweatRate({ ...CYCLIST, powerW: 0, tempC: 25, humidity: 50 });
    expect(e.powerFromSpeed).toBe(true);
    expect(e.powerW).toBeCloseTo(cyclingPowerFromSpeed(30, 75), 9);
    expect(e.rateLph).toBeLessThan(estimateSweatRate({ ...CYCLIST, tempC: 25, humidity: 50 }).rateLph);
  });

  it('uses the plan defaults for missing, non-finite or unknown values', () => {
    expect(estimateSweatRate()).toEqual(estimateSweatRate(MODEL_DEFAULTS));
    expect(estimateSweatRate(null)).toEqual(estimateSweatRate({}));
    expect(
      estimateSweatRate({ sport: 'swim', setting: 'pool', sun: 'toString', tempC: NaN, humidity: '80', massKg: Infinity }),
    ).toEqual(estimateSweatRate({}));
  });

  it('clamps values outside the input limits', () => {
    expect(estimateSweatRate({ ...RUNNER, tempC: 80, humidity: 150 })).toEqual(
      estimateSweatRate({ ...RUNNER, tempC: 50, humidity: 100 }),
    );
    expect(estimateSweatRate({ ...RUNNER, speedKmh: 500, massKg: 5 })).toEqual(
      estimateSweatRate({ ...RUNNER, speedKmh: 70, massKg: 30 }),
    );
  });

  it('does not mutate its input and is deterministic', () => {
    const input = Object.freeze({ ...RUNNER, tempC: 28, humidity: 65, sun: 'partly' });
    expect(estimateSweatRate(input)).toEqual(estimateSweatRate({ ...input }));
  });
});

describe('estimateSweatRate: properties', () => {
  const inputArb = fc.record({
    sport: fc.constantFrom('running', 'cycling', 'other'),
    speedKmh: fc.double({ min: 3, max: 70, noNaN: true }),
    powerW: fc.oneof(fc.constant(0), fc.double({ min: 0, max: 2000, noNaN: true })),
    mets: fc.double({ min: 1, max: 20, noNaN: true }),
    setting: fc.constantFrom('outdoor', 'indoorFan', 'indoorNoFan'),
    massKg: fc.double({ min: 30, max: 200, noNaN: true }),
    heightCm: fc.double({ min: 120, max: 220, noNaN: true }),
    tempC: fc.double({ min: -20, max: 50, noNaN: true }),
    humidity: fc.double({ min: 0, max: 100, noNaN: true }),
    sun: fc.constantFrom('none', 'partly', 'full'),
    acclimatised: fc.boolean(),
  });

  /** Checks every result field; `srMax` is the ceiling computed outside the module. */
  function expectValid(e, srMax) {
    expect(Number.isFinite(e.rateLph)).toBe(true);
    expect(e.rateLph).toBeGreaterThanOrEqual(0);
    expect(e.rateLph).toBeLessThanOrEqual(srMax + 1e-12);
    expect(e.maxRateLph).toBeCloseTo(srMax, 12);
    expect(e.capped).toBe(e.rateLph === e.maxRateLph);
    for (const key of Object.keys(e)) {
      if (key === 'wettedness' || typeof e[key] !== 'number') continue;
      expect(Number.isFinite(e[key]), key).toBe(true);
    }
    expect(e.energyKcalPerHour).toBeGreaterThan(0);
    expect(e.wettedness).toBeGreaterThanOrEqual(0);
    // the only non-finite value: sweat is needed but the air takes none up
    if (!Number.isFinite(e.wettedness)) {
      expect(e.wettedness).toBe(Infinity);
      expect(e.ereqW).toBeGreaterThan(0);
      expect(e.emaxW).toBeLessThanOrEqual(0);
      expect(e.uncompensable).toBe(true);
    }
  }

  it('is finite, ≥ 0 and ≤ SR_MAX = min(3, 1.5 × DuBois BSA) (property)', () => {
    // research notes A: SR_MAX = min(3.0, 1.5 × A), A = 0.007184 × kg^0.425 × cm^0.725
    fc.assert(
      fc.property(inputArb, (input) => {
        const bsa = 0.007184 * input.massKg ** 0.425 * input.heightCm ** 0.725;
        expectValid(estimateSweatRate(input), Math.min(3, 1.5 * bsa));
      }),
    );
  });

  it('stays valid for any value at all (property)', () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        const e = estimateSweatRate(input);
        expectValid(e, e.maxRateLph);
        expect(e.maxRateLph).toBeLessThanOrEqual(3);
        expect(e.maxRateLph).toBeGreaterThanOrEqual(1.5 * bodySurfaceArea(30, 120));
      }),
    );
  });

  it('reports infinite wettedness only when the air takes up no sweat', () => {
    // 50 °C at 60 %: the vapour pressure of the air is above that of 36 °C skin
    const e = estimateSweatRate({ ...RUNNER, tempC: 50, humidity: 60 });
    expect(e.emaxW).toBeLessThanOrEqual(0);
    expect(e.wettedness).toBe(Infinity);
    expect(e.uncompensable).toBe(true);
    expect(e.rateLph).toBe(e.maxRateLph);
  });

  it('never falls when the temperature rises (10–40 °C, others fixed)', () => {
    fc.assert(
      fc.property(
        inputArb,
        fc.double({ min: 10, max: 40, noNaN: true }),
        fc.double({ min: 10, max: 40, noNaN: true }),
        (input, a, b) => {
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          const cooler = estimateSweatRate({ ...input, tempC: lo }).rateLph;
          const warmer = estimateSweatRate({ ...input, tempC: hi }).rateLph;
          expect(warmer).toBeGreaterThanOrEqual(cooler);
        },
      ),
      { numRuns: 500 },
    );
  });
});
