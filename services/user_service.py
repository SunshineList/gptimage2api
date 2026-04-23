import json
import secrets
import string
from pathlib import Path
from threading import Lock
from datetime import datetime

class UserService:
    def __init__(self, store_file: Path):
        self.store_file = store_file
        self._lock = Lock()
        self._users = self._load_users()

    def _load_users(self) -> list[dict]:
        if not self.store_file.exists():
            return []
        try:
            data = json.loads(self.store_file.read_text(encoding="utf-8"))
            return data if isinstance(data, list) else []
        except Exception:
            return []

    def _save_users(self) -> None:
        self.store_file.parent.mkdir(parents=True, exist_ok=True)
        self.store_file.write_text(
            json.dumps(self._users, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

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
                self._save_users()
                return True
            return False

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
