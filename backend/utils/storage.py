from __future__ import annotations

import os
from datetime import datetime, timezone

from pymongo import MongoClient


def save_training_run(source_type: str, source_preview: str, result: dict) -> None:
    uri = os.getenv("MONGODB_URI")
    if not uri:
        return

    db_name = os.getenv("MONGODB_DB", "sop_ai_training")
    collection_name = os.getenv("MONGODB_COLLECTION", "training_runs")

    client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    collection = client[db_name][collection_name]
    collection.insert_one(
        {
            "source_type": source_type,
            "source_preview": source_preview,
            "result": result,
            "created_at": datetime.now(timezone.utc),
        }
    )
    client.close()
