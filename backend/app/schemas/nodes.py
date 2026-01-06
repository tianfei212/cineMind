from typing import Optional, List
from pydantic import BaseModel, Field


class MindNodeCreate(BaseModel):
    content: str
    status: Optional[int] = 1


class MindNodeUpdate(BaseModel):
    content: Optional[str] = None
    status: Optional[int] = None
    version: Optional[int] = None


class MindNodeOut(BaseModel):
    node_id: str
    content: str
    created_at: str
    updated_at: str
    status: int


class KeywordsOut(BaseModel):
    node_id: str
    source: str
    items: List[str]

