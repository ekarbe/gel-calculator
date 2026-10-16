import { describe, it, expect } from 'vitest';
import { bodyMassText, PROJECTION_LABELS } from './bodyMass';
import { projectBodyMass } from '../../domain/hydration';

describe('bodyMassText', () => {
  it('describes a loss', () => {
    const hydration = { waterDeficitL: 0.1512, deficitPct: 0.216, scaleChangeKg: -0.558, level: 'ok' };
    expect(bodyMassText(hydration, 'kg')).toEqual({
      level: 'ok',
      label: 'Up to 2% loss',
      gain: false,
      scale: '−0.6 kg',
      waterTerm: 'Water lost',
      water: '0.15 L (0.2% of body mass)',
    });
    // −0.558 kg = −1.23 lb
    expect(bodyMassText(hydration, 'lb').scale).toBe('−1.2 lb');
  });

  // [hewbutler2015] a gain is "water gained", never a negative deficit
  it('describes a gain without a negative deficit', () => {
    const hydration = { waterDeficitL: -2.25, deficitPct: -3.214, scaleChangeKg: 1.843, level: 'gain' };
    expect(bodyMassText(hydration, 'kg')).toMatchObject({
      gain: true,
      label: 'Weight gain',
      scale: '+1.8 kg',
      waterTerm: 'Water gained',
      water: '2.25 L (3.2% of body mass)',
    });
  });

  it('rounds the scale change before it picks the sign', () => {
    expect(bodyMassText({ waterDeficitL: 0, deficitPct: 0, scaleChangeKg: -0.047, level: 'ok' }, 'kg').scale).toBe('0 kg');
    expect(bodyMassText({ waterDeficitL: 0, deficitPct: 0, scaleChangeKg: 0.03, level: 'ok' }, 'kg').scale).toBe('0 kg');
  });

  // [sawka2007] the domain's mild level starts above 2.0 % as shown, so 2.0 % is "up to 2%"
  it('labels exactly 2 % as up to 2% loss, matching the domain rule', () => {
    const hydration = projectBodyMass({ sweatRateLph: 1, fluidMlPerHour: 500, durationMin: 240, massKg: 100, energyKcalPerHour: 0 });
    expect(hydration.deficitPct).toBeCloseTo(2, 9);
    expect(hydration.level).toBe('ok');
    expect(bodyMassText(hydration, 'kg')).toMatchObject({ label: 'Up to 2% loss', water: '2 L (2% of body mass)' });
    expect(PROJECTION_LABELS).toEqual({ ok: 'Up to 2% loss', mild: '2–3% loss', high: 'Over 3% loss', gain: 'Weight gain' });
  });

  it('shows an unknown level as ok', () => {
    expect(bodyMassText({ level: 'nope', scaleChangeKg: 0, waterDeficitL: 0, deficitPct: 0 }, 'kg')).toMatchObject({
      level: 'ok',
      label: 'Up to 2% loss',
    });
    expect(bodyMassText(undefined, 'kg')).toMatchObject({ level: 'ok', scale: '0 kg' });
  });
});
