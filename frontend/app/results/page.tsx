'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ScanLine, BarChart2, Loader2, ChevronRight, Info } from 'lucide-react'
import { submitEvaluation } from '@/lib/api'
import { saveEvaluation } from '@/lib/firestore'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import type { PredictionResult } from '@/lib/types'

export default function ResultsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useRequireAuth()
  const [result, setResult]   = useState<PredictionResult | null>(null)
  const [filename, setFilename] = useState('')
  const [scanId, setScanId]   = useState('')
  const [actualClass, setActualClass] = useState<'tumor' | 'non-tumor' | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem('liver_result')
    const fn  = sessionStorage.getItem('liver_filename') ?? ''
    const sid = sessionStorage.getItem('liver_scan_id')  ?? ''
    if (!raw) { router.replace('/scan'); return }
    setResult(JSON.parse(raw))
    setFilename(fn)
    setScanId(sid)
  }, [router])

  const isTumor    = result?.result_class === 'tumor'
  const confidence = result?.tumor_probability ?? 0

  const handleSubmit = async () => {
    if (!result || !actualClass) return
    setSubmitting(true)
    try {
      await Promise.all([
        submitEvaluation(filename, result.result_class, actualClass, confidence, result.slices_analyzed, result.affected_ratio),
        scanId ? saveEvaluation(scanId, actualClass, result.result_class) : Promise.resolve(),
      ])
      setSubmitted(true)
    } catch {
      // evaluation is best-effort; silently ignore network/API errors
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || !result) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-12 animate-fade-up">

      {/* Result card */}
      <div className={`rounded-2xl border-2 p-8 text-center mb-6 ${isTumor ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isTumor ? 'bg-red-100' : 'bg-emerald-100'}`}>
          {isTumor
            ? <AlertTriangle className="w-8 h-8 text-red-600" />
            : <CheckCircle2 className="w-8 h-8 text-emerald-600" />}
        </div>
        <h1 className={`text-2xl font-bold mb-1 ${isTumor ? 'text-red-700' : 'text-emerald-700'}`}>
          {result.prediction}
        </h1>
        {filename && <p className="text-sm text-slate-400 mb-6">{filename}</p>}

        {/* Confidence bar */}
        <div className="text-left">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>Confidence Score</span>
            <span className="font-semibold">{confidence.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-white rounded-full overflow-hidden border border-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-700 ${isTumor ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      {result.slices_analyzed && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Slices Analyzed', value: result.slices_analyzed },
            { label: 'Affected Slices', value: result.affected_slices ?? '—' },
            { label: 'Affected Ratio',  value: result.affected_ratio  ?? '—' },
            { label: 'Max Probability', value: result.max_probability != null ? `${(result.max_probability * 100).toFixed(1)}%` : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 text-center shadow-sm">
              <div className="text-lg font-bold text-slate-800">{value}</div>
              <div className="text-xs text-slate-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Decision reason */}
      {result.decision_reason && (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 mb-6 flex items-start gap-3 text-sm text-slate-600 shadow-sm">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          {result.decision_reason}
        </div>
      )}

      {/* Ground truth */}
      {!submitted ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-1 text-sm">Was this prediction correct?</h2>
          <p className="text-xs text-slate-400 mb-4">Your feedback is saved to your history and improves evaluation metrics.</p>
          <div className="flex gap-3 mb-5">
            {(['tumor', 'non-tumor'] as const).map(cls => (
              <button key={cls} onClick={() => setActualClass(cls)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  actualClass === cls
                    ? cls === 'tumor' ? 'bg-red-50 border-red-400 text-red-700' : 'bg-emerald-50 border-emerald-400 text-emerald-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}>
                {cls === 'tumor' ? 'Yes, it is a Tumor' : 'No, it is Healthy'}
              </button>
            ))}
          </div>
          <button onClick={handleSubmit} disabled={!actualClass || submitting}
            className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit Feedback
          </button>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6 text-center text-emerald-700 text-sm font-medium animate-fade-up">
          <CheckCircle2 className="w-5 h-5 mx-auto mb-1" />
          Feedback recorded — saved to your history and metrics updated.
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Link href="/scan"
          className="flex-1 flex items-center justify-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium py-3 rounded-xl transition-colors text-sm">
          <ScanLine className="w-4 h-4" />
          New Scan
        </Link>
        <Link href="/metrics"
          className="flex-1 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-medium py-3 rounded-xl transition-colors text-sm">
          <BarChart2 className="w-4 h-4" />
          View Metrics
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

    </div>
  )
}
