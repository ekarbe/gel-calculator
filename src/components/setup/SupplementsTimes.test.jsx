import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import SupplementsSection from './SupplementsSection';
import { PlanProvider } from '../../state/PlanProvider';
import { UiProvider } from '../../state/UiProvider';

/*  The caffeine dose times and the bicarbonate timing are built from the
    schedule's catalog keys (`ui-schedule.time.*`, spoken with
    `ui-schedule.spoken.*`), never from the domain's
    English `formatElapsed`. These keys are stubbed here with a translated
    shape (as a German catalog would have it): the setup blocks must follow. */
vi.mock('../../i18n/en/ui-schedule', async (importOriginal) => {
  const actual = /** @type {{ default: Record<string, string> }} */ (await importOriginal());
  return {
    default: {
      ...actual.default,
      'ui-schedule.time.m': 'T{sign}{minutes} Min.',
      'ui-schedule.time.h': 'T{sign}{hours} Std.',
      'ui-schedule.time.hm': 'T{sign}{hours} Std. {minutes} Min.',
      'ui-schedule.time.before': '{duration} vor dem Start',
      'ui-schedule.time.after': '{duration} nach dem Start',
      'ui-schedule.spoken.hours.one': '{count} Stunde',
      'ui-schedule.spoken.hours.other': '{count} Stunden',
      'ui-schedule.spoken.minutes.one': '{count} Minute',
      'ui-schedule.spoken.minutes.other': '{count} Minuten',
    },
  };
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderSupplements(initialInputs) {
  return render(
    <PlanProvider initialInputs={initialInputs} persist={false}>
      <UiProvider>
        <SupplementsSection />
      </UiProvider>
    </PlanProvider>,
  );
}

describe('SupplementsSection: times come from the catalogs', () => {
  it('writes the caffeine dose times with the schedule time keys', () => {
    renderSupplements({ caffeine: { enabled: true } });
    const list = screen.getByRole('list', { name: 'Planned caffeine doses' });
    const [pre, intra] = within(list).getAllByRole('listitem');
    // 70 kg, 3 mg/kg, 180 min: 60 min before the start, then at 120 min.
    expect(pre.querySelector('[aria-hidden="true"].font-mono')).toHaveTextContent(/^T−1 Std\.$/);
    expect(pre.querySelector('.sr-only')).toHaveTextContent(/^1 Stunde vor dem Start$/);
    expect(intra.querySelector('[aria-hidden="true"].font-mono')).toHaveTextContent(/^T\+2 Std\.$/);
    expect(intra.querySelector('.sr-only')).toHaveTextContent(/^2 Stunden nach dem Start$/);
  });

  it('writes the bicarbonate timing with the schedule time keys', () => {
    renderSupplements({ event: { durationMin: 60 }, bicarb: { enabled: true } });
    const timing = screen.getByTestId('bicarb-timing');
    expect(timing.querySelector('[aria-hidden="true"]')).toHaveTextContent(
      /^T−1 Std\. 30 Min\. \(window T−3 Std\. to T−1 Std\.\)$/,
    );
    expect(timing.querySelector('.sr-only')).toHaveTextContent(
      /^1 Stunde 30 Minuten vor dem Start, in a window from 3 Stunden vor dem Start to 1 Stunde vor dem Start$/,
    );
  });
});
