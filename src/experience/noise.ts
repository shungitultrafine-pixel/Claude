function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
  return s - Math.floor(s)
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function valueNoise3(x: number, y: number, z: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const z0 = Math.floor(z)
  const fx = fade(x - x0)
  const fy = fade(y - y0)
  const fz = fade(z - z0)

  const x00 = lerp(hash3(x0, y0, z0), hash3(x0 + 1, y0, z0), fx)
  const x10 = lerp(hash3(x0, y0 + 1, z0), hash3(x0 + 1, y0 + 1, z0), fx)
  const x01 = lerp(hash3(x0, y0, z0 + 1), hash3(x0 + 1, y0, z0 + 1), fx)
  const x11 = lerp(hash3(x0, y0 + 1, z0 + 1), hash3(x0 + 1, y0 + 1, z0 + 1), fx)

  const y0v = lerp(x00, x10, fy)
  const y1v = lerp(x01, x11, fy)

  return lerp(y0v, y1v, fz)
}

function fbm3(x: number, y: number, z: number, octaves: number): number {
  let value = 0
  let amplitude = 0.5
  let frequency = 1
  let normalizer = 0
  for (let i = 0; i < octaves; i += 1) {
    value += amplitude * valueNoise3(x * frequency, y * frequency, z * frequency)
    normalizer += amplitude
    amplitude *= 0.5
    frequency *= 2.03
  }
  return value / normalizer
}

/**
 * Signed [-1, 1] organic drift for one axis. `time` controls speed (pre-scale
 * before calling to change frequency); `seed` decorrelates independent axes
 * so nothing drifts in lockstep with anything else driven by this function.
 */
export function organicAxis(time: number, seed: number, octaves = 4): number {
  const n = fbm3(seed, seed * 0.71 + 4.1, time * 0.15, octaves)
  return n * 2 - 1
}
