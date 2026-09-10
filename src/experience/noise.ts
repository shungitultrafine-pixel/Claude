// Lightweight, dependency-free 3D value noise + fbm for the JS/CPU side
// (camera rig, particle micro-drift). Deliberately mirrors the structure of
// the hash/noise/fbm GLSL functions already used in HomeMaterialField's
// shaders, so the "organic" character on the CPU side matches the "organic"
// character already baked into the surface shaders — same math, two sides.

function fractComp(v: number): number {
  return v - Math.floor(v)
}

function hash3(px: number, py: number, pz: number): number {
  let x = fractComp(px * 0.3183099 + 0.1)
  let y = fractComp(py * 0.3183099 + 0.1)
  let z = fractComp(pz * 0.3183099 + 0.1)
  x *= 17.0
  y *= 17.0
  z *= 17.0
  return fractComp(x * y * z * (x + y + z))
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const fx = smooth(x - ix)
  const fy = smooth(y - iy)
  const fz = smooth(z - iz)
  const h = (dx: number, dy: number, dz: number) => hash3(ix + dx, iy + dy, iz + dz)

  return lerp(
    lerp(lerp(h(0, 0, 0), h(1, 0, 0), fx), lerp(h(0, 1, 0), h(1, 1, 0), fx), fy),
    lerp(lerp(h(0, 0, 1), h(1, 0, 1), fx), lerp(h(0, 1, 1), h(1, 1, 1), fx), fy),
    fz,
  )
}

/** Fractal Brownian motion — sum of octaves of the value noise above. Returns roughly [0, 1]. */
export function fbm3(x: number, y: number, z: number, octaves = 4): number {
  let value = 0
  let amplitude = 0.5
  let px = x
  let py = y
  let pz = z
  for (let i = 0; i < octaves; i += 1) {
    value += amplitude * noise3(px, py, pz)
    px = px * 2.04 + 8.12
    py = py * 2.04 + 2.34
    pz = pz * 2.04 + 5.61
    amplitude *= 0.5
  }
  return value
}

/**
 * A single organic, signed [-1, 1] axis of motion driven by fbm noise instead
 * of a sine wave — no fixed period, no obvious back-and-forth "metronome"
 * feel. Callers control frequency by pre-scaling `time` (e.g. `t * 0.05`)
 * and decorrelate independent axes/objects by passing different `seed`s.
 */
export function organicAxis(time: number, seed: number, octaves = 3): number {
  return fbm3(time, seed, seed * 1.7 + 4.2, octaves) * 2 - 1
}
