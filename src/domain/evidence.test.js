import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { CITATIONS, citationLabel, citationUrl } from './evidence';

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
    const registry = {
      web2020: { authors: 'Doe J', year: 2020, title: 'T', journal: 'J', url: 'https://example.org/paper' },
      both2020: { authors: 'Doe J', year: 2020, title: 'T', journal: 'J', doi: '10.1/x', url: 'https://example.org/x' },
      bare2020: { authors: 'Doe J', year: 2020, title: 'T', journal: 'J' },
      blank2020: { authors: 'Doe J', year: 2020, title: 'T', journal: 'J', doi: '  ', url: '' },
    };
    expect(citationUrl('web2020', registry)).toBe('https://example.org/paper');
    expect(citationUrl('both2020', registry)).toBe('https://doi.org/10.1/x');
    expect(citationUrl('bare2020', registry)).toBeNull();
    expect(citationUrl('blank2020', registry)).toBeNull();
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

  it('uses a custom registry when given one', () => {
    const registry = {
      solo2000: { authors: 'Smith J', year: 2000, title: 'T', journal: 'J' },
      pair2001: { authors: 'Smith J, Jones K', year: 2001, title: 'T', journal: 'J' },
      etal2002: { authors: 'Smith JA, et al.', year: 2002, title: 'T', journal: 'J' },
    };
    expect(citationLabel('solo2000', registry)).toBe('Smith 2000');
    expect(citationLabel('pair2001', registry)).toBe('Smith et al. 2001');
    expect(citationLabel('etal2002', registry)).toBe('Smith et al. 2002');
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

  it('is deterministic for registered ids', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ids), (id) => {
        expect(citationLabel(id)).toBe(citationLabel(id));
        expect(citationUrl(id)).toBe(citationUrl(id));
      }),
    );
  });
});
