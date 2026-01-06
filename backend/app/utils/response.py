from typing import Any, Optional
from fastapi import Response
from pydantic import BaseModel


class ApiResponse(BaseModel):
    code: int
    message: str
    data: Optional[Any] = None


def ok(data: Any = None, message: str = "ok") -> ApiResponse:
    return ApiResponse(code=0, message=message, data=data)


def error(code: int, message: str, data: Any = None, status_code: int = 400) -> Response:
    from fastapi.responses import ORJSONResponse
    return ORJSONResponse(status_code=status_code, content=ApiResponse(code=code, message=message, data=data).model_dump())

