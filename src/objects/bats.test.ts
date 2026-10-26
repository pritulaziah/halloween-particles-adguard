import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { applyEyeColor } from './bats';

describe('applyEyeColor', () => {
  it('returns the calm eye color at zero anger', () => {
    const color = applyEyeColor(0, new THREE.Color());

    expect(color.getHex()).toBe(0xff8a4c);
  });

  it('returns the angry eye color at full anger', () => {
    const color = applyEyeColor(1, new THREE.Color());

    expect(color.getHex()).toBe(0xff1f1f);
  });

  it('blends between the two colors', () => {
    const calm = new THREE.Color(0xff8a4c);
    const angry = new THREE.Color(0xff1f1f);
    const color = applyEyeColor(0.5, new THREE.Color());

    expect(color.r).toBeCloseTo(calm.r, 5);
    expect(color.g).toBeGreaterThan(angry.g);
    expect(color.g).toBeLessThan(calm.g);
    expect(color.b).toBeGreaterThan(angry.b);
    expect(color.b).toBeLessThan(calm.b);
  });

  it('clamps anger outside the zero to one range', () => {
    expect(applyEyeColor(-1, new THREE.Color()).getHex()).toBe(0xff8a4c);
    expect(applyEyeColor(2, new THREE.Color()).getHex()).toBe(0xff1f1f);
  });
});
