# Nutrabay-AI Automation Intern - Assessment

## Problem 4: SOP to AI Training System

## Live Link
https://ai-training-system-dusky.vercel.app/

## Project Overview
SOP to AI Training System converts SOP documents into training-ready outputs and supports follow-up Q and A on the same SOP context. It is built as a full-stack application with:
- Frontend on Vercel (Next.js, JavaScript, Tailwind)
- Backend on Render (Flask)
- Optional MongoDB history storage

## Approach (Short Explanation)
The system is designed as a practical full-stack flow that converts SOP content into training-ready outputs. The user can choose one of two input modes from the UI: upload a PDF or paste SOP text. This mode-based input approach avoids ambiguity and improves validation, because the backend receives only the intended source.

On the server side, Flask handles request validation, text extraction for PDFs, and prompt orchestration for the LLM call. The prompt is structured to request strict JSON output with three sections: structured summary, step-by-step training guide, and quiz questions. This keeps parsing reliable and makes frontend rendering consistent.

The implementation focuses on stability and assignment quality. Secrets are managed using environment variables instead of hardcoded keys. Input checks and API error handling are included to gracefully handle invalid files, short text, or model response issues. A fallback response format is returned when model output cannot be parsed, so the application does not fail abruptly.

MongoDB persistence is implemented as optional history logging, which means the core experience works even when database settings are not configured. The UI follows a dark neutral palette (charcoal/slate/gray) to look clean, professional, and human-built. Final validation was done with backend syntax checks and frontend lint/build checks.

## Features
- Upload SOP as PDF
- Paste SOP text directly
- AI generated structured summary
- AI generated step-by-step training guide
- AI generated quiz questions and answers
- Persistent 8 character alphanumeric session ID per visitor
- Session-based storage in MongoDB
- View past session history by session ID
- Full SOP content and full generated output visible in history
- Chat-style follow-up Q and A from uploaded SOP context
- Suggested one-click questions in chat
- Dark neutral UI suitable for assignment submission
- Deployed architecture: Vercel frontend + Render backend

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
- CoPilot (GPT-5.3-Codex)

## How To Use (User Guide)
1. Open the live app link.
2. Note your Session ID shown at the top. Keep it safe to access history later.
3. Choose input mode:
- Upload PDF: Select SOP PDF and click Process SOP.
- Paste SOP: Paste SOP content and click Process SOP.
4. Review generated sections:
- Structured Summary
- Step-by-Step Training
- Quiz Questions
5. Ask follow-up questions in Ask Questions From SOP section.
- Type your question and click Ask.
- Or click a suggested question for one-click ask.
6. To check old work:
- Go to Find Past Session History.
- Enter a previous Session ID.
- Click Get History to load complete records.

## How To Use (Developer Guide)

### 1) Clone and Install
1. Clone repository.
2. Setup backend dependencies.
3. Setup frontend dependencies.

### 2) Backend Setup
1. Go to backend folder.
2. Create virtual environment and activate it.
3. Install packages from requirements file.
4. Create backend environment file with:
- GROQ_API_KEY
- GROQ_MODEL (optional)
- MONGODB_URI (optional but required for history persistence)
- MONGODB_DB
- MONGODB_COLLECTION
- ALLOWED_ORIGINS (comma-separated frontend origins)
- PORT
5. Run backend app.

### 3) Frontend Setup
1. Go to frontend folder.
2. Install npm packages.
3. Create frontend environment file with:
- NEXT_PUBLIC_API_BASE_URL (backend URL)
4. Run frontend app.


### 4) API Endpoints
- GET /health : Health check
- POST /process : Process SOP and save session run
- GET /history/<session_id> : Fetch session history
- POST /ask : Ask follow-up question using latest SOP in session

### 5) Validation Commands
- Backend syntax check: python -m compileall .
- Frontend lint: npm run lint