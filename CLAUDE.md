# CLAUDE.md — MicronHub Home Page

## Project

MicronHub — a materials/particle-engineering technology company site. This
file governs the Home page hero. Status: **not a greenfield build** — a
working implementation exists (`HomePage.tsx`, `HomeMaterialField.tsx`,
`home-page.css`, plus the motion system described below). Treat tasks here
as fixes/finishing work on top of it, not a rewrite, unless a section below
explicitly says otherwise.

Site-wide theming fact (confirmed by code, not a guess): **Home is a
self-contained dark cinematic hero; the rest of the site (Technology,
Concept, Applications, etc., via `SectionPage.tsx` + `tokens.css`/
`global.css`) is light.** `home-page.css` defines its own `--ink`/`--muted`
and does not consume `--color-canvas` from `tokens.css`. Do not try to
unify these into one theme — this split is intentional.

## Assets — two files, two roles, do not confuse them

- **`public/assets/home-material-crystal.png`** — the **texture**. Object/
  crystal only, isolated, on a transparent background. This is what
  `HomeMaterialField.tsx` actually loads and renders in WebGL
  (`MATERIAL_TEXTURE_URL`), what `sampleSilhouetteAnchors` reads the alpha
  channel of to place particles, and what `HomePage.tsx`'s
  `prefers-reduced-motion` `<img>` fallback shows. **Code must not
  "improve", redraw, or simplify this image** — treat its color and
  micro-detail as ground truth. This pass has not had direct visual access
  to this specific file (only to the composition reference below) — the
  color-pipeline fixes from the previous pass (`texture.colorSpace`,
  particle tint sRGB→linear) are format/math-correctness fixes that apply
  regardless of file content, but alpha-cutoff thresholds and exact particle
  density are still open pending an actual look at this file's alpha channel.
- **`Main Object.png`** (full-page composite, confirmed via inspection:
  1586×992, RGB, no alpha channel) — a **composition reference only**. Shows
  the whole intended Home page: header, nav, headline, the object in
  context, applications strip, scroll indicator, lighting. **Never load
  this in code, never assign it as a texture, never put it on the plane.**
  Its only job is as a visual target for hero-layout calibration (object
  scale/position, light balance, spacing to copy). Confirmed (grep) that no
  runtime code references it under either name/casing.

## Position Calibration (this pass)

`.home-page__material`'s insets were shifted based on a grid-measured read
of `Main Object.png`: the object's own bounding box (dense cluster only,
excluding separately-scattered debris) sits at roughly x 32%–79%, y 8%–72%
of the frame, centered near (55%, 40%). The previous insets (`left:35%
right:7% top:10% bottom:12.5svh`) centered the box at ~(64%, 49%) — visibly
right and low of the reference. New insets: `left:28% right:14% top:4%
bottom:24svh` (left kept ~4% more generous than the raw measurement, to
preserve air between the object and the longest headline lines, which run
out to ~27%). This is a grid-ruler measurement off a static composite, not
a live-rendered comparison — confirm in-browser once `home-material-
crystal.png`'s real aspect ratio is loaded, since `useContainScale`'s "fit
80% of the limiting viewport dimension" behavior means the exact rendered
size still depends on that file's proportions, which this pass hasn't seen.
Mobile breakpoint (`@media max-width: 850px`) insets were **not** touched —
`Main Object.png` is a desktop-width composite, there's no reference for
the mobile layout to calibrate against.

Particle bands (`FAR_BAND`/`NEAR_BAND`): the previous pass's ~25-30% cut to
scatter/opacity was a speculative defense against a hypothesized double
layer of debris, made without seeing either asset. `Main Object.png` shows
a fairly wide, dense debris field extending well past the object's own
footprint — wider than either the cut or the pre-cut values. Reverted to
the original (pre-cut) values as the closer starting point. Still open:
whether the actual `home-material-crystal.png` texture has any debris baked
in near its own edges — unknown without seeing that file. If it does,
there's a real double-layer risk and these need cutting again, but that
should be driven by what's actually in the file, not another guess.

## Resolved

- **Dead code removed.** `MaterialStudy.tsx`, `material-study.css`, and the
  `HomeMaterialObject`/`HomeObjectScene` exports are gone. `global.css` no
  longer imports the deleted stylesheet.
- **Home nav no longer breaks SPA routing** — `Link` from `react-router`
  everywhere on Home.
- **Frame-rate-dependent easing fixed** — all camera/object smoothing goes
  through `THREE.MathUtils.damp(current, target, lambda, delta)`.
- **Scripted intro + continuous organic drift implemented** (see Motion
  System below) — nav header stays visible throughout; only the copy block
  fades, down to 0.18 opacity, never to zero. This was a deliberate UX call,
  confirmed accepted.
- **Color pipeline fixed for the final asset.** Two independent issues,
  both real bugs (not just "the literal ask"), both fixed:
  1. `texture.colorSpace = THREE.SRGBColorSpace` set on the loaded texture
     in `Scene`, before first use. This tells the GPU to decode the PNG's
     sRGB-encoded bytes to linear on sample — applies to *any* shader that
     samples it, including this custom `ShaderMaterial`, because it's a
     texture-upload-format-level fix, not a material-chunk-level one. Do
     not also add a manual `pow(tex.rgb, vec3(2.2))` decode in the
     fragment shader — that would double-decode and wash the image out.
  2. Particle tint (`sampleSilhouetteAnchors` → `tintAttr` in
     `FragmentField`) reads raw `canvas.getImageData()` bytes, which are
     **also** sRGB-encoded, but bypass the texture pipeline entirely
     (they go straight into an instanced buffer attribute). This was
     never being decoded, which desaturated/washed out every particle's
     color relative to the pixel it was sampled from. Fixed by converting
     through `THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace)` before
     upload. This bug existed before the asset swap too — it wasn't
     asset-specific, just more visible on a higher-quality source image.
- **Key/fill light intensity reduced** in the main object shader (key
  0.38→0.22, fill 0.13→0.08) and the particle warm/cool tint narrowed
  (warm 1.1/coolFill 0.83 → 1.04/0.93) so the shader's added lighting
  doesn't compete with whatever's baked into the final render. **Not
  verified against the actual asset** — this pass had no visual access to
  it. Tune further in-browser; see "Needs your eyes" below.
- **Aspect ratio / scale already asset-agnostic — nothing to change.**
  `useContainScale` derives the plane's width/height from
  `image.width / image.height` at runtime, so any new PNG's proportions are
  picked up automatically without hardcoding. If the object still looks
  stretched, the cause is elsewhere (the `.home-page__material` CSS box
  aspect, or `object-fit` on the `<img>` fallback), not this calculation.

## Needs your eyes (couldn't verify without the actual texture file)

1. **Alpha edge quality** — `PLANE_ALPHA_DISCARD` (0.03),
   `SILHOUETTE_ALPHA_MIN` (140), `SILHOUETTE_NEIGHBOR_MAX` (60), all named
   constants at the top of `HomeMaterialField.tsx` with comments on which
   direction to move them if you see a transparent fringe vs. eaten edges.
   Unchanged numeric values — not measured against the actual texture's
   alpha channel (only the composition reference has been inspected, and it
   has no alpha channel to measure).
2. **Particle density/spread vs. the real texture** — `FAR_BAND`/`NEAR_BAND`
   are back at their original values (see Position Calibration above for
   why). Whether they still need adjusting depends on whether
   `home-material-crystal.png` itself has any debris baked in near its
   edges — unverified.
3. **Object position/scale, live** — insets updated (see Position
   Calibration above) from a static-composite grid measurement; confirm
   once rendered with the real texture's actual aspect ratio.
4. **Light intensity** — key/fill reduced to 0.22/0.08, particle warm/cool
   narrowed to 1.04/0.93 — reasoned guesses, not measurements against the
   actual render.

## Motion System

Two files carry all "organic" motion logic; don't reintroduce ad-hoc
`Math.sin`-based easing elsewhere in the hero.

- **`src/experience/noise.ts`** — dependency-free 3D value-noise + fbm,
  exposing `organicAxis(time, seed, octaves?)` → signed `[-1, 1]`. Frequency
  via pre-scaling `time`; decorrelation via distinct `seed`s.
- **`src/experience/useIntroTimeline.ts`** — `useIntroTimeline(durationMs,
  skip)` → `{ progress, subscribe }`. `progress` (ref, 0→1 eased) is read
  directly in `useFrame` by `CameraRig`. `subscribe` lets plain-DOM
  consumers (the copy-block fade in `HomePage`) react without a React
  re-render per frame. `skip` (wired to `prefers-reduced-motion`) jumps to 1
  immediately.

Handoff: camera dollies from `BASE_CAMERA_Z + 2.6` to `BASE_CAMERA_Z` during
the scripted intro; continuous fbm drift is scaled by the same `progress`
value so it ramps in exactly as the dolly finishes. Object, far-band
particles, and near-band particles each drift on distinct `organicAxis`
seeds (object: 3.1/58.4/12.9/77.2/5.6; far band: 211/242/278; near band:
419/450/486) so nothing moves in lockstep with anything else.

## Design Tokens (as implemented, `home-page.css`)

```css
.home-page {
  --ink: #f2efe6;
  --muted: #97a0a6;
  background:
    radial-gradient(circle at 72% 29%, rgba(255, 200, 135, 0.13) 0%, transparent 40%),
    linear-gradient(165deg, #030405 0%, #07090c 48%, #0d1116 100%);
}
```

- H1 base color `rgba(242, 239, 230, 0.62)`, weight 300, letter-spacing
  `.095em`, size `clamp(2.25rem, 3.2vw, 4rem)`. `.home-page__emphasis`
  ("ONE"/"MANY") — full ink opacity + weight 600.
- Category accent colors (underline only): water `#5fd0e4`, rubber
  `#7cd192`, ceramics `#e0b366`, rare earth `#ac8fe6`, emerging — neutral
  `currentColor` (intentional).
- Warm highlight glow: `rgba(255, 197, 138, 0.13–0.22)`.

## Layout Model

Layered composition, `position: relative` root, `100svh`:
1. `.home-page__material` (canvas wrapper) — `z-index: 1`.
2. `.home-page__glow` — `z-index: 1`, painted before `.material`.
3. `.home-page::after` — vignette, no explicit z-index.
4. `.home-page__header`, `__copy`, `__applications`, `__scroll` — `z-index: 2`.

Breakpoint `850px` — nav hidden (no mobile menu yet, see Outstanding),
material area repositioned, copy max-width `86vw`, scroll indicator hidden.

## 3D Hero Object

Textured plane (not a rotatable mesh) from `home-material-crystal.png`:
fbm vertex displacement, fake-normal two-light fragment shading (intensity
tuned down this pass, see above), silhouette-sampled instanced fragment
particles (far/near bands) with independent noise-driven drift and
warm/cool-modulated tint. `IntersectionObserver` pauses the render loop
off-screen. `prefers-reduced-motion` swaps to a static `<img>` one level up
in `HomePage.tsx`. Don't introduce `@react-three/postprocessing` — the
current shader-side techniques already fake DoF/bloom cheaper.

## Conventions

- BEM-ish CSS naming, no Tailwind/CSS-in-JS, plain CSS + custom properties
  colocated per component.
- `react-router` v7, always `Link`/`NavLink`, never bare `<a>`.
- Motion: `organicAxis` for anything organic/non-periodic,
  `THREE.MathUtils.damp` for anything chasing a target. No raw sine, no
  raw `+= diff * const`.
- Color: any new texture consumed by a raw `ShaderMaterial` needs
  `texture.colorSpace = THREE.SRGBColorSpace` set before first use; any
  color read via `canvas.getImageData()` and pushed into a buffer attribute
  needs manual sRGB→linear conversion (`THREE.Color().setRGB(r,g,b,
  THREE.SRGBColorSpace)`) since it bypasses the texture pipeline.
- Real content (marketing copy, final category list/order) supplied
  separately — don't invent it.

## Outstanding

1. Decorative-only menu toggle (`.home-page__menu`, no `onClick`/state).
2. Category icons missing (droplet / leaf / hexagon / cluster-dots).
3. Inconsistent category routing — only "Water" has its own route.
4. `filter: drop-shadow(...)` on `<canvas>` — potential perf cost, unverified.
5. `sampleSilhouetteAnchors`'s `getImageData` CORS caveat if asset pipeline
   moves off same-origin.
6. Items under "Needs your eyes" above — asset-dependent calibration
   pending a look at the actual `home-material-crystal.png` texture.

## Definition of Done (current pass)

- [x] Links use `Link`, dead code removed, easing frame-rate independent.
- [x] Scripted intro + organic drift implemented and confirmed accepted.
- [x] Asset paths audited — both correct, no stale references found.
- [x] Color pipeline correctness fixed (texture + particle tint sRGB→linear).
- [ ] Alpha cutoffs, band scatter/opacity, light intensity — visually
      confirmed against the final PNG (pending your in-browser check).
- [ ] Category icons, menu toggle, category routing — untouched this pass.
