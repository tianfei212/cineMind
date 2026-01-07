from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from ..schemas.nodes import MindNodeCreate, MindNodeUpdate, MindNodeOut, KeywordsOut
from ..utils.response import ok, error
from ..utils.errors import ErrorCodes
from ..utils.validators import compute_etag
from ..db.session import SessionLocal
from ..models.mind_node import MindNode
from ..services.keywords_service import top10_keywords
from ..services.qwen_client import QwenClient
from typing import List
from datetime import datetime
import os
from pydantic import BaseModel
from ..utils.logger import get_logger

router = APIRouter(prefix="/nodes", tags=["Nodes"])
log = get_logger()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("")
def create_node(payload: MindNodeCreate, db: Session = Depends(get_db)):
    if not payload.content or not isinstance(payload.content, str):
        return error(ErrorCodes.INVALID_PARAM, "content invalid")
    node = MindNode(content=payload.content.strip(), status=payload.status or 1)
    db.add(node)
    db.commit()
    db.refresh(node)
    return ok(MindNodeOut(node_id=node.node_id, content=node.content, created_at=node.created_at.isoformat(), updated_at=node.updated_at.isoformat(), status=node.status).model_dump())


@router.get("/tree")
def image_nodes(request: Request):
    cfg = getattr(request.app.state, "config", {}) or {}
    tree = cfg.get("cinematicTree") or {
        "label": "起点",
        "desc": "电影构图发散树的根节点",
        "children": [{"label": "科幻"}, {"label": "动作电影"}, {"label": "浪漫电影"}],
    }
    return ok(tree)


@router.put("/{node_id}")
def update_node(node_id: str, payload: MindNodeUpdate, db: Session = Depends(get_db)):
    node = db.query(MindNode).filter(MindNode.node_id == node_id).first()
    if not node:
        return error(ErrorCodes.NOT_FOUND, "node not found", status_code=404)
    if payload.version is not None:
        current_version = int(node.updated_at.timestamp())
        if payload.version != current_version:
            return error(ErrorCodes.CONFLICT, "version conflict", status_code=409)
    if payload.content is not None:
        node.content = payload.content
    if payload.status is not None:
        node.status = int(payload.status)
    node.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(node)
    return ok(MindNodeOut(node_id=node.node_id, content=node.content, created_at=node.created_at.isoformat(), updated_at=node.updated_at.isoformat(), status=node.status).model_dump())


@router.delete("/{node_id}")
def delete_node(node_id: str, db: Session = Depends(get_db)):
    node = db.query(MindNode).filter(MindNode.node_id == node_id).first()
    if not node:
        return error(ErrorCodes.NOT_FOUND, "node not found", status_code=404)
    node.status = 0
    node.updated_at = datetime.utcnow()
    db.commit()
    return ok({"deleted": True})


@router.get("")
def list_nodes(page: int = 1, size: int = 20, status: int = 1, query: str = "", db: Session = Depends(get_db)):
    q = db.query(MindNode)
    if status in (0, 1):
        q = q.filter(MindNode.status == status)
    if query:
        q = q.filter(MindNode.content.like(f"%{query}%"))
    total = q.count()
    items = q.order_by(MindNode.created_at.desc()).offset((page - 1) * size).limit(size).all()
    data = []
    for n in items:
        data.append(MindNodeOut(node_id=n.node_id, content=n.content, created_at=n.created_at.isoformat(), updated_at=n.updated_at.isoformat(), status=n.status).model_dump())
    return ok({"page": page, "size": size, "total": total, "items": data})


@router.get("/{node_id}/keywords")
async def node_keywords(node_id: str, top: int = 10, db: Session = Depends(get_db)):
    kws = await top10_keywords(db, node_id)
    source = "ai" if os.getenv("Is_full_by_AI", "false").lower() == "true" else "db"
    return ok(KeywordsOut(node_id=node_id, source=source, items=kws[:top]).model_dump())


@router.get("/{node_id}/ai-content")
async def node_ai_content(node_id: str, db: Session = Depends(get_db)):
    node = db.query(MindNode).filter(MindNode.node_id == node_id).first()
    if not node:
        return error(ErrorCodes.NOT_FOUND, "node not found", status_code=404)
    client = QwenClient()
    preset = {"zh": node.content, "en": node.content, "styleHints": []}
    prompts = await client.generate_prompts({"内容": node.content}, preset)
    return ok({"node_id": node_id, "prompts": prompts})

class AiSuggestIn(BaseModel):
    labels: List[str]
    top: int = 10

@router.post("/ai-suggest")
async def ai_suggest(payload: AiSuggestIn):
    labels = payload.labels or []
    text = " > ".join(labels)
    client = QwenClient()
    preset = {"zh": text, "en": text, "styleHints": []}
    try:
        log.info(f"[ai-suggest:req] labels={labels} top={payload.top}")
    except Exception:
        pass
    cfg = getattr(router, "app_state_config", None)
    role = None
    neg = None
    user_tpl_prompts = None
    user_tpl_keywords = None
    try:
        app_cfg = getattr(ai_suggest, "__self__", None)
    except Exception:
        app_cfg = None
    try:
        from fastapi import Request
    except Exception:
        pass
    prompts_cfg = getattr(getattr(ai_suggest, "__globals__", {}), "app", None)
    app = None
    try:
        from ..main import app as main_app
        app = main_app
    except Exception:
        pass
    if app and hasattr(app.state, "config"):
        c = app.state.config or {}
        pr = c.get("prompts") or {}
        role = pr.get("role")
        neg = pr.get("default_negative_prompt")
        flows = pr.get("flows") or []
        for f in flows:
            if f.get("id") == "ai_suggest":
                user_tpl_prompts = f.get("user_template")
            if f.get("id") == "keywords_from_labels":
                user_tpl_keywords = f.get("user_template")
    prompts = await client.generate_prompts({"labels": labels, "text": text, "top": payload.top}, preset, user_template=user_tpl_prompts, role_override=role, negative_override=neg)
    keywords = await client.generate_keywords(text, payload.top, user_template=user_tpl_keywords, role_override=role)
    try:
        log.info(f"[ai-suggest:res] zh_len={len(prompts.get('zh',''))} en_len={len(prompts.get('en',''))} kw_count={len(keywords)}")
    except Exception:
        pass
    return ok({"labels": labels, "prompts": prompts, "keywords": keywords})

class StepItem(BaseModel):
    type: str
    label: str

class StepSuggestIn(BaseModel):
    items: List[StepItem]
    target_type: str
    top: int = 10

@router.post("/actions/step-suggest")
async def step_suggest(payload: StepSuggestIn):
    items = payload.items or []
    target = payload.target_type
    topn = payload.top
    client = QwenClient()
    try:
        log.info(f"[step-suggest:req] target={target} top={topn} items={[(i.type, i.label) for i in items]}")
    except Exception:
        pass
    role = None
    user_tpl = None
    app = None
    try:
        from ..main import app as main_app
        app = main_app
    except Exception:
        pass
    if app and hasattr(app.state, "config"):
        c = app.state.config or {}
        pr = c.get("prompts") or {}
        role = pr.get("role")
        flows = pr.get("flows") or []
        for f in flows:
            if f.get("id") == "step_suggest":
                user_tpl = f.get("user_template")
    # 强规则覆盖：每行一个关键词，仅TopN行，无解释
    role = f"你是资深影像提示词工程师。仅返回与查询内容最相关的Top{topn}中文关键提示词，输出格式为纯文本列表，每行一个关键词；禁止输出任何解释、问题或说明；行数必须等于{topn}。"
    context_lines = "\n".join([f"{i.type}: {i.label}" for i in items])
    film_labels = [i.label for i in items if i.type == "影片类型"]
    film_combo = "、".join(film_labels) if film_labels else "未指定"
    text = f"{context_lines}\n目标类别: {target}\n影片类型组合: {film_combo}"
    
    final_tpl = None
    if isinstance(user_tpl, dict):
        final_tpl = user_tpl.get(target) or user_tpl.get("default")
    elif isinstance(user_tpl, str):
        final_tpl = user_tpl
        
    if not final_tpl:
        final_tpl = "请基于影片类型组合「{film_combo}」为目标类别「{target}」生成Top{top}条中文关键提示词。严格格式：仅输出纯中文关键词列表，每行恰好一个关键词；禁止任何编号、标点、符号或解释；总行数必须为{top}；每个关键词独立且具备检索价值。"
        
    tpl_filled = final_tpl.format(film_combo=film_combo, target=target, top=topn)
    kw = await client.generate_keywords(text, topn, user_template=tpl_filled, role_override=role)
    try:
        log.info(f"[step-suggest:res] target={target} count={len(kw)}")
    except Exception:
        pass
    return ok({"target_type": target, "items": kw})

@router.get("/{node_id}")
def get_node(node_id: str, request: Request, db: Session = Depends(get_db)):
    node = db.query(MindNode).filter(MindNode.node_id == node_id).first()
    if not node:
        return error(ErrorCodes.NOT_FOUND, "node not found", status_code=404)
    etag_value = compute_etag(f"{node.node_id}:{node.updated_at.isoformat()}")
    inm = request.headers.get("If-None-Match")
    if inm and inm == etag_value:
        from fastapi.responses import Response
        return Response(status_code=304)
    from fastapi.responses import ORJSONResponse
    res = ok(MindNodeOut(node_id=node.node_id, content=node.content, created_at=node.created_at.isoformat(), updated_at=node.updated_at.isoformat(), status=node.status).model_dump())
    r = ORJSONResponse(content=res.model_dump())
    r.headers["ETag"] = etag_value
    return r
