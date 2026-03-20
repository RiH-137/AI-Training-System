'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'

const QUESTION_POOL = [
  'What is the most important objective of this SOP?',
  'Can you summarize the SOP in 5 key points?',
  'What are the mandatory steps I must not skip?',
  'What common mistakes should I avoid while following this SOP?',
  'What checks should I perform before starting?',
  'What should I do if an exception occurs during the process?',
  'Can you explain this SOP for a beginner?',
  'Which step is most critical from a compliance perspective?',
  'How can I train a new employee using this SOP?',
  'What quick revision checklist can I use before execution?',
]

function getSuggestedQuestions(count = 5) {
  const shuffled = [...QUESTION_POOL].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export default function SopChat({
  sessionId,
  currentSessionId,
  onSwitchToCurrentSession,
  isLocked = false,
  lockMessage = 'Chat is locked until SOP processing is completed.',
}) {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState(() => QUESTION_POOL.slice(0, 5))

  useEffect(() => {
    setSuggestions(getSuggestedQuestions(5))
  }, [])

  const askQuestion = async (incomingQuestion) => {
    setError('')
    if (loading) {
      return
    }

    if (isLocked) {
      setError(lockMessage)
      return
    }

    const questionCandidate = typeof incomingQuestion === 'string' ? incomingQuestion : question
    const q = questionCandidate.trim()

    if (!/^[A-Za-z0-9]{8}$/.test(sessionId || '')) {
      setError('Session ID is initializing. Please try again in a moment.')
      return
    }

    if (q.length < 3) {
      setError('Please enter a longer question.')
      return
    }

    const userMessage = { role: 'user', content: q }
    setMessages((prev) => [...prev, userMessage])
    setQuestion('')

    try {
      setLoading(true)
      const res = await axios.post('/api/backend/ask', {
        session_id: sessionId,
        question: q,
      })

      const assistantMessage = {
        role: 'assistant',
        content: res.data?.answer || 'No answer returned.',
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      const message = err?.response?.data?.error || 'Failed to fetch answer.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-6 shadow-panel">
      <h2 className="text-lg font-semibold tracking-wide">Ask Questions From SOP</h2>
      <p className="mt-1 text-sm text-textMuted">
        Ask multiple questions from your uploaded/pasted SOP content.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="rounded-lg border border-line bg-panelSoft px-3 py-1.5 text-xs text-textMuted">
          Using Session: <span className="font-semibold text-textMain">{sessionId || 'N/A'}</span>
        </div>
        {currentSessionId && currentSessionId !== sessionId ? (
          <button
            type="button"
            onClick={onSwitchToCurrentSession}
            className="rounded-lg border border-line bg-panelSoft px-3 py-1.5 text-xs text-textMuted transition hover:text-textMain"
          >
            Switch to Current Session
          </button>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl border border-line bg-panelSoft p-4">
        {isLocked ? (
          <div className="mb-4 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-textMuted">
            {lockMessage}
          </div>
        ) : null}
        <div className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.12em] text-textMuted">Suggested Questions</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSuggestions(getSuggestedQuestions(5))}
                className="rounded-lg border border-line bg-panel px-2.5 py-1 text-xs text-textMuted transition hover:text-textMain"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => {
                  setMessages([])
                  setError('')
                }}
                className="rounded-lg border border-line bg-panel px-2.5 py-1 text-xs text-textMuted transition hover:text-textMain"
              >
                Clear Chat
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((item, index) => (
              <button
                key={`${item}-${index}`}
                type="button"
                onClick={() => {
                  setError('')
                  askQuestion(item)
                }}
                disabled={loading || isLocked}
                className="rounded-full border border-line bg-panel px-3 py-1.5 text-xs text-textMuted transition hover:bg-[#242a31] hover:text-textMain"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <p className="text-sm text-textMuted">No messages yet. Ask your first question.</p>
          ) : (
            messages.map((msg, index) => (
              <div
                key={`${msg.role}-${index}`}
                className={`rounded-xl p-3 text-sm leading-6 ${
                  msg.role === 'user'
                    ? 'ml-auto max-w-[85%] border border-line bg-[#252a31] text-textMain'
                    : 'mr-auto max-w-[90%] border border-line bg-[#1e2228] text-textMain'
                }`}
              >
                <p className="text-[11px] uppercase tracking-[0.12em] text-textMuted">
                  {msg.role === 'user' ? 'You' : 'Assistant'}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading && !isLocked) {
                askQuestion()
              }
            }}
            placeholder="Ask anything about the SOP..."
            disabled={isLocked}
            className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-textMain outline-none transition focus:border-accent"
          />
          <button
            type="button"
            onClick={() => askQuestion()}
            disabled={loading || isLocked}
            className="w-fit rounded-lg border border-line bg-[#22252b] px-5 py-2 text-sm font-medium text-textMain transition hover:bg-[#2a2e35] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Thinking...' : 'Ask'}
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-[#d6a8a8]">{error}</p> : null}
      </div>
    </section>
  )
}
