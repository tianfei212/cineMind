from typing import Dict, List


def build_prompts(payload: Dict[str, str]) -> Dict[str, object]:
    zh_parts: List[str] = []
    en_parts: List[str] = []
    if "环境背景" in payload:
        zh_parts.append(payload["环境背景"])
        en_parts.append("environment: " + payload["环境背景"])
    if "影片类型" in payload:
        zh_parts.append(payload["影片类型"])
        en_parts.append("film type: " + payload["影片类型"])
    style_hints: List[str] = []
    for k in ["光照风格", "镜头语言"]:
        if k in payload and payload[k]:
            style_hints.append(payload[k])
            zh_parts.append(payload[k])
            en_parts.append(k + ": " + payload[k])
    return {"zh": "，".join(zh_parts), "en": ", ".join(en_parts), "styleHints": style_hints}

