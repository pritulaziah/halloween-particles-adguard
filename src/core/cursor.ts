import * as THREE from 'three/webgpu';
import { toNormalizedDeviceCoordinates } from './ndc';
import type { Sizes } from './sizes';

export interface Cursor {
  raycaster: THREE.Raycaster;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  update(): void;
}

export function createCursor(sizes: Sizes, camera: THREE.Camera): Cursor {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const position = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  const planeNormal = new THREE.Vector3();
  const plane = new THREE.Plane();
  const intersect = new THREE.Vector3();

  window.addEventListener('pointermove', (event) => {
    const coordinates = toNormalizedDeviceCoordinates(
      event.clientX,
      event.clientY,
      sizes.width,
      sizes.height,
    );

    pointer.x = coordinates.x;
    pointer.y = coordinates.y;
  });

  return {
    raycaster,
    position,
    velocity,
    update() {
      raycaster.setFromCamera(pointer, camera);

      planeNormal.copy(camera.position).normalize();
      plane.set(planeNormal, 0);
      raycaster.ray.intersectPlane(plane, intersect);

      velocity.copy(intersect).sub(position);
      position.copy(intersect);
    },
  };
}
