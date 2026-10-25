import * as THREE from 'three/webgpu';
import {
  Fn,
  If,
  atan,
  cameraPosition,
  clamp,
  cos,
  dot,
  instancedArray,
  instanceIndex,
  length,
  normalize,
  positionLocal,
  sin,
  smoothstep,
  sub,
  uniform,
  vec3,
} from 'three/tsl';
import { introDuration } from '../core/intro';
import type { Intro } from '../core/intro';

const batOrbitCenter = new THREE.Vector3(0, 2, -24);
const batOrbitRadiusMin = 13;
const batOrbitRadiusMax = 17;
const batOrbitAngularSpeed = 0.18;
const batCount = 84;

/** The flock comes from a wide circle behind the moon and moves to the final orbit. */
const flockStartRadiusScale = 1.4;
const flockStartOffset = new THREE.Vector3(0, 9, -16);
const flockIntroDuration = introDuration * 0.64;

export interface BatFlock {
  update(delta: number, elapsed: number, ray: THREE.Ray): void;
}

/**
 * A small bat silhouette. The wings are the vertices far from the body.
 */
export function createBatGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    0, 0.3, 0, 0.07, 0, 0, 0, -0.35, 0, 0, 0.3, 0, 0, -0.35, 0, -0.07, 0, 0, 0, 0.05, 0, -0.75,
    0.15, 0, -0.35, -0.15, 0, 0, 0.05, 0, 0.75, 0.15, 0, 0.35, -0.15, 0,
  ]);

  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.scale(0.45, 0.45, 0.45);
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * Create a small flock of bats that orbits the scene in 3D at a distance and flees the pointer.
 */
export function createBatFlock(
  scene: THREE.Scene,
  renderer: THREE.WebGPURenderer,
  intro: Intro,
): BatFlock {
  const positionArray = new Float32Array(batCount * 3);
  const velocityArray = new Float32Array(batCount * 3);
  const phaseArray = new Float32Array(batCount);
  const orbitBasisUArray = new Float32Array(batCount * 3);
  const orbitBasisVArray = new Float32Array(batCount * 3);
  const orbitRadiusArray = new Float32Array(batCount);
  const orbitPhaseArray = new Float32Array(batCount);

  for (let index = 0; index < batCount; index += 1) {
    const z = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const axisRadius = Math.sqrt(1 - z * z);
    const axis = new THREE.Vector3(axisRadius * Math.cos(theta), z, axisRadius * Math.sin(theta));
    const helper = Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const basisU = new THREE.Vector3().crossVectors(helper, axis).normalize();
    const basisV = new THREE.Vector3().crossVectors(axis, basisU).normalize();
    const radius = batOrbitRadiusMin + Math.random() * (batOrbitRadiusMax - batOrbitRadiusMin);
    const phase = Math.random() * Math.PI * 2;
    const cosPhase = Math.cos(phase);
    const sinPhase = Math.sin(phase);
    const offset = basisU.clone().multiplyScalar(cosPhase).addScaledVector(basisV, sinPhase);
    const tangent = basisU
      .clone()
      .multiplyScalar(-sinPhase)
      .addScaledVector(basisV, cosPhase)
      .multiplyScalar((radius * batOrbitAngularSpeed) / 2);

    orbitBasisUArray[index * 3] = basisU.x;
    orbitBasisUArray[index * 3 + 1] = basisU.y;
    orbitBasisUArray[index * 3 + 2] = basisU.z;
    orbitBasisVArray[index * 3] = basisV.x;
    orbitBasisVArray[index * 3 + 1] = basisV.y;
    orbitBasisVArray[index * 3 + 2] = basisV.z;
    orbitRadiusArray[index] = radius;
    orbitPhaseArray[index] = phase;

    positionArray[index * 3] = batOrbitCenter.x + offset.x * radius;
    positionArray[index * 3 + 1] = batOrbitCenter.y + offset.y * radius;
    positionArray[index * 3 + 2] = batOrbitCenter.z + offset.z * radius;
    velocityArray[index * 3] = tangent.x;
    velocityArray[index * 3 + 1] = tangent.y;
    velocityArray[index * 3 + 2] = tangent.z;
    phaseArray[index] = Math.random() * Math.PI * 2;
  }

  const positionStorage = instancedArray(positionArray, 'vec3').setPBO(true);
  const velocityStorage = instancedArray(velocityArray, 'vec3').setPBO(true);
  const phaseStorage = instancedArray(phaseArray, 'float').setPBO(true);
  const orbitBasisUStorage = instancedArray(orbitBasisUArray, 'vec3').setPBO(true);
  const orbitBasisVStorage = instancedArray(orbitBasisVArray, 'vec3').setPBO(true);
  const orbitRadiusStorage = instancedArray(orbitRadiusArray, 'float').setPBO(true);
  const orbitPhaseStorage = instancedArray(orbitPhaseArray, 'float').setPBO(true);

  const elapsedUniform = uniform(0);
  const deltaUniform = uniform(0);
  const rayOrigin = uniform(new THREE.Vector3());
  const rayDirection = uniform(new THREE.Vector3());
  const orbitCenter = uniform(batOrbitCenter);
  const orbitAngularSpeed = uniform(batOrbitAngularSpeed);
  const boundsMin = uniform(new THREE.Vector3(-32, -20, -44));
  const boundsMax = uniform(new THREE.Vector3(32, 24, -6));
  const introTime = intro.time;
  const introProgress = smoothstep(0, flockIntroDuration, introTime);
  const introFade = introProgress.oneMinus();
  const startRadiusScale = introFade.mul(flockStartRadiusScale).add(1);
  const startOffset = vec3(flockStartOffset.x, flockStartOffset.y, flockStartOffset.z).mul(
    introFade,
  );

  const computeVelocity = Fn(() => {
    const position = positionStorage.element(instanceIndex);
    const velocity = velocityStorage.element(instanceIndex).toVar();

    const orbitPhase = orbitPhaseStorage.element(instanceIndex);
    const orbitAngle = orbitPhase.add(elapsedUniform.mul(orbitAngularSpeed));
    const orbitRadius = orbitRadiusStorage.element(instanceIndex).mul(startRadiusScale);
    const target = orbitCenter
      .add(startOffset)
      .add(orbitBasisUStorage.element(instanceIndex).mul(cos(orbitAngle)).mul(orbitRadius))
      .add(orbitBasisVStorage.element(instanceIndex).mul(sin(orbitAngle)).mul(orbitRadius));
    velocity.addAssign(target.sub(position).mul(deltaUniform).mul(8));

    const toRay = rayOrigin.sub(position);
    const projection = dot(toRay, rayDirection);
    const closest = rayOrigin.sub(rayDirection.mul(projection));
    const away = position.sub(closest);
    const awayDistance = length(away);
    const awayLength = awayDistance.max(0.001);

    If(awayDistance.lessThan(12), () => {
      const strength = sub(12, awayDistance).div(12);
      velocity.addAssign(away.div(awayLength).mul(strength).mul(deltaUniform).mul(30));
    });

    If(length(velocity).greaterThan(4.5), () => {
      velocity.assign(normalize(velocity).mul(4.5));
    });

    velocity.mulAssign(sub(1, deltaUniform.mul(0.4)));
    velocityStorage.element(instanceIndex).assign(velocity);
  })().compute(batCount);

  const computePosition = Fn(() => {
    const position = positionStorage.element(instanceIndex);
    const velocity = velocityStorage.element(instanceIndex);
    const phase = phaseStorage.element(instanceIndex);

    position.addAssign(velocity.mul(deltaUniform).mul(2));
    position.assign(clamp(position, boundsMin, boundsMax));

    const nextPhase = phase.add(deltaUniform.mul(length(velocity).mul(2).add(4)));
    phaseStorage.element(instanceIndex).assign(nextPhase.mod(Math.PI * 2));
  })().compute(batCount);

  const batMaterial = new THREE.MeshBasicNodeMaterial({
    color: 0x050308,
    side: THREE.DoubleSide,
  });

  batMaterial.positionNode = Fn(() => {
    const position = positionLocal.toVar();
    const phase = phaseStorage.element(instanceIndex);
    const wing = smoothstep(0.08, 0.22, position.x.abs());

    position.y.addAssign(sin(phase).mul(position.x.abs()).mul(wing).mul(0.8));

    const instancePosition = positionStorage.element(instanceIndex);
    const toCamera = cameraPosition.sub(instancePosition);
    const yaw = atan(toCamera.x, toCamera.z);
    const cosYaw = cos(yaw);
    const sinYaw = sin(yaw);
    const rotated = vec3(
      position.x.mul(cosYaw).add(position.z.mul(sinYaw)),
      position.y,
      position.z.mul(cosYaw).sub(position.x.mul(sinYaw)),
    );
    const orbitPhase = orbitPhaseStorage.element(instanceIndex);
    const revealStart = orbitPhase.div(Math.PI * 2).mul(0.9);
    const reveal = smoothstep(revealStart, revealStart.add(0.6), introTime);

    return rotated.mul(reveal).add(instancePosition);
  })();

  const batGeometry = createBatGeometry();
  const batMesh = new THREE.InstancedMesh(batGeometry, batMaterial, batCount);
  batMesh.frustumCulled = false;
  scene.add(batMesh);

  return {
    update(delta, elapsed, ray) {
      elapsedUniform.value = elapsed;
      deltaUniform.value = delta;
      rayOrigin.value.copy(ray.origin);
      rayDirection.value.copy(ray.direction);

      renderer.compute(computeVelocity);
      renderer.compute(computePosition);
    },
  };
}
