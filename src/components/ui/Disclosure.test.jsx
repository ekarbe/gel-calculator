import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Disclosure from './Disclosure';

describe('Disclosure', () => {
  it('toggles its content with click, Enter and Space, with aria-expanded and aria-controls', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Disclosure summary="Advanced" onOpenChange={onOpenChange}>
        <p>Potassium</p>
      </Disclosure>,
    );
    const button = screen.getByRole('button', { name: 'Advanced' });
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(panel).toContainElement(screen.getByText('Potassium'));
    expect(screen.getByText('Potassium')).not.toBeVisible();
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Potassium')).toBeVisible();
    button.focus();
    await user.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard(' ');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(onOpenChange.mock.calls.map(([v]) => v)).toEqual([true, false, true]);
  });

  it('starts open with defaultOpen and can be controlled', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <Disclosure summary="Open" defaultOpen>
        x
      </Disclosure>,
    );
    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-expanded', 'true');
    unmount();
    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Show all
          </button>
          <Disclosure summary="Details" open={open} onOpenChange={setOpen}>
            Hidden text
          </Disclosure>
        </>
      );
    }
    render(<Controlled />);
    await user.click(screen.getByRole('button', { name: 'Show all' }));
    expect(screen.getByRole('button', { name: 'Details' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Hidden text')).toBeVisible();
  });

  it('can sit in a heading and be a named region', () => {
    render(
      <Disclosure summary="Salts" headingLevel={3} region defaultOpen id="salts">
        Table salt
      </Disclosure>,
    );
    const heading = screen.getByRole('heading', { level: 3, name: 'Salts' });
    expect(heading).toContainElement(screen.getByRole('button', { name: 'Salts' }));
    const region = screen.getByRole('region', { name: 'Salts' });
    expect(region).toHaveAttribute('id', 'salts');
    expect(screen.getByRole('button', { name: 'Salts' })).toHaveAttribute('id', 'salts-button');
  });

  it('is not a region by default', () => {
    render(
      <Disclosure summary="More" defaultOpen>
        text
      </Disclosure>,
    );
    expect(screen.queryByRole('region')).toBeNull();
  });
});

describe('Disclosure: look', () => {
  it('uses ink text unless the caller sets its own', () => {
    render(
      <>
        <Disclosure summary="Plain">x</Disclosure>
        <Disclosure summary="Styled" buttonClassName="text-body-sm text-glucose">
          y
        </Disclosure>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Plain' }).className).toContain('text-ink');
    expect(screen.getByRole('button', { name: 'Styled' }).className).not.toContain('text-ink');
  });
});
