import * as THREE from 'three/webgpu';
import type { UniformNode } from 'three/webgpu';
import {
  Fn,
  atan,
  color,
  dot,
  materialColor,
  mix,
  modelWorldMatrix,
  mx_noise_float,
  normalView,
  positionGeometry,
  positionLocal,
  positionViewDirection,
  positionWorld,
  pow,
  sin,
  smoothstep,
  time,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { introStep } from '../core/intro';
import { introDuration } from '../core/intro';
import type { Intro } from '../core/intro';
import { loadGLTF } from '../core/load-gltf';

interface GhostConfig {
  base: THREE.Vector3;
  radiusX: number;
  radiusZ: number;
  speed: number;
  phase: number;
  bob: number;
  /** Height of the ghost in world units. */
  height: number;
  /** Intro time when the ghost starts to appear, in seconds. */
  entryDelay: number;
  entryDuration: number;
  animationSpeed: number;
}

type FloatUniform = UniformNode<'float', number>;

interface Ghost {
  group: THREE.Group;
  pivot: THREE.Group;
  mixer: THREE.AnimationMixer;
  config: GhostConfig;
  meshes: THREE.Mesh[];
  hover: FloatUniform;
  targetHover: number;
  hoverHold: number;
  appear: FloatUniform;
  baseY: FloatUniform;
  height: FloatUniform;
}

export interface Ghosts {
  update(delta: number, elapsed: number, cursorPosition: THREE.Vector3): void;
  setHover(raycaster: THREE.Raycaster): void;
}

const hoverFadeSpeed = 8;
const rimColor = 0x8ef0a8;
const innerColor = 0x3f7a52;
const baseEmissive = 0x241c33;
const bodyTint = 0xc8ffe4;
const auraColor = 0x7ce8a0;

function createAura(appear: FloatUniform, hover: FloatUniform): THREE.Sprite {
  const material = new THREE.SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });

  material.scaleNode = vec2(3.6, 3.6);
  material.colorNode = Fn(() => {
    const centered = uv().sub(0.5).mul(2);
    const distance = centered.length();
    const glow = smoothstep(1, 0.05, distance).pow(2.2);
    const pulse = sin(time.mul(1.3)).mul(0.15).add(0.85);

    return vec4(color(auraColor).rgb, glow.mul(appear).mul(hover.mul(0.18).add(0.16)).mul(pulse));
  })();

  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = -1;

  return sprite;
}

function createGhostMaterial(
  source: THREE.MeshStandardMaterial,
  seed: number,
): {
  material: THREE.MeshStandardNodeMaterial;
  hover: FloatUniform;
  appear: FloatUniform;
  baseY: FloatUniform;
  height: FloatUniform;
} {
  const material = new THREE.MeshStandardNodeMaterial();
  material.copy(source);

  material.transparent = true;
  material.depthWrite = true;
  material.colorNode = materialColor.mul(color(bodyTint).rgb);

  const hover = uniform(0);
  const appear = uniform(0);
  const baseY = uniform(0);
  const height = uniform(1);

  // The value is 0 at the bottom of the ghost and 1 at the top.
  const heightRatio = varying(
    Fn(() => {
      const worldPosition = modelWorldMatrix.mul(vec4(positionGeometry, 1));

      return worldPosition.y.sub(baseY).div(height).add(0.5);
    })(),
    'vGhostHeight',
  );

  material.positionNode = Fn(() => {
    const localPosition = positionLocal.toVar();
    const tail = smoothstep(0.45, 0, heightRatio);
    const angle = atan(localPosition.z, localPosition.x);
    const wave = sin(
      angle
        .mul(3)
        .add(time.mul(2.2))
        .add(seed * 6),
    )
      .mul(0.5)
      .add(0.5);
    const tendril = sin(
      angle
        .mul(6)
        .sub(time.mul(3.4))
        .add(seed * 4),
    )
      .mul(0.5)
      .add(0.5);
    const sway = sin(
      time
        .mul(1.3)
        .add(heightRatio.mul(2.4))
        .add(seed * 6),
    );

    localPosition.y.subAssign(tail.mul(wave.mul(0.09).add(0.04)));
    localPosition.x.addAssign(tail.mul(tendril.sub(0.5)).mul(0.1));
    localPosition.z.addAssign(tail.mul(wave.sub(0.5)).mul(0.09));
    localPosition.x.addAssign(sway.mul(0.02));

    return localPosition;
  })();

  const rim = pow(dot(normalView, positionViewDirection).oneMinus().max(0), 2.5);
  const flicker = mx_noise_float(positionWorld.mul(3).add(vec3(time.mul(0.8), 0, 0)))
    .mul(0.5)
    .add(0.5);
  const inner = smoothstep(0.65, 0, heightRatio);
  const pulse = sin(time.mul(1.7).add(seed * 6))
    .mul(0.15)
    .add(0.85);
  const rimStrength = hover.mul(1.2).add(0.45);

  material.emissiveNode = color(baseEmissive)
    .rgb.add(color(rimColor).rgb.mul(rim).mul(pulse).mul(rimStrength))
    .add(color(innerColor).rgb.mul(inner).mul(0.35).mul(flicker))
    .mul(flicker.mul(0.2).add(0.8));

  material.opacityNode = Fn(() => {
    const noise = mx_noise_float(positionWorld.mul(5).add(vec3(0, time.mul(0.6), 0)));
    const dissolve = smoothstep(0.04, 0.3, heightRatio.add(noise.mul(0.12)));

    return appear.mul(dissolve).mul(mix(1, 0.8, hover));
  })();

  return { material, hover, appear, baseY, height };
}

export async function createGhosts(
  scene: THREE.Scene,
  camera: THREE.Camera,
  intro: Intro,
  onProgress?: (progress: number) => void,
): Promise<Ghosts> {
  const gltf = await loadGLTF(`${import.meta.env.BASE_URL}models/character-ghost.glb`, onProgress);

  const idleClip = gltf.animations.find((clip) => clip.name === 'idle');

  if (idleClip === undefined) {
    throw new Error('Ghost model has no idle animation');
  }

  const sourceMesh = gltf.scene.getObjectByProperty('isMesh', true) as THREE.Mesh | undefined;

  if (sourceMesh === undefined) {
    throw new Error('Ghost model has no mesh');
  }

  const sourceMaterial = (
    Array.isArray(sourceMesh.material) ? sourceMesh.material[0] : sourceMesh.material
  ) as THREE.MeshStandardMaterial;

  const boundingBox = new THREE.Box3().setFromObject(gltf.scene);
  const center = boundingBox.getCenter(new THREE.Vector3());
  const height = boundingBox.max.y - boundingBox.min.y;

  const configs: GhostConfig[] = [
    {
      base: new THREE.Vector3(-13.8, 5.2, -9),
      radiusX: 0.6,
      radiusZ: 0.5,
      speed: 0.12,
      phase: 0,
      bob: 0.2,
      height: 1.9,
      entryDelay: introDuration * 0.32,
      entryDuration: introDuration * 0.28,
      animationSpeed: 0.6,
    },
    {
      base: new THREE.Vector3(13.8, 4.8, -9),
      radiusX: 0.6,
      radiusZ: 0.5,
      speed: 0.1,
      phase: Math.PI,
      bob: 0.22,
      height: 1.55,
      entryDelay: introDuration * 0.42,
      entryDuration: introDuration * 0.3,
      animationSpeed: 0.72,
    },
  ];

  const ghosts = configs.map((config, index): Ghost => {
    const model = gltf.scene.clone(true);
    const modelScale = config.height / height;
    model.scale.setScalar(modelScale);
    model.position.copy(center).multiplyScalar(-modelScale);

    const {
      material,
      hover,
      appear,
      baseY,
      height: ghostHeight,
    } = createGhostMaterial(sourceMaterial, index * 2.3);
    const meshes: THREE.Mesh[] = [];

    model.traverse((object) => {
      const mesh = object as THREE.Mesh;

      if (mesh.isMesh !== true) {
        return;
      }

      mesh.material = material;
      meshes.push(mesh);
    });

    const group = new THREE.Group();
    const pivot = new THREE.Group();
    pivot.add(model);

    group.add(pivot);
    group.add(createAura(appear, hover));
    scene.add(group);

    const mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(idleClip).play();
    mixer.setTime(config.phase);

    return {
      group,
      pivot,
      mixer,
      config,
      meshes,
      hover,
      targetHover: 0,
      hoverHold: 0,
      appear,
      baseY,
      height: ghostHeight,
    };
  });

  const meshes = ghosts.flatMap((ghost) => ghost.meshes);

  return {
    update(delta, elapsed, cursorPosition) {
      const seconds = intro.time.value;
      const fade = 1 - Math.exp(-delta * hoverFadeSpeed);

      for (const ghost of ghosts) {
        ghost.hover.value += (ghost.targetHover - ghost.hover.value) * fade;
        ghost.hoverHold = Math.max(0, ghost.hoverHold - delta);

        const entry = introStep(seconds, ghost.config.entryDelay, ghost.config.entryDuration);
        ghost.appear.value = entry;

        const angle = ghost.config.phase + elapsed * ghost.config.speed;
        const x = ghost.config.base.x + Math.cos(angle) * ghost.config.radiusX;
        const z = ghost.config.base.z + Math.sin(angle) * ghost.config.radiusZ;
        const bob = Math.sin(elapsed * 0.8 + ghost.config.phase) * ghost.config.bob;
        const bobSmall = Math.sin(elapsed * 1.9 + ghost.config.phase * 2) * ghost.config.bob * 0.35;
        const y = ghost.config.base.y + bob + bobSmall + (1 - entry) * -4;

        // The ghost moves away from the cursor when the cursor is near.
        const offsetX = x - cursorPosition.x;
        const offsetZ = z - cursorPosition.z;
        const distance = Math.max(Math.hypot(offsetX, offsetZ), 0.001);
        const push = Math.max(0, 1 - distance / 5) * ghost.hover.value * 0.5;
        const positionX = x + (offsetX / distance) * push;
        const positionZ = z + (offsetZ / distance) * push;
        const positionY = y + push * 0.35;

        const scale = entry * (0.85 + 0.15 * entry);

        ghost.group.position.set(positionX, positionY, positionZ);
        ghost.group.rotation.y = Math.atan2(
          camera.position.x - positionX,
          camera.position.z - positionZ,
        );
        ghost.group.scale.setScalar(scale);

        ghost.pivot.rotation.x = -ghost.hover.value * 0.06;
        ghost.pivot.rotation.z = Math.sin(elapsed * 0.9 + ghost.config.phase) * 0.035;

        ghost.baseY.value = positionY;
        ghost.height.value = Math.max(ghost.config.height * scale, 0.001);
        ghost.mixer.update(delta * ghost.config.animationSpeed);
      }
    },

    setHover(raycaster) {
      const hit = raycaster.intersectObjects(meshes, false)[0]?.object ?? null;

      for (const ghost of ghosts) {
        const hovered = ghost.meshes.includes(hit as THREE.Mesh);

        if (hovered) {
          ghost.hoverHold = 0.5;
        }

        ghost.targetHover = hovered || ghost.hoverHold > 0 ? 1 : 0;
      }
    },
  };
}
