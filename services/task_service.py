import json
from datetime import datetime, timedelta
from typing import Optional

from services.database import db


class GenerationTaskService:
    def create_task(self, task_id: str, user_key: str, prompt: str, model: str) -> None:
        data = {
            "id": task_id,
            "user_key": user_key,
            "prompt": prompt,
            "model": model,
            "status": "processing",
            "image_ids": [],
            "error": None,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }
        db.execute(
            "INSERT OR REPLACE INTO generation_tasks (id, user_key, data) VALUES (?, ?, ?)",
            (task_id, user_key, json.dumps(data, ensure_ascii=False)),
        )

    def complete_task(self, task_id: str, image_ids: list[str]) -> None:
        existing = db.load_one_data("generation_tasks", "id", task_id)
        if not existing:
            return
        existing["status"] = "completed"
        existing["image_ids"] = image_ids
        existing["updated_at"] = datetime.now().isoformat()
        db.execute(
            "UPDATE generation_tasks SET data = ? WHERE id = ?",
            (json.dumps(existing, ensure_ascii=False), task_id),
        )

    def fail_task(self, task_id: str, error: str) -> None:
        existing = db.load_one_data("generation_tasks", "id", task_id)
        if not existing:
            return
        existing["status"] = "failed"
        existing["error"] = error
        existing["updated_at"] = datetime.now().isoformat()
        db.execute(
            "UPDATE generation_tasks SET data = ? WHERE id = ?",
            (json.dumps(existing, ensure_ascii=False), task_id),
        )

    def get_task(self, task_id: str) -> dict | None:
        return db.load_one_data("generation_tasks", "id", task_id)

    def find_by_prompt(
        self, user_key: str, queries: list[dict]
    ) -> list[dict]:
        if not queries:
            return []
        results = []
        for q in queries:
            prompt = q.get("prompt", "")
            after_time = q.get("after_time", "")
            if not prompt:
                continue
            try:
                after_dt = datetime.fromisoformat(after_time) - timedelta(seconds=120)
                after_time = after_dt.isoformat()
            except Exception:
                pass
            rows = db.fetch_all(
                "SELECT data FROM generation_tasks WHERE user_key = ? "
                "AND json_extract(data, '$.prompt') = ? "
                "AND json_extract(data, '$.created_at') >= ? "
                "ORDER BY json_extract(data, '$.created_at') DESC LIMIT 5",
                (user_key, prompt, after_time),
            )
            for row in rows:
                task = json.loads(row["data"])
                results.append({
                    "prompt": prompt,
                    "task_id": task["id"],
                    "status": task["status"],
                    "image_ids": task.get("image_ids", []),
                    "error": task.get("error"),
                })
        return results


task_service = GenerationTaskService()
