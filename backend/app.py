from __future__ import annotations

import os
import re

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from utils.llm import answer_question_from_sop, evaluate_quiz_answers, generate_output
from utils.parser import extract_text_from_pdf
from utils.storage import get_latest_source_content, get_training_history, save_training_run

load_dotenv()

app = Flask(__name__)


def _parse_allowed_origins() -> list[str]:
    raw = (os.getenv("ALLOWED_ORIGINS") or "").strip()
    def normalize(origin: str) -> str:
        return origin.strip().rstrip("/")

    if not raw:
        return [
            "http://localhost:3000",
            "https://ai-training-system-dusky.vercel.app",
            "https://ai-training-system.vercel.app",
        ]
    return [normalize(origin) for origin in raw.split(",") if normalize(origin)]


ALLOWED_ORIGINS = _parse_allowed_origins()

# Use explicit origins so deployed frontend domains are handled predictably.
CORS(
    app,
    resources={r"/*": {"origins": ALLOWED_ORIGINS}},
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin and origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        return jsonify({"ok": True}), 204


SESSION_ID_REGEX = re.compile(r"^[A-Za-z0-9]{8}$")
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _extract_content_from_request_file(file, text: str) -> tuple[str, str]:
    if file and file.filename:
        return extract_text_from_pdf(file), "pdf"
    if text:
        return text, "text"
    raise ValueError("Provide either a PDF file or SOP text.")


def _validate_difficulty(raw_difficulty: str | None) -> str:
    value = (raw_difficulty or "intermediate").strip().lower()
    if value not in {"beginner", "intermediate", "advanced"}:
        return "intermediate"
    return value


@app.get("/health")
def health_check():
    return jsonify({"status": "ok"})


@app.post("/process")
def process_sop():
    file = request.files.get("file")
    text = (request.form.get("text") or "").strip()
    session_id = (request.form.get("session_id") or "").strip()
    difficulty = _validate_difficulty(request.form.get("difficulty"))
    employee_email = (request.form.get("employee_email") or "").strip()

    if not SESSION_ID_REGEX.match(session_id):
        return jsonify({"error": "Valid 8-character alphanumeric session_id is required."}), 400

    if employee_email and not EMAIL_REGEX.match(employee_email):
        return jsonify({"error": "Provide a valid employee email."}), 400

    try:
        content, source_type = _extract_content_from_request_file(file=file, text=text)

        if not content or len(content.strip()) < 20:
            return jsonify({"error": "SOP content is too short to process."}), 400

        result = generate_output(content, difficulty=difficulty)

        preview = content[:240]
        try:
            save_training_run(
                session_id=session_id,
                source_type=source_type,
                source_preview=preview,
                source_content=content,
                result=result,
                difficulty=difficulty,
                recipient_email=employee_email or None,
            )
        except Exception:
            # Saving history is optional and should not break the API response.
            pass

        return jsonify({"ok": True, "result": result})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.post("/process-bulk")
def process_sop_bulk():
    files = request.files.getlist("files")
    session_id = (request.form.get("session_id") or "").strip()
    difficulty = _validate_difficulty(request.form.get("difficulty"))
    employee_email = (request.form.get("employee_email") or "").strip()

    if not SESSION_ID_REGEX.match(session_id):
        return jsonify({"error": "Valid 8-character alphanumeric session_id is required."}), 400

    if employee_email and not EMAIL_REGEX.match(employee_email):
        return jsonify({"error": "Provide a valid employee email."}), 400

    if not files:
        return jsonify({"error": "Upload one or more PDF files."}), 400

    outputs = []
    for file in files:
        if not file or not file.filename:
            continue
        try:
            content = extract_text_from_pdf(file)
            if len(content.strip()) < 20:
                outputs.append(
                    {
                        "filename": file.filename,
                        "ok": False,
                        "error": "SOP content is too short to process.",
                    }
                )
                continue

            result = generate_output(content, difficulty=difficulty)

            try:
                save_training_run(
                    session_id=session_id,
                    source_type="pdf",
                    source_preview=content[:240],
                    source_content=content,
                    result=result,
                    difficulty=difficulty,
                    recipient_email=employee_email or None,
                )
            except Exception:
                pass

            outputs.append(
                {
                    "filename": file.filename,
                    "ok": True,
                    "result": result,
                }
            )
        except Exception as exc:
            outputs.append({"filename": file.filename, "ok": False, "error": str(exc)})

    return jsonify({"ok": True, "items": outputs})


@app.get("/history/<session_id>")
def history_by_session(session_id: str):
    if not SESSION_ID_REGEX.match(session_id):
        return jsonify({"error": "Session ID must be 8 alphanumeric characters."}), 400

    try:
        history = get_training_history(session_id=session_id)
        return jsonify({"ok": True, "session_id": session_id, "history": history})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.post("/ask")
def ask_from_session():
    payload = request.get_json(silent=True) or {}
    session_id = (payload.get("session_id") or "").strip()
    question = (payload.get("question") or "").strip()

    if not SESSION_ID_REGEX.match(session_id):
        return jsonify({"error": "Session ID must be 8 alphanumeric characters."}), 400

    if len(question) < 3:
        return jsonify({"error": "Question is too short."}), 400

    try:
        source_content = get_latest_source_content(session_id=session_id)
        if not source_content:
            return jsonify({"error": "No SOP found for this session ID."}), 404

        answer = answer_question_from_sop(source_content, question)
        return jsonify({"ok": True, "answer": answer})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.post("/evaluate-quiz")
def evaluate_quiz():
    payload = request.get_json(silent=True) or {}
    session_id = (payload.get("session_id") or "").strip()
    user_answers = payload.get("user_answers") or []
    quiz_questions = payload.get("quiz_questions") or []
    difficulty = _validate_difficulty(payload.get("difficulty"))

    if not SESSION_ID_REGEX.match(session_id):
        return jsonify({"error": "Session ID must be 8 alphanumeric characters."}), 400

    if not isinstance(user_answers, list) or not user_answers:
        return jsonify({"error": "user_answers must be a non-empty array."}), 400

    if not isinstance(quiz_questions, list) or not quiz_questions:
        return jsonify({"error": "quiz_questions must be a non-empty array."}), 400

    try:
        source_content = get_latest_source_content(session_id=session_id)
        if not source_content:
            return jsonify({"error": "No SOP found for this session ID."}), 404

        evaluation = evaluate_quiz_answers(
            sop_text=source_content,
            quiz_questions=quiz_questions,
            user_answers=[str(item).strip() for item in user_answers],
            difficulty=difficulty,
        )

        try:
            save_training_run(
                session_id=session_id,
                source_type="quiz-evaluation",
                source_preview="Quiz evaluation from existing SOP session",
                source_content=source_content,
                result={"quiz_questions": quiz_questions},
                difficulty=difficulty,
                quiz_evaluation=evaluation,
            )
        except Exception:
            pass

        return jsonify({"ok": True, "evaluation": evaluation})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(debug=True, host="0.0.0.0", port=port)
