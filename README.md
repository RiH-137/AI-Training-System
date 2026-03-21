# SOP AI Training System

## Live App
https://ai-training-system-dusky.vercel.app/

## Overview
SOP AI Training System turns SOP files into practical training outputs for employees.

Architecture:
- Frontend: Next.js (Vercel)
- Backend: Flask (Render)
- Database: MongoDB
- AI: Groq API

The app supports automated SOP processing, quiz generation and evaluation, SOP insights, session history, and SOP chat.

## Tools and Technologies Used (Assessment)

### AI tools and LLM
- Groq API
- Llama model via Groq (`llama-3.1-8b-instant`, configurable with `GROQ_MODEL`)
- Prompt-driven JSON generation for summary, training steps, quiz, and insights
- Copilot
- ChatGPT
### Frontend
- Next.js 14 (App Router)
- React 18
- JavaScript 
- Tailwind CSS
- Axios
- Nodemailer (email sending through Next.js server route on Vercel)

### Backend
- Python 3
- Flask
- Requests
- PyPDF2 (PDF text extraction)
- Python-dotenv
- Gunicorn (production app server)

### Database
- MongoDB Atlas
- PyMongo

### Deployment and Hosting
- Vercel (Frontend)
- Render (Backend)

### Developer and Testing Tools
- npm
- pip
- ESLint (Next.js lint workflow)
- Postman (API testing)
- Git and GitHub (version control)
- GitHub Copilot (GPT-5.3-Codex) for assisted development


## Updated Features
- Auto SOP processing on upload or text paste pause (no manual process button)
- Difficulty-based generation: Beginner, Intermediate, Advanced
- AI output sections:
- Structured summary
- Step-by-step training
- Quiz questions and expected answers
- Smart insights (missing steps, improvement suggestions, safety/compliance notes)
- Auto quiz evaluation with score and revision feedback
- Text-to-speech for training steps
- Real-time processing status indicators
- Bulk SOP processing for multiple PDFs
- Session-based persistent history in MongoDB
- SOP chat with suggested prompts
- Chat lock rule:
- Ask Questions From SOP remains locked until SOP is successfully processed by AI for that session
- Frontend (Vercel) email sending using Nodemailer via Next.js API route

## User Guide
1. Open the app.
2. Copy your Session ID shown at top.
3. Choose input mode:
- Upload PDF (single or bulk)
- Paste SOP text
4. Choose difficulty and optional employee email.
5. SOP processes automatically.
6. Review output tabs:
- Summary
- Training Steps
- Quiz
- Insights
- Raw
7. Optional quiz evaluation:
- Answer quiz questions
- Click Evaluate Quiz to get score and feedback
8. Optional audio:
- Open Training Steps tab
- Click Listen Steps
9. SOP chat usage:
- Chat unlocks only after successful SOP processing for the active session
- For past sessions, fetch history first and use Ask From This Session
10. History:
- Enter Session ID in Find Past Session History
- Click Get History

## Developer Setup

### 1) Clone
```bash
git clone <your-repo-url>
cd SOP-AI-Training-System
```

### 2) Backend (Render/Local)
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:
```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-8b-instant
MONGODB_URI=your_mongodb_uri
MONGODB_DB=sop_ai_training
MONGODB_COLLECTION=training_runs
ALLOWED_ORIGINS=http://localhost:3000,https://your-vercel-domain.vercel.app
PORT=5000
```

Run backend:
```bash
python app.py
```

### 3) Frontend (Vercel/Local)
```bash
cd ../frontend
npm install
```

Create `frontend/.env.local`:
```env
BACKEND_API_BASE_URL=http://localhost:5000

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_sender_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM=your_sender_email@gmail.com
```

Run frontend:
```bash
npm run dev
```

## Deployment Documentation

### Backend on Render
Set environment variables in Render service:
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `MONGODB_URI` (if using history persistence)
- `MONGODB_DB`
- `MONGODB_COLLECTION`
- `ALLOWED_ORIGINS` (include Vercel domain)
- `PORT` (Render usually injects automatically)

Start command:
```bash
gunicorn app:app
```

### Frontend on Vercel
Set environment variables in Vercel project settings:
- `BACKEND_API_BASE_URL` = your Render backend URL (recommended)
- `NEXT_PUBLIC_API_BASE_URL` = optional compatibility fallback
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`

Important:
- Email is sent from frontend server-side route: `frontend/app/api/send-training-email/route.js`
- Do not expose SMTP credentials as `NEXT_PUBLIC_*`

### Post-Deployment Checklist
1. Open frontend URL.
2. Upload one SOP PDF.
3. Confirm output sections are generated.
4. Confirm chat is initially locked and unlocks after successful processing.
5. Ask SOP question and verify response.
6. Submit quiz answers and verify score.
7. If email is provided, confirm mail received.
8. Fetch history by session ID and verify records.

## API Endpoints (Backend)
- `GET /health`
- `POST /process`
- `POST /process-bulk`
- `GET /history/<session_id>`
- `POST /ask`
- `POST /evaluate-quiz`

## Validation Commands
Backend:
```bash
cd backend
python -m compileall .
```

Frontend:
```bash
cd frontend
npm run lint
```