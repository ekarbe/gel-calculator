import { describe, it, expect } from 'vitest';
import {
  GUIDED_SCREENS,
  GUIDED_STEPS,
  clampPosition,
  clampStep,
  nextPosition,
  previousPosition,
  screenAt,
  screenIndex,
  positionOfScreen,
  segmentFill,
} from './guidedSteps';
import { GUIDED_STEP_COUNT } from '../../state/prefs';

describe('guided steps', () => {
  it('has the four steps of the design doc, as many as the prefs allow', () => {
    expect(GUIDED_STEPS).toHaveLength(GUIDED_STEP_COUNT);
    expect(GUIDED_STEPS.map((s) => s.id)).toEqual(['event', 'bodyWeather', 'ingredients', 'plan']);
    expect(GUIDED_SCREENS).toEqual(['event', 'conditions', 'sweat', 'pantry', 'board']);
    expect(Object.isFrozen(GUIDED_STEPS)).toBe(true);
    expect(Object.isFrozen(GUIDED_STEPS[1].screens)).toBe(true);
  });

  it('clamps steps and positions', () => {
    expect(clampStep(-1)).toBe(0);
    expect(clampStep(9)).toBe(3);
    expect(clampStep(1.6)).toBe(2);
    expect(clampStep(Number.NaN)).toBe(0);
    expect(clampStep('2')).toBe(0);
    expect(clampPosition(1, 5)).toEqual({ step: 1, part: 1 });
    expect(clampPosition(0, 1)).toEqual({ step: 0, part: 0 });
    expect(clampPosition(2, -3)).toEqual({ step: 2, part: 0 });
    expect(clampPosition(3, Number.POSITIVE_INFINITY)).toEqual({ step: 3, part: 0 });
  });

  it('names the screen at a position and its index', () => {
    expect(screenAt(0)).toBe('event');
    expect(screenAt(1)).toBe('conditions');
    expect(screenAt(1, 1)).toBe('sweat');
    expect(screenAt(2)).toBe('pantry');
    expect(screenAt(3)).toBe('board');
    expect(GUIDED_SCREENS.map((_, i) => i)).toEqual([screenIndex(0), screenIndex(1), screenIndex(1, 1), screenIndex(2), screenIndex(3)]);
  });

  it('finds the position of a screen by its id', () => {
    for (const id of GUIDED_SCREENS) {
      const position = positionOfScreen(id);
      expect(screenAt(position.step, position.part), id).toBe(id);
    }
    expect(positionOfScreen('sweat')).toEqual({ step: 1, part: 1 });
    expect(positionOfScreen('nope')).toBeNull();
    expect(positionOfScreen(undefined)).toBeNull();
  });

  it('walks forward and back through every screen, across steps', () => {
    /** @type {Array<{ step: number, part: number }>} */
    const forward = [{ step: 0, part: 0 }];
    for (let p = nextPosition(0, 0); p; p = nextPosition(p.step, p.part)) forward.push(p);
    expect(forward.map((p) => screenAt(p.step, p.part))).toEqual(GUIDED_SCREENS);
    const back = [forward.at(-1)];
    for (let p = previousPosition(3, 0); p; p = previousPosition(p.step, p.part)) back.push(p);
    expect(back.map((p) => screenAt(p.step, p.part))).toEqual([...GUIDED_SCREENS].reverse());
    // Back from the pantry lands on the last screen of step 2.
    expect(previousPosition(2, 0)).toEqual({ step: 1, part: 1 });
    expect(nextPosition(3, 0)).toBeNull();
    expect(previousPosition(0, 0)).toBeNull();
  });

  it('fills the progress segments by step and by the screens of the current step', () => {
    expect([0, 1, 2, 3].map((s) => segmentFill(0, 0, s))).toEqual([1, 0, 0, 0]);
    expect([0, 1, 2, 3].map((s) => segmentFill(1, 0, s))).toEqual([1, 0.5, 0, 0]);
    expect([0, 1, 2, 3].map((s) => segmentFill(1, 1, s))).toEqual([1, 1, 0, 0]);
    expect([0, 1, 2, 3].map((s) => segmentFill(3, 0, s))).toEqual([1, 1, 1, 1]);
  });
});
