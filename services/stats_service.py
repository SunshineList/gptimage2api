import json
from pathlib import Path
from threading import Lock
from datetime import datetime

class StatsService:
    def __init__(self, store_file: Path):
        self.store_file = store_file
        self._lock = Lock()
        self._stats = self._load_stats()

    def _load_stats(self) -> dict:
        if not self.store_file.exists():
            return {"total_success": 0, "total_fail": 0, "daily": {}}
        try:
            data = json.loads(self.store_file.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {"total_success": 0, "total_fail": 0, "daily": {}}
        except Exception:
            return {"total_success": 0, "total_fail": 0, "daily": {}}

    def _save_stats(self) -> None:
        self.store_file.parent.mkdir(parents=True, exist_ok=True)
        self.store_file.write_text(
            json.dumps(self._stats, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    def record_success(self, model: str = "unknown"):
        with self._lock:
            self._stats["total_success"] = self._stats.get("total_success", 0) + 1
            today = datetime.now().strftime("%Y-%m-%d")
            day_data = self._stats.setdefault("daily", {}).setdefault(today, {"success": 0, "fail": 0})
            day_data["success"] = day_data.get("success", 0) + 1
            self._save_stats()

    def record_fail(self, model: str = "unknown"):
        with self._lock:
            self._stats["total_fail"] = self._stats.get("total_fail", 0) + 1
            today = datetime.now().strftime("%Y-%m-%d")
            day_data = self._stats.setdefault("daily", {}).setdefault(today, {"success": 0, "fail": 0})
            day_data["fail"] = day_data.get("fail", 0) + 1
            self._save_stats()

    def get_stats(self) -> dict:
        with self._lock:
            return dict(self._stats)

from services.config import DATA_DIR
stats_service = StatsService(DATA_DIR / "stats.json")
