from typing import Dict, List


def build_prompts(payload: Dict[str, str]) -> Dict[str, object]:
    zh_parts: List[str] = []
    en_parts: List[str] = []
    def add_pair(zh_label: str, en_key: str):
        if zh_label in payload and payload[zh_label]:
            zh_parts.append(payload[zh_label])
            en_parts.append(f"{en_key}: {payload[zh_label]}")
    add_pair("影片类型", "film type")
    add_pair("环境背景", "environment")
    add_pair("主角类型", "main role")
    add_pair("角色个体", "character")
    add_pair("精彩瞬间", "moment")
    add_pair("关键元素", "element")
    add_pair("镜头语言", "camera")
    add_pair("年代", "era")
    style_hints: List[str] = []
    for k in ["光照风格", "镜头语言"]:
        if k in payload and payload[k]:
            style_hints.append(payload[k])
    # 关键词汇总（仅中文）
    for k in list(payload.keys()):
        if k.startswith("关键词_") and isinstance(payload[k], list):
            zh_parts.extend([str(x) for x in payload[k] if isinstance(x, str)])
    ratio = payload.get("图像比例", "")
    res = payload.get("分辨率", "")
    if ratio:
        en_parts.append(f"ratio: {ratio}")
    if res:
        en_parts.append(f"resolution: {res}")
    content = payload.get("内容", "")
    if content:
        zh_parts.append(content)
        en_parts.append("content: " + content)
    return {"zh": "，".join([p for p in zh_parts if p]), "en": ", ".join([p for p in en_parts if p]), "styleHints": style_hints}
