import sqlite3
import json
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional

from services.config import config

class Database:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._lock = Lock()
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        # 启用 WAL 模式以提高并发性能
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    def _init_db(self):
        with self._lock:
            conn = self._get_connection()
            try:
                # 账户表
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS accounts (
                        access_token TEXT PRIMARY KEY,
                        data TEXT NOT NULL
                    )
                """)
                # 用户表
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        key TEXT PRIMARY KEY,
                        data TEXT NOT NULL
                    )
                """)
                # 统计表
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS stats (
                        id TEXT PRIMARY KEY,
                        data TEXT NOT NULL
                    )
                """)
                # CPA 配置池表
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS cpa_pools (
                        id TEXT PRIMARY KEY,
                        data TEXT NOT NULL
                    )
                """)
                # Sub2API 服务器表
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS sub2api_servers (
                        id TEXT PRIMARY KEY,
                        data TEXT NOT NULL
                    )
                """)
                # 会话表 (保存 API Key)
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS sessions (
                        id TEXT PRIMARY KEY,
                        data TEXT NOT NULL
                    )
                """)
                # 图片历史表
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS images (
                        id TEXT PRIMARY KEY,
                        user_key TEXT NOT NULL,
                        data TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                # 广场表
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS plaza (
                        id TEXT PRIMARY KEY,
                        image_id TEXT NOT NULL,
                        data TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                # 对话记录表 (用于 Image Studio)
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS conversations (
                        id TEXT PRIMARY KEY,
                        user_key TEXT NOT NULL,
                        data TEXT NOT NULL,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                conn.commit()
            finally:
                conn.close()

    def execute(self, query: str, params: tuple = ()):
        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.execute(query, params)
                conn.commit()
                return cursor
            finally:
                conn.close()

    def fetch_all(self, query: str, params: tuple = ()) -> List[sqlite3.Row]:
        conn = self._get_connection()
        try:
            return conn.execute(query, params).fetchall()
        finally:
            conn.close()

    def fetch_one(self, query: str, params: tuple = ()) -> Optional[sqlite3.Row]:
        conn = self._get_connection()
        try:
            return conn.execute(query, params).fetchone()
        finally:
            conn.close()

    # 辅助方法：保存/更新 JSON 数据
    def save_data(self, table: str, key_col: str, key_val: str, data: Dict[str, Any]):
        query = f"INSERT OR REPLACE INTO {table} ({key_col}, data) VALUES (?, ?)"
        self.execute(query, (key_val, json.dumps(data, ensure_ascii=False)))

    def load_all_data(self, table: str) -> List[Dict[str, Any]]:
        rows = self.fetch_all(f"SELECT data FROM {table} ORDER BY rowid DESC")
        return [json.loads(row["data"]) for row in rows]

    def load_data_by_column(self, table: str, column: str, value: Any) -> List[Dict[str, Any]]:
        rows = self.fetch_all(f"SELECT data FROM {table} WHERE {column} = ? ORDER BY rowid DESC", (value,))
        return [json.loads(row["data"]) for row in rows]

    def load_one_data(self, table: str, key_col: str, key_val: str) -> Optional[Dict[str, Any]]:
        row = self.fetch_one(f"SELECT data FROM {table} WHERE {key_col} = ?", (key_val,))
        return json.loads(row["data"]) if row else None

    def delete_data(self, table: str, key_col: str, key_val: str):
        self.execute(f"DELETE FROM {table} WHERE {key_col} = ?", (key_val,))

db = Database(config.db_path)
