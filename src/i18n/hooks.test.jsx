import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useT } from './useT';
import { useFormat, createFormat } from './format';
import { t as moduleT, createT } from './index';
import { UiProvider, useUi } from '../state/UiProvider';

const wrapper = ({ children }) => <UiProvider>{children}</UiProvider>;

describe('useT and useFormat', () => {
  it('are English and metric outside a UiProvider', () => {
    expect(renderHook(useT).result.current).toBe(moduleT);
    expect(renderHook(useFormat).result.current).toBe(createFormat('en', { unitSystem: 'metric', currency: 'EUR' }));
  });

  it('follow the prefs and stay stable until a pref changes', () => {
    const { result, rerender } = renderHook(() => ({ t: useT(), f: useFormat(), ui: useUi() }), { wrapper });
    const first = result.current;
    rerender();
    expect(result.current.t).toBe(first.t);
    expect(result.current.f).toBe(first.f);
    act(() => result.current.ui.setUnitSystem('imperial'));
    act(() => result.current.ui.setCurrency('USD'));
    expect(result.current.t).toBe(createT('en', { unitSystem: 'imperial', currency: 'USD' }));
    expect(result.current.t('recipe.water.drink', { ml: 600 })).toBe('Water, to fill each bottle to 20 fl oz');
    expect(result.current.f.mass(70)).toBe('154.3 lb');
    expect(result.current.f.currency(3)).toBe('$3.00');
    act(() => result.current.ui.setLocale('de'));
    expect(result.current.t.locale).toBe('de');
    expect(result.current.f.number(1234.5, 1)).toBe('1.234,5');
  });
});
