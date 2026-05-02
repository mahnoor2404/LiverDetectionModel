import Link from 'next/link'
import { Upload, BarChart2, Shield, Zap, FileSearch, CheckCircle } from 'lucide-react'

const steps = [
  {
    icon: Upload,
    title: 'Upload CT Scan',
    desc: 'Upload a NIfTI volume (.nii / .nii.gz) or a single CT image (.jpg / .png).',
  },
  {
    icon: FileSearch,
    title: 'AI Analysis',
    desc: 'ResNet18 analyzes every slice of the volume using the 70% / 11% detection logic.',
  },
  {
    icon: CheckCircle,
    title: 'Instant Result',
    desc: 'Receive a detailed prediction with confidence score, affected ratio, and decision reason.',
  },
]

const stats = [
  { label: 'Model',     value: 'ResNet18' },
  { label: 'Dataset',   value: 'LiTS' },
  { label: 'Input',     value: 'NIfTI / Image' },
  { label: 'Detection', value: '70% / 11% Logic' },
]

export default function HomePage() {
  return (
    <div className="flex flex-col">

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block bg-blue-600/40 border border-blue-400/30 text-blue-200 text-xs font-semibold px-3 py-1 rounded-full mb-6 tracking-wide uppercase">
            Deep Learning · Medical Imaging
          </span>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            AI-Powered<br />
            <span className="text-blue-300">Liver Tumor Detection</span>
          </h1>
          <p className="text-blue-100 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            Upload CT scans and get instant, accurate predictions powered by a fine-tuned
            ResNet18 model trained on the LiTS dataset.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/scan"
              className="inline-flex items-center gap-2 bg-white text-blue-800 font-semibold px-8 py-3.5 rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
            >
              <Upload className="w-5 h-5" />
              Start Analysis
            </Link>
            <Link
              href="/metrics"
              className="inline-flex items-center gap-2 bg-blue-600/30 border border-blue-400/40 text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-blue-600/50 transition-colors"
            >
              <BarChart2 className="w-5 h-5" />
              View Metrics
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-sm font-semibold text-blue-700">{value}</div>
              <div className="text-xs text-slate-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-800 text-center mb-2">How It Works</h2>
          <p className="text-slate-500 text-center mb-12 text-sm">Three simple steps to get your result</p>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 text-center">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-6 h-6 text-blue-700" />
                </div>
                <div className="text-xs text-blue-500 font-bold mb-1">STEP {i + 1}</div>
                <h3 className="font-semibold text-slate-800 mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
          {[
            { icon: Zap,    title: 'Fast Inference',     desc: 'Processes full NIfTI volumes with all slices in seconds.' },
            { icon: Shield, title: 'Intelligent Logic',  desc: '70% slice threshold + 11% affected ratio — same logic as the research model.' },
            { icon: BarChart2, title: 'Evaluation Tracking', desc: 'Submit ground truth and track accuracy, F1, confusion matrix in real time.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-4">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex-shrink-0 flex items-center justify-center">
                <Icon className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-1 text-sm">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-blue-800 text-white text-center">
        <h2 className="text-2xl font-bold mb-3">Ready to analyze a scan?</h2>
        <p className="text-blue-200 mb-8 text-sm">Upload your CT scan and get results in seconds.</p>
        <Link
          href="/scan"
          className="inline-flex items-center gap-2 bg-white text-blue-800 font-semibold px-8 py-3.5 rounded-xl hover:bg-blue-50 transition-colors"
        >
          <Upload className="w-5 h-5" />
          Upload CT Scan
        </Link>
      </section>

    </div>
  )
}
