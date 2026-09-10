import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { HomeMaterialField } from '../experience/HomeMaterialField'
import { useIntroTimeline } from '../experience/useIntroTimeline'
import './home-page.css'

const INTRO_DURATION_MS = 3600
// Copy fades toward this opacity during the intro dolly, never fully to
// zero — the object taking center stage shouldn't mean the headline vanishes
// for a first-time visitor who hasn't scrolled yet.
const COPY_SETTLE_OPACITY = 0.18

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return reduced
}

export function HomePage() {
  const reducedMotion = usePrefersReducedMotion()
  const { progress, subscribe } = useIntroTimeline(INTRO_DURATION_MS, reducedMotion)
  const copyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Reduced motion: leave the copy block fully visible, untouched — no
    // animation means no "post-intro dim" state either.
    if (reducedMotion) return
    const unsubscribe = subscribe((p) => {
      if (copyRef.current) {
        copyRef.current.style.opacity = String(1 - p * (1 - COPY_SETTLE_OPACITY))
      }
    })
    return unsubscribe
  }, [reducedMotion, subscribe])

  return (
    <section aria-label="MicronHub" className="home-page">
      <div aria-label="Primary navigation" className="home-page__header">
        <div className="home-page__brand">
          <Link aria-label="MicronHub home" className="home-page__wordmark" to="/">
            MicronHub
          </Link>
          <span className="home-page__tagline">Particle Engineering</span>
        </div>
        <nav className="home-page__navigation">
          <Link to="/technology">Technology</Link>
          <Link to="/applications">Applications</Link>
          <Link to="/company">About</Link>
          <span aria-hidden="true" className="home-page__menu"><i /><i /></span>
        </nav>
      </div>

      <div aria-hidden="true" className="home-page__glow" />

      <div aria-hidden="true" className="home-page__material">
        <div className="home-page__material-image">
          {reducedMotion ? (
            <img alt="" src="/assets/home-material-crystal.png" />
          ) : (
            <HomeMaterialField introProgress={progress} />
          )}
        </div>
      </div>

      <div className="home-page__copy" ref={copyRef}>
        <span aria-hidden="true" className="home-page__rule" />
        <h1><span className="home-page__emphasis">ONE</span> TECHNOLOGY<br />PLATFORM. <span className="home-page__emphasis">MANY</span> ENGINEERED<br />OUTCOMES.</h1>
        <p>We engineer the particle state the next process step requires.</p>
      </div>

      <nav aria-label="Applications" className="home-page__applications">
        <Link className="home-page__applications-link home-page__applications-link--water" to="/water">Water</Link>
        <Link className="home-page__applications-link home-page__applications-link--rubber" to="/applications">Rubber</Link>
        <Link className="home-page__applications-link home-page__applications-link--ceramics" to="/applications">Ceramics</Link>
        <Link className="home-page__applications-link home-page__applications-link--rare-earth" to="/applications">Rare Earth</Link>
        <Link className="home-page__applications-link home-page__applications-link--emerging" to="/applications">Emerging Applications</Link>
      </nav>

      <div aria-hidden="true" className="home-page__scroll">
        <span />
        <b>Scroll</b>
        <i />
      </div>
    </section>
  )
}
