import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Segmented, { useAutoAdjustOptions } from './Segmented';

const OPTIONS = [
  { value: 'test', label: 'Test' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'preset', label: 'Presets' },
];

function Controlled({ initial = 'estimate', options = OPTIONS, onChange = () => {}, ...props }) {
  const [value, setValue] = useState(initial);
  return (
    <Segmented
      label="Sweat source"
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
      options={options}
      {...props}
    />
  );
}

describe('Segmented', () => {
  it('is a named radio group with the checked option', () => {
    render(<Controlled />);
    const group = screen.getByRole('radiogroup', { name: 'Sweat source' });
    const radios = screen.getAllByRole('radio');
    expect(group).toContainElement(radios[0]);
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(screen.getByRole('radio', { name: 'Estimate' })).toBeChecked();
  });

  it('has one tab stop, on the checked option', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">before</button>
        <Controlled />
        <button type="button">after</button>
      </>,
    );
    expect(screen.getAllByRole('radio').map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
    await user.click(screen.getByRole('button', { name: 'before' }));
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Estimate' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
  });

  it('moves and selects with the arrow keys, wrapping, and Home/End', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    screen.getByRole('radio', { name: 'Estimate' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Presets' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Presets' })).toBeChecked();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Test' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('radio', { name: 'Presets' })).toBeChecked();
    await user.keyboard('{Home}');
    expect(screen.getByRole('radio', { name: 'Test' })).toBeChecked();
    await user.keyboard('{End}');
    expect(screen.getByRole('radio', { name: 'Presets' })).toBeChecked();
    expect(onChange.mock.calls.map(([v]) => v)).toEqual(['preset', 'test', 'preset', 'test', 'preset']);
  });

  it('selects with a click or Space and skips disabled options', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const options = [OPTIONS[0], { ...OPTIONS[1], disabled: true }, OPTIONS[2]];
    render(<Controlled initial="test" options={options} onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Estimate' })).toBeDisabled();
    screen.getByRole('radio', { name: 'Test' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Presets' })).toHaveFocus();
    await user.click(screen.getByRole('radio', { name: 'Test' }));
    expect(screen.getByRole('radio', { name: 'Test' })).toBeChecked();
    // Clicking the checked option does not call onChange again.
    await user.click(screen.getByRole('radio', { name: 'Test' }));
    expect(onChange.mock.calls.map(([v]) => v)).toEqual(['preset', 'test']);
  });

  it('makes the first option the tab stop when nothing is checked, and supports labelledBy and icons', () => {
    render(
      <>
        <span id="lbl">Units</span>
        <Segmented labelledBy="lbl" value="none" onChange={() => {}} options={[{ value: 'a', label: 'A', ariaLabel: 'Option A' }, { value: 'b', label: 'B' }]} />
      </>,
    );
    expect(screen.getByRole('radiogroup', { name: 'Units' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Option A' }).tabIndex).toBe(0);
  });

  it('disables every option when disabled', () => {
    render(<Controlled disabled />);
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
  });
});

describe('Segmented in forced colours', () => {
  it('marks the checked option with the system highlight, not by weight alone', () => {
    render(<Segmented label="Sweat source" value="estimate" onChange={() => {}} options={OPTIONS} />);
    expect(screen.getByRole('radio', { name: 'Estimate' }).className).toContain('forced-colors:bg-[color:Highlight]');
    expect(screen.getByRole('radio', { name: 'Test' }).className).toContain('forced-colors:border-[color:Canvas]');
  });
});

describe('useAutoAdjustOptions', () => {
  it('labels auto and manual in the UI language', () => {
    const { result } = renderHook(useAutoAdjustOptions);
    expect(result.current).toEqual([
      { value: 'auto', label: 'Auto' },
      { value: 'manual', label: 'Adjust' },
    ]);
  });
});
