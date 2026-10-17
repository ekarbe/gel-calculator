import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Why, { CitationLinks, hasWhy, useWhyParts } from './Why';
import { recommendCarbs } from '../../domain/carbs';
import { UiProvider, PREFS_KEY } from '../../state/UiProvider';

const why = {
  summary: { key: 'carbs.why.long', params: { lo: 60, hi: 90, gPerHour: 75 } },
  details: [{ key: 'carbs.why.intensity.moderate' }],
  citations: ['jeukendrup2014', 'podlogar2022'],
};

describe('Why', () => {
  it('renders a collapsed "Why?" disclosure', () => {
    render(<Why why={why} />);
    const button = screen.getByRole('button', { name: 'Why?' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(button.getAttribute('aria-controls'))).not.toBeVisible();
  });

  it('shows the explanation, details and citation links, and hides them again', async () => {
    const user = userEvent.setup();
    render(<Why why={why} />);
    const button = screen.getByRole('button', { name: 'Why?' });
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText('Over 2.5 h, the evidence range is 60–90 g/h of carbs from mixed glucose and fructose. Your target is 75 g/h.'),
    ).toBeVisible();
    expect(screen.getByText('Moderate intensity puts your target in the middle of the range.')).toBeVisible();
    const sources = screen.getByRole('list', { name: 'Sources' });
    const links = within(sources).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual([
      'Jeukendrup 2014 (opens in a new tab)',
      'Podlogar et al. 2022 (opens in a new tab)',
    ]);
    expect(links[0]).toHaveAttribute('href', 'https://doi.org/10.1007/s40279-014-0148-z');
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    }
    // The button keeps focus: Enter closes and opens it again.
    await user.keyboard('{Enter}');
    expect(screen.getByText('Moderate intensity puts your target in the middle of the range.')).not.toBeVisible();
    await user.keyboard('{Enter}');
    expect(screen.getByText('Moderate intensity puts your target in the middle of the range.')).toBeVisible();
    await user.click(button);
    expect(screen.getByText('Moderate intensity puts your target in the middle of the range.')).not.toBeVisible();
  });

  it('works with a real domain explanation and a custom label', () => {
    render(<Why why={recommendCarbs({ durationMin: 60, intensity: 'moderate' }).why} label="How is this calculated?" defaultOpen />);
    expect(screen.getByRole('button', { name: 'How is this calculated?' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/mouth rinse/)).toBeVisible();
    expect(screen.getByRole('link', { name: /Carter et al\. 2004/ })).toBeInTheDocument();
  });

  it('follows the UI units', () => {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ unitSystem: 'imperial' }));
    render(
      <UiProvider>
        <Why
          defaultOpen
          why={{ summary: { key: 'fluid.why.plan', params: { mlPerHour: 800, sharePct: 80, sweatMlPerHour: 1000, maxMlPerHour: 800 } }, citations: [] }}
        />
      </UiProvider>,
    );
    expect(screen.getByText(/Drink about 27 fl oz\/h/)).toBeVisible();
  });

  it('renders nothing without an explanation and no sources list without citations', () => {
    const { container } = render(<Why why={null} />);
    expect(container).toBeEmptyDOMElement();
    const { container: noSummary } = render(<Why why={{ citations: [] }} />);
    expect(noSummary).toBeEmptyDOMElement();
    render(<Why why={{ summary: { key: 'schedule.finish' }, citations: [] }} defaultOpen />);
    expect(screen.getByText('Finish. Begin your recovery.')).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Sources' })).toBeNull();
  });
});

describe('CitationLinks', () => {
  it('shows unknown ids as plain text and drops duplicates', () => {
    render(<CitationLinks ids={['sawka2007', 'unknown2099', 'sawka2007']} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /Sawka et al\. 2007/ })).toBeInTheDocument();
    expect(screen.getByText('unknown2099').tagName).toBe('SPAN');
  });

  it('renders nothing for no ids', () => {
    const { container } = render(<CitationLinks ids={[]} />);
    expect(container).toBeEmptyDOMElement();
    const { container: none } = render(<CitationLinks />);
    expect(none).toBeEmptyDOMElement();
  });
});

describe('Why: look', () => {
  it('uses neutral colours, never the glucose colour (blue means glucose)', async () => {
    const user = userEvent.setup();
    const { container } = render(<Why why={why} />);
    const button = screen.getByRole('button', { name: 'Why?' });
    expect(button.className).toContain('text-ink-2');
    await user.click(button);
    for (const link of screen.getAllByRole('link')) {
      expect(link.className).toContain('text-ink');
      expect(link.className).toContain('underline');
    }
    const classes = [...container.querySelectorAll('[class]')].map((el) => el.getAttribute('class')).join(' ');
    expect(classes).not.toMatch(/-glucose\b/);
  });

  it('gives citation links a 24 px target, 44 px on touch screens', () => {
    render(<CitationLinks ids={['sawka2007', 'jeukendrup2014']} />);
    for (const link of screen.getAllByRole('link')) {
      expect(link.className).toContain('min-h-6');
      expect(link.className).toContain('pointer-coarse:min-h-11');
    }
  });
});

describe('useWhyParts', () => {
  function Split({ explanation = why }) {
    const { button, panel } = useWhyParts(explanation, { label: 'Why this?', id: 'split-why' });
    return (
      <div>
        <div data-testid="row">{button}</div>
        {panel}
      </div>
    );
  }

  it('splits the button (for a row) from its panel (under the row)', async () => {
    const user = userEvent.setup();
    render(<Split />);
    const button = within(screen.getByTestId('row')).getByRole('button', { name: 'Why this?' });
    expect(button).toHaveAttribute('aria-controls', 'split-why');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById('split-why');
    expect(screen.getByTestId('row')).not.toContainElement(panel);
    expect(panel).not.toBeVisible();
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toBeVisible();
    expect(within(panel).getByRole('list', { name: 'Sources' })).toBeInTheDocument();
  });

  it('gives nothing without an explanation', () => {
    render(<Split explanation={null} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(hasWhy(null)).toBe(false);
    expect(hasWhy({ citations: [] })).toBe(false);
    expect(hasWhy(why)).toBe(true);
  });
});
