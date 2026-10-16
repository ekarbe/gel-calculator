import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import Why, { CitationLinks } from './Why';
import { recommendCarbs } from '../../domain/carbs';

const why = {
  summary: { key: 'carbs.why.long', params: { lo: 60, hi: 90, gPerHour: 75 } },
  details: [{ key: 'carbs.why.intensity.moderate' }],
  citations: ['jeukendrup2014', 'podlogar2022'],
};

describe('Why', () => {
  it('renders a collapsed "Why?" button', () => {
    render(<Why why={why} />);
    const button = screen.getByRole('button', { name: /why\?/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    expect(panel).not.toBeVisible();
  });

  it('toggles the explanation, details and citation links', () => {
    render(<Why why={why} />);
    const button = screen.getByRole('button', { name: /why\?/i });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText('Over 2.5 h, the evidence range is 60–90 g/h of carbs from mixed glucose and fructose. Your target is 75 g/h.'),
    ).toBeVisible();
    expect(screen.getByText('Moderate intensity puts your target in the middle of the range.')).toBeVisible();

    const sources = screen.getByRole('list', { name: 'Sources' });
    const links = within(sources).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['Jeukendrup 2014', 'Podlogar et al. 2022']);
    expect(links[0]).toHaveAttribute('href', 'https://doi.org/10.1007/s40279-014-0148-z');
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    }

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Moderate intensity puts your target in the middle of the range.')).not.toBeVisible();
  });

  it('works with a real domain explanation', () => {
    render(<Why why={recommendCarbs({ durationMin: 60, intensity: 'moderate' }).why} defaultOpen />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/mouth rinse/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Carter et al. 2004' })).toBeInTheDocument();
  });

  it('accepts a custom label', () => {
    render(<Why why={why} label="How is this calculated?" />);
    expect(screen.getByRole('button', { name: /how is this calculated/i })).toBeInTheDocument();
  });

  it('renders nothing without an explanation', () => {
    const { container } = render(<Why why={null} />);
    expect(container).toBeEmptyDOMElement();
    const { container: noSummary } = render(<Why why={{ citations: [] }} />);
    expect(noSummary).toBeEmptyDOMElement();
  });

  it('omits the sources list when there are no citations', () => {
    render(<Why why={{ summary: { key: 'schedule.finish' }, citations: [] }} defaultOpen />);
    expect(screen.getByText('Finish. Begin your recovery.')).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Sources' })).toBeNull();
  });
});

describe('CitationLinks', () => {
  it('shows unknown ids as plain text and drops duplicates', () => {
    render(<CitationLinks ids={['sawka2007', 'unknown2099', 'sawka2007']} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Sawka et al. 2007' })).toBeInTheDocument();
    expect(screen.getByText('unknown2099').tagName).toBe('SPAN');
  });

  it('renders nothing for no ids', () => {
    const { container } = render(<CitationLinks ids={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
