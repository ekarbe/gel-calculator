import { describe, it, expect, afterEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventSection from './EventSection';
import EventFields, { EventDurationField, EventSportField } from './EventFields';
import { PlanProvider, usePlanInputs, usePlan } from '../../state/PlanProvider';
import { UiProvider, PREFS_KEY } from '../../state/UiProvider';
import { MESSAGES, placeholdersOf } from '../../i18n';
import uiSetupEvent from '../../i18n/en/ui-setup-event';

/** Latest inputs and plan, captured by <Spy /> on every render. */
const latest = { inputs: null, plan: null };

function Spy() {
  const { inputs } = usePlanInputs();
  const plan = usePlan();
  useEffect(() => {
    latest.inputs = inputs;
    latest.plan = plan;
  }, [inputs, plan]);
  return null;
}

/**
 * Renders the section with the real providers. Autosave is off, so no test
 * reads inputs that an earlier test left in localStorage. `prefs` are stored
 * before the render, as a returning visitor's.
 */
function renderEvent(initialInputs, { prefs, children = <EventSection /> } = {}) {
  if (prefs) window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  return render(
    <PlanProvider initialInputs={initialInputs} persist={false}>
      <UiProvider>
        {children}
        <Spy />
      </UiProvider>
    </PlanProvider>,
  );
}

const spin = (name) => screen.getByRole('spinbutton', { name });
const hours = () => spin('Hours');
const minutes = () => spin('Minutes');
const speed = () => spin('Speed');
const power = () => spin('Power');
const sportRadio = (name) => screen.getByRole('radio', { name });
const chooseSport = (name) => fireEvent.click(sportRadio(name));

/** Types into a number field like a user would: change, then leave the field. */
function enter(input, value) {
  fireEvent.change(input, { target: { value: String(value) } });
  fireEvent.blur(input);
}

/** The `aria-describedby` targets of a control, joined. */
const description = (el) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? `#${id} missing`)
    .join(' ');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  latest.inputs = null;
  latest.plan = null;
});

describe('EventSection: layout', () => {
  it('is a region named "Event" with a level-2 heading', () => {
    renderEvent();
    const region = screen.getByRole('region', { name: 'Event' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Event' })).toBeInTheDocument();
  });

  it('collapses to a one-line summary and opens again, keeping the inputs', async () => {
    const user = userEvent.setup();
    renderEvent({ event: { durationMin: 150, sport: 'running', intensity: 'hard', speedKmh: 12 } });
    const toggle = screen.getByRole('button', { name: 'Event' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const body = document.getElementById(toggle.getAttribute('aria-controls'));
    expect(body).toBeVisible();
    expect(screen.queryByText('2 h 30 min · Running · Hard')).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(body).not.toBeVisible();
    expect(screen.getByText('2 h 30 min · Running · Hard')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Hours' })).not.toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(hours()).toHaveValue('2');
    expect(minutes()).toHaveValue('30');
  });

  it('names the sport in full in the collapsed summary ("Other sport", not the short option text)', async () => {
    const user = userEvent.setup();
    renderEvent({ event: { sport: 'other' } });
    await user.click(screen.getByRole('button', { name: 'Event' }));
    expect(screen.getByText('3 h · Other sport · Moderate')).toBeInTheDocument();
  });

  it('exports the field groups for the guided flow (no panel around them)', () => {
    renderEvent(undefined, { children: <EventFields /> });
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Sport' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Duration' })).toBeInTheDocument();
    expect(screen.getByLabelText('Intensity')).toBeInTheDocument();
    expect(speed()).toBeInTheDocument();
    expect(screen.getByLabelText('Setting')).toBeInTheDocument();
    cleanup();

    renderEvent(undefined, {
      children: (
        <>
          <EventSportField />
          <EventDurationField />
        </>
      ),
    });
    expect(screen.getByRole('radiogroup', { name: 'Sport' })).toBeInTheDocument();
    expect(hours()).toHaveValue('3');
    expect(screen.queryByLabelText('Intensity')).not.toBeInTheDocument();
  });

  it('throws outside the providers', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<EventSection />)).toThrow(/must be used inside <PlanProvider>/);
  });
});

describe('EventSection: duration and intensity', () => {
  it('shows the default inputs', () => {
    renderEvent();
    expect(hours()).toHaveValue('3');
    expect(minutes()).toHaveValue('0');
    expect(hours()).toHaveAttribute('aria-valuetext', '3 h');
    expect(minutes()).toHaveAttribute('aria-valuetext', '0 min');
    expect(screen.getByLabelText('Intensity')).toHaveValue('moderate');
    expect(sportRadio('Cycling')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Setting')).toHaveValue('outdoor');
  });

  it('sets the duration from hours and minutes', () => {
    renderEvent();
    enter(hours(), 2);
    expect(latest.inputs.event.durationMin).toBe(120);
    enter(minutes(), 45);
    expect(latest.inputs.event.durationMin).toBe(165);
    expect(hours()).toHaveValue('2');
    expect(minutes()).toHaveValue('45');
  });

  it('clamps the duration at 0 and carries extra minutes into hours', () => {
    renderEvent();
    enter(hours(), -3);
    expect(latest.inputs.event.durationMin).toBe(0);
    expect(hours()).toHaveValue('0');

    enter(minutes(), -10);
    expect(latest.inputs.event.durationMin).toBe(0);

    enter(minutes(), 90);
    expect(latest.inputs.event.durationMin).toBe(90);
    expect(hours()).toHaveValue('1');
    expect(minutes()).toHaveValue('30');

    // A second carry starts from the new hours.
    enter(minutes(), 75);
    expect(latest.inputs.event.durationMin).toBe(135);
    expect(hours()).toHaveValue('2');
    expect(minutes()).toHaveValue('15');

    // Fractions of an hour are dropped; the 48 h limit holds.
    enter(hours(), 2.5);
    expect(latest.inputs.event.durationMin).toBe(135);
    // 60 h clamps to 48 h; 48 h 15 min is over the 2880 min limit, which the inputs clamp to.
    enter(hours(), 60);
    expect(latest.inputs.event.durationMin).toBe(2880);
    expect(hours()).toHaveValue('48');
    expect(minutes()).toHaveValue('0');
    // At 48 h there are no minutes left to add.
    expect(minutes()).toHaveAttribute('aria-valuemax', '0');
    expect(screen.getByRole('button', { name: 'Increase Minutes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase Hours' })).toBeDisabled();
  });

  it('carries typed minutes once when typed key by key, and not after arrow keys', async () => {
    const user = userEvent.setup();
    renderEvent({ event: { durationMin: 60 } });
    await user.clear(minutes());
    await user.type(minutes(), '90');
    // 9 is committed while typing; 90 waits for the field to be left.
    expect(latest.inputs.event.durationMin).toBe(69);
    await user.tab();
    expect(latest.inputs.event.durationMin).toBe(150);
    expect(hours()).toHaveValue('2');
    expect(minutes()).toHaveValue('30');

    // Typed 90, then an arrow key: the arrow steps from 90 and clamps to 59 (no carry).
    await user.clear(minutes());
    await user.type(minutes(), '90{ArrowUp}');
    await user.tab();
    expect(latest.inputs.event.durationMin).toBe(2 * 60 + 59);
  });

  it('steps the minutes with the keyboard and the steppers within 0–59', async () => {
    const user = userEvent.setup();
    renderEvent({ event: { durationMin: 118 } });
    const field = minutes();
    expect(field).toHaveAttribute('aria-valuemin', '0');
    expect(field).toHaveAttribute('aria-valuemax', '59');
    field.focus();
    await user.keyboard('{ArrowUp}');
    expect(latest.inputs.event.durationMin).toBe(119);
    await user.keyboard('{ArrowUp}');
    expect(latest.inputs.event.durationMin).toBe(119);
    await user.click(screen.getByRole('button', { name: 'Decrease Minutes' }));
    expect(latest.inputs.event.durationMin).toBe(118);
    await user.click(screen.getByRole('button', { name: 'Increase Hours' }));
    expect(latest.inputs.event.durationMin).toBe(178);
  });

  it('keeps an empty field while typing and restores the stored value on blur', () => {
    renderEvent();
    const field = hours();
    fireEvent.change(field, { target: { value: '' } });
    expect(field).toHaveValue('');
    expect(latest.inputs.event.durationMin).toBe(180);
    fireEvent.blur(field);
    expect(field).toHaveValue('3');
  });

  it('offers the four intensities with zone hints and updates the target', () => {
    renderEvent();
    const select = screen.getByLabelText('Intensity');
    const options = within(select).getAllByRole('option');
    expect(options.map((o) => o.value)).toEqual(['easy', 'moderate', 'hard', 'race']);
    expect(options.map((o) => o.textContent)).toEqual([
      'Easy (Zone 1–2)',
      'Moderate (Zone 3)',
      'Hard (Zone 4)',
      'Race (Zone 4–5)',
    ]);

    fireEvent.change(select, { target: { value: 'easy' } });
    expect(latest.inputs.event.intensity).toBe('easy');
    // [jeukendrup2014] 180 min easy: 60 × 0.8 = 48 → 50 g/h
    expect(latest.plan.carbs.gPerHour).toBe(50);
  });

  it('no longer has the smart toggle, ultra mode, gender, sex or caffeine habituation', () => {
    renderEvent({ caffeine: { enabled: true } });
    expect(screen.queryByText(/smart physiology/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ultra mode/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/gender/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bsex\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/habituat/i)).not.toBeInTheDocument();
  });
});

describe('EventSection: sport and effort', () => {
  /** Tolerance of the heat-balance golden values, L/h (as in heatBalance.test.js). */
  const TOL = 0.03;

  it('defaults to cycling at 30 km/h with power estimated from the speed', () => {
    renderEvent();
    const group = screen.getByRole('radiogroup', { name: 'Sport' });
    expect(within(group).getAllByRole('radio').map((r) => [r.textContent, r.getAttribute('aria-checked')])).toEqual([
      ['Running', 'false'],
      ['Cycling', 'true'],
      ['Other', 'false'],
    ]);
    // The third option shows the short "Other" (three fit on a phone) but is named in full,
    // and its name starts with the visible text (WCAG 2.5.3).
    expect(within(group).getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual([
      null,
      null,
      'Other sport',
    ]);
    expect(sportRadio('Other sport')).toHaveTextContent(/^Other$/);
    expect(speed()).toHaveValue('30');
    expect(speed()).toHaveAttribute('aria-valuetext', '30 km/h');
    expect(power()).toHaveValue('0');
    // P = 0.5 × 1.2 × 0.36 × v³ + 0.005 × (70 + 10) × 9.81 × v, v = 30/3.6 m/s → 157.7 W
    expect(description(power())).toBe('0 = estimate from speed. Estimated from your speed: about 158 W on flat ground.');
    expect(screen.queryByRole('spinbutton', { name: 'Effort' })).not.toBeInTheDocument();
    expect(screen.queryByText(/min\/km/)).not.toBeInTheDocument();
  });

  it('uses a typed power, and estimates it again when the field is cleared', () => {
    renderEvent();
    enter(power(), 250);
    expect(latest.inputs.event.powerW).toBe(250);
    expect(latest.plan.sweat.estimate).toMatchObject({ powerW: 250, powerFromSpeed: false });
    expect(screen.queryByText(/Estimated from your speed/)).not.toBeInTheDocument();
    expect(description(power())).toBe('0 = estimate from speed.');

    // An empty field means 0: estimate from the speed.
    fireEvent.change(power(), { target: { value: '' } });
    expect(latest.inputs.event.powerW).toBe(0);
    fireEvent.blur(power());
    expect(power()).toHaveValue('0');

    // 36 km/h: 0.216 × 10³ + 3.924 × 10 = 255.2 W
    enter(speed(), 36);
    expect(latest.inputs.event.speedKmh).toBe(36);
    expect(screen.getByTestId('power-estimate')).toHaveTextContent('about 255 W on flat ground');
  });

  it('shows the power that is stored and used (fractions kept to 0.1 W)', () => {
    renderEvent();
    enter(power(), 252.5);
    expect(latest.inputs.event.powerW).toBe(252.5);
    expect(latest.plan.sweat.estimate.powerW).toBe(252.5);
    expect(power()).toHaveValue('252.5');
    expect(power()).toHaveAttribute('aria-valuetext', '252.5 W');

    // More decimals than the field shows are rounded when typed, so field and plan agree.
    enter(power(), '252.56');
    expect(latest.inputs.event.powerW).toBe(252.6);
    expect(power()).toHaveValue('252.6');
    cleanup();

    // A value from a link or autosave is shown as stored.
    renderEvent({ event: { powerW: 237.5 } });
    expect(power()).toHaveValue('237.5');
    expect(latest.plan.sweat.estimate.powerW).toBe(237.5);
  });

  it('clamps power and speed to the input limits', () => {
    renderEvent();
    enter(power(), 5000);
    expect(latest.inputs.event.powerW).toBe(2000);

    // Typing passes through 1 km/h, below the limit; it is not committed while typing.
    fireEvent.change(speed(), { target: { value: '1' } });
    expect(latest.inputs.event.speedKmh).toBe(30);
    fireEvent.blur(speed());
    expect(latest.inputs.event.speedKmh).toBe(3);
    enter(speed(), 100);
    expect(latest.inputs.event.speedKmh).toBe(70);
    expect(speed()).toHaveValue('70');
  });

  it('matches the cycling reference: 200 W at 30 km/h, 25 °C, 50 %, 75 kg, 180 cm → 0.73 L/h', () => {
    // [jay2024] [gagnon2013] research notes scenario table (final_model.py), with the cycling
    // dry-path cap at 3 m/s (0.60 L/h before it)
    renderEvent({ athlete: { massKg: 75, heightCm: 180 }, environment: { tempC: 25 } });
    enter(power(), 200);
    expect(latest.inputs).toMatchObject({
      event: { sport: 'cycling', speedKmh: 30, powerW: 200, setting: 'outdoor' },
      athlete: { massKg: 75, heightCm: 180 },
      environment: { tempC: 25, humidity: 50, sun: 'none' },
    });
    expect(Math.abs(latest.plan.sweat.estimate.rateLph - 0.73)).toBeLessThanOrEqual(TOL);
  });

  it('shows the running pace for the speed and drops the power field', () => {
    renderEvent();
    chooseSport('Running');
    expect(latest.inputs.event.sport).toBe('running');
    expect(screen.queryByRole('spinbutton', { name: 'Power' })).not.toBeInTheDocument();

    // The ride's 30 km/h would be a 2:00 min/km run: switching takes a typical 11 km/h instead.
    expect(latest.inputs.event.speedKmh).toBe(11);
    // 11 km/h → 3600/11 = 327 s per km
    expect(description(speed())).toBe('Pace 5:27 min/km');
    enter(speed(), 12);
    expect(description(speed())).toBe('Pace 5:00 min/km');
    // 10.5 km/h → 342.9 s → 5:43
    enter(speed(), 10.5);
    expect(latest.inputs.event.speedKmh).toBe(10.5);
    expect(screen.getByText('5:43 min/km')).toBeInTheDocument();
    enter(speed(), 3);
    expect(screen.getByText('20:00 min/km')).toBeInTheDocument();
  });

  it('keeps a speed that fits the new sport, and flags an impossible running pace', () => {
    renderEvent({ event: { sport: 'cycling', speedKmh: 18 } });
    // 18 km/h is a plausible run (3:20 min/km): kept.
    chooseSport('Running');
    expect(latest.inputs.event).toMatchObject({ sport: 'running', speedKmh: 18 });
    // Back to cycling: 18 km/h fits a ride too.
    chooseSport('Cycling');
    expect(latest.inputs.event.speedKmh).toBe(18);
    // A slow run (8 km/h) is not a ride: cycling takes 30 km/h.
    chooseSport('Running');
    enter(speed(), 8);
    chooseSport('Cycling');
    expect(latest.inputs.event.speedKmh).toBe(30);
    // Other sports have no speed: it is kept for later.
    chooseSport('Other sport');
    expect(latest.inputs.event.speedKmh).toBe(30);

    // Typed in by hand, a world-record pace gets a visible note with an icon and a "Warning" prefix.
    chooseSport('Running');
    expect(screen.queryByTestId('pace-implausible')).not.toBeInTheDocument();
    enter(speed(), 30);
    const note = screen.getByTestId('pace-implausible');
    expect(note).toHaveTextContent('Warning: That is faster than the marathon world record.');
    expect(note.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(description(speed())).toMatch(/^Pace 2:00 min\/km Warning: That is faster/);
  });

  it('announces the impossible-pace warning politely (a status region that is there before it)', () => {
    renderEvent({ event: { sport: 'running', speedKmh: 12 } });
    // The live region is mounted, empty, with the running hint, so adding the warning is announced.
    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();
    // It is part of the field's description, and the pace is outside it (not re-read while typing).
    const hint = document.getElementById(speed().getAttribute('aria-describedby'));
    expect(hint).toContainElement(status);
    expect(status).not.toHaveTextContent(/min\/km/);

    enter(speed(), 30);
    // The same element, now with the warning.
    expect(screen.getByRole('status')).toBe(status);
    expect(status).toContainElement(screen.getByTestId('pace-implausible'));
    expect(status).toHaveTextContent('Warning: That is faster than the marathon world record.');
    expect(status).not.toHaveTextContent(/min\/km/);

    enter(speed(), 12);
    expect(screen.getByRole('status')).toBe(status);
    expect(status).toBeEmptyDOMElement();
    expect(description(speed())).toBe('Pace 5:00 min/km');
  });

  it('moves between sports with the arrow keys (one tab stop)', async () => {
    const user = userEvent.setup();
    renderEvent();
    const cycling = sportRadio('Cycling');
    expect(cycling).toHaveAttribute('tabindex', '0');
    expect(sportRadio('Running')).toHaveAttribute('tabindex', '-1');
    cycling.focus();
    await user.keyboard('{ArrowRight}');
    expect(sportRadio('Other sport')).toHaveFocus();
    expect(latest.inputs.event.sport).toBe('other');
    expect(screen.getByRole('spinbutton', { name: 'Effort' })).toBeInTheDocument();
    await user.keyboard('{Home}');
    expect(latest.inputs.event).toMatchObject({ sport: 'running', speedKmh: 11 });
  });

  it('matches the running reference: 12 km/h, 20 °C, 50 %, 70 kg, 175 cm → 0.95 L/h in the shade', () => {
    // [jay2024] [gagnon2013] research notes scenario table (final_model.py)
    renderEvent({ event: { sport: 'running', speedKmh: 12 } });
    expect(Math.abs(latest.plan.sweat.estimate.rateLph - 0.95)).toBeLessThanOrEqual(TOL);
  });

  it('asks for METs for other sports and keeps the speed for later', () => {
    renderEvent({ event: { speedKmh: 25 } });
    chooseSport('Other sport');
    expect(screen.queryByRole('spinbutton', { name: 'Speed' })).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Power' })).not.toBeInTheDocument();

    const mets = screen.getByRole('spinbutton', { name: 'Effort' });
    expect(mets).toHaveValue('8');
    expect(mets).toHaveAttribute('aria-valuemin', '1');
    expect(mets).toHaveAttribute('aria-valuemax', '20');
    expect(mets).toHaveAttribute('aria-valuetext', '8 MET');
    expect(description(mets)).toMatch(/^1 MET is sitting at rest\./);

    enter(mets, 10);
    expect(latest.inputs.event.mets).toBe(10);
    // Compendium METs: 1 MET = 1 kcal/kg/h = 1.163 W/kg, so M = 1.163 × METs × kg
    expect(latest.plan.sweat.estimate.metabolicW).toBeCloseTo(1.163 * 10 * 70, 6);
    enter(mets, 50);
    expect(latest.inputs.event.mets).toBe(20);

    chooseSport('Cycling');
    expect(speed()).toHaveValue('25');
    expect(latest.inputs.event.mets).toBe(20);
  });

  it('matches the other-sport reference: 8 METs, 70 kg, 175 cm, 25 °C, 50 % outdoors → 0.75 L/h', () => {
    // [jay2024] [gagnon2013] with 0.3 clo for other sports, as in heatBalance.test.js
    renderEvent({ event: { sport: 'other' }, environment: { tempC: 25 } });
    expect(Math.abs(latest.plan.sweat.estimate.rateLph - 0.75)).toBeLessThanOrEqual(TOL);
  });
});

describe('EventSection: setting', () => {
  it('offers the settings and moves the air indoors', () => {
    renderEvent();
    const setting = screen.getByLabelText('Setting');
    expect(within(setting).getAllByRole('option').map((o) => [o.value, o.textContent])).toEqual([
      ['outdoor', 'Outdoors'],
      ['indoorFan', 'Indoors with a fan'],
      ['indoorNoFan', 'Indoors without a fan'],
    ]);
    fireEvent.change(setting, { target: { value: 'indoorFan' } });
    expect(latest.inputs.event.setting).toBe('indoorFan');
    // Spec section 2: indoors with a fan the air moves at 1.5 m/s
    expect(latest.plan.sweat.estimate.airSpeedMs).toBe(1.5);
  });
});

describe('EventSection: units and language', () => {
  it('shows speed in mph and pace in min/mi in imperial, but stores km/h', () => {
    renderEvent({ event: { sport: 'running', speedKmh: 12 } }, { prefs: { unitSystem: 'imperial' } });
    const field = speed();
    // 12 km/h = 7.456 mph → 7.5; 5:00 min/km × 1.609 = 8:03 min/mi
    expect(field).toHaveValue('7.5');
    expect(field).toHaveAttribute('aria-valuetext', '7.5 mph');
    expect(field).toHaveAttribute('aria-valuemin', '1.9');
    expect(field).toHaveAttribute('aria-valuemax', '43.5');
    expect(description(field)).toBe('Pace 8:03 min/mi');

    enter(field, 8);
    // 8 mph × 1.609344 = 12.875 km/h
    expect(latest.inputs.event.speedKmh).toBeCloseTo(12.875, 3);
    expect(field).toHaveValue('8');
  });

  it('reads and writes numbers in German', async () => {
    const user = userEvent.setup();
    renderEvent({ event: { speedKmh: 30 } }, { prefs: { locale: 'de' } });
    const speedDe = () => spin('Geschwindigkeit');
    await user.clear(speedDe());
    await user.type(speedDe(), '32,5');
    await user.tab();
    expect(latest.inputs.event.speedKmh).toBe(32.5);
    expect(speedDe()).toHaveValue('32,5');
  });
});

describe('EventSection: accessibility', () => {
  /**
   * Every form control has a unique id, a label and an accessible name; every
   * `aria-describedby` target exists; ids are unique in the whole section.
   */
  function expectLabelledControls(container, count) {
    const controls = [...container.querySelectorAll('input, select, textarea')];
    expect(controls).toHaveLength(count);
    const ids = controls.map((el) => el.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    for (const el of controls) {
      expect(el.labels.length, `#${el.id} has a label`).toBeGreaterThan(0);
      expect(el).toHaveAccessibleName();
      expect(description(el), `#${el.id} description targets exist`).not.toMatch(/missing/);
    }
    const allIds = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(allIds).size).toBe(allIds.length);
    // Every button has a name (steppers, sport options, the collapse toggle).
    for (const button of container.querySelectorAll('button')) expect(button).toHaveAccessibleName();
  }

  it('labels every control (cycling: hours, minutes, intensity, speed, power, setting)', () => {
    const { container } = renderEvent({ event: { sport: 'cycling' } });
    expectLabelledControls(container, 6);
  });

  it('labels every control (running: without power)', () => {
    const { container } = renderEvent({ event: { sport: 'running', speedKmh: 30 } });
    expectLabelledControls(container, 5);
  });

  it('labels every control (other sport: METs instead of speed and power)', () => {
    const { container } = renderEvent({ event: { sport: 'other' } });
    expectLabelledControls(container, 5);
  });

  it('groups hours and minutes under "Duration" and names the steppers', () => {
    renderEvent();
    const group = screen.getByRole('group', { name: 'Duration' });
    expect(within(group).getByRole('spinbutton', { name: 'Hours' })).toBeInTheDocument();
    expect(within(group).getByRole('spinbutton', { name: 'Minutes' })).toBeInTheDocument();
    // The steppers are left out of the tab order (the arrow keys step).
    expect(within(group).getByRole('button', { name: 'Increase Minutes' })).toHaveAttribute('tabindex', '-1');
  });
});

describe('ui-setup-event catalog', () => {
  it('is registered, and every key has the namespace', () => {
    for (const [key, text] of Object.entries(uiSetupEvent)) {
      expect(key.startsWith('ui-setup-event.'), key).toBe(true);
      expect(MESSAGES[key], key).toBe(text);
    }
  });

  it('writes no unit after an untyped placeholder', () => {
    // Quantities come typed ({watts:integer}) or already formatted with their unit ({mass} = "70 kg").
    expect(placeholdersOf(uiSetupEvent['ui-setup-event.power.estimated'])).toEqual(['watts:integer']);
    for (const [key, text] of Object.entries(uiSetupEvent)) {
      expect(text, key).not.toMatch(/\{\w+\} ?(ml|L\b|kg|lb|%|°|km\/h|mph|cm|in\b)/);
    }
  });
});
