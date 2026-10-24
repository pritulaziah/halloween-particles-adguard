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
  normalLocal,
  positionLocal,
  step,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
} from 'three/tsl';
import { loadPumpkin } from './pumpkin';
import { createWordTargets } from './word-targets';

const count = 8000;

export interface WordParticles {
  gravityStrength: UniformNode<'float', number>;
  impactDamping: UniformNode<'float', number>;
  generalDamping: UniformNode<'float', number>;
  heatDamping: UniformNode<'float', number>;
  heatImpactStrength: UniformNode<'float', number>;
  cursorRadius: UniformNode<'float', number>;
  cursorStrength: UniformNode<'float', number>;
  update(cursorPosition: THREE.Vector3, cursorVelocity: THREE.Vector3): void;
}

export async function createWordParticles(
  scene: THREE.Scene,
  renderer: THREE.WebGPURenderer,
  onProgress?: (progress: number) => void,
): Promise<WordParticles> {
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
  const gravityStrength = uniform(0.05);
  const impactDamping = uniform(0.625);
  const generalDamping = uniform(0.4);
  const heatDamping = uniform(2);
  const heatImpactStrength = uniform(30);
  const emissiveColor = color('#67b279');
  const cursorPositionUniform = uniform(vec3());
  const cursorVelocityUniform = uniform(vec3());
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

    const cursorDistance = aPosition.distance(cursorPositionUniform);
    const cursorDistanceRatio = cursorDistance.div(cursorRadius).oneMinus().max(0);
    const currentCursorVelocity = cursorVelocityUniform
      .mul(cursorDistanceRatio)
      .mul(cursorStrength);
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

  const toCamera = cameraPosition.sub(positionsBuffer.element(instanceIndex));
  const flatToCamera = vec2(toCamera.x, toCamera.z);
  const facing = varying(flatToCamera.div(flatToCamera.length().max(EPSILON)), 'vFacing');

  material.positionNode = Fn(() => {
    const localPosition = positionLocal.sub(vec3(0, pumpkin.centerY, 0)).mul(pumpkinScale);
    const rotatedPosition = vec3(
      localPosition.x.mul(facing.y).add(localPosition.z.mul(facing.x)),
      localPosition.y,
      localPosition.z.mul(facing.y).sub(localPosition.x.mul(facing.x)),
    );

    return rotatedPosition.add(positionsBuffer.element(instanceIndex));
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
  material.emissiveNode = faceEmissive.add(emissiveColor.mul(heat));

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.count = count;
  scene.add(mesh);

  return {
    gravityStrength,
    impactDamping,
    generalDamping,
    heatDamping,
    heatImpactStrength,
    cursorRadius,
    cursorStrength,
    update(cursorPosition, cursorVelocity) {
      cursorPositionUniform.value.copy(cursorPosition);
      cursorVelocityUniform.value.copy(cursorVelocity);
      renderer.compute(updateCompute);
    },
  };
}
