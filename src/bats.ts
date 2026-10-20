import * as THREE from 'three/webgpu';

interface BatConfig {
  center: THREE.Vector3;
  radius: number;
  speed: number;
  phase: number;
  bob: number;
  bobSpeed: number;
  scale: number;
}

interface BatInstance {
  group: THREE.Group;
  leftFlap: THREE.Group;
  rightFlap: THREE.Group;
  config: BatConfig;
}

export interface Bats {
  update(elapsed: number): void;
}

const batMaterial = new THREE.MeshBasicNodeMaterial({
  color: 0x0a090d,
  side: THREE.DoubleSide,
});

const eyeMaterial = new THREE.MeshBasicNodeMaterial({
  color: 0xff8a4c,
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

  group.scale.setScalar(config.scale);

  return { group, leftFlap, rightFlap, config };
}

export function createBats(scene: THREE.Scene, camera: THREE.Camera): Bats {
  const configs: BatConfig[] = [
    {
      center: new THREE.Vector3(0, 3.4, 6),
      radius: 2,
      speed: 0.7,
      phase: 0,
      bob: 0.15,
      bobSpeed: 1.4,
      scale: 1.6,
    },
    {
      center: new THREE.Vector3(-8.9, 2.3, 7.5),
      radius: 0.8,
      speed: -0.8,
      phase: 1.2,
      bob: 0.3,
      bobSpeed: 1.1,
      scale: 1.45,
    },
    {
      center: new THREE.Vector3(7.1, 1.6, 8.5),
      radius: 0.9,
      speed: 0.75,
      phase: 2.4,
      bob: 0.35,
      bobSpeed: 1.3,
      scale: 1.5,
    },
    {
      center: new THREE.Vector3(-13.5, -5, -9),
      radius: 2,
      speed: -0.6,
      phase: 3.6,
      bob: 0.45,
      bobSpeed: 1,
      scale: 1.4,
    },
    {
      center: new THREE.Vector3(13.5, -5.2, -10),
      radius: 2.2,
      speed: 0.65,
      phase: 4.8,
      bob: 0.4,
      bobSpeed: 1.2,
      scale: 1.3,
    },
    {
      center: new THREE.Vector3(0, 5.8, -13),
      radius: 5.5,
      speed: -0.55,
      phase: 6,
      bob: 0.5,
      bobSpeed: 0.9,
      scale: 1.2,
    },
  ];

  const bats = configs.map((config) => {
    const bat = createBat(config);
    scene.add(bat.group);

    return bat;
  });

  return {
    update(elapsed) {
      for (const bat of bats) {
        const angle = bat.config.phase + elapsed * bat.config.speed;
        const x = bat.config.center.x + Math.cos(angle) * bat.config.radius;
        const z = bat.config.center.z + Math.sin(angle) * bat.config.radius * 0.55;
        const y =
          bat.config.center.y +
          Math.sin(elapsed * bat.config.bobSpeed + bat.config.phase) * bat.config.bob;

        bat.group.position.set(x, y, z);
        bat.group.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z);

        const flap = Math.sin(elapsed * 12 + bat.config.phase) * 0.7;
        bat.rightFlap.rotation.z = flap;
        bat.leftFlap.rotation.z = flap;
      }
    },
  };
}
