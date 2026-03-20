from __future__ import annotations

import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from utils.llm import generate_output
from utils.parser import extract_text_from_pdf
from utils.storage import save_training_run

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": [os.getenv("ALLOWED_ORIGIN", "http://localhost:3000")]}})


@app.get("/health")
def health_check():
    return jsonify({"status": "ok"})


@app.post("/process")
def process_sop():
    file = request.files.get("file")
    text = (request.form.get("text") or "").strip()

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
            save_training_run(source_type=source_type, source_preview=preview, result=result)
        except Exception:
            # Saving history is optional and should not break the API response.
            pass

        return jsonify({"ok": True, "result": result})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(debug=True, host="0.0.0.0", port=port)
