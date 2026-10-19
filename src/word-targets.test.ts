import { describe, expect, it } from 'vitest'
import { createTargetsFromPixels, type PixelSource } from './word-targets'

function createRectangleSource(): PixelSource {
  const width = 20
  const height = 10
  const data = new Uint8ClampedArray(width * height * 4)
  const rectangle = { x: 5, y: 3, width: 10, height: 4 }

  for (let y = rectangle.y; y < rectangle.y + rectangle.height; y += 1) {
    for (let x = rectangle.x; x < rectangle.x + rectangle.width; x += 1) {
      const index = (y * width + x) * 4
      data[index] = 255
      data[index + 1] = 255
      data[index + 2] = 255
      data[index + 3] = 255
    }
  }

  return { width, height, data }
}

describe('createTargetsFromPixels', () => {
  it('returns three coordinates per particle', () => {
    const targets = createTargetsFromPixels(createRectangleSource(), { count: 100 })

    expect(targets).toHaveLength(300)
  })

  it('centers the targets and keeps them near the requested width', () => {
    const worldWidth = 10
    const targets = createTargetsFromPixels(createRectangleSource(), {
      count: 200,
      worldWidth,
    })

    for (let i = 0; i < targets.length; i += 3) {
      expect(Math.abs(targets[i])).toBeLessThanOrEqual(worldWidth / 2 + 1)
      expect(Math.abs(targets[i + 1])).toBeLessThanOrEqual(worldWidth / 4 + 1)
    }
  })

  it('keeps depth inside the requested range', () => {
    const depth = 2
    const targets = createTargetsFromPixels(createRectangleSource(), { count: 200, depth })

    for (let i = 2; i < targets.length; i += 3) {
      expect(Math.abs(targets[i])).toBeLessThanOrEqual(depth / 2)
    }
  })

  it('returns the same targets for the same seed', () => {
    const first = createTargetsFromPixels(createRectangleSource(), { count: 50, seed: 7 })
    const second = createTargetsFromPixels(createRectangleSource(), { count: 50, seed: 7 })

    expect(first).toEqual(second)
  })

  it('rejects an invalid count', () => {
    expect(() => createTargetsFromPixels(createRectangleSource(), { count: 0 })).toThrow(RangeError)
  })

  it('rejects an empty pixel source', () => {
    const source: PixelSource = {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray(2 * 2 * 4),
    }

    expect(() => createTargetsFromPixels(source, { count: 10 })).toThrow('No opaque pixels found')
  })
})
