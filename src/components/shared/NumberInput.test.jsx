import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NumberInput from './NumberInput';

function setup(props = {}) {
  const onCommit = vi.fn();
  render(
    <>
      <label htmlFor="n">Value</label>
      <NumberInput id="n" value={5} onCommit={onCommit} min={0} max={100} {...props} />
    </>,
  );
  return { onCommit, input: screen.getByLabelText('Value') };
}

describe('NumberInput', () => {
  it('commits in-range values while typing', () => {
    const { onCommit, input } = setup();
    fireEvent.change(input, { target: { value: '42' } });
    expect(onCommit).toHaveBeenLastCalledWith(42);
    expect(input).toHaveValue(42);
  });

  it('keeps out-of-range text while typing and commits it on blur', () => {
    const { onCommit, input } = setup();
    fireEvent.change(input, { target: { value: '150' } });
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue(150);
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenLastCalledWith(150);
    // After blur the field shows the stored value again.
    expect(input).toHaveValue(5);
  });

  it('commits nothing for an empty field unless an empty value is given', () => {
    const plain = setup();
    fireEvent.change(plain.input, { target: { value: '' } });
    fireEvent.blur(plain.input);
    expect(plain.onCommit).not.toHaveBeenCalled();
  });

  it('commits the empty value and shows 0 as blank with blankZero', () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <>
        <label htmlFor="p">Share</label>
        <NumberInput id="p" value={30} onCommit={onCommit} emptyValue={0} blankZero placeholder="0" />
      </>,
    );
    const input = screen.getByLabelText('Share');
    fireEvent.change(input, { target: { value: '' } });
    expect(onCommit).toHaveBeenLastCalledWith(0);
    rerender(
      <>
        <label htmlFor="p">Share</label>
        <NumberInput id="p" value={0} onCommit={onCommit} emptyValue={0} blankZero placeholder="0" />
      </>,
    );
    fireEvent.blur(input);
    expect(input).toHaveValue(null);
    expect(input).toHaveAttribute('placeholder', '0');
  });

  it('passes other props to the input', () => {
    const { input } = setup({ 'aria-describedby': 'help', step: 0.5, className: 'w-20' });
    expect(input).toHaveAttribute('aria-describedby', 'help');
    expect(input).toHaveAttribute('step', '0.5');
    expect(input).toHaveClass('w-20');
  });
});
