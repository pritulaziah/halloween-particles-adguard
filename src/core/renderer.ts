import * as THREE from 'three/webgpu';
import type { Quality } from './quality';
import type { Sizes } from './sizes';

export function createRenderer(
  canvas: HTMLCanvasElement,
  sizes: Sizes,
  quality: Quality,
): THREE.WebGPURenderer {
  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: quality.antialias,
  });
  renderer.toneMapping = THREE.CineonToneMapping;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setSize(sizes.width, sizes.height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.pixelRatio));
  renderer.setClearColor(0x252028);

  return renderer;
}
