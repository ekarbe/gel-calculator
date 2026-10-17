import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Switch from './Switch';

function Controlled(props) {
  const [on, setOn] = useState(false);
  return <Switch label="Gut-trained" checked={on} onChange={setOn} {...props} />;
}

describe('Switch', () => {
  it('is a labelled switch that toggles with click, Space and Enter', async () => {
    const user = userEvent.setup();
    render(<Controlled description="Only for events over 150 min" />);
    const toggle = screen.getByRole('switch', { name: 'Gut-trained' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveAccessibleDescription('Only for events over 150 min');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    toggle.focus();
    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('can show the state as text', () => {
    const { rerender } = render(<Switch label="Caffeine" checked={false} onChange={() => {}} showState />);
    expect(screen.getByText('Off')).toBeInTheDocument();
    rerender(<Switch label="Caffeine" checked onChange={() => {}} showState />);
    expect(screen.getByText('On')).toBeInTheDocument();
    // The state text is visual; the role carries it for screen readers.
    expect(screen.getByRole('switch', { name: 'Caffeine' })).toBeChecked();
  });

  it('keeps the state visible in forced colours (system colours, not the dropped fills)', () => {
    const { rerender } = render(<Switch label="Caffeine" checked={false} onChange={() => {}} />);
    const off = { track: screen.getByTestId('switch-track').className, knob: screen.getByTestId('switch-knob').className };
    expect(off.track).toContain('forced-colors:forced-color-adjust-none');
    expect(off.knob).toContain('forced-colors:bg-[color:CanvasText]');
    rerender(<Switch label="Caffeine" checked onChange={() => {}} />);
    expect(screen.getByTestId('switch-track').className).toContain('forced-colors:bg-[color:Highlight]');
    expect(screen.getByTestId('switch-knob').className).toContain('forced-colors:bg-[color:HighlightText]');
  });

  it('does nothing when disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch label="Bicarbonate" checked={false} onChange={onChange} disabled />);
    await user.click(screen.getByRole('switch', { name: 'Bicarbonate' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
