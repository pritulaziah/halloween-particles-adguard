import * as THREE from 'three/webgpu';
import { createCamera } from './core/camera';
import { createControls } from './core/controls';
import { createCursor } from './core/cursor';
import { setupMusicToggle } from './core/music';
import { createPostProcessing } from './core/post-processing';
import { createPreloader } from './core/preloader';
import { createRenderer } from './core/renderer';
import { createSizes, watchSizes } from './core/sizes';
import { createLights } from './lights/lights';
import { createAtmosphere } from './objects/atmosphere';
import { createBatFlock } from './objects/bat-flock';
import { createBats } from './objects/bats';
import { createGhosts } from './objects/ghosts';
import { createWordParticles } from './objects/word-particles';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');

if (!canvas) {
  throw new Error('Canvas element not found');
}

/**
 * Loading
 */
const preloader = createPreloader();
const rendererTask = preloader.addTask(0.2);
const pumpkinTask = preloader.addTask(0.3);
const ghostsTask = preloader.addTask(0.5);

/**
 * Scene
 */
const scene = new THREE.Scene();

/**
 * Sizes
 */
const sizes = createSizes();

/**
 * Camera
 */
const camera = createCamera(sizes);
scene.add(camera);

const controls = createControls(camera, canvas);

/**
 * Renderer
 */
const renderer = createRenderer(canvas, sizes);

await renderer.init();
rendererTask.done();

watchSizes(sizes, camera, renderer);

/**
 * Post processing
 */
const postProcessing = createPostProcessing(renderer, scene, camera);

/**
 * Lights
 */
createLights(scene);

/**
 * Atmosphere
 */
const atmosphere = createAtmosphere(scene, camera);

/**
 * Cursor
 */
const cursor = createCursor(sizes, camera);

/**
 * Word particles
 */
const wordParticles = await createWordParticles(scene, renderer, (progress) =>
  pumpkinTask.report(progress),
);
pumpkinTask.done();

const ghosts = await createGhosts(scene, camera, (progress) => ghostsTask.report(progress));
ghostsTask.done();
const bats = createBats(scene, camera);
const batFlock = createBatFlock(scene, renderer);

setupMusicToggle();

/**
 * Animate
 */
const timer = new THREE.Timer();
timer.connect(document);

const tick = (timestamp: number) => {
  controls.update();
  atmosphere.update();

  timer.update(timestamp);
  const delta = timer.getDelta();
  const elapsed = timer.getElapsed();

  ghosts.update(delta, elapsed);
  bats.update(delta);

  scene.updateMatrixWorld();
  cursor.update();
  ghosts.setHover(cursor.raycaster);
  bats.setHover(cursor.raycaster);
  batFlock.update(delta, elapsed, cursor.raycaster.ray);
  wordParticles.update(cursor.position, cursor.velocity);
  postProcessing.render();
};

void renderer.setAnimationLoop(tick);

await preloader.complete();

if (import.meta.env.DEV) {
  const { setupDebug } = await import('./core/debug');

  setupDebug(renderer, {
    filmIntensity: postProcessing.filmIntensity,
    atmosphere,
    gravityStrength: wordParticles.gravityStrength,
    impactDamping: wordParticles.impactDamping,
    generalDamping: wordParticles.generalDamping,
    heatDamping: wordParticles.heatDamping,
    heatImpactStrength: wordParticles.heatImpactStrength,
    cursorRadius: wordParticles.cursorRadius,
    cursorStrength: wordParticles.cursorStrength,
  });
}
