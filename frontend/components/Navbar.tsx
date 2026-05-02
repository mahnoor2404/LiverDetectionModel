'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Activity, BarChart2, ScanLine, LayoutDashboard, History, LogOut, ChevronDown } from 'lucide-react'
import { checkHealth } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

const publicLinks  = [{ href: '/', label: 'Home' }]
const privateLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/scan',      label: 'New Scan',  icon: ScanLine },
  { href: '/history',   label: 'History',   icon: History },
  { href: '/metrics',   label: 'Metrics',   icon: BarChart2 },
]

export default function Navbar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, profile, signOut } = useAuth()
  const [apiUp, setApiUp]         = useState<boolean | null>(null)
  const [menuOpen, setMenuOpen]   = useState(false)

  useEffect(() => {
    checkHealth()
      .then(() => setApiUp(true))
      .catch(() => setApiUp(false))
  }, [])

  // All hooks above — early return is safe here
  if (pathname === '/login' || pathname === '/register') return null

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  const initials = profile?.name
    ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0].toUpperCase() ?? '?'

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2 font-bold text-blue-800 text-lg">
          <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          LiverDetect <span className="text-blue-500 font-light">AI</span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {user ? (
            privateLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link key={href} href={href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}>
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              )
            })
          ) : (
            publicLinks.map(({ href, label }) => (
              <Link key={href} href={href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === href ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}>
                {label}
              </Link>
            ))
          )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">

          {/* API status */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
            <span className={`w-1.5 h-1.5 rounded-full ${
              apiUp === null ? 'bg-slate-300' : apiUp ? 'bg-emerald-500 animate-pulse-dot' : 'bg-red-500'
            }`} />
            {apiUp === null ? 'Checking…' : apiUp ? 'API Online' : 'API Offline'}
          </div>

          {user ? (
            /* User menu */
            <div className="relative">
              <button onClick={() => setMenuOpen(o => !o)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors">
                <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold">
                  {initials}
                </div>
                <span className="hidden sm:block text-sm font-medium text-slate-700 max-w-[120px] truncate">
                  {profile?.name ?? user.email}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50"
                  onMouseLeave={() => setMenuOpen(false)}>
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-800 truncate">{profile?.name}</p>
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    {profile?.role && (
                      <span className="inline-block mt-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md capitalize">
                        {profile.role}
                      </span>
                    )}
                  </div>
                  <button onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login"
              className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
              Sign In
            </Link>
          )}
        </div>

      </div>
    </header>
  )
}
