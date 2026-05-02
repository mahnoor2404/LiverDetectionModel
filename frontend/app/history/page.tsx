'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { ScanLine, Filter, Loader2, CheckCircle2, AlertTriangle, ClipboardCheck } from 'lucide-react'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { getScanHistory } from '@/lib/firestore'
import type { ScanRecord } from '@/lib/types'

type FilterType = 'all' | 'tumor' | 'non-tumor'

export default function HistoryPage() {
  const { user, loading: authLoading } = useRequireAuth()
  const [scans, setScans]     = useState<ScanRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<FilterType>('all')
  const [search, setSearch]   = useState('')

  useEffect(() => {
    if (!user) return
    getScanHistory(user.uid)
      .then(setScans)
      .finally(() => setLoading(false))
  }, [user])

  const filtered = useMemo(() => {
    return scans
      .filter(s => filter === 'all' || s.result.result_class === filter)
      .filter(s => search === '' || s.filename.toLowerCase().includes(search.toLowerCase()))
  }, [scans, filter, search])

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-10">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Scan History</h1>
          <p className="text-slate-500 text-sm mt-1">{scans.length} total scan{scans.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/scan"
          className="flex items-center gap-2 bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-blue-800 transition-colors">
          <ScanLine className="w-4 h-4" />
          New Scan
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by filename…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'tumor', 'non-tumor'] as FilterType[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === f
                  ? f === 'tumor' ? 'bg-red-100 text-red-700' : f === 'non-tumor' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                  : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}>
              {f === 'all' ? 'All' : f === 'tumor' ? 'Tumor' : 'Healthy'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            <ScanLine className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            {scans.length === 0 ? (
              <>No scans yet. <Link href="/scan" className="text-blue-600 hover:underline">Upload your first scan</Link></>
            ) : (
              'No scans match your filter.'
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <div className="col-span-4">File</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Result</div>
              <div className="col-span-1">Conf.</div>
              <div className="col-span-1 text-right">Eval</div>
            </div>

            <div className="divide-y divide-slate-100">
              {filtered.map(scan => (
                <div key={scan.id}
                  className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">

                  {/* Filename */}
                  <div className="col-span-4 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{scan.filename}</p>
                  </div>

                  {/* Date */}
                  <div className="col-span-2 text-xs text-slate-500">
                    {scan.timestamp.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </div>

                  {/* Type */}
                  <div className="col-span-2">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                      {scan.fileType === 'nifti' ? 'NIfTI' : 'Image'}
                    </span>
                  </div>

                  {/* Result */}
                  <div className="col-span-2">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      scan.result.result_class === 'tumor'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {scan.result.result_class === 'tumor'
                        ? <AlertTriangle className="w-3 h-3" />
                        : <CheckCircle2 className="w-3 h-3" />}
                      {scan.result.result_class === 'tumor' ? 'Tumor' : 'Healthy'}
                    </span>
                  </div>

                  {/* Confidence */}
                  <div className="col-span-1 text-sm font-medium text-slate-700">
                    {scan.result.tumor_probability.toFixed(1)}%
                  </div>

                  {/* Evaluated */}
                  <div className="col-span-1 flex justify-end">
                    {scan.evaluation ? (
                      <ClipboardCheck className="w-4 h-4 text-emerald-500" title="Evaluated" />
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </div>

                </div>
              ))}
            </div>
          </>
        )}
      </div>

    </div>
  )
}
