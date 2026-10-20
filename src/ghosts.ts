import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

interface GhostConfig {
  base: THREE.Vector3;
  radiusX: number;
  radiusZ: number;
  speed: number;
  phase: number;
  bob: number;
}

export interface Ghosts {
  update(delta: number, elapsed: number): void;
}

export async function createGhosts(scene: THREE.Scene, camera: THREE.Camera): Promise<Ghosts> {
  const gltf = await new GLTFLoader().loadAsync(
    `${import.meta.env.BASE_URL}models/character-ghost.glb`,
  );

  const idleClip = gltf.animations.find((clip) => clip.name === 'idle');

  if (idleClip === undefined) {
    throw new Error('Ghost model has no idle animation');
  }

  gltf.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;

    if (mesh.isMesh !== true) {
      return;
    }

    const material = mesh.material as THREE.MeshStandardMaterial;
    material.emissive.set(0x241c33);
    material.emissiveIntensity = 1;
  });

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

  const ghosts = configs.map((config) => {
    const model = gltf.scene.clone(true);
    model.scale.setScalar(scale);
    model.position.copy(center).multiplyScalar(-scale);

    const group = new THREE.Group();
    group.add(model);
    scene.add(group);

    const mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(idleClip).play();

    return { group, mixer, config };
  });

  return {
    update(delta, elapsed) {
      for (const ghost of ghosts) {
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
  };
}
