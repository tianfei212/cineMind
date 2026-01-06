import os
from typing import Dict
import httpx
from PIL import Image
from io import BytesIO
from datetime import datetime
import hashlib
import pathlib


class ZImageClient:
    def __init__(self, timeout_ms: int = 30000):
        self.base_url = os.getenv("Z_IMAGE_BASE_URL", "")
        self.api_key = os.getenv("Z_IMAGE_API_KEY", "")
        self.timeout = timeout_ms / 1000.0

    def _media_paths(self, image_id: str, ext: str):
        now = datetime.utcnow()
        root = pathlib.Path(__file__).resolve().parents[3] / "backend" / "app" / "media"
        images_dir = root / "images" / f"{now:%Y}" / f"{now:%m}" / f"{now:%d}"
        thumbs_dir = root / "thumbs" / f"{now:%Y}" / f"{now:%m}" / f"{now:%d}"
        images_dir.mkdir(parents=True, exist_ok=True)
        thumbs_dir.mkdir(parents=True, exist_ok=True)
        return images_dir / f"{image_id}.{ext}", thumbs_dir / f"{image_id}_thumb.{ext}"

    async def generate_image(self, prompts: Dict[str, object], params: Dict[str, str]) -> Dict[str, str]:
        image_id = hashlib.sha256((prompts.get("en", "") + prompts.get("zh", "")).encode()).hexdigest()[:12]
        ext = "jpg"
        if not self.base_url or not self.api_key:
            img = Image.new("RGB", (int(params.get("width", "512")), int(params.get("height", "512"))), color=(20, 20, 20))
            buf = BytesIO()
            img.save(buf, format="JPEG")
            data = buf.getvalue()
        else:
            headers = {"Authorization": f"Bearer {self.api_key}"}
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await client.post(f"{self.base_url}/v1/generate", headers=headers, json={"prompts": prompts, "params": params})
                r.raise_for_status()
                data = r.content
        image_path, thumb_path = self._media_paths(image_id, ext)
        with open(image_path, "wb") as f:
            f.write(data)
        img = Image.open(BytesIO(data))
        img.thumbnail((256, 256))
        img.save(thumb_path, format="JPEG")
        rel_image = str(image_path).split("backend/app")[-1]
        rel_thumb = str(thumb_path).split("backend/app")[-1]
        return {"image_id": image_id, "image_url": f"/media{rel_image}", "thumbnail_url": f"/media{rel_thumb}", "mime_type": "image/jpeg", "size_bytes": str(len(data))}

