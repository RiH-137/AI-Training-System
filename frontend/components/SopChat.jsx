'use client'

import { useState } from 'react'
import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'

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

export default function SopChat({ sessionId }) {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suggestions] = useState(() => getSuggestedQuestions(5))

  const askQuestion = async (incomingQuestion) => {
    setError('')
    if (loading) {
      return
    }

    const q = (incomingQuestion ?? question).trim()

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
      const res = await axios.post(`${API_BASE_URL}/ask`, {
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
    <section className="mt-8 rounded-2xl border border-line bg-panel p-6 shadow-panel">
      <h2 className="text-lg font-semibold tracking-wide">Ask Questions From SOP</h2>
      <p className="mt-1 text-sm text-textMuted">
        Ask multiple questions from your uploaded/pasted SOP content.
      </p>

      <div className="mt-4 rounded-xl border border-line bg-panelSoft p-4">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.12em] text-textMuted">Suggested Questions</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((item, index) => (
              <button
                key={`${item}-${index}`}
                type="button"
                onClick={() => {
                  setError('')
                  askQuestion(item)
                }}
                disabled={loading}
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
              if (e.key === 'Enter' && !loading) {
                askQuestion()
              }
            }}
            placeholder="Ask anything about the SOP..."
            className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-textMain outline-none transition focus:border-accent"
          />
          <button
            type="button"
            onClick={askQuestion}
            disabled={loading}
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
