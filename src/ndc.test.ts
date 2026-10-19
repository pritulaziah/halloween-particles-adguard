import { describe, expect, it } from 'vitest';
import { toNormalizedDeviceCoordinates } from './ndc';

describe('toNormalizedDeviceCoordinates', () => {
  it('maps the center of the viewport to the origin', () => {
    expect(toNormalizedDeviceCoordinates(500, 250, 1000, 500)).toEqual({ x: 0, y: 0 });
  });

  it('maps the top-left corner to minus one and one', () => {
    expect(toNormalizedDeviceCoordinates(0, 0, 1000, 500)).toEqual({ x: -1, y: 1 });
  });

  it('maps the bottom-right corner to one and minus one', () => {
    expect(toNormalizedDeviceCoordinates(1000, 500, 1000, 500)).toEqual({ x: 1, y: -1 });
  });
});
