import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Page, { metadata } from './page';
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
    expect(container.firstChild).toHaveClass('min-h-screen');
    // Default plan: 180 min, 75 g/h.
    expect(screen.getByTestId('duration')).toHaveTextContent('180');
    expect(screen.getByTestId('carbs')).toHaveTextContent('75');
    expect(screen.getByTestId('modal')).toHaveTextContent('none');
    fireEvent.click(screen.getByRole('button', { name: 'Open templates' }));
    expect(screen.getByTestId('modal')).toHaveTextContent('templates');
  });

  it('leaves the main landmark to App', () => {
    const { container } = render(<Page />);
    // App renders its own <main>; the page wrapper must not add a second one.
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
    expect(metadata.title).toMatch(/Gel/);
    expect(metadata.alternates.canonical).toBe('https://eikekarbe.com/gel-calculator');
    expect(metadata.openGraph.url).toBe('https://eikekarbe.com/gel-calculator');
  });
});
