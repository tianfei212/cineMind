import os
from typing import List
from sqlalchemy.orm import Session
from ..models.mind_node import MindNode
from .qwen_client import QwenClient


async def top10_keywords(db: Session, node_id: str) -> List[str]:
    use_ai = os.getenv("Is_full_by_AI", "false").lower() == "true"
    node = db.query(MindNode).filter(MindNode.node_id == node_id).first()
    if not node:
        return []
    if use_ai:
        client = QwenClient()
        return await client.generate_keywords(node.content, 10)
    words = [w for w in node.content.replace("，", " ").replace(",", " ").split() if len(w) > 1]
    return words[:10]
