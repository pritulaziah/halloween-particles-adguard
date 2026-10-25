import type { UniformNode } from 'three/webgpu';
import { introDuration, introStep } from '../core/intro';
import type { Atmosphere } from './atmosphere';

export interface SceneReveal {
  /** Update the scene reveal. Call it one time for each frame. */
  update(seconds: number): void;
}

/** Fog density at the start of the intro. The fog clears as the scene appears. */
const fogStartDensity = 0.03;
const fadeInDuration = introDuration * 0.16;
const fogDuration = introDuration * 0.64;
const moonStart = introDuration * 0.1;
const moonDuration = introDuration * 0.26;

/**
 * Reveal the whole scene: the image fades in from black, the fog clears and the moon appears.
 */
export function createSceneReveal(
  atmosphere: Atmosphere,
  fade: UniformNode<'float', number>,
): SceneReveal {
  const fogEndDensity = atmosphere.fog.density;
  const moonOpacity = atmosphere.moon.opacity.value;

  return {
    update(seconds) {
      fade.value = introStep(seconds, 0, fadeInDuration);

      const fog = introStep(seconds, 0, fogDuration);
      atmosphere.fog.density = fogStartDensity + (fogEndDensity - fogStartDensity) * fog;

      // Stop the moon animation after the reveal, so the debug controls can change the value.
      const moonReveal = introStep(seconds, moonStart, moonDuration);

      if (moonReveal < 1) {
        atmosphere.moon.opacity.value = moonReveal * moonOpacity;
      }
    },
  };
}
