import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Select from './Select';

const OPTIONS = [
  { value: 500, label: '500 ml' },
  { value: 750, label: '750 ml' },
  { value: 950, label: '950 ml', disabled: true },
];

describe('Select', () => {
  it('is a labelled native select that keeps the option value type', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select label="Bottle" value={750} onChange={onChange} options={OPTIONS} hint="Your bottle" data-testid="bottle" />);
    const select = screen.getByRole('combobox', { name: 'Bottle' });
    expect(select).toBe(screen.getByTestId('bottle'));
    expect(select).toHaveValue('750');
    expect(select).toHaveAccessibleDescription('Your bottle');
    await user.selectOptions(select, '500');
    expect(onChange).toHaveBeenCalledWith(500);
    expect(screen.getByRole('option', { name: '950 ml' })).toBeDisabled();
  });

  it('renders option groups and a placeholder when nothing matches', () => {
    render(
      <Select
        label="Ingredient"
        value={99}
        onChange={() => {}}
        placeholder="Pick one"
        options={[
          { label: 'Powders', options: [{ value: 3, label: 'Maltodextrin' }] },
          { label: 'Syrups', options: [{ value: 14, label: 'Honey' }] },
        ]}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Ingredient' })).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Pick one' })).toBeDisabled();
    expect(screen.getByRole('group', { name: 'Powders' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Honey' })).toBeInTheDocument();
  });

  it('shows an error', () => {
    render(<Select label="Salt" value="a" onChange={() => {}} options={[{ value: 'a', label: 'A' }]} error="Pick a salt" />);
    const select = screen.getByRole('combobox', { name: 'Salt' });
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription('Error: Pick a salt');
  });

  it('passes a "Why?" to its field', async () => {
    const user = userEvent.setup();
    render(
      <Select label="Salt" value="a" onChange={() => {}} options={[{ value: 'a', label: 'A' }]} why={{ summary: { key: 'schedule.finish' }, citations: [] }} />,
    );
    await user.click(screen.getByRole('button', { name: 'Why?' }));
    expect(screen.getByText('Finish. Begin your recovery.')).toBeVisible();
  });
});
