import { describe, it, expect } from 'vitest';
import { createFormat, MINUS, UNIT_SYMBOLS, INPUT_DIGITS } from './formatters';

const en = createFormat('en', { unitSystem: 'metric' });
const us = createFormat('en', { unitSystem: 'imperial', currency: 'USD' });
const de = createFormat('de', { unitSystem: 'metric', currency: 'EUR' });
const NBSP = ' ';

describe('createFormat', () => {
  it('is cached and frozen per locale, unit system and currency', () => {
    expect(createFormat('en', { unitSystem: 'metric' })).toBe(en);
    expect(createFormat()).toBe(en);
    expect(createFormat('fr', { unitSystem: 'nautical', currency: 'JPY' })).toBe(en);
    expect(Object.isFrozen(en)).toBe(true);
    expect(us).toMatchObject({ locale: 'en', unitSystem: 'imperial', currencyCode: 'USD', tag: 'en-US' });
    expect(de).toMatchObject({ locale: 'de', unitSystem: 'metric', currencyCode: 'EUR', tag: 'de-DE' });
  });

  it('exposes unit symbols and the decimals of imperial fields', () => {
    expect(UNIT_SYMBOLS.volume).toEqual({ metric: 'ml', imperial: 'fl oz' });
    expect(INPUT_DIGITS.mass).toBe(1);
    expect(en.unit('mass')).toBe('kg');
    expect(us.unit('mass')).toBe('lb');
    expect(us.unit('temp')).toBe('°F');
    expect(us.unit('pace')).toBe('min/mi');
    expect(us.unit('nope')).toBe('');
  });
});

describe('number', () => {
  it('formats with locale separators and at most the given decimals', () => {
    expect(en.number(1234.567)).toBe('1,235');
    expect(en.number(1234.567, 2)).toBe('1,234.57');
    expect(de.number(1234.567, 2)).toBe('1.234,57');
    expect(de.number(0.15, 2)).toBe('0,15');
    expect(en.number(2.5, { digits: 2, minDigits: 2 })).toBe('2.50');
    expect(en.number(2, { digits: 1, minDigits: 3 })).toBe('2.0');
  });

  it('uses a real minus, never signs a value that shows as zero, and adds + when asked', () => {
    expect(en.number(-1.5, 1)).toBe(`${MINUS}1.5`);
    expect(en.number(-0.04, 1)).toBe('0');
    expect(en.number(-0)).toBe('0');
    expect(en.number(0.3, { digits: 1, signed: true })).toBe('+0.3');
    expect(en.number(0, { signed: true })).toBe('0');
    expect(en.number(-1.8, { digits: 1, signed: true })).toBe(`${MINUS}1.8`);
  });

  it('shows bad numbers as 0', () => {
    for (const bad of [NaN, Infinity, undefined, null, '12']) expect(en.number(bad)).toBe('0');
  });

  it('rounds integers', () => {
    expect(en.integer(2.5)).toBe('3');
    expect(en.integer(-2.5)).toBe(`${MINUS}3`);
    expect(en.integer(4, { signed: true })).toBe('+4');
    expect(de.integer(12345)).toBe('12.345');
  });
});

describe('quantities', () => {
  it('formats mass', () => {
    expect(en.mass(70)).toBe('70 kg');
    expect(en.mass(70.25)).toBe('70.3 kg');
    expect(us.mass(70)).toBe('154.3 lb');
    expect(us.mass(-0.558, { signed: true })).toBe(`${MINUS}1.2 lb`);
    expect(en.mass(0.3, { signed: true })).toBe('+0.3 kg');
    expect(us.mass(70, { unit: false, digits: 0 })).toBe('154');
    expect(de.mass(70.5)).toBe('70,5 kg');
  });

  it('formats height, in feet and inches for imperial', () => {
    expect(en.height(175)).toBe('175 cm');
    expect(us.height(175)).toBe('5 ft 9 in');
    expect(us.height(182.8)).toBe('6 ft 0 in');
    expect(us.height(175, { inches: true })).toBe('69 in');
    expect(us.height(175, { inches: true, digits: 1 })).toBe('68.9 in');
    expect(us.height(175, { unit: false })).toBe('69');
  });

  it('formats temperature', () => {
    expect(en.temp(20)).toBe('20 °C');
    expect(us.temp(20)).toBe('68 °F');
    expect(us.temp(35)).toBe('95 °F');
    expect(us.temp(21)).toBe('69.8 °F');
    expect(en.temp(-5)).toBe(`${MINUS}5 °C`);
    expect(de.temp(20.5)).toBe('20,5 °C');
  });

  it('formats speed and pace', () => {
    expect(en.speed(30)).toBe('30 km/h');
    expect(us.speed(30)).toBe('18.6 mph');
    expect(en.pace(4.5)).toBe('4:30 min/km');
    expect(us.pace(5)).toBe('8:03 min/mi');
    expect(en.pace(4.999)).toBe('5:00 min/km');
    expect(en.pace(5, { unit: false })).toBe('5:00');
    expect(en.pace(NaN)).toBe('0:00 min/km');
  });

  it('formats volumes in ml, L and US fl oz', () => {
    expect(en.volume(800)).toBe('800 ml');
    expect(en.volume(1500)).toBe('1,500 ml');
    expect(us.volume(800)).toBe('27 fl oz');
    expect(us.volume(150)).toBe('5.1 fl oz');
    expect(us.volume(750, { digits: 1 })).toBe('25.4 fl oz');
    expect(en.volumeL(1.25)).toBe('1.25 L');
    expect(en.volumeL(0.155)).toBe('0.16 L');
    expect(us.volumeL(1.25)).toBe('42 fl oz');
    expect(us.volumeL(0.5)).toBe('17 fl oz');
    expect(de.volume(1500)).toBe('1.500 ml');
    expect(de.volumeL(0.15)).toBe('0,15 L');
    expect(us.volumeL(1.21, { unit: false })).toBe('41');
  });

  it('formats percentages with the locale spacing', () => {
    expect(en.percent(60)).toBe('60%');
    expect(en.percent(1.94)).toBe('1.9%');
    expect(de.percent(1.94)).toBe(`1,9${NBSP}%`);
    expect(en.percent(5, { signed: true })).toBe('+5%');
  });
});

describe('currency, dates, ratios and durations', () => {
  it('formats money in the chosen currency', () => {
    expect(en.currency(3.15)).toBe('€3.15');
    expect(us.currency(3.375)).toBe('$3.38');
    expect(createFormat('en', { currency: 'GBP' }).currency(2.7)).toBe('£2.70');
    expect(de.currency(1234.5)).toBe(`1.234,50${NBSP}€`);
    expect(en.currency(3, { currency: 'USD', digits: 0 })).toBe('$3');
    expect(en.currency(-2)).toBe(`${MINUS}€2.00`);
    expect(en.currency(NaN)).toBe('€0.00');
  });

  it('formats dates, reading plain days as local dates', () => {
    expect(en.date('2026-10-01')).toBe('Oct 1, 2026');
    expect(de.date('2026-10-01')).toBe('01.10.2026');
    expect(en.date(new Date(2026, 0, 5), { day: 'numeric', month: 'long' })).toBe('January 5');
    expect(en.date('not a date')).toBe('');
    // Numbers stay en-US and de-DE whatever the browser region; dates follow it.
    const gb = createFormat('en', { browserLanguage: 'en-GB' });
    expect(gb.date('2026-10-17')).toBe('17 Oct 2026');
    expect(gb.date('2026-10-17', { dateStyle: 'long' })).toBe('17 October 2026');
    expect(gb.date(new Date(2026, 9, 17, 7, 20), { dateStyle: 'medium', timeStyle: 'short' })).toBe('17 Oct 2026, 07:20');
    expect(gb.number(1234.5, 1)).toBe('1,234.5');
    expect(gb.tag).toBe('en-US');
    expect(createFormat('en', { browserLanguage: 'en-US' }).date('2026-10-17', { dateStyle: 'long' })).toBe('October 17, 2026');
    expect(createFormat('en', { browserLanguage: 'en_GB' }).dateTag).toBe('en-GB');
    // Another language's region, a bare language or rubbish: the language's own tag.
    expect(createFormat('en', { browserLanguage: 'de-DE' }).dateTag).toBe('en-US');
    expect(createFormat('de', { browserLanguage: 'en-GB' }).dateTag).toBe('de-DE');
    expect(createFormat('de', { browserLanguage: 'de-AT' }).dateTag).toBe('de-AT');
    expect(createFormat('en', { browserLanguage: 'en' }).dateTag).toBe('en-US');
    expect(createFormat('en', { browserLanguage: 'en-!!' }).dateTag).toBe('en-US');
    expect(en.date(undefined)).toBe('');
  });

  it('formats ratios with locale decimals', () => {
    expect(en.ratio('1:0.5')).toBe('1:0.5');
    expect(de.ratio('1:0.5')).toBe('1:0,5');
    expect(de.ratio({ glucose: 1, fructose: 0.8 })).toBe('1:0,8');
    expect(de.ratio({ glucose: 0, fructose: 1 })).toBe('0:1');
    expect(en.ratio({ glucose: 0, fructose: 0 })).toBe('0:0');
  });

  it('formats durations', () => {
    expect(en.duration(45)).toBe('45 min');
    expect(en.duration(180)).toBe('3 h');
    expect(en.duration(150)).toBe('2 h 30 min');
    expect(en.duration(-5)).toBe('0 min');
  });
});

describe('field conversion', () => {
  it('passes metric values through and converts imperial ones, rounded', () => {
    expect(en.toDisplay('mass', 70.123)).toBe(70.123);
    expect(en.toDisplay('mass', 70.123, { digits: 1 })).toBe(70.1);
    expect(us.toDisplay('mass', 70)).toBe(154.3);
    expect(us.toDisplay('temp', 25)).toBe(77);
    expect(us.toDisplay('volume', 750)).toBe(25.4);
    expect(us.toDisplay('height', 175)).toBe(68.9);
    expect(us.toDisplay('speed', 30, { digits: 0 })).toBe(19);
  });

  it('converts typed imperial values back to metric', () => {
    expect(en.fromDisplay('mass', 70)).toBe(70);
    expect(us.fromDisplay('mass', 154.3)).toBeCloseTo(69.99, 2);
    expect(us.fromDisplay('temp', 77)).toBe(25);
    expect(us.fromDisplay('volume', 25.4)).toBeCloseTo(751.2, 1);
    expect(us.fromDisplay('height', 69)).toBeCloseTo(175.26, 9);
  });
});

describe('number input', () => {
  it('writes editable numbers without grouping, with the locale decimal separator', () => {
    expect(en.inputValue(1500.25)).toBe('1500.25');
    expect(de.inputValue(1500.25)).toBe('1500,25');
    expect(en.inputValue(-3.14159, 2)).toBe('-3.14');
    expect(en.inputValue(-0.0001)).toBe('0');
    expect(en.inputValue(NaN)).toBe('');
    expect(en.inputValue(undefined)).toBe('');
  });

  it('parses numbers typed in English', () => {
    expect(en.parseNumber('70')).toBe(70);
    expect(en.parseNumber(' 70.5 ')).toBe(70.5);
    expect(en.parseNumber('1,500')).toBe(1500);
    expect(en.parseNumber('12,345,678.5')).toBe(12345678.5);
    expect(en.parseNumber('1,5')).toBe(1.5);
    expect(en.parseNumber('1.500,5')).toBe(1500.5);
    expect(en.parseNumber('−3')).toBe(-3);
    expect(en.parseNumber('-3')).toBe(-3);
    expect(en.parseNumber('+4')).toBe(4);
    expect(en.parseNumber('5.')).toBe(5);
    expect(en.parseNumber('.5')).toBe(0.5);
  });

  it('never reads a group that starts with 0 as thousands', () => {
    // "0,750" is no grouped number: it is 0.75 (a litre-scale field would clamp 750 to its max).
    expect(en.parseNumber('0,750')).toBe(0.75);
    expect(en.parseNumber('-0,750')).toBe(-0.75);
    expect(en.parseNumber('00,750')).toBe(0.75);
    expect(de.parseNumber('0.750')).toBe(0.75);
    expect(de.parseNumber('0.5')).toBe(0.5);
    // Real groupings still read as thousands.
    expect(en.parseNumber('1,750')).toBe(1750);
    expect(en.parseNumber('100,750')).toBe(100750);
    expect(de.parseNumber('1.750')).toBe(1750);
  });

  it('parses numbers typed in German', () => {
    expect(de.parseNumber('1,5')).toBe(1.5);
    expect(de.parseNumber('1.500')).toBe(1500);
    expect(de.parseNumber('1.500,25')).toBe(1500.25);
    expect(de.parseNumber('1.5')).toBe(1.5);
    expect(de.parseNumber('1 500')).toBe(1500);
  });

  it('rejects text that is not a number', () => {
    for (const bad of ['', ' ', '-', '.', ',', 'abc', '1e3', '--3', '1.2.3', '1,2,3', '12a', null, undefined, {}]) {
      expect(en.parseNumber(bad), String(bad)).toBeNaN();
    }
    expect(en.parseNumber(Infinity)).toBeNaN();
    expect(en.parseNumber(42)).toBe(42);
  });
});
