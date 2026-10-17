import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Tabs from './Tabs';

const ITEMS = [
  { value: 'test', label: 'Test' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'preset', label: 'Presets' },
];

function Controlled({ initial = 'estimate', items = ITEMS, onChange = () => {}, ...props }) {
  const [value, setValue] = useState(initial);
  return (
    <Tabs
      label="Sweat source"
      items={items}
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
      {...props}
    >
      {(current) => <p>Panel {current}</p>}
    </Tabs>
  );
}

describe('Tabs', () => {
  it('renders a named tablist, selected tab and its labelled panel', () => {
    render(<Controlled />);
    expect(screen.getByRole('tablist', { name: 'Sweat source' })).toBeInTheDocument();
    const tab = screen.getByRole('tab', { name: 'Estimate' });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel', { name: 'Estimate' });
    expect(tab).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveTextContent('Panel estimate');
    expect(panel).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Test' })).not.toHaveAttribute('aria-controls');
  });

  it('leaves room for the focus ring inside the scrolling tablist', () => {
    render(<Controlled />);
    const tablist = screen.getByRole('tablist');
    // A scroll container clips outlines outside its padding box: 4 px padding all round holds the
    // 2 px ring at offset 2, and negative margins keep the tabs in place.
    expect(tablist.className.split(' ')).toEqual(expect.arrayContaining(['overflow-x-auto', 'p-1', '-mx-1', '-mt-1']));
    // The hairline sits on a wrapper that does not scroll.
    expect(tablist.parentElement).toHaveClass('border-b', 'border-line');
    expect(tablist).not.toHaveClass('border-b');
  });

  it('has one tab stop and moves with the arrow keys, Home and End (automatic activation)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    expect(screen.getAllByRole('tab').map((t) => t.tabIndex)).toEqual([-1, 0, -1]);
    await user.tab();
    expect(screen.getByRole('tab', { name: 'Estimate' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Presets' })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel preset');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Test' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowLeft}{Home}');
    expect(screen.getByRole('tab', { name: 'Test' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Presets' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('tabpanel')).toHaveFocus();
    expect(onChange.mock.calls.map(([v]) => v)).toEqual(['preset', 'test', 'preset', 'test', 'preset']);
  });

  it('only moves focus with manual activation until Enter or Space', async () => {
    const user = userEvent.setup();
    render(<Controlled activation="manual" />);
    screen.getByRole('tab', { name: 'Estimate' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Presets' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Estimate' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('tab', { name: 'Presets' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowLeft} ');
    expect(screen.getByRole('tab', { name: 'Estimate' })).toHaveAttribute('aria-selected', 'true');
  });

  it('skips disabled tabs and selects with a click', async () => {
    const user = userEvent.setup();
    render(<Controlled initial="test" items={[ITEMS[0], { ...ITEMS[1], disabled: true }, ITEMS[2]]} />);
    screen.getByRole('tab', { name: 'Test' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Presets' })).toHaveFocus();
    await user.click(screen.getByRole('tab', { name: 'Test' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel test');
  });

  it('accepts plain children and a fixed id', () => {
    render(
      <Tabs label="View" id="view" items={ITEMS} value="test" onChange={() => {}}>
        <p>Content</p>
      </Tabs>,
    );
    expect(screen.getByRole('tab', { name: 'Test' })).toHaveAttribute('id', 'view-tab-0');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'view-panel');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Content');
  });
});
