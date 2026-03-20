from __future__ import annotations

from io import BytesIO

import PyPDF2


def extract_text_from_pdf(file_storage) -> str:
    """Extract text from a PDF uploaded through Flask request files."""
    file_bytes = file_storage.read()
    reader = PyPDF2.PdfReader(BytesIO(file_bytes))

    text_parts: list[str] = []
    for page in reader.pages:
        text_parts.append(page.extract_text() or "")

    return "\n".join(text_parts).strip()
