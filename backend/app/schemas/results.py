from typing import Optional, Dict, Any
from pydantic import BaseModel


class GraphResultOut(BaseModel):
    graph_id: str
    storage_path: str
    thumbnail_path: Optional[str] = None
    prompts: Dict[str, str]
    params: Dict[str, Any]
    generated_at: str

