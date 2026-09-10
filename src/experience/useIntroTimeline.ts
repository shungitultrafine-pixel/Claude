import { useEffect, useRef, type MutableRefObject } from 'react'

export type IntroTimeline = {
  /** Eased progress 0→1. Mutated in place every frame — read `.current`, don't expect re-renders. */
  progress: MutableRefObject<number>
  /** Subscribe to progress updates for plain-DOM consumers (outside the r3f render loop). */
  subscribe: (callback: (progress: number) => void) => () => void
}

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3

/**
 * Drives a single one-shot 0→1 intro progress value shared between the r3f
 * camera rig (reads `progress.current` inside `useFrame`, no re-render) and
 * plain HTML layers like the header/copy block (subscribe + imperatively set
 * `style.opacity`, avoiding a React re-render on every animation frame).
 *
 * When `skip` is true (e.g. `prefers-reduced-motion`), progress jumps to 1
 * immediately and no animation runs.
 */
export function useIntroTimeline(durationMs: number, skip: boolean): IntroTimeline {
  const progress = useRef(skip ? 1 : 0)
  const listenersRef = useRef(new Set<(p: number) => void>())

  useEffect(() => {
    if (skip) {
      progress.current = 1
      listenersRef.current.forEach((cb) => cb(1))
      return
    }

    let raf = 0
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1)
      progress.current = easeOutCubic(t)
      listenersRef.current.forEach((cb) => cb(progress.current))
      if (t < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [durationMs, skip])

  const subscribe = (callback: (p: number) => void) => {
    listenersRef.current.add(callback)
    return () => listenersRef.current.delete(callback)
  }

  return { progress, subscribe }
}
