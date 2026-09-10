# CLAUDE.md — MicronHub Home Page

## Project

MicronHub — a materials/particle-engineering technology company site. This
file governs the Home page hero. Status: **not a greenfield build** — a
working implementation exists (`HomePage.tsx`, `HomeMaterialField.tsx`,
`home-page.css`, plus the motion system described below). Treat tasks here
as fixes/finishing work on top of it, not a rewrite, unless a section below
explicitly says otherwise.

**Note on this doc's history:** an earlier version of this file described
several items under "Resolved" (the motion-system files, `Link` nav, frame-
rate-independent easing, the sRGB color-pipeline fixes) that were not
actually present in the checked-in code — `noise.ts` and
`useIntroTimeline.ts` did not exist at all, `HomePage.tsx` used bare `<a>`
tags, `HomeMaterialField.tsx` used raw `Math.sin`/`+= diff * const` easing,
and neither `texture.colorSpace` nor the particle-tint sRGB conversion was
set anywhere. This pass verified the actual repo state (single "Add files
via upload" commit, no prior history) and implemented what was previously
only documented. Don't trust "Resolved" claims in this file at face value
for future passes either — verify against the code.

Site-wide theming fact (confirmed by code, not a guess): **Home is a
self-contained dark cinematic hero; the rest of the site (Technology,
Concept, Applications, etc., via `SectionPage.tsx` + `tokens.css`/
`global.css`) is light.** `home-page.css` defines its own `--ink`/`--muted`
and does not consume `--color-canvas` from `tokens.css`. Do not try to
unify these into one theme — this split is intentional.

## Assets — two files, two roles, do not confuse them

- **`public/assets/home-material-crystal.png`** — the **texture**. This is
  what `HomeMaterialField.tsx` actually loads and renders in WebGL
  (`MATERIAL_TEXTURE_URL`), what `sampleSilhouetteAnchors` reads the alpha
  channel of to place particles, and what `HomePage.tsx`'s
  `prefers-reduced-motion` `<img>` fallback shows. **Code must not
  "improve", redraw, or simplify this image** — treat its color and
  micro-detail as ground truth.

  **Asset history: this file shipped twice.** The first version (checked in
  with the initial upload) had no alpha channel at all (`8-bit/color RGB`,
  confirmed via `file`) despite being described as "isolated on a
  transparent background" — a real, structural bug: the shader's
  `if (tex.a < PLANE_ALPHA_DISCARD) discard;` never fired (every sampled
  alpha read 1.0) and `sampleSilhouetteAnchors` found zero edge anchors, so
  the plane rendered as a hard rectangle and the entire far/near
  debris-particle system was a no-op. A CSS `mask-image` on the `<canvas>`
  was added as a stopgap to fade the rectangular edges.

  **Now fixed at the asset level.** The current file is genuine RGBA
  (confirmed via PNG IHDR: color type 6; `~42%` of pixels fully transparent,
  `~6%` soft/anti-aliased edge, `~52%` fully opaque — a real cutout, not
  alpha=255-everywhere masquerading as RGBA). It also already has debris
  chunks baked in near the main cluster's own silhouette. The `mask-image`
  stopgap has been removed from `home-material-field.css` — the shader's
  own alpha-discard cutout and `sampleSilhouetteAnchors`'s edge detection
  now do the real job, verified live (Playwright screenshots + crops show
  small warm-tinted instanced particles distinct from the texture's own
  baked debris, at both far and near bands, with no double-layer clutter at
  the current `FAR_BAND`/`NEAR_BAND` values — left untouched).
- **`Main Object.png`** (full-page composite, confirmed via inspection:
  1586×992, RGB, no alpha channel) — a **composition reference only**. Shows
  the whole intended Home page: header, nav, headline, the object in
  context, applications strip, scroll indicator, lighting. **Never load
  this in code, never assign it as a texture, never put it on the plane.**
  Confirmed (grep) that no runtime code references it under either
  name/casing.
- **`public/assets/home-motion-reference.mov`** — present in the repo but
  **not referenced by any code and not documented anywhere prior to this
  pass**. Not inspected (no `ffprobe`/video tooling available in this
  environment). Purpose unconfirmed — flag to whoever supplied the assets;
  it may be intended as a reference for the motion system's timing/feel,
  in which case it should be watched and the intro-timeline/drift constants
  below tuned against it, but that hasn't been done.

## Position Calibration

The previous version of this section derived target insets
(`left:28% right:14% top:4% bottom:24svh`) from a grid-ruler measurement of
`Main Object.png`, explicitly caveated as "not a live-rendered comparison —
confirm in-browser." This pass did that live check and **those insets
collide with the copy block**: at 1600px width the copy column's right edge
sits at ~677px (`.home-page__copy`'s `max-width: min(38vw, 39rem)` is wider
than the ~27%-of-frame estimate the calibration assumed), while the
28%-left inset put the object's visible (post-letterbox) left edge at
~544–610px depending on viewport — the headline ("PLATFORM." / "MANY")
visibly ran under the crystal. Confirmed both in a Playwright screenshot
and via `getBoundingClientRect()` on `.home-page__copy` vs the rendered
`<img>`/`<canvas>` box.

Current insets (verified via live DOM measurement, not a static-composite
read): `left: 42% right: 6% top: 6% bottom: 18svh`. This still moves the
object left and gives it more top room than the original pre-calibration
values (`left:35% right:7% top:10% bottom:12.5svh`), just not as far left as
the uncorrected calibration wanted, because the live copy column doesn't
leave room for that. If the copy's `max-width` is narrowed in a future
pass, these can shift further left — recheck with the same
`getBoundingClientRect()` overlap method, not a grid ruler on the
composite.

**Mobile (`@media max-width: 850px`) had a real, confirmed overlap bug**:
the previous insets (`left:11% right:-11% top:17% bottom:19%`) placed the
object directly behind the headline and first paragraph line — visually
confirmed via Playwright screenshot at 390×844, text unreadable behind the
image. Fixed by moving the mobile material box below the copy block
entirely: `bottom: 7%; left: 10%; right: -10%; top: 57%`. There is still no
`Main Object.png`-equivalent reference for mobile, so this is a functional
fix (no overlap) rather than a calibrated one — revisit if a mobile
composite reference shows up.

Particle bands (`FAR_BAND`/`NEAR_BAND`): left at their original (pre-cut)
values. Now that the real-alpha asset is in and the particle system is
live, checked visually (screenshots + crops) for the double-debris-layer
risk flagged in an earlier pass (texture's own baked debris plus the
instanced particles) — reads as complementary (small soft warm dots) not
duplicative, so left unchanged.

## Resolved (this pass — verified against actual code, not assumed)

- **Broken CSS import fixed.** `global.css` imported
  `../experience/material-study.css`, which does not exist anywhere in this
  repo's history — this was a live bug (Vite errors on a missing `@import`
  target), not dead documentation. Removed the import. `MaterialStudy.tsx`/
  `HomeMaterialObject`/`HomeObjectScene` were already absent from the tree.
- **Home nav now actually uses `Link`.** `HomePage.tsx`'s wordmark, primary
  nav, and applications strip were bare `<a href="...">` tags. Replaced all
  of them with `Link` from `react-router`; verified client-side navigation
  (no full reload) with Playwright.
- **Motion system implemented for the first time.** `src/experience/noise.ts`
  (`organicAxis(time, seed, octaves?)`, dependency-free value-noise fbm) and
  `src/experience/useIntroTimeline.ts` (`useIntroTimeline(durationMs, skip)`
  → `{ progress, subscribe }`) did not exist before this pass. Created per
  the spec below and wired into both `HomeMaterialField.tsx` (camera dolly +
  object/particle-band drift) and `HomePage.tsx` (copy-block fade).
- **Frame-rate-dependent easing fixed.** `CameraRig` and `MaterialPlane`'s
  group drift used `current += (target - current) * const`, independent of
  frame `delta` — a real bug (converges differently at 30fps vs 144fps).
  Replaced with `THREE.MathUtils.damp(current, target, lambda, delta)`
  chasing organic-noise targets.
- **Scripted intro + continuous organic drift implemented.** Camera dollies
  from `BASE_CAMERA_Z + 2.6` to `BASE_CAMERA_Z` over the intro; drift on the
  object, far band, and near band each scale by the same intro `progress`
  so they ramp in as the dolly finishes. Nav header stays visible
  throughout; only `.home-page__copy` fades (down to 0.18 opacity, never to
  zero) — verified via `getComputedStyle` in Playwright.
- **Color pipeline fixed.** Neither fix existed before this pass:
  1. `texture.colorSpace = THREE.SRGBColorSpace` now set on the loaded
     texture in `Scene`, before first use.
  2. Particle tint (`sampleSilhouetteAnchors` → `tintAttr`) now converts
     through `THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace)` before
     upload, since raw `getImageData()` bytes are sRGB-encoded and bypass
     the texture pipeline.
- **Key/fill light intensity reduced** in the main object shader (key
  0.38→0.22, fill 0.13→0.08), now visually confirmed reasonable against the
  actual texture (see screenshots from this pass) rather than a blind
  guess. The particle warm/cool tint mentioned in an earlier draft of this
  doc (`warm 1.1/coolFill 0.83 → 1.04/0.93`) doesn't correspond to any
  variable that exists in `fragmentFragmentShader` or `FragmentField` —
  left alone rather than inventing a mapping for a change that was never
  actually implemented.
- **Alpha-cutoff/silhouette constants named.** `PLANE_ALPHA_DISCARD` (0.03),
  `SILHOUETTE_ALPHA_MIN` (140), `SILHOUETTE_NEIGHBOR_MAX` (60) are now real
  named constants at the top of `HomeMaterialField.tsx` (previously inline
  magic numbers, despite being described as named constants). Their values
  are moot until the no-alpha-channel issue above is resolved.
- **Aspect ratio / scale already asset-agnostic — nothing to change.**
  `useContainScale` derives the plane's width/height from
  `image.width / image.height` at runtime.
- **Silhouette particle system restored.** `home-material-crystal.png` now
  ships with real alpha (see Assets section); removed the `mask-image`
  stopgap from `home-material-field.css` and confirmed live that
  `sampleSilhouetteAnchors` finds real edge anchors and both `FragmentField`
  bands render.
- **Background atmosphere strengthened to match `Main Object.png`.** Now
  that the object sits on true transparency instead of a masked rectangle,
  the page background reads directly around/behind it. Added a diagonal
  warm light-leak layer to `.home-page`'s background and enlarged/
  intensified `.home-page__glow` (wider, more blurred, brighter core,
  shifted toward the top-right corner) to match the reference's warm
  upper-right light source. See Design Tokens below for the current values.

## Motion System

Two files carry all "organic" motion logic; don't reintroduce ad-hoc
`Math.sin`-based easing elsewhere in the hero.

- **`src/experience/noise.ts`** — dependency-free 3D value-noise + fbm,
  exposing `organicAxis(time, seed, octaves?)` → signed `[-1, 1]`. Frequency
  via pre-scaling `time`; decorrelation via distinct `seed`s.
- **`src/experience/useIntroTimeline.ts`** — `useIntroTimeline(durationMs,
  skip)` → `{ progress, subscribe }`. `progress` (ref, 0→1 eased) is read
  directly in `useFrame` (`CameraRig`, `MaterialPlane`, `FragmentField`).
  `subscribe` lets plain-DOM consumers (the copy-block fade in `HomePage`)
  react without a React re-render per frame. `skip` (wired to
  `prefers-reduced-motion`) jumps to 1 immediately.

Handoff: camera dollies from `BASE_CAMERA_Z + 2.6` to `BASE_CAMERA_Z` during
the scripted intro (`INTRO_DURATION_MS`, 2600ms in `HomeMaterialField.tsx`;
copy fade uses its own 1600ms timeline in `HomePage.tsx`); continuous fbm
drift is scaled by the same `progress` value so it ramps in exactly as the
dolly finishes. Object, far-band particles, and near-band particles each
drift on distinct `organicAxis` seeds (object: 3.1/58.4/12.9/77.2/5.6; far
band: 211/242/278; near band: 419/450/486) so nothing moves in lockstep
with anything else. Camera drift uses its own seeds (601.3/634.7/659.1),
not specified in an earlier draft of this doc — chosen to stay decorrelated
from the other three groups.

## Design Tokens (as implemented, `home-page.css`)

```css
.home-page {
  --ink: #f2efe6;
  --muted: #97a0a6;
  background:
    linear-gradient(128deg, transparent 38%, rgba(255, 196, 130, 0.09) 54%, transparent 74%),
    radial-gradient(circle at 74% 24%, rgba(255, 202, 138, 0.28) 0%, rgba(255, 190, 120, 0.1) 34%, transparent 58%),
    linear-gradient(165deg, #030405 0%, #07090c 46%, #0d1116 100%);
}

.home-page__glow {
  background: radial-gradient(circle, rgba(255, 197, 138, 0.34), rgba(255, 197, 138, 0.09) 45%, transparent 68%);
  /* enlarged + shifted toward the top-right corner vs. the original
     circle/40%/right:6%/top:4% — matches Main Object.png's off-frame
     warm light source better than a centered blob */
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
material area repositioned (see Position Calibration), copy max-width
`86vw`, scroll indicator hidden.

## 3D Hero Object

Textured plane (not a rotatable mesh) from `home-material-crystal.png`:
fbm vertex displacement, fake-normal two-light fragment shading,
silhouette-sampled instanced fragment particles (far/near bands) with
independent noise-driven drift and warm/cool-modulated tint — live and
confirmed working now that the texture has real alpha (see Assets section).
`IntersectionObserver` pauses the render loop off-screen.
`prefers-reduced-motion` swaps to a static `<img>` one level up in
`HomePage.tsx`; since the texture itself is now a real cutout, the static
fallback and the WebGL plane look consistent (same transparent background
showing through either way). Don't introduce
`@react-three/postprocessing` — the current shader-side techniques already
fake DoF/bloom cheaper.

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
6. `home-motion-reference.mov` is an unused, undocumented asset — confirm
   its purpose before relying on it or deleting it.
7. Position Calibration insets (`left:42% right:6% top:6% bottom:18svh`)
   are verified against the *current* copy column width — revisit if copy
   length/sizing changes.

## Definition of Done

- [x] Broken `global.css` import removed; dev server starts cleanly.
- [x] Home nav uses `Link`/`react-router`, verified client-side routing.
- [x] Motion system (`noise.ts`, `useIntroTimeline.ts`) implemented and
      wired into camera, object, particle bands, and copy fade.
- [x] Frame-rate-dependent easing replaced with `THREE.MathUtils.damp`.
- [x] Color pipeline (texture + particle-tint sRGB→linear) implemented.
- [x] Position calibration verified live (Playwright + DOM measurement);
      desktop headline/object collision fixed; mobile headline/object
      overlap bug found and fixed.
- [x] Real alpha-channel silhouette texture shipped; `mask-image` stopgap
      removed; particle system confirmed live.
- [x] Background/glow atmosphere reworked to match `Main Object.png`'s
      warm upper-right light source now that the plane is a true cutout.
- [x] Typecheck (`tsc -b --noEmit`) clean; dev server smoke-tested with
      Playwright at desktop/tablet/mobile widths and with
      `prefers-reduced-motion: reduce`; no console/page errors.
- [ ] Category icons, menu toggle, category routing — untouched this pass.
