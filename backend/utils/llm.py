from __future__ import annotations

import os
import time

import requests

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


def _groq_chat_completion(messages: list[dict], temperature: float = 0.2) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

    if not api_key:
        raise RuntimeError("Missing GROQ_API_KEY in environment.")

    max_retries = int(os.getenv("GROQ_MAX_RETRIES", "5"))
    backoff_seconds = float(os.getenv("GROQ_BACKOFF_SECONDS", "1.5"))

    last_error = None
    for attempt in range(max_retries + 1):
        try:
            response = requests.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "temperature": temperature,
                    "messages": messages,
                },
                timeout=90,
            )

            # Retry on API throttling or temporary upstream failures.
            if response.status_code in (429, 500, 502, 503, 504):
                if attempt < max_retries:
                    retry_after = response.headers.get("Retry-After")
                    if retry_after and retry_after.isdigit():
                        wait_for = float(retry_after)
                    else:
                        wait_for = backoff_seconds * (2**attempt)
                    time.sleep(wait_for)
                    continue

            response.raise_for_status()
            payload = response.json()
            return payload["choices"][0]["message"]["content"]
        except requests.RequestException as exc:
            last_error = exc
            if attempt < max_retries:
                time.sleep(backoff_seconds * (2**attempt))
                continue
            break

    if last_error:
        raise RuntimeError(
            "Groq API is temporarily rate-limited. Please wait a few seconds and try again."
        ) from last_error

    raise RuntimeError("Unable to get response from Groq API.")


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
    content = _groq_chat_completion(
        messages=[
            {"role": "system", "content": "Return strict JSON only."},
            {"role": "user", "content": _build_prompt(text)},
        ],
        temperature=0.2,
    )

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
    prompt = f"""
You are an SOP assistant.
Answer the user's question using only the SOP context below.
If the answer is not present, clearly say it is not available in the SOP.

SOP Context:
{sop_text}

Question:
{question}
""".strip()

    return _groq_chat_completion(
        messages=[
            {"role": "system", "content": "Answer clearly and concisely in plain text."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    ).strip()
