import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Stat from './Stat';
import { recommendCarbs } from '../../domain/carbs';

describe('Stat', () => {
  it('is a group named by its caption with the value, unit and sub-info', () => {
    render(
      <Stat
        label="Carbs"
        value="75"
        unit="g/h"
        sub="1:0.5 · 225 g total"
        tone="glucose"
        valueProps={{ 'data-testid': 'carbs-value' }}
        data-testid="tile"
      />,
    );
    const tile = screen.getByRole('group', { name: 'Carbs' });
    expect(tile).toBe(screen.getByTestId('tile'));
    expect(screen.getByTestId('carbs-value')).toHaveTextContent('75');
    expect(screen.getByTestId('carbs-value').className).toContain('kpi-value');
    expect(tile).toHaveTextContent('g/h');
    expect(tile).toHaveTextContent('1:0.5 · 225 g total');
    // The substance colour bar is decorative.
    const bar = tile.querySelector('[aria-hidden="true"]');
    expect(bar.className).toContain('bg-glucose');
  });

  it('shows a Why disclosure with the explanation', async () => {
    const user = userEvent.setup();
    const { why } = recommendCarbs({ durationMin: 180, intensity: 'moderate' });
    render(<Stat label="Carbs" value="75" unit="g/h" tone="glucose" why={why} />);
    const tile = screen.getByRole('group', { name: 'Carbs' });
    const button = within(tile).getByRole('button', { name: /why\?/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(within(tile).getByText(/Your target is 75 g\/h/)).toBeVisible();
  });

  it('renders without unit, sub-info or explanation', () => {
    render(<Stat label="Caffeine" value="Off" />);
    const tile = screen.getByRole('group', { name: 'Caffeine' });
    expect(tile).toHaveTextContent('CaffeineOff');
    expect(within(tile).queryByRole('button')).toBeNull();
  });
});
