import * as THREE from 'three/webgpu';
import { introDuration, introStep } from '../core/intro';
import type { Intro } from '../core/intro';

interface BatConfig {
  center: THREE.Vector3;
  radius: number;
  speed: number;
  phase: number;
  bob: number;
  bobSpeed: number;
  scale: number;
  /** Intro time when the bat starts to fly in, in seconds. */
  entryDelay: number;
  entryDuration: number;
  /** The bat starts at this point and flies to its orbit. */
  entryPosition: THREE.Vector3;
}

interface BatInstance {
  group: THREE.Group;
  leftFlap: THREE.Group;
  rightFlap: THREE.Group;
  eyeMaterial: THREE.MeshBasicNodeMaterial;
  meshes: THREE.Mesh[];
  config: BatConfig;
  anger: number;
  hovered: boolean;
  flapPhase: number;
  orbitPhase: number;
  bobPhase: number;
}

export interface Bats {
  update(delta: number): void;
  setHover(raycaster: THREE.Raycaster): void;
}

/** The eye color when the bat is calm. */
const eyeColor = new THREE.Color(0xff8a4c);
/** The eye color when the bat is angry. */
const angryEyeColor = new THREE.Color(0xff1f1f);
/** Speed of the anger change, in 1/second. */
const angerSpeed = 8;
/** Wing flap speed in the idle state, in radians per second. */
const calmFlapSpeed = 12;
/** Wing flap speed when the bat is angry, in radians per second. */
const angryFlapSpeed = 26;
/** Hover hit area radius, in bat-local units. */
const hitRadius = 0.45;

function lerpAngle(current: number, target: number, amount: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));

  return current + difference * amount;
}

/** Write the eye color for the current anger from 0 to 1 into the target color. */
export function applyEyeColor(anger: number, target: THREE.Color): THREE.Color {
  const amount = Math.min(Math.max(anger, 0), 1);

  return target.copy(eyeColor).lerp(angryEyeColor, amount);
}

const batMaterial = new THREE.MeshBasicNodeMaterial({
  color: 0x0a090d,
  side: THREE.DoubleSide,
});

function createWingGeometry(): THREE.ShapeGeometry {
  const shape = new THREE.Shape();

  shape.moveTo(0, 0);
  shape.lineTo(0.16, 0.09);
  shape.lineTo(0.36, 0.12);
  shape.lineTo(0.56, 0.05);
  shape.lineTo(0.46, -0.02);
  shape.lineTo(0.34, -0.06);
  shape.lineTo(0.25, -0.01);
  shape.lineTo(0.16, -0.07);
  shape.lineTo(0.07, -0.02);
  shape.lineTo(0, -0.01);
  shape.closePath();

  return new THREE.ShapeGeometry(shape);
}

function createBat(config: BatConfig): BatInstance {
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), batMaterial);
  body.scale.set(0.8, 1.5, 1.0);
  group.add(body);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), batMaterial);
  head.position.set(0, 0.18, 0.04);
  head.scale.set(1, 0.9, 1);
  group.add(head);

  const earGeometry = new THREE.ConeGeometry(0.035, 0.09, 3);

  const leftEar = new THREE.Mesh(earGeometry, batMaterial);
  leftEar.position.set(-0.055, 0.26, 0.04);
  leftEar.rotation.z = 0.2;
  group.add(leftEar);

  const rightEar = new THREE.Mesh(earGeometry, batMaterial);
  rightEar.position.set(0.055, 0.26, 0.04);
  rightEar.rotation.z = -0.2;
  group.add(rightEar);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 3), batMaterial);
  tail.position.set(0, -0.22, -0.02);
  tail.rotation.x = Math.PI;
  group.add(tail);

  const eyeGeometry = new THREE.SphereGeometry(0.018, 4, 3);
  const eyeMaterial = new THREE.MeshBasicNodeMaterial({ color: eyeColor });

  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.set(-0.035, 0.19, 0.125);
  group.add(leftEye);

  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  rightEye.position.set(0.035, 0.19, 0.125);
  group.add(rightEye);

  const wingGeometry = createWingGeometry();

  const rightFlap = new THREE.Group();
  rightFlap.position.set(0.06, 0.04, 0.02);
  rightFlap.add(new THREE.Mesh(wingGeometry, batMaterial));
  group.add(rightFlap);

  const leftRoot = new THREE.Group();
  leftRoot.position.set(-0.06, 0.04, 0.02);
  leftRoot.rotation.y = Math.PI;

  const leftFlap = new THREE.Group();
  leftFlap.add(new THREE.Mesh(wingGeometry, batMaterial));
  leftRoot.add(leftFlap);
  group.add(leftRoot);

  const hitArea = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial());
  hitArea.scale.setScalar(hitRadius);
  hitArea.visible = false;
  group.add(hitArea);

  group.scale.setScalar(config.scale);

  const meshes: THREE.Mesh[] = [];
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;

    if (mesh.isMesh === true) {
      meshes.push(mesh);
    }
  });

  return {
    group,
    leftFlap,
    rightFlap,
    eyeMaterial,
    meshes,
    config,
    anger: 0,
    hovered: false,
    flapPhase: config.phase,
    orbitPhase: config.phase,
    bobPhase: config.phase,
  };
}

export function createBats(scene: THREE.Scene, camera: THREE.Camera, intro: Intro): Bats {
  const orbitConfigs: Omit<BatConfig, 'entryDuration' | 'entryPosition'>[] = [
    {
      center: new THREE.Vector3(0, 3.4, 6),
      radius: 2,
      speed: 0.7,
      phase: 0,
      bob: 0.15,
      bobSpeed: 1.4,
      scale: 1.6,
      entryDelay: introDuration * 0.18,
    },
    {
      center: new THREE.Vector3(-11.9, -1.5, 2.5),
      radius: 0.8,
      speed: -0.8,
      phase: 1.2,
      bob: 0.3,
      bobSpeed: 1.1,
      scale: 1.45,
      entryDelay: introDuration * 0.26,
    },
    {
      center: new THREE.Vector3(7.1, 1.6, 8.5),
      radius: 0.9,
      speed: 0.75,
      phase: 2.4,
      bob: 0.35,
      bobSpeed: 1.3,
      scale: 1.5,
      entryDelay: introDuration * 0.22,
    },
    {
      center: new THREE.Vector3(-13.5, -5, -9),
      radius: 2,
      speed: -0.6,
      phase: 3.6,
      bob: 0.45,
      bobSpeed: 1,
      scale: 1.4,
      entryDelay: introDuration * 0.32,
    },
    {
      center: new THREE.Vector3(13.5, -5.2, -10),
      radius: 2.2,
      speed: 0.65,
      phase: 4.8,
      bob: 0.4,
      bobSpeed: 1.2,
      scale: 1.3,
      entryDelay: introDuration * 0.3,
    },
    {
      center: new THREE.Vector3(0, 5.8, -13),
      radius: 5.5,
      speed: -0.55,
      phase: 6,
      bob: 0.5,
      bobSpeed: 0.9,
      scale: 1.2,
      entryDelay: introDuration * 0.38,
    },
  ];

  const configs: BatConfig[] = orbitConfigs.map((config, index) => {
    const entryPosition = config.center.clone().normalize().multiplyScalar(30);
    entryPosition.y += 5 + (index % 3) * 2;

    return {
      ...config,
      entryDuration: introDuration * 0.34,
      entryPosition,
    };
  });

  const bats = configs.map((config) => {
    const bat = createBat(config);
    scene.add(bat.group);

    return bat;
  });

  const meshes = bats.flatMap((bat) => bat.meshes);

  return {
    update(delta) {
      const seconds = intro.time.value;

      for (const bat of bats) {
        bat.orbitPhase += delta * bat.config.speed;
        bat.bobPhase += delta * bat.config.bobSpeed;

        const entry = introStep(seconds, bat.config.entryDelay, bat.config.entryDuration);
        const orbitX = bat.config.center.x + Math.cos(bat.orbitPhase) * bat.config.radius;
        const orbitZ = bat.config.center.z + Math.sin(bat.orbitPhase) * bat.config.radius * 0.55;
        const orbitY = bat.config.center.y + Math.sin(bat.bobPhase) * bat.config.bob;

        // Blend from the start point to the orbit while the intro plays.
        const start = bat.config.entryPosition;
        const x = start.x + (orbitX - start.x) * entry;
        const y = start.y + (orbitY - start.y) * entry;
        const z = start.z + (orbitZ - start.z) * entry;

        bat.group.position.set(x, y, z);

        const angerTarget = bat.hovered ? 1 : 0;
        bat.anger += (angerTarget - bat.anger) * (1 - Math.exp(-delta * angerSpeed));
        applyEyeColor(bat.anger, bat.eyeMaterial.color);

        bat.group.scale.setScalar(bat.config.scale * entry);

        const targetAngle = Math.atan2(camera.position.x - x, camera.position.z - z);
        bat.group.rotation.y = lerpAngle(
          bat.group.rotation.y,
          targetAngle,
          1 - Math.exp(-delta * 12),
        );

        const flapSpeed =
          entry < 0.999 ? 20 : calmFlapSpeed + bat.anger * (angryFlapSpeed - calmFlapSpeed);
        bat.flapPhase += delta * flapSpeed;

        const flap = Math.sin(bat.flapPhase) * 0.7;
        bat.rightFlap.rotation.z = flap;
        bat.leftFlap.rotation.z = flap;
      }
    },

    setHover(raycaster) {
      const hit = raycaster.intersectObjects(meshes, false)[0]?.object ?? null;

      for (const bat of bats) {
        bat.hovered = bat.meshes.includes(hit as THREE.Mesh);
      }
    },
  };
}
