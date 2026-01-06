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
    
    # 重新组装 content 字段为 JSON 键值对字符串
    content_dict = {}
    valid_keys = ["影片类型", "环境背景", "主角类型", "角色个体", "精彩瞬间", "关键元素", "镜头语言", "年代", "图像比例"]
    for k in valid_keys:
        val = payload.get(k)
        if val:
            content_dict[k] = val
            
    # 如果 payload 中有 resolutionKey，也加上
    if "resolutionKey" in payload:
        content_dict["resolutionKey"] = payload["resolutionKey"]
        
        # 将字典转为 JSON 字符串，确保中文不乱码
    content_str = json.dumps(content_dict, ensure_ascii=False)

    # 仅保留 resolutionKey 之前需要的字段，结合 task_generate 模板
    payload_for_llm = {
        "task_id": payload.get("任务ID") or payload.get("task_id") or "",
        "image_ratio": payload.get("图像比例") or payload.get("ratio") or "",
        "resolution": payload.get("分辨率") or payload.get("resolution") or "",
        "content": content_str,
    }
    user_tpl = None
    if tpl:
        # Manually replace placeholders to avoid KeyError with JSON braces in content
        user_tpl = tpl.replace("{content}", content_str) \
                      .replace("{image_ratio}", str(payload_for_llm["image_ratio"])) \
                      .replace("{resolution}", str(payload_for_llm["resolution"])) \
                      .replace("{task_id}", str(payload_for_llm["task_id"]))
    # 向Qwen只发送最小化payload，避免无关字段
    try:
        log.info(f"[task_generate:req] task_id={payload_for_llm['task_id']} ratio={payload_for_llm['image_ratio']} res={payload_for_llm['resolution']}")
        if user_tpl:
            log.info(f"[task_generate:tpl] {user_tpl}")
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
        try:
            en_preview = (prompts.get("en") or "")[:200]
            log.info(f"[zimage:req] prompt_en_len={len(prompts.get('en',''))} head={en_preview}")
        except Exception:
            pass
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
    try:
        log.info(f"[task_generate:graph] graph_id={gr.graph_id} image_url={gr.storage_path} thumb={gr.thumbnail_path}")
    except Exception:
        pass
    return gr
