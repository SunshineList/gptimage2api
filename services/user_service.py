import json
import secrets
import string
from typing import Optional, List, Dict
from pathlib import Path
from threading import Lock
from datetime import datetime
from services.database import db

class UserService:
    def __init__(self, store_file: Path):
        self.store_file = store_file
        self._lock = Lock()
        self._users = self._load_users()

    def _load_users(self) -> list[dict]:
        data = db.load_all_data("users")
        if data:
            return data
        
        if self.store_file.exists():
            try:
                old_data = json.loads(self.store_file.read_text(encoding="utf-8"))
                if isinstance(old_data, list):
                    print(f"检测到旧的 {self.store_file}，正在迁移 {len(old_data)} 个用户到 SQLite...")
                    for user in old_data:
                        db.save_data("users", "key", user["key"], user)
                    return old_data
            except Exception as e:
                print(f"从 JSON 迁移用户失败: {e}")
        return []

    def _save_users(self) -> None:
        for user in self._users:
            db.save_data("users", "key", user["key"], user)

    def generate_key(self, length: int = 32) -> str:
        alphabet = string.ascii_letters + string.digits
        return "sk-" + "".join(secrets.choice(alphabet) for _ in range(length))

    def create_user(self, name: str, quota: int) -> dict:
        with self._lock:
            key = self.generate_key()
            user = {
                "key": key,
                "name": name,
                "quota": quota,
                "used": 0,
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "status": "active"
            }
            self._users.append(user)
            self._save_users()
            return user

    def list_users(self) -> list[dict]:
        with self._lock:
            return list(self._users)

    def delete_user(self, key: str) -> bool:
        with self._lock:
            initial_count = len(self._users)
            self._users = [u for u in self._users if u.get("key") != key]
            if len(self._users) < initial_count:
                db.delete_data("users", "key", key)
                return True
            return False

    def create_session(self, user_key: str) -> str:
        session_id = secrets.token_hex(32)
        session_data = {
            "id": session_id,
            "user_key": user_key,
            "created_at": datetime.now().isoformat()
        }
        db.save_data("sessions", "id", session_id, session_data)
        return session_id

    def get_session(self, session_id: str) -> Optional[dict]:
        return db.load_one_data("sessions", "id", session_id)

    def delete_session(self, session_id: str):
        db.delete_data("sessions", "id", session_id)

    def get_user(self, key: str) -> dict | None:
        with self._lock:
            for user in self._users:
                if user.get("key") == key:
                    return dict(user)
            return None

    def use_quota(self, key: str, amount: int = 1) -> bool:
        with self._lock:
            for user in self._users:
                if user.get("key") == key:
                    if user.get("quota", 0) != -1 and user.get("used", 0) + amount > user.get("quota", 0):
                        return False
                    user["used"] = user.get("used", 0) + amount
                    user["last_used_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    self._save_users()
                    return True
            return False

    def update_user(self, key: str, updates: dict) -> dict | None:
        with self._lock:
            for user in self._users:
                if user.get("key") == key:
                    user.update(updates)
                    self._save_users()
                    return dict(user)
            return None

from services.config import DATA_DIR
user_service = UserService(DATA_DIR / "users.json")
