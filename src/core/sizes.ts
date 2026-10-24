import type { PerspectiveCamera, WebGPURenderer } from 'three/webgpu';

export interface Sizes {
  width: number;
  height: number;
}

export function createSizes(): Sizes {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export function watchSizes(
  sizes: Sizes,
  camera: PerspectiveCamera,
  renderer: WebGPURenderer,
): void {
  window.addEventListener('resize', () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;

    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();

    renderer.setSize(sizes.width, sizes.height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });
}
