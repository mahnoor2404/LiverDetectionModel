'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileImage, X, Loader2, AlertCircle, Info } from 'lucide-react'
import { predictScan } from '@/lib/api'
import { saveScan } from '@/lib/firestore'
import { useRequireAuth } from '@/hooks/useRequireAuth'

const ACCEPTED = ['.nii', '.nii.gz', '.jpg', '.jpeg', '.png']

function isValidFile(file: File) {
  const name = file.name.toLowerCase()
  return ACCEPTED.some(ext => name.endsWith(ext))
}

export default function ScanPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useRequireAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile]       = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const handleFile = useCallback((f: File) => {
    setError(null)
    if (!isValidFile(f)) {
      setError('Unsupported file type. Please upload .nii, .nii.gz, .jpg, or .png')
      return
    }
    setFile(f)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const analyze = async () => {
    if (!file || !user) return
    setLoading(true)
    setError(null)
    try {
      const result = await predictScan(file)
      const scanId = await saveScan(user.uid, file.name, result)
      sessionStorage.setItem('liver_result',   JSON.stringify(result))
      sessionStorage.setItem('liver_filename', file.name)
      sessionStorage.setItem('liver_scan_id',  scanId)
      router.push('/results')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Is the API running?')
      setLoading(false)
    }
  }

  const isNifti = file?.name.toLowerCase().endsWith('.nii') || file?.name.toLowerCase().endsWith('.nii.gz')
  const sizeMB  = file ? (file.size / 1024 / 1024).toFixed(1) : null

  if (authLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-12">

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">Upload CT Scan</h1>
        <p className="text-slate-500 text-sm">
          Upload a NIfTI volume or CT image to run liver tumor detection.
        </p>
      </div>

      {/* Upload zone */}
      <div
        onClick={() => !loading && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
          dragging ? 'border-blue-500 bg-blue-50'
          : file    ? 'border-blue-300 bg-blue-50/40'
          :           'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/20'
        } ${loading ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input ref={inputRef} type="file" className="hidden"
          accept=".nii,.nii.gz,.jpg,.jpeg,.png"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

        {file ? (
          <div className="animate-fade-up">
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileImage className="w-7 h-7 text-blue-600" />
            </div>
            <p className="font-semibold text-slate-800">{file.name}</p>
            <p className="text-sm text-slate-500 mt-1">
              {isNifti ? 'NIfTI Volume' : 'CT Image'} &nbsp;·&nbsp; {sizeMB} MB
            </p>
            <button onClick={e => { e.stopPropagation(); setFile(null) }}
              className="mt-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors">
              <X className="w-3 h-3" /> Remove file
            </button>
          </div>
        ) : (
          <div>
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Upload className="w-7 h-7 text-slate-400" />
            </div>
            <p className="font-semibold text-slate-700">
              {dragging ? 'Drop your file here' : 'Click or drag & drop'}
            </p>
            <p className="text-sm text-slate-400 mt-1">NIfTI or CT image</p>
          </div>
        )}
      </div>

      {/* Formats */}
      <div className="mt-3 flex items-start gap-2 text-xs text-slate-400 px-1">
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <span>
          Supported: <strong>.nii</strong>, <strong>.nii.gz</strong> (full volume — recommended),{' '}
          <strong>.jpg</strong>, <strong>.jpeg</strong>, <strong>.png</strong> (single slice)
        </span>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm animate-fade-up">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {isNifti && (
        <div className="mt-4 flex items-start gap-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-4 py-3 text-sm animate-fade-up">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          NIfTI volume detected — all slices will be analyzed for maximum accuracy.
        </div>
      )}

      <button onClick={analyze} disabled={!file || loading}
        className="mt-6 w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors">
        {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing{isNifti ? ' all slices' : ''}…</>
                 : <><Upload className="w-5 h-5" /> Analyze Scan</>}
      </button>

      {loading && (
        <p className="text-center text-xs text-slate-400 mt-3 animate-pulse-dot">
          {isNifti ? 'Processing full volume — this may take 30–60 seconds…'
                   : 'Running inference on your image…'}
        </p>
      )}

    </div>
  )
}
