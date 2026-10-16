import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { UiProvider, useUi, TOAST_DURATION_MS, MIXING_MODAL, TEMPLATE_MODAL, SHARE_MODAL, RECIPES_MODAL } from './UiProvider';

const wrapper = ({ children }) => <UiProvider>{children}</UiProvider>;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('UiProvider', () => {
  it('starts with no modal, the share menu, no toast and metric units', () => {
    const { result } = renderHook(useUi, { wrapper });
    expect(result.current.modal).toBeNull();
    expect(result.current.shareView).toBe('menu');
    expect(result.current.toastMessage).toBe('');
    expect(result.current.massUnit).toBe('kg');
    expect(result.current.tempUnit).toBe('C');
  });

  it('opens and closes one modal at a time', () => {
    const { result } = renderHook(useUi, { wrapper });
    act(() => result.current.openModal('templates'));
    expect(result.current.modal).toBe('templates');
    expect(result.current.isModalOpen('templates')).toBe(true);
    expect(result.current.isModalOpen('share')).toBe(false);
    act(() => result.current.openModal('mixing'));
    expect(result.current.modal).toBe('mixing');
    act(() => result.current.closeModal());
    expect(result.current.modal).toBeNull();
    act(() => result.current.openModal(''));
    expect(result.current.modal).toBeNull();
  });

  it('resets the share view when the share modal opens', () => {
    const { result } = renderHook(useUi, { wrapper });
    act(() => result.current.setShareView('image'));
    expect(result.current.shareView).toBe('image');
    act(() => result.current.openModal('share'));
    expect(result.current.shareView).toBe('menu');
    expect(result.current.modal).toBe('share');
  });

  it('shows a toast and hides it after the timer', () => {
    vi.useFakeTimers();
    const { result } = renderHook(useUi, { wrapper });
    act(() => result.current.showToast('Recipe link copied!'));
    expect(result.current.toastMessage).toBe('Recipe link copied!');
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1));
    expect(result.current.toastMessage).toBe('Recipe link copied!');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toastMessage).toBe('');
  });

  it('restarts the timer for a new toast and supports a custom duration', () => {
    vi.useFakeTimers();
    const { result } = renderHook(useUi, { wrapper });
    act(() => result.current.showToast('First'));
    act(() => vi.advanceTimersByTime(2000));
    act(() => result.current.showToast('Second', 5000));
    act(() => vi.advanceTimersByTime(4000));
    expect(result.current.toastMessage).toBe('Second');
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.toastMessage).toBe('');
  });

  it('hides a toast on demand and clears its timer on unmount', () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(useUi, { wrapper });
    act(() => result.current.showToast('Hi'));
    act(() => result.current.hideToast());
    expect(result.current.toastMessage).toBe('');
    act(() => result.current.showToast('Again'));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('only accepts known display units', () => {
    const { result } = renderHook(useUi, { wrapper });
    act(() => result.current.setMassUnit('lb'));
    act(() => result.current.setTempUnit('F'));
    expect(result.current.massUnit).toBe('lb');
    expect(result.current.tempUnit).toBe('F');
    act(() => result.current.setMassUnit('stone'));
    act(() => result.current.setTempUnit('K'));
    expect(result.current.massUnit).toBe('lb');
    expect(result.current.tempUnit).toBe('F');
  });

  it('exposes the modal names and no scroll helper or recipe ref', () => {
    expect([MIXING_MODAL, TEMPLATE_MODAL, SHARE_MODAL, RECIPES_MODAL]).toEqual(['mixing', 'templates', 'share', 'recipes']);
    const { result } = renderHook(useUi, { wrapper });
    expect(result.current).not.toHaveProperty('scrollToRecipe');
    // The PDF export that captured the recipe card is gone (print view instead).
    expect(result.current).not.toHaveProperty('recipeRef');
    act(() => result.current.openModal(RECIPES_MODAL));
    expect(result.current.isModalOpen(RECIPES_MODAL)).toBe(true);
  });

  it('useUi throws outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useUi())).toThrow(/UiProvider/);
  });
});
