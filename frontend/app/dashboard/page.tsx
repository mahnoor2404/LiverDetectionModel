'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ScanLine, BarChart2, History, TrendingUp, CheckCircle2, AlertTriangle, ClipboardList, Loader2 } from 'lucide-react'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { getScanHistory } from '@/lib/firestore'
import type { ScanRecord } from '@/lib/types'

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useRequireAuth()
  const [scans, setScans]   = useState<ScanRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getScanHistory(user.uid)
      .then(setScans)
      .finally(() => setLoading(false))
  }, [user])

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    )
  }

  const tumors    = scans.filter(s => s.result.result_class === 'tumor').length
  const healthy   = scans.filter(s => s.result.result_class === 'non-tumor').length
  const evaluated = scans.filter(s => s.evaluation).length
  const recent    = scans.slice(0, 5)

  const role = profile?.role
    ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
    : 'Doctor'

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-10">

      {/* Header */}
      <div className="mb-8">
        <p className="text-sm text-blue-600 font-medium mb-1">{role}</p>
        <h1 className="text-2xl font-bold text-slate-800">
          Welcome back, {profile?.name ?? user?.email}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Here is an overview of your liver scan activity.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Total Scans"       value={scans.length}  icon={ClipboardList} color="bg-blue-600" />
        <StatCard label="Tumors Detected"   value={tumors}         icon={AlertTriangle} color="bg-red-500" />
        <StatCard label="Healthy Results"   value={healthy}        icon={CheckCircle2}  color="bg-emerald-600" />
        <StatCard label="Evaluated"         value={evaluated}      icon={TrendingUp}    color="bg-violet-600"
          sub={scans.length > 0 ? `${Math.round((evaluated / scans.length) * 100)}% of scans` : undefined} />
      </div>

      {/* Quick actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-10">
        {[
          { href: '/scan',    icon: ScanLine,  label: 'New Scan',      desc: 'Upload a CT scan for analysis',    bg: 'bg-blue-700 text-white' },
          { href: '/history', icon: History,   label: 'Scan History',  desc: 'View all your past scan results',  bg: 'bg-white border border-slate-200 text-slate-700' },
          { href: '/metrics', icon: BarChart2, label: 'Metrics',       desc: 'View accuracy and F1 performance', bg: 'bg-white border border-slate-200 text-slate-700' },
        ].map(({ href, icon: Icon, label, desc, bg }) => (
          <Link key={href} href={href}
            className={`${bg} rounded-2xl p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg.includes('blue-700') ? 'bg-white/20' : 'bg-blue-50'}`}>
              <Icon className={`w-5 h-5 ${bg.includes('blue-700') ? 'text-white' : 'text-blue-600'}`} />
            </div>
            <div>
              <div className="font-semibold text-sm">{label}</div>
              <div className={`text-xs mt-0.5 ${bg.includes('blue-700') ? 'text-blue-200' : 'text-slate-400'}`}>{desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent scans */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Recent Scans</h2>
          <Link href="/history" className="text-xs text-blue-600 hover:underline">View all</Link>
        </div>

        {recent.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            <ScanLine className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            No scans yet.{' '}
            <Link href="/scan" className="text-blue-600 hover:underline">Upload your first scan</Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recent.map(scan => (
              <div key={scan.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${scan.result.result_class === 'tumor' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{scan.filename}</p>
                  <p className="text-xs text-slate-400">
                    {scan.timestamp.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}
                    {scan.fileType === 'nifti' ? 'NIfTI Volume' : 'CT Image'}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  scan.result.result_class === 'tumor'
                    ? 'bg-red-50 text-red-600'
                    : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {scan.result.result_class === 'tumor' ? 'Tumor' : 'Healthy'}
                </span>
                <span className="text-sm text-slate-500 font-medium w-14 text-right">
                  {scan.result.tumor_probability.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
