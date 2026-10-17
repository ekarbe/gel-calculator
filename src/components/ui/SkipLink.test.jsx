import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SkipLink from './SkipLink';

describe('SkipLink', () => {
  it('is the first tab stop and moves focus to the main content', async () => {
    const user = userEvent.setup();
    render(
      <>
        <SkipLink />
        <button type="button">Header button</button>
        <main id="main">
          <h1>Board</h1>
        </main>
      </>,
    );
    await user.tab();
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link).toHaveFocus();
    expect(link).toHaveAttribute('href', '#main');
    expect(link.className).toContain('sr-only');
    await user.keyboard('{Enter}');
    const main = screen.getByRole('main');
    expect(main).toHaveFocus();
    expect(main).toHaveAttribute('tabindex', '-1');
    expect(window.location.hash).toBe('');
  });

  it('accepts another target and text, and keeps an existing tabindex', async () => {
    const user = userEvent.setup();
    render(
      <>
        <SkipLink targetId="board">Skip to the race board</SkipLink>
        <section id="board" tabIndex={0} aria-label="Race board" />
      </>,
    );
    await user.click(screen.getByRole('link', { name: 'Skip to the race board' }));
    expect(screen.getByRole('region', { name: 'Race board' })).toHaveFocus();
    expect(screen.getByRole('region', { name: 'Race board' })).toHaveAttribute('tabindex', '0');
  });
});
