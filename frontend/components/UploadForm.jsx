'use client'

import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
const API_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || 120000)
const PROCESS_STAGES = ['Extracting text...', 'Analyzing SOP...', 'Generating training...', 'Generating quiz...']

export default function UploadForm({ setResult, setBulkResults, sessionId, onResultMeta, onUnlockChat }) {
  const [mode, setMode] = useState('upload')
  const [file, setFile] = useState(null)
  const [files, setFiles] = useState([])
  const [text, setText] = useState('')
  const [difficulty, setDifficulty] = useState('intermediate')
  const [employeeEmail, setEmployeeEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [isBulk, setIsBulk] = useState(false)
  const [stage, setStage] = useState('Waiting for input...')
  const [error, setError] = useState('')
  const [emailInfo, setEmailInfo] = useState('')

  const textDebounceRef = useRef(null)
  const stageIntervalRef = useRef(null)

  const textLength = text.trim().length
  const canUseSession = /^[A-Za-z0-9]{8}$/.test(sessionId || '')

  const clearStageInterval = () => {
    if (stageIntervalRef.current) {
      window.clearInterval(stageIntervalRef.current)
      stageIntervalRef.current = null
    }
  }

  const startStageInterval = () => {
    clearStageInterval()
    let index = 0
    setStage(PROCESS_STAGES[index])
    stageIntervalRef.current = window.setInterval(() => {
      index = (index + 1) % PROCESS_STAGES.length
      setStage(PROCESS_STAGES[index])
    }, 1300)
  }

  useEffect(() => {
    return () => {
      clearStageInterval()
      if (textDebounceRef.current) {
        window.clearTimeout(textDebounceRef.current)
      }
    }
  }, [])

  const sendEmailFromFrontend = async ({ recipientEmail, result, sourceName }) => {
    const email = (recipientEmail || '').trim()
    if (!email) {
      return false
    }

    try {
      const res = await axios.post('/api/send-training-email', {
        recipientEmail: email,
        result,
        difficulty,
        sourceName,
      })
      return Boolean(res.data?.ok)
    } catch {
      return false
    }
  }

  const processSingle = async ({ nextFile, nextText }) => {
    setError('')
    setEmailInfo('')

    if (!canUseSession) {
      setError('Session ID is initializing. Please try again in a moment.')
      return
    }

    if (mode === 'upload' && !nextFile) {
      setError('Please upload a PDF file.')
      return
    }

    if (mode === 'paste' && (nextText || '').trim().length < 20) {
      setError('Please paste at least 20 characters of SOP text.')
      return
    }

    const formData = new FormData()
    if (mode === 'upload' && nextFile) {
      formData.append('file', nextFile)
    }
    if (mode === 'paste' && (nextText || '').trim()) {
      formData.append('text', (nextText || '').trim())
    }
    formData.append('session_id', sessionId)
    formData.append('difficulty', difficulty)
    if (employeeEmail.trim()) {
      formData.append('employee_email', employeeEmail.trim())
    }

    try {
      setLoading(true)
      startStageInterval()
      const res = await axios.post(`${API_BASE_URL}/process`, formData, { timeout: API_TIMEOUT_MS })
      setResult(res.data.result)
      setBulkResults([])
      if (typeof onUnlockChat === 'function') {
        onUnlockChat(sessionId)
      }

      let emailSent = false
      if (employeeEmail.trim()) {
        emailSent = await sendEmailFromFrontend({
          recipientEmail: employeeEmail,
          result: res.data.result,
          sourceName: nextFile?.name || 'Pasted SOP',
        })
      }

      if (typeof onResultMeta === 'function') {
        onResultMeta({ difficulty, emailSent })
      }
      setEmailInfo(
        employeeEmail.trim()
          ? emailSent
            ? 'Training output emailed to employee.'
            : 'Email was not sent. Check frontend SMTP env on Vercel.'
          : ''
      )
      setStage('Completed.')
    } catch (err) {
      const message =
        err?.code === 'ECONNABORTED'
          ? 'Processing timed out. Try a shorter SOP or retry in a minute.'
          : err?.response?.data?.error || 'Failed to process SOP. Please try again.'
      setError(message)
      setResult(null)
      setStage('Failed.')
    } finally {
      clearStageInterval()
      setLoading(false)
    }
  }

  const processBulk = async (nextFiles) => {
    setError('')
    setEmailInfo('')

    if (!canUseSession) {
      setError('Session ID is initializing. Please try again in a moment.')
      return
    }

    if (!nextFiles || nextFiles.length === 0) {
      setError('Please upload one or more PDF files for bulk processing.')
      return
    }

    const formData = new FormData()
    nextFiles.forEach((item) => formData.append('files', item))
    formData.append('session_id', sessionId)
    formData.append('difficulty', difficulty)
    if (employeeEmail.trim()) {
      formData.append('employee_email', employeeEmail.trim())
    }

    try {
      setLoading(true)
      startStageInterval()
      const res = await axios.post(`${API_BASE_URL}/process-bulk`, formData, { timeout: API_TIMEOUT_MS })
      const items = Array.isArray(res.data?.items) ? res.data.items : []
      setBulkResults(items)
      setResult(null)
      if (items.some((item) => item.ok) && typeof onUnlockChat === 'function') {
        onUnlockChat(sessionId)
      }

      let emailSentCount = 0
      if (employeeEmail.trim()) {
        const emailTasks = items
          .filter((item) => item.ok && item.result)
          .map((item) =>
            sendEmailFromFrontend({
              recipientEmail: employeeEmail,
              result: item.result,
              sourceName: item.filename || 'SOP',
            })
          )
        const settled = await Promise.all(emailTasks)
        emailSentCount = settled.filter(Boolean).length
      }

      if (typeof onResultMeta === 'function') {
        onResultMeta({ difficulty, emailSent: emailSentCount > 0 })
      }
      setEmailInfo(
        employeeEmail.trim()
          ? emailSentCount > 0
            ? `${emailSentCount} bulk output email(s) sent.`
            : 'Bulk outputs were generated, but emails were not sent.'
          : ''
      )
      setStage('Bulk completed.')
    } catch (err) {
      const message =
        err?.code === 'ECONNABORTED'
          ? 'Bulk processing timed out. Try fewer files per batch.'
          : err?.response?.data?.error || 'Failed to process bulk SOP files.'
      setError(message)
      setBulkResults([])
      setStage('Failed.')
    } finally {
      clearStageInterval()
      setLoading(false)
    }
  }

  useEffect(() => {
    if (mode !== 'paste' || isBulk) {
      return
    }
    if (textDebounceRef.current) {
      window.clearTimeout(textDebounceRef.current)
    }
    if (text.trim().length < 20 || loading) {
      return
    }
    textDebounceRef.current = window.setTimeout(() => {
      processSingle({ nextText: text })
    }, 800)
  }, [text, mode, isBulk, loading])

  const onUploadSelect = (nextFile) => {
    setFile(nextFile)
    if (nextFile && mode === 'upload' && !isBulk && !loading) {
      processSingle({ nextFile })
    }
  }

  const onBulkUploadSelect = (nextFiles) => {
    setFiles(nextFiles)
    if (nextFiles.length > 0 && mode === 'upload' && isBulk && !loading) {
      processBulk(nextFiles)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-6 shadow-panel">
      <h2 className="text-lg font-semibold tracking-wide">Input SOP</h2>

      <div className="mt-4 grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-textMuted">
            Difficulty
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-panelSoft px-3 py-2 text-sm text-textMain outline-none"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label className="text-xs text-textMuted sm:col-span-2">
            Employee Email (optional)
            <input
              type="email"
              value={employeeEmail}
              onChange={(e) => setEmployeeEmail(e.target.value)}
              placeholder="employee@company.com"
              className="mt-1 w-full rounded-lg border border-line bg-panelSoft px-3 py-2 text-sm text-textMain outline-none transition focus:border-accent"
            />
          </label>
        </div>

        <div className="inline-flex w-fit rounded-lg border border-line bg-panelSoft p-1">
          <button
            type="button"
            onClick={() => {
              setMode('upload')
              setError('')
              setText('')
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
              setFile(null)
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
            <div className="flex items-center gap-2">
              <input
                id="bulk-mode"
                type="checkbox"
                checked={isBulk}
                onChange={(e) => {
                  setIsBulk(e.target.checked)
                  setFile(null)
                  setFiles([])
                  setResult(null)
                  setBulkResults([])
                }}
              />
              <label htmlFor="bulk-mode" className="text-sm text-textMuted">
                Bulk mode (process multiple SOP PDFs)
              </label>
            </div>
            <label className="text-sm text-textMuted">Upload SOP PDF</label>
            <input
              type="file"
              multiple={isBulk}
              accept=".pdf"
              onChange={(e) => {
                const selected = Array.from(e.target.files || [])
                if (isBulk) {
                  onBulkUploadSelect(selected)
                } else {
                  onUploadSelect(selected[0] || null)
                }
              }}
              className="rounded-lg border border-line bg-panelSoft px-3 py-2 text-sm text-textMuted file:mr-3 file:rounded-md file:border-0 file:bg-[#24282f] file:px-3 file:py-1.5 file:text-sm file:text-textMain hover:file:bg-[#2b3038]"
            />
            {!isBulk && file ? <p className="text-xs text-textMuted">Selected: {file.name}</p> : null}
            {isBulk && files.length > 0 ? (
              <p className="text-xs text-textMuted">Selected {files.length} files for bulk processing.</p>
            ) : null}
            <p className="text-xs text-textMuted">
              File selection triggers automatic processing. No manual process button needed.
            </p>
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
            <div className="flex items-center justify-between text-xs text-textMuted">
              <span>Minimum 20 characters required. Processing starts automatically after typing pause.</span>
              <span>{textLength} chars</span>
            </div>
          </>
        )}

        {error ? <p className="text-sm text-[#d6a8a8]">{error}</p> : null}
        {emailInfo ? <p className="text-sm text-[#b2d0b2]">{emailInfo}</p> : null}

        <div className="mt-1 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panelSoft px-3 py-2 text-xs text-textMuted">
          <span>Status:</span>
          <span className="font-medium text-textMain">{loading ? stage : 'Idle'}</span>
        </div>

        <button
          type="button"
          onClick={() => {
            setFile(null)
            setFiles([])
            setText('')
            setError('')
            setEmailInfo('')
            setStage('Waiting for input...')
            setResult(null)
            setBulkResults([])
          }}
          className="w-fit rounded-lg border border-line bg-panelSoft px-4 py-2 text-sm text-textMuted transition hover:text-textMain"
        >
          Reset
        </button>
      </div>
    </section>
  )
}
