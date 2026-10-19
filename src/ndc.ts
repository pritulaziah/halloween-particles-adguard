export interface NormalizedDeviceCoordinates {
  x: number;
  y: number;
}

export function toNormalizedDeviceCoordinates(
  clientX: number,
  clientY: number,
  width: number,
  height: number,
): NormalizedDeviceCoordinates {
  return {
    x: (clientX / width) * 2 - 1,
    y: -(clientY / height) * 2 + 1,
  };
}
