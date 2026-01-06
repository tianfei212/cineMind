from typing import Optional, Dict
from pydantic import BaseModel, RootModel


class GenerateRequestKV(RootModel[Dict[str, str]]):
    pass


class TaskAccepted(BaseModel):
    task_id: str
    queued_at: str


class TaskStatusOut(BaseModel):
    status: str
    progress: float
    image_id: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
