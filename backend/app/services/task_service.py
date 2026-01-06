from typing import Dict
from sqlalchemy.orm import Session
from ..models.task import Task
from ..models.graph_result import GraphResult
from .prompt_builder import build_prompts
from .qwen_client import QwenClient
from .zimage_client import ZImageClient
import json
from datetime import datetime


async def enqueue_generate(db: Session, payload: Dict[str, str]) -> Task:
    t = Task()
    t.status = "queued"
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


async def process_task(db: Session, task: Task, payload: Dict[str, str]) -> GraphResult:
    task.status = "running"
    db.commit()
    preset = build_prompts(payload)
    qwen = QwenClient()
    prompts = await qwen.generate_prompts(payload, preset)
    params = {
        "ratio": payload.get("图像比例", ""),
        "resolution": payload.get("分辨率", ""),
    }
    if "分辨率" in payload and "x" in payload["分辨率"]:
        w, h = payload["分辨率"].split("x")
        params["width"] = w
        params["height"] = h
    zimg = ZImageClient()
    result = await zimg.generate_image(prompts, params)
    gr = GraphResult()
    gr.related_nodes = json.dumps([])
    gr.params = json.dumps(params)
    gr.prompt_zh = prompts.get("zh") or ""
    gr.prompt_en = prompts.get("en") or ""
    gr.storage_path = result["image_url"]
    gr.thumbnail_path = result["thumbnail_url"]
    gr.mime_type = result["mime_type"]
    gr.size_bytes = int(result["size_bytes"])
    gr.generated_at = datetime.utcnow()
    db.add(gr)
    task.status = "completed"
    db.commit()
    db.refresh(gr)
    return gr

