import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TooltipInfo from './TooltipInfo';

describe('TooltipInfo Component', () => {
  it('renders content', () => {
    render(<TooltipInfo content="Tooltip content" />);
    expect(screen.getByText('Tooltip content')).toBeInTheDocument();
  });
});
