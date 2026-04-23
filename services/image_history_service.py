import uuid
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from services.database import db

class ImageHistoryService:
    def save_image(self, user_key: str, prompt: str, image_url: str, model: str) -> str:
        image_id = str(uuid.uuid4())
        data = {
            "id": image_id,
            "user_key": user_key,
            "prompt": prompt,
            "image_url": image_url,
            "model": model,
            "created_at": datetime.now().isoformat(),
            "is_public": False
        }
        db.execute(
            "INSERT INTO images (id, user_key, data) VALUES (?, ?, ?)",
            (image_id, user_key, json.dumps(data, ensure_ascii=False))
        )
        return image_id

    def list_images(self, user_key: str) -> List[Dict[str, Any]]:
        return db.load_data_by_column("images", "user_key", user_key)

    def delete_image(self, image_id: str, user_key: str) -> bool:
        image = db.load_one_data("images", "id", image_id)
        if image and image.get("user_key") == user_key:
            db.delete_data("images", "id", image_id)
            db.delete_data("plaza", "image_id", image_id)
            return True
        return False

    def get_image(self, image_id: str) -> Optional[Dict[str, Any]]:
        return db.load_one_data("images", "id", image_id)

image_history_service = ImageHistoryService()
