import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { resolveFleeDirection } from './bats';

describe('resolveFleeDirection', () => {
  it('keeps a preferred direction that points away from the word', () => {
    const position = new THREE.Vector3(-8.9, 2.3, 7.5);
    const preferred = new THREE.Vector3(-1, 0.5, 0.6);
    const direction = resolveFleeDirection(position, preferred);

    expect(direction.x).toBeCloseTo(-0.79, 1);
    expect(direction.y).toBeCloseTo(0.39, 1);
    expect(direction.z).toBeCloseTo(0.47, 1);
  });

  it('turns the bat away when the preferred direction points to the word', () => {
    const position = new THREE.Vector3(8, 2, 6);
    const preferred = new THREE.Vector3(-1, -0.2, -0.8);
    const direction = resolveFleeDirection(position, preferred);
    const away = position.clone().normalize();

    expect(direction.dot(away)).toBeGreaterThan(0);
    expect(direction.x).toBeGreaterThan(0);
    expect(direction.z).toBeGreaterThan(0);
  });

  it('uses the outward direction when the bat is at the word center', () => {
    const direction = resolveFleeDirection(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0));

    expect(direction.toArray()).toEqual([0, 1, 0]);
  });

  it('never points to the word', () => {
    const positions = [
      new THREE.Vector3(0, 3.4, 6),
      new THREE.Vector3(-13.5, -5, -9),
      new THREE.Vector3(13.5, -5.2, -10),
      new THREE.Vector3(0, 5.8, -13),
    ];
    const preferred = new THREE.Vector3(0, 0, 0);

    for (const position of positions) {
      for (const x of [-1, 0, 1]) {
        for (const y of [-1, 0, 1]) {
          for (const z of [-1, 0, 1]) {
            preferred.set(x, y, z);

            const direction = resolveFleeDirection(position, preferred);
            const away = position.clone().normalize();

            expect(direction.dot(away)).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});
