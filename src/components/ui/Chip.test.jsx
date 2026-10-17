import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Droplet } from 'lucide-react';
import Chip from './Chip';

describe('Chip', () => {
  it('is static text in the tone colours by default', () => {
    const { container } = render(
      <Chip tone="sodium" icon={Droplet} data-testid="chip">
        Sweat 0.9 L/h
      </Chip>,
    );
    const chip = screen.getByTestId('chip');
    expect(chip.tagName).toBe('SPAN');
    expect(chip.className).toContain('bg-sodium-soft');
    expect(chip.className).toContain('text-sodium');
    expect(chip).toHaveTextContent('Sweat 0.9 L/h');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('is a button with onClick, operable by keyboard', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Chip tone="danger" onClick={onClick} aria-haspopup="dialog">
        3 warnings
      </Chip>,
    );
    const button = screen.getByRole('button', { name: '3 warnings' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(button);
    button.focus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('is a toggle button with pressed', () => {
    const { rerender } = render(<Chip pressed={false} onClick={() => {}}>Honey</Chip>);
    expect(screen.getByRole('button', { name: 'Honey' })).toHaveAttribute('aria-pressed', 'false');
    const off = screen.getByRole('button', { name: 'Honey' }).className.split(' ');
    expect(off).toContain('border-transparent');
    expect(off).not.toContain('border-current');
    rerender(<Chip pressed onClick={() => {}}>Honey</Chip>);
    expect(screen.getByRole('button', { name: 'Honey' })).toHaveAttribute('aria-pressed', 'true');
    // Pressed: a visible border plus ring (one border colour only; two would fight in the CSS).
    const on = screen.getByRole('button', { name: 'Honey' }).className.split(' ');
    expect(on).toEqual(expect.arrayContaining(['border-current', 'ring-1', 'ring-current']));
    expect(on).not.toContain('border-transparent');
  });

  it('draws static and button chips at one height, with a larger hit area on the button', () => {
    render(
      <>
        <Chip data-testid="static">Sweat 0.9 L/h</Chip>
        <Chip onClick={() => {}} data-testid="button">
          2 warnings
        </Chip>
      </>,
    );
    const still = screen.getByTestId('static').className.split(' ');
    const button = screen.getByTestId('button').className.split(' ');
    for (const classes of [still, button]) expect(classes).toContain('min-h-7');
    expect(button).not.toContain('min-h-9');
    expect(button).toEqual(expect.arrayContaining(['relative', 'before:min-h-9', 'pointer-coarse:before:min-h-11', 'pointer-coarse:before:min-w-11']));
  });

  it('wraps a long text instead of cutting it off, unless asked to truncate', () => {
    const { rerender } = render(<Chip data-testid="chip">Bis 2 % Verlust</Chip>);
    expect(screen.getByText('Bis 2 % Verlust')).not.toHaveClass('truncate');
    rerender(<Chip data-testid="chip" truncate>Bis 2 % Verlust</Chip>);
    expect(screen.getByText('Bis 2 % Verlust')).toHaveClass('truncate');
  });

  it('falls back to the neutral tone', () => {
    render(<Chip tone="weird" data-testid="chip">x</Chip>);
    expect(screen.getByTestId('chip').className).toContain('bg-surface-2');
  });
});
