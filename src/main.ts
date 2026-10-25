import * as THREE from 'three/webgpu';
import { createCamera } from './core/camera';
import { createControls } from './core/controls';
import { createCursor } from './core/cursor';
import { createIntro } from './core/intro';
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
import { createSceneReveal } from './objects/scene-reveal';
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
const intro = createIntro();

/**
 * Sizes
 */
const sizes = createSizes();

/**
 * Camera
 */
const camera = createCamera(sizes);
scene.add(camera);

const controls = createControls(camera, sizes, intro);

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
const sceneReveal = createSceneReveal(atmosphere, postProcessing.fade);

/**
 * Cursor
 */
const cursor = createCursor(sizes, camera);

/**
 * Word particles
 */
const wordParticles = await createWordParticles(scene, renderer, intro, (progress) =>
  pumpkinTask.report(progress),
);
pumpkinTask.done();

const ghosts = await createGhosts(scene, camera, intro, (progress) => ghostsTask.report(progress));
ghostsTask.done();
const bats = createBats(scene, camera, intro);
const batFlock = createBatFlock(scene, renderer, intro);

setupMusicToggle();

/**
 * Animate
 */
const timer = new THREE.Timer();
timer.connect(document);

const tick = (timestamp: number) => {
  timer.update(timestamp);
  const delta = timer.getDelta();
  const elapsed = timer.getElapsed();

  intro.update(delta);
  sceneReveal.update(intro.time.value);

  controls.update(delta);
  camera.updateMatrixWorld();
  atmosphere.update();
  cursor.update();

  ghosts.update(delta, elapsed, cursor.position);
  bats.update(delta);

  scene.updateMatrixWorld();
  ghosts.setHover(cursor.raycaster);
  bats.setHover(cursor.raycaster);

  batFlock.update(delta, elapsed, cursor.raycaster.ray);
  wordParticles.update(cursor.position, cursor.velocity);
  postProcessing.render();
};

void renderer.setAnimationLoop(tick);

// Start the intro behind the preloader, so the scene is already moving when the overlay fades.
intro.start();
await preloader.complete();

if (import.meta.env.DEV) {
  const { setupDebug } = await import('./core/debug');

  setupDebug(renderer, {
    filmIntensity: postProcessing.filmIntensity,
    atmosphere,
    camera: controls.settings,
    replayIntro: () => {
      intro.start();
      wordParticles.restart();
    },
    gravityStrength: wordParticles.gravityStrength,
    generalDamping: wordParticles.generalDamping,
    heatDamping: wordParticles.heatDamping,
    heatImpactStrength: wordParticles.heatImpactStrength,
    gatherSpring: wordParticles.gatherSpring,
    gatherDamping: wordParticles.gatherDamping,
    gatherSwirl: wordParticles.gatherSwirl,
  });
}
