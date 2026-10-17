import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Toast from './Toast';

describe('Toast', () => {
  it('keeps a polite live region in the page, empty without a message', () => {
    const { rerender } = render(<Toast message="" />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
    expect(region).toBeEmptyDOMElement();
    rerender(<Toast message="Recipe link copied" />);
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent('Recipe link copied');
    expect(region.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the neutral info icon by default, never a success check for an unknown outcome', () => {
    render(<Toast message="Settings changed" />);
    const icon = screen.getByRole('status').querySelector('svg');
    expect(icon.getAttribute('class')).toContain('text-ink-2');
    expect(icon.getAttribute('class')).not.toContain('text-ok');
  });

  it('hides the page toast under an open modal dialog; a dialog toast stays', () => {
    const { rerender } = render(<Toast message="Saved" tone="ok" />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('data-toast-layer', 'page');
    expect(region.className).toContain('[body:has(dialog:modal)_&]:hidden');
    rerender(<Toast message="Saved" tone="ok" layer="dialog" />);
    expect(screen.getByRole('status')).toHaveAttribute('data-toast-layer', 'dialog');
    expect(screen.getByRole('status').className).not.toContain('dialog:modal');
  });

  it('uses the tone colour for its icon and accepts a position', () => {
    render(<Toast message="Could not open the link" tone="danger" className="bottom-2" />);
    const region = screen.getByRole('status');
    expect(region.className).toContain('bottom-2');
    expect(region.querySelector('svg').getAttribute('class')).toContain('text-danger');
  });
});
