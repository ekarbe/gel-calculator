import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Field from './Field';

const WHY = { summary: { key: 'schedule.finish' }, citations: ['sawka2007'] };

describe('Field', () => {
  it('labels the control and links the hint and the error', () => {
    render(
      <Field label="Bottle size" hint="Up to 1,500 ml" error="Too small">
        {(props) => <input {...props} />}
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Bottle size' });
    expect(input).toHaveAccessibleDescription('Up to 1,500 ml Error: Too small');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    // The error has an icon and a written prefix, not colour alone.
    expect(screen.getByText('Too small').closest('p').querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('clones a single element child, keeping its own description first', () => {
    render(
      <>
        <p id="own">Own note</p>
        <Field label="Name" hint="Shown on the list" id="name-field">
          <input aria-describedby="own" />
        </Field>
      </>,
    );
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input).toHaveAttribute('id', 'name-field');
    expect(input).toHaveAttribute('aria-describedby', 'own name-field-hint');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('can hide the label visually and show something next to it', () => {
    render(
      <Field label="Weight" labelHidden labelAside={<button type="button">Why?</button>}>
        {(props) => <input {...props} />}
      </Field>,
    );
    expect(screen.getByRole('textbox', { name: 'Weight' })).toBeInTheDocument();
    expect(screen.getByText('Weight')).toHaveClass('sr-only');
    expect(screen.getByRole('button', { name: 'Why?' })).toBeVisible();
  });

  it('puts a "Why?" button in the label row and its panel full width under the row', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Field label="Sweat rate" why={WHY} labelAside={<span>L/h</span>} id="rate">
        {(props) => <input {...props} />}
      </Field>,
    );
    const label = screen.getByText('Sweat rate');
    const row = label.parentElement;
    const button = within(row).getByRole('button', { name: 'Why?' });
    expect(within(row).getByText('L/h')).toBeInTheDocument();
    const panel = document.getElementById('rate-why');
    expect(button).toHaveAttribute('aria-controls', 'rate-why');
    // The panel is not inside the row (whose aside keeps its natural width), but a sibling of it.
    expect(row).not.toContainElement(panel);
    expect(panel.parentElement).toBe(container.firstChild);
    expect(panel).not.toBeVisible();
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toBeVisible();
    expect(panel).toHaveTextContent('Finish. Begin your recovery.');
    // The control keeps its name and description; the explanation is not part of them.
    expect(screen.getByRole('textbox', { name: 'Sweat rate' })).not.toHaveAccessibleDescription();
  });

  it('shows the label row for a "Why?" even with a hidden label', () => {
    render(
      <Field label="Weight" labelHidden why={WHY}>
        {(props) => <input {...props} />}
      </Field>,
    );
    expect(screen.getByText('Weight')).toHaveClass('sr-only');
    expect(screen.getByText('Weight').parentElement).not.toHaveClass('sr-only');
    expect(screen.getByRole('button', { name: 'Why?' })).toBeVisible();
  });

  it('gives each field its own id', () => {
    render(
      <>
        <Field label="A">{(p) => <input {...p} />}</Field>
        <Field label="B">{(p) => <input {...p} />}</Field>
      </>,
    );
    const [a, b] = screen.getAllByRole('textbox');
    expect(a.id).not.toBe(b.id);
    expect(a).toHaveAccessibleName('A');
    expect(b).toHaveAccessibleName('B');
  });
});
