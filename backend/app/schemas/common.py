from typing import Any, Optional, List, Dict
from pydantic import BaseModel, Field


class ApiResponseModel(BaseModel):
    code: int = Field(0)
    message: str = Field("ok")
    data: Optional[Any] = None


class PageMeta(BaseModel):
    page: int
    size: int
    total: int

