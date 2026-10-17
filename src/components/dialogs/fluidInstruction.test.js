import { describe, it, expect } from 'vitest';
import { fluidInstruction } from './fluidInstruction';
import { computePlan } from '../../domain/plan';
import { createT } from '../../i18n';

const t = createT('en');
const tImperial = createT('en', { unitSystem: 'imperial' });

describe('fluidInstruction', () => {
  it('takes the fluid with each gel from the schedule', () => {
    expect(fluidInstruction(t, computePlan({}))).toBe(
      'Drink about 100 ml/h: about 30 ml with each gel. The schedule lists the amount for every gel.',
    );
  });

  it('says how much to sip from the bottles for a drink', () => {
    expect(fluidInstruction(t, computePlan({ sweat: { source: 'preset' }, format: { type: 'drink' } }))).toBe(
      'Drink about 800 ml/h from your bottles: about 260 ml every 20 min. The schedule lists every sip.',
    );
  });

  it('gives no fixed amount without a fluid target', () => {
    expect(fluidInstruction(t, computePlan({ fluid: { mode: 'manual', manualMlPerHour: 0 } }))).toBe(
      'Take each gel at the time the schedule lists. This plan has no fluid target.',
    );
    expect(fluidInstruction(t, computePlan({ format: { type: 'drink' }, fluid: { mode: 'manual', manualMlPerHour: 0 } }))).toBe(
      'This plan has no fluid target.',
    );
  });

  it('notes drinking to thirst for short or cool events', () => {
    // [kenefick2018] under 90 min or below 15 °C, drinking to thirst is a reasonable alternative.
    expect(fluidInstruction(t, computePlan({ sweat: { source: 'preset' }, environment: { tempC: 10 } }))).toMatch(/ Drinking to thirst also works for this event\.$/);
  });

  it('rounds a manual fluid rate to whole ml (20 fl oz is stored as 591.47 ml)', () => {
    const plan = computePlan({ fluid: { mode: 'manual', manualMlPerHour: 591.47 } });
    expect(plan.fluid.mlPerHour).toBe(591.47);
    expect(fluidInstruction(t, plan)).toMatch(/^Drink about 591 ml\/h: /);
    expect(fluidInstruction(tImperial, plan)).toMatch(/^Drink about 20 fl oz\/h: /);
    expect(fluidInstruction(t, computePlan({ fluid: { mode: 'manual', manualMlPerHour: 512.5 } }))).toMatch(
      /^Drink about 513 ml\/h: /,
    );
  });

  it('follows the unit system', () => {
    expect(fluidInstruction(tImperial, computePlan({ sweat: { source: 'preset' } }))).toBe(
      'Drink about 27 fl oz/h: about 8.8 fl oz with each gel. The schedule lists the amount for every gel.',
    );
  });
});
