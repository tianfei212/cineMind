import os
import pathlib
import hashlib
import base64
from typing import Dict, Optional, Tuple
from io import BytesIO
from datetime import datetime

import httpx
from PIL import Image

from ..services.config_service import ConfigService
from ..utils.logger import get_logger

class ZImageClient:
    def __init__(self, timeout_ms: int = 120000):
        cfg = ConfigService().load() or {}
        endpoints = (cfg.get("endpoints") or {})
        keys = (cfg.get("api_keys") or {})
        models = (cfg.get("models") or {})
        
        self.base_url = endpoints.get("z_image") or os.getenv("Z_IMAGE_BASE_URL", "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation")
        self.api_key = keys.get("z_image") or os.getenv("Z_IMAGE_API_KEY", "")
        # 注意：z-image-turbo 是模型名，不是 URL 的一部分
        self.model = models.get("z_image") or os.getenv("Z_IMAGE_MODEL", "z-image-turbo")
        
        # 转换超时时间
        self.timeout = timeout_ms / 1000.0
        
        # Log init
        try:
            get_logger().info(f"[zimage:init] url={self.base_url} model={self.model} has_key={bool(self.api_key)}")
        except Exception:
            pass

    def _media_paths(self, image_id: str, ext: str):
        """生成本地存储路径"""
        now = datetime.utcnow()
        # 假设当前文件在 backend/app/services/zimage_client.py (根据你的原有逻辑推断)
        # 你可能需要根据实际项目结构调整这里的 parents 数量
        root = pathlib.Path(__file__).resolve().parents[3] / "backend" / "app" / "media"
        
        images_dir = root / "images" / f"{now:%Y}" / f"{now:%m}" / f"{now:%d}"
        thumbs_dir = root / "thumbs" / f"{now:%Y}" / f"{now:%m}" / f"{now:%d}"
        
        images_dir.mkdir(parents=True, exist_ok=True)
        thumbs_dir.mkdir(parents=True, exist_ok=True)
        
        return images_dir / f"{image_id}.{ext}", thumbs_dir / f"{image_id}_thumb.{ext}"

    async def _download_image(self, url: str) -> bytes:
        """内部辅助方法：下载生成的图片"""
        async with httpx.AsyncClient(timeout=30) as client:
            get_logger().info(f"[zimage:download] url={url}")
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.content

    def _get_resolution(self, ratio: str) -> str:
        """根据比例获取官方支持的分辨率字符串"""
        resolution_map = {
            "1:1":  (1024, 1024),
            "4:3":  (1152, 864),
            "3:4":  (864, 1152),
            "16:9": (1280, 720),
            "9:16": (720, 1280),
            "21:9": (1344, 576),
            "9:21": (576, 1344),
        }
        # 默认 1024*1024
        w, h = resolution_map.get(ratio, (1024, 1024))
        
        # 特殊处理 2.35:1 -> 映射到 21:9
        if ratio == "2.35:1":
            w, h = 1344, 576
            
        return f"{w}*{h}"

    async def generate_image(self, prompts: Dict[str, object], params: Dict[str, str]) -> Dict[str, str]:
        # 1. 生成 Image ID
        prompt_text = prompts.get("en", "") or prompts.get("zh", "")
        image_id = hashlib.sha256((prompt_text + str(datetime.now().timestamp())).encode()).hexdigest()[:16]
        ext = "jpg" # 阿里云通常返回 png 或 jpg，这里统一存 jpg

        # 2. 模拟模式（无 Key 时）
        if not self.api_key:
            get_logger().warning("[zimage:mock] No API Key provided, generating mock image.")
            img = Image.new("RGB", (1024, 1024), color=(50, 50, 50))
            buf = BytesIO()
            img.save(buf, format="JPEG")
            final_data = buf.getvalue()
        
        # 3. 真实调用模式
        else:
            headers = {
                "Authorization": f"Bearer {self.api_key}", 
                "Content-Type": "application/json",
                #"X-DashScope-Async": "enable" # 可选：部分大模型建议开启异步，但 z-image-turbo 通常同步较快
            }
            
            # 构建 Payload
            size_str = self._get_resolution(params.get("ratio", "16:9"))
            
            payload = {
                "model": self.model,
                "input": {
                    "messages": [{
                        "role": "user",
                        "content": [{"text": prompt_text}]
                    }]
                },
                "parameters": {
                    "size": size_str,
                    "n": 1,
                    "prompt_extend": False # 根据需要开启或关闭
                }
            }
            
            negative = params.get("negative_prompt") or os.getenv("QWEN_NEGATIVE_PROMPT")
            if negative:
                payload["parameters"]["negative_prompt"] = negative

            # 4. 发起 API 请求
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                get_logger().info(f"[zimage:req] url={self.base_url} body={payload}")
                
                try:
                    response = await client.post(self.base_url, headers=headers, json=payload)
                    # 先检查 HTTP 状态，防止 401/403/500 等
                    response.raise_for_status()
                    
                    # 5. 解析 JSON (DashScope 始终返回 JSON)
                    resp_json = response.json()
                except httpx.HTTPStatusError as e:
                    # 尝试读取报错信息
                    get_logger().error(f"[zimage:http_error] {e.response.text}")
                    raise e
                except Exception as e:
                    get_logger().error(f"[zimage:req_error] {str(e)}")
                    raise

                # 6. 检查 API 业务错误 (如 code 字段)
                if "code" in resp_json and resp_json.get("code"):
                    error_msg = f"DashScope Error: {resp_json.get('code')} - {resp_json.get('message')}"
                    get_logger().error(f"[zimage:api_error] {error_msg}")
                    raise Exception(error_msg)

                # 7. 提取图片 URL  
                image_url = None
                output = resp_json.get("output", {})
                
                # 策略 A: 优先检查 choices (多模态结构，正如日志所示)
                if "choices" in output and len(output["choices"]) > 0:
                    try:
                        # 遍历 content 列表寻找 image 字段
                        content_list = output["choices"][0].get("message", {}).get("content", [])
                        for item in content_list:
                            if "image" in item:
                                image_url = item["image"]
                                break
                    except Exception:
                        pass

                # 策略 B: 检查 results (标准作图结构)
                if not image_url and "results" in output and len(output["results"]) > 0:
                    image_url = output["results"][0].get("url")
                    
                # 策略 C: 直接在 output 里 (偶尔出现)
                if not image_url and "image" in output:
                     image_url = output["image"]

                # 策略 D: 检查 task_status (异步)
                if not image_url and output.get("task_status") in ["PENDING", "RUNNING"]:
                    task_id = output.get("task_id")
                    raise Exception(f"Task is pending. TaskID: {task_id}")

                if not image_url:
                    get_logger().error(f"[zimage:parse_error] Cannot find URL in response: {resp_json}")
                    raise Exception("No image URL found in API response")

                # 8. 下载真正的图片数据
                final_data = await self._download_image(image_url)

        # 9. 后处理：保存原图与缩略图
        get_logger().info(f"[zimage:save] id={image_id} size_bytes={len(final_data)}")
        
        image_path, thumb_path = self._media_paths(image_id, ext)
        
        # 写入原图
        with open(image_path, "wb") as f:
            f.write(final_data)
        
        # 生成缩略图
        try:
            with Image.open(BytesIO(final_data)) as img:
                # 转换为 RGB 以防 PNG 透明通道导致 JPEG 保存失败
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                
                img.thumbnail((360, 360)) # 稍微大一点的缩略图
                img.save(thumb_path, format="JPEG", quality=80)
        except Exception as e:
            get_logger().error(f"[zimage:thumb_error] {str(e)}")
            # 如果缩略图失败，复制原图（兜底）或生成占位
            pass

        # 10. 返回结果
        rel_image = str(image_path).split("backend/app")[-1] if "backend/app" in str(image_path) else str(image_path)
        rel_thumb = str(thumb_path).split("backend/app")[-1] if "backend/app" in str(thumb_path) else str(thumb_path)

        return {
            "image_id": image_id,
            "image_url": f"/media{rel_image}",
            "thumbnail_url": f"/media{rel_thumb}",
            "mime_type": "image/jpeg",
            "size_bytes": str(len(final_data))
        }