from __future__ import annotations

import json
import os
import time

import requests

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

DIFFICULTIES = {"beginner", "intermediate", "advanced"}


def _truncate_sop_text(text: str) -> str:
    max_chars = int(os.getenv("LLM_SOP_MAX_CHARS", "12000"))
    cleaned = (text or "").strip()
    if len(cleaned) <= max_chars:
        return cleaned
    return cleaned[:max_chars]


def _groq_chat_completion(messages: list[dict], temperature: float = 0.2) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

    if not api_key:
        raise RuntimeError("Missing GROQ_API_KEY in environment.")

    max_retries = int(os.getenv("GROQ_MAX_RETRIES", "2"))
    backoff_seconds = float(os.getenv("GROQ_BACKOFF_SECONDS", "1.5"))
    request_timeout = int(os.getenv("GROQ_REQUEST_TIMEOUT_SECONDS", "45"))

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
                timeout=request_timeout,
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


def _build_prompt(text: str, difficulty: str) -> str:
    return f"""
You are an SOP training assistant.
Read the SOP and return only valid JSON with this exact shape:
{{
  \"summary\": [\"point 1\", \"point 2\"],
  \"training_steps\": [\"step 1\", \"step 2\"],
  \"quiz_questions\": [
    {{\"question\": \"...\", \"answer\": \"...\"}}
  ],
  \"insights\": {{
    \"missing_steps\": [\"...\"],
    \"improvement_suggestions\": [\"...\"],
    \"safety_or_compliance_notes\": [\"...\"]
  }}
}}

Constraints:
- Keep summary concise (4 to 8 bullet points).
- Keep training_steps actionable and ordered.
- Generate 3 to 5 quiz questions.
- Adapt depth for difficulty: beginner uses simpler wording, intermediate balances depth and clarity, advanced includes implementation detail.
- Insights must point out gaps and actionable improvements.
- Do not include markdown fences.

Selected Difficulty:
{difficulty}

SOP:
{text}
""".strip()


def _fallback_output(raw_content: str, difficulty: str) -> dict:
    return {
        "summary": ["Model output could not be parsed as JSON."],
        "training_steps": ["Try a shorter SOP and run again."],
        "quiz_questions": [],
        "insights": {
            "missing_steps": [],
            "improvement_suggestions": [],
            "safety_or_compliance_notes": [],
        },
        "difficulty": difficulty,
        "raw_output": raw_content,
    }


def _normalize_output(payload: dict, difficulty: str, raw_content: str | None = None) -> dict:
    summary = payload.get("summary") if isinstance(payload.get("summary"), list) else []
    training_steps = (
        payload.get("training_steps") if isinstance(payload.get("training_steps"), list) else []
    )
    quiz_questions = payload.get("quiz_questions") if isinstance(payload.get("quiz_questions"), list) else []
    insights = payload.get("insights") if isinstance(payload.get("insights"), dict) else {}

    normalized_questions = []
    for item in quiz_questions:
        if isinstance(item, dict):
            normalized_questions.append(
                {
                    "question": str(item.get("question") or "").strip(),
                    "answer": str(item.get("answer") or "").strip(),
                }
            )

    normalized = {
        "summary": [str(item).strip() for item in summary if str(item).strip()],
        "training_steps": [str(item).strip() for item in training_steps if str(item).strip()],
        "quiz_questions": normalized_questions,
        "insights": {
            "missing_steps": [
                str(item).strip() for item in (insights.get("missing_steps") or []) if str(item).strip()
            ]
            if isinstance(insights.get("missing_steps"), list)
            else [],
            "improvement_suggestions": [
                str(item).strip()
                for item in (insights.get("improvement_suggestions") or [])
                if str(item).strip()
            ]
            if isinstance(insights.get("improvement_suggestions"), list)
            else [],
            "safety_or_compliance_notes": [
                str(item).strip()
                for item in (insights.get("safety_or_compliance_notes") or [])
                if str(item).strip()
            ]
            if isinstance(insights.get("safety_or_compliance_notes"), list)
            else [],
        },
        "difficulty": difficulty,
    }

    if raw_content:
        normalized["raw_output"] = raw_content
    return normalized


def generate_output(text: str, difficulty: str = "intermediate") -> dict:
    normalized_difficulty = difficulty.strip().lower()
    if normalized_difficulty not in DIFFICULTIES:
        normalized_difficulty = "intermediate"

    sop_text = _truncate_sop_text(text)

    content = _groq_chat_completion(
        messages=[
            {"role": "system", "content": "Return strict JSON only."},
            {"role": "user", "content": _build_prompt(sop_text, normalized_difficulty)},
        ],
        temperature=0.2,
    )

    try:
        parsed = json.loads(content)
        if not isinstance(parsed, dict):
            return _fallback_output(content, normalized_difficulty)
        return _normalize_output(parsed, normalized_difficulty, raw_content=content)
    except Exception:
        return _fallback_output(content, normalized_difficulty)


def evaluate_quiz_answers(
    sop_text: str,
    quiz_questions: list[dict],
    user_answers: list[str],
    difficulty: str,
) -> dict:
    normalized_difficulty = difficulty.strip().lower() if difficulty else "intermediate"
    if normalized_difficulty not in DIFFICULTIES:
        normalized_difficulty = "intermediate"

    prompt = f"""
You are an evaluation assistant.
Evaluate the learner answers against SOP context and expected quiz answers.
Return strict JSON with this exact shape:
{{
  "score": 0,
  "total": 0,
  "feedback": "...",
  "per_question_feedback": [
    {{
      "question": "...",
      "learner_answer": "...",
      "is_correct": true,
      "feedback": "..."
    }}
  ],
  "revision_focus": ["..."]
}}

Rules:
- score must be an integer between 0 and total.
- total must match number of evaluated questions.
- feedback must be concise and actionable.
- revision_focus should call out steps/topics to revise.

Difficulty: {normalized_difficulty}

SOP Context:
{sop_text}

Quiz Questions and Expected Answers:
{json.dumps(quiz_questions, ensure_ascii=True)}

Learner Answers:
{json.dumps(user_answers, ensure_ascii=True)}
""".strip()

    content = _groq_chat_completion(
        messages=[
            {"role": "system", "content": "Return strict JSON only."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.1,
    )

    try:
        parsed = json.loads(content)
    except Exception:
        parsed = {}

    total = len(quiz_questions)
    safe_score = parsed.get("score") if isinstance(parsed.get("score"), int) else 0
    safe_score = max(0, min(safe_score, total))

    per_question_feedback = (
        parsed.get("per_question_feedback")
        if isinstance(parsed.get("per_question_feedback"), list)
        else []
    )
    normalized_feedback = []
    for index, item in enumerate(per_question_feedback[:total]):
        if not isinstance(item, dict):
            continue
        question = str(item.get("question") or quiz_questions[index].get("question") or "Question").strip()
        learner_answer = str(
            item.get("learner_answer") or (user_answers[index] if index < len(user_answers) else "")
        ).strip()
        normalized_feedback.append(
            {
                "question": question,
                "learner_answer": learner_answer,
                "is_correct": bool(item.get("is_correct")),
                "feedback": str(item.get("feedback") or "").strip() or "No feedback returned.",
            }
        )

    return {
        "score": safe_score,
        "total": total,
        "feedback": str(parsed.get("feedback") or "Quiz evaluated successfully.").strip(),
        "per_question_feedback": normalized_feedback,
        "revision_focus": [
            str(item).strip() for item in (parsed.get("revision_focus") or []) if str(item).strip()
        ]
        if isinstance(parsed.get("revision_focus"), list)
        else [],
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
