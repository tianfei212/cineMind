from typing import Dict
from sqlalchemy.orm import Session
from ..models.task import Task
from ..models.graph_result import GraphResult
from .prompt_builder import build_prompts
from .qwen_client import QwenClient
from .zimage_client import ZImageClient
import json
from datetime import datetime
from ..services.config_service import ConfigService
from ..utils.logger import get_logger


async def enqueue_generate(db: Session, payload: Dict[str, str]) -> Task:
    t = Task()
    t.status = "queued"
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


async def process_task(db: Session, task: Task, payload: Dict[str, str]) -> GraphResult:
    log = get_logger()
    task.status = "running"
    db.commit()
    preset = build_prompts(payload)
    qwen = QwenClient()
    cfg = ConfigService().load() or {}
    pr = cfg.get("prompts") or {}
    flows = pr.get("flows") or []
    tpl = None
    for f in flows:
        if f.get("id") == "task_generate":
            tpl = f.get("user_template")
            break
    role = pr.get("role")
    content_str = preset.get("zh") or ""
    # 仅保留 resolutionKey 之前需要的字段，结合 task_generate 模板
    payload_for_llm = {
        "task_id": payload.get("任务ID") or payload.get("task_id") or "",
        "image_ratio": payload.get("图像比例") or payload.get("ratio") or "",
        "resolution": payload.get("分辨率") or payload.get("resolution") or "",
        "content": payload.get("内容") or content_str,
    }
    user_tpl = None
    if tpl:
        user_tpl = tpl.format(
            task_id=payload_for_llm["task_id"],
            image_ratio=payload_for_llm["image_ratio"],
            resolution=payload_for_llm["resolution"],
            content=payload_for_llm["content"],
        )
    # 向Qwen只发送最小化payload，避免无关字段
    try:
        log.info(f"[task_generate:req] task_id={payload_for_llm['task_id']} ratio={payload_for_llm['image_ratio']} res={payload_for_llm['resolution']}")
        if user_tpl:
            log.info(f"[task_generate:tpl] head={user_tpl[:200]}")
        prompts = await qwen.generate_prompts(payload_for_llm, preset, user_template=user_tpl, role_override=role)
        log.info(f"[task_generate:prompts] zh_len={len(prompts.get('zh',''))} en_len={len(prompts.get('en',''))}")
    except Exception as e:
        log.error(f"[task_generate:error_qwen] {str(e)}")
        raise
    params = {
        "ratio": payload.get("图像比例", ""),
        "resolution": payload.get("分辨率", ""),
    }
    if "分辨率" in payload and "x" in payload["分辨率"]:
        w, h = payload["分辨率"].split("x")
        params["width"] = w
        params["height"] = h
    zimg = ZImageClient()
    try:
        log.info(f"[zimage:req] params={json.dumps(params, ensure_ascii=False)}")
        result = await zimg.generate_image(prompts, params)
        log.info(f"[zimage:res] image_id={result.get('image_id')} mime={result.get('mime_type')} size={result.get('size_bytes')}")
    except Exception as e:
        log.error(f"[zimage:error] {str(e)}")
        raise
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
