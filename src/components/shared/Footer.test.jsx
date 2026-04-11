import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from './Footer';

describe('Footer Component', () => {
  it('renders correctly', () => {
    render(<Footer />);
    expect(screen.getByText('By Eike Christian Karbe')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Strava' })).toHaveAttribute('href', 'https://www.strava.com/athletes/58442765');
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/ekarbe');
  });
});
