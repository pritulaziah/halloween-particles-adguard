import * as THREE from 'three/webgpu';
import type { Quality } from '../core/quality';

export interface Lights {
  directionalLight: THREE.DirectionalLight;
  ambientLight: THREE.AmbientLight;
}

export function createLights(scene: THREE.Scene, quality: Quality): Lights {
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
  directionalLight.castShadow = quality.shadows;
  directionalLight.position.set(1, 1, 0.75).normalize().multiplyScalar(8);
  directionalLight.shadow.camera.far = 16;
  directionalLight.shadow.camera.top = 8;
  directionalLight.shadow.camera.right = 8;
  directionalLight.shadow.camera.bottom = -8;
  directionalLight.shadow.camera.left = -8;
  directionalLight.shadow.mapSize.set(2048, 2048);
  directionalLight.shadow.radius = 30;
  directionalLight.shadow.normalBias = -0.1;
  scene.add(directionalLight);

  const ambientLight = new THREE.AmbientLight(0xe8b8ff, 0.08);
  scene.add(ambientLight);

  return {
    directionalLight,
    ambientLight,
  };
}
