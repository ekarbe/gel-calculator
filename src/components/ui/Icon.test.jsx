import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Clock } from 'lucide-react';
import Icon from './Icon';

describe('Icon', () => {
  it('is decorative by default', () => {
    const { container } = render(<Icon icon={Clock} className="text-glucose" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg).toHaveAttribute('width', '16');
    expect(svg.getAttribute('class')).toContain('text-glucose');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('is an image with a name when labelled', () => {
    render(<Icon icon={Clock} label="Time" size={24} />);
    const img = screen.getByRole('img', { name: 'Time' });
    expect(img).not.toHaveAttribute('aria-hidden');
    expect(img).toHaveAttribute('width', '24');
  });

  it('renders nothing without an icon', () => {
    const { container } = render(<Icon />);
    expect(container).toBeEmptyDOMElement();
  });
});
