import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { CITATIONS, citationLabel, citationUrl, _labelFor, _urlFor } from './evidence';

// Required ids, years and DOIs from the Phase 1 spec (section 1).
const REQUIRED = {
  jeukendrup2014: [2014, '10.1007/s40279-014-0148-z'],
  thomas2016: [2016, '10.1249/MSS.0000000000000852'],
  burke2011: [2011, '10.1080/02640414.2011.585473'],
  smith2013: [2013, '10.1249/MSS.0b013e31827205d1'],
  podlogar2022: [2022, '10.1007/s00421-022-05019-w'],
  hearris2022: [2022, '10.1152/japplphysiol.00091.2022'],
  rowlands2015: [2015, '10.1007/s40279-015-0381-0'],
  obrien2013: [2013, '10.1249/MSS.0b013e31828e12d4'],
  wallis2005: [2005, '10.1249/01.MSS.0000155399.23358.82'],
  jeukendrup2017: [2017, '10.1007/s40279-017-0690-6'],
  cox2010: [2010, '10.1152/japplphysiol.00950.2009'],
  carter2004: [2004, '10.1249/01.MSS.0000147585.65709.6F'],
  brietzke2019: [2019, '10.1007/s40279-018-1029-7'],
  baker2017: [2017, '10.1007/s40279-017-0691-5'],
  baker2019: [2019, '10.1080/23328940.2019.1632145'],
  barnes2019: [2019, '10.1080/02640414.2019.1633159'],
  montain2007: [2007, '10.1123/ijsnem.17.6.574'],
  sawka2007: [2007, '10.1249/mss.0b013e31802ca597'],
  mccubbin2023: [2023, '10.1080/17461391.2022.2083526'],
  hoffman2015: [2015, '10.1249/MSS.0000000000000599'],
  hewbutler2015: [2015, '10.1097/JSM.0000000000000221'],
  delcoso2016: [2016, '10.1111/sms.12427'],
  almond2005: [2005, '10.1056/NEJMoa043901'],
  kenefick2018: [2018, '10.1007/s40279-017-0844-6'],
  efsa2011: [2011, '10.2903/j.efsa.2011.2211'],
  fine1991: [1991, '10.1172/JCI115317'],
  guest2021: [2021, '10.1186/s12970-020-00383-4'],
  carvalho2022: [2022, '10.1007/s40279-022-01685-0'],
  efsa2015: [2015, '10.2903/j.efsa.2015.4102'],
  talanian2016: [2016, '10.1139/apnm-2016-0053'],
  grgic2021: [2021, '10.1186/s12970-021-00458-w'],
  deoliveira2022: [2022, '10.1007/s40279-021-01575-x'],
};

const ids = Object.keys(CITATIONS);

describe('evidence: CITATIONS registry', () => {
  it('contains exactly the required ids', () => {
    expect([...ids].sort()).toEqual(Object.keys(REQUIRED).sort());
    expect(ids).toHaveLength(32);
  });

  it.each(ids)('%s has authors, year, title and journal', (id) => {
    const c = CITATIONS[id];
    expect(typeof c.authors).toBe('string');
    expect(c.authors.trim()).not.toBe('');
    expect(Number.isInteger(c.year)).toBe(true);
    expect(c.year).toBeGreaterThanOrEqual(1900);
    expect(c.year).toBeLessThanOrEqual(2026);
    expect(typeof c.title).toBe('string');
    expect(c.title.trim()).not.toBe('');
    expect(typeof c.journal).toBe('string');
    expect(c.journal.trim()).not.toBe('');
  });

  it.each(ids)('%s matches the spec year and DOI', (id) => {
    const [year, doi] = REQUIRED[id];
    expect(CITATIONS[id].year).toBe(year);
    expect(CITATIONS[id].doi).toBe(doi);
  });

  it('every id ends with its publication year', () => {
    for (const id of ids) {
      expect(id.endsWith(String(CITATIONS[id].year))).toBe(true);
    }
  });

  it('spot-checks authoritative entries', () => {
    // [jeukendrup2014] carbohydrate bands by duration
    expect(CITATIONS.jeukendrup2014).toEqual({
      authors: 'Jeukendrup AE',
      year: 2014,
      title: 'A step towards personalized sports nutrition: carbohydrate intake during exercise',
      journal: 'Sports Med 44(S1):S25–33',
      doi: '10.1007/s40279-014-0148-z',
    });
    // [thomas2016] ACSM/AND/DC position stand
    expect(CITATIONS.thomas2016.authors).toBe('Thomas DT, Erdman KA, Burke LM');
    // [obrien2013] apostrophe in the surname is preserved
    expect(CITATIONS.obrien2013.authors).toBe("O'Brien WJ et al.");
    // [efsa2015] group author
    expect(CITATIONS.efsa2015.authors).toBe('EFSA NDA Panel');
  });

  it('uses the published titles for entries the spec table had wrong', () => {
    // [rowlands2015] the 2015 Sports Med review (the 0.8:1 ratio guidance), not
    // the 2012 Appl Physiol Nutr Metab race study by the same first author.
    expect(CITATIONS.rowlands2015.title).toBe(
      'Fructose–glucose composite carbohydrates and endurance performance: critical review and future perspectives',
    );
    // [hearris2022] published title, not a paraphrase
    expect(CITATIONS.hearris2022.title).toBe(
      '13C-glucose-fructose labeling reveals comparable exogenous CHO oxidation during exercise when consuming 120 g/h in fluid, gel, jelly chew, or coingestion',
    );
    // [carvalho2022] published title, not a paraphrase
    expect(CITATIONS.carvalho2022.title).toBe(
      'Can I have my coffee and drink it? A systematic review and meta-analysis to determine whether habitual caffeine consumption affects the ergogenic effect of caffeine',
    );
    // [efsa2011] leading part of the (very long) published title
    expect(CITATIONS.efsa2011.title).toBe(
      'Scientific opinion on the substantiation of health claims related to carbohydrate-electrolyte solutions',
    );
  });

  it('is frozen so callers cannot mutate it', () => {
    expect(Object.isFrozen(CITATIONS)).toBe(true);
    for (const id of ids) expect(Object.isFrozen(CITATIONS[id])).toBe(true);
    // ES modules are strict, so writing to a frozen object throws.
    expect(() => {
      CITATIONS.jeukendrup2014.year = 1999;
    }).toThrow(TypeError);
    expect(CITATIONS.jeukendrup2014.year).toBe(2014);
  });
});

describe('evidence: citationUrl', () => {
  it.each(ids)('%s links to doi.org', (id) => {
    expect(citationUrl(id)).toBe(`https://doi.org/${REQUIRED[id][1]}`);
  });

  it('returns a valid absolute https URL for every id', () => {
    for (const id of ids) {
      const url = new URL(citationUrl(id));
      expect(url.protocol).toBe('https:');
      expect(url.hostname).toBe('doi.org');
    }
  });

  it('returns null for unknown, empty, non-string and prototype ids', () => {
    expect(citationUrl('nope2099')).toBeNull();
    expect(citationUrl('')).toBeNull();
    expect(citationUrl(undefined)).toBeNull();
    expect(citationUrl(null)).toBeNull();
    expect(citationUrl(42)).toBeNull();
    expect(citationUrl('toString')).toBeNull();
    expect(citationUrl('__proto__')).toBeNull();
  });

  it('falls back to url when there is no DOI, and to null when there is neither', () => {
    // No registry entry lacks a DOI, so the fallbacks are checked on the helper.
    const base = { authors: 'Doe J', year: 2020, title: 'T', journal: 'J' };
    expect(_urlFor({ ...base, url: 'https://example.org/paper' })).toBe('https://example.org/paper');
    expect(_urlFor({ ...base, doi: '10.1/x', url: 'https://example.org/x' })).toBe('https://doi.org/10.1/x');
    expect(_urlFor({ ...base, doi: ' 10.1/y ' })).toBe('https://doi.org/10.1/y');
    expect(_urlFor(base)).toBeNull();
    expect(_urlFor({ ...base, doi: '  ', url: '' })).toBeNull();
  });

  it('takes one argument, so it can be passed straight to map', () => {
    expect(citationUrl).toHaveLength(1);
    // Regression: map passes (id, index, array); index 0 used to be read as a
    // registry and every lookup missed.
    expect(['jeukendrup2014', 'thomas2016', 'burke2011'].map(citationUrl)).toEqual([
      'https://doi.org/10.1007/s40279-014-0148-z',
      'https://doi.org/10.1249/MSS.0000000000000852',
      'https://doi.org/10.1080/02640414.2011.585473',
    ]);
    expect(ids.map(citationUrl)).toEqual(ids.map((id) => citationUrl(id)));
    expect(ids.map(citationUrl)).not.toContain(null);
  });
});

describe('evidence: citationLabel', () => {
  it('formats a single author as "Surname Year"', () => {
    expect(citationLabel('jeukendrup2014')).toBe('Jeukendrup 2014');
    expect(citationLabel('jeukendrup2017')).toBe('Jeukendrup 2017');
    expect(citationLabel('baker2017')).toBe('Baker 2017');
    expect(citationLabel('baker2019')).toBe('Baker 2019');
    expect(citationLabel('mccubbin2023')).toBe('McCubbin 2023');
    expect(citationLabel('kenefick2018')).toBe('Kenefick 2018');
  });

  it('formats "et al." author lists as "Surname et al. Year"', () => {
    expect(citationLabel('podlogar2022')).toBe('Podlogar et al. 2022');
    expect(citationLabel('burke2011')).toBe('Burke et al. 2011');
    expect(citationLabel('almond2005')).toBe('Almond et al. 2005');
    expect(citationLabel('obrien2013')).toBe("O'Brien et al. 2013");
    expect(citationLabel('hewbutler2015')).toBe('Hew-Butler et al. 2015');
    expect(citationLabel('delcoso2016')).toBe('Del Coso et al. 2016');
    expect(citationLabel('deoliveira2022')).toBe('de Oliveira et al. 2022');
  });

  it('formats listed multi-author entries as "Surname et al. Year"', () => {
    expect(citationLabel('thomas2016')).toBe('Thomas et al. 2016');
    expect(citationLabel('carter2004')).toBe('Carter et al. 2004');
    expect(citationLabel('montain2007')).toBe('Montain et al. 2007');
    expect(citationLabel('hoffman2015')).toBe('Hoffman et al. 2015');
    expect(citationLabel('talanian2016')).toBe('Talanian et al. 2016');
  });

  it('keeps group authors whole', () => {
    expect(citationLabel('efsa2011')).toBe('EFSA NDA Panel 2011');
    expect(citationLabel('efsa2015')).toBe('EFSA NDA Panel 2015');
  });

  it('gives every registered id a non-empty label ending in its year', () => {
    for (const id of ids) {
      const label = citationLabel(id);
      expect(label).toMatch(new RegExp(`^\\S.* ${CITATIONS[id].year}$`));
      // No leftover initials such as "Jeukendrup AE 2014".
      expect(label).not.toMatch(/\s[A-Z]{1,3}\s(et al\. )?\d{4}$/);
    }
  });

  it('returns the id for unknown string ids and "" for non-strings', () => {
    expect(citationLabel('nope2099')).toBe('nope2099');
    expect(citationLabel('toString')).toBe('toString');
    expect(citationLabel('')).toBe('');
    expect(citationLabel(undefined)).toBe('');
    expect(citationLabel(null)).toBe('');
    expect(citationLabel(7)).toBe('');
  });

  it('formats author lists that no registry entry uses', () => {
    const base = { title: 'T', journal: 'J' };
    expect(_labelFor({ ...base, authors: 'Smith J', year: 2000 })).toBe('Smith 2000');
    expect(_labelFor({ ...base, authors: 'Smith J, Jones K', year: 2001 })).toBe('Smith et al. 2001');
    expect(_labelFor({ ...base, authors: 'Smith JA, et al.', year: 2002 })).toBe('Smith et al. 2002');
    expect(_labelFor({ ...base, authors: 'Smith J-P et al', year: 2003 })).toBe('Smith et al. 2003');
  });

  it('takes one argument, so it can be passed straight to map', () => {
    expect(citationLabel).toHaveLength(1);
    // Regression: map passes (id, index, array); index 0 used to be read as a
    // registry and every label fell back to the raw id.
    expect(['jeukendrup2014', 'thomas2016', 'podlogar2022'].map(citationLabel)).toEqual([
      'Jeukendrup 2014',
      'Thomas et al. 2016',
      'Podlogar et al. 2022',
    ]);
    expect(ids.map(citationLabel)).toEqual(ids.map((id) => citationLabel(id)));
    for (const label of ids.map(citationLabel)) expect(ids).not.toContain(label);
  });
});

describe('evidence: properties', () => {
  it('unknown ids never resolve, whatever the string', () => {
    fc.assert(
      fc.property(fc.string(), (id) => {
        fc.pre(!Object.prototype.hasOwnProperty.call(CITATIONS, id));
        expect(citationUrl(id)).toBeNull();
        expect(citationLabel(id)).toBe(id);
      }),
    );
  });

  it('resolves every registered id to its label and DOI link, whatever extra arguments follow', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ids), fc.anything(), (id, extra) => {
        const label = citationLabel(id);
        const url = citationUrl(id);
        expect(label).not.toBe(id);
        expect(label).toMatch(new RegExp(` ${CITATIONS[id].year}$`));
        expect(url).toBe(`https://doi.org/${CITATIONS[id].doi}`);
        // Extra positional arguments (map's index and array, or anything else)
        // never change the result.
        expect(citationLabel(id, extra)).toBe(label);
        expect(citationUrl(id, extra)).toBe(url);
        expect(citationLabel(id, extra, ids)).toBe(label);
        expect(citationUrl(id, extra, ids)).toBe(url);
      }),
    );
  });
});
