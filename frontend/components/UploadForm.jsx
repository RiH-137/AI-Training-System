'use client'

import { useState } from 'react'
import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'

export default function UploadForm({ setResult }) {
  const [mode, setMode] = useState('upload')
  const [file, setFile] = useState(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')

    if (mode === 'upload' && !file) {
      setError('Please upload a PDF file.')
      return
    }

    if (mode === 'paste' && text.trim().length < 20) {
      setError('Please paste at least 20 characters of SOP text.')
      return
    }

    const formData = new FormData()
    if (mode === 'upload' && file) {
      formData.append('file', file)
    }
    if (mode === 'paste' && text.trim()) {
      formData.append('text', text.trim())
    }

    try {
      setLoading(true)
      const res = await axios.post(`${API_BASE_URL}/process`, formData)
      setResult(res.data.result)
    } catch (err) {
      const message = err?.response?.data?.error || 'Failed to process SOP. Please try again.'
      setError(message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-6 shadow-panel">
      <h2 className="text-lg font-semibold tracking-wide">Input SOP</h2>

      <div className="mt-4 grid gap-4">
        <div className="inline-flex w-fit rounded-lg border border-line bg-panelSoft p-1">
          <button
            type="button"
            onClick={() => {
              setMode('upload')
              setError('')
            }}
            className={`rounded-md px-4 py-2 text-sm transition ${
              mode === 'upload' ? 'bg-[#2a2e35] text-textMain' : 'text-textMuted hover:text-textMain'
            }`}
          >
            Upload PDF
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('paste')
              setError('')
            }}
            className={`rounded-md px-4 py-2 text-sm transition ${
              mode === 'paste' ? 'bg-[#2a2e35] text-textMain' : 'text-textMuted hover:text-textMain'
            }`}
          >
            Paste SOP
          </button>
        </div>

        {mode === 'upload' ? (
          <>
            <label className="text-sm text-textMuted">Upload SOP PDF</label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="rounded-lg border border-line bg-panelSoft px-3 py-2 text-sm text-textMuted file:mr-3 file:rounded-md file:border-0 file:bg-[#24282f] file:px-3 file:py-1.5 file:text-sm file:text-textMain hover:file:bg-[#2b3038]"
            />
            {file ? <p className="text-xs text-textMuted">Selected: {file.name}</p> : null}
          </>
        ) : (
          <>
            <label className="text-sm text-textMuted">Paste SOP text</label>
            <textarea
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste SOP content here..."
              className="w-full rounded-lg border border-line bg-panelSoft px-3 py-2 text-sm text-textMain outline-none transition focus:border-accent"
            />
          </>
        )}

        {error ? <p className="text-sm text-[#d6a8a8]">{error}</p> : null}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="mt-1 w-fit rounded-lg border border-line bg-[#22252b] px-5 py-2 text-sm font-medium text-textMain transition hover:bg-[#2a2e35] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? 'Processing...' : 'Process SOP'}
        </button>
      </div>
    </section>
  )
}
