'use client'

import { useState } from 'react'
import UploadForm from '../components/UploadForm'
import OutputDisplay from '../components/OutputDisplay'

export default function HomePage() {
  const [result, setResult] = useState(null)

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-7 rounded-2xl border border-line bg-panel p-6 shadow-panel">
        <p className="text-xs uppercase tracking-[0.18em] text-textMuted">Training Automation</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight">SOP AI Training System</h1>
        <p className="mt-2 max-w-2xl text-sm text-textMuted">
          Convert SOP documents into structured summaries, practical training steps, and quiz questions for team onboarding.
        </p>
      </header>

      <UploadForm setResult={setResult} />
      <OutputDisplay result={result} />
    </main>
  )
}
