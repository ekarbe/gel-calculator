import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import GithubIcon from './GithubIcon';

describe('GithubIcon Component', () => {
  it('renders correctly', () => {
    const { container } = render(<GithubIcon className="test-class" size={24} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('test-class');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });
});
