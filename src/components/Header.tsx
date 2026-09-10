import { useState } from 'react'
import { NavLink } from 'react-router'
import { siteRoutes } from '../routes/siteRoutes'

export function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const closeMenu = () => setIsOpen(false)

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <NavLink aria-label="MicronHub home" className="wordmark" onClick={closeMenu} to="/">
          MicronHub
        </NavLink>
        <button
          aria-controls="primary-navigation"
          aria-expanded={isOpen}
          className="nav-toggle"
          onClick={() => setIsOpen((open) => !open)}
          type="button"
        >
          <span className="sr-only">Toggle navigation</span>
          <span aria-hidden="true" className="nav-toggle__line" />
          <span aria-hidden="true" className="nav-toggle__line" />
        </button>
        <nav aria-label="Primary" className={isOpen ? 'primary-nav is-open' : 'primary-nav'} id="primary-navigation">
          <ul>
            {siteRoutes.map(({ label, path }) => (
              <li key={path}>
                <NavLink end={path === '/'} onClick={closeMenu} to={path}>
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
