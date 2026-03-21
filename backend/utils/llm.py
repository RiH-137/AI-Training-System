from __future__ import annotations

import json
import os
import time

import requests

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

DIFFICULTIES = {"beginner", "intermediate", "advanced"}


class LLMTemporaryError(RuntimeError):
    def __init__(self, message: str, status_code: int = 503):
        super().__init__(message)
        self.status_code = status_code


def _truncate_sop_text(text: str) -> str:
    max_chars = int(os.getenv("LLM_SOP_MAX_CHARS", "12000"))
    cleaned = (text or "").strip()
    if len(cleaned) <= max_chars:
        return cleaned
    return cleaned[:max_chars]


def _extract_api_error_message(response: requests.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        payload = None

    if isinstance(payload, dict):
        error_payload = payload.get("error")
        if isinstance(error_payload, dict):
            message = str(error_payload.get("message") or "").strip()
            if message:
                return message
        message = str(payload.get("message") or "").strip()
        if message:
            return message

    return (response.text or "").strip()[:500]


def _retry_delay_seconds(response: requests.Response | None, attempt: int, base_backoff: float) -> float:
    if response is not None:
        retry_after = response.headers.get("Retry-After")
        if retry_after:
            try:
                parsed = float(retry_after)
                if parsed >= 0:
                    return parsed
            except ValueError:
                pass
    return base_backoff * (2**attempt)


def _groq_chat_completion(messages: list[dict], temperature: float = 0.2) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    base_model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
    
    # Use fallback models if rate-limited
    models_to_try = [
        base_model,
        "llama3-8b-8192",
        "mixtral-8x7b-32768",
        "gemma2-9b-it"
    ]

    if not api_key:
        raise RuntimeError("Missing GROQ_API_KEY in environment.")

    max_retries = int(os.getenv("GROQ_MAX_RETRIES", "4"))
    backoff_seconds = float(os.getenv("GROQ_BACKOFF_SECONDS", "1.5"))
    request_timeout = int(os.getenv("GROQ_REQUEST_TIMEOUT_SECONDS", "45"))

    last_error = None
    last_response = None
    for attempt in range(max_retries + 1):
        # Rotate model to evade rate limits on specific models
        current_model = models_to_try[attempt % len(models_to_try)]
        
        try:
            response = requests.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": current_model,
                    "temperature": temperature,
                    "messages": messages,
                },
                timeout=request_timeout,
            )
            last_response = response

            # Retry on API throttling or temporary upstream failures.
            if response.status_code in (429, 500, 502, 503, 504):
                if attempt < max_retries:
                    wait_for = _retry_delay_seconds(response=response, attempt=attempt, base_backoff=backoff_seconds)
                    time.sleep(wait_for)
                    continue

            response.raise_for_status()
            payload = response.json()
            return str(payload["choices"][0]["message"]["content"])
        except requests.RequestException as exc:
            last_error = exc
            if attempt < max_retries:
                wait_for = _retry_delay_seconds(response=last_response, attempt=attempt, base_backoff=backoff_seconds)
                time.sleep(wait_for)
                continue
            break
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            last_error = exc
            break

    if isinstance(last_response, requests.Response):
        status_code = int(last_response.status_code)
        api_message = _extract_api_error_message(last_response)

        if status_code == 429:
            raise LLMTemporaryError(
                "Groq API is temporarily rate-limited. Please wait a few seconds and try again.",
                status_code=429,
            ) from last_error

        if status_code in (500, 502, 503, 504):
            raise LLMTemporaryError(
                "Groq API is temporarily unavailable. Please retry in a few seconds.",
                status_code=503,
            ) from last_error

        if status_code in (401, 403):
            raise RuntimeError("Groq authentication failed. Check GROQ_API_KEY and model access.") from last_error

        if api_message:
            raise RuntimeError(f"Groq API request failed ({status_code}): {api_message}") from last_error

        raise RuntimeError(f"Groq API request failed with status {status_code}.") from last_error

    if last_error:
        raise LLMTemporaryError(
            "Unable to reach Groq API right now. Please retry in a few seconds.",
            status_code=503,
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


def _fallback_output(raw_content: str, difficulty: str, error_message: str | None = None) -> dict:
    summary_message = "Model output could not be parsed as JSON."
    step_message = "Try a shorter SOP and run again."
    if error_message:
        summary_message = f"Generation temporarily unavailable: {error_message}"
        step_message = "Please retry in a few seconds."

    return {
        "summary": [summary_message],
        "training_steps": [step_message],
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

    try:
        content = _groq_chat_completion(
            messages=[
                {"role": "system", "content": "Return strict JSON only."},
                {"role": "user", "content": _build_prompt(sop_text, normalized_difficulty)},
            ],
            temperature=0.2,
        )
    except Exception as exc:
        return _fallback_output(
            raw_content="",
            difficulty=normalized_difficulty,
            error_message=str(exc),
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

    try:
        content = _groq_chat_completion(
            messages=[
                {"role": "system", "content": "Return strict JSON only."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
        )
    except (LLMTemporaryError, Exception) as exc:
        return {
            "score": 0,
            "total": len(quiz_questions),
            "feedback": f"Evaluation temporarily unavailable: {exc}",
            "per_question_feedback": [],
            "revision_focus": ["Retry evaluation in a few seconds."],
        }

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

    try:
        return _groq_chat_completion(
            messages=[
                {"role": "system", "content": "Answer clearly and concisely in plain text."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
        ).strip()
    except (LLMTemporaryError, Exception) as exc:
        return f"Unable to generate response right now: {exc}"
