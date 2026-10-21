import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { film } from 'three/addons/tsl/display/FilmNode.js';
import {
  EPSILON,
  color,
  deltaTime,
  dot,
  Fn,
  If,
  instancedArray,
  instanceIndex,
  Loop,
  pass,
  positionLocal,
  step,
  uniform,
  uv,
  vec3,
} from 'three/tsl';
import { createBats } from './bats';
import { createGhosts } from './ghosts';
import { setupMusicToggle } from './music';
import { toNormalizedDeviceCoordinates } from './ndc';
import { loadPumpkin } from './pumpkin';
import { createWordTargets } from './word-targets';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');

if (!canvas) {
  throw new Error('Canvas element not found');
}

setupMusicToggle();

/**
 * Scene
 */
const scene = new THREE.Scene();

/**
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(35, sizes.width / sizes.height, 0.1, 100);
camera.position.z = 25;
scene.add(camera);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
// The target is at the origin, so this also limits the camera z to 60.
controls.maxDistance = 60;

/**
 * Renderer
 */
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

await renderer.init();

window.addEventListener('resize', () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/**
 * Post processing
 */
const renderPipeline = new THREE.RenderPipeline(renderer);
const scenePass = pass(scene, camera);
const scenePassColor = scenePass.getTextureNode('output');
const bloomPass = bloom(scenePassColor);
bloomPass.threshold.value = 0;
bloomPass.strength.value = 0.2;

const filmIntensity = uniform(0.2);
const filmPass = film(scenePassColor.add(bloomPass), filmIntensity);

renderPipeline.outputNode = filmPass;

/**
 * Lights
 */
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
directionalLight.castShadow = true;
directionalLight.position.set(1, 1, 0.75).normalize().multiplyScalar(8);
directionalLight.shadow.camera.far = 16;
directionalLight.shadow.camera.top = 8;
directionalLight.shadow.camera.right = 8;
directionalLight.shadow.camera.bottom = -8;
directionalLight.shadow.camera.left = -8;
directionalLight.shadow.mapSize.set(2048, 2048);
directionalLight.shadow.radius = 30;
directionalLight.shadow.normalBias = -0.1;
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0xe8b8ff, 0.08);
scene.add(ambientLight);

/**
 * Cursor
 */
const raycaster = new THREE.Raycaster();
const cursor = new THREE.Vector2();

window.addEventListener('pointermove', (event) => {
  const coordinates = toNormalizedDeviceCoordinates(
    event.clientX,
    event.clientY,
    sizes.width,
    sizes.height,
  );

  cursor.x = coordinates.x;
  cursor.y = coordinates.y;
});

const cursorHelper = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1, 3),
  new THREE.MeshBasicMaterial({ wireframe: true }),
);

/**
 * Word particles
 */
const count = 8000;
const targets = createWordTargets('ADGUARD', {
  count,
  depth: 1.1,
  worldWidth: 15.5,
  heightScale: 1.5,
});

const positionsBuffer = instancedArray(count, 'vec3');
const velocitiesBuffer = instancedArray(count, 'vec3');
const heatBuffer = instancedArray(count, 'float');
const targetsBuffer = instancedArray(targets, 'vec3');

const radius = uniform(0.08);
const gravityStrength = uniform(0.025);
const impactDamping = uniform(0.05);
const generalDamping = uniform(0.4);
const heatDamping = uniform(2);
const heatImpactStrength = uniform(30);
const emissiveColor = color('#67b279');
const cursorPosition = uniform(vec3());
const cursorVelocity = uniform(vec3());
const cursorRadius = uniform(1.75);
const cursorStrength = uniform(0.05);

const initCompute = Fn(() => {
  const position = positionsBuffer.element(instanceIndex);

  position.assign(targetsBuffer.element(instanceIndex));
})().compute(count);

renderer.compute(initCompute);

const updateCompute = Fn(() => {
  const clampedDeltaTime = deltaTime.min(1 / 30);

  const aPosition = positionsBuffer.element(instanceIndex);
  const aVelocity = velocitiesBuffer.element(instanceIndex);
  const aHeat = heatBuffer.element(instanceIndex);

  const cursorDistance = aPosition.distance(cursorPosition);
  const cursorDistanceRatio = cursorDistance.div(cursorRadius).oneMinus().max(0);
  const currentCursorVelocity = cursorVelocity.mul(cursorDistanceRatio).mul(cursorStrength);
  aVelocity.addAssign(currentCursorVelocity);
  aHeat.addAssign(currentCursorVelocity.length().mul(50));

  const toTarget = targetsBuffer.element(instanceIndex).sub(aPosition);
  const targetDirection = toTarget.div(toTarget.length().max(EPSILON));
  const gravityVelocity = targetDirection.mul(gravityStrength).mul(clampedDeltaTime);
  aVelocity.addAssign(gravityVelocity);

  Loop({ start: instanceIndex.add(1), end: count, condition: '<' }, ({ i }) => {
    const bPosition = positionsBuffer.element(i);
    const bVelocity = velocitiesBuffer.element(i);
    const bHeat = heatBuffer.element(i);

    const delta = bPosition.sub(aPosition);
    const distance = delta.length();
    const direction = delta.div(distance.max(EPSILON));

    const radius2 = radius.mul(2);
    If(distance.lessThan(radius2), () => {
      const overlap = radius2.sub(distance);
      const avoidance = direction.mul(overlap.div(2));
      aPosition.subAssign(avoidance);
      bPosition.addAssign(avoidance);

      const relativeVelocity = aVelocity.sub(bVelocity);
      const impactStrength = dot(relativeVelocity, direction);
      const impactVelocity = direction.mul(impactStrength).mul(impactDamping.oneMinus());
      aVelocity.subAssign(impactVelocity);
      bVelocity.addAssign(impactVelocity);

      const heat = impactStrength.sub(0.01).max(0).mul(heatImpactStrength);
      aHeat.addAssign(heat);
      bHeat.addAssign(heat);
    });
  });

  aPosition.addAssign(aVelocity);
  aVelocity.mulAssign(generalDamping.mul(clampedDeltaTime).oneMinus());
  aHeat.mulAssign(heatDamping.mul(clampedDeltaTime).oneMinus());
})().compute(count);

/**
 * Particles mesh
 */
const pumpkin = await loadPumpkin(`${import.meta.env.BASE_URL}models/pumpkin-carved.glb`);

const geometry = pumpkin.geometry;
const material = new THREE.MeshLambertNodeMaterial({
  map: pumpkin.map,
  side: THREE.DoubleSide,
}) as THREE.MeshLambertNodeMaterial & {
  emissiveNode: unknown;
};

const pumpkinSize = uniform(1.5);
const pumpkinScale = radius.mul(2).mul(pumpkinSize).div(pumpkin.height);

material.positionNode = Fn(() => {
  const localPosition = positionLocal.sub(vec3(0, pumpkin.centerY, 0)).mul(pumpkinScale);

  return localPosition.add(positionsBuffer.element(instanceIndex));
})();

const heat = heatBuffer.element(instanceIndex);
// The carved pumpkin maps its face to the right edge of the texture cell.
const faceMask = step(0.8, uv().x);
const faceEmissive = color('#ff9a3c').mul(faceMask).mul(0.8);
material.emissiveNode = faceEmissive.add(emissiveColor.mul(heat));

const mesh = new THREE.Mesh(geometry, material);
mesh.castShadow = true;
mesh.receiveShadow = true;
mesh.frustumCulled = false;
mesh.count = count;
scene.add(mesh);

const ghosts = await createGhosts(scene, camera);
const bats = createBats(scene, camera);

if (import.meta.env.DEV) {
  const { setupDebug } = await import('./debug');

  setupDebug(renderer, {
    bloomPass,
    filmIntensity,
    directionalLight,
    ambientLight,
    radius,
    pumpkinSize,
    gravityStrength,
    impactDamping,
    generalDamping,
    heatDamping,
    heatImpactStrength,
    cursorRadius,
    cursorStrength,
  });
}

/**
 * Animate
 */
const timer = new THREE.Timer();
timer.connect(document);

const tick = (timestamp: number) => {
  controls.update();

  timer.update(timestamp);
  const delta = timer.getDelta();
  const elapsed = timer.getElapsed();

  ghosts.update(delta, elapsed);
  bats.update(delta);

  scene.updateMatrixWorld();
  raycaster.setFromCamera(cursor, camera);
  ghosts.setHover(raycaster);
  bats.setHover(raycaster);
  const planeNormal = camera.position.clone().normalize();
  const plane = new THREE.Plane(planeNormal, 0);

  const intersect = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, intersect);

  cursorHelper.position.copy(intersect);

  cursorVelocity.value.copy(intersect).sub(cursorPosition.value);
  cursorPosition.value.copy(intersect);

  renderer.compute(updateCompute);
  renderPipeline.render();
};

void renderer.setAnimationLoop(tick);
