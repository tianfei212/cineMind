import os
import json
from pathlib import Path


class ConfigService:
    def __init__(self):
        base_dir = Path(__file__).resolve().parents[1]
        self.file_path = base_dir / "config" / "config.json"

    def load(self):
        cfg = {}
        try:
            if self.file_path.exists():
                with open(self.file_path, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
        except Exception:
            cfg = {}
        endpoints = (cfg.get("endpoints") or {})
        api_keys = (cfg.get("api_keys") or {})
        models = (cfg.get("models") or {})
        if endpoints.get("qwen"):
            os.environ["QWEN_BASE_URL"] = endpoints["qwen"]
        if api_keys.get("dashscope"):
            os.environ["QWEN_API_KEY"] = api_keys["dashscope"]
        if models.get("qwen"):
            os.environ["QWEN_MODEL"] = models["qwen"]
        prompts = cfg.get("prompts") or {}
        if prompts.get("role"):
            os.environ["QWEN_ROLE_PROMPT"] = prompts["role"]
        if prompts.get("default_negative_prompt"):
            os.environ["QWEN_NEGATIVE_PROMPT"] = prompts["default_negative_prompt"]
        return cfg

