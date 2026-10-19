export interface PixelSource {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface WordTargetOptions {
  count: number
  depth?: number
  worldWidth?: number
  heightScale?: number
  seed?: number
  threshold?: number
}

export interface TextTargetOptions extends WordTargetOptions {
  fontFamily?: string
  fontSize?: number
  padding?: number
}

const DEFAULT_DEPTH = 1.6
const DEFAULT_WORLD_WIDTH = 16
const DEFAULT_HEIGHT_SCALE = 1.3
const DEFAULT_SEED = 1
const DEFAULT_THRESHOLD = 128
const DEFAULT_FONT_SIZE = 240
const DEFAULT_PADDING = 24
const MAX_SAMPLING_ATTEMPTS = 20

function createRandom(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function shufflePoints(points: Float32Array, random: () => number): void {
  const count = points.length / 3

  for (let i = count - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))

    for (let component = 0; component < 3; component += 1) {
      const first = i * 3 + component
      const second = j * 3 + component
      const value = points[first]
      points[first] = points[second]
      points[second] = value
    }
  }
}

function sampleVolume(
  source: PixelSource,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  centerX: number,
  centerY: number,
  scale: number,
  heightScale: number,
  depth: number,
  spacing: number,
  threshold: number,
  random: () => number,
): Float32Array {
  const pixelStep = Math.max(1, Math.round(spacing / scale))
  const halfStep = Math.floor(pixelStep / 2)
  const jitter = spacing * 0.15
  const zLayers = Math.max(1, Math.round(depth / spacing))
  const points: number[] = []

  for (let zIndex = 0; zIndex < zLayers; zIndex += 1) {
    const z = -depth / 2 + ((zIndex + 0.5) / zLayers) * depth

    for (let y = minY; y <= maxY; y += pixelStep) {
      const sampleY = Math.min(maxY, y + halfStep)

      for (let x = minX; x <= maxX; x += pixelStep) {
        const sampleX = Math.min(maxX, x + halfStep)
        const alpha = source.data[(sampleY * source.width + sampleX) * 4 + 3]

        if (alpha < threshold) {
          continue
        }

        const worldX = (sampleX - centerX) * scale + (random() - 0.5) * jitter
        const worldY = -(sampleY - centerY) * scale * heightScale + (random() - 0.5) * jitter
        const worldZ = Math.max(-depth / 2, Math.min(depth / 2, z + (random() - 0.5) * jitter))

        points.push(worldX, worldY, worldZ)
      }
    }
  }

  return new Float32Array(points)
}

export function createTargetsFromPixels(
  source: PixelSource,
  options: WordTargetOptions,
): Float32Array {
  const {
    count,
    depth = DEFAULT_DEPTH,
    worldWidth = DEFAULT_WORLD_WIDTH,
    heightScale = DEFAULT_HEIGHT_SCALE,
    seed = DEFAULT_SEED,
    threshold = DEFAULT_THRESHOLD,
  } = options

  if (!Number.isInteger(count) || count <= 0) {
    throw new RangeError('count must be a positive integer')
  }

  if (!Number.isFinite(depth) || depth <= 0) {
    throw new RangeError('depth must be a positive number')
  }

  if (!Number.isFinite(worldWidth) || worldWidth <= 0) {
    throw new RangeError('worldWidth must be a positive number')
  }

  if (!Number.isFinite(heightScale) || heightScale <= 0) {
    throw new RangeError('heightScale must be a positive number')
  }

  if (source.width <= 0 || source.height <= 0) {
    throw new RangeError('source dimensions must be positive')
  }

  if (source.data.length < source.width * source.height * 4) {
    throw new RangeError('source data is smaller than the image dimensions')
  }

  let minX = source.width
  let maxX = -1
  let minY = source.height
  let maxY = -1
  let filledPixels = 0

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const alpha = source.data[(y * source.width + x) * 4 + 3]

      if (alpha < threshold) {
        continue
      }

      filledPixels += 1
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }

  if (filledPixels === 0) {
    throw new Error('No opaque pixels found')
  }

  const pixelWidth = maxX - minX + 1
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const scale = worldWidth / pixelWidth
  const filledArea = filledPixels * scale * scale
  const volume = filledArea * depth
  const random = createRandom(seed)
  let spacing = Math.cbrt(volume / count)
  let candidates = sampleVolume(
    source,
    minX,
    maxX,
    minY,
    maxY,
    centerX,
    centerY,
    scale,
    heightScale,
    depth,
    spacing,
    threshold,
    random,
  )

  for (
    let attempt = 0;
    attempt < MAX_SAMPLING_ATTEMPTS && candidates.length / 3 < count;
    attempt += 1
  ) {
    spacing *= 0.85
    candidates = sampleVolume(
      source,
      minX,
      maxX,
      minY,
      maxY,
      centerX,
      centerY,
      scale,
      heightScale,
      depth,
      spacing,
      threshold,
      random,
    )
  }

  if (candidates.length / 3 < count) {
    throw new Error('Could not create enough word targets')
  }

  shufflePoints(candidates, random)

  return candidates.slice(0, count * 3)
}

export function createWordTargets(text: string, options: TextTargetOptions): Float32Array {
  const {
    fontFamily = 'Arial, sans-serif',
    fontSize = DEFAULT_FONT_SIZE,
    padding = DEFAULT_PADDING,
    ...targetOptions
  } = options

  if (text.trim().length === 0) {
    throw new Error('text must not be empty')
  }

  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    throw new RangeError('fontSize must be a positive number')
  }

  if (!Number.isFinite(padding) || padding < 0) {
    throw new RangeError('padding must be a non-negative number')
  }

  const font = `900 ${fontSize}px ${fontFamily}`
  const measureCanvas = document.createElement('canvas')
  const measureContext = measureCanvas.getContext('2d')

  if (!measureContext) {
    throw new Error('2D canvas context is not available')
  }

  measureContext.font = font
  const metrics = measureContext.measureText(text)
  const canvasWidth = Math.ceil(metrics.width + padding * 2)
  const canvasHeight = Math.ceil(fontSize * 1.5 + padding * 2)
  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('2D canvas context is not available')
  }

  context.font = font
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = '#ffffff'
  context.fillText(text, canvasWidth / 2, canvasHeight / 2)

  const imageData = context.getImageData(0, 0, canvasWidth, canvasHeight)

  return createTargetsFromPixels(
    { width: canvasWidth, height: canvasHeight, data: imageData.data },
    targetOptions,
  )
}
