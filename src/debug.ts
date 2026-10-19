import type * as THREE from 'three/webgpu';
import { Inspector } from 'three/addons/inspector/Inspector.js';
import type BloomNode from 'three/addons/tsl/display/BloomNode.js';

interface NumberUniform {
  value: number;
}

interface DebugOptions {
  bloomPass: BloomNode;
  filmIntensity: NumberUniform;
  directionalLight: THREE.DirectionalLight;
  ambientLight: THREE.AmbientLight;
  radius: NumberUniform;
  pumpkinSize: NumberUniform;
  gravityStrength: NumberUniform;
  impactDamping: NumberUniform;
  generalDamping: NumberUniform;
  heatDamping: NumberUniform;
  heatImpactStrength: NumberUniform;
  cursorRadius: NumberUniform;
  cursorStrength: NumberUniform;
}

export function setupDebug(renderer: THREE.WebGPURenderer, options: DebugOptions): void {
  const inspector = new Inspector();
  renderer.inspector = inspector;

  const bloomGui = inspector.createParameters('Bloom').close();
  bloomGui.add(options.bloomPass.threshold, 'value', 0, 2, 0.01).name('threshold');
  bloomGui.add(options.bloomPass.strength, 'value', 0, 2, 0.01).name('strength');

  const filmGui = inspector.createParameters('Film').close();
  filmGui.add(options.filmIntensity, 'value', 0, 1, 0.01).name('intensity');

  const lightsGui = inspector.createParameters('Lights').close();
  lightsGui.addColor(options.directionalLight, 'color').name('directionalColor');
  lightsGui.add(options.directionalLight, 'intensity', 0, 5, 0.01).name('directionalIntensity');
  lightsGui.addColor(options.ambientLight, 'color').name('ambientColor');
  lightsGui.add(options.ambientLight, 'intensity', 0, 5, 0.01).name('ambientIntensity');

  const pumpkinsGui = inspector.createParameters('Pumpkins');
  pumpkinsGui.add(options.radius, 'value', 0, 0.5, 0.001).name('radius');
  pumpkinsGui.add(options.pumpkinSize, 'value', 0.5, 3, 0.01).name('pumpkinSize');
  pumpkinsGui.add(options.gravityStrength, 'value', 0, 0.1, 0.001).name('gravityStrength');
  pumpkinsGui.add(options.impactDamping, 'value', 0, 1, 0.001).name('impactDamping');
  pumpkinsGui.add(options.generalDamping, 'value', 0, 1, 0.01).name('generalDamping');
  pumpkinsGui.add(options.heatDamping, 'value', 0, 10, 0.1).name('heatDamping');
  pumpkinsGui.add(options.heatImpactStrength, 'value', 0, 100, 0.1).name('heatImpactStrength');
  pumpkinsGui.add(options.cursorRadius, 'value', 0, 5, 0.001).name('cursorRadius');
  pumpkinsGui.add(options.cursorStrength, 'value', 0, 0.2, 0.001).name('cursorStrength');
}
