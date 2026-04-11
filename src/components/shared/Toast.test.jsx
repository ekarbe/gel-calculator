import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Toast from './Toast';

describe('Toast Component', () => {
  it('renders message', () => {
    render(<Toast message="Test message" visible={true} />);
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('applies visible classes when visible is true', () => {
    const { container } = render(<Toast message="Test message" visible={true} />);
    const div = container.firstChild;
    expect(div).toHaveClass('opacity-100');
    expect(div).not.toHaveClass('opacity-0');
  });

  it('applies hidden classes when visible is false', () => {
    const { container } = render(<Toast message="Test message" visible={false} />);
    const div = container.firstChild;
    expect(div).toHaveClass('opacity-0');
    expect(div).not.toHaveClass('opacity-100');
  });
});
