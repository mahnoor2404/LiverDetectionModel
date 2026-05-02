'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Trash2, Loader2, BarChart2, AlertCircle } from 'lucide-react'
import { getMetrics, resetEvaluation } from '@/lib/api'
import { getPersonalMetrics } from '@/lib/firestore'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import type { MetricsData } from '@/lib/types'

interface MetricCardProps { label: string; value: number; color: string }

function MetricCard({ label, value, color }: MetricCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className={`text-3xl font-bold mb-1 ${color}`}>
        {value.toFixed(1)}<span className="text-lg">%</span>
      </div>
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color.replace('text-', 'bg-')}`}
          style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  )
}

const metricConfig = [
  { key: 'accuracy',    label: 'Accuracy',    color: 'text-blue-600' },
  { key: 'precision',   label: 'Precision',   color: 'text-violet-600' },
  { key: 'recall',      label: 'Recall',      color: 'text-emerald-600' },
  { key: 'specificity', label: 'Specificity', color: 'text-amber-600' },
  { key: 'f1_score',    label: 'F1 Score',    color: 'text-rose-600' },
]

export default function MetricsPage() {
  const { user, loading: authLoading } = useRequireAuth()
  const [apiMetrics,      setApiMetrics]      = useState<MetricsData | null>(null)
  const [personalMetrics, setPersonalMetrics] = useState<MetricsData | null>(null)
  const [activeTab, setActiveTab] = useState<'personal' | 'global'>('personal')
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const [api, personal] = await Promise.all([
        getMetrics().catch(() => null),
        getPersonalMetrics(user.uid),
      ])
      if (api?.success) setApiMetrics(api.metrics)
      setPersonalMetrics(personal)
    } catch {
      setError('Failed to load metrics.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleReset = async () => {
    if (!confirm('Reset global API evaluation data? This cannot be undone.')) return
    setResetting(true)
    await resetEvaluation()
    await fetchAll()
    setResetting(false)
  }

  const metrics = activeTab === 'personal' ? personalMetrics : apiMetrics

  if (authLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto w-full px-4 py-12">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Performance Metrics</h1>
          <p className="text-slate-500 text-sm">Evaluation based on submitted ground truth.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAll} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 shadow-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {activeTab === 'global' && (
            <button onClick={handleReset} disabled={resetting}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 hover:bg-red-100 shadow-sm">
              {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['personal', 'global'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-blue-700 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}>
            {tab === 'personal' ? 'My Metrics (Firestore)' : 'Global Metrics (API)'}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      ) : !metrics || metrics.total_samples === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
          <BarChart2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No evaluations yet.</p>
          <p className="text-slate-400 text-xs mt-1">
            Run a scan and submit ground truth to populate metrics.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 text-sm text-blue-700 font-medium">
            Based on <strong>{metrics.total_samples}</strong> evaluated sample{metrics.total_samples !== 1 ? 's' : ''}
            {activeTab === 'personal' && ' from your history'}
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {metricConfig.map(({ key, label, color }) => (
              <MetricCard key={key} label={label}
                value={metrics[key as keyof MetricsData] as number} color={color} />
            ))}
          </div>

          {/* Confusion matrix */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="font-semibold text-slate-800 mb-4">Confusion Matrix</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="border border-slate-200 p-3 bg-slate-50 text-slate-500 font-medium text-xs" />
                    <th className="border border-slate-200 p-3 bg-slate-50 text-slate-600 font-semibold text-xs">Predicted Tumor</th>
                    <th className="border border-slate-200 p-3 bg-slate-50 text-slate-600 font-semibold text-xs">Predicted Non-Tumor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-200 p-3 bg-slate-50 text-slate-600 font-semibold text-xs">Actual Tumor</td>
                    <td className="border border-slate-200 p-4 text-center bg-emerald-50">
                      <div className="text-2xl font-bold text-emerald-700">{metrics.true_positives}</div>
                      <div className="text-xs text-emerald-500 font-medium">TP</div>
                    </td>
                    <td className="border border-slate-200 p-4 text-center bg-red-50">
                      <div className="text-2xl font-bold text-red-600">{metrics.false_negatives}</div>
                      <div className="text-xs text-red-400 font-medium">FN</div>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-200 p-3 bg-slate-50 text-slate-600 font-semibold text-xs">Actual Non-Tumor</td>
                    <td className="border border-slate-200 p-4 text-center bg-red-50">
                      <div className="text-2xl font-bold text-red-600">{metrics.false_positives}</div>
                      <div className="text-xs text-red-400 font-medium">FP</div>
                    </td>
                    <td className="border border-slate-200 p-4 text-center bg-emerald-50">
                      <div className="text-2xl font-bold text-emerald-700">{metrics.true_negatives}</div>
                      <div className="text-xs text-emerald-500 font-medium">TN</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {[
                { label: 'True Positive',  sub: 'Correct tumor',   count: metrics.true_positives,  bg: 'bg-emerald-50', text: 'text-emerald-700' },
                { label: 'True Negative',  sub: 'Correct healthy', count: metrics.true_negatives,  bg: 'bg-emerald-50', text: 'text-emerald-700' },
                { label: 'False Positive', sub: 'Healthy → Tumor', count: metrics.false_positives, bg: 'bg-red-50',     text: 'text-red-600' },
                { label: 'False Negative', sub: 'Tumor → Healthy', count: metrics.false_negatives, bg: 'bg-red-50',     text: 'text-red-600' },
              ].map(({ label, sub, count, bg, text }) => (
                <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                  <div className={`text-xl font-bold ${text}`}>{count}</div>
                  <div className={`text-xs font-medium ${text}`}>{label}</div>
                  <div className="text-xs text-slate-400">{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
