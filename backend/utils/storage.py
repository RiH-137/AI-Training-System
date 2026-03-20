from __future__ import annotations

import os
from datetime import datetime, timezone

from pymongo import MongoClient


def _get_collection():
    uri = os.getenv("MONGODB_URI")
    if not uri:
        return None

    db_name = os.getenv("MONGODB_DB", "sop_ai_training")
    collection_name = os.getenv("MONGODB_COLLECTION", "training_runs")

    client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    return client, client[db_name][collection_name]


def save_training_run(
    session_id: str,
    source_type: str,
    source_preview: str,
    source_content: str,
    result: dict,
) -> None:
    collection_data = _get_collection()
    if not collection_data:
        return

    client, collection = collection_data
    collection.insert_one(
        {
            "session_id": session_id,
            "source_type": source_type,
            "source_preview": source_preview,
            "source_content": source_content,
            "result": result,
            "created_at": datetime.now(timezone.utc),
        }
    )
    client.close()


def get_training_history(session_id: str, limit: int = 20) -> list[dict]:
    collection_data = _get_collection()
    if not collection_data:
        return []

    client, collection = collection_data
    records = list(
        collection.find({"session_id": session_id}).sort("created_at", -1).limit(limit)
    )

    for row in records:
        row["_id"] = str(row["_id"])
        created_at = row.get("created_at")
        if created_at and hasattr(created_at, "isoformat"):
            row["created_at"] = created_at.isoformat()

    client.close()
    return records
