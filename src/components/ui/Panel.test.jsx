import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Panel from './Panel';

describe('Panel', () => {
  it('is a section that becomes a named region with aria-labelledby', () => {
    render(
      <Panel aria-labelledby="t" data-testid="panel">
        <h2 id="t">Event</h2>
        <p>Body</p>
      </Panel>,
    );
    const region = screen.getByRole('region', { name: 'Event' });
    expect(region.tagName).toBe('SECTION');
    expect(region).toBe(screen.getByTestId('panel'));
    expect(region.className).toContain('rounded-panel');
    expect(region.className).toContain('border-line');
    expect(region.className).toContain('bg-surface');
    expect(region.className).toContain('p-4');
  });

  it('can be another element, inset and unpadded', () => {
    render(
      <Panel as="div" inset padded={false} className="extra" data-testid="panel">
        x
      </Panel>,
    );
    const panel = screen.getByTestId('panel');
    expect(panel.tagName).toBe('DIV');
    expect(panel.className).toContain('bg-surface-2');
    expect(panel.className).not.toContain('p-4');
    expect(panel.className).toContain('extra');
  });
});
