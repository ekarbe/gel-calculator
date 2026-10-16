import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { fireEvent, within } from '@testing-library/react';
import RecipesModal from './RecipesModal';
import Header from '../feature/Header';
import { PlanProvider } from '../../state/PlanProvider';
import { UiProvider } from '../../state/UiProvider';
import { saveRecipe } from '../../state/storage';
import { normalizeInputs } from '../../domain/plan';

/*
 * The Next.js App Router mounts React on `document` itself, so React's event
 * listeners and the modal's own Escape listener sit on the same node. There,
 * `stopPropagation` in an inline form cannot keep the modal's listener from
 * running. React Testing Library mounts into a div instead, which hides the
 * problem, so this file mounts the way the app does.
 */

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root = null;

function mountOnDocument() {
  root = createRoot(document);
  act(() => {
    root.render(
      <html lang="en">
        <body>
          <PlanProvider persist={false}>
            <UiProvider>
              <Header />
              <RecipesModal />
            </UiProvider>
          </PlanProvider>
        </body>
      </html>,
    );
  });
}

const dialog = () => document.querySelector('[role="dialog"]');
const press = (element, key) => act(() => fireEvent.keyDown(element, { key }));
const click = (element) => act(() => fireEvent.click(element));

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  localStorage.clear();
});

describe('RecipesModal mounted on document (as in the app)', () => {
  it('cancels a rename on Escape and keeps the modal open', () => {
    saveRecipe('Long ride', normalizeInputs({}));
    mountOnDocument();
    click(within(document.body).getByRole('button', { name: 'My recipes' }));
    click(within(dialog()).getByRole('button', { name: 'Rename: Long ride' }));
    const field = within(dialog()).getByLabelText('New name for Long ride');
    act(() => fireEvent.change(field, { target: { value: 'Long ride 2' } }));
    press(field, 'Escape');
    expect(dialog()).not.toBeNull();
    expect(within(dialog()).queryByLabelText('New name for Long ride')).toBeNull();
    // A second Escape, outside the inline form, closes the modal.
    press(within(dialog()).getByRole('button', { name: 'Rename: Long ride' }), 'Escape');
    expect(dialog()).toBeNull();
  });

  it('cancels a delete on Escape and keeps the modal open', () => {
    saveRecipe('Long ride', normalizeInputs({}));
    mountOnDocument();
    click(within(document.body).getByRole('button', { name: 'My recipes' }));
    click(within(dialog()).getByRole('button', { name: 'Delete: Long ride' }));
    press(within(dialog()).getByRole('button', { name: 'Keep it' }), 'Escape');
    expect(dialog()).not.toBeNull();
    expect(within(dialog()).queryByRole('button', { name: 'Yes, delete' })).toBeNull();
  });
});
