import { NavLink, Outlet, useLocation } from 'react-router-dom'
import logo from '/logo.png' // or '@/assets/logo.png'

export default function App() {
  const { pathname } = useLocation()
  const isLanding = pathname === '/'

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {!isLanding && (
        <nav className="sticky top-0 z-50 backdrop-blur-xs bg-white/75 border-b border-black/5">
          <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 grid place-items-center rounded-xl bg-[rgb(var(--brand))]/10">
                <img
                  src={logo}
                  alt="QML Compare"
                  className="h-6 w-6 object-contain logo-glow"
                  draggable={false}
                />
              </div>
              <span className="font-extrabold tracking-tight">QML Compare</span>
            </div>

            <div className="flex items-center gap-2">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium hover:bg-black/5 ${
                    isActive ? 'ring-2 ring-indigo-200' : ''
                  }`
                }
              >
                Home
              </NavLink>

              <NavLink
                to="/compare"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium hover:bg-black/5 ${
                    isActive ? 'ring-2 ring-indigo-200' : ''
                  }`
                }
              >
                Compare
              </NavLink>
            </div>
          </div>
        </nav>
      )}

      <main className="flex-1">
        <Outlet />
      </main>

      {!isLanding && (
        <footer className="border-t border-black/5">
          <div className="mx-auto max-w-7xl px-6 py-8 text-sm text-gray-600 text-center">
            © {new Date().getFullYear()} QML Compare
          </div>
        </footer>
      )}
    </div>
  )
}
