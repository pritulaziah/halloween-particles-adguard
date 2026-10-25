import * as THREE from 'three/webgpu';
import type { Intro } from './intro';
import { introDuration, introStep } from './intro';
import type { Sizes } from './sizes';

export interface CameraSettings {
  /** Resting distance from the word to the camera. */
  distance: number;
  /** Extra distance at the start of the intro. The camera moves in. */
  dollyDistance: number;
  /** Time of the intro camera move, in seconds. */
  dollyDuration: number;
  /** How far the camera moves with the pointer, in world units. */
  parallaxX: number;
  parallaxY: number;
  /** How far the look target moves with the pointer, in world units. */
  lookX: number;
  lookY: number;
  /** Camera height. */
  height: number;
  /** Look target height. */
  lookHeight: number;
  /** Drift amplitude multiplier. */
  drift: number;
  pointerDamping: number;
  distanceDamping: number;
}

export interface CameraControls {
  settings: CameraSettings;
  update(delta: number): void;
}

const minCameraDistance = 20;
const maxCameraDistance = 34;
const responsiveFactor = 55;

const defaultSettings: CameraSettings = {
  distance: 25,
  dollyDistance: 8,
  dollyDuration: introDuration * 0.76,
  parallaxX: 3.2,
  parallaxY: 1.4,
  lookX: 1.4,
  lookY: 0.8,
  height: 0.6,
  lookHeight: 0.2,
  drift: 1,
  pointerDamping: 3,
  distanceDamping: 4,
};

/**
 * A limited camera rig. It replaces free orbiting with pointer parallax and wheel zoom.
 */
export function createControls(
  camera: THREE.PerspectiveCamera,
  sizes: Sizes,
  intro: Intro,
): CameraControls {
  const settings: CameraSettings = { ...defaultSettings };
  const pointer = new THREE.Vector2();
  const smoothPointer = new THREE.Vector2();
  const target = new THREE.Vector3(0, settings.lookHeight, 0);
  let distance = settings.distance + settings.dollyDistance;
  let elapsed = 0;

  window.addEventListener('pointermove', (event) => {
    pointer.x = (event.clientX / sizes.width) * 2 - 1;
    pointer.y = (event.clientY / sizes.height) * 2 - 1;
  });

  window.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      settings.distance = THREE.MathUtils.clamp(
        settings.distance + event.deltaY * 0.012,
        minCameraDistance,
        maxCameraDistance,
      );
    },
    { passive: false },
  );

  return {
    settings,

    update(delta) {
      elapsed += delta;
      smoothPointer.x = THREE.MathUtils.damp(
        smoothPointer.x,
        pointer.x,
        settings.pointerDamping,
        delta,
      );
      smoothPointer.y = THREE.MathUtils.damp(
        smoothPointer.y,
        pointer.y,
        settings.pointerDamping,
        delta,
      );

      // On narrow screens the camera moves back, so the word stays in the frame.
      const responsiveBase =
        camera.aspect < 1 ? settings.distance + (1 - camera.aspect) * responsiveFactor : 0;
      const dolly = 1 - introStep(intro.time.value, introDuration * 0.04, settings.dollyDuration);
      const goalDistance =
        Math.max(settings.distance, responsiveBase) + dolly * settings.dollyDistance;
      distance = THREE.MathUtils.damp(distance, goalDistance, settings.distanceDamping, delta);

      // A slow drift keeps the scene alive when the pointer does not move.
      const driftX = Math.sin(elapsed * 0.09) * 0.5 * settings.drift;
      const driftY = Math.sin(elapsed * 0.13) * 0.2 * settings.drift;
      const driftZ = Math.cos(elapsed * 0.07) * 0.3 * settings.drift;

      camera.position.set(
        driftX + smoothPointer.x * settings.parallaxX,
        settings.height + driftY - smoothPointer.y * settings.parallaxY,
        distance + driftZ,
      );
      camera.lookAt(
        target.x + smoothPointer.x * settings.lookX,
        settings.lookHeight - smoothPointer.y * settings.lookY,
        target.z,
      );
    },
  };
}
