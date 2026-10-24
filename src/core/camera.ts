import * as THREE from 'three/webgpu';
import type { Sizes } from './sizes';

export function createCamera(sizes: Sizes): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(35, sizes.width / sizes.height, 0.1, 100);
  camera.position.z = 25;

  return camera;
}
