import { describe, it, expect, afterEach } from 'vitest';
import { focusIntoForm } from './guidedFocus';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('focusIntoForm', () => {
  it('focuses a form heading made focusable before its first field (a date field opens the iOS picker)', () => {
    document.body.innerHTML = `
      <div id="root"><form>
        <h3 tabindex="-1">Add a sweat test</h3>
        <input type="date" aria-label="Date"><input aria-label="Name">
      </form></div>`;
    focusIntoForm(document.querySelector('form'), document.getElementById('root'));
    expect(document.activeElement).toBe(document.querySelector('h3'));
  });

  it('focuses the first enabled field of a form without such a heading', () => {
    document.body.innerHTML = `
      <div id="root"><form>
        <h3>Custom ingredient</h3>
        <input aria-label="Off" disabled><input aria-label="Name">
      </form></div>`;
    focusIntoForm(document.querySelector('form'), document.getElementById('root'));
    expect(document.activeElement).toBe(document.querySelector('[aria-label="Name"]'));
  });

  it('focuses the button that opens a closed panel holding the form', () => {
    document.body.innerHTML = `
      <div id="root">
        <button type="button" aria-controls="panel">Sweat</button>
        <div id="panel" hidden><form><h3 tabindex="-1">Add a sweat test</h3></form></div>
      </div>`;
    focusIntoForm(document.querySelector('form'), document.getElementById('root'));
    expect(document.activeElement).toBe(document.querySelector('button'));
  });
});
