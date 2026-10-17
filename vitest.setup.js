import '@testing-library/jest-dom';
import { afterEach } from 'vitest';

// The plan provider autosaves to localStorage and restores on mount, so a test
// must never see what an earlier test saved. Storage may be stubbed to throw.
afterEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    // A test replaced localStorage with one that throws; nothing to clear.
  }
});

// Tests run as a neutral English visitor (English, metric, EUR: the defaults
// for any language without its own defaults), whatever the host's language.
// jsdom reports "en-US", which would switch the UI prefs to imperial and USD.
// A test that checks the browser-language defaults redefines the getter
// (`vi.spyOn(navigator, 'language', 'get')`).
Object.defineProperty(window.navigator, 'language', { configurable: true, get: () => 'en' });
Object.defineProperty(window.navigator, 'languages', { configurable: true, get: () => ['en'] });

// jsdom has no <dialog> behaviour. This polyfill covers what the Dialog
// primitive and its tests use: show(), showModal() (the open attribute, a
// modal flag), close(returnValue) with its "close" event, and Escape on a
// modal dialog firing a cancelable "cancel" event on the topmost one and
// closing it unless cancelled, as browsers do. A keydown whose default was
// prevented (an inline editor handling Escape itself) does not cancel the
// dialog. It does not make the page inert, trap focus or move focus.
if (typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal !== 'function') {
  /** Open modal dialogs, last opened last. */
  const modalStack = [];
  const removeFromStack = (dialog) => {
    const index = modalStack.indexOf(dialog);
    if (index !== -1) modalStack.splice(index, 1);
  };

  if (!('open' in HTMLDialogElement.prototype)) {
    Object.defineProperty(HTMLDialogElement.prototype, 'open', {
      configurable: true,
      get() {
        return this.hasAttribute('open');
      },
      set(value) {
        if (value) this.setAttribute('open', '');
        else this.removeAttribute('open');
      },
    });
  }
  if (!('returnValue' in HTMLDialogElement.prototype)) {
    Object.defineProperty(HTMLDialogElement.prototype, 'returnValue', {
      configurable: true,
      get() {
        return this.__returnValue ?? '';
      },
      set(value) {
        this.__returnValue = String(value);
      },
    });
  }

  HTMLDialogElement.prototype.show = function show() {
    if (this.hasAttribute('open')) return;
    this.setAttribute('open', '');
  };

  HTMLDialogElement.prototype.showModal = function showModal() {
    if (this.hasAttribute('open')) {
      if (modalStack.includes(this)) return;
      throw new DOMException('The dialog is already open as a non-modal dialog.', 'InvalidStateError');
    }
    if (!this.isConnected) throw new DOMException('The dialog is not in a document.', 'InvalidStateError');
    this.setAttribute('open', '');
    modalStack.push(this);
  };

  HTMLDialogElement.prototype.close = function close(returnValue) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    removeFromStack(this);
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.dispatchEvent(new Event('close'));
  };

  // On window, the last stop of a bubbling keydown, so the cancel runs after
  // every other handler (React listens on its root or on document), like a
  // browser's default action.
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    // Drop dialogs that left the document without being closed.
    for (const dialog of [...modalStack]) {
      if (!dialog.isConnected || !dialog.hasAttribute('open')) removeFromStack(dialog);
    }
    const top = modalStack.at(-1);
    if (!top) return;
    const cancel = new Event('cancel', { cancelable: true });
    if (top.dispatchEvent(cancel)) top.close();
  });
}
