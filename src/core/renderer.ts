import * as THREE from 'three/webgpu';
import type { Sizes } from './sizes';

export function createRenderer(canvas: HTMLCanvasElement, sizes: Sizes): THREE.WebGPURenderer {
  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: true,
  });
  renderer.toneMapping = THREE.CineonToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setSize(sizes.width, sizes.height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x252028);

  return renderer;
}
