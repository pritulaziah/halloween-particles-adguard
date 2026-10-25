import * as THREE from 'three/webgpu';
import type { UniformNode } from 'three/webgpu';
import {
  cameraPosition,
  dot,
  Fn,
  mix,
  normalize,
  positionLocal,
  pow,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec4,
} from 'three/tsl';

type FloatUniform = UniformNode<'float', number>;
type ColorUniform = UniformNode<'color', THREE.Color>;
type Vector3Uniform = UniformNode<'vec3', THREE.Vector3>;

export interface SkySettings {
  horizonColor: ColorUniform;
  zenithColor: ColorUniform;
  nadirColor: ColorUniform;
  horizonStart: FloatUniform;
  horizonEnd: FloatUniform;
  zenithEnd: FloatUniform;
  moonGlowColor: ColorUniform;
  moonGlowStrength: FloatUniform;
  moonGlowExponent: FloatUniform;
}

export interface MoonSettings {
  position: Vector3Uniform;
  size: FloatUniform;
  opacity: FloatUniform;
  rotation: FloatUniform;
  discColor: ColorUniform;
  edgeColor: ColorUniform;
  haloColor: ColorUniform;
  haloStrength: FloatUniform;
  haloExponent: FloatUniform;
  haloRadius: FloatUniform;
  discRadius: FloatUniform;
  softness: FloatUniform;
  lightX: FloatUniform;
  lightY: FloatUniform;
  craterColor: ColorUniform;
  craterStrength: FloatUniform;
  craterScale: FloatUniform;
}

export interface Atmosphere {
  sky: SkySettings;
  moon: MoonSettings;
  fog: THREE.FogExp2;
  update(): void;
}

function createSkyMesh(settings: SkySettings, moonPosition: Vector3Uniform): THREE.Mesh {
  const material = new THREE.MeshBasicNodeMaterial({
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
  });

  const moonDirection = normalize(moonPosition.sub(cameraPosition));

  material.colorNode = Fn(() => {
    const direction = normalize(positionLocal);
    const height = direction.y;

    const horizonBlend = smoothstep(settings.horizonStart, settings.horizonEnd, height);
    const zenithBlend = smoothstep(settings.horizonEnd, settings.zenithEnd, height);
    const base = mix(settings.nadirColor, settings.horizonColor, horizonBlend);
    const gradient = mix(base, settings.zenithColor, zenithBlend);
    const glow = pow(dot(direction, moonDirection).max(0), settings.moonGlowExponent).mul(
      settings.moonGlowStrength,
    );

    return gradient.add(settings.moonGlowColor.mul(glow));
  })();

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), material);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;

  return mesh;
}

function createMoon(settings: MoonSettings): THREE.Sprite {
  const material = new THREE.SpriteNodeMaterial({
    depthWrite: false,
    fog: false,
  });

  material.scaleNode = vec2(settings.size, settings.size);
  material.rotationNode = settings.rotation;

  material.colorNode = Fn(() => {
    const centered = uv().sub(0.5).mul(2);
    const distance = centered.length();

    const disc = smoothstep(
      settings.discRadius.sub(settings.softness),
      settings.discRadius.add(settings.softness),
      distance,
    ).oneMinus();

    const radial = centered
      .sub(vec2(settings.lightX, settings.lightY))
      .length()
      .div(settings.discRadius)
      .clamp(0, 1.2);
    const edgeMix = smoothstep(0.25, 1, radial);
    const discBase = mix(settings.discColor, settings.edgeColor, edgeMix);

    const crater = (x: number, y: number, radius: number) => {
      const center = vec2(x, y).mul(settings.discRadius).mul(settings.craterScale);
      const size = settings.discRadius.mul(settings.craterScale).mul(radius);
      const craterDistance = centered.sub(center).length();

      return smoothstep(size.mul(0.55), size, craterDistance).oneMinus();
    };

    const craters = crater(-0.34, 0.22, 0.18)
      .add(crater(0.12, 0.4, 0.12))
      .add(crater(0.32, -0.18, 0.2))
      .add(crater(-0.1, -0.32, 0.1))
      .add(crater(0.02, -0.02, 0.24))
      .clamp(0, 1)
      .mul(settings.craterStrength);
    const discColor = mix(discBase, settings.craterColor, craters);

    const haloRadius = settings.haloRadius.max(settings.discRadius.add(0.01));
    const haloFalloff = haloRadius
      .sub(distance)
      .div(haloRadius.sub(settings.discRadius))
      .clamp(0, 1);
    const halo = haloFalloff.pow(settings.haloExponent).mul(settings.haloStrength);

    const color = mix(settings.haloColor, discColor, disc);
    const alpha = disc.max(halo).mul(settings.opacity);

    return vec4(color, alpha);
  })();

  const moon = new THREE.Sprite(material);
  moon.position.copy(settings.position.value);

  return moon;
}

export function createAtmosphere(scene: THREE.Scene, camera: THREE.Camera): Atmosphere {
  const sky: SkySettings = {
    horizonColor: uniform(new THREE.Color(0x252028)),
    zenithColor: uniform(new THREE.Color(0x1a181f)),
    nadirColor: uniform(new THREE.Color(0x141219)),
    horizonStart: uniform(-0.45),
    horizonEnd: uniform(0),
    zenithEnd: uniform(0.75),
    moonGlowColor: uniform(new THREE.Color(0x3a4a3d)),
    moonGlowStrength: uniform(0.18),
    moonGlowExponent: uniform(128),
  };

  const moon: MoonSettings = {
    position: uniform(new THREE.Vector3(0, 6, -30)),
    size: uniform(10),
    opacity: uniform(0.92),
    rotation: uniform(0),
    discColor: uniform(new THREE.Color(0xf7f9ee)),
    edgeColor: uniform(new THREE.Color(0xd8e0cf)),
    haloColor: uniform(new THREE.Color(0xc4d6c0)),
    haloStrength: uniform(0.28),
    haloExponent: uniform(2),
    haloRadius: uniform(1),
    discRadius: uniform(0.54),
    softness: uniform(0.04),
    lightX: uniform(-0.16),
    lightY: uniform(0.18),
    craterColor: uniform(new THREE.Color(0xb0baac)),
    craterStrength: uniform(0.8),
    craterScale: uniform(1),
  };

  // The fog color also matches the horizon of the sky gradient.
  const fog = new THREE.FogExp2(0x252028, 0.015);
  scene.fog = fog;

  const skyMesh = createSkyMesh(sky, moon.position);
  skyMesh.position.copy(camera.position);
  scene.add(skyMesh);

  const moonSprite = createMoon(moon);
  scene.add(moonSprite);

  return {
    sky,
    moon,
    fog,

    update() {
      // The sky sphere follows the camera, so it always covers the view.
      skyMesh.position.copy(camera.position);
      moonSprite.position.copy(moon.position.value);
    },
  };
}
