import nodemailer from 'nodemailer'

function renderEmailBody(result, difficulty, sourceName) {
  const summary = Array.isArray(result?.summary) ? result.summary : []
  const steps = Array.isArray(result?.training_steps) ? result.training_steps : []
  const insights = typeof result?.insights === 'object' && result?.insights ? result.insights : {}
  const suggestions = Array.isArray(insights.improvement_suggestions)
    ? insights.improvement_suggestions
    : []

  const summaryText = summary.slice(0, 8).map((item) => `- ${item}`).join('\n')
  const stepsText = steps.slice(0, 12).map((item, idx) => `${idx + 1}. ${item}`).join('\n')
  const suggestionText = suggestions.slice(0, 6).map((item) => `- ${item}`).join('\n')

  return (
    'Hello,\n\n' +
    'Your SOP training output is ready.\n\n' +
    `Source: ${sourceName || 'SOP'}\n` +
    `Selected Difficulty: ${difficulty || 'intermediate'}\n\n` +
    'Summary:\n' +
    `${summaryText || '- No summary generated.'}\n\n` +
    'Training Steps:\n' +
    `${stepsText || 'No steps generated.'}\n\n` +
    'Improvement Suggestions:\n' +
    `${suggestionText || '- No improvement suggestions generated.'}\n\n` +
    'Regards,\n' +
    'SOP AI Training System - Rishi Ranjan - 101rishidsr@gmail.com'
  )
}

export async function POST(request) {
  try {
    const payload = await request.json()
    const recipientEmail = String(payload?.recipientEmail || '').trim()
    const difficulty = String(payload?.difficulty || 'intermediate').trim().toLowerCase()
    const sourceName = String(payload?.sourceName || 'SOP').trim()
    const result = payload?.result || {}

    if (!recipientEmail) {
      return Response.json({ ok: false, error: 'recipientEmail is required.' }, { status: 400 })
    }

    const smtpHost = process.env.SMTP_HOST
    const smtpPort = Number(process.env.SMTP_PORT || '587')
    const smtpUser = process.env.SMTP_USER
    const smtpPassword = process.env.SMTP_PASSWORD
    const smtpFrom = process.env.SMTP_FROM || smtpUser

    if (!smtpHost || !smtpUser || !smtpPassword || !smtpFrom) {
      return Response.json(
        { ok: false, error: 'SMTP environment variables are not configured on frontend. Skipping email.' },
        { status: 200 }
      )
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    })

    await transporter.sendMail({
      from: smtpFrom,
      to: recipientEmail,
      subject: `Your SOP Training Output - ${sourceName || 'SOP'}`,
      text: renderEmailBody(result, difficulty, sourceName),
    })

    return Response.json({ ok: true })
  } catch (error) {
    return Response.json(
      { ok: false, error: error?.message || 'Failed to send email.' },
      { status: 500 }
    )
  }
}
