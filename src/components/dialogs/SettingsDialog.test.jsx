import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsDialog from './SettingsDialog';
import { latest, renderDialog, resetLatest } from './testUtils';
import { PREFS_KEY, SETTINGS_MODAL } from '../../state/UiProvider';

// next-themes needs matchMedia and its provider; the dialog only reads and sets the theme.
const theme = vi.hoisted(() => ({ current: { theme: 'system', setTheme: () => {} } }));
vi.mock('next-themes', () => ({ useTheme: () => theme.current }));

const OPEN = 'Open settings';

function renderSettings(options = {}) {
  return renderDialog(<SettingsDialog />, { modal: SETTINGS_MODAL, openLabel: OPEN, ...options });
}

const dialog = () => screen.getByRole('dialog', { name: 'Settings' });
const group = (name) => within(dialog()).getByRole('radiogroup', { name });
const checked = (name) => within(group(name)).getByRole('radio', { checked: true });
const storedPrefs = () => JSON.parse(window.localStorage.getItem(PREFS_KEY));

beforeEach(() => {
  theme.current = { theme: 'system', setTheme: vi.fn() };
});

afterEach(() => {
  resetLatest();
  vi.restoreAllMocks();
});

describe('SettingsDialog', () => {
  it('stays closed until opened, then shows theme, language, units and currency', () => {
    renderSettings({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: OPEN }));
    expect(dialog().tagName).toBe('DIALOG');
    expect(dialog()).toHaveAccessibleDescription('Changes apply at once and are remembered in this browser.');
    expect(checked('Theme')).toHaveAccessibleName('System');
    expect(checked('Language')).toHaveAccessibleName('English');
    expect(checked('Units')).toHaveAccessibleName('Metric');
    expect(checked('Currency')).toHaveAccessibleName('€ EUR (Euro)');
  });

  it('starts each currency name with its visible label (WCAG 2.5.3 Label in Name)', () => {
    renderSettings();
    const radios = within(group('Currency')).getAllByRole('radio');
    // The visible text: everything but the screen-reader-only full name.
    const visible = radios.map((radio) =>
      [...radio.childNodes]
        .filter((node) => !(node instanceof HTMLElement && node.classList.contains('sr-only')))
        .map((node) => node.textContent)
        .join('')
        .trim(),
    );
    expect(visible).toEqual(['€ EUR', '$ USD', '£ GBP']);
    expect(radios.map((radio) => radio.hasAttribute('aria-label'))).toEqual([false, false, false]);
    expect(radios[0]).toHaveAccessibleName('€ EUR (Euro)');
    expect(radios[1]).toHaveAccessibleName('$ USD (US dollar)');
    expect(radios[2]).toHaveAccessibleName('£ GBP (Pound sterling)');
    // Speech input matches the visible code.
    expect(within(group('Currency')).getByRole('radio', { name: /USD/ })).toBe(radios[1]);
  });

  it('describes each choice in words', () => {
    renderSettings();
    expect(group('Theme')).toHaveAccessibleDescription('System follows the light or dark setting of your device.');
    expect(group('Units')).toHaveAccessibleDescription(
      'Body mass in kg, height in cm, temperature in °C, speed in km/h, fluid in ml. Carbs, sodium and caffeine stay in g and mg, as in sports nutrition.',
    );
    expect(group('Currency')).toHaveAccessibleDescription('Used for the rough cost estimate.');
  });

  it('shows the stored prefs and the current theme', () => {
    theme.current = { theme: 'dark', setTheme: vi.fn() };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderSettings({ prefs: { locale: 'de', unitSystem: 'imperial', currency: 'GBP' } });
    // The stored language is German, so the dialog speaks German.
    const german = screen.getByRole('dialog', { name: 'Einstellungen' });
    const checkedIn = (name) => within(within(german).getByRole('radiogroup', { name })).getByRole('radio', { checked: true });
    expect(checkedIn('Design')).toHaveAccessibleName('Dunkel');
    expect(checkedIn('Sprache')).toHaveAccessibleName('Deutsch');
    expect(checkedIn('Einheiten')).toHaveAccessibleName('Imperial');
    expect(checkedIn('Währung')).toHaveAccessibleName('£ GBP (Britisches Pfund)');
    expect(within(german).getByRole('radiogroup', { name: 'Einheiten' })).toHaveAccessibleDescription(
      /^Körpergewicht in lb, Körpergröße in ft und in, Temperatur in °F/,
    );
    // Every key has a German twin: nothing falls back to English.
    expect(warn).not.toHaveBeenCalled();
  });

  it('marks each language name with its language', () => {
    renderSettings();
    expect(within(group('Language')).getByText('Deutsch')).toHaveAttribute('lang', 'de');
    expect(within(group('Language')).getByText('English')).toHaveAttribute('lang', 'en');
  });

  it('sets the theme through next-themes', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(within(group('Theme')).getByRole('radio', { name: 'Dark' }));
    expect(theme.current.setTheme).toHaveBeenCalledWith('dark');
  });

  it('changes the units, currency and language at once and remembers them', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(within(group('Units')).getByRole('radio', { name: 'Imperial' }));
    expect(latest.ui.unitSystem).toBe('imperial');
    expect(checked('Units')).toHaveAccessibleName('Imperial');
    expect(group('Units')).toHaveAccessibleDescription(/fluid in US fl oz/);

    await user.click(within(group('Currency')).getByRole('radio', { name: /^\$ USD/ }));
    expect(latest.ui.currency).toBe('USD');

    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await user.click(within(group('Language')).getByRole('radio', { name: 'Deutsch' }));
    expect(latest.ui.locale).toBe('de');
    expect(storedPrefs()).toMatchObject({ locale: 'de', unitSystem: 'imperial', currency: 'USD' });
    // The plan inputs stay metric.
    expect(latest.inputs.athlete.massKg).toBe(70);
  });

  it('works by keyboard: arrows move and select within a group', async () => {
    const user = userEvent.setup();
    renderSettings();
    within(group('Units')).getByRole('radio', { name: 'Metric' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(within(group('Units')).getByRole('radio', { name: 'Imperial' })).toHaveFocus();
    expect(latest.ui.unitSystem).toBe('imperial');
  });

  it('closes with Done, the close button and Escape, and returns focus to the opener', async () => {
    const user = userEvent.setup();
    renderSettings({ open: false });
    const opener = screen.getByRole('button', { name: OPEN });
    await user.click(opener);
    expect(within(dialog()).getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.click(within(dialog()).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();

    await user.click(opener);
    await user.click(within(dialog()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('treats an unknown theme as the system theme', () => {
    theme.current = { theme: undefined, setTheme: vi.fn() };
    renderSettings();
    expect(checked('Theme')).toHaveAccessibleName('System');
  });

  it('names every control and keeps ids unique', () => {
    renderSettings();
    for (const control of dialog().querySelectorAll('button')) expect(control).toHaveAccessibleName();
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    act(() => latest.ui.closeModal());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
