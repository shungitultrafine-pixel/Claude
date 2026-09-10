import { useEffect, useState } from 'react'
import { HomeMaterialField } from '../experience/HomeMaterialField'
import './home-page.css'

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

  return (
    <section aria-label="MicronHub" className="home-page">
      <div aria-label="Primary navigation" className="home-page__header">
        <div className="home-page__brand">
          <a aria-label="MicronHub home" className="home-page__wordmark" href="/">MicronHub</a>
          <span className="home-page__tagline">Particle Engineering</span>
        </div>
        <nav className="home-page__navigation">
          <a href="/technology">Technology</a>
          <a href="/applications">Applications</a>
          <a href="/company">About</a>
          <span aria-hidden="true" className="home-page__menu"><i /><i /></span>
        </nav>
      </div>

      <div aria-hidden="true" className="home-page__glow" />

      <div aria-hidden="true" className="home-page__material">
        <div className="home-page__material-image">
          {reducedMotion ? <img alt="" src="/assets/home-material-crystal.png" /> : <HomeMaterialField />}
        </div>
      </div>

      <div className="home-page__copy">
        <span aria-hidden="true" className="home-page__rule" />
        <h1><span className="home-page__emphasis">ONE</span> TECHNOLOGY<br />PLATFORM. <span className="home-page__emphasis">MANY</span> ENGINEERED<br />OUTCOMES.</h1>
        <p>We engineer the particle state the next process step requires.</p>
      </div>

      <nav aria-label="Applications" className="home-page__applications">
        <a className="home-page__applications-link home-page__applications-link--water" href="/water">Water</a>
        <a className="home-page__applications-link home-page__applications-link--rubber" href="/applications">Rubber</a>
        <a className="home-page__applications-link home-page__applications-link--ceramics" href="/applications">Ceramics</a>
        <a className="home-page__applications-link home-page__applications-link--rare-earth" href="/applications">Rare Earth</a>
        <a className="home-page__applications-link home-page__applications-link--emerging" href="/applications">Emerging Applications</a>
      </nav>

      <div aria-hidden="true" className="home-page__scroll">
        <span />
        <b>Scroll</b>
        <i />
      </div>
    </section>
  )
}
