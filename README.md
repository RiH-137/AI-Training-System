# Nutrabay-AI Automation Intern - Assessment

## Problem 4: SOP to AI Training System

## Approach (Short Explanation)
The system is designed as a practical full-stack flow that converts SOP content into training-ready outputs. The user can choose one of two input modes from the UI: upload a PDF or paste SOP text. This mode-based input approach avoids ambiguity and improves validation, because the backend receives only the intended source.

On the server side, Flask handles request validation, text extraction for PDFs, and prompt orchestration for the LLM call. The prompt is structured to request strict JSON output with three sections: structured summary, step-by-step training guide, and quiz questions. This keeps parsing reliable and makes frontend rendering consistent.

The implementation focuses on stability and assignment quality. Secrets are managed using environment variables instead of hardcoded keys. Input checks and API error handling are included to gracefully handle invalid files, short text, or model response issues. A fallback response format is returned when model output cannot be parsed, so the application does not fail abruptly.

MongoDB persistence is implemented as optional history logging, which means the core experience works even when database settings are not configured. The UI follows a dark neutral palette (charcoal/slate/gray) to look clean, professional, and human-built. Final validation was done with backend syntax checks and frontend lint/build checks.

## Tools Used
- Next.js (JavaScript)
- React
- Tailwind CSS
- Flask
- Flask-CORS
- Groq API
- PyPDF2
- requests (Python)
- python-dotenv
- MongoDB + PyMongo
- ESLint