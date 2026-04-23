import json
from pathlib import Path
from threading import Lock
from datetime import datetime
from services.database import db

class StatsService:
    def __init__(self, store_file: Path):
        self.store_file = store_file
        self._lock = Lock()
        self._stats = self._load_stats()

    def _load_stats(self) -> dict:
        data = db.load_all_data("stats")
        if data:
            return data[0] if data else {"total_success": 0, "total_fail": 0, "daily": {}}
        
        if self.store_file.exists():
            try:
                old_data = json.loads(self.store_file.read_text(encoding="utf-8"))
                if isinstance(old_data, dict):
                    print(f"检测到旧的 {self.store_file}，正在迁移统计数据到 SQLite...")
                    db.save_data("stats", "id", "global", old_data)
                    return old_data
            except Exception as e:
                print(f"从 JSON 迁移统计失败: {e}")
        return {"total_success": 0, "total_fail": 0, "daily": {}}

    def _save_stats(self) -> None:
        db.save_data("stats", "id", "global", self._stats)

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
