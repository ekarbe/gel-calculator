import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import Segmented, { AUTO_ADJUST_OPTIONS } from './Segmented';

describe('Segmented', () => {
  it('marks the active option and reports clicks', () => {
    const onChange = vi.fn();
    render(<Segmented label="Mode" value="auto" onChange={onChange} options={AUTO_ADJUST_OPTIONS} />);
    const group = screen.getByRole('group', { name: 'Mode' });
    expect(within(group).getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'Adjust' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(within(group).getByRole('button', { name: 'Adjust' }));
    expect(onChange).toHaveBeenCalledWith('manual');
  });

  it('has a small and a full-width size', () => {
    const { rerender } = render(<Segmented label="Unit" value="kg" onChange={() => {}} options={[{ value: 'kg', label: 'kg' }]} />);
    expect(screen.getByRole('button', { name: 'kg' })).toHaveClass('text-xs');
    rerender(<Segmented label="Unit" value="kg" onChange={() => {}} options={[{ value: 'kg', label: 'kg' }]} size="lg" />);
    expect(screen.getByRole('button', { name: 'kg' })).toHaveClass('flex-1', 'text-sm');
  });

  it('offers Auto and Adjust for every recommendation', () => {
    expect(AUTO_ADJUST_OPTIONS.map((o) => o.value)).toEqual(['auto', 'manual']);
  });
});
