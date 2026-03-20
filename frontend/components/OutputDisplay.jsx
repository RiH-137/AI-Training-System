export default function OutputDisplay({ result }) {
  if (!result) {
    return null
  }

  const summary = Array.isArray(result.summary) ? result.summary : []
  const steps = Array.isArray(result.training_steps) ? result.training_steps : []
  const questions = Array.isArray(result.quiz_questions) ? result.quiz_questions : []

  return (
    <section className="mt-8 grid gap-5">
      <article className="rounded-xl border border-line bg-panel p-5 shadow-panel">
        <h2 className="text-lg font-semibold tracking-wide">Structured Summary</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-textMuted">
          {summary.map((item, index) => (
            <li key={`summary-${index}`}>{item}</li>
          ))}
        </ul>
      </article>

      <article className="rounded-xl border border-line bg-panel p-5 shadow-panel">
        <h2 className="text-lg font-semibold tracking-wide">Step-by-Step Training</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-textMuted">
          {steps.map((item, index) => (
            <li key={`step-${index}`}>{item}</li>
          ))}
        </ol>
      </article>

      <article className="rounded-xl border border-line bg-panel p-5 shadow-panel">
        <h2 className="text-lg font-semibold tracking-wide">Quiz Questions</h2>
        <div className="mt-3 grid gap-3">
          {questions.map((q, index) => (
            <div
              key={`q-${index}`}
              className="rounded-lg border border-line bg-panelSoft p-3 text-sm"
            >
              <p className="font-medium text-textMain">
                {index + 1}. {q.question || 'Question'}
              </p>
              <p className="mt-1 text-textMuted">Answer: {q.answer || 'N/A'}</p>
            </div>
          ))}
        </div>
      </article>

      {result.raw_output ? (
        <article className="rounded-xl border border-line bg-panel p-5 shadow-panel">
          <h2 className="text-lg font-semibold tracking-wide">Raw Model Output</h2>
          <pre className="mt-3 whitespace-pre-wrap text-sm text-textMuted">{result.raw_output}</pre>
        </article>
      ) : null}
    </section>
  )
}
