import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Card from './Card';

describe('Card Component', () => {
  it('renders children correctly', () => {
    render(
      <Card>
        <div data-testid="child">Test Child</div>
      </Card>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });

  it('applies custom className over default base classes', () => {
    const { container } = render(<Card className="my-custom-class">Content</Card>);
    expect(container.firstChild).toHaveClass('my-custom-class');
    expect(container.firstChild).toHaveClass('bg-white'); // One of the default classes
    expect(container.firstChild).toHaveClass('rounded-2xl');
  });
});
