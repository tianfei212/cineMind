import os
from typing import Dict, List
import httpx
import uuid
from ..utils.logger import get_logger
from typing import Optional
import re


class QwenClient:
    def __init__(self, timeout_ms: int = 30000):
        self.base_url = os.getenv("QWEN_BASE_URL", "")
        self.api_key = os.getenv("QWEN_API_KEY", "")
        self.model = os.getenv("QWEN_MODEL", "qwen-max")
        self.timeout = timeout_ms / 1000.0
        self.role_prompt = os.getenv(
            "QWEN_ROLE_PROMPT",
            "You are an expert AI image generation prompt engineer. Produce Chinese and English prompts and top keywords.",
        )
        self.default_negative = os.getenv("QWEN_NEGATIVE_PROMPT", "文字，水印，签名，模糊，重影，低对比度，畸形肢体")
        self.log = get_logger()

    async def _chat(self, messages: List[Dict[str, str]]) -> str:
        if not self.base_url or not self.api_key:
            self.log.warning("qwen disabled: missing base_url or api_key")
            return ""
        headers = {"Authorization": f"Bearer {self.api_key}"}
        payload = {"model": self.model, "messages": messages}
        rid = str(uuid.uuid4())
        try:
            preview = "\n".join([f"{m.get('role','')}: {str(m.get('content',''))[:200]}" for m in messages])
            self.log.info(f"[qwen:req] id={rid} model={self.model} url={self.base_url} messages=\n{preview}")
        except Exception:
            pass
        for _ in range(3):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    r = await client.post(self.base_url, headers=headers, json=payload)
                    if r.status_code == 200:
                        data = r.json()
                        # OpenAI compatible response
                        content = data.get("choices", [{}])[0].get("message", {}).get("content", "") or ""
                        try:
                            self.log.info(f"[qwen:res] id={rid} status=200 len={len(content)} body={content[:800]}")
                        except Exception:
                            pass
                        return content
                    else:
                        self.log.warning(f"[qwen:res] id={rid} status={r.status_code} body={(r.text or '')[:400]}")
            except Exception as e:
                self.log.error(f"[qwen:err] id={rid} {str(e)}")
        return ""

    async def generate_prompts(self, payload: Dict[str, str], preset: Dict[str, str], user_template: 'Optional[str]' = None, role_override: 'Optional[str]' = None, negative_override: 'Optional[str]' = None) -> Dict[str, object]:
        zh_seed = preset.get("zh", "")
        en_seed = preset.get("en", "")
        style_hints = preset.get("styleHints", [])
        labels = payload.get("labels") if isinstance(payload.get("labels"), list) else []
        text = payload.get("text") or f"{zh_seed} {en_seed}".strip()
        tpl = user_template or f"中文要素: {zh_seed}\nEnglish seed: {en_seed}\nStyle hints: {', '.join(style_hints)}\nNegative: {self.default_negative}\n请给出中文和英文的成品提示词。"
        labels_joined = " > ".join(labels) if labels else text
        neg = negative_override or self.default_negative
        content = tpl.format(labels_joined=labels_joined, negative_prompt=neg, top=str(payload.get('top') or 10))
        role = role_override or self.role_prompt
        msg = [{"role": "system", "content": role}, {"role": "user", "content": content}]
        resp = await self._chat(msg)
        if not resp:
            self.log.info(f"[qwen:fallback_prompts] zh_seed_len={len(zh_seed)} en_seed_len={len(en_seed)}")
            return {"zh": zh_seed, "en": en_seed, "styleHints": style_hints}
        # naive split
        parts = resp.split("\n")
        zh = ""
        en = ""
        for p in parts:
            if "中文" in p:
                zh = p.split("：")[-1].strip()
            elif "English" in p or "英文" in p:
                en = p.split(":")[-1].strip()
        try:
            self.log.info(f"[qwen:prompts] zh_len={len(zh)} en_len={len(en)}")
        except Exception:
            pass
        return {"zh": zh or zh_seed, "en": en or en_seed, "styleHints": style_hints}

    async def generate_keywords(self, text: str, top: int = 10, user_template: 'Optional[str]' = None, role_override: 'Optional[str]' = None) -> List[str]:
        tpl = user_template or f"基于以下节点内容，生成最有可能的Top{top}中文关键词，以逗号分隔，仅输出关键词：\n{text}"
        role = role_override or self.role_prompt
        try:
            self.log.info(f"[qwen:kw:tpl] len={len(tpl)} head={tpl[:200]}")
        except Exception:
            pass
        msg = [{"role": "system", "content": role}, {"role": "user", "content": tpl}]
        resp = await self._chat(msg)
        if not resp:
            words = [w for w in text.replace("，", " ").replace(",", " ").replace("、", " ").replace(";", " ").replace("；", " ").split() if len(w.strip()) > 1]
            try:
                self.log.info(f"[qwen:fallback_keywords] text_len={len(text)} count={len(words)}")
            except Exception:
                pass
            # 去重并裁剪到指定数量
            seen = set()
            result = []
            for w in words:
                if w not in seen:
                    seen.add(w)
                    result.append(w)
                if len(result) >= top:
                    break
            return result
        # 规范化为行列表
        s = resp.strip()
        s = re.sub(r"[，、;；]+", "\n", s)
        lines = [ln.strip() for ln in s.splitlines() if ln.strip()]
        cleaned = []
        for ln in lines:
            ln = re.sub(r"^\s*[\d一二三四五六七八九十]+[.)、\-:\s]*", "", ln)
            ln = re.sub(r"[\s,，、;；。.!?]+$", "", ln)
            ln = ln.strip()
            # 仅保留纯中文行
            if ln and re.match(r"^[\u4e00-\u9fa5]+$", ln):
                cleaned.append(ln)
        # 去重并确保最多 top 项
        out = []
        seen = set()
        for ln in cleaned:
            if ln not in seen:
                seen.add(ln)
                out.append(ln)
            if len(out) >= top:
                break
        # 如果不足top，尝试从响应中提取中文片段补足
        if len(out) < top:
            extras = re.findall(r"[\u4e00-\u9fa5]{2,}", s)
            for w in extras:
                if w not in seen:
                    seen.add(w)
                    out.append(w)
                if len(out) >= top:
                    break
        try:
            self.log.info(f"[qwen:keywords] text_len={len(text)} top={top} got={len(out)}")
        except Exception:
            pass
        return out
