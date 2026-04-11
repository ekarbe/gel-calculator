import { describe, it, expect } from 'vitest';
import { 
  glucoseSourceOptions, 
  fructoseSourceOptions,
  electrolyteSourceOptions,
  SWEAT_RATES, 
  sourceDataMap,
  TEMPLATES
} from './constants';

describe('constants', () => {
  it('exports glucoseSourceOptions as an array of objects', () => {
    expect(Array.isArray(glucoseSourceOptions)).toBe(true);
    expect(glucoseSourceOptions.length).toBeGreaterThan(0);
    expect(glucoseSourceOptions[0]).toHaveProperty('id');
    expect(glucoseSourceOptions[0]).toHaveProperty('label');
  });

  it('exports fructoseSourceOptions as an array of objects', () => {
    expect(Array.isArray(fructoseSourceOptions)).toBe(true);
    expect(fructoseSourceOptions.length).toBeGreaterThan(0);
  });

  it('exports electrolyteSourceOptions correctly', () => {
    expect(Array.isArray(electrolyteSourceOptions)).toBe(true);
    expect(electrolyteSourceOptions[0]).toHaveProperty('components');
  });

  it('exports SWEAT_RATES array', () => {
    expect(SWEAT_RATES).toEqual([0.25, 0.75, 1.25, 1.75, 2.25, 2.75]);
  });

  it('sourceDataMap maps labels to data accurately', () => {
    const item = glucoseSourceOptions[0];
    expect(sourceDataMap.get(item.label)).toEqual(item);
  });

  it('exports TEMPLATES array', () => {
    expect(Array.isArray(TEMPLATES)).toBe(true);
    expect(TEMPLATES.length).toBeGreaterThan(0);
    expect(TEMPLATES[0]).toHaveProperty('name');
  });
});
