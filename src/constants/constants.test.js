import { describe, it, expect } from 'vitest';
import { 
  glucoseSourceOptions, 
  fructoseSourceOptions,
  allCarbSourceOptions,
  carbSourceOptions,
  electrolyteSourceOptions,
  SWEAT_RATES, 
  sourceDataByIdMap,
  allSourcesOptions,
  ELECTROLYTE_CONCENTRATIONS,
} from './constants';
import * as constants from './constants';

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

  it('sourceDataByIdMap maps ids to data accurately', () => {
    const item = glucoseSourceOptions[0];
    expect(sourceDataByIdMap.get(item.id)).toEqual(item);
  });

  it('drops the unused label-keyed source map', () => {
    expect(constants).not.toHaveProperty('sourceDataMap');
  });

  it('no longer exports TEMPLATES (they live in templates.js)', () => {
    expect(constants).not.toHaveProperty('TEMPLATES');
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

  it('has no absorption factors on salt components (guidance is in ingested amounts)', () => {
    for (const opt of electrolyteSourceOptions) {
      for (const component of opt.components) {
        expect(Object.keys(component).sort(), `${opt.label} ${component.name}`).toEqual(['name', 'ratio']);
      }
    }
  });

  it('keeps only the sweat sodium presets (the other ions live in electrolytes.js)', () => {
    expect(Object.keys(ELECTROLYTE_CONCENTRATIONS)).toEqual(['Sodium']);
  });

  it('keeps sweat sodium within the measured 10-90 mmol/L range', () => {
    for (const mmol of ELECTROLYTE_CONCENTRATIONS.Sodium) {
      expect(mmol).toBeGreaterThanOrEqual(10);
      expect(mmol).toBeLessThanOrEqual(90);
    }
  });

  describe('osmolality and water data (phase 2 research table)', () => {
    it('gives every carb source a finite osmPerG >= 0, a waterFraction in [0, 1) and a group', () => {
      for (const opt of allCarbSourceOptions) {
        expect(Number.isFinite(opt.osmPerG), opt.label).toBe(true);
        expect(opt.osmPerG, opt.label).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(opt.waterFraction), opt.label).toBe(true);
        expect(opt.waterFraction, opt.label).toBeGreaterThanOrEqual(0);
        expect(opt.waterFraction, opt.label).toBeLessThan(1);
        expect(['powder', 'syrup'], opt.label).toContain(opt.group);
        expect(opt.glucoseContent + opt.fructoseContent, opt.label).toBeCloseTo(1, 6);
      }
    });

    it('never has carbs plus water above the mass as purchased', () => {
      // Dextrose monohydrate rounds to 0.91 carbs + 0.091 water = 1.001.
      for (const opt of allCarbSourceOptions) {
        expect(opt.carbsPerGram + opt.waterFraction, opt.label).toBeLessThanOrEqual(1.005);
      }
    });

    // Research notes section C: sugars 1000 / molar mass; maltodextrin DE 18 at 0.95 dry
    // matter; glucose syrup DE 42 at 80% dry solids. Vist & Maughan 1995 (vist1995).
    it('uses the research table values', () => {
      const expected = {
        1: [5.55, 0], 8: [5.05, 0.091], 11: [5.55, 0], 18: [2.92, 0], 4: [2.78, 0.05],
        3: [0.95, 0.05], 5: [0.02, 0.05], 2: [1.86, 0.2], 6: [2.0, 0.21], 7: [2.0, 0.2],
        12: [4.21, 0.23], 13: [3.8, 0.23], 14: [4.5, 0.17], 17: [1.95, 0.32], 19: [3.0, 0.03],
        15: [3.9, 0.25], 16: [3.9, 0.32], 20: [3.9, 0.3],
      };
      expect(allCarbSourceOptions.map((o) => o.id).sort((a, b) => a - b)).toEqual(
        Object.keys(expected).map(Number).sort((a, b) => a - b),
      );
      for (const [id, [osmPerG, waterFraction]] of Object.entries(expected)) {
        const opt = sourceDataByIdMap.get(Number(id));
        expect(opt.osmPerG, opt.label).toBe(osmPerG);
        expect(opt.waterFraction, opt.label).toBe(waterFraction);
      }
    });

    it('groups dextrose, maltodextrin, maltose, HBCD, fructose, sucrose and coconut sugar as powders', () => {
      const powders = allCarbSourceOptions.filter((o) => o.group === 'powder').map((o) => o.id);
      expect(powders.sort((a, b) => a - b)).toEqual([1, 3, 4, 5, 8, 11, 18, 19]);
    });

    it('gives every salt a finite osmPerG >= 0 and keeps its components', () => {
      const expected = { 31: 31.8, 32: 24.7, 33: 10.9, 39: 9.9, 34: 5.5, 35: 0, 36: 13.0, 37: 23.5, 38: 22.1, 40: 5.3 };
      for (const opt of electrolyteSourceOptions) {
        expect(Number.isFinite(opt.osmPerG), opt.label).toBe(true);
        expect(opt.osmPerG, opt.label).toBeGreaterThanOrEqual(0);
        expect(opt.osmPerG, opt.label).toBe(expected[opt.id]);
        expect(opt.components.length, opt.label).toBeGreaterThan(0);
      }
    });
  });

  describe('carbSourceOptions', () => {
    it('lists every carb source once, powders first, then syrups', () => {
      expect(carbSourceOptions).toHaveLength(allCarbSourceOptions.length);
      expect(new Set(carbSourceOptions.map((o) => o.id))).toEqual(new Set(allCarbSourceOptions.map((o) => o.id)));
      const groups = carbSourceOptions.map((o) => o.group);
      const firstSyrup = groups.indexOf('syrup');
      expect(firstSyrup).toBeGreaterThan(0);
      expect(groups.slice(0, firstSyrup).every((g) => g === 'powder')).toBe(true);
      expect(groups.slice(firstSyrup).every((g) => g === 'syrup')).toBe(true);
    });

    it('keeps the list order inside each group and shares the source objects', () => {
      expect(carbSourceOptions.map((o) => o.id)).toEqual([1, 8, 3, 4, 5, 11, 18, 19, 2, 6, 7, 12, 13, 14, 15, 16, 20, 17]);
      for (const opt of carbSourceOptions) expect(sourceDataByIdMap.get(opt.id)).toBe(opt);
    });

    it('keeps the glucose and fructose lists for older imports', () => {
      expect(glucoseSourceOptions.map((o) => o.id)).toEqual([1, 8, 2, 3, 4, 5, 6, 7]);
      expect(fructoseSourceOptions.map((o) => o.id)).toEqual([11, 12, 13, 14, 15, 16, 20, 17, 18, 19]);
    });
  });
});
