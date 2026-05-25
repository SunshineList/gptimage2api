import base64
import io
import uuid
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

from PIL import Image

from services.database import db

THUMBNAIL_MAX_PX = 400
THUMBNAIL_JPEG_QUALITY = 75


def _make_thumbnail(image_url: str) -> str:
    """从 data:image/...;base64,... URL 生成 JPEG 缩略图 data URL"""
    try:
        header, b64 = image_url.split(",", 1)
        raw = base64.b64decode(b64)
        img = Image.open(io.BytesIO(raw))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        w, h = img.size
        if max(w, h) > THUMBNAIL_MAX_PX:
            ratio = THUMBNAIL_MAX_PX / max(w, h)
            img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=THUMBNAIL_JPEG_QUALITY)
        return f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"
    except Exception:
        return ""


class ImageHistoryService:
    def save_image(self, user_key: str, prompt: str, image_url: str, model: str, **extra) -> str:
        image_id = str(uuid.uuid4())
        thumbnail_url = _make_thumbnail(image_url)
        data = {
            "id": image_id,
            "user_key": user_key,
            "prompt": prompt,
            "image_url": image_url,
            "thumbnail_url": thumbnail_url,
            "model": model,
            "created_at": datetime.now().isoformat(),
            "is_public": False,
            **extra,
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

    def get_images_batch(self, image_ids: list[str], user_key: str | None = None) -> list[dict]:
        """批量获取图片数据，可选择按 user_key 过滤"""
        if not image_ids:
            return []
        placeholders = ",".join(["?" for _ in image_ids])
        if user_key:
            rows = db.fetch_all(
                f"SELECT data FROM images WHERE id IN ({placeholders}) AND user_key = ?",
                (*image_ids, user_key),
            )
        else:
            rows = db.fetch_all(
                f"SELECT data FROM images WHERE id IN ({placeholders})",
                tuple(image_ids),
            )
        return [json.loads(row["data"]) for row in rows]

    def find_recent_images_by_prompt(
        self, user_key: str, queries: list[dict]
    ) -> list[dict]:
        """根据 prompt 和时间查找最近生成的图片，用于恢复孤立的生成结果。
        每个 query: {prompt, after_time}. 返回: [{prompt, image_id, image_url?, thumbnail_url?}]"""
        if not queries:
            return []
        results = []
        for q in queries:
            prompt = q.get("prompt", "")
            after_time = q.get("after_time", "")
            if not prompt:
                continue
            rows = db.fetch_all(
                "SELECT data FROM images WHERE user_key = ? AND json_extract(data, '$.prompt') = ? "
                "AND json_extract(data, '$.created_at') >= ? "
                "ORDER BY json_extract(data, '$.created_at') ASC LIMIT 10",
                (user_key, prompt, after_time),
            )
            for row in rows:
                img = json.loads(row["data"])
                results.append({
                    "prompt": prompt,
                    "image_id": img["id"],
                    "image_url": img.get("image_url", ""),
                })
        return results

    def list_all_images_meta(self, page: int, page_size: int) -> tuple:
        """管理员分页查询，只返回元数据 + 缩略图（不含原图 base64）"""
        items, total = db.fetch_paginated("images", page, page_size, order_by="created_at DESC")
        for item in items:
            # 缩略图缺失时尝试从原图重新生成
            if not item.get("thumbnail_url") and item.get("image_url"):
                item["thumbnail_url"] = _make_thumbnail(item["image_url"])
            item.pop("image_url", None)
            if not item.get("thumbnail_url"):
                item["thumbnail_url"] = ""
        return items, total

image_history_service = ImageHistoryService()
