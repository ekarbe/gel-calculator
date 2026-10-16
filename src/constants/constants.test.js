import { describe, it, expect } from 'vitest';
import { 
  glucoseSourceOptions, 
  fructoseSourceOptions,
  electrolyteSourceOptions,
  SWEAT_RATES, 
  sourceDataMap,
  sourceDataByIdMap,
  allSourcesOptions,
  ELECTROLYTE_CONCENTRATIONS,
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

  it('splits every carb source fully between the glucose and fructose pathways', () => {
    for (const opt of [...glucoseSourceOptions, ...fructoseSourceOptions]) {
      expect(opt.glucoseContent + opt.fructoseContent, opt.label).toBeCloseTo(1, 6);
      expect(opt.carbsPerGram, opt.label).toBeGreaterThan(0);
      expect(opt.carbsPerGram, opt.label).toBeLessThanOrEqual(1);
    }
  });

  it('never lets salt components exceed the salt mass', () => {
    for (const opt of electrolyteSourceOptions) {
      const total = opt.components.reduce((sum, c) => sum + c.ratio, 0);
      expect(total, opt.label).toBeLessThanOrEqual(1.0001);
    }
  });

  it('uses the heptahydrate magnesium fraction for Epsom salt', () => {
    const epsom = sourceDataByIdMap.get(40);
    expect(epsom.label).toMatch(/Epsom/);
    expect(epsom.components.find(c => c.name === 'Magnesium').ratio).toBeCloseTo(0.0986, 3);
  });

  it('has unique ids across all sources', () => {
    const ids = allSourcesOptions.map(o => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only references existing sources in templates', () => {
    for (const tpl of TEMPLATES) {
      for (const s of [...tpl.glucoseSources, ...tpl.fructoseSources, ...tpl.electrolyteSources]) {
        expect(sourceDataByIdMap.has(s.id), `${tpl.name} -> ${s.id}`).toBe(true);
      }
    }
  });

  it('keeps sweat sodium within the measured 10-90 mmol/L range', () => {
    for (const mmol of ELECTROLYTE_CONCENTRATIONS.Sodium) {
      expect(mmol).toBeGreaterThanOrEqual(10);
      expect(mmol).toBeLessThanOrEqual(90);
    }
  });
});
