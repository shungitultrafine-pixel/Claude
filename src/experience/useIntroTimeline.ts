import { useEffect, useRef } from 'react'

type ProgressListener = (progress: number) => void

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/**
 * Drives the Home hero's scripted intro. `progress` is a ref (read directly
 * in useFrame, no re-render per frame); `subscribe` lets plain-DOM consumers
 * (e.g. the copy-block fade) react without touching React state each frame.
 * `skip` (wired to prefers-reduced-motion) jumps straight to 1.
 */
export function useIntroTimeline(durationMs: number, skip: boolean) {
  const progress = useRef(skip ? 1 : 0)
  const listeners = useRef(new Set<ProgressListener>())

  useEffect(() => {
    if (skip) {
      progress.current = 1
      listeners.current.forEach((listener) => listener(1))
      return
    }

    progress.current = 0
    let start: number | null = null
    let raf = 0

    const tick = (now: number) => {
      if (start === null) start = now
      const linear = Math.min((now - start) / durationMs, 1)
      const eased = easeOutCubic(linear)
      progress.current = eased
      listeners.current.forEach((listener) => listener(eased))
      if (linear < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [durationMs, skip])

  const subscribe = (listener: ProgressListener) => {
    listeners.current.add(listener)
    listener(progress.current)
    return () => listeners.current.delete(listener)
  }

  return { progress, subscribe }
}
