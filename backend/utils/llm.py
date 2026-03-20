from __future__ import annotations

import os

import requests

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


def _build_prompt(text: str) -> str:
    return f"""
You are an SOP training assistant.
Read the SOP and return only valid JSON with this exact shape:
{{
  \"summary\": [\"point 1\", \"point 2\"],
  \"training_steps\": [\"step 1\", \"step 2\"],
  \"quiz_questions\": [
    {{\"question\": \"...\", \"answer\": \"...\"}}
  ]
}}

Constraints:
- Keep summary concise (4 to 8 bullet points).
- Keep training_steps actionable and ordered.
- Generate 3 to 5 quiz questions.
- Do not include markdown fences.

SOP:
{text}
""".strip()


def generate_output(text: str) -> dict:
    api_key = os.getenv("GROQ_API_KEY")
    model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

    if not api_key:
        raise RuntimeError("Missing GROQ_API_KEY in environment.")

    response = requests.post(
        GROQ_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": "Return strict JSON only."},
                {"role": "user", "content": _build_prompt(text)},
            ],
        },
        timeout=90,
    )
    response.raise_for_status()

    payload = response.json()
    content = payload["choices"][0]["message"]["content"]

    try:
        return requests.models.complexjson.loads(content)
    except Exception:
        return {
            "summary": ["Model output could not be parsed as JSON."],
            "training_steps": ["Try a shorter SOP and run again."],
            "quiz_questions": [],
            "raw_output": content,
        }


def answer_question_from_sop(sop_text: str, question: str) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

    if not api_key:
        raise RuntimeError("Missing GROQ_API_KEY in environment.")

    prompt = f"""
You are an SOP assistant.
Answer the user's question using only the SOP context below.
If the answer is not present, clearly say it is not available in the SOP.

SOP Context:
{sop_text}

Question:
{question}
""".strip()

    response = requests.post(
        GROQ_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": "Answer clearly and concisely in plain text."},
                {"role": "user", "content": prompt},
            ],
        },
        timeout=90,
    )
    response.raise_for_status()

    payload = response.json()
    return payload["choices"][0]["message"]["content"].strip()
