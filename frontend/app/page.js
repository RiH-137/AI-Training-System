'use client'

import { useEffect, useState } from 'react'
import UploadForm from '../components/UploadForm'
import OutputDisplay from '../components/OutputDisplay'
import SessionHistory from '../components/SessionHistory'

function generateSessionId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let sessionId = ''
  for (let i = 0; i < 8; i += 1) {
    sessionId += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return sessionId
}

export default function HomePage() {
  const [result, setResult] = useState(null)
  const [sessionId, setSessionId] = useState('')

  useEffect(() => {
    const key = 'sop_training_session_id'
    const existing = window.localStorage.getItem(key)

    if (existing && /^[A-Za-z0-9]{8}$/.test(existing)) {
      setSessionId(existing)
      return
    }

    const generated = generateSessionId()
    window.localStorage.setItem(key, generated)
    setSessionId(generated)
  }, [])

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-7 rounded-2xl border border-line bg-panel p-6 shadow-panel">
        <p className="text-xs uppercase tracking-[0.18em] text-textMuted">Training Automation</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight">SOP AI Training System</h1>
        <p className="mt-2 max-w-2xl text-sm text-textMuted">
          Convert SOP documents into structured summaries, practical training steps, and quiz questions for team onboarding.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line bg-panelSoft px-3 py-2 text-xs text-textMuted">
          <span>Session ID</span>
          <span className="font-semibold tracking-[0.1em] text-textMain">{sessionId || 'Generating...'}</span>
        </div>
      </header>

      <UploadForm setResult={setResult} sessionId={sessionId} />
      <OutputDisplay result={result} />
      <SessionHistory />
    </main>
  )
}
