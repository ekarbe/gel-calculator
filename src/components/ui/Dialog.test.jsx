import { describe, it, expect, vi } from 'vitest';
import { useEffect, useRef, useState } from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dialog from './Dialog';
import { UiProvider, useUi } from '../../state/UiProvider';

/** An opener button and a dialog it controls. */
function Harness({ children, onClose = () => {}, ...props }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open mixing
      </button>
      <Dialog
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        title="Mixing steps"
        description="Weigh, dissolve, divide."
        {...props}
      >
        {children ?? (
          <>
            <p>Step 1</p>
            <button type="button">Inside</button>
          </>
        )}
      </Dialog>
    </>
  );
}

const openDialog = async (user) => {
  await user.click(screen.getByRole('button', { name: 'Open mixing' }));
  return screen.getByRole('dialog', { name: 'Mixing steps' });
};

describe('Dialog', () => {
  it('renders nothing visible and no content while closed', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Step 1')).toBeNull();
  });

  it('opens as a modal dialog named by its title and described by its description', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openDialog(user);
    expect(dialog.tagName).toBe('DIALOG');
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAccessibleDescription('Weigh, dissolve, divide.');
    expect(screen.getByRole('heading', { level: 2, name: 'Mixing steps' })).toBeInTheDocument();
    expect(screen.getByText('Step 1')).toBeVisible();
  });

  it('focuses the close button, closes with Escape and returns focus to the opener', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await openDialog(user);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open mixing' })).toHaveFocus();
  });

  it('closes with the close button (mouse and keyboard)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openDialog(user);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await openDialog(user);
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open mixing' })).toHaveFocus();
  });

  it('closes on a backdrop click but not on a click inside', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const dialog = await openDialog(user);
    await user.click(screen.getByText('Step 1'));
    expect(onClose).not.toHaveBeenCalled();
    // A press that starts inside and ends on the dialog box (text selection) does not close it.
    fireEvent.pointerDown(screen.getByText('Step 1'));
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(dialog);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('lets an inline editor keep Escape for itself', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Harness onClose={onClose}>
        <input
          aria-label="Rename"
          onKeyDown={(event) => {
            if (event.key === 'Escape') event.preventDefault();
          }}
        />
      </Harness>,
    );
    await openDialog(user);
    await user.click(screen.getByRole('textbox', { name: 'Rename' }));
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Mixing steps' })).toBeInTheDocument();
  });

  it('focuses initialFocus, or an element marked data-autofocus', async () => {
    const user = userEvent.setup();
    function WithRef() {
      const ref = useRef(null);
      return (
        <Harness initialFocus={ref}>
          <button type="button">First</button>
          <button type="button" ref={ref}>
            Save
          </button>
        </Harness>
      );
    }
    const { unmount } = render(<WithRef />);
    await openDialog(user);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
    unmount();
    render(
      <Harness>
        <input aria-label="Recipe name" data-autofocus />
      </Harness>,
    );
    await openDialog(user);
    expect(screen.getByRole('textbox', { name: 'Recipe name' })).toHaveFocus();
  });

  it("keeps the focus React's autoFocus gave (the content mounts inside the open dialog)", async () => {
    const user = userEvent.setup();
    const seen = [];
    render(
      <Harness>
        <button type="button">First</button>
        <input
          aria-label="Recipe name"
          autoFocus
          ref={(element) => {
            // The input mounts only once the dialog is open (React focuses it while mounting).
            if (element) seen.push(element.closest('dialog')?.hasAttribute('open'));
          }}
        />
      </Harness>,
    );
    await openDialog(user);
    expect(screen.getByRole('textbox', { name: 'Recipe name' })).toHaveFocus();
    expect(seen).toEqual([true]);
  });

  it('prefers initialFocus over autoFocus', async () => {
    const user = userEvent.setup();
    function Both() {
      const ref = useRef(null);
      return (
        <Harness initialFocus={ref}>
          <input aria-label="Name" autoFocus />
          <button type="button" ref={ref}>
            Save
          </button>
        </Harness>
      );
    }
    render(<Both />);
    await openDialog(user);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  });

  it('returns focus to returnFocus when given', async () => {
    const user = userEvent.setup();
    function WithReturn() {
      const target = useRef(null);
      return (
        <>
          <button type="button" ref={target}>
            Menu
          </button>
          <Harness returnFocus={target} />
        </>
      );
    }
    render(<WithReturn />);
    await openDialog(user);
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus();
  });

  it('gives the focus back to the tapped opener when the tap left it unfocused (Safari)', () => {
    // Safari focuses no button on a tap: the focus stays on <body> while the dialog opens.
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open mixing' });
    expect(document.body).toHaveFocus();
    fireEvent.pointerDown(opener);
    fireEvent.click(opener);
    expect(screen.getByRole('dialog', { name: 'Mixing steps' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('gives the focus back to the tapped opener when Safari focused its ancestor instead', () => {
    // WebKit moves the focus of a tap to the nearest focusable ancestor (<main tabindex="-1">).
    render(
      <main tabIndex={-1} data-testid="main">
        <Harness />
      </main>,
    );
    const opener = screen.getByRole('button', { name: 'Open mixing' });
    screen.getByTestId('main').focus();
    fireEvent.pointerDown(opener);
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('does not let the body pass its scroll on to the page', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openDialog(user);
    expect(dialog.querySelector('[data-dialog-body]')).toHaveClass('overscroll-contain', 'flex-auto', 'min-h-0', 'overflow-y-auto');
  });

  it('stops the page from scrolling while open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(document.documentElement.style.overflow).toBe('');
    await openDialog(user);
    expect(document.documentElement.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('closes and restores focus when unmounted while open', async () => {
    const user = userEvent.setup();
    function Toggle() {
      const [shown, setShown] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setShown(false)}>
            Remove
          </button>
          {shown ? <Harness>{<button type="button" onClick={() => setShown(false)}>Remove from inside</button>}</Harness> : null}
        </>
      );
    }
    render(<Toggle />);
    await openDialog(user);
    await user.click(screen.getByRole('button', { name: 'Remove from inside' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.documentElement.style.overflow).toBe('');
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('renders a footer and a custom close label', async () => {
    const user = userEvent.setup();
    render(<Harness footer={<button type="button">Done</button>} closeLabel="Close mixing steps" size="lg" />);
    const dialog = await openDialog(user);
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close mixing steps' })).toBeInTheDocument();
    expect(dialog.className).toContain('max-w-3xl');
  });

  it('uses the scrim token for the backdrop (no default-palette class)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openDialog(user);
    expect(dialog.className).not.toMatch(/backdrop:|bg-black/);
  });

  it('shows the toast inside the dialog, where it is seen and announced', async () => {
    const user = userEvent.setup();
    const ui = { current: null };
    function Capture() {
      const api = useUi();
      useEffect(() => {
        ui.current = api;
      });
      return null;
    }
    render(
      <UiProvider>
        <Capture />
        <Harness />
      </UiProvider>,
    );
    const dialog = await openDialog(user);
    const region = within(dialog).getByRole('status');
    expect(region).toHaveAttribute('data-toast-layer', 'dialog');
    expect(region).toBeEmptyDOMElement();
    act(() => ui.current.showToast('Recipe link copied!', { tone: 'ok' }));
    expect(region).toHaveTextContent('Recipe link copied!');
    expect(region.querySelector('svg').getAttribute('class')).toContain('text-ok');
    act(() => ui.current.hideToast());
    expect(region).toBeEmptyDOMElement();
  });

  it('renders no toast region outside a UiProvider', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openDialog(user);
    expect(within(dialog).queryByRole('status')).toBeNull();
  });

  it('tells the owner when the browser closes it by itself', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const dialog = await openDialog(user);
    dialog.close();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
