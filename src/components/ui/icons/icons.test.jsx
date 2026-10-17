import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import StravaIcon from './StravaIcon';
import GithubIcon from './GithubIcon';
import FuelBeakerIcon from './FuelBeakerIcon';

describe('brand icons', () => {
  it.each([
    ['StravaIcon', StravaIcon],
    ['GithubIcon', GithubIcon],
  ])('%s takes a size and a class and is decorative', (_, Component) => {
    const { container } = render(<Component className="test-class" size={24} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('test-class');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
    expect(svg).toHaveAttribute('fill', 'currentColor');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  it.each([
    ['StravaIcon', StravaIcon],
    ['GithubIcon', GithubIcon],
  ])('%s defaults to 20 px', (_, Component) => {
    const { container } = render(<Component />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '20');
  });

  it('FuelBeakerIcon takes a class and a stroke width and is decorative', () => {
    const { container } = render(<FuelBeakerIcon className="test-class" strokeWidth={3} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('test-class');
    expect(svg).toHaveAttribute('stroke-width', '3');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg.querySelector('g')).toHaveAttribute('stroke', 'currentColor');
  });

  it('FuelBeakerIcon defaults to size-5', () => {
    const { container } = render(<FuelBeakerIcon />);
    expect(container.querySelector('svg')).toHaveClass('size-5');
    expect(container.querySelector('svg')).toHaveAttribute('stroke-width', '2');
  });
});
