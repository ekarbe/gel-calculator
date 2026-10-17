import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CONTRAST_PAIRS,
  GLOBALS_CSS,
  checkContrast,
  contrastRatio,
  parseBlocks,
  parseTokens,
  resolveColor,
  uniquePairs,
} from './check-contrast.mjs';

const css = readFileSync(GLOBALS_CSS, 'utf8');

describe('design token contrast (src/app/globals.css)', () => {
  it('meets WCAG AA for every pair in both themes', () => {
    const { results, failures } = checkContrast(css);
    expect(results).toHaveLength(CONTRAST_PAIRS.length * 2);
    expect(failures.map((f) => `${f.theme}: ${f.fg} on ${f.bg} ${f.ratio.toFixed(2)} < ${f.min}`)).toEqual([]);
  });

  it('lists each pair once', () => {
    const keys = CONTRAST_PAIRS.map(({ fg, bg }) => `${fg}|${bg}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(uniquePairs([{ fg: 'a', bg: 'b', min: 3 }, { fg: 'a', bg: 'b', min: 4.5 }])).toEqual([{ fg: 'a', bg: 'b', min: 4.5 }]);
  });

  it('covers what the primitives render: links and "Why?" on the warning boxes, the focus ring on tints', () => {
    const has = (fg, bg, min) => CONTRAST_PAIRS.some((p) => p.fg === fg && p.bg === bg && p.min >= min);
    // Citation links (ink) and the Why button (ink-2) in the Why panel and the warning/danger boxes.
    for (const fg of ['ink', 'ink-2']) {
      for (const bg of ['surface', 'surface-2', 'warn-soft', 'danger-soft']) expect(has(fg, bg, 4.5), `${fg} on ${bg}`).toBe(true);
    }
    for (const hue of ['glucose', 'fructose', 'sodium', 'fluid', 'caffeine', 'ok', 'warn', 'danger', 'accent']) {
      expect(has('focus', `${hue}-soft`, 3), `focus on ${hue}-soft`).toBe(true);
    }
  });

  it('reads the light and dark tokens, ignoring the print overrides', () => {
    const { light, dark } = parseTokens(css);
    expect(light['--surface']).toBe('#ffffff');
    expect(dark['--surface']).toBe('#141922');
    expect(light['--ink']).toBe('#0b0e13');
    expect(dark['--ink']).toBe('#f2f4f7');
    expect(light['--glucose-soft']).toBe('color-mix(in srgb, var(--glucose) 12%, var(--surface))');
    expect(dark['--glucose-soft']).toBe('color-mix(in srgb, var(--glucose) 18%, var(--surface))');
  });

  it('defines every token the pairs use, in both themes', () => {
    const { light, dark } = parseTokens(css);
    for (const { fg, bg } of CONTRAST_PAIRS) {
      for (const vars of [light, dark]) {
        expect(vars, fg).toHaveProperty([`--${fg}`]);
        expect(vars, bg).toHaveProperty([`--${bg}`]);
      }
    }
  });
});

describe('contrast helpers', () => {
  it('computes WCAG ratios', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrastRatio([255, 255, 255], [255, 255, 255])).toBe(1);
    // #767676 on white is the classic 4.54:1.
    expect(contrastRatio(resolveColor('#767676', {}), [255, 255, 255])).toBeCloseTo(4.54, 2);
  });

  it('resolves hex, var() and color-mix()', () => {
    const vars = { '--a': '#ff0000', '--b': '#fff', '--m': 'color-mix(in srgb, var(--a) 50%, var(--b))' };
    expect(resolveColor('var(--b)', vars)).toEqual([255, 255, 255]);
    expect(resolveColor('var(--m)', vars)).toEqual([255, 127.5, 127.5]);
    expect(() => resolveColor('var(--nope)', vars)).toThrow(/Unknown token/);
    expect(() => resolveColor('rgb(0 0 0)', vars)).toThrow(/Cannot resolve/);
    expect(() => resolveColor('var(--x)', { '--x': 'var(--x)' })).toThrow(/loop/);
  });

  it('parses nested blocks and keeps only their own declarations', () => {
    const blocks = parseBlocks('/* c */ @layer base { :root { --a: #000; } @media print { :root { --a: #fff } } }');
    const roots = blocks.filter((b) => b.prelude === ':root');
    expect(roots.map((b) => [b.ancestors, b.declarations])).toEqual([
      [['@layer base'], ['--a: #000']],
      [['@layer base', '@media print'], ['--a: #fff']],
    ]);
    expect(parseTokens('@layer base { :root { --a: #000; } @media print { :root { --a: #fff } } }').light['--a']).toBe('#000');
  });

  it('reports a failing pair', () => {
    const bad = ':root { --ink: #777777; --bg: #ffffff; }';
    const { failures } = checkContrast(bad, [{ fg: 'ink', bg: 'bg', min: 4.5 }]);
    expect(failures).toHaveLength(2);
    expect(failures[0]).toMatchObject({ theme: 'light', fg: 'ink', bg: 'bg', pass: false });
  });
});
