import re
import uuid


def is_uuid(s: str) -> bool:
    try:
        uuid.UUID(s)
        return True
    except Exception:
        return False


def is_ratio(s: str) -> bool:
    return bool(re.fullmatch(r"\d+:\d+", s))


def is_resolution(s: str) -> bool:
    return bool(re.fullmatch(r"\d+x\d+", s))


def non_empty_str(s: str) -> bool:
    return isinstance(s, str) and s.strip() != ""


def compute_etag(payload: str) -> str:
    import hashlib
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

def normalize_task_payload(payload: dict) -> dict:
    if not isinstance(payload, dict):
        return {}
    p = dict(payload)
    mapping = {
        "task_id": "任务ID",
        "image_ratio": "图像比例",
        "ratio": "图像比例",
        "resolution": "分辨率",
        "film_type": "影片类型",
        "environment": "环境背景",
        "main_role": "主角类型",
        "role": "角色个体",
        "moment": "精彩瞬间",
        "element": "关键元素",
        "camera": "镜头语言",
        "era": "年代",
        "content": "内容",
    }
    for k_en, k_cn in mapping.items():
        if k_en in p and k_cn not in p:
            p[k_cn] = p[k_en]
    return p
