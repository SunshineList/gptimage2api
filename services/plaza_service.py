import uuid
import json
from datetime import datetime
from typing import List, Dict, Any
from services.database import db
from services.image_history_service import image_history_service

class PlazaService:
    def publish_to_plaza(self, image_id: str, user_key: str) -> bool:
        image = image_history_service.get_image(image_id)
        if not image or image.get("user_key") != user_key:
            return False
        
        # Check if already published
        existing = db.fetch_one("SELECT id FROM plaza WHERE image_id = ?", (image_id,))
        if existing:
            return True
        
        post_id = str(uuid.uuid4())
        data = {
            "id": post_id,
            "image_id": image_id,
            "prompt": image.get("prompt"),
            "image_url": image.get("image_url"),
            "model": image.get("model"),
            "user_nickname": "匿名用户",
            "created_at": datetime.now().isoformat()
        }
        db.execute(
            "INSERT INTO plaza (id, image_id, data) VALUES (?, ?, ?)",
            (post_id, image_id, json.dumps(data, ensure_ascii=False))
        )
        return True

    def list_plaza(self) -> List[Dict[str, Any]]:
        return db.load_all_data("plaza")

    def unpublish_from_plaza(self, image_id: str, user_key: str) -> bool:
        image = image_history_service.get_image(image_id)
        if not image or image.get("user_key") != user_key:
            return False
        db.delete_data("plaza", "image_id", image_id)
        return True

plaza_service = PlazaService()
