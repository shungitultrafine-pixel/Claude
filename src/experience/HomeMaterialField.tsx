import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { organicAxis } from './noise'
import './home-material-field.css'

const MATERIAL_TEXTURE_URL = '/assets/home-material-crystal.png'
// Confirmed (not guessed) against the actual texture: it already has debris
// baked into its own alpha-masked silhouette — ~15-20 separate rock chunks
// scattered across nearly the full canvas. FragmentField's job is now just
// to add a handful of *moving* foreground/background accents on top of that
// static baked field, not to generate the scattered look itself. Counts cut
// hard accordingly — far band especially, since it's the most redundant
// with what's already in the far corners of the source image.
const FAR_FRAGMENT_COUNT = 6
const NEAR_FRAGMENT_COUNT = 8
const BASE_CAMERA_Z = 6.0

// --- Asset-fit tuning -------------------------------------------------
// These are starting points, not measured against the actual PNG (this pass
// didn't have visual access to the replaced asset). Retune in-browser:
//
// PLANE_ALPHA_DISCARD — raise if a semi-transparent fringe is visible around
// the object's silhouette; lower if clean edge pixels are getting eaten
// into visible "holes".
const PLANE_ALPHA_DISCARD = 0.03
// SILHOUETTE_ALPHA_MIN — how opaque a pixel must be to be considered part of
// the object at all when sampling edge anchors. Raise if anchors are landing
// inside a soft/blurred edge instead of the crisp boundary.
const SILHOUETTE_ALPHA_MIN = 140
// SILHOUETTE_NEIGHBOR_MAX — how transparent a nearby pixel must be for the
// current pixel to count as "near the edge". Lower if anchors miss thin or
// sharp silhouette details (spikes, thin shards).
const SILHOUETTE_NEIGHBOR_MAX = 60

const noiseGLSL = /* glsl */ `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + .1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1., 0., 0.)), f.x),
                   mix(hash(i + vec3(0., 1., 0.)), hash(i + vec3(1., 1., 0.)), f.x), f.y),
               mix(mix(hash(i + vec3(0., 0., 1.)), hash(i + vec3(1., 0., 1.)), f.x),
                   mix(hash(i + vec3(0., 1., 1.)), hash(i + vec3(1., 1., 1.)), f.x), f.y), f.z);
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = .5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p = p * 2.04 + vec3(8.12, 2.34, 5.61);
      amplitude *= .5;
    }
    return value;
  }
`

const materialVertexShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;

  ${noiseGLSL}

  float surface(vec2 p) {
    return fbm(vec3(p * 1.8, uTime * 0.02)) - 0.5;
  }

  void main() {
    vUv = uv;
    vec3 p = position;
    float eps = 0.01;
    float h = surface(p.xy);
    float hx = surface(p.xy + vec2(eps, 0.0));
    float hy = surface(p.xy + vec2(0.0, eps));
    float amplitude = 0.006;
    p.z += h * amplitude;
    vec3 tangentX = normalize(vec3(eps, 0.0, (hx - h) * amplitude));
    vec3 tangentY = normalize(vec3(0.0, eps, (hy - h) * amplitude));
    vNormal = normalize(cross(tangentX, tangentY));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

// NOTE on color: `uMap`'s JS-side `texture.colorSpace = THREE.SRGBColorSpace`
// (set where the texture is loaded, in `Scene`) makes the GPU decode the
// PNG's sRGB-encoded bytes to linear on sample — this happens at the texture
// upload/sampling level, so it applies here even though this is a raw
// ShaderMaterial, not a built-in material. Do NOT also gamma-decode `tex.rgb`
// manually here — that would double-decode and wash the image out.
const materialFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < ${PLANE_ALPHA_DISCARD}) discard;

    vec3 normal = normalize(vNormal);
    vec3 lightA = normalize(vec3(0.58 + sin(uTime * 0.035) * 0.1, 0.74, 0.56 + cos(uTime * 0.029) * 0.1));
    vec3 lightB = normalize(vec3(-0.52, -0.2, -0.32));
    float key = max(dot(normal, lightA), 0.0);
    float fill = max(dot(normal, lightB), 0.0);
    vec3 warm = vec3(1.12, 1.0, 0.84);
    vec3 cool = vec3(0.8, 0.86, 0.99);
    float breathe = 0.96 + 0.04 * sin(uTime * 0.017);
    // Key/fill contribution reduced (was 0.38 / 0.13) so the shader's added
    // light doesn't compete with whatever lighting is already baked into
    // the final-quality render. Tune further in-browser if it still reads
    // as over-lit relative to the source PNG.
    vec3 shade = vec3(0.62) + key * 0.22 * warm + fill * 0.08 * cool;
    vec3 color = tex.rgb * shade * breathe;
    gl_FragColor = vec4(color, tex.a);
  }
`

const fragmentVertexShader = /* glsl */ `
  attribute float aOpacity;
  attribute float aBlur;
  attribute float aFacing;
  attribute vec3 aTint;
  varying float vOpacity;
  varying float vBlur;
  varying float vFacing;
  varying vec3 vTint;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vOpacity = aOpacity;
    vBlur = aBlur;
    vFacing = aFacing;
    vTint = aTint;
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`

// vTint arrives already converted sRGB->linear on the CPU side (see
// `tintAttr` in FragmentField — canvas 2D getImageData returns sRGB-encoded
// bytes, and these instanced attributes bypass any texture-level decode, so
// the conversion has to happen in JS before upload). Narrowed the warm/cool
// range (was 1.1/0.83 down to 0.99/1.03) so the sampled pixel color — the
// actual richness/depth from the source PNG — reads through, rather than
// the shader's own re-tinting dominating it.
const fragmentFragmentShader = /* glsl */ `
  varying float vOpacity;
  varying float vBlur;
  varying float vFacing;
  varying vec3 vTint;
  varying vec2 vUv;

  void main() {
    float d = distance(vUv, vec2(0.5));
    float innerEdge = mix(0.17, -0.45, vBlur);
    float mask = smoothstep(0.5, innerEdge, d);
    float dimming = 1.0 - vBlur * 0.32;
    vec3 fogColor = vec3(0.03, 0.04, 0.055);

    vec3 warmKey = vec3(1.04, 0.99, 0.9);
    vec3 coolFill = vec3(0.93, 0.96, 1.02);
    float keyWeight = clamp(vFacing * 0.5 + 0.5, 0.0, 1.0);
    vec3 lit = vTint * mix(coolFill, warmKey, keyWeight);

    vec3 color = mix(lit, fogColor, vBlur * 0.6);
    if (mask <= 0.001 || vOpacity <= 0.001) discard;
    gl_FragColor = vec4(color, mask * vOpacity * dimming);
  }
`

type Anchor = { x: number; y: number; r: number; g: number; b: number }

function sampleSilhouetteAnchors(image: HTMLImageElement, count: number): Anchor[] {
  const sampleSize = 128
  const canvas = document.createElement('canvas')
  canvas.width = sampleSize
  canvas.height = sampleSize
  const ctx = canvas.getContext('2d')
  if (!ctx) return []

  ctx.drawImage(image, 0, 0, sampleSize, sampleSize)
  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, sampleSize, sampleSize).data
  } catch {
    return []
  }

  const alphaAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= sampleSize || y >= sampleSize) return 0
    return data[(y * sampleSize + x) * 4 + 3]
  }

  const edge: Anchor[] = []
  for (let y = 1; y < sampleSize - 1; y += 2) {
    for (let x = 1; x < sampleSize - 1; x += 2) {
      const a = alphaAt(x, y)
      if (a < SILHOUETTE_ALPHA_MIN) continue
      const nearsEdge =
        alphaAt(x + 3, y) < SILHOUETTE_NEIGHBOR_MAX ||
        alphaAt(x - 3, y) < SILHOUETTE_NEIGHBOR_MAX ||
        alphaAt(x, y + 3) < SILHOUETTE_NEIGHBOR_MAX ||
        alphaAt(x, y - 3) < SILHOUETTE_NEIGHBOR_MAX
      if (!nearsEdge) continue
      const i = (y * sampleSize + x) * 4
      // Raw canvas bytes are sRGB-encoded (per the HTML Canvas 2D spec) —
      // kept as plain 0..1 here, converted to linear later in `tintAttr`.
      edge.push({
        x: x / sampleSize - 0.5,
        y: 0.5 - y / sampleSize,
        r: data[i] / 255,
        g: data[i + 1] / 255,
        b: data[i + 2] / 255,
      })
    }
  }

  if (edge.length === 0) return []
  const anchors: Anchor[] = []
  for (let i = 0; i < count; i += 1) {
    anchors.push(edge[Math.floor((i / count) * edge.length) % edge.length])
  }
  return anchors
}

function useContainScale(textureAspect: number) {
  const viewport = useThree((state) => state.viewport)
  return useMemo(() => {
    const containerAspect = viewport.width / viewport.height
    if (containerAspect > textureAspect) {
      const height = viewport.height * 0.8
      return [height * textureAspect, height] as const
    }
    const width = viewport.width * 0.8
    return [width, width / textureAspect] as const
  }, [viewport.width, viewport.height, textureAspect])
}

function MaterialPlane({ texture }: { texture: THREE.Texture }) {
  const image = texture.image as HTMLImageElement
  const textureAspect = image.width / image.height
  const [planeWidth, planeHeight] = useContainScale(textureAspect)
  const uniforms = useMemo(() => ({ uMap: { value: texture }, uTime: { value: 0 } }), [texture])
  const group = useRef<THREE.Group>(null)

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime()
    uniforms.uTime.value = t

    if (!group.current) return
    const targetX = organicAxis(t * 0.02, 3.1) * 0.05
    const targetY = organicAxis(t * 0.017, 58.4) * 0.035
    const targetRotZ = organicAxis(t * 0.015, 12.9) * 0.014
    const targetRotX = organicAxis(t * 0.013, 77.2) * 0.009
    const targetRotY = organicAxis(t * 0.011, 5.6) * 0.007

    const lambda = 2.2
    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, targetX, lambda, delta)
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, targetY, lambda, delta)
    group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, targetRotZ, lambda, delta)
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, targetRotX, lambda, delta)
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetRotY, lambda, delta)
  })

  return (
    <group ref={group}>
      <mesh scale={[planeWidth, planeHeight, 1]}>
        <planeGeometry args={[1, 1, 160, 160]} />
        <shaderMaterial
          fragmentShader={materialFragmentShader}
          transparent
          uniforms={uniforms}
          vertexShader={materialVertexShader}
        />
      </mesh>
    </group>
  )
}

type FragmentBandConfig = {
  zBase: number
  zJitter: number
  zWobble: number
  scatterMin: number
  scatterMax: number
  travelMin: number
  travelMax: number
  speedMin: number
  speedMax: number
  sizeMin: number
  sizeMax: number
  opacityMax: number
  blurBias: number
  focusRange: number
  driftSeed: number
  driftFreq: number
  driftAmp: number
}

function FragmentField({
  anchors,
  planeWidth,
  planeHeight,
  config,
}: {
  anchors: Anchor[]
  planeWidth: number
  planeHeight: number
  config: FragmentBandConfig
}) {
  const mesh = useRef<THREE.InstancedMesh>(null)

  const seeds = useMemo(
    () =>
      anchors.map((_, index) => ({
        phase: (index / Math.max(anchors.length, 1)) * 1.0,
        speed: config.speedMin + ((index * 37) % 11) * ((config.speedMax - config.speedMin) / 11),
        travel: config.travelMin + ((index * 53) % 17) * ((config.travelMax - config.travelMin) / 17),
        wobble: 0.02 + ((index * 19) % 7) / 160,
        wobbleFreq: 0.4 + ((index * 29) % 5) * 0.2,
        scatter: config.scatterMin + ((index * 61) % 9) * ((config.scatterMax - config.scatterMin) / 9),
        zOffset: config.zBase + (((index * 71) % 13) / 12 - 0.5) * 2 * config.zJitter,
        zPhase: ((index * 83) % 17) / 17,
        size: config.sizeMin + ((index * 41) % 9) * ((config.sizeMax - config.sizeMin) / 9),
      })),
    [anchors, config],
  )

  const opacityAttr = useMemo(() => new Float32Array(anchors.length), [anchors.length])
  const blurAttr = useMemo(() => new Float32Array(anchors.length), [anchors.length])
  // sRGB -> linear here (THREE.Color's own conversion, not a hand-rolled
  // approximation) — `sampleSilhouetteAnchors` reads raw canvas bytes, which
  // are sRGB-encoded, and these instanced attributes go straight to the GPU
  // with no texture-level decode step, unlike `uMap` above. Without this,
  // particle color reads desaturated/washed out relative to the actual PNG
  // pixel it was sampled from.
  const tintAttr = useMemo(() => {
    const arr = new Float32Array(anchors.length * 3)
    const linear = new THREE.Color()
    anchors.forEach((anchor, index) => {
      linear.setRGB(anchor.r, anchor.g, anchor.b, THREE.SRGBColorSpace)
      arr[index * 3] = linear.r
      arr[index * 3 + 1] = linear.g
      arr[index * 3 + 2] = linear.b
    })
    return arr
  }, [anchors])
  const facingAttr = useMemo(() => {
    const keyDirX = 0.5
    const keyDirY = 0.82
    const arr = new Float32Array(anchors.length)
    anchors.forEach((anchor, index) => {
      const len = Math.hypot(anchor.x, anchor.y) || 1
      arr[index] = (anchor.x / len) * keyDirX + (anchor.y / len) * keyDirY
    })
    return arr
  }, [anchors])

  useFrame(({ clock, camera }) => {
    if (!mesh.current) return
    const t = clock.getElapsedTime()
    const matrix = new THREE.Matrix4()
    const opacityAttribute = mesh.current.geometry.attributes.aOpacity as THREE.BufferAttribute | undefined
    const blurAttribute = mesh.current.geometry.attributes.aBlur as THREE.BufferAttribute | undefined

    const cameraDrift = camera.position.z - BASE_CAMERA_Z
    const dynamicFocusRange = Math.max(config.focusRange - cameraDrift * 0.5, 0.35)

    const bandDriftX = organicAxis(t * config.driftFreq, config.driftSeed) * config.driftAmp
    const bandDriftY = organicAxis(t * config.driftFreq * 0.8, config.driftSeed + 31) * config.driftAmp * 0.7
    const bandDriftZ = organicAxis(t * config.driftFreq * 1.3, config.driftSeed + 67) * config.driftAmp * 0.5

    anchors.forEach((anchor, index) => {
      const seed = seeds[index]
      const age = (t * seed.speed + seed.phase) % 1
      const eased = 1 - Math.pow(1 - age, 3)
      const dirLength = Math.hypot(anchor.x, anchor.y) || 1
      const dirX = anchor.x / dirLength
      const dirY = anchor.y / dirLength
      const wobble =
        organicAxis(t * seed.wobbleFreq * 0.6 + seed.phase * 6.28, index * 13.7 + config.driftSeed) *
        seed.wobble *
        eased

      const baseX = anchor.x * seed.scatter
      const baseY = anchor.y * seed.scatter
      const worldX = (baseX + dirX * seed.travel * eased - dirY * wobble) * planeWidth + bandDriftX
      const worldY = (baseY + dirY * seed.travel * eased + dirX * wobble) * planeHeight + bandDriftY
      const zNoise = organicAxis(t * seed.wobbleFreq * 0.3 + seed.zPhase * 6.28, index * 5.3 + config.driftSeed)
      const worldZ = seed.zOffset + zNoise * config.zWobble + bandDriftZ

      const envelope = 0.4 + 0.6 * Math.sin(Math.PI * age)
      opacityAttr[index] = Math.max(envelope, 0) * config.opacityMax

      const dofBlur = Math.min(Math.abs(worldZ) / dynamicFocusRange, 1)
      blurAttr[index] = Math.min(config.blurBias + dofBlur * (1 - config.blurBias), 1)

      const scale = seed.size * (0.75 + eased * 0.35)
      matrix.compose(
        new THREE.Vector3(worldX, worldY, worldZ),
        new THREE.Quaternion(),
        new THREE.Vector3(scale, scale, scale),
      )
      mesh.current!.setMatrixAt(index, matrix)
    })

    mesh.current.instanceMatrix.needsUpdate = true
    if (opacityAttribute) opacityAttribute.needsUpdate = true
    if (blurAttribute) blurAttribute.needsUpdate = true
  })

  if (anchors.length === 0) return null

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, anchors.length]}>
      <planeGeometry args={[1, 1]}>
        <instancedBufferAttribute attach="attributes-aOpacity" args={[opacityAttr, 1]} />
        <instancedBufferAttribute attach="attributes-aBlur" args={[blurAttr, 1]} />
        <instancedBufferAttribute attach="attributes-aTint" args={[tintAttr, 3]} />
        <instancedBufferAttribute attach="attributes-aFacing" args={[facingAttr, 1]} />
      </planeGeometry>
      <shaderMaterial
        depthWrite={false}
        fragmentShader={fragmentFragmentShader}
        transparent
        vertexShader={fragmentVertexShader}
      />
    </instancedMesh>
  )
}

// Cut back a second time, this time on confirmed evidence, not a guess (see
// FAR_FRAGMENT_COUNT/NEAR_FRAGMENT_COUNT comment above). scatterMax pulled
// in so procedural fragments don't range out past where the texture's own
// baked debris already sits — they're meant to read as a few things
// *drifting near* the baked field, not extending or duplicating it.
const FAR_BAND: FragmentBandConfig = {
  zBase: -3.2,
  zJitter: 1.1,
  zWobble: 0.05,
  scatterMin: 1.3,
  scatterMax: 1.9,
  travelMin: 0.02,
  travelMax: 0.05,
  speedMin: 0.012,
  speedMax: 0.025,
  sizeMin: 0.03,
  sizeMax: 0.06,
  opacityMax: 0.13,
  blurBias: 0.5,
  focusRange: 3.0,
  driftSeed: 211,
  driftFreq: 0.019,
  driftAmp: 0.06,
}

const NEAR_BAND: FragmentBandConfig = {
  zBase: 1.15,
  zJitter: 0.5,
  zWobble: 0.14,
  scatterMin: 0.85,
  scatterMax: 1.15,
  travelMin: 0.04,
  travelMax: 0.1,
  speedMin: 0.018,
  speedMax: 0.04,
  sizeMin: 0.014,
  sizeMax: 0.028,
  opacityMax: 0.32,
  blurBias: 0.03,
  focusRange: 1.9,
  driftSeed: 419,
  driftFreq: 0.026,
  driftAmp: 0.045,
}

function CameraRig({ introProgress }: { introProgress: MutableRefObject<number> }) {
  useFrame(({ clock, camera }, delta) => {
    const t = clock.getElapsedTime()
    const p = introProgress.current

    const introZ = BASE_CAMERA_Z + (1 - p) * 2.6
    const introX = (1 - p) * -0.35
    const introY = (1 - p) * 0.18

    const driftX = organicAxis(t * 0.055, 11.3) * 0.5
    const driftY = organicAxis(t * 0.047, 47.1) * 0.32
    const driftZ = organicAxis(t * 0.031, 91.7) * 0.6

    const targetX = introX + driftX * p
    const targetY = introY + driftY * p
    const targetZ = introZ + driftZ * p * 0.4

    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 4, delta)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 4, delta)
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 3, delta)
    camera.lookAt(0, 0, 0)
  })
  return null
}

function Scene({ url, introProgress }: { url: string; introProgress: MutableRefObject<number> }) {
  const texture = useLoader(THREE.TextureLoader, url)
  // Set before first GPU upload (this runs during render, ahead of the first
  // paint) — tells three to upload using the sRGB internal format, so every
  // sample of this texture (including from this custom ShaderMaterial) comes
  // back already decoded to linear. This is the one concrete fix for the
  // previously washed-out-relative-to-source-PNG look.
  texture.colorSpace = THREE.SRGBColorSpace

  const image = texture.image as HTMLImageElement
  const textureAspect = image.width / image.height
  const [planeWidth, planeHeight] = useContainScale(textureAspect)
  const anchors = useMemo(
    () => sampleSilhouetteAnchors(image, FAR_FRAGMENT_COUNT + NEAR_FRAGMENT_COUNT),
    [image],
  )
  const farAnchors = useMemo(() => anchors.slice(0, FAR_FRAGMENT_COUNT), [anchors])
  const nearAnchors = useMemo(() => anchors.slice(FAR_FRAGMENT_COUNT), [anchors])

  return (
    <>
      <FragmentField anchors={farAnchors} config={FAR_BAND} planeHeight={planeHeight} planeWidth={planeWidth} />
      <MaterialPlane texture={texture} />
      <FragmentField anchors={nearAnchors} config={NEAR_BAND} planeHeight={planeHeight} planeWidth={planeWidth} />
      <CameraRig introProgress={introProgress} />
    </>
  )
}

export function HomeMaterialField({ introProgress }: { introProgress: MutableRefObject<number> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(true)

  useEffect(() => {
    const node = containerRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { threshold: 0.05 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="home-material-field" ref={containerRef}>
      <Canvas
        camera={{ fov: 36, position: [0, 0, BASE_CAMERA_Z] }}
        dpr={[1, 2]}
        frameloop={active ? 'always' : 'never'}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <Scene introProgress={introProgress} url={MATERIAL_TEXTURE_URL} />
        </Suspense>
      </Canvas>
    </div>
  )
}
