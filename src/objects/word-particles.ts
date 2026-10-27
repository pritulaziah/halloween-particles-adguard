import * as THREE from 'three/webgpu';
import type { UniformNode } from 'three/webgpu';
import {
  EPSILON,
  cameraPosition,
  color,
  deltaTime,
  dot,
  Fn,
  If,
  instancedArray,
  instanceIndex,
  Loop,
  mix,
  normalLocal,
  positionLocal,
  smoothstep,
  step,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
} from 'three/tsl';
import type { Intro } from '../core/intro';
import { introDuration } from '../core/intro';
import type { Quality } from '../core/quality';
import { loadPumpkin } from './pumpkin';
import { createWordTargets } from './word-targets';

/** The width of the word at full scale, in world units. */
const wordWidth = 15.5;
/** The part of the viewport width that the word can use. */
const wordViewportFraction = 0.85;

/** The pumpkins start on a shell around the word. */
const spawnRadiusMin = 8;
const spawnRadiusMax = 17;

/** The pumpkins appear one after another. The values are fractions of the intro. */
const appearSpread = introDuration * 0.34;
const appearRamp = introDuration * 0.09;
/** The gather force fades out from this time. */
const settleStart = introDuration * 0.76;
/** The visual switches from the intro simulation to the physics at this time. */
const blendStart = introDuration * 0.84;

export interface WordParticles {
  gravityStrength: UniformNode<'float', number>;
  generalDamping: UniformNode<'float', number>;
  heatDamping: UniformNode<'float', number>;
  heatImpactStrength: UniformNode<'float', number>;
  gatherSpring: UniformNode<'float', number>;
  gatherDamping: UniformNode<'float', number>;
  gatherSwirl: UniformNode<'float', number>;
  update(cursorPosition: THREE.Vector3, cursorVelocity: THREE.Vector3): void;
  /** Scale the word so that it fits the viewport width. */
  fit(camera: THREE.PerspectiveCamera, distance: number): void;
  /** Move the pumpkins back to their start positions. */
  restart(): void;
}

/**
 * Create start positions on a shell around the word.
 * The shell is wider than it is deep, so the pumpkins enter the view from all sides.
 */
function createSpawnPositions(particleCount: number): Float32Array {
  const positions = new Float32Array(particleCount * 3);

  for (let index = 0; index < particleCount; index += 1) {
    const vertical = Math.random() * 2 - 1;
    const angle = Math.random() * Math.PI * 2;
    const ring = Math.sqrt(1 - vertical * vertical);
    const distance = spawnRadiusMin + Math.random() * (spawnRadiusMax - spawnRadiusMin);

    positions[index * 3] = Math.cos(angle) * ring * distance;
    positions[index * 3 + 1] = vertical * distance * 0.62;
    positions[index * 3 + 2] = Math.sin(angle) * ring * distance * 0.8 - 2.5;
  }

  return positions;
}

/** Create one random value from 0 to 1 for each pumpkin. The value schedules the appearance. */
function createSeeds(particleCount: number): Float32Array {
  const seeds = new Float32Array(particleCount);

  for (let index = 0; index < particleCount; index += 1) {
    seeds[index] = Math.random();
  }

  return seeds;
}

export async function createWordParticles(
  scene: THREE.Scene,
  renderer: THREE.WebGPURenderer,
  intro: Intro,
  quality: Quality,
  onProgress?: (progress: number) => void,
): Promise<WordParticles> {
  const count = quality.particleCount;
  const targets = createWordTargets('ADGUARD', {
    count,
    depth: 1.1,
    worldWidth: wordWidth,
    heightScale: 1.5,
  });

  const positionsBuffer = instancedArray(count, 'vec3');
  const velocitiesBuffer = instancedArray(count, 'vec3');
  const heatBuffer = instancedArray(count, 'float');
  const targetsBuffer = instancedArray(targets, 'vec3');

  // The intro uses its own buffers. The physics below stays exactly as it was.
  const spawnsBuffer = instancedArray(createSpawnPositions(count), 'vec3');
  const seedsBuffer = instancedArray(createSeeds(count), 'float');
  const introPositionsBuffer = instancedArray(count, 'vec3');
  const introVelocitiesBuffer = instancedArray(count, 'vec3');

  const radius = uniform(0.08);
  const gravityStrength = uniform(0.05);
  const impactDamping = 0.625;
  const generalDamping = uniform(0.4);
  const heatDamping = uniform(2);
  const heatImpactStrength = uniform(30);
  const emissiveColor = color('#67b279');
  const cursorPositionUniform = uniform(vec3());
  const cursorVelocityUniform = uniform(vec3());
  // Fixed cursor settings. They are not exposed in the debug panel.
  const cursorRadius = 1.75;
  const cursorStrength = 0.05;

  const gatherSpring = uniform(3);
  const gatherDamping = uniform(3);
  const gatherSwirl = uniform(2);
  const flightGlowStrength = 0.25;
  const flightGlowColor = color('#ff9a3c');
  const introTime = intro.time;

  const initCompute = Fn(() => {
    positionsBuffer.element(instanceIndex).assign(targetsBuffer.element(instanceIndex));
    velocitiesBuffer.element(instanceIndex).assign(vec3(0));
    heatBuffer.element(instanceIndex).assign(0);
  })().compute(count);

  const initIntroCompute = Fn(() => {
    introPositionsBuffer.element(instanceIndex).assign(spawnsBuffer.element(instanceIndex));
    introVelocitiesBuffer.element(instanceIndex).assign(vec3(0));
  })().compute(count);

  renderer.compute(initCompute);
  renderer.compute(initIntroCompute);

  // The intro flight is a separate simulation. It never changes the physics buffers.
  const introCompute = Fn(() => {
    const clampedDeltaTime = deltaTime.min(1 / 30);
    const seed = seedsBuffer.element(instanceIndex);
    const appearStart = seed.mul(appearSpread);
    const appear = smoothstep(appearStart, appearStart.add(appearRamp), introTime);
    const settle = smoothstep(settleStart, introDuration, introTime);
    const gather = appear.mul(settle.oneMinus());

    const position = introPositionsBuffer.element(instanceIndex);
    const velocity = introVelocitiesBuffer.element(instanceIndex);

    const toTarget = targetsBuffer.element(instanceIndex).sub(position);
    const distance = toTarget.length();
    const direction = toTarget.div(distance.max(EPSILON));

    velocity.addAssign(toTarget.mul(gatherSpring).mul(gather).mul(clampedDeltaTime));
    velocity.addAssign(
      vec3(direction.z, 0, direction.x.negate()).mul(gatherSwirl).mul(gather).mul(clampedDeltaTime),
    );

    position.addAssign(velocity.mul(clampedDeltaTime));

    const damping = gatherDamping.mul(gather).add(1);
    velocity.mulAssign(damping.mul(clampedDeltaTime).oneMinus());
  })().compute(count);

  const updateCompute = Fn(() => {
    const clampedDeltaTime = deltaTime.min(1 / 30);
    // The cursor is off while the intro plays. It must not accumulate force in the physics buffer.
    const cursorActive = step(introDuration, introTime);

    const aPosition = positionsBuffer.element(instanceIndex);
    const aVelocity = velocitiesBuffer.element(instanceIndex);
    const aHeat = heatBuffer.element(instanceIndex);

    const cursorDistance = aPosition.distance(cursorPositionUniform);
    const cursorDistanceRatio = cursorDistance.div(cursorRadius).oneMinus().max(0);
    const currentCursorVelocity = cursorVelocityUniform
      .mul(cursorDistanceRatio)
      .mul(cursorStrength)
      .mul(cursorActive);
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
        const impactVelocity = direction.mul(impactStrength).mul(1 - impactDamping);
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

  const pumpkin = await loadPumpkin(
    `${import.meta.env.BASE_URL}models/pumpkin-carved.glb`,
    onProgress,
  );

  const geometry = pumpkin.geometry;
  const material = new THREE.MeshLambertNodeMaterial({
    map: pumpkin.map,
    side: THREE.DoubleSide,
  }) as THREE.MeshLambertNodeMaterial & {
    emissiveNode: unknown;
  };

  const pumpkinSize = 1.8;
  const pumpkinScale = radius.mul(2).mul(pumpkinSize).div(pumpkin.height);

  const seedNode = seedsBuffer.element(instanceIndex);
  const appearStartNode = seedNode.mul(appearSpread);
  const appearNode = smoothstep(appearStartNode, appearStartNode.add(appearRamp), introTime);
  const introPositionNode = introPositionsBuffer.element(instanceIndex);
  // At the end of the intro, the pumpkins move from the intro simulation to the real physics.
  const blendNode = smoothstep(blendStart, introDuration, introTime);
  const visualPositionNode = Fn(() => {
    const physicsPosition = positionsBuffer.element(instanceIndex);
    const result = physicsPosition.toVar();

    // Read the intro position only while the intro plays.
    If(blendNode.lessThan(1), () => {
      result.assign(mix(introPositionsBuffer.element(instanceIndex), physicsPosition, blendNode));
    });

    return result;
  })();

  const toCamera = cameraPosition.sub(visualPositionNode);
  const flatToCamera = vec2(toCamera.x, toCamera.z);
  const facing = varying(flatToCamera.div(flatToCamera.length().max(EPSILON)), 'vFacing');

  // The pumpkins appear from a point, grow and then fly to their places.
  const flightDistanceNode = targetsBuffer.element(instanceIndex).sub(introPositionNode).length();
  const proximityNode = smoothstep(5, 1, flightDistanceNode);
  const backNode = appearNode.sub(1);
  const popNode = backNode
    .mul(backNode)
    .mul(backNode)
    .mul(2.70158)
    .add(backNode.mul(backNode).mul(1.70158))
    .add(1);
  const appearScaleNode = popNode.mul(mix(0.3, 1, proximityNode));

  material.positionNode = Fn(() => {
    const localPosition = positionLocal
      .sub(vec3(0, pumpkin.centerY, 0))
      .mul(pumpkinScale)
      .mul(appearScaleNode);
    const rotatedPosition = vec3(
      localPosition.x.mul(facing.y).add(localPosition.z.mul(facing.x)),
      localPosition.y,
      localPosition.z.mul(facing.y).sub(localPosition.x.mul(facing.x)),
    );

    return rotatedPosition.add(visualPositionNode);
  })();

  material.normalNode = Fn(() => {
    const normal = normalLocal;

    return vec3(
      normal.x.mul(facing.y).add(normal.z.mul(facing.x)),
      normal.y,
      normal.z.mul(facing.y).sub(normal.x.mul(facing.x)),
    );
  })();

  const heat = heatBuffer.element(instanceIndex);
  // The carved pumpkin maps its face to the right edge of the texture cell.
  const faceMask = step(0.8, uv().x);
  const faceEmissive = color('#ff9a3c').mul(faceMask).mul(0.8);
  const flightGlowNode = varying(
    appearNode.mul(smoothstep(0.5, 2.5, flightDistanceNode)).mul(flightGlowStrength),
    'vFlightGlow',
  );
  material.emissiveNode = faceEmissive
    .add(flightGlowColor.mul(flightGlowNode))
    .add(emissiveColor.mul(heat));

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = quality.shadows;
  mesh.receiveShadow = quality.shadows;
  mesh.frustumCulled = false;
  mesh.count = count;
  scene.add(mesh);

  return {
    gravityStrength,
    generalDamping,
    heatDamping,
    heatImpactStrength,
    gatherSpring,
    gatherDamping,
    gatherSwirl,

    update(cursorPosition, cursorVelocity) {
      // The word mesh is scaled to fit the viewport. Move the cursor to the mesh space.
      const scale = mesh.scale.x;
      cursorPositionUniform.value.copy(cursorPosition).divideScalar(scale);
      cursorVelocityUniform.value.copy(cursorVelocity).divideScalar(scale);
      renderer.compute(updateCompute);

      if (introTime.value < introDuration) {
        renderer.compute(introCompute);
      }
    },

    fit(camera, distance) {
      const visibleHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const targetWidth = visibleHeight * camera.aspect * wordViewportFraction;

      // Wide screens show the word at full size. Narrow screens scale it down.
      mesh.scale.setScalar(Math.min(1, targetWidth / wordWidth));
    },

    restart() {
      renderer.compute(initCompute);
      renderer.compute(initIntroCompute);
    },
  };
}
