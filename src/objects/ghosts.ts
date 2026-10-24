import * as THREE from 'three/webgpu';
import {
  color,
  dot,
  mx_noise_float,
  normalView,
  positionViewDirection,
  pow,
  time,
  uniform,
  uv,
} from 'three/tsl';
import { loadGLTF } from '../core/load-gltf';

interface GhostConfig {
  base: THREE.Vector3;
  radiusX: number;
  radiusZ: number;
  speed: number;
  phase: number;
  bob: number;
}

interface NumberUniform {
  value: number;
}

interface Ghost {
  group: THREE.Group;
  mixer: THREE.AnimationMixer;
  config: GhostConfig;
  meshes: THREE.Mesh[];
  hover: NumberUniform;
  targetHover: number;
}

export interface Ghosts {
  update(delta: number, elapsed: number): void;
  setHover(raycaster: THREE.Raycaster): void;
}

const hoverFadeSpeed = 8;
const hoverOpacity = 0.35;
const rimColor = 0x67b279;
const baseEmissive = 0x241c33;

function createGhostMaterial(source: THREE.MeshStandardMaterial) {
  const material = new THREE.MeshStandardNodeMaterial();
  material.copy(source);

  material.transparent = true;
  material.depthWrite = true;

  const hover = uniform(0);

  const rim = pow(dot(normalView, positionViewDirection).oneMinus().max(0), 3);
  const flicker = mx_noise_float(uv().mul(6).add(time.mul(0.5)))
    .mul(0.5)
    .add(0.5);

  material.emissiveNode = color(baseEmissive)
    .rgb.add(color(rimColor).rgb.mul(rim).mul(hover))
    .mul(flicker.mul(0.15).add(0.85));

  material.opacityNode = hover
    .oneMinus()
    .mul(1 - hoverOpacity)
    .add(hoverOpacity);

  return { material, hover };
}

export async function createGhosts(
  scene: THREE.Scene,
  camera: THREE.Camera,
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
  const scale = 1.8 / height;

  const configs: GhostConfig[] = [
    {
      base: new THREE.Vector3(-13.8, 5.2, -9),
      radiusX: 0.6,
      radiusZ: 0.5,
      speed: 0.12,
      phase: 0,
      bob: 0.2,
    },
    {
      base: new THREE.Vector3(13.8, 4.8, -9),
      radiusX: 0.6,
      radiusZ: 0.5,
      speed: 0.1,
      phase: Math.PI,
      bob: 0.22,
    },
  ];

  const ghosts = configs.map((config): Ghost => {
    const model = gltf.scene.clone(true);
    model.scale.setScalar(scale);
    model.position.copy(center).multiplyScalar(-scale);

    const { material, hover } = createGhostMaterial(sourceMaterial);
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
    group.add(model);
    scene.add(group);

    const mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(idleClip).play();

    return { group, mixer, config, meshes, hover, targetHover: 0 };
  });

  const meshes = ghosts.flatMap((ghost) => ghost.meshes);

  return {
    update(delta, elapsed) {
      for (const ghost of ghosts) {
        const fade = 1 - Math.exp(-delta * hoverFadeSpeed);
        ghost.hover.value += (ghost.targetHover - ghost.hover.value) * fade;

        const angle = ghost.config.phase + elapsed * ghost.config.speed;
        const x = ghost.config.base.x + Math.cos(angle) * ghost.config.radiusX;
        const z = ghost.config.base.z + Math.sin(angle) * ghost.config.radiusZ;
        const y =
          ghost.config.base.y + Math.sin(elapsed * 0.8 + ghost.config.phase) * ghost.config.bob;

        ghost.group.position.set(x, y, z);
        ghost.group.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z);
        ghost.mixer.update(delta * 0.6);
      }
    },

    setHover(raycaster) {
      const hit = raycaster.intersectObjects(meshes, false)[0]?.object ?? null;

      for (const ghost of ghosts) {
        ghost.targetHover = ghost.meshes.includes(hit as THREE.Mesh) ? 1 : 0;
      }
    },
  };
}
