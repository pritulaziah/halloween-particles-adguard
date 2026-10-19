import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface PumpkinAsset {
  geometry: THREE.BufferGeometry;
  map: THREE.Texture;
  centerY: number;
  height: number;
}

/**
 * Load the pumpkin mesh and its palette texture from a GLB file.
 */
export async function loadPumpkin(url: string): Promise<PumpkinAsset> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const mesh = gltf.scene.getObjectByProperty('isMesh', true) as THREE.Mesh | undefined;

  if (mesh === undefined) {
    throw new Error('Pumpkin model has no mesh');
  }

  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const map = (material as THREE.MeshStandardMaterial).map;

  if (map === null) {
    throw new Error('Pumpkin model has no base color texture');
  }

  mesh.geometry.computeBoundingBox();

  const boundingBox = mesh.geometry.boundingBox;

  if (boundingBox === null) {
    throw new Error('Pumpkin model has no bounding box');
  }

  return {
    geometry: mesh.geometry,
    map,
    centerY: (boundingBox.min.y + boundingBox.max.y) / 2,
    height: boundingBox.max.y - boundingBox.min.y,
  };
}
