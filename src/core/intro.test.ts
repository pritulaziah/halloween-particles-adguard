import { describe, expect, it } from 'vitest';
import { createIntro, introDuration, introStep } from './intro';

describe('introStep', () => {
  it('returns 0 before the start', () => {
    expect(introStep(0, 1, 2)).toBe(0);
  });

  it('returns 1 after the end', () => {
    expect(introStep(5, 1, 2)).toBe(1);
  });

  it('returns 0.5 in the middle', () => {
    expect(introStep(2, 1, 2)).toBe(0.5);
  });

  it('handles a zero duration', () => {
    expect(introStep(0.5, 1, 0)).toBe(0);
    expect(introStep(1, 1, 0)).toBe(1);
  });
});

describe('createIntro', () => {
  it('starts at 0', () => {
    const intro = createIntro();

    expect(intro.time.value).toBe(0);
  });

  it('does not advance before the start', () => {
    const intro = createIntro();
    intro.update(1);

    expect(intro.time.value).toBe(0);
  });

  it('advances the time after the start', () => {
    const intro = createIntro();
    intro.start();
    intro.update(1);

    expect(intro.time.value).toBe(1);
  });

  it('stops at the duration', () => {
    const intro = createIntro();
    intro.start();
    intro.update(introDuration + 5);

    expect(intro.time.value).toBe(introDuration);
  });

  it('starts again', () => {
    const intro = createIntro();
    intro.start();
    intro.update(2);
    intro.start();

    expect(intro.time.value).toBe(0);
  });
});
