import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();

/**
 * Load a glTF asset and report the download progress from 0 to 1.
 */
export function loadGLTF(url: string, onProgress?: (progress: number) => void): Promise<GLTF> {
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      resolve,
      (event) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress?.(event.loaded / event.total);
        }
      },
      reject,
    );
  });
}
