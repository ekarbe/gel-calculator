import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Lane from './Lane';

describe('Lane', () => {
  it('shows the label, amount, detail and a bar as long as the share', () => {
    const { container } = render(
      <ul>
        <Lane
          as="li"
          label="Maltodextrin"
          amount="158 g"
          share={0.68}
          tone="glucose"
          detail="158 g glucose"
          shareLabel="68% of the carbs"
          amountProps={{ 'data-testid': 'amount' }}
        />
      </ul>,
    );
    const item = screen.getByRole('listitem');
    expect(item).toHaveTextContent('Maltodextrin');
    expect(screen.getByTestId('amount')).toHaveTextContent('158 g');
    expect(item).toHaveTextContent('158 g glucose');
    const fill = container.querySelector('[aria-hidden="true"] > div');
    expect(fill.style.width).toBe('68%');
    expect(fill.className).toContain('bg-glucose');
    expect(screen.getByText('68% of the carbs')).toHaveClass('sr-only');
  });

  it('clamps the share to 0–100 %', () => {
    const { container, rerender } = render(<Lane label="A" share={1.7} />);
    expect(container.querySelector('[aria-hidden="true"] > div').style.width).toBe('100%');
    rerender(<Lane label="A" share={-0.2} />);
    expect(container.querySelector('[aria-hidden="true"] > div').style.width).toBe('0%');
  });

  it('is a plain row with a colour dot and no bar without a share', () => {
    const { container } = render(<Lane label="Table salt" amount="2.3 g" tone="sodium" share={NaN} shareLabel="x" />);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
    expect(container.querySelector('[aria-hidden="true"]').className).toContain('bg-sodium');
    expect(screen.queryByText('x')).toBeNull();
    expect(container.firstChild.tagName).toBe('DIV');
  });
});
