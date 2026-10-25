import type { UniformNode } from 'three/webgpu';
import { uniform } from 'three/tsl';

/**
 * Total time of the scene intro, in seconds.
 * All objects use this value to schedule their entrance.
 */
export const introDuration = 5;

export interface Intro {
  /**
   * Current position in the intro, from 0 to `introDuration`, in seconds.
   * This value changes every frame. The scene objects read it to schedule their entrance.
   * Use it as a shader uniform.
   */
  time: UniformNode<'float', number>;
  /** Start the intro from the beginning. */
  start(): void;
  /** Advance the intro. Call it one time for each frame. */
  update(delta: number): void;
}

export function createIntro(): Intro {
  const time = uniform(0);
  let running = false;

  return {
    time,

    start() {
      time.value = 0;
      running = true;
    },

    update(delta) {
      if (!running) {
        return;
      }

      time.value = Math.min(time.value + delta, introDuration);

      if (time.value >= introDuration) {
        running = false;
      }
    },
  };
}

/**
 * Return a smooth value from 0 to 1 for a time range.
 * The value is 0 before the start and 1 after the end.
 */
export function introStep(seconds: number, start: number, duration: number): number {
  if (duration <= 0) {
    return seconds >= start ? 1 : 0;
  }

  const value = Math.min(Math.max((seconds - start) / duration, 0), 1);

  return value * value * (3 - 2 * value);
}
