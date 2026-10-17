import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import WarningList from './WarningList';
import { UiProvider, PREFS_KEY } from '../../state/UiProvider';
import { computePlan, DEFAULT_INPUTS } from '../../domain/plan';

const WARNINGS = [
  { id: 'a', level: 'info', message: { key: 'schedule.finish' } },
  { id: 'b', level: 'danger', message: { key: 'carbs.warn.aboveStudied', params: { gPerHour: 130 } }, citations: ['podlogar2022'] },
  { id: 'c', level: 'warning', message: { key: 'fluid.warn.aboveCeiling', params: { mlPerHour: 1000, maxMlPerHour: 800 } } },
  { id: 'd', level: 'weird', message: { key: 'schedule.start' } },
];

describe('WarningList', () => {
  it('is a named list, danger first, each with an icon and its level written out', () => {
    render(<WarningList warnings={WARNINGS} />);
    const list = screen.getByRole('list', { name: 'Warnings' });
    const items = within(list).getAllByRole('listitem').filter((li) => li.parentElement === list);
    expect(items.map((li) => li.dataset.level)).toEqual(['danger', 'warning', 'info', 'info']);
    expect(items[0]).toHaveTextContent('Danger: 130 g/h is above 120 g/h');
    expect(items[1]).toHaveTextContent('Warning: You plan to drink 1,000 ml/h.');
    expect(items[2]).toHaveTextContent('Note: Finish. Begin your recovery.');
    expect(screen.getByText('Danger:', { exact: false })).toHaveClass('sr-only');
    for (const item of items) expect(item.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(within(items[0]).getByRole('link', { name: /Podlogar et al\. 2022/ })).toBeInTheDocument();
  });

  it('never uses a substance colour for a level icon or a link (blue means glucose)', () => {
    const { container } = render(<WarningList warnings={WARNINGS} />);
    const classes = [...container.querySelectorAll('[class]')].map((el) => el.getAttribute('class')).join(' ');
    expect(classes).not.toMatch(/-(glucose|fructose|sodium|fluid|caffeine)\b/);
    const info = container.querySelector('[data-level="info"] svg');
    expect(info.getAttribute('class')).toContain('text-ink-2');
  });

  it('keeps the given order with sort={false} and hides citations when asked', () => {
    render(<WarningList warnings={WARNINGS} sort={false} showCitations={false} label="Recipe notes" />);
    const list = screen.getByRole('list', { name: 'Recipe notes' });
    expect([...list.children].map((li) => li.dataset.level)).toEqual(['info', 'danger', 'warning', 'info']);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders nothing for no warnings, or the empty text', () => {
    const { container, rerender } = render(<WarningList warnings={[]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<WarningList warnings={null} emptyText="No warnings" />);
    expect(screen.getByText('No warnings')).toBeInTheDocument();
  });

  it('shows real plan warnings in the UI units', () => {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ unitSystem: 'imperial' }));
    const plan = computePlan({ ...DEFAULT_INPUTS, fluid: { mode: 'manual', manualMlPerHour: 1000 } });
    render(
      <UiProvider>
        <WarningList warnings={plan.warnings} />
      </UiProvider>,
    );
    const list = screen.getByRole('list', { name: 'Warnings' });
    expect(list).toHaveTextContent('34 fl oz/h');
    expect(list).not.toHaveTextContent('1,000 ml/h');
  });
});
