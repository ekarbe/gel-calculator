import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { CURRENCIES, DEFAULT_CURRENCY, COST_PER_G, estimateCost } from './cost';
import { computePlan, DEFAULT_INPUTS } from './plan';

describe('estimateCost', () => {
  it('lists the supported currencies and their rates per g', () => {
    expect(CURRENCIES).toEqual(['EUR', 'USD', 'GBP']);
    expect(DEFAULT_CURRENCY).toBe('EUR');
    expect(COST_PER_G).toEqual({
      USD: { diy: 0.015, commercial: 0.1 },
      EUR: { diy: 0.014, commercial: 0.09 },
      GBP: { diy: 0.012, commercial: 0.08 },
    });
    expect(Object.isFrozen(COST_PER_G.EUR)).toBe(true);
  });

  it('prices 225 g of carbs in each currency', () => {
    const usd = estimateCost(225, 'USD');
    expect(usd.diy).toBeCloseTo(3.375, 10);
    expect(usd.commercial).toBeCloseTo(22.5, 10);
    expect(usd.savings).toBeCloseTo(19.125, 10);
    expect(usd).toMatchObject({ currency: 'USD', approximate: true });

    const eur = estimateCost(225, 'EUR');
    expect(eur.diy).toBeCloseTo(3.15, 10);
    expect(eur.commercial).toBeCloseTo(20.25, 10);
    expect(eur.savings).toBeCloseTo(17.1, 10);

    const gbp = estimateCost(225, 'GBP');
    expect(gbp.diy).toBeCloseTo(2.7, 10);
    expect(gbp.commercial).toBeCloseTo(18, 10);
    expect(gbp.currency).toBe('GBP');
  });

  it('matches the plan cost in USD, the rates the plan has always used', () => {
    const plan = computePlan(DEFAULT_INPUTS);
    const usd = estimateCost(plan.carbs.totalG, 'USD');
    expect(usd.diy).toBeCloseTo(plan.cost.diy, 10);
    expect(usd.commercial).toBeCloseTo(plan.cost.commercial, 10);
  });

  it('uses EUR for an unknown currency and 0 g for bad amounts', () => {
    expect(estimateCost(100, 'JPY').currency).toBe('EUR');
    expect(estimateCost(100).currency).toBe('EUR');
    expect(estimateCost(100, 'toString').currency).toBe('EUR');
    for (const bad of [undefined, null, NaN, -5, Infinity, '100']) {
      expect(estimateCost(bad, 'USD')).toEqual({ diy: 0, commercial: 0, savings: 0, currency: 'USD', approximate: true });
    }
  });

  it('is finite, non-negative and proportional to the carbs', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e5, noNaN: true }), fc.constantFrom(...CURRENCIES), (g, currency) => {
        const cost = estimateCost(g, currency);
        for (const value of [cost.diy, cost.commercial, cost.savings]) {
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
        }
        expect(cost.diy).toBeCloseTo(g * COST_PER_G[currency].diy, 6);
        expect(cost.savings).toBeCloseTo(cost.commercial - cost.diy, 9);
      }),
    );
  });
});
