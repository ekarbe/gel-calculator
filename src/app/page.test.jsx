import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Page, { metadata, OG_IMAGE_URL } from './page';
import { normalizeInputs } from '../domain/plan';
import { encodeShareState } from '../state/shareCodec';

// App is replaced by a probe that reads both providers, so these tests cover
// what the page adds: the providers and the share-link restore.
vi.mock('./app', async () => {
  const { usePlan } = await import('../state/PlanProvider');
  const { useUi } = await import('../state/UiProvider');
  return {
    default: function AppProbe() {
      const plan = usePlan();
      const { modal, openModal } = useUi();
      return (
        <div data-testid="app-probe">
          <output data-testid="duration">{plan.durationMin}</output>
          <output data-testid="carbs">{plan.carbs.gPerHour}</output>
          <output data-testid="modal">{modal ?? 'none'}</output>
          <button type="button" onClick={() => openModal('templates')}>
            Open templates
          </button>
        </div>
      );
    },
  };
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

describe('Page', () => {
  it('renders the app inside PlanProvider and UiProvider', () => {
    const { container } = render(<Page />);
    expect(screen.getByTestId('app-probe')).toBeInTheDocument();
    // No wrapper: the app renders the whole frame.
    expect(container.firstChild).toBe(screen.getByTestId('app-probe'));
    // Default plan: 180 min, 75 g/h.
    expect(screen.getByTestId('duration')).toHaveTextContent('180');
    expect(screen.getByTestId('carbs')).toHaveTextContent('75');
    expect(screen.getByTestId('modal')).toHaveTextContent('none');
    fireEvent.click(screen.getByRole('button', { name: 'Open templates' }));
    expect(screen.getByTestId('modal')).toHaveTextContent('templates');
  });

  it('leaves the main landmark to App', () => {
    const { container } = render(<Page />);
    // App renders its own <main>; the page must not add a second one.
    expect(container.querySelector('main')).toBeNull();
  });

  it('restores the inputs from a ?s= share link', () => {
    const shared = normalizeInputs({ event: { durationMin: 120 } });
    window.history.replaceState(null, '', `/?s=${encodeShareState(shared)}`);
    render(<Page />);
    expect(screen.getByTestId('duration')).toHaveTextContent('120');
    // 120 min, moderate → 55 g/h.
    expect(screen.getByTestId('carbs')).toHaveTextContent('55');
  });

  it('ignores an unreadable share link and keeps the defaults', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.history.replaceState(null, '', '/?s=not-a-share-link');
    render(<Page />);
    expect(screen.getByTestId('duration')).toHaveTextContent('180');
    expect(warn).toHaveBeenCalledWith('Ignoring unreadable share link');
  });

  it('exports page metadata with the canonical URL', () => {
    expect(metadata.title).toBe('DIY Energy Gel & Sports Drink Calculator | Optimize Your Fuel');
    expect(metadata.description).toMatch(/glucose:fructose/);
    expect(metadata.alternates.canonical).toBe('https://eikekarbe.com/gel-calculator');
    expect(metadata.openGraph.url).toBe('https://eikekarbe.com/gel-calculator');
    expect(metadata.openGraph.siteName).toBe('Gel Calculator');
  });

  it('points the social previews at the 1200 × 630 card in public/og.png', async () => {
    expect(OG_IMAGE_URL).toBe('https://eikekarbe.com/gel-calculator/og.png');
    const image = { url: OG_IMAGE_URL, width: 1200, height: 630, type: 'image/png' };
    expect(metadata.openGraph.images).toEqual([expect.objectContaining(image)]);
    expect(metadata.openGraph.images[0].alt).toMatch(/race board/i);
    expect(metadata.twitter.card).toBe('summary_large_image');
    expect(metadata.twitter.images).toEqual([expect.objectContaining(image)]);

    // The file is there, a PNG of that size (IHDR: width and height at bytes 16 and 20).
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const png = readFileSync(join(process.cwd(), 'public/og.png'));
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
});
