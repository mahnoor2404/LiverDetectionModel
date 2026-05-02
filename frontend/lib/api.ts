import type { PredictionResult, MetricsData } from './types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export async function predictScan(file: File): Promise<PredictionResult> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${BASE_URL}/predict`, { method: 'POST', body: fd })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? 'Prediction failed')
  }
  return res.json()
}

export async function submitEvaluation(
  filename: string,
  predictedClass: string,
  actualClass: string,
  confidence: number,
  slicesAnalyzed?: number,
  affectedRatio?: string
): Promise<{ success: boolean }> {
  const fd = new FormData()
  fd.append('filename', filename)
  fd.append('predicted_class', predictedClass)
  fd.append('actual_class', actualClass)
  fd.append('confidence', confidence.toString())
  if (slicesAnalyzed) fd.append('slices_analyzed', slicesAnalyzed.toString())
  if (affectedRatio) fd.append('affected_ratio', affectedRatio)
  const res = await fetch(`${BASE_URL}/evaluate`, { method: 'POST', body: fd })
  return res.json()
}

export async function getMetrics(): Promise<{ success: boolean; metrics: MetricsData }> {
  const res = await fetch(`${BASE_URL}/metrics`)
  return res.json()
}

export async function resetEvaluation(): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE_URL}/reset_evaluation`, { method: 'POST' })
  return res.json()
}

export async function checkHealth(): Promise<{ status: string }> {
  const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(5000) })
  return res.json()
}
