import type * as THREE from 'three/webgpu';
import { Inspector } from 'three/addons/inspector/Inspector.js';
import type { CameraSettings } from './controls';
import type { Atmosphere } from '../objects/atmosphere';

interface NumberUniform {
  value: number;
}

interface DebugOptions {
  filmIntensity: NumberUniform;
  atmosphere: Atmosphere;
  camera: CameraSettings;
  replayIntro(): void;
  gravityStrength: NumberUniform;
  generalDamping: NumberUniform;
  heatDamping: NumberUniform;
  heatImpactStrength: NumberUniform;
  gatherSpring: NumberUniform;
  gatherDamping: NumberUniform;
  gatherSwirl: NumberUniform;
}

export function setupDebug(renderer: THREE.WebGPURenderer, options: DebugOptions): void {
  const inspector = new Inspector();
  renderer.inspector = inspector;

  const filmGui = inspector.createParameters('Film').close();
  filmGui.add(options.filmIntensity, 'value', 0, 1, 0.01).name('intensity');

  const introGui = inspector.createParameters('Intro');
  introGui.add({ replay: () => options.replayIntro() }, 'replay');

  const cameraSettings = options.camera;
  const cameraGui = inspector.createParameters('Camera');
  cameraGui.add(cameraSettings, 'dollyDistance', 0, 20, 0.1).name('dollyDistance');
  cameraGui.add(cameraSettings, 'dollyDuration', 0.5, 8, 0.1).name('dollyDuration');
  cameraGui.add(cameraSettings, 'parallaxX', 0, 8, 0.1).name('parallaxX');
  cameraGui.add(cameraSettings, 'parallaxY', 0, 5, 0.1).name('parallaxY');
  cameraGui.add(cameraSettings, 'lookX', 0, 5, 0.1).name('lookX');
  cameraGui.add(cameraSettings, 'lookY', 0, 3, 0.1).name('lookY');
  cameraGui.add(cameraSettings, 'height', -1, 4, 0.1).name('height');
  cameraGui.add(cameraSettings, 'lookHeight', -1, 3, 0.1).name('lookHeight');
  cameraGui.add(cameraSettings, 'drift', 0, 3, 0.05).name('drift');
  cameraGui.add(cameraSettings, 'pointerDamping', 0.5, 10, 0.1).name('pointerDamping');
  cameraGui.add(cameraSettings, 'distanceDamping', 0.5, 10, 0.1).name('distanceDamping');

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
  pumpkinsGui.add(options.generalDamping, 'value', 0, 1, 0.01).name('generalDamping');
  pumpkinsGui.add(options.heatDamping, 'value', 0, 10, 0.1).name('heatDamping');
  pumpkinsGui.add(options.heatImpactStrength, 'value', 0, 100, 0.1).name('heatImpactStrength');
  pumpkinsGui.add(options.gatherSpring, 'value', 0, 6, 0.01).name('gatherSpring');
  pumpkinsGui.add(options.gatherDamping, 'value', 0, 6, 0.01).name('gatherDamping');
  pumpkinsGui.add(options.gatherSwirl, 'value', 0, 8, 0.01).name('gatherSwirl');
}
