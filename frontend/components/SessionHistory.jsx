'use client'

import { useState } from 'react'
import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'

export default function SessionHistory() {
  const [lookupSessionId, setLookupSessionId] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchHistory = async () => {
    setError('')
    setHistory([])

    const sessionId = lookupSessionId.trim()
    if (!/^[A-Za-z0-9]{8}$/.test(sessionId)) {
      setError('Enter a valid 8-character alphanumeric Session ID.')
      return
    }

    try {
      setLoading(true)
      const res = await axios.get(`${API_BASE_URL}/history/${sessionId}`)
      setHistory(Array.isArray(res.data?.history) ? res.data.history : [])
    } catch (err) {
      const message = err?.response?.data?.error || 'Failed to fetch session history.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-line bg-panel p-6 shadow-panel">
      <h2 className="text-lg font-semibold tracking-wide">Find Past Session History</h2>
      <p className="mt-1 text-sm text-textMuted">
        Enter an old Session ID to retrieve previous SOP runs.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          maxLength={8}
          value={lookupSessionId}
          onChange={(e) => setLookupSessionId(e.target.value.toUpperCase())}
          placeholder="e.g. A1B2C3D4"
          className="w-full rounded-lg border border-line bg-panelSoft px-3 py-2 text-sm text-textMain outline-none transition focus:border-accent sm:max-w-xs"
        />
        <button
          type="button"
          onClick={fetchHistory}
          disabled={loading}
          className="w-fit rounded-lg border border-line bg-[#22252b] px-5 py-2 text-sm font-medium text-textMain transition hover:bg-[#2a2e35] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? 'Loading...' : 'Get History'}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-[#d6a8a8]">{error}</p> : null}

      {history.length > 0 ? (
        <div className="mt-5 grid gap-4">
          {history.map((item) => (
            <article key={item._id} className="rounded-lg border border-line bg-panelSoft p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-textMuted">
                <span>Source: {item.source_type?.toUpperCase() || 'N/A'}</span>
                <span>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</span>
              </div>
              <div className="mt-3 grid gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-textMuted">SOP Content</p>
                  <div className="mt-1 max-h-60 overflow-y-auto rounded-md border border-line bg-panel p-3">
                    <p className="whitespace-pre-wrap text-sm text-textMain">
                      {item.source_content || item.source_preview || 'No content available.'}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-textMuted">Generated Output</p>
                  <div className="mt-1 max-h-72 overflow-y-auto rounded-md border border-line bg-panel p-3">
                    <pre className="whitespace-pre-wrap text-sm text-textMain">
                      {JSON.stringify(item.result || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
