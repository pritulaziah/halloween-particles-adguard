import * as THREE from 'three/webgpu';
import { toNormalizedDeviceCoordinates } from './ndc';
import type { Sizes } from './sizes';

export interface Cursor {
  raycaster: THREE.Raycaster;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  update(delta: number): void;
}

/** Time that a tap keeps the hover active, in seconds. */
const tapHoldDuration = 1.2;

export function createCursor(sizes: Sizes, camera: THREE.Camera): Cursor {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const position = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  const planeNormal = new THREE.Vector3();
  const plane = new THREE.Plane();
  const intersect = new THREE.Vector3();
  let tapHold = 0;
  let resetPosition = false;

  const updatePointer = (clientX: number, clientY: number): void => {
    const coordinates = toNormalizedDeviceCoordinates(clientX, clientY, sizes.width, sizes.height);

    pointer.x = coordinates.x;
    pointer.y = coordinates.y;
  };

  window.addEventListener('pointermove', (event) => {
    updatePointer(event.clientX, event.clientY);

    // A finger drag keeps the hover active while the finger moves.
    if (event.pointerType !== 'mouse') {
      tapHold = tapHoldDuration;
    }
  });

  // A touch screen has no hover. A tap holds the hover for a short time.
  window.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.pointerType === 'mouse') {
      return;
    }

    if (!(event.target instanceof HTMLCanvasElement)) {
      return;
    }

    updatePointer(event.clientX, event.clientY);
    tapHold = tapHoldDuration;
  });

  return {
    raycaster,
    position,
    velocity,
    update(delta) {
      if (tapHold > 0) {
        tapHold = Math.max(0, tapHold - delta);

        if (tapHold === 0) {
          // Release the tap hover. The ray moves off the scene.
          pointer.set(10, 10);
          resetPosition = true;
        }
      }

      raycaster.setFromCamera(pointer, camera);

      planeNormal.copy(camera.position).normalize();
      plane.set(planeNormal, 0);
      raycaster.ray.intersectPlane(plane, intersect);

      if (resetPosition) {
        // The ray jumps after a tap release. It must not push the particles.
        position.copy(intersect);
        velocity.set(0, 0, 0);
        resetPosition = false;

        return;
      }

      velocity.copy(intersect).sub(position);
      position.copy(intersect);
    },
  };
}
