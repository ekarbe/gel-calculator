import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Share2 } from 'lucide-react';
import Button from './Button';

describe('Button', () => {
  it('is a type="button" with its text as the name and runs onClick from mouse and keyboard', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Print</Button>);
    const button = screen.getByRole('button', { name: 'Print' });
    expect(button).toHaveAttribute('type', 'button');
    await user.click(button);
    button.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('uses the accent only for the primary variant', () => {
    render(
      <>
        <Button variant="primary">Start mixing</Button>
        <Button>Share</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Start mixing' }).className).toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'Share' }).className).not.toContain('bg-accent');
  });

  it('gives each size one font size (lg is the display title size)', () => {
    render(
      <>
        <Button size="lg">Start mixing</Button>
        <Button size="sm">Print</Button>
      </>,
    );
    const lg = screen.getByRole('button', { name: 'Start mixing' }).className.split(' ');
    expect(lg).toEqual(expect.arrayContaining(['font-display', 'text-title', 'uppercase']));
    expect(lg).not.toContain('text-body');
    const sizes = (name) => screen.getByRole('button', { name }).className.split(' ').filter((c) => /^text-(caption|body|body-sm|title|section)$/.test(c));
    expect(sizes('Start mixing')).toEqual(['text-title']);
    expect(sizes('Print')).toEqual(['text-body-sm']);
  });

  it('keeps the name of an icon-only button and hides the icon', () => {
    const { container } = render(
      <Button iconOnly icon={Share2}>
        Share
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Share')).toHaveClass('sr-only');
  });

  it('forwards the ref, the type and other props', () => {
    const ref = createRef();
    render(
      <Button ref={ref} type="submit" disabled data-testid="go" aria-describedby="x">
        Go
      </Button>,
    );
    expect(ref.current).toBe(screen.getByTestId('go'));
    expect(ref.current).toHaveAttribute('type', 'submit');
    expect(ref.current).toBeDisabled();
    expect(ref.current).toHaveAttribute('aria-describedby', 'x');
  });
});
