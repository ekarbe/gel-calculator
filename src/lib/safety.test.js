import { describe, it, expect } from 'vitest';
import {
  getSuggestedFluidMlPerHour,
  capSodiumTargets,
  getSodiumWarning,
  getCarbIntakeWarning,
  FLUID_MAX_ML_PER_HOUR,
  SODIUM_TARGET_MAX_MG_PER_HOUR,
} from './safety';

describe('safety', () => {
  it('suggests drinking less than the estimated sweat rate', () => {
    expect(getSuggestedFluidMlPerHour(0.5)).toBe(400);
    expect(getSuggestedFluidMlPerHour(0.5)).toBeLessThan(500);
  });

  it('never suggests more than the fluid ceiling, even for heavy sweaters', () => {
    expect(getSuggestedFluidMlPerHour(2.75)).toBe(FLUID_MAX_ML_PER_HOUR);
    expect(getSuggestedFluidMlPerHour(0)).toBe(0);
  });

  it('caps sodium and chloride together and keeps other electrolytes', () => {
    const { targets, sodiumCapped, uncappedSodium } = capSodiumTargets({ Sodium: 3000, Chloride: 4600, Potassium: 200, Magnesium: 2, Calcium: 25 });
    expect(sodiumCapped).toBe(true);
    expect(uncappedSodium).toBe(3000);
    expect(targets.Sodium).toBe(SODIUM_TARGET_MAX_MG_PER_HOUR);
    expect(targets.Chloride).toBeCloseTo(2300);
    expect(targets.Potassium).toBe(200);
  });

  it('leaves sodium targets within guidance untouched', () => {
    const input = { Sodium: 600, Chloride: 920 };
    expect(capSodiumTargets(input)).toEqual({ targets: input, sodiumCapped: false, uncappedSodium: 600 });
  });

  it('warns about high sodium and explains a cap', () => {
    expect(getSodiumWarning(500)).toBeNull();
    expect(getSodiumWarning(1200)).toMatch(/salty sweaters/);
    expect(getSodiumWarning(1500, { capped: true, uncapped: 6957 })).toMatch(/6957 mg\/h/);
    expect(getSodiumWarning(2000)).toMatch(/far above/);
  });

  it('warns above 90 g/h and more strongly above 120 g/h', () => {
    expect(getCarbIntakeWarning(90)).toBeNull();
    expect(getCarbIntakeWarning(100)).toMatch(/gut/);
    expect(getCarbIntakeWarning(130)).toMatch(/highest intake studied/);
  });
});
