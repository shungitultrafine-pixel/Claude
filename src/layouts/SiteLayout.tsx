import { Outlet, useLocation } from 'react-router'
import { Header } from '../components/Header'

export function SiteLayout() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="site-shell">
      {!isHome && <Header />}
      <main className={isHome ? 'site-main site-main--home' : 'site-main'} key={location.pathname}>
        <Outlet />
      </main>
    </div>
  )
}
