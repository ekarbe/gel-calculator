import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import FuelBeakerIcon from './FuelBeakerIcon';

describe('FuelBeakerIcon Component', () => {
  it('renders correctly', () => {
    const { container } = render(<FuelBeakerIcon className="test-class" strokeWidth={3} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('test-class');
    expect(svg).toHaveAttribute('stroke-width', '3');
  });
});
