import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// next/font/google only works inside the Next build; each font gives its CSS variable class.
vi.mock('next/font/google', () => {
  const font = (variable) => () => ({ variable, className: variable });
  return {
    Barlow_Condensed: font('font-display-var'),
    IBM_Plex_Sans: font('font-sans-var'),
    IBM_Plex_Mono: font('font-mono-var'),
  };
});
vi.mock('./globals.css', () => ({}));
// next-themes reads matchMedia while rendering; the probe shows the props the layout passes.
vi.mock('../components/shell/ThemeProvider', () => ({
  ThemeProvider: ({ children, ...props }) => <div data-theme-props={JSON.stringify(props)}>{children}</div>,
}));

const { default: RootLayout, metadata, viewport } = await import('./layout');

describe('RootLayout', () => {
  it('draws under the notch (the shell pads with the safe-area insets)', () => {
    expect(viewport).toEqual({ width: 'device-width', initialScale: 1, viewportFit: 'cover' });
  });

  it('has the site metadata and the favicon under the base path', () => {
    expect(metadata.metadataBase.href).toBe('https://eikekarbe.com/');
    expect(metadata.title).toBe('Gel Calculator');
    expect(metadata.description).toMatch(/energy gel/);
    expect(metadata.icons.map((icon) => icon.url)).toEqual(['/gel-calculator/favicon.svg', '/gel-calculator/favicon.svg']);
  });

  it('renders <html lang="en"> with the font variables and the structured data', () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>content</p>
      </RootLayout>,
    );
    expect(html).toMatch(/<html lang="en" class="font-display-var font-sans-var font-mono-var">/);
    expect(html).toContain('<p>content</p>');
    const props = JSON.parse(html.match(/data-theme-props="([^"]*)"/)[1].replaceAll('&quot;', '"'));
    expect(props).toEqual({ attribute: 'class', defaultTheme: 'system', enableSystem: true });
    const json = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
    expect(json).toMatchObject({
      '@type': 'WebApplication',
      name: 'Gel Calculator',
      url: 'https://eikekarbe.com/gel-calculator',
      image: 'https://eikekarbe.com/gel-calculator/og.png',
    });
  });
});
