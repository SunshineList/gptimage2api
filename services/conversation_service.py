from typing import List, Dict, Any, Optional
from datetime import datetime
import json
from services.database import db

class ConversationService:
    def list_conversations(self, user_key: str) -> List[Dict[str, Any]]:
        rows = db.fetch_all(
            "SELECT data FROM conversations WHERE user_key = ? ORDER BY updated_at DESC", 
            (user_key,)
        )
        return [json.loads(row["data"]) for row in rows]

    def save_conversation(self, user_key: str, conversation_id: str, data: Dict[str, Any]):
        # 确保数据中包含最新的时间戳
        data["updatedAt"] = datetime.now().isoformat()
        db.execute(
            "INSERT OR REPLACE INTO conversations (id, user_key, data, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
            (conversation_id, user_key, json.dumps(data, ensure_ascii=False))
        )

    def delete_conversation(self, user_key: str, conversation_id: str):
        db.execute(
            "DELETE FROM conversations WHERE id = ? AND user_key = ?",
            (conversation_id, user_key)
        )

    def clear_conversations(self, user_key: str):
        db.execute(
            "DELETE FROM conversations WHERE user_key = ?",
            (user_key,)
        )

conversation_service = ConversationService()
