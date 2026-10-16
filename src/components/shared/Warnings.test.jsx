import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Warnings from './Warnings';
import { computePlan } from '../../domain/plan';

const warnings = [
  {
    id: 'fluid.aboveSweat',
    level: 'danger',
    message: { key: 'fluid.warn.aboveSweat', params: { mlPerHour: 1500, sweatMlPerHour: 1250 } },
    citations: ['almond2005', 'hewbutler2015'],
  },
  { id: 'carbs.gutTraining', level: 'warning', message: { key: 'carbs.warn.gutTraining' }, citations: ['jeukendrup2017'] },
  { id: 'caffeine.tryInTraining', level: 'info', message: { key: 'caffeine.warn.tryInTraining' } },
];

describe('Warnings', () => {
  it('renders one item per warning with its text', () => {
    render(<Warnings warnings={warnings} />);
    const list = screen.getByRole('list', { name: 'Warnings' });
    const items = within(list).getAllByRole('listitem').filter((li) => li.parentElement === list);
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('You plan to drink 1,500 ml/h. That is more than you sweat (1,250 ml/h).');
    expect(items[1]).toHaveTextContent('Intakes above 90 g/h need 2–4 weeks of gut training.');
  });

  it('styles each level with the theme colors', () => {
    render(<Warnings warnings={warnings} />);
    const [danger, warning, info] = screen
      .getAllByRole('listitem')
      .filter((li) => li.hasAttribute('data-level'));
    expect(danger).toHaveAttribute('data-level', 'danger');
    expect(danger.className).toContain('bg-apple-red/10');
    expect(warning.className).toContain('bg-apple-amber/10');
    expect(info.className).toContain('bg-apple-blue/10');
  });

  it('does not rely on color alone: icon plus a screen-reader level label', () => {
    render(<Warnings warnings={warnings} />);
    const [danger, warning, info] = screen
      .getAllByRole('listitem')
      .filter((li) => li.hasAttribute('data-level'));
    expect(danger).toHaveTextContent(/^Danger:/);
    expect(warning).toHaveTextContent(/^Warning:/);
    expect(info).toHaveTextContent(/^Note:/);
    for (const item of [danger, warning, info]) {
      expect(item.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    }
    // Each level has its own icon shape.
    const shapes = [danger, warning, info].map((item) => item.querySelector('svg').getAttribute('class'));
    expect(new Set(shapes).size).toBe(3);
  });

  it('links the citations of each warning', () => {
    render(<Warnings warnings={warnings} />);
    const link = screen.getByRole('link', { name: 'Almond et al. 2005' });
    expect(link).toHaveAttribute('href', 'https://doi.org/10.1056/NEJMoa043901');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('can hide citations', () => {
    render(<Warnings warnings={warnings} showCitations={false} />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('treats an unknown level as info', () => {
    render(<Warnings warnings={[{ id: 'x', level: 'shout', message: { key: 'schedule.finish' } }]} />);
    const item = screen.getAllByRole('listitem')[0];
    expect(item).toHaveAttribute('data-level', 'info');
  });

  it('renders nothing for an empty or missing list', () => {
    expect(render(<Warnings warnings={[]} />).container).toBeEmptyDOMElement();
    expect(render(<Warnings />).container).toBeEmptyDOMElement();
  });

  it('renders the warnings of a computed plan', () => {
    const plan = computePlan({ carbs: { mode: 'manual', manualGPerHour: 130 } });
    render(<Warnings warnings={plan.warnings} />);
    expect(screen.getByText(/130 g\/h is above 120 g\/h/)).toBeInTheDocument();
  });
});
