import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NumberField from './NumberField';
import { UiProvider, PREFS_KEY } from '../../state/UiProvider';
import { kgToLb, lbToKg, roundTo } from '../../domain/units';

/** A NumberField over local state, reporting every committed value. */
function Controlled({ initial = 70, onCommit = () => {}, ...props }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <NumberField
        label="Body mass"
        value={value}
        onChange={(next) => {
          onCommit(next);
          setValue(next);
        }}
        min={30}
        max={200}
        step={1}
        unit="kg"
        {...props}
      />
      <output data-testid="stored">{String(value)}</output>
      <button type="button">elsewhere</button>
    </>
  );
}

const field = () => screen.getByRole('spinbutton', { name: 'Body mass' });

describe('NumberField', () => {
  it('is a labelled spin button with its value, limits and unit', () => {
    render(<Controlled hint="Without clothes" />);
    const input = field();
    expect(input).toHaveValue('70');
    expect(input).toHaveAttribute('aria-valuenow', '70');
    expect(input).toHaveAttribute('aria-valuemin', '30');
    expect(input).toHaveAttribute('aria-valuemax', '200');
    expect(input).toHaveAttribute('aria-valuetext', '70 kg');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input).toHaveAccessibleDescription('Without clothes');
    expect(screen.getByText('kg')).toHaveAttribute('aria-hidden', 'true');
    // Inputs use the body face with tabular figures, not the data (mono) face.
    expect(input).toHaveClass('font-sans', 'num');
    expect(input).not.toHaveClass('font-mono');
  });

  it('asks for the full keyboard when the field takes negative numbers (the decimal keypad has no minus)', () => {
    render(<Controlled initial={20} min={-20} max={50} unit="°C" label="Temperature" />);
    expect(screen.getByRole('spinbutton', { name: 'Temperature' })).toHaveAttribute('inputmode', 'text');
  });

  it('commits in-range numbers while typing and keeps the typed text', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Controlled onCommit={onCommit} />);
    await user.clear(field());
    await user.type(field(), '154');
    // 1 and 15 are below the minimum and are not committed; 154 is.
    expect(onCommit.mock.calls.map(([v]) => v)).toEqual([154]);
    expect(field()).toHaveValue('154');
    expect(screen.getByTestId('stored')).toHaveTextContent('154');
  });

  it('commits a clamped value on blur and shows the stored value again', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.clear(field());
    await user.type(field(), '250');
    expect(screen.getByTestId('stored')).toHaveTextContent('70');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.getByTestId('stored')).toHaveTextContent('200');
    expect(field()).toHaveValue('200');
  });

  it('ignores text that is not a number and restores the value on blur', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.clear(field());
    await user.type(field(), 'abc');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.getByTestId('stored')).toHaveTextContent('70');
    expect(field()).toHaveValue('70');
  });

  it('commits emptyValue when cleared, and can show 0 as empty', async () => {
    const user = userEvent.setup();
    render(<Controlled initial={5} min={0} emptyValue={0} blankZero />);
    await user.clear(field());
    expect(screen.getByTestId('stored')).toHaveTextContent('0');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(field()).toHaveValue('');
  });

  it('steps with the arrow and page keys, snapped and clamped', async () => {
    const user = userEvent.setup();
    render(<Controlled initial={70.4} step={1} />);
    field().focus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByTestId('stored')).toHaveTextContent('71');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByTestId('stored')).toHaveTextContent('69');
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}');
    expect(screen.getByTestId('stored')).toHaveTextContent('79');
    await user.keyboard('{PageDown}');
    expect(screen.getByTestId('stored')).toHaveTextContent('69');
    for (let i = 0; i < 20; i += 1) fireEvent.keyDown(field(), { key: 'PageUp' });
    expect(screen.getByTestId('stored')).toHaveTextContent('200');
    expect(field()).toHaveValue('200');
  });

  it('has − and + buttons named after the field, out of the tab order, disabled at the limits', async () => {
    const user = userEvent.setup();
    render(<Controlled initial={199} />);
    const minus = screen.getByRole('button', { name: 'Decrease Body mass' });
    const plus = screen.getByRole('button', { name: 'Increase Body mass' });
    expect(minus).toHaveAttribute('tabindex', '-1');
    expect(plus).toHaveAttribute('aria-controls', field().id);
    await user.click(plus);
    expect(screen.getByTestId('stored')).toHaveTextContent('200');
    expect(plus).toBeDisabled();
    await user.click(minus);
    expect(screen.getByTestId('stored')).toHaveTextContent('199');
    expect(plus).toBeEnabled();
  });

  it('shows and accepts converted values (pounds) and stores the metric value', async () => {
    const user = userEvent.setup();
    render(
      <Controlled
        unit="lb"
        min={66}
        max={441}
        step={1}
        digits={1}
        toInput={(kg) => roundTo(kgToLb(kg), 1)}
        fromInput={(lb) => lbToKg(lb)}
      />,
    );
    expect(field()).toHaveValue('154.3');
    await user.clear(field());
    await user.type(field(), '176.4');
    expect(Number(screen.getByTestId('stored').textContent)).toBeCloseTo(80.01, 2);
  });

  it('reads and writes numbers in the UI language', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ locale: 'de' }));
    render(
      <UiProvider>
        <Controlled initial={1.5} min={0} max={10} step={0.1} unit="L" />
      </UiProvider>,
    );
    expect(field()).toHaveValue('1,5');
    await user.clear(field());
    await user.type(field(), '2,25');
    expect(screen.getByTestId('stored')).toHaveTextContent('2.25');
    // The stepper names come from the German catalog.
    expect(screen.getByRole('button', { name: 'Body mass erhöhen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Body mass verringern' })).toBeInTheDocument();
  });

  it('reads a lone separator as the decimal one when the grouped number is out of range', async () => {
    // An English page on an iPhone set to a comma region: its decimal keypad types "1,250" for 1.25.
    const user = userEvent.setup();
    render(<Controlled label="Body mass" initial={0.5} min={0} max={20} step={0.1} unit="L" />);
    await user.clear(field());
    await user.type(field(), '1,250');
    expect(screen.getByTestId('stored')).toHaveTextContent('1.25');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.getByTestId('stored')).toHaveTextContent('1.25');
    expect(field()).toHaveValue('1.25');
  });

  it('steps from the decimal reading of a lone separator, and commits it while typing', async () => {
    const user = userEvent.setup();
    render(<Controlled label="Body mass" initial={0.5} min={0} max={20} step={0.1} unit="L" />);
    await user.clear(field());
    await user.type(field(), '1,250');
    await user.keyboard('{ArrowUp}');
    // 1.25 + 0.1, on the 0.1 grid (read as 1250 it would clamp to 20).
    expect(screen.getByTestId('stored')).toHaveTextContent('1.4');
    await user.clear(field());
    await user.type(field(), '1,250');
    await user.click(screen.getByRole('button', { name: 'Increase Body mass' }));
    expect(screen.getByTestId('stored')).toHaveTextContent('1.4');
    // A whole value at once (pasted or filled in) commits while the field keeps the focus.
    field().focus();
    fireEvent.change(field(), { target: { value: '1,250' } });
    expect(field()).toHaveFocus();
    expect(screen.getByTestId('stored')).toHaveTextContent('1.25');
  });

  it('keeps reading "1,250" as 1250 where the range holds it', async () => {
    const user = userEvent.setup();
    render(<Controlled initial={500} min={0} max={5000} step={10} unit="mg" />);
    await user.clear(field());
    await user.type(field(), '1,250');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.getByTestId('stored')).toHaveTextContent('1250');
  });

  it('marks an error and can hide the steppers or be disabled', () => {
    const { rerender } = render(<Controlled error="Out of range" steppers={false} />);
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(field()).toHaveAccessibleDescription('Error: Out of range');
    expect(screen.queryByRole('button', { name: /crease/ })).toBeNull();
    rerender(<Controlled disabled />);
    expect(field()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase Body mass' })).toBeDisabled();
  });

  it('shows the error on the control border instead of the normal border', () => {
    const { container, rerender } = render(<Controlled />);
    const box = () => container.querySelector('input').parentElement;
    expect(box().className).toContain('border-line-strong');
    expect(box().className).not.toContain('border-danger');
    rerender(<Controlled error="Out of range" />);
    // One border colour only: two would fight and the CSS order (not the class list) would win.
    expect(box().className).toContain('border-danger');
    expect(box().className).not.toContain('border-line-strong');
  });

  it('passes a "Why?" to its field', async () => {
    const user = userEvent.setup();
    render(<Controlled why={{ summary: { key: 'schedule.finish' }, citations: [] }} />);
    await user.click(screen.getByRole('button', { name: 'Why?' }));
    expect(screen.getByText('Finish. Begin your recovery.')).toBeVisible();
  });

  it('uses labelText to name the steppers when the label is not text', () => {
    render(<NumberField label={<span>Fluid</span>} labelText="Fluid" value={500} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Increase Fluid' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Fluid' })).toHaveValue('500');
  });
});
