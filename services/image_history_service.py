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

    def list_all_images_paginated(self, page: int, page_size: int) -> tuple:
        """管理员分页查询所有用户的图片，返回 (items, total)"""
        return db.fetch_paginated("images", page, page_size, order_by="created_at DESC")

    def list_all_images_meta(self, page: int, page_size: int) -> tuple:
        """管理员分页查询，只返回元数据（不含 base64 图片，速度快）"""
        items, total = db.fetch_paginated("images", page, page_size, order_by="created_at DESC")
        for item in items:
            item.pop("image_url", None)
        return items, total

image_history_service = ImageHistoryService()
