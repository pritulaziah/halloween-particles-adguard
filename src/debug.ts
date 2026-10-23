import type * as THREE from 'three/webgpu';
import { Inspector } from 'three/addons/inspector/Inspector.js';
import type { Atmosphere } from './atmosphere';

interface NumberUniform {
  value: number;
}

interface DebugOptions {
  filmIntensity: NumberUniform;
  atmosphere: Atmosphere;
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

  const filmGui = inspector.createParameters('Film').close();
  filmGui.add(options.filmIntensity, 'value', 0, 1, 0.01).name('intensity');

  const sky = options.atmosphere.sky;
  const skyGui = inspector.createParameters('Sky').close();
  skyGui.addColor(sky.horizonColor, 'value').name('horizonColor');
  skyGui.addColor(sky.zenithColor, 'value').name('zenithColor');
  skyGui.addColor(sky.nadirColor, 'value').name('nadirColor');
  skyGui.add(sky.horizonStart, 'value', -1, 0.5, 0.01).name('horizonStart');
  skyGui.add(sky.horizonEnd, 'value', -0.5, 0.5, 0.01).name('horizonEnd');
  skyGui.add(sky.zenithEnd, 'value', 0.1, 1.5, 0.01).name('zenithEnd');
  skyGui.addColor(sky.moonGlowColor, 'value').name('moonGlowColor');
  skyGui.add(sky.moonGlowStrength, 'value', 0, 1, 0.01).name('moonGlowStrength');
  skyGui.add(sky.moonGlowExponent, 'value', 1, 512, 1).name('moonGlowExponent');

  const moon = options.atmosphere.moon;
  const moonGui = inspector.createParameters('Moon').close();
  moonGui.add(moon.opacity, 'value', 0, 1, 0.01).name('opacity');
  moonGui.addColor(moon.discColor, 'value').name('discColor');
  moonGui.addColor(moon.edgeColor, 'value').name('edgeColor');
  moonGui.addColor(moon.haloColor, 'value').name('haloColor');
  moonGui.add(moon.haloStrength, 'value', 0, 1, 0.01).name('haloStrength');
  moonGui.add(moon.haloExponent, 'value', 0.5, 8, 0.01).name('haloExponent');
  moonGui.add(moon.haloRadius, 'value', 0.55, 1.5, 0.01).name('haloRadius');
  moonGui.add(moon.discRadius, 'value', 0.05, 0.95, 0.01).name('discRadius');
  moonGui.add(moon.softness, 'value', 0, 0.2, 0.001).name('softness');
  moonGui.add(moon.lightX, 'value', -0.5, 0.5, 0.01).name('lightX');
  moonGui.add(moon.lightY, 'value', -0.5, 0.5, 0.01).name('lightY');
  moonGui.addColor(moon.craterColor, 'value').name('craterColor');
  moonGui.add(moon.craterStrength, 'value', 0, 1.5, 0.01).name('craterStrength');

  const pumpkinsGui = inspector.createParameters('Pumpkins');
  pumpkinsGui.add(options.gravityStrength, 'value', 0, 0.1, 0.001).name('gravityStrength');
  pumpkinsGui.add(options.impactDamping, 'value', 0, 1, 0.001).name('impactDamping');
  pumpkinsGui.add(options.generalDamping, 'value', 0, 1, 0.01).name('generalDamping');
  pumpkinsGui.add(options.heatDamping, 'value', 0, 10, 0.1).name('heatDamping');
  pumpkinsGui.add(options.heatImpactStrength, 'value', 0, 100, 0.1).name('heatImpactStrength');
  pumpkinsGui.add(options.cursorRadius, 'value', 0, 5, 0.001).name('cursorRadius');
  pumpkinsGui.add(options.cursorStrength, 'value', 0, 0.2, 0.001).name('cursorStrength');
}
