from __future__ import annotations

import os
import re

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from utils.llm import generate_output
from utils.parser import extract_text_from_pdf
from utils.storage import get_training_history, save_training_run

load_dotenv()

app = Flask(__name__)


def _allowed_origins() -> list[str]:
    origins = os.getenv("ALLOWED_ORIGINS", "").strip()
    if origins:
        return [origin.strip() for origin in origins.split(",") if origin.strip()]

    return [
        os.getenv("ALLOWED_ORIGIN", "http://localhost:3000").strip(),
        "https://ai-training-system-dusky.vercel.app",
    ]


def _origin_allowed(origin: str | None, allowed_origins: list[str]) -> bool:
    if not origin:
        return False

    normalized = origin.rstrip("/")
    allowed_set = {item.rstrip("/") for item in allowed_origins}
    if normalized in allowed_set:
        return True

    return normalized.endswith(".vercel.app")


ALLOWED_ORIGINS = _allowed_origins()

CORS(
    app,
    resources={r"/*": {"origins": ALLOWED_ORIGINS}},
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


SESSION_ID_REGEX = re.compile(r"^[A-Za-z0-9]{8}$")


@app.get("/health")
def health_check():
    return jsonify({"status": "ok"})


@app.post("/process")
def process_sop():
    file = request.files.get("file")
    text = (request.form.get("text") or "").strip()
    session_id = (request.form.get("session_id") or "").strip()

    if not SESSION_ID_REGEX.match(session_id):
        return jsonify({"error": "Valid 8-character alphanumeric session_id is required."}), 400

    try:
        if file and file.filename:
            content = extract_text_from_pdf(file)
            source_type = "pdf"
        elif text:
            content = text
            source_type = "text"
        else:
            return jsonify({"error": "Provide either a PDF file or SOP text."}), 400

        if not content or len(content.strip()) < 20:
            return jsonify({"error": "SOP content is too short to process."}), 400

        result = generate_output(content)

        preview = content[:240]
        try:
            save_training_run(
                session_id=session_id,
                source_type=source_type,
                source_preview=preview,
                source_content=content,
                result=result,
            )
        except Exception:
            # Saving history is optional and should not break the API response.
            pass

        return jsonify({"ok": True, "result": result})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.get("/history/<session_id>")
def history_by_session(session_id: str):
    if not SESSION_ID_REGEX.match(session_id):
        return jsonify({"error": "Session ID must be 8 alphanumeric characters."}), 400

    try:
        history = get_training_history(session_id=session_id)
        return jsonify({"ok": True, "session_id": session_id, "history": history})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.after_request
def apply_dynamic_cors(response):
    origin = request.headers.get("Origin")
    if _origin_allowed(origin, ALLOWED_ORIGINS):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(debug=True, host="0.0.0.0", port=port)
