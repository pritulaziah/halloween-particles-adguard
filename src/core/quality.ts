export type QualityLevel = 'high' | 'low';

export interface Quality {
  level: QualityLevel;
  /** Number of pumpkins in the word. */
  particleCount: number;
  /** Render shadows. */
  shadows: boolean;
  /** Use multisample antialiasing. */
  antialias: boolean;
  /** Maximum device pixel ratio. */
  pixelRatio: number;
}

const highQuality: Quality = {
  level: 'high',
  particleCount: 8000,
  shadows: true,
  antialias: true,
  pixelRatio: 2,
};

const lowQuality: Quality = {
  level: 'low',
  particleCount: 4000,
  shadows: false,
  antialias: false,
  pixelRatio: 1.5,
};

/** Width below which a touch device uses the low quality, in CSS pixels. */
const narrowWidth = 900;

/**
 * A phone or a tablet has a coarse pointer and no hover.
 * A touch device with a narrow screen gets the low quality too.
 * A narrow window on a desktop keeps the high quality.
 */
function isLowQualityDevice(): boolean {
  const touch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const noHover = window.matchMedia('(hover: none)').matches;
  const narrow = window.innerWidth <= narrowWidth;

  return touch && (noHover || narrow);
}

/** Read the quality level from the device or from the `quality` URL parameter. */
export function createQuality(): Quality {
  const requested = new URLSearchParams(window.location.search).get('quality');

  if (requested === 'high') {
    return { ...highQuality };
  }

  if (requested === 'low') {
    return { ...lowQuality };
  }

  return isLowQualityDevice() ? { ...lowQuality } : { ...highQuality };
}
