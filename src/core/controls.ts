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
  /** The camera distance without the intro dolly. */
  getRestingDistance(): number;
  update(delta: number): void;
}

const minCameraDistance = 20;
const maxCameraDistance = 34;
const responsiveFactor = 55;
/** Pointer parallax is off below this aspect and full above the second value. */
const parallaxMinAspect = 0.6;
const parallaxFullAspect = 1.8;

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

/** On narrow screens the camera moves back, so the scene stays in the frame. */
function getResponsiveDistance(distance: number, aspect: number): number {
  return aspect < 1 ? distance + (1 - aspect) * responsiveFactor : distance;
}

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

    getRestingDistance() {
      return getResponsiveDistance(settings.distance, camera.aspect);
    },

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

      // On narrow screens the camera moves back, so the scene stays in the frame.
      const dolly = 1 - introStep(intro.time.value, introDuration * 0.04, settings.dollyDuration);
      const goalDistance =
        getResponsiveDistance(settings.distance, camera.aspect) + dolly * settings.dollyDistance;
      distance = THREE.MathUtils.damp(distance, goalDistance, settings.distanceDamping, delta);

      // The pointer parallax is a mouse effect. On narrow screens it moves the word out of the frame.
      const parallaxScale = THREE.MathUtils.smoothstep(
        camera.aspect,
        parallaxMinAspect,
        parallaxFullAspect,
      );

      // A slow drift keeps the scene alive when the pointer does not move.
      const driftX = Math.sin(elapsed * 0.09) * 0.5 * settings.drift;
      const driftY = Math.sin(elapsed * 0.13) * 0.2 * settings.drift;
      const driftZ = Math.cos(elapsed * 0.07) * 0.3 * settings.drift;

      camera.position.set(
        driftX + smoothPointer.x * settings.parallaxX * parallaxScale,
        settings.height + driftY - smoothPointer.y * settings.parallaxY * parallaxScale,
        distance + driftZ,
      );
      camera.lookAt(
        target.x + smoothPointer.x * settings.lookX * parallaxScale,
        settings.lookHeight - smoothPointer.y * settings.lookY * parallaxScale,
        target.z,
      );
    },
  };
}
