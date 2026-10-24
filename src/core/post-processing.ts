import * as THREE from 'three/webgpu';
import type { UniformNode } from 'three/webgpu';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { film } from 'three/addons/tsl/display/FilmNode.js';
import { pass, uniform } from 'three/tsl';

export interface PostProcessing {
  filmIntensity: UniformNode<'float', number>;
  render(): void;
}

export function createPostProcessing(
  renderer: THREE.WebGPURenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): PostProcessing {
  const renderPipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  const scenePassColor = scenePass.getTextureNode('output');
  const bloomPass = bloom(scenePassColor);
  bloomPass.threshold.value = 0;
  bloomPass.strength.value = 0.2;

  const filmIntensity = uniform(0.4);
  const filmPass = film(scenePassColor.add(bloomPass), filmIntensity);
  renderPipeline.outputNode = filmPass;

  return {
    filmIntensity,
    render() {
      renderPipeline.render();
    },
  };
}
