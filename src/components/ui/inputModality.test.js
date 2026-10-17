import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { ACTIVATION_WINDOW_MS, inputMode, installInputModality, lastActivatedControl } from './inputModality';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('inputModality', () => {
  it('installs its listeners once, when imported in a browser', () => {
    // Importing the module installed them; a second install adds none.
    const added = vi.spyOn(document, 'addEventListener');
    const addedOnWindow = vi.spyOn(window, 'addEventListener');
    expect(installInputModality()).toBe(true);
    expect(added).not.toHaveBeenCalled();
    expect(addedOnWindow).not.toHaveBeenCalled();
  });

  it('forgets the last input when the window loses focus', () => {
    fireEvent.pointerDown(document.body);
    expect(document.documentElement.dataset.input).toBe('pointer');
    fireEvent.blur(window);
    expect(inputMode()).toBeNull();
    expect(document.documentElement.dataset.input).toBeUndefined();
  });

  it('marks the root element with the last input: pointer or keyboard', () => {
    fireEvent.pointerDown(document.body);
    expect(inputMode()).toBe('pointer');
    expect(document.documentElement.dataset.input).toBe('pointer');
    fireEvent.keyDown(document.body, { key: 'Tab' });
    expect(inputMode()).toBe('keyboard');
    expect(document.documentElement.dataset.input).toBe('keyboard');
  });

  it('does not count a modifier key alone as keyboard use', () => {
    fireEvent.pointerDown(document.body);
    for (const key of ['Shift', 'Control', 'Alt', 'Meta']) fireEvent.keyDown(document.body, { key });
    expect(document.documentElement.dataset.input).toBe('pointer');
  });

  it('remembers the control a click activated, for a short while and while it is in the page', () => {
    let time = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => time);
    document.body.innerHTML = '<button type="button"><svg aria-hidden="true"></svg><span>Share</span></button><p>text</p>';
    const button = document.querySelector('button');
    // A click on the icon inside the button names the button.
    fireEvent.click(button.querySelector('span'));
    expect(lastActivatedControl()).toBe(button);
    // A click on plain text keeps the last control.
    fireEvent.click(document.querySelector('p'));
    expect(lastActivatedControl()).toBe(button);
    time += ACTIVATION_WINDOW_MS + 1;
    expect(lastActivatedControl()).toBeNull();
    time -= ACTIVATION_WINDOW_MS;
    button.remove();
    expect(lastActivatedControl()).toBeNull();
  });
});
