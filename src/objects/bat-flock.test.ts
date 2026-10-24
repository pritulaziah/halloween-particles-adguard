import { describe, expect, it } from 'vitest';
import { createBatGeometry } from './bat-flock';

describe('createBatGeometry', () => {
  it('creates a small bat silhouette with wings', () => {
    const geometry = createBatGeometry();
    const position = geometry.getAttribute('position');

    expect(position.count).toBe(12);

    geometry.computeBoundingBox();
    const box = geometry.boundingBox;

    expect(box).not.toBeNull();
    expect(box?.max.x).toBeGreaterThan(0.2);
    expect(box?.min.x).toBeLessThan(-0.2);
    expect(box?.max.y).toBeGreaterThan(0.1);
    expect(box?.min.y).toBeLessThan(-0.1);
  });
});
