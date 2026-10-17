import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timer } from 'lucide-react';
import PanelHeader from './PanelHeader';

describe('PanelHeader', () => {
  it('renders a heading with an id, a description and actions', () => {
    const { container } = render(
      <PanelHeader title="Event" id="event-title" icon={Timer} description="Duration and effort" actions={<button type="button">Auto</button>} />,
    );
    const heading = screen.getByRole('heading', { level: 2, name: 'Event' });
    expect(heading).toHaveAttribute('id', 'event-title');
    expect(heading.className).toContain('display-title');
    expect(screen.getByText('Duration and effort')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Auto' })).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('puts a "Why?" button after the actions and its panel full width under the title row', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PanelHeader
        title="Targets"
        className="mb-3"
        actions={<button type="button">Auto</button>}
        why={{ summary: { key: 'schedule.finish' }, citations: [] }}
        whyLabel="Why these targets?"
      />,
    );
    const root = container.firstChild;
    expect(root).toHaveClass('mb-3');
    const row = root.firstChild;
    const button = within(row).getByRole('button', { name: 'Why these targets?' });
    expect(within(row).getByRole('button', { name: 'Auto' })).toBeInTheDocument();
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    expect(panel.parentElement).toBe(root);
    expect(row).not.toContainElement(panel);
    expect(panel).not.toBeVisible();
    await user.click(button);
    expect(panel).toBeVisible();
    expect(panel).toHaveTextContent('Finish. Begin your recovery.');
    expect(screen.getByRole('heading', { name: 'Targets' })).toBeInTheDocument();
  });

  it('keeps one row in its wrapper (with the class) without a "Why?" or a description', () => {
    const { container } = render(<PanelHeader title="Targets" className="mb-3" why={null} />);
    expect(container.firstChild).toHaveClass('mb-3');
    expect(container.firstChild.children).toHaveLength(1);
    expect(container.firstChild.firstChild).toHaveClass('flex');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps the same toggle (and its focus) when the collapsed summary appears', async () => {
    const user = userEvent.setup();
    function Collapsible() {
      const [open, setOpen] = useState(true);
      return (
        <PanelHeader title="Event" expanded={open} onToggle={() => setOpen(!open)} controls="body" description={open ? undefined : '3 h · Cycling'} />
      );
    }
    render(<Collapsible />);
    const toggle = screen.getByRole('button', { name: 'Event' });
    await user.click(toggle);
    expect(screen.getByText('3 h · Cycling')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Event' })).toBe(toggle);
    expect(toggle).toHaveFocus();
  });

  it('lets the actions wrap under the title and puts the description under the row, full width', () => {
    const { container } = render(
      <PanelHeader
        title="Next up"
        description="The first events of the schedule"
        actions={<button type="button">Full schedule</button>}
        expanded
        onToggle={() => {}}
        controls="body"
      />,
    );
    const row = container.firstChild.firstChild;
    // The row wraps (no shrink-proof actions column), so a wide action never overflows the panel.
    expect(row).toHaveClass('flex-wrap');
    const description = screen.getByText('The first events of the schedule');
    expect(row).not.toContainElement(description);
    expect(description.parentElement).toBe(container.firstChild);
    // The chevron follows the title inside the toggle (no ml-auto pushing it across the row).
    const toggle = screen.getByRole('button', { name: 'Next up' });
    expect(toggle.querySelector('svg:last-of-type')).not.toHaveClass('ml-auto');
    expect(toggle).not.toHaveClass('w-full');
  });

  it('uses the requested heading level, between 2 and 6', () => {
    const { rerender } = render(<PanelHeader title="A" level={3} />);
    expect(screen.getByRole('heading', { level: 3, name: 'A' })).toBeInTheDocument();
    rerender(<PanelHeader title="A" level={9} />);
    expect(screen.getByRole('heading', { level: 6, name: 'A' })).toBeInTheDocument();
    rerender(<PanelHeader title="A" level={1} />);
    expect(screen.getByRole('heading', { level: 2, name: 'A' })).toBeInTheDocument();
  });

  it('is a disclosure header when collapsible', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    function Collapsible() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <PanelHeader
            title="Sweat"
            expanded={open}
            controls="sweat-body"
            onToggle={() => {
              onToggle();
              setOpen((v) => !v);
            }}
          />
          <div id="sweat-body" hidden={!open}>
            Body
          </div>
        </>
      );
    }
    render(<Collapsible />);
    const heading = screen.getByRole('heading', { name: 'Sweat' });
    const button = screen.getByRole('button', { name: 'Sweat' });
    expect(heading).toContainElement(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', 'sweat-body');
    expect(screen.getByText('Body')).not.toBeVisible();
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Body')).toBeVisible();
    button.focus();
    await user.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});
