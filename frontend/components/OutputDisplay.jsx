'use client'

import { useMemo, useState } from 'react'
import axios from 'axios'

export default function OutputDisplay({ result, bulkResults, sessionId, difficulty }) {
  const hasBulkResults = Array.isArray(bulkResults) && bulkResults.length > 0
  const hasSingleResult = Boolean(result)

  const [activeTab, setActiveTab] = useState('summary')
  const [quizAnswers, setQuizAnswers] = useState([])
  const [quizFeedback, setQuizFeedback] = useState(null)
  const [quizLoading, setQuizLoading] = useState(false)
  const [quizError, setQuizError] = useState('')
  const [speaking, setSpeaking] = useState(false)

  const summary = Array.isArray(result?.summary) ? result.summary : []
  const steps = Array.isArray(result?.training_steps) ? result.training_steps : []
  const questions = Array.isArray(result?.quiz_questions) ? result.quiz_questions : []
  const insights = typeof result?.insights === 'object' && result?.insights ? result.insights : {}

  const formattedJson = useMemo(() => JSON.stringify(result || {}, null, 2), [result])

  const evaluateQuiz = async () => {
    setQuizError('')
    setQuizFeedback(null)

    if (!/^[A-Za-z0-9]{8}$/.test(sessionId || '')) {
      setQuizError('Session ID is missing. Process SOP first.')
      return
    }

    if (questions.length === 0) {
      setQuizError('No quiz questions available for evaluation.')
      return
    }

    const normalizedAnswers = questions.map((_, idx) => (quizAnswers[idx] || '').trim())
    if (normalizedAnswers.some((item) => item.length < 2)) {
      setQuizError('Please answer all quiz questions before evaluation.')
      return
    }

    try {
      setQuizLoading(true)
      const res = await axios.post('/api/backend/evaluate-quiz', {
        session_id: sessionId,
        difficulty,
        quiz_questions: questions,
        user_answers: normalizedAnswers,
      })
      setQuizFeedback(res.data?.evaluation || null)
    } catch (err) {
      setQuizError(err?.response?.data?.error || 'Failed to evaluate quiz.')
    } finally {
      setQuizLoading(false)
    }
  }

  const speakSteps = () => {
    if (!window?.speechSynthesis || steps.length === 0) {
      return
    }

    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }

    const utterance = new window.SpeechSynthesisUtterance(
      steps.map((step, idx) => `Step ${idx + 1}. ${step}`).join('. ')
    )
    utterance.rate = 0.95
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(formattedJson)
    } catch {
      // Silently ignore clipboard failures to avoid noisy UX.
    }
  }

  const tabButtonClass = (tab) =>
    `rounded-md px-3 py-2 text-sm transition ${
      activeTab === tab ? 'bg-[#2a2e35] text-textMain' : 'text-textMuted hover:text-textMain'
    }`

  if (!hasSingleResult && !hasBulkResults) {
    return null
  }

  const renderSingleResult = (nextResult, title) => {
    const nextSummary = Array.isArray(nextResult?.summary) ? nextResult.summary : []
    const nextSteps = Array.isArray(nextResult?.training_steps) ? nextResult.training_steps : []
    const nextQuestions = Array.isArray(nextResult?.quiz_questions) ? nextResult.quiz_questions : []
    const nextInsights =
      typeof nextResult?.insights === 'object' && nextResult?.insights ? nextResult.insights : {}

    return (
      <div className="rounded-lg border border-line bg-panelSoft p-4">
        <p className="text-sm font-medium text-textMain">{title}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.12em] text-textMuted">Summary</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-textMuted">
          {nextSummary.map((item, index) => (
            <li key={`bulk-summary-${index}`}>{item}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs uppercase tracking-[0.12em] text-textMuted">Training Steps</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-textMuted">
          {nextSteps.map((item, index) => (
            <li key={`bulk-steps-${index}`}>{item}</li>
          ))}
        </ol>
        <p className="mt-3 text-xs uppercase tracking-[0.12em] text-textMuted">Insights</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-textMuted">
          {(nextInsights.improvement_suggestions || []).map((item, index) => (
            <li key={`bulk-insights-${index}`}>{item}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs uppercase tracking-[0.12em] text-textMuted">Quiz Questions</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-textMuted">
          {nextQuestions.map((item, index) => (
            <li key={`bulk-quiz-${index}`}>{item.question || 'Question'}</li>
          ))}
        </ol>
      </div>
    )
  }

  if (hasBulkResults && !hasSingleResult) {
    return (
      <section className="rounded-xl border border-line bg-panel p-5 shadow-panel">
        <h2 className="text-lg font-semibold tracking-wide">Bulk SOP Processing Output</h2>
        <div className="mt-4 grid gap-4">
          {bulkResults.map((item, index) => (
            <div key={`${item.filename}-${index}`}>
              {item.ok ? (
                renderSingleResult(item.result, `${item.filename} ${item.email_sent ? '(emailed)' : ''}`)
              ) : (
                <div className="rounded-lg border border-line bg-panelSoft p-4 text-sm text-[#d6a8a8]">
                  {item.filename}: {item.error || 'Failed to process this SOP.'}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-line bg-panel p-5 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-wide">Generated Training Output</h2>
        <button
          type="button"
          onClick={copyOutput}
          className="rounded-lg border border-line bg-panelSoft px-3 py-2 text-xs text-textMuted transition hover:text-textMain"
        >
          Copy JSON
        </button>
      </div>

      <div className="mt-4 inline-flex flex-wrap rounded-lg border border-line bg-panelSoft p-1">
        <button type="button" onClick={() => setActiveTab('summary')} className={tabButtonClass('summary')}>
          Summary
        </button>
        <button type="button" onClick={() => setActiveTab('steps')} className={tabButtonClass('steps')}>
          Training Steps
        </button>
        <button type="button" onClick={() => setActiveTab('quiz')} className={tabButtonClass('quiz')}>
          Quiz
        </button>
        <button type="button" onClick={() => setActiveTab('insights')} className={tabButtonClass('insights')}>
          Insights
        </button>
        <button type="button" onClick={() => setActiveTab('raw')} className={tabButtonClass('raw')}>
          Raw
        </button>
      </div>

      {activeTab === 'summary' ? (
        <div className="mt-4 rounded-lg border border-line bg-panelSoft p-4">
          {summary.length === 0 ? (
            <p className="text-sm text-textMuted">No summary was returned.</p>
          ) : (
            <ul className="list-disc space-y-2 pl-5 text-sm text-textMuted">
              {summary.map((item, index) => (
                <li key={`summary-${index}`}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {activeTab === 'steps' ? (
        <div className="mt-4 rounded-lg border border-line bg-panelSoft p-4">
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={speakSteps}
              className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs text-textMuted transition hover:text-textMain"
            >
              {speaking ? 'Stop Audio' : 'Listen Steps'}
            </button>
          </div>
          {steps.length === 0 ? (
            <p className="text-sm text-textMuted">No training steps were returned.</p>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-sm text-textMuted">
              {steps.map((item, index) => (
                <li key={`step-${index}`}>{item}</li>
              ))}
            </ol>
          )}
        </div>
      ) : null}

      {activeTab === 'quiz' ? (
        <div className="mt-4 grid gap-3">
          {questions.length === 0 ? (
            <div className="rounded-lg border border-line bg-panelSoft p-4 text-sm text-textMuted">No quiz questions were returned.</div>
          ) : (
            <>
              {questions.map((q, index) => (
                <div key={`q-${index}`} className="rounded-lg border border-line bg-panelSoft p-3 text-sm">
                  <p className="font-medium text-textMain">
                    {index + 1}. {q.question || 'Question'}
                  </p>
                  <textarea
                    rows={2}
                    value={quizAnswers[index] || ''}
                    onChange={(e) => {
                      const next = [...quizAnswers]
                      next[index] = e.target.value
                      setQuizAnswers(next)
                    }}
                    placeholder="Type your answer"
                    className="mt-2 w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-textMain outline-none transition focus:border-accent"
                  />
                  <p className="mt-1 text-xs text-textMuted">Expected: {q.answer || 'N/A'}</p>
                </div>
              ))}
              <button
                type="button"
                onClick={evaluateQuiz}
                disabled={quizLoading}
                className="w-fit rounded-lg border border-line bg-[#22252b] px-4 py-2 text-sm text-textMain transition hover:bg-[#2a2e35] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {quizLoading ? 'Evaluating...' : 'Evaluate Quiz'}
              </button>
              {quizError ? <p className="text-sm text-[#d6a8a8]">{quizError}</p> : null}
              {quizFeedback ? (
                <div className="rounded-lg border border-line bg-panelSoft p-4 text-sm text-textMain">
                  <p className="font-medium">
                    Score: {quizFeedback.score}/{quizFeedback.total}
                  </p>
                  <p className="mt-1 text-textMuted">{quizFeedback.feedback}</p>
                  {(quizFeedback.revision_focus || []).length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-textMuted">
                      {(quizFeedback.revision_focus || []).map((item, index) => (
                        <li key={`rev-${index}`}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                  {(quizFeedback.per_question_feedback || []).length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {(quizFeedback.per_question_feedback || []).map((item, index) => (
                        <div key={`fb-${index}`} className="rounded-md border border-line bg-panel p-2 text-xs text-textMuted">
                          <p className="font-medium text-textMain">{item.question}</p>
                          <p className="mt-1">{item.feedback}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {activeTab === 'insights' ? (
        <div className="mt-4 grid gap-3">
          <div className="rounded-lg border border-line bg-panelSoft p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-textMuted">Missing Steps</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-textMuted">
              {(insights.missing_steps || []).map((item, index) => (
                <li key={`missing-${index}`}>{item}</li>
              ))}
              {(insights.missing_steps || []).length === 0 ? <li>No missing steps detected.</li> : null}
            </ul>
          </div>
          <div className="rounded-lg border border-line bg-panelSoft p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-textMuted">Improvement Suggestions</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-textMuted">
              {(insights.improvement_suggestions || []).map((item, index) => (
                <li key={`improve-${index}`}>{item}</li>
              ))}
              {(insights.improvement_suggestions || []).length === 0 ? <li>No suggestions returned.</li> : null}
            </ul>
          </div>
          <div className="rounded-lg border border-line bg-panelSoft p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-textMuted">Safety or Compliance Notes</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-textMuted">
              {(insights.safety_or_compliance_notes || []).map((item, index) => (
                <li key={`safe-${index}`}>{item}</li>
              ))}
              {(insights.safety_or_compliance_notes || []).length === 0 ? <li>No safety notes returned.</li> : null}
            </ul>
          </div>
        </div>
      ) : null}

      {activeTab === 'raw' ? (
        <div className="mt-4 rounded-lg border border-line bg-panelSoft p-4">
          <pre className="max-h-[420px] overflow-y-auto whitespace-pre-wrap text-sm text-textMuted">
            {result.raw_output || formattedJson}
          </pre>
        </div>
      ) : null}
    </section>
  )
}
