'use client'

import { useEffect, useState } from 'react'
import UploadForm from '../components/UploadForm'
import OutputDisplay from '../components/OutputDisplay'
import SessionHistory from '../components/SessionHistory'
import SopChat from '../components/SopChat'

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
  const [bulkResults, setBulkResults] = useState([])
  const [resultMeta, setResultMeta] = useState({ difficulty: 'intermediate' })
  const [sessionId, setSessionId] = useState('')
  const [chatSessionId, setChatSessionId] = useState('')
  const [unlockedChatSessions, setUnlockedChatSessions] = useState({})
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const key = 'sop_training_session_id'
    const existing = window.localStorage.getItem(key)

    if (existing && /^[A-Za-z0-9]{8}$/.test(existing)) {
      setSessionId(existing)
      setChatSessionId(existing)
      return
    }

    const generated = generateSessionId()
    window.localStorage.setItem(key, generated)
    setSessionId(generated)
    setChatSessionId(generated)
  }, [])

  useEffect(() => {
    const loadSessionAvailability = async () => {
      if (!/^[A-Za-z0-9]{8}$/.test(sessionId || '')) {
        return
      }

      try {
        const res = await fetch(`/api/backend/history/${sessionId}`)
        if (!res.ok) {
          return
        }
        const payload = await res.json()
        const hasHistory = Array.isArray(payload?.history) && payload.history.length > 0
        if (hasHistory) {
          setUnlockedChatSessions((prev) => ({ ...prev, [sessionId]: true }))
        }
      } catch {
        // Ignore history lookup issues on initial load.
      }
    }

    loadSessionAvailability()
  }, [sessionId])

  const unlockChatForSession = (targetSessionId) => {
    if (!/^[A-Za-z0-9]{8}$/.test(targetSessionId || '')) {
      return
    }
    setUnlockedChatSessions((prev) => ({ ...prev, [targetSessionId]: true }))
  }

  const copySessionId = async () => {
    if (!sessionId) {
      return
    }

    try {
      await navigator.clipboard.writeText(sessionId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-7 rounded-2xl border border-line bg-panel p-6 shadow-panel">
        <p className="text-xs uppercase tracking-[0.18em] text-textMuted">Training Automation</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight">SOP AI Training System</h1>
        <p className="mt-2 max-w-2xl text-sm text-textMuted">
          Convert SOP documents into structured summaries, practical training steps, and quiz questions for team onboarding.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-line bg-panelSoft px-3 py-2 text-xs text-textMuted">
            <span>Session ID</span>
            <span className="font-semibold tracking-[0.1em] text-textMain">{sessionId || 'Generating...'}</span>
          </div>
          <button
            type="button"
            onClick={copySessionId}
            className="rounded-lg border border-line bg-[#22252b] px-3 py-2 text-xs font-medium text-textMain transition hover:bg-[#2a2e35]"
          >
            {copied ? 'Copied' : 'Copy Session ID'}
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-panelSoft px-3 py-2 text-xs text-textMuted">1. Add SOP input</div>
          <div className="rounded-lg border border-line bg-panelSoft px-3 py-2 text-xs text-textMuted">2. Generate training output</div>
          <div className="rounded-lg border border-line bg-panelSoft px-3 py-2 text-xs text-textMuted">3. Ask follow-up questions</div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <UploadForm
            setResult={setResult}
            setBulkResults={setBulkResults}
            sessionId={sessionId}
            onResultMeta={setResultMeta}
            onUnlockChat={unlockChatForSession}
          />
          <OutputDisplay
            result={result}
            bulkResults={bulkResults}
            sessionId={sessionId}
            difficulty={resultMeta.difficulty}
          />
        </div>
        <div className="space-y-6 lg:col-span-5">
          <SopChat
            sessionId={chatSessionId || sessionId}
            currentSessionId={sessionId}
            onSwitchToCurrentSession={() => setChatSessionId(sessionId)}
            isLocked={!unlockedChatSessions[chatSessionId || sessionId]}
            lockMessage="Process at least one SOP first. Chat unlocks only after successful SOP extraction and AI generation."
          />
          <SessionHistory
            activeChatSessionId={chatSessionId || sessionId}
            onSelectSessionForChat={(selectedSessionId, hasHistory) => {
              setChatSessionId(selectedSessionId)
              if (hasHistory) {
                unlockChatForSession(selectedSessionId)
              }
            }}
          />
        </div>
      </section>
    </main>
  )
}
